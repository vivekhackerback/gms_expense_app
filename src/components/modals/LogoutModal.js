import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../context/AppContext';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';

export const LogoutModal = () => {
  const insets = useSafeAreaInsets();
  const {
    isLogoutModalOpen,
    closeLogoutModal,
    logoutUser,
    currentUser,
  } = useApp();

  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedOutSuccess, setIsLoggedOutSuccess] = useState(false);

  // Animations
  const modalScale = useRef(new Animated.Value(0.85)).current;
  const modalOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.4)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isLogoutModalOpen) {
      setIsLoggedOutSuccess(false);
      setIsLoading(false);
      modalScale.setValue(0.85);
      modalOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(modalOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(modalScale, {
          toValue: 1,
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isLogoutModalOpen]);

  if (!isLogoutModalOpen) return null;

  const handleConfirmLogout = async () => {
    setIsLoading(true);
    try {
      await logoutUser();
      setIsLoading(false);
      setIsLoggedOutSuccess(true);

      // Start 800ms Success Animation
      successScale.setValue(0.4);
      successOpacity.setValue(0);

      Animated.parallel([
        Animated.timing(successOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(successScale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
      ]).start();

      // Show for 800ms then smoothly dismiss
      setTimeout(() => {
        Animated.timing(modalOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start(() => {
          setIsLoggedOutSuccess(false);
          closeLogoutModal();
        });
      }, 800);
    } catch (e) {
      setIsLoading(false);
      closeLogoutModal();
    }
  };

  const handleCancel = () => {
    if (isLoading || isLoggedOutSuccess) return;
    Animated.timing(modalOpacity, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      closeLogoutModal();
    });
  };

  return (
    <Modal
      visible={isLogoutModalOpen}
      transparent={true}
      animationType="none"
      onRequestClose={handleCancel}
    >
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.modalCard,
            {
              opacity: modalOpacity,
              transform: [{ scale: modalScale }],
              paddingBottom: Math.max(insets.bottom, 24),
            },
          ]}
        >
          {isLoggedOutSuccess ? (
            /* 800ms Logout Success Animated View */
            <Animated.View
              style={[
                styles.successContainer,
                {
                  opacity: successOpacity,
                  transform: [{ scale: successScale }],
                },
              ]}
            >
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark-done-circle" size={68} color="#059669" />
              </View>
              <Text style={styles.successTitle}>Logged Out Successfully</Text>
              <Text style={styles.successSub}>
                Your session has been closed securely.
              </Text>
              <View style={styles.successBadge}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#047857" style={{ marginRight: 6 }} />
                <Text style={styles.successBadgeText}>Local Ledger Safe on Device</Text>
              </View>
            </Animated.View>
          ) : (
            /* Confirmation Dialog */
            <View style={styles.confirmContainer}>
              {/* Header Icon */}
              <View style={styles.warningIconCircle}>
                <Ionicons name="log-out-outline" size={32} color="#DC2626" />
              </View>

              <Text style={styles.modalTitle}>Log Out Account?</Text>
              <Text style={styles.modalSubtitle}>
                Are you sure you want to sign out from this device?
              </Text>

              {/* User Identity Preview */}
              {currentUser && (
                <View style={styles.userCard}>
                  <View style={styles.avatarCircle}>
                    <Text style={styles.avatarText}>
                      {(currentUser.name ? currentUser.name[0] : 'U').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userDetails}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {currentUser.name || 'Account User'}
                    </Text>
                    <Text style={styles.userPhone}>
                      +91 {currentUser.phone || ''}
                    </Text>
                  </View>
                </View>
              )}

              {/* Safety Note */}
              <View style={styles.noteBox}>
                <Ionicons name="information-circle" size={18} color="#2563EB" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={styles.noteText}>
                  Your local transactions and khata records stay safe on this phone. Automatic cloud backup will pause until you sign in again.
                </Text>
              </View>

              {/* Action Buttons */}
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={handleCancel}
                  activeOpacity={0.7}
                  disabled={isLoading}
                >
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, isLoading && styles.confirmBtnDisabled]}
                  onPress={handleConfirmLogout}
                  activeOpacity={0.8}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={styles.btnContent}>
                      <Ionicons name="log-out-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                      <Text style={styles.confirmBtnText}>Yes, Log Out</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xxl,
    width: '100%',
    maxWidth: 380,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xxl,
    ...Shadows.xl,
  },
  confirmContainer: {
    alignItems: 'center',
  },
  warningIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '100%',
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: Typography.fontSizes.sm + 1,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  userPhone: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  noteBox: {
    flexDirection: 'row',
    backgroundColor: '#EFF6FF',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    fontSize: Typography.fontSizes.xs,
    color: '#1E40AF',
    lineHeight: 17,
  },
  btnRow: {
    flexDirection: 'row',
    width: '100%',
    gap: Spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: {
    fontSize: Typography.fontSizes.sm + 1,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 1.2,
    paddingVertical: 13,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  confirmBtnDisabled: {
    opacity: 0.7,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: Typography.fontSizes.sm + 1,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
  },
  successIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  successTitle: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
    color: '#047857',
    marginBottom: 6,
    textAlign: 'center',
  },
  successSub: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  successBadgeText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: '#047857',
  },
});
