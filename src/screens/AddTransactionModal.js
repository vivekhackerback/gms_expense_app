import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { pickImagesFromGallery, takePhotoWithCamera } from '../services/imageService';
import { formatFullDateTime, formatInputWithCommas, numberToWords } from '../utils/formatters';

export const AddTransactionModal = () => {
  const insets = useSafeAreaInsets();
  const {
    isAddTransactionOpen,
    addTransactionDefaults,
    editingTransaction,
    closeAddTransaction,
    saveTransaction,
    categories,
    parties,
    saveParty,
    openFullScreenImage,
  } = useApp();

  const [displayAmount, setDisplayAmount] = useState('');
  const [type, setType] = useState('gave'); // 'gave' | 'got'
  const [paymentMode, setPaymentMode] = useState('cash'); // 'cash' | 'online'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString());
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [selectedPartyId, setSelectedPartyId] = useState(null);
  const [note, setNote] = useState('');
  const [images, setImages] = useState([]); // [{ localUri, fileName }]
  
  // Inline Party Creator
  const [isAddingPartyInline, setIsAddingPartyInline] = useState(false);
  const [inlinePartyName, setInlinePartyName] = useState('');

  // Date Picker Modal state
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  const [tempMonth, setTempMonth] = useState(new Date().getMonth() + 1);
  const [tempDay, setTempDay] = useState(new Date().getDate());

  // Sync state with open defaults or editing item
  useEffect(() => {
    if (isAddTransactionOpen) {
      if (editingTransaction) {
        const raw = String(editingTransaction.amount || '');
        setDisplayAmount(formatInputWithCommas(raw));
        setType(editingTransaction.type || 'gave');
        setPaymentMode(editingTransaction.paymentMode || 'cash');
        setSelectedDate(editingTransaction.transactionDate || new Date().toISOString());
        setSelectedCategoryId(editingTransaction.categoryId || null);
        setSelectedPartyId(editingTransaction.partyId || null);
        setNote(editingTransaction.note || '');
        setImages(editingTransaction.images || []);
      } else {
        setDisplayAmount('');
        setType(addTransactionDefaults.type || 'gave');
        setPaymentMode(addTransactionDefaults.paymentMode || 'cash');
        setSelectedDate(new Date().toISOString());
        setSelectedCategoryId(categories[0]?.id || null);
        setSelectedPartyId(addTransactionDefaults.partyId || null);
        setNote('');
        setImages([]);
      }
      setIsAddingPartyInline(false);
      setInlinePartyName('');
      setIsDatePickerOpen(false);
    }
  }, [isAddTransactionOpen, editingTransaction, addTransactionDefaults, categories]);

  if (!isAddTransactionOpen) return null;

  const isGave = type === 'gave';
  const cardBg = isGave ? '#FEF2F2' : '#ECFDF5';
  const cardBorder = isGave ? '#FEE2E2' : '#D1FAE5';
  const primaryColor = isGave ? Colors.gave : Colors.got;
  const saveBtnBg = isGave ? Colors.gaveDark : Colors.gotDark;

  // Real-time amount in words
  const wordsRepresentation = numberToWords(displayAmount);

  const handleAmountChange = (text) => {
    const formatted = formatInputWithCommas(text);
    setDisplayAmount(formatted);
  };

  const handlePickGallery = async () => {
    const picked = await pickImagesFromGallery();
    if (picked && picked.length > 0) {
      setImages((prev) => [...prev, ...picked]);
    }
  };

  const handleCaptureCamera = async () => {
    const captured = await takePhotoWithCamera();
    if (captured) {
      setImages((prev) => [...prev, captured]);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleAddPartyInline = () => {
    if (!inlinePartyName.trim()) {
      setIsAddingPartyInline(false);
      return;
    }
    const newParty = saveParty({ name: inlinePartyName.trim() });
    setSelectedPartyId(newParty.id);
    setInlinePartyName('');
    setIsAddingPartyInline(false);
  };

  // Date selection helpers
  const setQuickDate = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    setSelectedDate(d.toISOString());
    setIsDatePickerOpen(false);
  };

  const openCustomDatePicker = () => {
    const current = new Date(selectedDate);
    setTempYear(current.getFullYear());
    setTempMonth(current.getMonth() + 1);
    setTempDay(current.getDate());
    setIsDatePickerOpen(true);
  };

  const applyCustomDate = () => {
    try {
      const d = new Date(tempYear, tempMonth - 1, tempDay, 12, 0, 0);
      setSelectedDate(d.toISOString());
      setIsDatePickerOpen(false);
    } catch (e) {
      Alert.alert('Invalid Date', 'Please enter a valid day, month, and year.');
    }
  };

  const { date: formattedDate } = formatFullDateTime(selectedDate);
  const isToday = new Date(selectedDate).toDateString() === new Date().toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = new Date(selectedDate).toDateString() === yesterday.toDateString();
  const dateLabel = isToday ? 'Today' : isYesterday ? 'Yesterday' : formattedDate;

  const handleSave = () => {
    const cleanNumStr = displayAmount.replace(/,/g, '');
    const numAmount = parseFloat(cleanNumStr);
    if (isNaN(numAmount) || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter an amount greater than ₹0.');
      return;
    }

    try {
      saveTransaction({
        amount: numAmount,
        type,
        paymentMode,
        categoryId: selectedCategoryId,
        partyId: selectedPartyId,
        note: note.trim(),
        transactionDate: selectedDate,
        images,
      });
      closeAddTransaction();
    } catch (err) {
      Alert.alert('Save Error', 'Failed to save transaction: ' + err.message);
    }
  };

  return (
    <Modal
      visible={isAddTransactionOpen}
      animationType="slide"
      onRequestClose={closeAddTransaction}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {/* Compact Top Header with Zero Waste Space */}
          <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
            <TouchableOpacity onPress={closeAddTransaction} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {editingTransaction ? 'Edit Transaction' : 'New Transaction'}
            </Text>
            <View style={{ width: 32 }} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* 1. Hero Amount Card with Dynamic Type Styling */}
            <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              {/* Type Switcher: [ You Gave ] [ You Got ] */}
              <View style={styles.typeSwitcherRow}>
                <TouchableOpacity
                  style={[
                    styles.typeTab,
                    isGave && styles.typeTabGaveActive,
                  ]}
                  onPress={() => setType('gave')}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="arrow-up-circle"
                    size={18}
                    color={isGave ? '#FFFFFF' : Colors.gave}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.typeTabText,
                      isGave && styles.typeTabTextActive,
                      { color: isGave ? '#FFFFFF' : Colors.gaveDark },
                    ]}
                  >
                    You Gave
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.typeTab,
                    !isGave && styles.typeTabGotActive,
                  ]}
                  onPress={() => setType('got')}
                  activeOpacity={0.85}
                >
                  <Ionicons
                    name="arrow-down-circle"
                    size={18}
                    color={!isGave ? '#FFFFFF' : Colors.got}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.typeTabText,
                      !isGave && styles.typeTabTextActive,
                      { color: !isGave ? '#FFFFFF' : Colors.gotDark },
                    ]}
                  >
                    You Got
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Comma-Formatted Amount Input with Dynamic Colors */}
              <View style={styles.amountBox}>
                <Text style={[styles.currencySymbol, { color: primaryColor }]}>₹</Text>
                <TextInput
                  style={[styles.amountInput, { color: primaryColor }]}
                  placeholder="0"
                  placeholderTextColor={isGave ? '#FCA5A5' : '#86EFAC'}
                  value={displayAmount}
                  onChangeText={handleAmountChange}
                  keyboardType="numeric"
                  autoFocus={!editingTransaction}
                  selectTextOnFocus
                />
              </View>

              {/* Amount In Words Display */}
              {wordsRepresentation ? (
                <View style={styles.wordsContainer}>
                  <Text style={[styles.wordsText, { color: primaryColor }]} numberOfLines={2}>
                    {wordsRepresentation}
                  </Text>
                </View>
              ) : null}

              {/* Bottom Meta Row: Payment Mode + Date Selector */}
              <View style={styles.metaRow}>
                {/* Cash vs Online Mode Toggle */}
                <View style={styles.modeGroup}>
                  <TouchableOpacity
                    style={[
                      styles.modePill,
                      paymentMode === 'cash' && styles.modePillCashActive,
                    ]}
                    onPress={() => setPaymentMode('cash')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="cash-outline"
                      size={15}
                      color={paymentMode === 'cash' ? '#FFFFFF' : '#B45309'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.modePillText,
                        paymentMode === 'cash' && styles.modePillTextActive,
                        { color: paymentMode === 'cash' ? '#FFFFFF' : '#B45309' },
                      ]}
                    >
                      Cash
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.modePill,
                      paymentMode === 'online' && styles.modePillOnlineActive,
                    ]}
                    onPress={() => setPaymentMode('online')}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name="card-outline"
                      size={15}
                      color={paymentMode === 'online' ? '#FFFFFF' : '#1D4ED8'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.modePillText,
                        paymentMode === 'online' && styles.modePillTextActive,
                        { color: paymentMode === 'online' ? '#FFFFFF' : '#1D4ED8' },
                      ]}
                    >
                      Online
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Date Selector Pill */}
                <TouchableOpacity
                  style={styles.datePickerPill}
                  onPress={openCustomDatePicker}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={15} color={Colors.primary} style={{ marginRight: 5 }} />
                  <Text style={styles.datePickerText}>{dateLabel}</Text>
                  <Ionicons name="chevron-down" size={13} color={Colors.textMuted} style={{ marginLeft: 2 }} />
                </TouchableOpacity>
              </View>
            </View>

            {/* 2. Category Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>CATEGORY</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipsScroll}
              >
                {categories.map((cat) => {
                  const isSelected = selectedCategoryId === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        isSelected && [styles.selectedCategoryChip, { borderColor: cat.color || Colors.primary }],
                      ]}
                      onPress={() => setSelectedCategoryId(cat.id)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.catIconWrap,
                          { backgroundColor: isSelected ? (cat.color || Colors.primary) : Colors.surfaceSubtle },
                        ]}
                      >
                        <Ionicons
                          name={cat.icon || 'grid-outline'}
                          size={15}
                          color={isSelected ? '#FFFFFF' : (cat.color || Colors.textSecondary)}
                        />
                      </View>
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && { fontWeight: Typography.fontWeights.bold, color: Colors.textPrimary },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* 3. Party Section (Optional) */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>PARTY / CONTACT (OPTIONAL)</Text>
                {!isAddingPartyInline && (
                  <TouchableOpacity
                    onPress={() => setIsAddingPartyInline(true)}
                    style={styles.inlineAddPartyBtn}
                  >
                    <Ionicons name="add" size={16} color={Colors.accent} />
                    <Text style={styles.inlineAddPartyText}>New Party</Text>
                  </TouchableOpacity>
                )}
              </View>

              {isAddingPartyInline ? (
                <View style={styles.inlinePartyForm}>
                  <TextInput
                    style={styles.inlinePartyInput}
                    placeholder="Enter party / contact name..."
                    placeholderTextColor={Colors.textMuted}
                    value={inlinePartyName}
                    onChangeText={setInlinePartyName}
                    autoFocus
                  />
                  <TouchableOpacity style={styles.inlinePartySaveBtn} onPress={handleAddPartyInline}>
                    <Text style={styles.inlinePartySaveText}>Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setIsAddingPartyInline(false);
                      setInlinePartyName('');
                    }}
                    style={{ padding: 6 }}
                  >
                    <Ionicons name="close" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsScroll}
                >
                  <TouchableOpacity
                    style={[
                      styles.partyChip,
                      selectedPartyId === null && styles.selectedPartyChip,
                    ]}
                    onPress={() => setSelectedPartyId(null)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.partyChipText,
                        selectedPartyId === null && styles.selectedPartyChipText,
                      ]}
                    >
                      None
                    </Text>
                  </TouchableOpacity>

                  {parties.map((p) => {
                    const isSelected = selectedPartyId === p.id;
                    return (
                      <TouchableOpacity
                        key={p.id}
                        style={[
                          styles.partyChip,
                          isSelected && styles.selectedPartyChip,
                        ]}
                        onPress={() => setSelectedPartyId(p.id)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.partyChipText,
                            isSelected && styles.selectedPartyChipText,
                          ]}
                        >
                          {p.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* 4. Note & Photos Section */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>NOTE & RECEIPTS</Text>
              
              <TextInput
                style={styles.noteInput}
                placeholder="Add a note or description (optional)..."
                placeholderTextColor={Colors.textMuted}
                value={note}
                onChangeText={setNote}
              />

              {/* Photo Action Row */}
              <View style={styles.photosActionRow}>
                <TouchableOpacity
                  style={styles.addPhotoAction}
                  onPress={handleCaptureCamera}
                  activeOpacity={0.7}
                >
                  <Ionicons name="camera-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.addPhotoActionText}>Camera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addPhotoAction}
                  onPress={handlePickGallery}
                  activeOpacity={0.7}
                >
                  <Ionicons name="images-outline" size={18} color={Colors.primary} style={{ marginRight: 6 }} />
                  <Text style={styles.addPhotoActionText}>Gallery</Text>
                </TouchableOpacity>

                {images.length > 0 && (
                  <View style={styles.photoCountBadge}>
                    <Ionicons name="image" size={14} color={Colors.primary} style={{ marginRight: 4 }} />
                    <Text style={styles.photoCountText}>{images.length} attached</Text>
                  </View>
                )}
              </View>

              {/* Thumbnail Gallery */}
              {images.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailScrollView}>
                  {images.map((img, index) => {
                    const uri = typeof img === 'string' ? img : (img.localUri || img.uri);
                    return (
                      <View key={index} style={styles.thumbWrapper}>
                        <TouchableOpacity onPress={() => openFullScreenImage(uri)} activeOpacity={0.85}>
                          <Image source={{ uri }} style={styles.thumbImage} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.removeThumbBadge}
                          onPress={() => handleRemoveImage(index)}
                        >
                          <Ionicons name="close" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            {/* 5. Dynamic Theme Save Transaction Button (Red for Gave, Green for Got) */}
            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: saveBtnBg }, Shadows.md]}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Text style={styles.saveButtonText}>Save Transaction</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {/* Date Selector Modal */}
        <Modal
          visible={isDatePickerOpen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsDatePickerOpen(false)}
        >
          <View style={styles.dateModalBackdrop}>
            <View style={[styles.dateModalCard, Shadows.lg]}>
              <Text style={styles.dateModalTitle}>Select Transaction Date</Text>

              {/* Quick Select Buttons */}
              <View style={styles.quickDateRow}>
                <TouchableOpacity
                  style={[styles.quickDateBtn, isToday && styles.quickDateBtnActive]}
                  onPress={() => setQuickDate(0)}
                >
                  <Text style={[styles.quickDateText, isToday && styles.quickDateTextActive]}>
                    Today
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.quickDateBtn, isYesterday && styles.quickDateBtnActive]}
                  onPress={() => setQuickDate(1)}
                >
                  <Text style={[styles.quickDateText, isYesterday && styles.quickDateTextActive]}>
                    Yesterday
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Custom Date Inputs */}
              <Text style={styles.customDateSub}>Custom Date (DD / MM / YYYY)</Text>
              <View style={styles.customDateInputsRow}>
                <View style={styles.dateInputBox}>
                  <Text style={styles.dateInputLabel}>Day</Text>
                  <TextInput
                    style={styles.dateField}
                    value={String(tempDay)}
                    onChangeText={(val) => setTempDay(parseInt(val) || 1)}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>

                <Text style={styles.dateSlash}>/</Text>

                <View style={styles.dateInputBox}>
                  <Text style={styles.dateInputLabel}>Month</Text>
                  <TextInput
                    style={styles.dateField}
                    value={String(tempMonth)}
                    onChangeText={(val) => setTempMonth(parseInt(val) || 1)}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>

                <Text style={styles.dateSlash}>/</Text>

                <View style={styles.dateInputBox}>
                  <Text style={styles.dateInputLabel}>Year</Text>
                  <TextInput
                    style={[styles.dateField, { width: 68 }]}
                    value={String(tempYear)}
                    onChangeText={(val) => setTempYear(parseInt(val) || 2026)}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>

              <View style={styles.dateModalActions}>
                <TouchableOpacity
                  style={styles.dateCancelBtn}
                  onPress={() => setIsDatePickerOpen(false)}
                >
                  <Text style={styles.dateCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dateApplyBtn}
                  onPress={applyCustomDate}
                >
                  <Text style={styles.dateApplyText}>Set Date</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxxl,
    gap: Spacing.md,
  },
  // Hero Card with Dynamic Type Styling
  heroCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1.5,
    ...Shadows.sm,
  },
  typeSwitcherRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xs,
  },
  typeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md - 3,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  typeTabGaveActive: {
    backgroundColor: Colors.gave,
    borderColor: Colors.gave,
  },
  typeTabGotActive: {
    backgroundColor: Colors.got,
    borderColor: Colors.got,
  },
  typeTabText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  typeTabTextActive: {
    color: '#FFFFFF',
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
    marginTop: 4,
  },
  currencySymbol: {
    fontSize: Typography.fontSizes.amountHero,
    fontWeight: Typography.fontWeights.bold,
    marginRight: Spacing.xs,
  },
  amountInput: {
    fontSize: Typography.fontSizes.amountHero,
    fontWeight: Typography.fontWeights.bold,
    minWidth: 140,
    textAlign: 'left',
    paddingVertical: 0,
  },
  wordsContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  wordsText: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
    textAlign: 'center',
    textTransform: 'capitalize',
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  modeGroup: {
    flexDirection: 'row',
    gap: Spacing.xs + 2,
  },
  modePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  modePillCashActive: {
    backgroundColor: Colors.cash,
    borderColor: Colors.cash,
  },
  modePillOnlineActive: {
    backgroundColor: Colors.online,
    borderColor: Colors.online,
  },
  modePillText: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
  },
  modePillTextActive: {
    color: '#FFFFFF',
  },
  datePickerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  datePickerText: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
  },
  // Form Sections
  section: {
    gap: Spacing.xs + 2,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginLeft: 2,
  },
  inlineAddPartyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.xs,
  },
  inlineAddPartyText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.accent,
    fontWeight: Typography.fontWeights.bold,
  },
  chipsScroll: {
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedCategoryChip: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1.5,
  },
  catIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  categoryChipText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
  },
  partyChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 1,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedPartyChip: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  partyChipText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
  },
  selectedPartyChipText: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  inlinePartyForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  inlinePartyInput: {
    flex: 1,
    fontSize: Typography.fontSizes.md,
    color: Colors.textPrimary,
    paddingVertical: Spacing.xs,
  },
  inlinePartySaveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  inlinePartySaveText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  noteInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md - 2,
    fontSize: Typography.fontSizes.md,
    color: Colors.textPrimary,
  },
  photosActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: 4,
  },
  addPhotoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
  },
  addPhotoActionText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.primary,
  },
  photoCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  photoCountText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  thumbnailScrollView: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  thumbWrapper: {
    position: 'relative',
    marginRight: Spacing.md,
  },
  thumbImage: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  removeThumbBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: Colors.danger,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    paddingVertical: Spacing.lg - 2,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    letterSpacing: 0.2,
  },
  // Date Modal Styling
  dateModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  dateModalCard: {
    backgroundColor: Colors.surface,
    width: '100%',
    maxWidth: 320,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  dateModalTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  quickDateBtn: {
    flex: 1,
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
  },
  quickDateBtnActive: {
    backgroundColor: Colors.primary,
  },
  quickDateText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  quickDateTextActive: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  customDateSub: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  customDateInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  dateInputBox: {
    alignItems: 'center',
  },
  dateInputLabel: {
    fontSize: Typography.fontSizes.xs - 1,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  dateField: {
    width: 58,
    height: 44,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  dateSlash: {
    fontSize: Typography.fontSizes.lg,
    color: Colors.textMuted,
    marginTop: 16,
  },
  dateModalActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dateCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
  },
  dateCancelText: {
    fontSize: Typography.fontSizes.md,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.semibold,
  },
  dateApplyBtn: {
    flex: 1,
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  dateApplyText: {
    fontSize: Typography.fontSizes.md,
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
});
