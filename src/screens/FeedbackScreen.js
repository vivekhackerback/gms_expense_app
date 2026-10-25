import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import {
  sendFeedbackViaWhatsApp,
  getDeviceInfoString,
  getAppVersionString,
  DISPLAY_WHATSAPP_PHONE,
} from '../services/feedbackService';

const FEEDBACK_CATEGORIES = [
  { id: 'Suggestion', label: 'Suggestion', icon: 'bulb-outline', color: '#D97706', bg: '#FEF3C7' },
  { id: 'Bug Report', label: 'Bug Report', icon: 'bug-outline', color: '#DC2626', bg: '#FEE2E2' },
  { id: 'Feature Request', label: 'Feature Request', icon: 'sparkles-outline', color: '#7C3AED', bg: '#EDE9FE' },
  { id: 'General', label: 'General Feedback', icon: 'chatbox-ellipses-outline', color: '#2563EB', bg: '#DBEAFE' },
];

const triggerHaptic = (type = 'selection') => {
  try {
    if (type === 'selection') {
      Haptics.selectionAsync();
    } else if (type === 'success') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else if (type === 'warning') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  } catch (e) {}
};

export const FeedbackScreen = ({ visible, onClose }) => {
  const insets = useSafeAreaInsets();
  const [feedbackText, setFeedbackText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Suggestion');
  const [isSending, setIsSending] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [showDeviceDetails, setShowDeviceDetails] = useState(false);

  const deviceInfo = getDeviceInfoString();
  const appVersion = getAppVersionString();

  // Animation values
  const modalScale = useRef(new Animated.Value(0.94)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setValidationError('');
      modalScale.setValue(0.94);
      modalOpacity.setValue(0);
      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(modalScale, {
          toValue: 1,
          friction: 8,
          tension: 65,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const handleClose = () => {
    triggerHaptic('selection');
    Animated.timing(modalOpacity, {
      toValue: 0,
      duration: 160,
      useNativeDriver: true,
    }).start(() => {
      if (onClose) onClose();
    });
  };

  const handleCategoryPress = (category) => {
    triggerHaptic('selection');
    setSelectedCategory(category);
  };

  const handleTextChange = (text) => {
    setFeedbackText(text);
    if (validationError && text.trim().length > 0) {
      setValidationError('');
    }
  };

  const handleSendWhatsApp = async () => {
    const trimmed = feedbackText.trim();
    if (!trimmed) {
      triggerHaptic('warning');
      setValidationError('Please write your feedback message before sending.');
      Alert.alert(
        'Feedback Required',
        'Please enter your thoughts, suggestion, or bug description so we can assist you.',
        [{ text: 'OK' }]
      );
      return;
    }

    triggerHaptic('selection');
    setIsSending(true);

    try {
      await sendFeedbackViaWhatsApp(trimmed, selectedCategory);
      triggerHaptic('success');
      setIsSending(false);
    } catch (err) {
      setIsSending(false);
      triggerHaptic('warning');
      Alert.alert(
        'WhatsApp Not Available',
        err.message || 'Unable to open WhatsApp on your device. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  if (!visible) return null;

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
                <Ionicons name="chatbubbles" size={22} color="#25D366" />
              </View>
              <View style={styles.headerTitles}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.title}>Send Feedback</Text>
                  <View style={styles.waBadge}>
                    <Ionicons name="logo-whatsapp" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                    <Text style={styles.waBadgeText}>WhatsApp</Text>
                  </View>
                </View>
                <Text style={styles.subtitle}>Direct chat with the developer</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
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
            {/* Value / Welcome Banner */}
            <View style={styles.welcomeBanner}>
              <View style={styles.bannerIconBox}>
                <Ionicons name="heart-circle" size={28} color="#059669" />
              </View>
              <View style={styles.bannerTextBox}>
                <Text style={styles.bannerHeadline}>We value your feedback!</Text>
                <Text style={styles.bannerSubtext}>
                  Share your suggestions or report any issues to help us improve the app.
                  Your message will open directly in WhatsApp for personal support.
                </Text>
              </View>
            </View>

            {/* Category Selector Chips */}
            <View style={styles.sectionWrap}>
              <Text style={styles.sectionLabel}>FEEDBACK CATEGORY</Text>
              <View style={styles.categoryRow}>
                {FEEDBACK_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        isSelected && { borderColor: cat.color, backgroundColor: cat.bg },
                      ]}
                      onPress={() => handleCategoryPress(cat.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name={cat.icon}
                        size={15}
                        color={isSelected ? cat.color : Colors.textMuted}
                        style={{ marginRight: 5 }}
                      />
                      <Text
                        style={[
                          styles.categoryChipText,
                          isSelected && { color: cat.color, fontWeight: Typography.fontWeights.bold },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Feedback Text Input Box */}
            <View style={styles.sectionWrap}>
              <View style={styles.inputHeaderRow}>
                <Text style={styles.sectionLabel}>YOUR MESSAGE</Text>
                <Text style={styles.charCountText}>
                  {feedbackText.length} characters
                </Text>
              </View>

              <View
                style={[
                  styles.inputContainer,
                  isFocused && styles.inputContainerFocused,
                  validationError ? styles.inputContainerError : null,
                ]}
              >
                <TextInput
                  style={styles.textInput}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                  placeholder="Write your feedback, suggestions, bug reports, or feature requests here..."
                  placeholderTextColor="#94A3B8"
                  value={feedbackText}
                  onChangeText={handleTextChange}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  maxLength={2000}
                />

                {feedbackText.length > 0 && (
                  <TouchableOpacity
                    style={styles.clearBtn}
                    onPress={() => {
                      triggerHaptic('selection');
                      setFeedbackText('');
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </TouchableOpacity>
                )}
              </View>

              {validationError ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle" size={15} color="#DC2626" style={{ marginRight: 4 }} />
                  <Text style={styles.errorText}>{validationError}</Text>
                </View>
              ) : null}
            </View>

            {/* Technical Metadata Auto-Attach Card */}
            <View style={styles.metaCard}>
              <TouchableOpacity
                style={styles.metaCardHeader}
                onPress={() => {
                  triggerHaptic('selection');
                  setShowDeviceDetails(!showDeviceDetails);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.metaHeaderLeft}>
                  <Ionicons name="information-circle-outline" size={18} color={Colors.primaryDark} />
                  <Text style={styles.metaHeaderTitle}>Auto-included diagnostic info</Text>
                </View>
                <Ionicons
                  name={showDeviceDetails ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={Colors.textMuted}
                />
              </TouchableOpacity>

              {showDeviceDetails && (
                <View style={styles.metaDetailsBox}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>App Version:</Text>
                    <Text style={styles.metaValue}>v{appVersion}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Device:</Text>
                    <Text style={styles.metaValue}>{deviceInfo}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>WhatsApp Target:</Text>
                    <Text style={styles.metaValue}>{DISPLAY_WHATSAPP_PHONE}</Text>
                  </View>
                  <Text style={styles.metaDisclaimer}>
                    These system details help diagnose device-specific issues and are pre-filled
                    in your WhatsApp message for convenience.
                  </Text>
                </View>
              )}
            </View>

            {/* Send on WhatsApp Button */}
            <TouchableOpacity
              style={[styles.sendWhatsAppBtn, isSending && { opacity: 0.75 }]}
              onPress={handleSendWhatsApp}
              disabled={isSending}
              activeOpacity={0.85}
            >
              <View style={styles.waBtnIconWrap}>
                <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
              </View>
              <View style={styles.waBtnTextWrap}>
                <Text style={styles.sendWhatsAppBtnText}>Send Feedback on WhatsApp</Text>
                <Text style={styles.sendWhatsAppBtnSub}>
                  Opens WhatsApp with pre-filled message
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 6 }} />
            </TouchableOpacity>

            {/* Friendly Security & Privacy Note */}
            <View style={styles.privacyNote}>
              <Ionicons name="shield-checkmark-outline" size={15} color="#059669" style={{ marginTop: 1 }} />
              <Text style={styles.privacyNoteText}>
                The message will not be sent automatically. You will be able to review and edit
                everything in WhatsApp before pressing send.
              </Text>
            </View>
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
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: '92%',
    ...Shadows.lg,
  },
  handleBar: {
    width: 44,
    height: 5,
    backgroundColor: '#CBD5E1',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    marginTop: 1,
  },
  waBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  waBadgeText: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollBody: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  welcomeBanner: {
    flexDirection: 'row',
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  bannerIconBox: {
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  bannerTextBox: {
    flex: 1,
  },
  bannerHeadline: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: '#065F46',
    marginBottom: 4,
  },
  bannerSubtext: {
    fontSize: Typography.fontSizes.xs,
    color: '#047857',
    lineHeight: 18,
  },
  sectionWrap: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: Spacing.xs,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
  },
  categoryChipText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
  },
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  charCountText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  inputContainer: {
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    minHeight: 125,
    position: 'relative',
  },
  inputContainerFocused: {
    borderColor: '#25D366',
    backgroundColor: '#FFFFFF',
    ...Shadows.sm,
  },
  inputContainerError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  textInput: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textPrimary,
    lineHeight: 21,
    minHeight: 105,
    paddingTop: 2,
  },
  clearBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: '#DC2626',
    fontWeight: Typography.fontWeights.medium,
  },
  metaCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.lg,
  },
  metaCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaHeaderTitle: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  metaDetailsBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  metaValue: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.medium,
    color: Colors.textPrimary,
  },
  metaDisclaimer: {
    fontSize: 10,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: 6,
    lineHeight: 14,
  },
  sendWhatsAppBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: Spacing.md,
    ...Shadows.md,
  },
  waBtnIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
  },
  waBtnTextWrap: {
    flex: 1,
  },
  sendWhatsAppBtnText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  sendWhatsAppBtnSub: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 1,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: Spacing.md,
    paddingHorizontal: 4,
    gap: 6,
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 11,
    color: Colors.textMuted,
    lineHeight: 16,
  },
});
