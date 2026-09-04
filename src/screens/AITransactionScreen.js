import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { formatCurrency, formatTimeAgo, getCurrentTimestamp } from '../utils/formatters';
import { Header } from '../components/common/Header';
import {
  parseNaturalLanguageTransaction,
  checkAiServerStatus,
  testAiApiKey,
  AI_MODELS,
  DEFAULT_AI_MODEL,
} from '../services/aiParserService';

const SAMPLE_PROMPTS = [
  'Surendar ko 20 cash diya khane k liye',
  '500 petrol UPI se',
  'Amazon se 899 ka saman UPI se',
  'Salary 25000 account me aayi',
  'Ramesh se 2000 cash mila',
  'Bijli ka bill 1200 diya online',
];

export const AITransactionScreen = () => {
  const {
    categories,
    parties,
    saveTransaction,
    deleteTransactionItem,
    recentTransactions,
    openTransactionDetails,
    setActiveTab,
    setIsManageCategoriesOpen,
    authToken,
    currentUser,
    networkStatus,
  } = useApp();

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showAiInfoModal, setShowAiInfoModal] = useState(false);

  // Selected AI Model (Defaults to Gemini 2.5 Flash Lite)
  const [selectedModel, setSelectedModel] = useState(DEFAULT_AI_MODEL);

  // AI Server Online State
  const [isCheckingAi, setIsCheckingAi] = useState(true);
  const [aiStatus, setAiStatus] = useState({
    isOnline: false,
    domain: 'expense.tplpro.in',
    endpoint: 'https://expense.tplpro.in/api/v1/ai_parse.php',
    provider: 'Airouter',
    model: DEFAULT_AI_MODEL,
    statusCode: 0,
    message: 'Checking AI Server...',
  });

  // API Key Live Testing State
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyTestResult, setKeyTestResult] = useState(null);

  // Success Undo State
  const [lastSavedTx, setLastSavedTx] = useState(null);
  const [undoCountdown, setUndoCountdown] = useState(0);
  const undoTimerRef = useRef(null);

  // Editable Preview / Confirmation State
  const [previewData, setPreviewData] = useState(null);
  const [previewAmount, setPreviewAmount] = useState('');
  const [previewType, setPreviewType] = useState('gave');
  const [previewMode, setPreviewMode] = useState('cash');
  const [previewCategoryId, setPreviewCategoryId] = useState(null);
  const [previewPartyId, setPreviewPartyId] = useState(null);
  const [previewNote, setPreviewNote] = useState('');

  const inputRef = useRef(null);

  // Re-check AI Server Online Status
  const checkStatus = useCallback(async (modelToUse) => {
    setIsCheckingAi(true);
    const m = modelToUse || selectedModel;
    const status = await checkAiServerStatus(m);
    setAiStatus(status);
    setIsCheckingAi(false);
  }, [selectedModel]);

  const handleSelectModel = (modelId) => {
    triggerHaptic('light');
    setSelectedModel(modelId);
    checkStatus(modelId);
  };

  // Run live test of AI API Key directly against Airouter with chosen model
  const handleTestApiKey = async () => {
    triggerHaptic('light');
    setIsTestingKey(true);
    setKeyTestResult(null);

    try {
      const result = await testAiApiKey(selectedModel);
      setKeyTestResult({
        tested: true,
        success: result.success && result.keyValid,
        latencyMs: result.latencyMs,
        message: result.message,
        provider: result.provider,
        model: result.model,
      });

      if (result.success && result.keyValid) {
        setAiStatus((prev) => ({
          ...prev,
          isOnline: true,
          keyFetched: true,
          dbKeyFound: true,
          maskedKey: result.maskedKey || prev.maskedKey,
          keySource: result.keySource || prev.keySource,
          statusCode: 200,
          message: result.message,
        }));
      }

      triggerHaptic(result.success && result.keyValid ? 'success' : 'error');
    } catch (err) {
      setKeyTestResult({
        tested: true,
        success: false,
        latencyMs: 0,
        message: err.message || 'Key test failed.',
      });
      triggerHaptic('error');
    } finally {
      setIsTestingKey(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    checkStatus();

    // Auto-retry after 1.5s in case network was initializing on cold start
    const retryTimer = setTimeout(() => {
      if (isMounted) checkStatus();
    }, 1500);

    return () => {
      isMounted = false;
      clearTimeout(retryTimer);
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    };
  }, [checkStatus]);

  const triggerHaptic = (type = 'light') => {
    try {
      if (type === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (type === 'error') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch (e) {}
  };

  const handleClear = () => {
    setInputText('');
    setErrorMessage(null);
  };

  const handleSelectSample = (sample) => {
    triggerHaptic('light');
    setInputText(sample);
    setErrorMessage(null);
  };

  const handleSubmitWithText = async (customText) => {
    const textToProcess = (customText !== undefined ? customText : inputText).trim();
    if (!textToProcess) return;

    // Check AI server connectivity first
    if (!aiStatus.isOnline) {
      triggerHaptic('error');
      setErrorMessage(`AI Engine is currently OFFLINE (${aiStatus.message}). Upload backend/api/v1/ai_parse.php to your server to activate.`);
      checkStatus();
      return;
    }

    triggerHaptic('light');
    setIsProcessing(true);
    setErrorMessage(null);
    setPreviewData(null);

    // Clear any previous undo banner
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    setUndoCountdown(0);

    try {
      const authSession = authToken ? { token: authToken, user: currentUser } : null;
      const parseResult = await parseNaturalLanguageTransaction(
        textToProcess,
        categories,
        parties,
        authSession,
        selectedModel
      );

      if (!parseResult.success || !parseResult.data) {
        throw new Error(parseResult.message || "Couldn't understand the transaction with AI. Please try again.");
      }

      const parsed = parseResult.data;

      // Check if essential information is missing or needs confirmation
      if (parsed.needs_confirmation || !parsed.amount || parsed.amount <= 0) {
        setPreviewData(parsed);
        setPreviewAmount(parsed.amount ? String(parsed.amount) : '');
        setPreviewType(parsed.type || 'gave');
        setPreviewMode(parsed.payment_mode || 'cash');
        setPreviewCategoryId(parsed.category_id || (categories[0]?.id || null));
        setPreviewPartyId(parsed.party_id || null);
        setPreviewNote(parsed.note || textToProcess);
        triggerHaptic('light');
      } else {
        // High confidence: Save directly using existing transaction pipeline
        const newTx = saveTransaction({
          amount: parsed.amount,
          type: parsed.type,
          paymentMode: parsed.payment_mode || 'cash',
          categoryId: parsed.category_id,
          partyId: parsed.party_id,
          note: parsed.note || textToProcess,
          transactionDate: getCurrentTimestamp(),
        });

        triggerHaptic('success');
        setInputText('');

        // Show Instant Undo Banner for 5 seconds
        setLastSavedTx({
          ...newTx,
          parsedDetails: parsed,
          text: textToProcess,
        });
        setUndoCountdown(5);

        if (undoTimerRef.current) clearInterval(undoTimerRef.current);
        undoTimerRef.current = setInterval(() => {
          setUndoCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(undoTimerRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (err) {
      triggerHaptic('error');
      setErrorMessage(err.message || 'AI parsing failed. Please check AI server.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = () => handleSubmitWithText();

  const handleUndo = () => {
    if (!lastSavedTx || !lastSavedTx.id) return;

    triggerHaptic('light');
    if (undoTimerRef.current) clearInterval(undoTimerRef.current);
    setUndoCountdown(0);

    // Delete transaction from database
    deleteTransactionItem(lastSavedTx.id);

    // Restore user's text in input for quick editing
    if (lastSavedTx.text) {
      setInputText(lastSavedTx.text);
    }
    setLastSavedTx(null);
  };

  const handleSavePreview = () => {
    const cleanAmount = parseFloat(previewAmount.replace(/,/g, ''));
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      triggerHaptic('error');
      setErrorMessage('Please enter a valid amount greater than ₹0.');
      return;
    }

    try {
      const newTx = saveTransaction({
        amount: cleanAmount,
        type: previewType,
        paymentMode: previewMode,
        categoryId: previewCategoryId,
        partyId: previewPartyId,
        note: previewNote.trim(),
        transactionDate: getCurrentTimestamp(),
      });

      triggerHaptic('success');
      setInputText('');
      setPreviewData(null);

      // Show Undo Banner
      setLastSavedTx({
        ...newTx,
        parsedDetails: {
          amount: cleanAmount,
          type: previewType,
          payment_mode: previewMode,
          category_name: categories.find((c) => c.id === previewCategoryId)?.name || 'General',
          person_or_merchant: parties.find((p) => p.id === previewPartyId)?.name || null,
          note: previewNote,
          ai_provider: aiStatus.provider,
          ai_model: aiStatus.model,
        },
        text: previewNote,
      });

      setUndoCountdown(5);
      if (undoTimerRef.current) clearInterval(undoTimerRef.current);
      undoTimerRef.current = setInterval(() => {
        setUndoCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(undoTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      triggerHaptic('error');
      setErrorMessage('Failed to save: ' + err.message);
    }
  };

  const handleCancelPreview = () => {
    triggerHaptic('light');
    setPreviewData(null);
  };

  const recentList = recentTransactions.slice(0, 4);

  return (
    <View style={styles.container}>
      <Header
        title="AI Transaction"
        subtitle="100% Pure AI Natural Language Entry"
        showSync={true}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* AI Engine Live Online & API Key Status Banner */}
          <View style={styles.statusBannersContainer}>
            <TouchableOpacity
              style={[
                styles.aiStatusPill,
                aiStatus.isOnline ? styles.aiStatusPillOnline : styles.aiStatusPillOffline,
              ]}
              onPress={() => setShowAiInfoModal(true)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.aiStatusDot,
                  { backgroundColor: aiStatus.isOnline ? '#10B981' : '#EF4444' },
                ]}
              />
              {isCheckingAi ? (
                <Text style={styles.aiStatusText}>Checking AI & Database Key...</Text>
              ) : aiStatus.isOnline ? (
                <Text style={styles.aiStatusTextOnline} numberOfLines={1}>
                  Server: <Text style={styles.aiStatusBold}>Online</Text>
                  {aiStatus.isDummyKey ? (
                    <Text style={{ color: '#D97706' }}> · DB Key: <Text style={styles.aiStatusBold}>Dummy Template</Text></Text>
                  ) : aiStatus.dbKeyFound ? (
                    <Text style={{ color: '#047857' }}> · DB Key: <Text style={styles.aiStatusBold}>Fetched ({aiStatus.maskedKey || 'MySQL'})</Text></Text>
                  ) : aiStatus.keyFetched ? (
                    <Text style={{ color: '#047857' }}> · Key: <Text style={styles.aiStatusBold}>Loaded ({aiStatus.maskedKey || 'Server'})</Text></Text>
                  ) : (
                    <Text style={{ color: '#D97706' }}> · DB Key: <Text style={styles.aiStatusBold}>Not in Database</Text></Text>
                  )}
                </Text>
              ) : (
                <Text style={styles.aiStatusTextOffline} numberOfLines={1}>
                  Server: <Text style={styles.aiStatusBold}>Offline ({aiStatus.statusCode === 404 ? '404' : 'Unreachable'})</Text>
                </Text>
              )}

              <TouchableOpacity
                style={styles.recheckBtn}
                onPress={checkStatus}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="refresh-outline"
                  size={14}
                  color={aiStatus.isOnline ? '#047857' : '#B91C1C'}
                />
              </TouchableOpacity>

              <Ionicons
                name="information-circle-outline"
                size={16}
                color={aiStatus.isOnline ? '#059669' : '#DC2626'}
              />
            </TouchableOpacity>

            {/* Quick DB Key Notice Card */}
            {aiStatus.isOnline && (
              <View style={[
                styles.dbKeyQuickCard,
                (aiStatus.dbKeyFound && !aiStatus.isDummyKey) ? styles.dbKeyQuickCardSuccess : styles.dbKeyQuickCardWarning
              ]}>
                <Ionicons
                  name={(aiStatus.dbKeyFound && !aiStatus.isDummyKey) ? 'server-outline' : 'alert-circle-outline'}
                  size={14}
                  color={(aiStatus.dbKeyFound && !aiStatus.isDummyKey) ? '#047857' : '#B45309'}
                />
                <Text style={[
                  styles.dbKeyQuickText,
                  { color: (aiStatus.dbKeyFound && !aiStatus.isDummyKey) ? '#047857' : '#B45309' }
                ]} numberOfLines={1}>
                  {aiStatus.isDummyKey
                    ? 'Table `ai_api_key` has dummy template key. Please update in phpMyAdmin.'
                    : aiStatus.dbKeyFound
                    ? `API Key Fetched from MySQL DB: ${aiStatus.maskedKey}`
                    : aiStatus.keyFetched
                    ? `API Key Loaded from Server (${aiStatus.keySource})`
                    : 'API Key NOT found in MySQL database (ai_api_key)'}
                </Text>
              </View>
            )}
          </View>

          {/* Main Natural Language Entry Card */}
          <View style={styles.aiCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.badgeContainer}>
                <Ionicons name="sparkles" size={14} color="#8B5CF6" />
                <Text style={styles.badgeText}>AI Engine</Text>
              </View>
              <Text style={styles.languagePill}>Hindi · Hinglish · English</Text>
            </View>

            {/* Model Selection Chips */}
            <View style={styles.modelSelectorContainer}>
              <View style={styles.modelSelectorLabelRow}>
                <Ionicons name="hardware-chip-outline" size={12} color="#6366F1" />
                <Text style={styles.modelSelectorLabel}>Model:</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modelChipsScroll}>
                {AI_MODELS.map((m) => {
                  const isSelected = selectedModel === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.modelChip, isSelected && styles.modelChipActive]}
                      onPress={() => handleSelectModel(m.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.modelChipText, isSelected && styles.modelChipTextActive]}>
                        {m.rank} {m.name}
                      </Text>
                      <Text style={[styles.modelChipPrice, isSelected && styles.modelChipPriceActive]}>
                        {m.inputCost.split(' ')[0]}/{m.outputCost.split(' ')[0]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Natural Language Input Box */}
            <View style={styles.inputWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.naturalInput}
                placeholder="₹20 cash Surendar ko khane ke liye diya..."
                placeholderTextColor={Colors.textMuted}
                value={inputText}
                onChangeText={(t) => {
                  setInputText(t);
                  if (errorMessage) setErrorMessage(null);
                }}
                multiline={true}
                numberOfLines={3}
                autoFocus={false} // Never auto-open keyboard on launch
                returnKeyType="done"
                editable={!isProcessing}
              />

              {inputText.length > 0 && !isProcessing && (
                <TouchableOpacity
                  style={styles.clearBtn}
                  onPress={handleClear}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Action Row */}
            <View style={styles.actionRow}>
              <View style={styles.inputTipRow}>
                <Ionicons name="bulb-outline" size={13} color={Colors.textMuted} />
                <Text style={styles.inputTipText}>Type in Hindi, Hinglish or English</Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!inputText.trim() || isProcessing) && styles.sendButtonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={!inputText.trim() || isProcessing}
                activeOpacity={0.8}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.sendButtonText}>Add with AI</Text>
                    <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Active App Categories in Use Section */}
          <View style={styles.appCategoriesSection}>
            <View style={styles.appCategoriesHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Ionicons name="pricetags-outline" size={14} color="#6366F1" />
                <Text style={styles.appCategoriesTitle}>
                  App Categories Sent to AI ({categories.length})
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsManageCategoriesOpen(true)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.manageCatLink}>+ Manage</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.appCatChipsScroll}>
              {categories.map((c) => (
                <View key={c.id} style={styles.appCatChip}>
                  <View style={[styles.appCatDot, { backgroundColor: c.color || '#6366F1' }]} />
                  <Text style={styles.appCatChipText}>{c.name}</Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Processing Loading Indicator */}
          {isProcessing && (
            <View style={styles.loadingBanner}>
              <ActivityIndicator size="small" color="#6366F1" style={{ marginRight: 8 }} />
              <Text style={styles.loadingText}>
                Parsing sentence with {aiStatus.provider} ({aiStatus.model})...
              </Text>
            </View>
          )}

          {/* Error Banner */}
          {errorMessage && !isProcessing && (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={18} color={Colors.danger} />
              <Text style={styles.errorBannerText}>{errorMessage}</Text>
            </View>
          )}

          {/* Instant Success & Undo Banner */}
          {undoCountdown > 0 && lastSavedTx && (
            <View style={styles.successUndoCard}>
              <View style={styles.successTopRow}>
                <View style={styles.successCheckIcon}>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>Transaction Added Successfully</Text>
                  <Text style={styles.successDetails} numberOfLines={1}>
                    {formatCurrency(lastSavedTx.amount)} ·{' '}
                    {lastSavedTx.type === 'gave' ? 'Expense' : 'Income'} ·{' '}
                    {lastSavedTx.paymentMode === 'online' ? 'Online' : 'Cash'}
                    {lastSavedTx.parsedDetails?.category_name ? ` · ${lastSavedTx.parsedDetails.category_name}` : ''}
                    {lastSavedTx.parsedDetails?.person_or_merchant ? ` · ${lastSavedTx.parsedDetails.person_or_merchant}` : ''}
                  </Text>
                  <Text style={styles.successEngineTag}>
                    ⚡ Powered by {lastSavedTx.parsedDetails?.ai_provider || aiStatus.provider} ({lastSavedTx.parsedDetails?.ai_model || aiStatus.model})
                  </Text>
                </View>

                <TouchableOpacity
                  style={styles.undoButton}
                  onPress={handleUndo}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-undo-outline" size={14} color="#DC2626" />
                  <Text style={styles.undoButtonText}>Undo ({undoCountdown}s)</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Confirmation / Missing Fields Card */}
          {previewData && !isProcessing && (
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Ionicons name="help-circle-outline" size={20} color="#6366F1" />
                <Text style={styles.previewQuestion}>
                  {previewData.question || 'AI requests confirmation'}
                </Text>
              </View>

              {/* Amount & Type Controls */}
              <View style={styles.previewFormRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Amount (₹) *</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textMuted}
                    value={previewAmount}
                    onChangeText={setPreviewAmount}
                    keyboardType="numeric"
                  />
                </View>

                <View style={{ width: 140 }}>
                  <Text style={styles.fieldLabel}>Type</Text>
                  <View style={styles.toggleGroup}>
                    <TouchableOpacity
                      style={[
                        styles.toggleBtn,
                        previewType === 'gave' && styles.toggleBtnGaveActive,
                      ]}
                      onPress={() => setPreviewType('gave')}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          previewType === 'gave' && styles.toggleBtnTextActive,
                        ]}
                      >
                        Gave
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleBtn,
                        previewType === 'got' && styles.toggleBtnGotActive,
                      ]}
                      onPress={() => setPreviewType('got')}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          previewType === 'got' && styles.toggleBtnTextActive,
                        ]}
                      >
                        Got
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Payment Mode */}
              <View style={styles.previewFormField}>
                <Text style={styles.fieldLabel}>Payment Mode</Text>
                <View style={styles.modeGroup}>
                  <TouchableOpacity
                    style={[
                      styles.modeBtn,
                      previewMode === 'cash' && styles.modeBtnActiveCash,
                    ]}
                    onPress={() => setPreviewMode('cash')}
                  >
                    <Ionicons
                      name="cash-outline"
                      size={15}
                      color={previewMode === 'cash' ? '#B45309' : Colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.modeBtnText,
                        previewMode === 'cash' && styles.modeBtnTextActiveCash,
                      ]}
                    >
                      Cash
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modeBtn,
                      previewMode === 'online' && styles.modeBtnActiveOnline,
                    ]}
                    onPress={() => setPreviewMode('online')}
                  >
                    <Ionicons
                      name="phone-portrait-outline"
                      size={15}
                      color={previewMode === 'online' ? '#1D4ED8' : Colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.modeBtnText,
                        previewMode === 'online' && styles.modeBtnTextActiveOnline,
                      ]}
                    >
                      Online / UPI
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Category Selector Chips (Using real App Categories) */}
              <View style={styles.previewFormField}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={styles.fieldLabel}>App Category</Text>
                  <TouchableOpacity onPress={() => setIsManageCategoriesOpen(true)}>
                    <Text style={{ fontSize: 11, color: '#6366F1', fontWeight: 'bold' }}>+ Add Custom</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catChipsScroll}>
                  {categories.map((cat) => {
                    const isSelected = previewCategoryId === cat.id;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.catChip,
                          isSelected && styles.catChipSelected,
                        ]}
                        onPress={() => setPreviewCategoryId(cat.id)}
                      >
                        <View style={[styles.appCatDot, { backgroundColor: isSelected ? '#FFFFFF' : (cat.color || '#6366F1') }]} />
                        <Text
                          style={[
                            styles.catChipText,
                            isSelected && styles.catChipTextSelected,
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Note / Description */}
              <View style={styles.previewFormField}>
                <Text style={styles.fieldLabel}>Note / Description</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="e.g. Khane k liye"
                  placeholderTextColor={Colors.textMuted}
                  value={previewNote}
                  onChangeText={setPreviewNote}
                />
              </View>

              {/* Preview Action Buttons */}
              <View style={styles.previewActions}>
                <TouchableOpacity
                  style={styles.previewCancelBtn}
                  onPress={handleCancelPreview}
                >
                  <Text style={styles.previewCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.previewSaveBtn}
                  onPress={handleSavePreview}
                >
                  <Text style={styles.previewSaveText}>Confirm & Save</Text>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Example Suggestions */}
          <View style={styles.suggestionsSection}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="bulb-outline" size={16} color={Colors.warning} />
              <Text style={styles.sectionTitle}>Try typing:</Text>
            </View>

            <View style={styles.chipsWrap}>
              {SAMPLE_PROMPTS.map((prompt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.sampleChip}
                  onPress={() => handleSelectSample(prompt)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="add-circle-outline" size={14} color="#6366F1" />
                  <Text style={styles.sampleChipText}>"{prompt}"</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Recent Transactions Section */}
          {recentList.length > 0 && (
            <View style={styles.recentSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.recentTitle}>Recent Transactions</Text>
                <TouchableOpacity
                  onPress={() => setActiveTab('Transactions')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.seeAllLink}>View All</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.recentListContainer}>
                {recentList.map((item) => {
                  const isGave = item.type === 'gave';
                  const amountColor = isGave ? Colors.gave : Colors.got;
                  const prefix = isGave ? '-' : '+';
                  const modeIcon = item.paymentMode === 'online' ? 'globe-outline' : 'cash-outline';

                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.recentItemRow}
                      onPress={() => openTransactionDetails(item.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.recentIconBox,
                          { backgroundColor: isGave ? '#FEE2E2' : '#D1FAE5' },
                        ]}
                      >
                        <Ionicons
                          name={isGave ? 'arrow-up' : 'arrow-down'}
                          size={16}
                          color={isGave ? Colors.gaveDark : Colors.gotDark}
                        />
                      </View>

                      <View style={styles.recentItemCenter}>
                        <Text style={styles.recentItemTitle} numberOfLines={1}>
                          {item.partyName || item.categoryName || item.note || 'Transaction'}
                        </Text>
                        <View style={styles.recentSubRow}>
                          <Ionicons name={modeIcon} size={12} color={Colors.textMuted} />
                          <Text style={styles.recentItemTime}>
                            {formatTimeAgo(item.createdAt || item.transactionDate)}
                          </Text>
                          {item.categoryName ? (
                            <Text style={styles.recentCategoryTag}>
                              · {item.categoryName}
                            </Text>
                          ) : null}
                        </View>
                      </View>

                      <View style={styles.recentItemRight}>
                        <Text style={[styles.recentItemAmount, { color: amountColor }]}>
                          {prefix} {formatCurrency(item.amount)}
                        </Text>
                        <Text style={styles.recentModeBadge}>
                          {item.paymentMode === 'online' ? 'Online' : 'Cash'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* AI Engine Info Modal */}
      <Modal
        visible={showAiInfoModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAiInfoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="sparkles" size={18} color="#6366F1" />
                <Text style={styles.modalTitle}>AI Engine Status</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAiInfoModal(false)}>
                <Ionicons name="close" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Domain Name:</Text>
              <Text style={[styles.infoValue, { color: '#4F46E5', fontWeight: 'bold' }]}>
                {aiStatus.domain || 'expense.tplpro.in'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Server Connection:</Text>
              <Text style={[styles.infoValue, { color: aiStatus.isOnline ? '#059669' : '#DC2626' }]}>
                {aiStatus.isOnline ? 'Online (HTTP 200)' : `Offline (HTTP ${aiStatus.statusCode || 'N/A'})`}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>MySQL DB Status:</Text>
              <Text style={[styles.infoValue, { color: aiStatus.dbConnected ? '#059669' : '#DC2626' }]}>
                {aiStatus.dbConnected ? 'Connected (gmsexpense_db)' : (aiStatus.dbError || 'Not Connected')}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>DB Key (ai_api_key):</Text>
              <Text style={[styles.infoValue, { color: aiStatus.dbKeyFound ? '#059669' : '#D97706' }]}>
                {aiStatus.dbKeyFound ? '✅ Fetched from MySQL' : '❌ Not in DB Table'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Overall Key Status:</Text>
              <Text style={[styles.infoValue, { color: aiStatus.keyFetched ? '#059669' : '#D97706' }]}>
                {aiStatus.keyFetched ? `✅ Active (${aiStatus.keySource})` : '❌ Missing on Server'}
              </Text>
            </View>
            {aiStatus.maskedKey ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Key Preview:</Text>
                <Text style={[styles.infoValue, { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: 11 }]}>{aiStatus.maskedKey}</Text>
              </View>
            ) : null}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>AI Provider:</Text>
              <Text style={styles.infoValue}>{aiStatus.provider}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Model:</Text>
              <Text style={styles.infoValue}>{aiStatus.model}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Server Endpoint:</Text>
              <Text style={[styles.infoValue, { fontSize: 11, color: Colors.textSecondary }]}>
                {aiStatus.endpoint || 'https://expense.tplpro.in/api/v1/ai_parse.php'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Server Hit Log:</Text>
              <Text style={[styles.infoValue, { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#4F46E5' }]}>
                api/v1/ai_parse.log
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Error Log File:</Text>
              <Text style={[styles.infoValue, { fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', color: '#B91C1C' }]}>
                api/v1/ai_parse_error.log
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>App Categories:</Text>
              <Text style={styles.infoValue}>{categories.length} from App DB</Text>
            </View>

            {/* AI Models & Pricing Switcher Section */}
            <View style={styles.modalModelSection}>
              <Text style={styles.modalModelSectionTitle}>Available Models & Pricing:</Text>
              {AI_MODELS.map((m) => {
                const isSelected = selectedModel === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.modalModelCard, isSelected && styles.modalModelCardActive]}
                    onPress={() => handleSelectModel(m.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.modalModelCardTop}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <Text style={{ fontSize: 14 }}>{m.rank}</Text>
                        <Text style={[styles.modalModelName, isSelected && styles.modalModelNameActive]} numberOfLines={1}>
                          {m.name}
                        </Text>
                      </View>
                      <View style={[styles.modalModelCostBadge, isSelected && styles.modalModelCostBadgeActive]}>
                        <Text style={[styles.modalModelCostText, isSelected && styles.modalModelCostTextActive]}>
                          {m.inputCost.split(' ')[0]} in · {m.outputCost.split(' ')[0]} out
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.modalModelBestUse} numberOfLines={2}>
                      🎯 {m.bestUse}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {!aiStatus.isOnline ? (
              <View style={{ marginTop: 12, padding: 10, backgroundColor: '#FEF2F2', borderRadius: 8, borderWidth: 1, borderColor: '#FEE2E2' }}>
                <Text style={{ fontSize: 11, color: '#991B1B', lineHeight: 16 }}>
                  ⚠️ <Text style={{ fontWeight: 'bold' }}>To activate AI:</Text> Upload the file <Text style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>backend/api/v1/ai_parse.php</Text> to your hosting server under <Text style={{ fontFamily: 'monospace' }}>api/v1/</Text>.
                </Text>
              </View>
            ) : !aiStatus.keyFetched ? (
              <View style={{ marginTop: 12, padding: 10, backgroundColor: '#FFFBEB', borderRadius: 8, borderWidth: 1, borderColor: '#FEF3C7' }}>
                <Text style={{ fontSize: 11, color: '#92400E', lineHeight: 16 }}>
                  ⚠️ <Text style={{ fontWeight: 'bold' }}>API Key Missing:</Text> Set <Text style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>AIROUTER_API_KEY=sk-air-v1-...</Text> in your server <Text style={{ fontFamily: 'monospace' }}>.env</Text> or <Text style={{ fontFamily: 'monospace' }}>ai_api_key</Text> MySQL table.
                </Text>
              </View>
            ) : null}

            {/* Live API Key Testing Section */}
            <View style={styles.testKeySection}>
              <TouchableOpacity
                style={[
                  styles.testKeyBtn,
                  isTestingKey && styles.testKeyBtnDisabled,
                  (!aiStatus.isOnline) && styles.testKeyBtnOffline,
                ]}
                onPress={handleTestApiKey}
                disabled={isTestingKey}
                activeOpacity={0.8}
              >
                {isTestingKey ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.testKeyBtnText}>Testing API Key with Airouter...</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="flash" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.testKeyBtnText}>Test AI API Key</Text>
                  </>
                )}
              </TouchableOpacity>

              {keyTestResult && (
                <View
                  style={[
                    styles.testResultCard,
                    keyTestResult.success ? styles.testResultCardSuccess : styles.testResultCardError,
                  ]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Ionicons
                      name={keyTestResult.success ? 'checkmark-circle' : 'alert-circle'}
                      size={16}
                      color={keyTestResult.success ? '#059669' : '#DC2626'}
                    />
                    <Text
                      style={[
                        styles.testResultTitle,
                        { color: keyTestResult.success ? '#065F46' : '#991B1B' },
                      ]}
                    >
                      {keyTestResult.success ? 'API Key Working Perfectly!' : 'API Key Test Failed'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.testResultBody,
                      { color: keyTestResult.success ? '#047857' : '#B91C1C' },
                    ]}
                  >
                    {keyTestResult.message}
                  </Text>
                  {keyTestResult.latencyMs > 0 ? (
                    <Text style={styles.testResultMeta}>
                      ⏱️ Latency: {keyTestResult.latencyMs}ms · {keyTestResult.provider} ({keyTestResult.model})
                    </Text>
                  ) : null}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowAiInfoModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl * 2,
  },
  aiStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: Spacing.sm,
    gap: 6,
    borderWidth: 1,
  },
  aiStatusPillOnline: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  aiStatusPillOffline: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
  },
  dbKeyQuickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  dbKeyQuickCardSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  dbKeyQuickCardWarning: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  dbKeyQuickCardDanger: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  dbKeyQuickText: {
    fontSize: 11,
    fontWeight: '500',
    flex: 1,
  },
  aiStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  aiStatusText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
  },
  aiStatusTextOnline: {
    fontSize: Typography.fontSizes.xs,
    color: '#065F46',
  },
  aiStatusTextOffline: {
    fontSize: Typography.fontSizes.xs,
    color: '#991B1B',
  },
  aiStatusBold: {
    fontWeight: Typography.fontWeights.bold,
  },
  recheckBtn: {
    padding: 2,
    marginLeft: 'auto',
    marginRight: 4,
  },
  aiCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#E0E7FF',
    ...Shadows.md,
    marginBottom: Spacing.md,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  badgeText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: '#6D28D9',
  },
  languagePill: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    fontWeight: Typography.fontWeights.medium,
  },
  inputWrapper: {
    position: 'relative',
    minHeight: 85,
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  naturalInput: {
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 22,
    textAlignVertical: 'top',
    paddingRight: 28,
    minHeight: 65,
  },
  clearBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  inputTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  inputTipText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4F46E5',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    gap: 6,
    ...Shadows.sm,
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
    opacity: 0.6,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
    fontSize: Typography.fontSizes.sm,
  },
  appCategoriesSection: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  appCategoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  appCategoriesTitle: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  manageCatLink: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: '#6366F1',
  },
  appCatChipsScroll: {
    flexDirection: 'row',
  },
  appCatChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    marginRight: 6,
  },
  appCatDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  appCatChipText: {
    fontSize: 11,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeights.medium,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  loadingText: {
    fontSize: Typography.fontSizes.sm,
    color: '#4338CA',
    fontWeight: Typography.fontWeights.medium,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FEE2E2',
    borderWidth: 1,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: Typography.fontSizes.sm,
    color: '#B91C1C',
  },
  successUndoCard: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  successTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  successCheckIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: '#065F46',
  },
  successDetails: {
    fontSize: Typography.fontSizes.xs,
    color: '#047857',
    marginTop: 2,
  },
  successEngineTag: {
    fontSize: 10,
    color: '#059669',
    fontWeight: Typography.fontWeights.semibold,
    marginTop: 3,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    gap: 3,
  },
  undoButtonText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: '#B91C1C',
  },
  previewCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingBottom: Spacing.xs,
  },
  previewQuestion: {
    flex: 1,
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: '#3730A3',
  },
  previewFormRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  previewFormField: {
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.medium,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  fieldInput: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    fontSize: Typography.fontSizes.sm,
    color: Colors.textPrimary,
  },
  toggleGroup: {
    flexDirection: 'row',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    height: 35,
  },
  toggleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  toggleBtnGaveActive: {
    backgroundColor: '#EF4444',
  },
  toggleBtnGotActive: {
    backgroundColor: '#10B981',
  },
  toggleBtnText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  toggleBtnTextActive: {
    color: '#FFFFFF',
  },
  modeGroup: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
  },
  modeBtnActiveCash: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  modeBtnActiveOnline: {
    backgroundColor: '#DBEAFE',
    borderColor: '#3B82F6',
  },
  modeBtnText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
  },
  modeBtnTextActiveCash: {
    color: '#92400E',
    fontWeight: Typography.fontWeights.bold,
  },
  modeBtnTextActiveOnline: {
    color: '#1E40AF',
    fontWeight: Typography.fontWeights.bold,
  },
  catChipsScroll: {
    flexDirection: 'row',
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
    marginRight: 6,
  },
  catChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  catChipText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
  },
  catChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  previewCancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#F1F5F9',
  },
  previewCancelText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.semibold,
  },
  previewSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    backgroundColor: '#10B981',
  },
  previewSaveText: {
    fontSize: Typography.fontSizes.xs,
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  suggestionsSection: {
    marginBottom: Spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sampleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sampleChipText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textPrimary,
  },
  recentSection: {
    marginTop: Spacing.xs,
  },
  recentTitle: {
    flex: 1,
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  seeAllLink: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: '#4F46E5',
  },
  recentListContainer: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    marginTop: Spacing.xs,
  },
  recentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  recentIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  recentItemCenter: {
    flex: 1,
  },
  recentItemTitle: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
  },
  recentSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  recentItemTime: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
  },
  recentCategoryTag: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
  },
  recentItemRight: {
    alignItems: 'flex-end',
  },
  recentItemAmount: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
  recentModeBadge: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 380,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  infoLabel: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
  },
  infoValue: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  // Model Selector Styles
  modelSelectorContainer: {
    marginBottom: Spacing.sm,
  },
  modelSelectorLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  modelSelectorLabel: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.semibold,
    color: '#6366F1',
  },
  modelChipsScroll: {
    flexDirection: 'row',
  },
  modelChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  modelChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  modelChipText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  modelChipTextActive: {
    color: '#4F46E5',
    fontWeight: Typography.fontWeights.bold,
  },
  modelChipPrice: {
    fontSize: 9,
    color: Colors.textMuted,
  },
  modelChipPriceActive: {
    color: '#6366F1',
    fontWeight: '600',
  },

  // Modal Model Switcher Styles
  modalModelSection: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  modalModelSectionTitle: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  modalModelCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.md,
    padding: 8,
    marginBottom: 6,
  },
  modalModelCardActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#6366F1',
  },
  modalModelCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  modalModelName: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  modalModelNameActive: {
    color: '#4F46E5',
  },
  modalModelCostBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  modalModelCostBadgeActive: {
    backgroundColor: '#E0E7FF',
  },
  modalModelCostText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  modalModelCostTextActive: {
    color: '#4338CA',
  },
  modalModelBestUse: {
    fontSize: 10,
    color: Colors.textMuted,
    lineHeight: 13,
  },

  testKeySection: {
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  testKeyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    ...Shadows.sm,
  },
  testKeyBtnDisabled: {
    opacity: 0.7,
  },
  testKeyBtnOffline: {
    backgroundColor: '#6B7280',
  },
  testKeyBtnText: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
    fontSize: Typography.fontSizes.sm,
  },
  testResultCard: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: 4,
  },
  testResultCardSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  testResultCardError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  testResultTitle: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  testResultBody: {
    fontSize: 11,
    lineHeight: 15,
  },
  testResultMeta: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginTop: 4,
    fontStyle: 'italic',
  },
  modalCloseBtn: {
    marginTop: Spacing.sm,
    backgroundColor: '#4F46E5',
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  modalCloseBtnText: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
    fontSize: Typography.fontSizes.sm,
  },
});
