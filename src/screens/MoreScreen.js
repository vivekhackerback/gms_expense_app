import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  Animated,
  ToastAndroid,
  Platform,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { Header } from '../components/common/Header';
import { AppImages, BrandConfig } from '../constants/assets';
import {
  generateStressTestTransactions,
  deleteStressTestTransactions,
  getStressTestStatus,
  isDeveloperModeUnlocked,
  setDeveloperModeUnlocked,
  runSqliteBenchmark,
} from '../services/stressTestService';
import { FeedbackScreen } from './FeedbackScreen';
import { CurrencySelectModal } from '../components/modals/CurrencySelectModal';
import { MonthlyBudgetModal } from '../components/modals/MonthlyBudgetModal';
import { EmiCalculatorModal } from '../components/modals/EmiCalculatorModal';
import { ExportPdfModal } from '../components/transaction/ExportPdfModal';
import { formatCurrency } from '../utils/formatters';
import { getThisMonthSpend, getMonthlyBudget, setMonthlyBudget } from '../database/queries';

export const MoreScreen = () => {
  const {
    syncStats,
    isSyncing,
    triggerSync,
    networkStatus,
    setIsManageCategoriesOpen,
    setIsManagePartiesOpen,
    openBackupReport,
    openBackupSettings,
    currentUser,
    isLoggedIn,
    openLoginModal,
    openLogoutModal,
    updateUserProfile,
    logoutUser,
    refreshAll,
    currency,
    changeCurrency,
  } = useApp();

  const [isCurrencyModalOpen, setIsCurrencyModalOpen] = useState(false);

  // Budget & Spend States
  const [monthlyBudget, setMonthlyBudgetState] = useState(() => getMonthlyBudget());
  const [monthSpend, setMonthSpend] = useState(() => getThisMonthSpend());
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isEmiModalOpen, setIsEmiModalOpen] = useState(false);
  const [isExportPdfOpen, setIsExportPdfOpen] = useState(false);

  const handleSaveBudget = (amount) => {
    const updated = setMonthlyBudget(amount);
    setMonthlyBudgetState(updated);
  };

  const budgetSpentPercent = monthlyBudget > 0 ? Math.min(100, (monthSpend.spent / monthlyBudget) * 100) : 0;
  const isOverBudget = monthlyBudget > 0 && monthSpend.spent > monthlyBudget;
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  const handleOpenEditProfile = () => {
    setEditName(currentUser?.name || '');
    setEditEmail(currentUser?.email || '');
    setIsEditProfileOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation', 'Please enter your name or business name');
      return;
    }
    setIsSavingProfile(true);
    const res = await updateUserProfile(editName.trim(), editEmail.trim());
    setIsSavingProfile(false);
    if (res.success) {
      setIsEditProfileOpen(false);
      Alert.alert('Profile Updated', 'Your profile details have been saved successfully.');
    } else {
      Alert.alert('Update Failed', res.message || 'Unable to update profile.');
    }
  };

  const handleManualSync = async () => {
    const res = await triggerSync();
    if (res) {
      Alert.alert('Sync Status', res.message);
    }
  };

  const handleLogoutPress = () => {
    openLogoutModal();
  };

  // Developer Mode & Stress Test States
  const [isDeveloperMode, setIsDeveloperMode] = useState(() => isDeveloperModeUnlocked());
  const [devTapCount, setDevTapCount] = useState(0);
  const [devToastMessage, setDevToastMessage] = useState(null);
  const lastDevTapTime = useRef(0);
  const devToastAnim = useRef(new Animated.Value(0)).current;
  const devToastTimer = useRef(null);

  const [isStressGenerating, setIsStressGenerating] = useState(false);
  const [stressProgress, setStressProgress] = useState({ current: 0, total: 50000, percentage: 0 });

  // Clean up developer toast timer on unmount
  useEffect(() => {
    return () => {
      if (devToastTimer.current) clearTimeout(devToastTimer.current);
    };
  }, []);

  const showDevToast = (message) => {
    if (Platform.OS === 'android') {
      try {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      } catch (e) {}
    }

    if (devToastTimer.current) {
      clearTimeout(devToastTimer.current);
    }
    setDevToastMessage(message);
    Animated.spring(devToastAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 7,
      tension: 50,
    }).start();

    devToastTimer.current = setTimeout(() => {
      Animated.timing(devToastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setDevToastMessage(null);
      });
    }, 2200);
  };

  /**
   * Secret 5-tap developer mode unlocker
   */
  const handleDeveloperTap = () => {
    const now = Date.now();
    let currentTaps = devTapCount;
    // Reset tap sequence if more than 2.5 seconds elapsed between taps
    if (now - lastDevTapTime.current > 2500) {
      currentTaps = 0;
    }
    lastDevTapTime.current = now;

    if (isDeveloperMode) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
      Alert.alert(
        '👨‍💻 Developer Mode',
        'Developer Mode & Stress Test tools are currently unlocked on this device.',
        [
          { text: 'Keep Unlocked', style: 'default' },
          {
            text: 'Lock & Hide Tools',
            style: 'destructive',
            onPress: () => {
              setDeveloperModeUnlocked(false);
              setIsDeveloperMode(false);
              setDevTapCount(0);
              showDevToast('🔒 Developer Mode locked and hidden.');
            },
          },
        ]
      );
      return;
    }

    const nextTaps = currentTaps + 1;
    if (nextTaps < 5) {
      setDevTapCount(nextTaps);
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch (e) {}
      const remaining = 5 - nextTaps;
      showDevToast(`You are now ${remaining} step${remaining === 1 ? '' : 's'} away from being a developer.`);
    } else {
      // 5th tap reached! Unlock Developer Mode!
      setDevTapCount(0);
      setDeveloperModeUnlocked(true);
      setIsDeveloperMode(true);
      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch (e) {}
      showDevToast('🎉 You are now a developer!');
      Alert.alert(
        '🎉 Developer Mode Unlocked!',
        'You have unlocked Developer Stress Testing & Performance Benchmark tools!\n\nScroll down to the newly unlocked "👨‍💻 DEVELOPER STRESS TEST" section.',
        [{ text: 'Awesome', style: 'default' }]
      );
    }
  };

  const startStressGeneration = async (targetCount) => {
    setIsStressGenerating(true);
    setStressProgress({ current: 0, total: targetCount, percentage: 0 });
    try {
      const startTime = Date.now();
      const count = await generateStressTestTransactions({
        targetCount,
        chunkSize: Math.min(5000, targetCount),
        onProgress: (p) => setStressProgress(p),
      });
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
      setIsStressGenerating(false);
      if (refreshAll) refreshAll();
      Alert.alert(
        '⚡ Stress Test Data Ready!',
        `Successfully generated exactly ${count.toLocaleString('en-IN')} test transactions in ${durationSec}s.\n\nNow open the Transactions screen to test 60fps scrolling, search filtering, and pagination!`
      );
    } catch (err) {
      setIsStressGenerating(false);
      Alert.alert('Error', 'Failed to generate test data: ' + err.message);
    }
  };

  const handleGenerateStressData = () => {
    Alert.alert(
      '⚡ Developer Stress Test Generator',
      'Select the record volume to insert into local SQLite across the past 365 days.\n\nNote: Your real user transactions will remain 100% untouched and safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: '1,000 (Quick)', onPress: () => startStressGeneration(1000) },
        { text: '10,000 (Medium)', onPress: () => startStressGeneration(10000) },
        { text: '50,000 (Heavy)', onPress: () => startStressGeneration(50000) },
        { text: '100,000 (Extreme)', onPress: () => startStressGeneration(100000) },
      ]
    );
  };

  const handleRunBenchmark = () => {
    try {
      const res = runSqliteBenchmark();
      const isFast = res.elapsedMs < 60;
      Alert.alert(
        '🚀 SQLite Performance Benchmark',
        `• Total Records Queried: ${res.totalRecords.toLocaleString('en-IN')}\n• Total Got Calculated: ₹${Math.round(res.totalGot).toLocaleString('en-IN')}\n• Total Gave Calculated: ₹${Math.round(res.totalGave).toLocaleString('en-IN')}\n• Monthly Periods Aggregated: ${res.monthsAnalyzed}\n• Paginated Feed Tested: ${res.paginatedRows} rows\n\n⏱️ Execution Time: ${res.elapsedMs} ms\nStatus: ${isFast ? '⚡ Ultra Fast (60 FPS Safe)' : '✅ Optimal Performance'}`
      );
    } catch (err) {
      Alert.alert('Benchmark Error', err?.message || 'Failed to execute SQLite benchmark');
    }
  };

  const handleCheckStressData = () => {
    const status = getStressTestStatus();
    Alert.alert(
      'Database Transaction Records',
      `• Total Records: ${status.totalCount.toLocaleString('en-IN')}\n• Test Generated: ${status.testCount.toLocaleString('en-IN')}\n• Real User Data: ${status.realCount.toLocaleString('en-IN')}`
    );
  };

  const handleDeleteStressData = () => {
    const status = getStressTestStatus();
    if (status.testCount === 0) {
      Alert.alert('No Test Data', 'There are no stress-test transactions in the database.');
      return;
    }

    Alert.alert(
      'Delete Test Transactions',
      `Are you sure you want to delete ${status.testCount.toLocaleString('en-IN')} stress-test transactions?\n\nYour ${status.realCount.toLocaleString('en-IN')} real transactions will be kept safe.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Test Data',
          style: 'destructive',
          onPress: () => {
            try {
              const deleted = deleteStressTestTransactions();
              if (refreshAll) refreshAll();
              Alert.alert('Cleaned Up', `Successfully removed ${deleted.toLocaleString('en-IN')} test transactions.`);
            } catch (err) {
              Alert.alert('Error', 'Failed to delete test data: ' + err.message);
            }
          },
        },
      ]
    );
  };

  const handleLockDeveloperMode = () => {
    Alert.alert(
      'Lock Developer Mode',
      'This will hide the Developer Stress Test section. You can unlock it again anytime by tapping 5 times on the version number.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Lock & Hide',
          style: 'destructive',
          onPress: () => {
            setDeveloperModeUnlocked(false);
            setIsDeveloperMode(false);
            setDevTapCount(0);
            showDevToast('🔒 Developer Mode locked and hidden.');
          },
        },
      ]
    );
  };

  const renderSection = (title, items) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={[styles.card, Shadows.sm]}>
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, !isLast && styles.menuItemBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.iconWrap, { backgroundColor: item.iconBg || Colors.surfaceSubtle }]}>
                  <Ionicons name={item.icon} size={20} color={item.iconColor || Colors.primary} />
                </View>
                <View>
                  <Text style={[styles.menuItemText, item.isDestructive && { color: Colors.danger }]}>
                    {item.label}
                  </Text>
                  {item.sublabel ? (
                    <Text style={styles.menuItemSublabel}>{item.sublabel}</Text>
                  ) : null}
                </View>
              </View>

              <View style={styles.menuItemRight}>
                {item.rightText ? (
                  <Text style={styles.menuItemRightText}>{item.rightText}</Text>
                ) : null}
                {item.showChevron !== false && (
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="More" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Account / Profile Card */}
        {isLoggedIn && currentUser ? (
          <View style={[styles.userProfileCard, Shadows.sm]}>
            <View style={styles.userProfileLeft}>
              <View style={styles.userAvatarCircle}>
                <Text style={styles.userAvatarText}>
                  {(currentUser.name ? currentUser.name[0] : 'U').toUpperCase()}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <View style={styles.userNameRow}>
                  <Text style={styles.userNameText} numberOfLines={1}>
                    {currentUser.name || 'Account User'}
                  </Text>
                  <View style={styles.onlineBadge}>
                    <Text style={styles.onlineBadgeText}>● Logged In</Text>
                  </View>
                </View>
                <Text style={styles.userPhoneText}>
                  +91 {currentUser.phone || '9876543210'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogoutPress}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="log-out-outline" size={16} color="#DC2626" style={{ marginRight: 4 }} />
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.loginPromptCard, Shadows.sm]}
            onPress={openLoginModal}
            activeOpacity={0.85}
          >
            <View style={styles.loginPromptLeft}>
              <Image source={AppImages.logo} style={styles.loginLogo} resizeMode="contain" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={styles.loginPromptTitle}>Sign In / Create Account</Text>
                <Text style={styles.loginPromptSub}>Create an account or log in to backup your ledger</Text>
              </View>
            </View>
            <View style={styles.loginArrowBtn}>
              <Text style={styles.loginArrowBtnText}>Sign In</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        )}

        {/* Feedback on WhatsApp Button */}
        <TouchableOpacity
          style={[styles.feedbackAppCard, Shadows.sm]}
          onPress={() => setIsFeedbackModalOpen(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Send Feedback on WhatsApp, We value your suggestions & bug reports."
        >
          <View style={styles.feedbackAppLeft}>
            <View style={styles.feedbackIconWrap}>
              <Ionicons name="chatbubbles" size={22} color="#25D366" />
            </View>
            <View style={styles.feedbackTextWrap}>
              <View style={styles.feedbackTitleRow}>
                <Text style={styles.feedbackAppTitle}>Feedback & Suggestions</Text>
                <View style={styles.waPillBadge}>
                  <Ionicons name="logo-whatsapp" size={10} color="#FFFFFF" style={{ marginRight: 3 }} />
                  <Text style={styles.waPillBadgeText}>WhatsApp</Text>
                </View>
              </View>
              <Text style={styles.feedbackAppSubtitle}>
                We value your feedback! Share suggestions or bugs.
              </Text>
            </View>
          </View>
          <View style={styles.feedbackChevronWrap}>
            <Ionicons name="chevron-forward" size={18} color="#059669" />
          </View>
        </TouchableOpacity>

        {/* Monthly Budget Spending Tracker Card */}
        <TouchableOpacity
          style={[styles.budgetTrackerCard, Shadows.sm]}
          onPress={() => setIsBudgetModalOpen(true)}
          activeOpacity={0.85}
        >
          <View style={styles.budgetCardHeader}>
            <View style={styles.budgetCardHeaderLeft}>
              <View style={styles.budgetIconWrap}>
                <Ionicons name="pie-chart" size={20} color="#059669" />
              </View>
              <View>
                <Text style={styles.budgetCardTitle}>Monthly Budget</Text>
                <Text style={styles.budgetCardMonth}>{currentMonthName}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.budgetEditPill}
              onPress={() => setIsBudgetModalOpen(true)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={monthlyBudget > 0 ? 'create-outline' : 'add'}
                size={14}
                color="#059669"
                style={{ marginRight: 3 }}
              />
              <Text style={styles.budgetEditPillText}>
                {monthlyBudget > 0 ? 'Adjust' : 'Set Target'}
              </Text>
            </TouchableOpacity>
          </View>

          {monthlyBudget > 0 ? (
            <View style={styles.budgetActiveContent}>
              <View style={styles.budgetFiguresRow}>
                <View>
                  <Text style={styles.budgetSublabel}>Spent This Month</Text>
                  <Text style={[styles.budgetSpentAmount, isOverBudget && { color: '#DC2626' }]}>
                    {formatCurrency(monthSpend.spent)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.budgetSublabel}>Monthly Target</Text>
                  <Text style={styles.budgetTargetAmount}>
                    {formatCurrency(monthlyBudget)}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.budgetProgressBarBg}>
                <View
                  style={[
                    styles.budgetProgressBarFill,
                    {
                      width: `${budgetSpentPercent}%`,
                      backgroundColor: isOverBudget
                        ? '#EF4444'
                        : budgetSpentPercent > 80
                        ? '#F59E0B'
                        : '#10B981',
                    },
                  ]}
                />
              </View>

              <View style={styles.budgetFooterRow}>
                <Text style={[styles.budgetStatusText, isOverBudget && styles.budgetStatusOverText]}>
                  {isOverBudget
                    ? `⚠️ Over budget by ${formatCurrency(monthSpend.spent - monthlyBudget)}`
                    : `✓ ${formatCurrency(monthlyBudget - monthSpend.spent)} remaining (${Math.round(budgetSpentPercent)}% spent)`}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
              </View>
            </View>
          ) : (
            <View style={styles.budgetEmptyContent}>
              <View style={styles.budgetEmptyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.budgetEmptySpent}>
                    Spent this month: <Text style={{ fontWeight: 'bold', color: Colors.text }}>{formatCurrency(monthSpend.spent)}</Text>
                  </Text>
                  <Text style={styles.budgetEmptyHint}>
                    Set a target to keep your spending in check
                  </Text>
                </View>
                <View style={styles.setBudgetBtn}>
                  <Text style={styles.setBudgetBtnText}>Set Target &rarr;</Text>
                </View>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Preferences */}
        {renderSection('PREFERENCES', [
          {
            icon: 'globe-outline',
            iconColor: '#2563EB',
            iconBg: '#EFF6FF',
            label: 'Currency & Country',
            sublabel: `${currency?.name || 'India'} (${currency?.code || 'INR'} - ${currency?.symbol || '₹'})`,
            rightText: `${currency?.flag || '🇮🇳'} ${currency?.symbol || '₹'}`,
            onPress: () => setIsCurrencyModalOpen(true),
          },
        ])}

        {/* Tools & Utilities */}
        {renderSection('TOOLS & UTILITIES', [
          {
            icon: 'pie-chart-outline',
            iconColor: '#059669',
            iconBg: '#ECFDF5',
            label: 'Monthly Budget Goal',
            sublabel: monthlyBudget > 0
              ? `Limit: ${formatCurrency(monthlyBudget)} • ${isOverBudget ? 'Over budget' : `${formatCurrency(Math.max(0, monthlyBudget - monthSpend.spent))} left`}`
              : 'Set monthly spending limit to manage expenses',
            rightText: monthlyBudget > 0 ? formatCurrency(monthlyBudget) : 'Set',
            onPress: () => setIsBudgetModalOpen(true),
          },
          {
            icon: 'calculator-outline',
            iconColor: '#2563EB',
            iconBg: '#EFF6FF',
            label: 'EMI & Loan Calculator',
            sublabel: 'Calculate monthly loan installments & interest',
            onPress: () => setIsEmiModalOpen(true),
          },
          {
            icon: 'document-text-outline',
            iconColor: '#7C3AED',
            iconBg: '#F5F3FF',
            label: 'Export Statement (PDF & CSV)',
            sublabel: 'Download or share full transactions statement',
            onPress: () => setIsExportPdfOpen(true),
          },
        ])}

        {/* Master Management */}
        {renderSection('MANAGEMENT', [
          {
            icon: 'grid-outline',
            iconColor: Colors.accent,
            iconBg: Colors.accentLight,
            label: 'Manage Categories',
            sublabel: 'View defaults and create custom categories',
            onPress: () => setIsManageCategoriesOpen(true),
          },
          {
            icon: 'people-outline',
            iconColor: Colors.online,
            iconBg: Colors.onlineLight,
            label: 'Manage Parties',
            sublabel: 'Customer & supplier contact list',
            onPress: () => setIsManagePartiesOpen(true),
          },
        ])}

        {/* Data & Backup */}
        {renderSection('DATA & BACKUP', [
          {
            icon: 'settings-outline',
            iconColor: Colors.primary,
            iconBg: Colors.surfaceSubtle,
            label: 'Backup Settings',
            sublabel: 'Configure automatic backup interval, timing & retention',
            onPress: openBackupSettings,
          },
          {
            icon: isLoggedIn ? 'cloud-done-outline' : 'lock-closed-outline',
            iconColor: isLoggedIn ? Colors.online : '#D97706',
            iconBg: isLoggedIn ? Colors.onlineLight : '#FEF3C7',
            label: isLoggedIn ? 'Cloud Backup & Sync' : 'Cloud Backup (Login Required)',
            sublabel: isLoggedIn
              ? 'Live sync status, image schedule & metrics'
              : '🔒 Login to your account to enable automatic cloud backup',
            rightText: isLoggedIn ? 'Enabled ✓' : 'Disabled',
            onPress: isLoggedIn ? openBackupReport : openLoginModal,
          },
          {
            icon: 'cloud-download-outline',
            iconColor: Colors.primary,
            iconBg: Colors.surfaceSubtle,
            label: 'Import My Data',
            sublabel: 'Restore complete SQLite database & photos from cloud backup',
            onPress: isLoggedIn ? openBackupReport : openLoginModal,
          },
        ])}

        {/* App Info & Feedback */}
        {renderSection('ABOUT & SUPPORT', [
          {
            icon: 'chatbubbles-outline',
            iconColor: '#25D366',
            iconBg: '#DCFCE7',
            label: 'Send Feedback on WhatsApp',
            sublabel: 'Direct suggestions, bug reports & support (+91 8651615629)',
            rightText: 'WhatsApp',
            onPress: () => setIsFeedbackModalOpen(true),
          },
          {
            icon: 'information-circle-outline',
            label: 'About Expense & Khata',
            sublabel: `v${BrandConfig.version} (Expo SDK 54 Offline-First)`,
            rightText: isDeveloperMode ? '👨‍💻 Developer' : undefined,
            showChevron: false,
            onPress: handleDeveloperTap,
          },
          {
            icon: 'shield-checkmark-outline',
            label: '100% Privacy Guarantee',
            sublabel: 'All data is encrypted & stored on your device',
            showChevron: false,
          },
          {
            icon: 'help-circle-outline',
            label: 'Help & Usage Guide',
            sublabel: 'How to use Gave/Got & Khata ledger',
            onPress: () => {
              Alert.alert(
                'How to use Expense & Khata',
                '• "You Gave" records money going out (Expense or Credit given to a party).\n• "You Got" records money coming in (Income or Payment received from a party).\n• "You Will Get" means a party owes you money.\n• "You Will Give" means you owe a party money.\n• Everything is stored instantly on your local SQLite database.'
              );
            },
          },
        ])}

        {/* Developer Stress Testing Section (Hidden by default; unlocked via 5 taps) */}
        {isDeveloperMode &&
          renderSection('👨‍💻 DEVELOPER STRESS TEST', [
            {
              icon: 'flash-outline',
              iconColor: '#7C3AED',
              iconBg: '#F5F3FF',
              label: 'Generate Stress Test Data',
              sublabel: 'Insert 1k, 10k, 50k, or 100k transactions',
              rightText: 'Run Test',
              onPress: handleGenerateStressData,
            },
            {
              icon: 'speedometer-outline',
              iconColor: '#059669',
              iconBg: '#ECFDF5',
              label: 'Run SQLite Speed Benchmark',
              sublabel: 'Measure query, aggregation & pagination speed (ms)',
              rightText: 'Benchmark',
              onPress: handleRunBenchmark,
            },
            {
              icon: 'analytics-outline',
              iconColor: Colors.primary,
              iconBg: Colors.surfaceSubtle,
              label: 'Check Database Record Counts',
              sublabel: 'View test vs real transaction counts',
              onPress: handleCheckStressData,
            },
            {
              icon: 'trash-outline',
              iconColor: Colors.danger,
              iconBg: '#FEF2F2',
              isDestructive: true,
              label: 'Delete All Test Transactions',
              sublabel: 'Safely removes test records only (real data preserved)',
              onPress: handleDeleteStressData,
            },
            {
              icon: 'lock-closed-outline',
              iconColor: '#6B7280',
              iconBg: '#F3F4F6',
              label: 'Lock Developer Mode',
              sublabel: 'Hide this stress test section from regular view',
              onPress: handleLockDeveloperMode,
            },
          ])}

        {/* App Branding Footer (Tap 5 times to unlock Developer Mode) */}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleDeveloperTap}
          style={styles.brandingFooter}
        >
          <Image source={AppImages.logo} style={styles.brandingLogo} resizeMode="contain" />
          <Text style={styles.brandingTitle}>{BrandConfig.appName}</Text>
          <Text style={styles.brandingVersion}>Version {BrandConfig.version}</Text>
          <Text style={styles.brandingTagline}>{BrandConfig.tagline}</Text>
          {isDeveloperMode && (
            <View style={styles.devModeUnlockedBadge}>
              <Ionicons name="code-slash" size={13} color="#7C3AED" />
              <Text style={styles.devModeUnlockedText}>Developer Mode Unlocked</Text>
            </View>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Stress Test Progress Modal */}
      <Modal visible={isStressGenerating} transparent animationType="fade">
        <View style={styles.stressModalBackdrop}>
          <View style={[styles.stressModalCard, Shadows.lg]}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.stressModalTitle}>
              Generating {stressProgress.total.toLocaleString('en-IN')} Records
            </Text>
            <Text style={styles.stressModalSubtitle}>
              Inserting test records across 365 days into local SQLite...
            </Text>
            <View style={styles.stressProgressBarBg}>
              <View style={[styles.stressProgressBarFill, { width: `${stressProgress.percentage}%` }]} />
            </View>
            <Text style={styles.stressProgressCount}>
              {stressProgress.current.toLocaleString('en-IN')} / {stressProgress.total.toLocaleString('en-IN')} ({stressProgress.percentage}%)
            </Text>
          </View>
        </View>
      </Modal>

      {/* Floating Developer Mode Feedback Pill */}
      {devToastMessage ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.devToastContainer,
            {
              opacity: devToastAnim,
              transform: [
                {
                  translateY: devToastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Ionicons name="terminal-outline" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.devToastText}>{devToastMessage}</Text>
        </Animated.View>
      ) : null}

      {/* Direct WhatsApp Feedback Modal */}
      <FeedbackScreen
        visible={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
      />

      {/* Country & Currency Selection Modal */}
      <CurrencySelectModal
        visible={isCurrencyModalOpen}
        onClose={() => setIsCurrencyModalOpen(false)}
        currentCurrency={currency}
        onSelectCurrency={changeCurrency}
      />

      {/* Monthly Budget Target Modal */}
      <MonthlyBudgetModal
        visible={isBudgetModalOpen}
        onClose={() => setIsBudgetModalOpen(false)}
        currentBudget={monthlyBudget}
        onSaveBudget={handleSaveBudget}
        currentSpent={monthSpend.spent}
        currency={currency}
      />

      {/* EMI & Loan Calculator Modal */}
      <EmiCalculatorModal
        visible={isEmiModalOpen}
        onClose={() => setIsEmiModalOpen(false)}
        currency={currency}
      />

      {/* Export Statement PDF Modal */}
      <ExportPdfModal
        visible={isExportPdfOpen}
        onClose={() => setIsExportPdfOpen(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 140,
    gap: Spacing.lg,
  },
  budgetTrackerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  budgetCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  budgetCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  budgetIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  budgetCardTitle: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
  },
  budgetCardMonth: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  budgetEditPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  budgetEditPillText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: '#059669',
  },
  budgetActiveContent: {
    marginTop: Spacing.xs,
    gap: 8,
  },
  budgetFiguresRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  budgetSublabel: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  budgetSpentAmount: {
    fontSize: 20,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
    marginTop: 2,
  },
  budgetTargetAmount: {
    fontSize: 16,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  budgetProgressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  budgetProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  budgetStatusText: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.semibold,
    color: '#059669',
  },
  budgetStatusOverText: {
    color: '#DC2626',
    fontWeight: Typography.fontWeights.bold,
  },
  budgetEmptyContent: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  budgetEmptyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetEmptySpent: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
  },
  budgetEmptyHint: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  setBudgetBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
  },
  setBudgetBtnText: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  section: {
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginLeft: Spacing.xs,
    marginBottom: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  menuItemText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
  },
  menuItemSublabel: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  userProfileCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    backgroundColor: '#F0FDF4',
  },
  userProfileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
  },
  userAvatarCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.gotDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userAvatarText: {
    fontSize: 18,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userNameText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  onlineBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  onlineBadgeText: {
    fontSize: 9.5,
    fontWeight: Typography.fontWeights.bold,
    color: '#15803D',
  },
  userPhoneText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
    fontWeight: Typography.fontWeights.medium,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  logoutBtnText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: '#DC2626',
  },
  loginPromptCard: {
    backgroundColor: '#EFF6FF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  loginPromptLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  loginIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginLogo: {
    width: 42,
    height: 42,
    borderRadius: 10,
  },
  brandingFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl,
    marginTop: Spacing.sm,
  },
  brandingLogo: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginBottom: Spacing.xs,
  },
  brandingTitle: {
    fontSize: Typography.fontSizes.sm + 1,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  brandingVersion: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  brandingTagline: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  devModeUnlockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F3FF',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: '#DDD6FE',
  },
  devModeUnlockedText: {
    fontSize: Typography.fontSizes.xs,
    color: '#7C3AED',
    fontWeight: Typography.fontWeights.semibold,
    marginLeft: 6,
  },
  devToastContainer: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: BorderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '90%',
    ...Shadows.lg,
    zIndex: 9999,
  },
  devToastText: {
    color: '#F8FAFC',
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.medium,
    textAlign: 'center',
  },
  loginPromptTitle: {
    fontSize: Typography.fontSizes.sm + 1,
    fontWeight: Typography.fontWeights.bold,
    color: '#1E40AF',
  },
  loginPromptSub: {
    fontSize: Typography.fontSizes.xs,
    color: '#3B82F6',
    marginTop: 2,
  },
  loginArrowBtn: {
    backgroundColor: Colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.lg,
    gap: 4,
  },
  loginArrowBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
  },
  menuItemRightText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
  },
  stressModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  stressModalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  stressModalTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  stressModalSubtitle: {
    fontSize: Typography.fontSizes.xs + 1,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  stressProgressBarBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  stressProgressBarFill: {
    height: '100%',
    backgroundColor: '#7C3AED',
    borderRadius: BorderRadius.full,
  },
  stressProgressCount: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
    color: '#7C3AED',
  },
  supportAppCard: {
    backgroundColor: '#EEF2FF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  supportAppLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  supportIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  supportTextWrap: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  supportTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  supportAppTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: '#1E1B4B',
  },
  upiBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#A5B4FC',
  },
  upiBadgeText: {
    fontSize: 9.5,
    fontWeight: Typography.fontWeights.bold,
    color: '#4338CA',
    letterSpacing: 0.5,
  },
  supportAppSubtitle: {
    fontSize: Typography.fontSizes.xs,
    color: '#4F46E5',
    marginTop: 2,
    fontWeight: Typography.fontWeights.medium,
  },
  supportChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackAppCard: {
    backgroundColor: '#F0FDF4',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  feedbackAppLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  feedbackIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackTextWrap: {
    marginLeft: Spacing.md,
    flex: 1,
  },
  feedbackTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  feedbackAppTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: '#064E3B',
  },
  waPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: BorderRadius.full,
  },
  waPillBadgeText: {
    fontSize: 9.5,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
    letterSpacing: 0.4,
  },
  feedbackAppSubtitle: {
    fontSize: Typography.fontSizes.xs,
    color: '#059669',
    marginTop: 2,
    fontWeight: Typography.fontWeights.medium,
  },
  feedbackChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
