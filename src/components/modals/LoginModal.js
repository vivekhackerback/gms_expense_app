import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../../context/AppContext';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { AppImages } from '../../constants/assets';
import { otpService } from '../../services/otpService';

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

  // Register Steps: 'phone' -> 'otp' -> 'password'
  const [regStep, setRegStep] = useState('phone');

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Status & Resend Timer
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const successOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0.4)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Resend Countdown Timer
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  // Smooth animated color shift for "Create Account" text
  useEffect(() => {
    let animation;
    if (isLoginModalOpen) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 1400,
            useNativeDriver: false,
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1400,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
    }
    return () => {
      if (animation) animation.stop();
    };
  }, [isLoginModalOpen, glowAnim]);

  const glowTextColor = glowAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [
      '#581C87',
      '#7E22CE',
      '#A21CAF',
      '#DB2777',
      '#EC4899',
    ],
  });

  const textGlowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  if (!isLoginModalOpen) return null;

  const triggerSuccessAnimation = (userInfo, isNewAccount = false) => {
    setSuccessInfo({
      name: userInfo?.name || 'User',
      isNewAccount,
    });
    successOpacity.setValue(0);
    successScale.setValue(0.4);

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

    setTimeout(() => {
      Animated.timing(successOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        resetForm();
        setSuccessInfo(null);
        closeLoginModal();
      });
    }, 800);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setOtp('');
    setChallengeId('');
    setPassword('');
    setConfirmPassword('');
    setErrorMessage('');
    setRegStep('phone');
    setResendCooldown(0);
  };

  const handleClose = () => {
    if (successInfo) return;
    resetForm();
    closeLoginModal();
  };

  const switchMode = (mode) => {
    setErrorMessage('');
    setAuthMode(mode);
    setRegStep('phone');
    setOtp('');
    setChallengeId('');
    setResendCooldown(0);
  };

  const isRegister = authMode === 'register';

  // -------------------------------------------------------------
  // Step 1: Send OTP to User's WhatsApp
  // -------------------------------------------------------------
  const handleRequestOtp = async () => {
    setErrorMessage('');
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number');
      return;
    }

    setIsLoading(true);
    try {
      const res = await otpService.sendOtp(cleanPhone, 'Registration');
      if (res && res.success) {
        setChallengeId(res.challenge_id || '');
        setResendCooldown(res.resend_cooldown || 60);
        setRegStep('otp');
      } else {
        setErrorMessage(res?.message || 'Unable to dispatch OTP. Please check the mobile number.');
      }
    } catch (e) {
      setErrorMessage('Failed to send OTP. Please check your internet connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Step 2: Resend OTP
  // -------------------------------------------------------------
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || isLoading) return;
    setErrorMessage('');
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

    setIsLoading(true);
    try {
      const res = await otpService.sendOtp(cleanPhone, 'Registration');
      if (res && res.success) {
        setChallengeId(res.challenge_id || '');
        setResendCooldown(res.resend_cooldown || 60);
      } else {
        setErrorMessage(res?.message || 'Could not resend OTP. Please wait before retrying.');
      }
    } catch (e) {
      setErrorMessage('Network error while resending OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Step 2: Verify OTP
  // -------------------------------------------------------------
  const handleVerifyOtp = async () => {
    setErrorMessage('');
    const cleanOtp = otp.trim().replace(/[^0-9]/g, '');

    if (!cleanOtp || cleanOtp.length < 4) {
      setErrorMessage('Please enter the 6-digit OTP code sent on WhatsApp');
      return;
    }

    setIsLoading(true);
    try {
      const res = await otpService.verifyOtp(challengeId, cleanOtp);
      if (res && res.success && res.verified) {
        // Move to Step 3: Password creation
        setRegStep('password');
      } else {
        const attemptsMsg = res?.attempts_remaining != null ? ` (${res.attempts_remaining} attempts left)` : '';
        setErrorMessage((res?.message || 'Invalid or expired OTP code.') + attemptsMsg);
      }
    } catch (e) {
      setErrorMessage('Unable to verify OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Step 3: Create Password & Complete Registration
  // -------------------------------------------------------------
  const handleRegisterSubmit = async () => {
    setErrorMessage('');
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

    if (!password.trim()) {
      setErrorMessage('Please create a password for your account');
      return;
    }

    if (password.length < 4) {
      setErrorMessage('Password must be at least 4 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    try {
      const displayName = name.trim() || `User ${cleanPhone.slice(-4)}`;
      const result = await registerUser(displayName, cleanPhone, password.trim());
      if (result.success) {
        triggerSuccessAnimation(result.user, true);
      } else {
        setErrorMessage(result.message || 'Registration failed. Please try again.');
      }
    } catch (e) {
      setErrorMessage('Unable to complete registration. Please check connection.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Standard Login Flow
  // -------------------------------------------------------------
  const handleLoginSubmit = async () => {
    setErrorMessage('');
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');

    if (!cleanPhone || cleanPhone.length < 10) {
      setErrorMessage('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!password.trim()) {
      setErrorMessage('Please enter your password');
      return;
    }

    setIsLoading(true);
    try {
      const result = await loginUser(cleanPhone, password.trim());
      if (result.success) {
        triggerSuccessAnimation(result.user, false);
      } else {
        setErrorMessage(result.message || 'Login failed. Please check your credentials.');
      }
    } catch (e) {
      setErrorMessage('Unable to connect to authentication server.');
    } finally {
      setIsLoading(false);
    }
  };

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
          {successInfo ? (
            /* Animated Success Overlay */
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
                <Ionicons name="checkmark-circle" size={64} color="#16A34A" />
              </View>
              <Text style={styles.successTitle}>
                {successInfo.isNewAccount ? 'Account Created!' : 'Login Successful!'}
              </Text>
              <Text style={styles.successSub}>
                Welcome back, <Text style={{ fontWeight: 'bold', color: Colors.textPrimary }}>{successInfo.name}</Text>
              </Text>
              <View style={styles.successBadge}>
                <Ionicons name="cloud-done-outline" size={16} color="#15803D" style={{ marginRight: 6 }} />
                <Text style={styles.successBadgeText}>Cloud Backup Activated</Text>
              </View>
            </Animated.View>
          ) : (
            <>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Image source={AppImages.logo} style={styles.modalLogo} resizeMode="contain" />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.title}>
                      {isRegister ? 'Create Account' : 'User Account Login'}
                    </Text>
                    <Text style={styles.subtitle}>
                      {isRegister
                        ? regStep === 'phone'
                          ? 'Step 1: Enter mobile for WhatsApp OTP'
                          : regStep === 'otp'
                          ? 'Step 2: Verify WhatsApp OTP code'
                          : 'Step 3: Create your account password'
                        : 'Sign in with mobile & password'}
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
                    color={isRegister ? '#059669' : '#7E22CE'}
                    style={{ marginRight: 6 }}
                  />
                  {isRegister ? (
                    <Text style={[styles.tabBtnText, { color: '#059669', fontWeight: 'bold' }]}>
                      Create Account
                    </Text>
                  ) : (
                    <Animated.Text
                      style={[
                        styles.tabBtnText,
                        {
                          color: glowTextColor,
                          opacity: textGlowOpacity,
                          fontWeight: 'bold',
                        },
                      ]}
                    >
                      Create Account ✨
                    </Animated.Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Registration Step Indicator (Pills) */}
              {isRegister && (
                <View style={styles.stepProgressContainer}>
                  <View style={[styles.stepItem, regStep === 'phone' && styles.stepItemActive, (regStep === 'otp' || regStep === 'password') && styles.stepItemDone]}>
                    <Ionicons
                      name={regStep === 'otp' || regStep === 'password' ? 'checkmark-circle' : 'call'}
                      size={13}
                      color={regStep === 'phone' ? '#059669' : (regStep === 'otp' || regStep === 'password' ? '#16A34A' : Colors.textMuted)}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.stepText, regStep === 'phone' && styles.stepTextActive, (regStep === 'otp' || regStep === 'password') && styles.stepTextDone]}>
                      1. Mobile
                    </Text>
                  </View>
                  <View style={styles.stepLine} />

                  <View style={[styles.stepItem, regStep === 'otp' && styles.stepItemActive, regStep === 'password' && styles.stepItemDone]}>
                    <Ionicons
                      name={regStep === 'password' ? 'checkmark-circle' : 'shield-checkmark'}
                      size={13}
                      color={regStep === 'otp' ? '#059669' : (regStep === 'password' ? '#16A34A' : Colors.textMuted)}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.stepText, regStep === 'otp' && styles.stepTextActive, regStep === 'password' && styles.stepTextDone]}>
                      2. Verify OTP
                    </Text>
                  </View>
                  <View style={styles.stepLine} />

                  <View style={[styles.stepItem, regStep === 'password' && styles.stepItemActive]}>
                    <Ionicons
                      name="lock-closed"
                      size={13}
                      color={regStep === 'password' ? '#059669' : Colors.textMuted}
                      style={{ marginRight: 4 }}
                    />
                    <Text style={[styles.stepText, regStep === 'password' && styles.stepTextActive]}>
                      3. Password
                    </Text>
                  </View>
                </View>
              )}

              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContent}
              >
                {/* Offline Notice */}
                {!networkStatus.isConnected && (
                  <View style={styles.offlineNotice}>
                    <Ionicons name="cloud-offline-outline" size={16} color="#DC2626" style={{ marginRight: 6 }} />
                    <Text style={styles.offlineText}>
                      Internet connection required to {isRegister ? 'create account' : 'sign in'}.
                    </Text>
                  </View>
                )}

                {/* Error Banner */}
                {Boolean(errorMessage) && (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                )}

                {/* ========================================================= */}
                {/* MODE A: LOGIN                                              */}
                {/* ========================================================= */}
                {!isRegister && (
                  <>
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
                          autoFocus={true}
                        />
                      </View>
                    </View>

                    {/* Password Field */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Password *</Text>
                      <View style={styles.singleInputWrap}>
                        <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="Enter your password"
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

                    {/* Submit Button */}
                    <TouchableOpacity
                      style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
                      onPress={handleLoginSubmit}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <View style={styles.btnRow}>
                          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.submitBtnText}>Signing In...</Text>
                        </View>
                      ) : (
                        <View style={styles.btnRow}>
                          <Ionicons name="log-in-outline" size={19} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.submitBtnText}>Sign In to Account</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {/* ========================================================= */}
                {/* MODE B: REGISTER - STEP 1 (Enter Mobile & Send OTP)       */}
                {/* ========================================================= */}
                {isRegister && regStep === 'phone' && (
                  <>
                    <View style={styles.quickRegisterNotice}>
                      <Ionicons name="logo-whatsapp" size={18} color="#059669" style={{ marginRight: 8 }} />
                      <Text style={styles.quickRegisterText}>
                        We will send a 6-digit verification code to your WhatsApp number to verify ownership.
                      </Text>
                    </View>

                    {/* Mobile Number Field */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Mobile Number (WhatsApp) *</Text>
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
                          autoFocus={true}
                        />
                      </View>
                    </View>

                    {/* Name Field (Optional) */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Your Name (Optional)</Text>
                      <View style={styles.singleInputWrap}>
                        <Ionicons name="person-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="e.g. Rahul Sharma"
                          placeholderTextColor={Colors.textMuted}
                          value={name}
                          onChangeText={setName}
                        />
                      </View>
                    </View>

                    {/* Send OTP Button */}
                    <TouchableOpacity
                      style={[styles.submitBtn, { backgroundColor: '#059669' }, isLoading && styles.submitBtnDisabled]}
                      onPress={handleRequestOtp}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <View style={styles.btnRow}>
                          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.submitBtnText}>Sending OTP...</Text>
                        </View>
                      ) : (
                        <View style={styles.btnRow}>
                          <Ionicons name="logo-whatsapp" size={19} color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.submitBtnText}>Send WhatsApp OTP</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {/* ========================================================= */}
                {/* MODE B: REGISTER - STEP 2 (Verify WhatsApp OTP)           */}
                {/* ========================================================= */}
                {isRegister && regStep === 'otp' && (
                  <>
                    {/* Phone target card with Change option */}
                    <View style={styles.otpNoticeCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <Ionicons name="logo-whatsapp" size={22} color="#16A34A" style={{ marginRight: 8 }} />
                        <View>
                          <Text style={styles.otpSentToLabel}>Code sent via WhatsApp to</Text>
                          <Text style={styles.otpSentToNumber}>+91 {phone}</Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.changePhoneBtn}
                        onPress={() => {
                          setRegStep('phone');
                          setOtp('');
                          setErrorMessage('');
                        }}
                      >
                        <Text style={styles.changePhoneBtnText}>Change</Text>
                      </TouchableOpacity>
                    </View>

                    {/* 6-Digit OTP Field */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Enter 6-Digit Verification Code *</Text>
                      <View style={[styles.singleInputWrap, styles.otpInputWrap]}>
                        <Ionicons name="key-outline" size={20} color={Colors.textMuted} style={{ marginRight: 10 }} />
                        <TextInput
                          style={styles.otpTextInput}
                          placeholder="• • • • • •"
                          placeholderTextColor={Colors.textMuted}
                          value={otp}
                          onChangeText={(val) => {
                            setOtp(val);
                            setErrorMessage('');
                          }}
                          keyboardType="number-pad"
                          maxLength={6}
                          autoFocus={true}
                        />
                      </View>
                    </View>

                    {/* Resend OTP Row */}
                    <View style={styles.resendRow}>
                      <Text style={styles.resendHintText}>Didn't receive code?</Text>
                      {resendCooldown > 0 ? (
                        <Text style={styles.resendTimerText}>
                          Resend in <Text style={{ fontWeight: 'bold' }}>{resendCooldown}s</Text>
                        </Text>
                      ) : (
                        <TouchableOpacity onPress={handleResendOtp} disabled={isLoading}>
                          <Text style={styles.resendActionText}>Resend on WhatsApp</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Verify OTP Button */}
                    <TouchableOpacity
                      style={[styles.submitBtn, { backgroundColor: '#059669' }, isLoading && styles.submitBtnDisabled]}
                      onPress={handleVerifyOtp}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <View style={styles.btnRow}>
                          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.submitBtnText}>Verifying Code...</Text>
                        </View>
                      ) : (
                        <View style={styles.btnRow}>
                          <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.submitBtnText}>Verify OTP & Continue</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {/* ========================================================= */}
                {/* MODE B: REGISTER - STEP 3 (Create Password & Confirm)     */}
                {/* ========================================================= */}
                {isRegister && regStep === 'password' && (
                  <>
                    {/* Verified Phone confirmation pill */}
                    <View style={styles.verifiedPhoneBadge}>
                      <Ionicons name="shield-checkmark" size={18} color="#16A34A" style={{ marginRight: 6 }} />
                      <Text style={styles.verifiedPhoneText}>
                        Mobile Verified: <Text style={{ fontWeight: 'bold' }}>+91 {phone}</Text>
                      </Text>
                    </View>

                    {/* Create Password Field */}
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Create Password *</Text>
                      <View style={styles.singleInputWrap}>
                        <Ionicons name="lock-closed-outline" size={18} color={Colors.textMuted} style={{ marginRight: 8 }} />
                        <TextInput
                          style={styles.textInput}
                          placeholder="Choose a password (min 4 chars)"
                          placeholderTextColor={Colors.textMuted}
                          value={password}
                          onChangeText={(val) => {
                            setPassword(val);
                            setErrorMessage('');
                          }}
                          secureTextEntry={!showPassword}
                          autoCapitalize="none"
                          autoFocus={true}
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

                    {/* Confirm Password Field */}
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

                    {/* Final Create Account Button */}
                    <TouchableOpacity
                      style={[styles.submitBtn, { backgroundColor: '#059669' }, isLoading && styles.submitBtnDisabled]}
                      onPress={handleRegisterSubmit}
                      disabled={isLoading}
                      activeOpacity={0.8}
                    >
                      {isLoading ? (
                        <View style={styles.btnRow}>
                          <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                          <Text style={styles.submitBtnText}>Creating Account...</Text>
                        </View>
                      ) : (
                        <View style={styles.btnRow}>
                          <Ionicons name="person-add" size={19} color="#FFFFFF" style={{ marginRight: 6 }} />
                          <Text style={styles.submitBtnText}>Create Account & Sign In</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </>
                )}

                {/* Switch Mode Prompt Link */}
                <TouchableOpacity
                  style={styles.switchModeWrap}
                  onPress={() => switchMode(isRegister ? 'login' : 'register')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.switchModeText}>
                    {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                    {!isRegister ? (
                      <Animated.Text
                        style={[
                          styles.switchModeHighlight,
                          { color: glowTextColor, opacity: textGlowOpacity },
                        ]}
                      >
                        Create Account ✨
                      </Animated.Text>
                    ) : (
                      <Text style={styles.switchModeHighlight}>Sign In</Text>
                    )}
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
            </>
          )}
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
    maxHeight: '94%',
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
    flex: 1,
  },
  modalLogo: {
    width: 44,
    height: 44,
    borderRadius: 10,
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
    marginLeft: 8,
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
  stepProgressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm + 4,
    marginBottom: Spacing.xs,
    paddingHorizontal: 4,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSubtle,
  },
  stepItemActive: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  stepItemDone: {
    backgroundColor: '#F0FDF4',
  },
  stepText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.medium,
    color: Colors.textMuted,
  },
  stepTextActive: {
    color: '#065F46',
    fontWeight: Typography.fontWeights.bold,
  },
  stepTextDone: {
    color: '#16A34A',
    fontWeight: Typography.fontWeights.semibold,
  },
  stepLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 4,
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
  otpNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDF4',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  otpSentToLabel: {
    fontSize: 11,
    color: '#15803D',
  },
  otpSentToNumber: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: '#14532D',
    letterSpacing: 0.5,
  },
  changePhoneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: '#DCFCE7',
  },
  changePhoneBtnText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: '#15803D',
  },
  otpInputWrap: {
    paddingVertical: Spacing.sm,
    justifyContent: 'center',
  },
  otpTextInput: {
    flex: 1,
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    letterSpacing: 8,
    textAlign: 'center',
    paddingVertical: 4,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    paddingHorizontal: 4,
  },
  resendHintText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
  },
  resendTimerText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
  },
  resendActionText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: '#059669',
    textDecorationLine: 'underline',
  },
  verifiedPhoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  verifiedPhoneText: {
    fontSize: Typography.fontSizes.xs + 1,
    color: '#065F46',
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
  successContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl + 8,
    paddingHorizontal: Spacing.lg,
  },
  successIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  successTitle: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
    color: '#15803D',
    marginBottom: 6,
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
    backgroundColor: '#F0FDF4',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successBadgeText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: '#15803D',
  },
});
