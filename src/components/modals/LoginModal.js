import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../context/AppContext';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';

export const LoginModal = () => {
  const insets = useSafeAreaInsets();
  const {
    isLoginModalOpen,
    closeLoginModal,
    loginUser,
    registerUser,
    networkStatus,
  } = useApp();

  // Mode: 'login' or 'register'
  const [authMode, setAuthMode] = useState('login');

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isLoginModalOpen) return null;

  const handleAuthSubmit = async () => {
    setErrorMessage('');
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

    // Common Validation
    if (!cleanPhone) {
      setErrorMessage('Please enter your mobile number');
      return;
    }

    if (cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Please enter your password');
      return;
    }

    // Register-specific Validation
    if (authMode === 'register') {
      if (password.length < 4) {
        setErrorMessage('Password must be at least 4 characters long');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please check again.');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (authMode === 'login') {
        const result = await loginUser(cleanPhone, password.trim());
        if (result.success) {
          resetForm();
          Alert.alert('Login Successful', `Welcome back, ${result.user?.name || 'User'}!`);
        } else {
          setErrorMessage(result.message || 'Login failed. Please check your credentials.');
        }
      } else {
        const result = await registerUser(name.trim(), cleanPhone, password.trim());
        if (result.success) {
          resetForm();
          Alert.alert('Account Created', `Welcome to GMS Expense & Khata, ${result.user?.name || 'User'}!`);
        } else {
          setErrorMessage(result.message || 'Registration failed. Please check your details.');
        }
      }
    } catch (e) {
      setErrorMessage('Unable to connect to authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setErrorMessage('');
  };

  const handleClose = () => {
    resetForm();
    closeLoginModal();
  };

  const switchMode = (mode) => {
    setErrorMessage('');
    setAuthMode(mode);
  };

  const isRegister = authMode === 'register';

  return (
    <Modal
      visible={isLoginModalOpen}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconCircle, isRegister && { backgroundColor: '#DCFCE7' }]}>
                <Ionicons
                  name={isRegister ? 'person-add' : 'person'}
                  size={22}
                  color={isRegister ? '#15803D' : Colors.primaryDark}
                />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.title}>
                  {isRegister ? 'Create Account' : 'User Account Login'}
                </Text>
                <Text style={styles.subtitle}>
                  {isRegister ? 'Register your mobile for cloud backup' : 'Sign in with mobile & password'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={handleClose}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Mode Switcher Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tabBtn, !isRegister && styles.tabBtnActive]}
              onPress={() => switchMode('login')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="log-in-outline"
                size={16}
                color={!isRegister ? Colors.primaryDark : Colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabBtnText, !isRegister && styles.tabBtnTextActive]}>
                Sign In
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, isRegister && styles.tabBtnActive]}
              onPress={() => switchMode('register')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="person-add-outline"
                size={16}
                color={isRegister ? Colors.primaryDark : Colors.textMuted}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.tabBtnText, isRegister && styles.tabBtnTextActive]}>
                Create Account
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Offline Notice */}
            {!networkStatus.isConnected && (
              <View style={styles.offlineNotice}>
                <Ionicons name="cloud-offline-outline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.offlineText}>Internet connection required to {isRegister ? 'create account' : 'sign in'}.</Text>
              </View>
            )}

            {/* Error Banner */}
            {Boolean(errorMessage) && (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Quick Registration Notice */}
            {isRegister && (
              <View style={styles.quickRegisterNotice}>
                <Ionicons name="sparkles-outline" size={16} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.quickRegisterText}>
                  Instant Registration: Just enter your mobile number and password. You can complete your business name &amp; profile later.
                </Text>
              </View>
            )}

            {/* Mobile Number Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mobile Number *</Text>
              <View style={styles.phoneInputWrap}>
                <View style={styles.countryCodeBox}>
                  <Text style={styles.flagEmoji}>🇮🇳</Text>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  placeholder="Enter 10-digit mobile"
                  placeholderTextColor={Colors.textMuted}
                  value={phone}
                  onChangeText={(val) => {
                    setPhone(val);
                    setErrorMessage('');
                  }}
                  keyboardType="phone-pad"
                  maxLength={10}
                  autoFocus={!isRegister}
                />
              </View>
            </View>

            {/* Password Field */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>
                {isRegister ? 'Create Password *' : 'Password *'}
              </Text>
              <View style={styles.singleInputWrap}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.textInput}
                  placeholder={isRegister ? 'Choose a password (min 4 chars)' : 'Enter your password'}
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={(val) => {
                    setPassword(val);
                    setErrorMessage('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={styles.eyeBtn}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password Field (Only in Register Mode) */}
            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Confirm Password *</Text>
                <View style={styles.singleInputWrap}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.textInput}
                    placeholder="Re-enter your password"
                    placeholderTextColor={Colors.textMuted}
                    value={confirmPassword}
                    onChangeText={(val) => {
                      setConfirmPassword(val);
                      setErrorMessage('');
                    }}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.eyeBtn}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitBtn,
                isRegister && { backgroundColor: '#059669' },
                isLoading && styles.submitBtnDisabled,
              ]}
              onPress={handleAuthSubmit}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <View style={styles.btnRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.submitBtnText}>
                    {isRegister ? 'Creating Account...' : 'Signing In...'}
                  </Text>
                </View>
              ) : (
                <View style={styles.btnRow}>
                  <Ionicons
                    name={isRegister ? 'person-add' : 'log-in-outline'}
                    size={19}
                    color="#FFFFFF"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.submitBtnText}>
                    {isRegister ? 'Create Account & Sign In' : 'Sign In to Account'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Switch Mode Prompt Link */}
            <TouchableOpacity
              style={styles.switchModeWrap}
              onPress={() => switchMode(isRegister ? 'login' : 'register')}
              activeOpacity={0.7}
            >
              <Text style={styles.switchModeText}>
                {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                <Text style={styles.switchModeHighlight}>
                  {isRegister ? 'Sign In' : 'Create Account'}
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Test hint for development */}
            {!isRegister && (
              <View style={styles.testHintCard}>
                <Ionicons name="information-circle-outline" size={16} color={Colors.primary} style={{ marginRight: 6, marginTop: 1 }} />
                <Text style={styles.testHintText}>
                  Demo Account: <Text style={{ fontWeight: 'bold' }}>9876543210</Text> · Pass: <Text style={{ fontWeight: 'bold' }}>123456</Text> (or create your own account using the tab above).
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
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
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    maxHeight: '92%',
    ...Shadows.xl,
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
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    padding: 4,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.xs,
  },
  tabBtnText: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textMuted,
  },
  tabBtnTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeights.bold,
  },
  scrollContent: {
    paddingVertical: Spacing.md,
  },
  offlineNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  offlineText: {
    fontSize: Typography.fontSizes.xs,
    color: '#DC2626',
    fontWeight: Typography.fontWeights.medium,
  },
  quickRegisterNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    padding: Spacing.sm + 4,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  quickRegisterText: {
    fontSize: Typography.fontSizes.xs,
    color: '#065F46',
    fontWeight: Typography.fontWeights.medium,
    flex: 1,
    lineHeight: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: Spacing.sm + 4,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#F87171',
  },
  errorText: {
    fontSize: Typography.fontSizes.xs + 1,
    color: '#B91C1C',
    fontWeight: Typography.fontWeights.semibold,
    flex: 1,
  },
  inputGroup: {
    marginBottom: Spacing.md + 2,
  },
  inputLabel: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  singleInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  textInput: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    fontSize: Typography.fontSizes.md,
    color: Colors.textPrimary,
  },
  phoneInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background,
    overflow: 'hidden',
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceSubtle,
    borderRightWidth: 1,
    borderRightColor: Colors.borderLight,
  },
  flagEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  countryCodeText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  phoneInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSizes.md,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeights.medium,
    letterSpacing: 0.5,
  },
  eyeBtn: {
    padding: 6,
  },
  submitBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
    ...Shadows.md,
  },
  submitBtnDisabled: {
    opacity: 0.7,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.sm + 1,
    fontWeight: Typography.fontWeights.bold,
  },
  switchModeWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.lg,
    paddingVertical: Spacing.xs,
  },
  switchModeText: {
    fontSize: Typography.fontSizes.xs + 1,
    color: Colors.textSecondary,
  },
  switchModeHighlight: {
    color: Colors.primaryDark,
    fontWeight: Typography.fontWeights.bold,
    textDecorationLine: 'underline',
  },
  testHintCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    padding: Spacing.sm + 4,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  testHintText: {
    fontSize: 11,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 16,
  },
});
