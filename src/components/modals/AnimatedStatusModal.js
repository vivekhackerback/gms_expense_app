import React, { useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  ScrollView,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';

/**
 * AnimatedStatusModal
 * 
 * Replaces plain alerts with a stunning animated modal that verifies
 * all required files and APIs before displaying the outcome:
 * - 'success': Animated green pop checkmark + celebration ripple + verification checklist.
 * - 'error': Animated red shake + warning shield + detailed failure diagnostics.
 * - 'verifying': Smooth rotating scanner + step-by-step API verification items.
 * - 'warning': Amber bounce + warning notice.
 */
export const AnimatedStatusModal = ({
  visible = false,
  type = 'success', // 'success', 'error', 'warning', 'verifying'
  title = '',
  message = '',
  verificationSteps = [], // [{ label: 'Server Reachability', status: 'done' | 'pending' | 'failed' }]
  onClose,
  primaryButtonText = 'Done',
  onPrimaryButtonPress,
  secondaryButtonText,
  onSecondaryButtonPress,
}) => {
  // Animation References
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;
  const iconRotateAnim = useRef(new Animated.Value(0)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;

  const isSuccess = type === 'success';
  const isError = type === 'error';
  const isVerifying = type === 'verifying';
  const isWarning = type === 'warning';

  useEffect(() => {
    if (visible) {
      // Trigger Haptic Feedback
      try {
        if (isSuccess) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (isError) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } else if (isWarning) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else if (isVerifying) {
          Haptics.selectionAsync();
        }
      } catch (e) {}

      // Reset values
      scaleAnim.setValue(0.7);
      opacityAnim.setValue(0);
      iconScaleAnim.setValue(0);
      iconRotateAnim.setValue(0);
      shakeAnim.setValue(0);
      rippleAnim.setValue(0);

      // 1. Entrance Spring Animation
      Animated.parallel([
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(iconScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 70,
          delay: 100,
          useNativeDriver: true,
        }),
      ]).start();

      // 2. Continuous or specialized type animations
      if (isSuccess) {
        // Success Ripple
        Animated.timing(rippleAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start();
      } else if (isError) {
        // Error Shake
        Animated.sequence([
          Animated.delay(150),
          Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
      } else if (isVerifying) {
        // Verifying Spin
        Animated.loop(
          Animated.timing(iconRotateAnim, {
            toValue: 1,
            duration: 1400,
            easing: Easing.linear,
            useNativeDriver: true,
          })
        ).start();
      }
    }
  }, [visible, type]);

  if (!visible) return null;

  // Icon Theme
  const themeColor = isSuccess
    ? '#059669'
    : isError
    ? '#DC2626'
    : isWarning
    ? '#D97706'
    : '#2563EB';

  const themeBg = isSuccess
    ? '#ECFDF5'
    : isError
    ? '#FEF2F2'
    : isWarning
    ? '#FFFBEB'
    : '#EFF6FF';

  const themeBorder = isSuccess
    ? '#A7F3D0'
    : isError
    ? '#FECACA'
    : isWarning
    ? '#FDE68A'
    : '#BFDBFE';

  const iconName = isSuccess
    ? 'checkmark-circle'
    : isError
    ? 'alert-circle'
    : isWarning
    ? 'warning'
    : 'sync';

  const spin = iconRotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1.8],
  });

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 0.4, 1],
    outputRange: [0.8, 0.4, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.modalBackdrop}>
        <Animated.View
          style={[
            styles.modalCard,
            Shadows.lg,
            {
              opacity: opacityAnim,
              transform: [
                { scale: scaleAnim },
                { translateX: shakeAnim },
              ],
            },
          ]}
        >
          {/* Header Icon with Ripple */}
          <View style={styles.iconContainer}>
            {isSuccess && (
              <Animated.View
                style={[
                  styles.rippleCircle,
                  {
                    backgroundColor: themeBorder,
                    transform: [{ scale: rippleScale }],
                    opacity: rippleOpacity,
                  },
                ]}
              />
            )}

            <Animated.View
              style={[
                styles.iconCircle,
                {
                  backgroundColor: themeBg,
                  borderColor: themeBorder,
                  transform: [
                    { scale: iconScaleAnim },
                    isVerifying ? { rotate: spin } : { rotate: '0deg' },
                  ],
                },
              ]}
            >
              <Ionicons name={iconName} size={42} color={themeColor} />
            </Animated.View>
          </View>

          {/* Title & Description */}
          <Text style={[styles.modalTitle, { color: isError ? '#991B1B' : Colors.textPrimary }]}>
            {title || (isSuccess ? 'Verification Complete' : isError ? 'Operation Failed' : 'Verifying APIs...')}
          </Text>

          {message ? (
            <Text style={styles.modalMessage}>{message}</Text>
          ) : null}

          {/* Verification Checklist Items */}
          {verificationSteps && verificationSteps.length > 0 && (
            <View style={styles.verificationList}>
              <Text style={styles.verificationListTitle}>SYSTEM &amp; API VERIFICATION</Text>
              <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                {verificationSteps.map((step, idx) => {
                  const stepDone = step.status === 'done' || step.status === 'success' || step.status === 'working';
                  const stepFailed = step.status === 'failed' || step.status === 'error';
                  const stepPending = step.status === 'pending' || step.status === 'checking';

                  const stepColor = stepDone ? '#059669' : stepFailed ? '#DC2626' : '#6B7280';
                  const stepBg = stepDone ? '#ECFDF5' : stepFailed ? '#FEF2F2' : '#F9FAFB';

                  return (
                    <View key={idx} style={[styles.stepItemRow, { backgroundColor: stepBg }]}>
                      <View style={styles.stepIconWrap}>
                        <Ionicons
                          name={stepDone ? 'checkmark-circle' : stepFailed ? 'close-circle' : 'time-outline'}
                          size={16}
                          color={stepColor}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.stepItemLabel, stepFailed && { color: '#DC2626', fontWeight: 'bold' }]}>
                          {step.label}
                        </Text>
                        {step.detail ? (
                          <Text style={styles.stepItemDetail} numberOfLines={1}>
                            {step.detail}
                          </Text>
                        ) : null}
                      </View>
                      <Text style={[styles.stepStatusText, { color: stepColor }]}>
                        {stepDone ? '✓ OK' : stepFailed ? '✕ Failed' : '● Checking'}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Action Buttons */}
          <View style={styles.buttonRow}>
            {secondaryButtonText && (
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onSecondaryButtonPress || onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>{secondaryButtonText}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[
                styles.primaryButton,
                { backgroundColor: themeColor },
                secondaryButtonText ? { flex: 1 } : { width: '100%' },
              ]}
              onPress={onPrimaryButtonPress || onClose}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryButtonText}>{primaryButtonText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl || 22,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    position: 'relative',
    width: 80,
    height: 80,
  },
  rippleCircle: {
    position: 'absolute',
    width: 74,
    height: 74,
    borderRadius: 37,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: Typography.fontSizes.lg + 1,
    fontWeight: Typography.fontWeights.bold,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  modalMessage: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.xs,
  },
  verificationList: {
    width: '100%',
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.lg,
  },
  verificationListTitle: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  stepItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.sm,
    marginBottom: 4,
  },
  stepIconWrap: {
    marginRight: 8,
  },
  stepItemLabel: {
    fontSize: 12,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeights.semibold,
  },
  stepItemDetail: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  stepStatusText: {
    fontSize: 10.5,
    fontWeight: Typography.fontWeights.bold,
    marginLeft: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: Spacing.sm,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  secondaryButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
  primaryButton: {
    borderRadius: BorderRadius.md,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.sm + 0.5,
    fontWeight: Typography.fontWeights.bold,
  },
});
