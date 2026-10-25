import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  AppState,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import {
  SUPPORT_UPI_CONFIG,
  launchUpiPayment,
  syncAndGetLatestUpiConfig,
  isValidUpiId,
} from '../../services/upiPaymentService';
import { getLocalUpiRecord } from '../../database/queries';

const triggerHaptic = (type = 'selection') => {
  try {
    if (type === 'selection') {
      Haptics.selectionAsync();
    } else if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'warning') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  } catch (e) {
    // Graceful fallback on devices without haptics
  }
};

export const SupportAppModal = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();

  // Mode: 'FORM' | 'CONFIRMATION' | 'THANK_YOU' | 'CANCELLED'
  const [modalStep, setModalStep] = useState('FORM');
  const [selectedAmount, setSelectedAmount] = useState(SUPPORT_UPI_CONFIG.defaultAmount);
  const [isCustomAmount, setIsCustomAmount] = useState(false);
  const [customAmountText, setCustomAmountText] = useState('');
  const [isLaunching, setIsLaunching] = useState(false);

  // Dynamic UPI Info & updated_at state
  const [currentUpiId, setCurrentUpiId] = useState(() => getLocalUpiRecord().upiId);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState(() => getLocalUpiRecord().updatedAt);
  const [isConfigLoading, setIsConfigLoading] = useState(false);

  // AppState tracking for returning from UPI app
  const awaitingUpiReturnRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);

  // Animations
  const modalScale = useRef(new Animated.Value(0.9)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const modalHeartScale = useRef(new Animated.Value(1)).current;

  // Pulse animation for modal heart
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(modalHeartScale, {
          toValue: 1.2,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(modalHeartScale, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [modalHeartScale]);

  // Reset state and check for updated_at changes whenever modal is opened
  useEffect(() => {
    if (visible) {
      setModalStep('FORM');
      setSelectedAmount(SUPPORT_UPI_CONFIG.defaultAmount);
      setIsCustomAmount(false);
      setCustomAmountText('');
      setIsLaunching(false);
      awaitingUpiReturnRef.current = false;

      // 1. Read last successfully cached UPI record from local storage
      const local = getLocalUpiRecord();
      if (local.upiId) {
        setCurrentUpiId(local.upiId);
        setCurrentUpdatedAt(local.updatedAt);
      }

      // 2. Perform lightweight server-side version check
      setIsConfigLoading(true);
      syncAndGetLatestUpiConfig().then((res) => {
        setIsConfigLoading(false);
        if (res && res.success && res.upiId) {
          setCurrentUpiId(res.upiId);
          setCurrentUpdatedAt(res.updatedAt);
        }
      });

      modalScale.setValue(0.92);
      modalOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(modalScale, {
          toValue: 1,
          friction: 8,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Listen to AppState transitions (detecting when user returns from UPI app)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextAppState;

      if (
        (previousState === 'background' || previousState === 'inactive') &&
        nextAppState === 'active' &&
        awaitingUpiReturnRef.current
      ) {
        // User just returned from the external UPI app
        awaitingUpiReturnRef.current = false;
        setIsLaunching(false);
        // Prompt user with neutral confirmation dialog
        setModalStep('CONFIRMATION');
        triggerHaptic('selection');
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const getEffectiveAmount = () => {
    if (isCustomAmount) {
      const parsed = parseFloat(customAmountText);
      return isNaN(parsed) ? 0 : parsed;
    }
    return selectedAmount;
  };

  const handleSelectPreset = (amount) => {
    triggerHaptic('selection');
    setIsCustomAmount(false);
    setSelectedAmount(amount);
  };

  const handleSelectCustom = () => {
    triggerHaptic('selection');
    setIsCustomAmount(true);
    if (!customAmountText) {
      setCustomAmountText(String(selectedAmount));
    }
  };

  const handleCustomTextChange = (text) => {
    // Only allow whole digits
    const cleaned = text.replace(/[^0-9]/g, '');
    setCustomAmountText(cleaned);
  };

  const handlePayViaUpi = async () => {
    const amount = getEffectiveAmount();

    if (amount <= 0) {
      triggerHaptic('warning');
      Alert.alert(
        'Invalid Amount',
        'Please enter a valid donation amount in INR (minimum ₹1).',
        [{ text: 'OK' }]
      );
      return;
    }

    if (amount > 100000) {
      triggerHaptic('warning');
      Alert.alert(
        'Amount Exceeds Limit',
        'Single UPI donation cannot exceed ₹1,00,000. Please enter a lower amount.',
        [{ text: 'OK' }]
      );
      return;
    }

    triggerHaptic('selection');
    setIsLaunching(true);

    // Every Support App click: check latest server updated_at value
    const configRes = await syncAndGetLatestUpiConfig();

    if (!configRes.success || !configRes.upiId || !isValidUpiId(configRes.upiId)) {
      setIsLaunching(false);
      triggerHaptic('warning');
      Alert.alert(
        'Payment Details Unavailable',
        configRes.message ||
          'Unable to retrieve payment information from server. Please check your internet connection.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Update state with fresh verified upi_id
    setCurrentUpiId(configRes.upiId);
    setCurrentUpdatedAt(configRes.updatedAt);

    // Set flag before launching intent
    awaitingUpiReturnRef.current = true;

    const result = await launchUpiPayment({
      amount,
      note: SUPPORT_UPI_CONFIG.defaultNote,
      upiId: configRes.upiId,
    });

    if (!result.success) {
      awaitingUpiReturnRef.current = false;
      setIsLaunching(false);
      triggerHaptic('warning');
      Alert.alert(
        'No Compatible UPI App Found',
        'We could not find any installed UPI payment application (such as Google Pay, PhonePe, Paytm, or BHIM) on this device.\n\nRecipient UPI ID: ' +
          configRes.upiId,
        [{ text: 'OK' }]
      );
    }
  };

  const handlePaymentSuccessConfirm = () => {
    triggerHaptic('success');
    setModalStep('THANK_YOU');
  };

  const handlePaymentNotCompleted = () => {
    triggerHaptic('selection');
    setModalStep('CANCELLED');
  };

  const handleClose = () => {
    triggerHaptic('selection');
    Animated.timing(modalOpacity, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  const currentAmount = getEffectiveAmount();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backdropPressArea}
          activeOpacity={1}
          onPress={handleClose}
        />

        <Animated.View
          style={[
            styles.modalCard,
            {
              opacity: modalOpacity,
              transform: [{ scale: modalScale }],
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          {/* Top Pill Handle */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconCircle}>
                <Animated.View style={{ transform: [{ scale: modalHeartScale }] }}>
                  <Ionicons name="heart" size={24} color="#E11D48" />
                </Animated.View>
              </View>
              <View style={styles.headerTitles}>
                <Text style={styles.title}>Support the App</Text>
                <Text style={styles.subtitle}>Help sustain & develop Expense & Khata</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollBody}
            keyboardShouldPersistTaps="handled"
          >
            {/* STEP 1: CONTRIBUTION FORM */}
            {modalStep === 'FORM' && (
              <>
                {/* Heartfelt Thank You Message Banner */}
                <View style={styles.thankYouBanner}>
                  <Ionicons name="sparkles" size={20} color="#D97706" style={{ marginTop: 2 }} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.bannerHeadline}>
                      Your support helps us improve and maintain this app. Thank you!
                    </Text>
                    <Text style={styles.bannerSubtext}>
                      Expense & Khata is 100% free, offline-first, and private. Your voluntary
                      contribution directly fuels regular updates, new features, and cloud backups.
                    </Text>
                  </View>
                </View>

                {/* Recipient UPI Details Card */}
                <View style={styles.recipientCard}>
                  <View style={styles.recipientRow}>
                    <View style={styles.recipientAvatar}>
                      <Ionicons name="shield-checkmark" size={18} color="#059669" />
                    </View>
                    <View style={styles.recipientInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.recipientName}>{SUPPORT_UPI_CONFIG.payeeName}</Text>
                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedBadgeText}>Verified</Text>
                        </View>
                      </View>
                      <Text style={styles.recipientUpiText}>
                        UPI ID:{' '}
                        {currentUpiId ? (
                          <Text style={styles.upiIdBold}>{currentUpiId}</Text>
                        ) : isConfigLoading ? (
                          <Text style={styles.upiIdLoading}>Checking server configuration...</Text>
                        ) : (
                          <Text style={styles.upiIdBold}>Connect to internet to load</Text>
                        )}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Suggested Amounts */}
                <View style={styles.amountSection}>
                  <Text style={styles.sectionLabel}>CHOOSE CONTRIBUTION AMOUNT</Text>
                  <View style={styles.amountChipsRow}>
                    {SUPPORT_UPI_CONFIG.suggestedAmounts.map((amt) => {
                      const isSelected = !isCustomAmount && selectedAmount === amt;
                      return (
                        <TouchableOpacity
                          key={amt}
                          style={[
                            styles.amountChip,
                            isSelected && styles.amountChipSelected,
                          ]}
                          onPress={() => handleSelectPreset(amt)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.amountChipText,
                              isSelected && styles.amountChipTextSelected,
                            ]}
                          >
                            ₹{amt}
                          </Text>
                          {isSelected && (
                            <View style={styles.chipCheckmark}>
                              <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}

                    {/* Custom Amount Button */}
                    <TouchableOpacity
                      style={[
                        styles.amountChip,
                        isCustomAmount && styles.amountChipSelected,
                      ]}
                      onPress={handleSelectCustom}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.amountChipText,
                          isCustomAmount && styles.amountChipTextSelected,
                        ]}
                      >
                        Custom
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Custom Amount Input Field */}
                  {isCustomAmount && (
                    <View style={styles.customInputContainer}>
                      <Text style={styles.currencySymbol}>₹</Text>
                      <TextInput
                        style={styles.customTextInput}
                        value={customAmountText}
                        onChangeText={handleCustomTextChange}
                        placeholder="Enter amount"
                        placeholderTextColor={Colors.textMuted}
                        keyboardType="numeric"
                        maxLength={6}
                        autoFocus
                      />
                      {customAmountText.length > 0 && (
                        <TouchableOpacity
                          onPress={() => setCustomAmountText('')}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>

                {/* Supported Apps Logos / Subtext */}
                <View style={styles.supportedAppsRow}>
                  <Ionicons name="apps-outline" size={16} color={Colors.textSecondary} />
                  <Text style={styles.supportedAppsText}>
                    Supports Google Pay, PhonePe, Paytm, BHIM & all UPI apps
                  </Text>
                </View>

                {/* Primary Action Button */}
                <TouchableOpacity
                  style={[styles.payButton, isLaunching && { opacity: 0.7 }]}
                  onPress={handlePayViaUpi}
                  disabled={isLaunching}
                  activeOpacity={0.85}
                >
                  <Ionicons name="heart" size={20} color="#FF6B81" style={{ marginRight: 8 }} />
                  <Text style={styles.payButtonText}>
                    {currentAmount > 0
                      ? `Contribute ₹${currentAmount.toLocaleString('en-IN')} via UPI`
                      : 'Enter Valid Amount'}
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
                </TouchableOpacity>

                {/* Voluntary Note */}
                <Text style={styles.voluntaryNote}>
                  * 100% voluntary contribution. No app features or reports are locked.
                </Text>
              </>
            )}

            {/* STEP 2: NEUTRAL CONFIRMATION (After returning from UPI app) */}
            {modalStep === 'CONFIRMATION' && (
              <View style={styles.feedbackContainer}>
                <View style={styles.feedbackIconWrap}>
                  <Ionicons name="help-circle-outline" size={48} color={Colors.online} />
                </View>
                <Text style={styles.feedbackTitle}>Did your payment go through?</Text>
                <Text style={styles.feedbackSubtitle}>
                  We opened your UPI app for a contribution of ₹{currentAmount.toLocaleString('en-IN')}.
                  Please confirm whether the payment was completed successfully.
                </Text>

                <View style={styles.confirmationBtnGroup}>
                  <TouchableOpacity
                    style={styles.confirmSuccessBtn}
                    onPress={handlePaymentSuccessConfirm}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.confirmSuccessBtnText}>Yes, Payment Successful</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.confirmNotSuccessBtn}
                    onPress={handlePaymentNotCompleted}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle-outline" size={18} color={Colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={styles.confirmNotSuccessBtnText}>No / Payment Cancelled</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* STEP 3: HEARTFELT THANK YOU */}
            {modalStep === 'THANK_YOU' && (
              <View style={styles.feedbackContainer}>
                <View style={[styles.feedbackIconWrap, { backgroundColor: '#ECFDF5' }]}>
                  <Ionicons name="heart" size={54} color="#059669" />
                </View>
                <Text style={[styles.feedbackTitle, { color: '#065F46' }]}>Thank You So Much! ❤️</Text>
                <Text style={styles.feedbackSubtitle}>
                  Your generous contribution of ₹{currentAmount.toLocaleString('en-IN')} directly supports
                  ongoing development, performance tuning, and new features for Expense & Khata.
                </Text>

                <View style={styles.badgeContainer}>
                  <Ionicons name="sparkles" size={16} color="#D97706" style={{ marginRight: 6 }} />
                  <Text style={styles.badgeText}>Verified Supporter of Independent Development</Text>
                </View>

                <TouchableOpacity
                  style={styles.doneBtn}
                  onPress={handleClose}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doneBtnText}>You're Welcome!</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 4: CANCELLED / NEUTRAL CLOSE */}
            {modalStep === 'CANCELLED' && (
              <View style={styles.feedbackContainer}>
                <View style={[styles.feedbackIconWrap, { backgroundColor: '#F1F5F9' }]}>
                  <Ionicons name="happy-outline" size={48} color={Colors.textSecondary} />
                </View>
                <Text style={styles.feedbackTitle}>No Problem At All!</Text>
                <Text style={styles.feedbackSubtitle}>
                  Thank you for using Expense & Khata. You will always have free, unrestricted access
                  to all features, reports, and cloud backups anytime.
                </Text>

                <View style={styles.retryRow}>
                  <TouchableOpacity
                    style={styles.retryBtn}
                    onPress={() => setModalStep('FORM')}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh-outline" size={16} color={Colors.primary} style={{ marginRight: 6 }} />
                    <Text style={styles.retryBtnText}>Try Again</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.doneBtnSecondary}
                    onPress={handleClose}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.doneBtnSecondaryText}>Close</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  backdropPressArea: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    maxHeight: '90%',
    ...Shadows.floating,
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CBD5E1',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  headerIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  thankYouBanner: {
    flexDirection: 'row',
    backgroundColor: '#FFFBEB',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  bannerHeadline: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: '#92400E',
    lineHeight: 18,
  },
  bannerSubtext: {
    fontSize: Typography.fontSizes.xs,
    color: '#B45309',
    marginTop: 4,
    lineHeight: 16,
  },
  recipientCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  recipientAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  verifiedBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
  },
  verifiedBadgeText: {
    fontSize: 9,
    fontWeight: Typography.fontWeights.bold,
    color: '#15803D',
  },
  recipientUpiText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  upiIdBold: {
    fontWeight: Typography.fontWeights.bold,
    color: Colors.primary,
  },
  upiIdLoading: {
    fontStyle: 'italic',
    color: Colors.textMuted,
  },
  amountSection: {
    gap: Spacing.xs + 2,
  },
  sectionLabel: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
  },
  amountChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  amountChip: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  amountChipSelected: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  amountChipText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  amountChipTextSelected: {
    color: '#4F46E5',
  },
  chipCheckmark: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#4F46E5',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#4F46E5',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    marginTop: 6,
  },
  currencySymbol: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: '#4F46E5',
    marginRight: 6,
  },
  customTextInput: {
    flex: 1,
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    padding: 0,
  },
  supportedAppsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 2,
  },
  supportedAppsText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4F46E5',
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    marginTop: 4,
    ...Shadows.md,
  },
  payButtonText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  voluntaryNote: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
    lineHeight: 15,
  },
  feedbackContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
  },
  feedbackIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  feedbackTitle: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  feedbackSubtitle: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  confirmationBtnGroup: {
    width: '100%',
    gap: 10,
  },
  confirmSuccessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  confirmSuccessBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.sm + 1,
    fontWeight: Typography.fontWeights.bold,
  },
  confirmNotSuccessBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
  },
  confirmNotSuccessBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  badgeText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: '#92400E',
  },
  doneBtn: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  retryRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
  },
  retryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
  },
  retryBtnText: {
    color: Colors.primary,
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
  doneBtnSecondary: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
  },
  doneBtnSecondaryText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
});
