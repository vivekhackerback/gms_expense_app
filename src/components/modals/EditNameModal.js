import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';

export const EditNameModal = ({
  visible,
  onClose,
  currentUser,
  onUpdateName,
}) => {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (visible) {
      setName(currentUser?.name || '');
      setErrorMessage('');
      setIsLoading(false);
    }
  }, [visible, currentUser]);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage('Full name cannot be empty.');
      return;
    }

    if (trimmed.length < 2) {
      setErrorMessage('Name must be at least 2 characters long.');
      return;
    }

    if (trimmed === (currentUser?.name || '').trim()) {
      onClose();
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await onUpdateName(trimmed);
      setIsLoading(false);
      if (res && res.success) {
        Alert.alert('Success ✓', 'Full name updated successfully!');
        onClose();
      } else {
        setErrorMessage(res?.message || 'Failed to update name. Please try again.');
      }
    } catch (e) {
      setIsLoading(false);
      setErrorMessage(e?.message || 'Network error occurred. Please check your connection.');
    }
  };

  if (!visible) return null;

  const initialLetter = (name.trim() ? name.trim()[0] : (currentUser?.name ? currentUser.name[0] : 'U')).toUpperCase();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalCard, Shadows.lg]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.avatarPreview}>
                <Text style={styles.avatarText}>{initialLetter}</Text>
              </View>
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.title}>Change Full Name</Text>
                <Text style={styles.subtitle}>Update your profile display name</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              disabled={isLoading}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Account Identifier Badge */}
          {currentUser && (
            <View style={styles.accountBadge}>
              <Ionicons name="call" size={14} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.accountBadgeText}>
                Account:{' '}
                <Text style={{ fontWeight: '700', color: Colors.textPrimary }}>
                  {currentUser.phone?.startsWith('+')
                    ? currentUser.phone
                    : `${currentUser.country_code || '+91'} ${currentUser.phone || ''}`}
                </Text>
              </Text>
              <View style={styles.activeDot} />
            </View>
          )}

          {/* Error Banner */}
          {Boolean(errorMessage) && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#DC2626" style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          )}

          {/* Input Section */}
          <View style={styles.inputSection}>
            <View style={styles.inputLabelRow}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <Text style={styles.charCount}>{name.length}/50</Text>
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={{ marginRight: 10 }} />
              <TextInput
                style={styles.textInput}
                value={name}
                onChangeText={(val) => {
                  setName(val);
                  setErrorMessage('');
                }}
                placeholder="Enter your full name"
                placeholderTextColor={Colors.textMuted}
                autoFocus={true}
                maxLength={50}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
              {name.length > 0 && (
                <TouchableOpacity
                  onPress={() => setName('')}
                  style={styles.clearBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.inputHelper}>
              This name will appear on transaction reports, PDFs, and backup archives.
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onClose}
              disabled={isLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, isLoading && styles.saveBtnDisabled]}
              onPress={handleSave}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <View style={styles.btnLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.saveBtnText}>Saving...</Text>
                </View>
              ) : (
                <View style={styles.btnLoadingRow}>
                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarPreview: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: '#2563EB',
  },
  title: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSubtle,
  },
  accountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  accountBadgeText: {
    fontSize: Typography.fontSizes.xs + 1,
    color: Colors.textSecondary,
    flex: 1,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: Typography.fontSizes.xs + 1,
    color: '#DC2626',
    flex: 1,
  },
  inputSection: {
    marginBottom: Spacing.lg,
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  inputLabel: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
  },
  charCount: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? Spacing.sm + 2 : Spacing.xs,
  },
  textInput: {
    flex: 1,
    fontSize: Typography.fontSizes.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeights.medium,
    paddingVertical: 6,
  },
  clearBtn: {
    padding: 4,
  },
  inputHelper: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
    lineHeight: 15,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
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
  saveBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  saveBtnDisabled: {
    opacity: 0.7,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontSize: Typography.fontSizes.sm + 1,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
});

export default EditNameModal;
