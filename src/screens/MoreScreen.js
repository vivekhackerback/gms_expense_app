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
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { Header } from '../components/common/Header';
import { AppImages, BrandConfig } from '../constants/assets';
import {
  generateStressTestTransactions,
  deleteStressTestTransactions,
  getStressTestStatus,
} from '../services/stressTestService';
import { SupportAppModal } from '../components/modals/SupportAppModal';
import { FeedbackScreen } from './FeedbackScreen';
import { syncAndGetLatestUpiConfig } from '../services/upiPaymentService';

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
  } = useApp();

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Heartbeat pulse animation to attract user attention
  const heartScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(heartScale, {
          toValue: 1.22,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [heartScale]);

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

  // Developer Stress Test States & Handlers
  const [isStressGenerating, setIsStressGenerating] = useState(false);
  const [stressProgress, setStressProgress] = useState({ current: 0, total: 50000, percentage: 0 });

  const handleGenerateStressData = () => {
    Alert.alert(
      'Generate 50,000 Test Transactions',
      'This will insert 50,000 realistic transactions spread across the past 365 days into your local SQLite database for stress testing. Your existing transactions will not be modified.\n\nDo you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate 50,000 Records',
          onPress: async () => {
            setIsStressGenerating(true);
            setStressProgress({ current: 0, total: 50000, percentage: 0 });
            try {
              const startTime = Date.now();
              const count = await generateStressTestTransactions({
                targetCount: 50000,
                chunkSize: 5000,
                onProgress: (p) => setStressProgress(p),
              });
              const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
              setIsStressGenerating(false);
              if (refreshAll) refreshAll();
              Alert.alert(
                'Stress Test Data Ready!',
                `Successfully created exactly ${count.toLocaleString('en-IN')} test transactions in ${durationSec}s.\n\nNow open the Transactions screen to test 60fps scrolling, pagination, and sticky dates!`
              );
            } catch (err) {
              setIsStressGenerating(false);
              Alert.alert('Error', 'Failed to generate test data: ' + err.message);
            }
          },
        },
      ]
    );
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

        {/* Support the App Button */}
        <TouchableOpacity
          style={[styles.supportAppCard, Shadows.sm]}
          onPress={() => {
            // Trigger background upi_update check on every click without delaying modal open
            syncAndGetLatestUpiConfig().catch(() => {});
            setIsSupportModalOpen(true);
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Support the App, Love this app? Support its development."
        >
          <View style={styles.supportAppLeft}>
            <View style={styles.supportIconWrap}>
              <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                <Ionicons name="heart" size={22} color="#E11D48" />
              </Animated.View>
            </View>
            <View style={styles.supportTextWrap}>
              <View style={styles.supportTitleRow}>
                <Text style={styles.supportAppTitle}>Support the App</Text>
                <View style={styles.upiBadge}>
                  <Text style={styles.upiBadgeText}>UPI</Text>
                </View>
              </View>
              <Text style={styles.supportAppSubtitle}>
                Love this app? Support its development.
              </Text>
            </View>
          </View>
          <View style={styles.supportChevronWrap}>
            <Ionicons name="chevron-forward" size={18} color="#4F46E5" />
          </View>
        </TouchableOpacity>

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

        {/* Sync Status Banner */}
        {isLoggedIn ? (
          <TouchableOpacity
            style={[styles.syncStatusCard, Shadows.sm]}
            onPress={openBackupReport}
            activeOpacity={0.85}
          >
            <View style={styles.syncStatusHeader}>
              <View style={styles.syncIconContainer}>
                <Ionicons
                  name={
                    (syncStats.pendingCount > 0 || (syncStats.pendingImagesCount || 0) > 0)
                      ? 'cloud-upload-outline'
                      : 'checkmark-circle-outline'
                  }
                  size={28}
                  color={
                    (syncStats.pendingCount > 0 || (syncStats.pendingImagesCount || 0) > 0)
                      ? '#B45309'
                      : Colors.got
                  }
                />
              </View>
              <View style={styles.syncTextContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.syncStateHeading}>
                    {syncStats.pendingCount > 0 && (syncStats.pendingImagesCount || 0) > 0
                      ? `${syncStats.pendingCount} txs & ${syncStats.pendingImagesCount} photos pending`
                      : syncStats.pendingCount > 0
                      ? `${syncStats.pendingCount} transactions pending`
                      : (syncStats.pendingImagesCount || 0) > 0
                      ? `${syncStats.pendingImagesCount} receipt photos pending`
                      : 'All data is saved & synchronized'}
                  </Text>
                  <View style={styles.activePill}>
                    <Text style={styles.activePillText}>Enabled ✓</Text>
                  </View>
                </View>
                <Text style={styles.syncStateSub}>
                  Network: {networkStatus.isConnected ? 'Connected' : 'Offline'} · Tap for Dashboard &rarr;
                </Text>
              </View>
            </View>

            <View style={styles.syncCardActionRow}>
              <TouchableOpacity
                style={[styles.syncTriggerBtn, isSyncing && { opacity: 0.7 }]}
                onPress={handleManualSync}
                disabled={isSyncing}
                activeOpacity={0.8}
              >
                <Ionicons name="refresh-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.syncTriggerBtnText}>
                  {isSyncing ? 'Syncing...' : 'Sync Now'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewReportBtn}
                onPress={openBackupReport}
                activeOpacity={0.7}
              >
                <Text style={styles.viewReportBtnText}>View Dashboard</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.syncStatusCard, styles.syncDisabledCard, Shadows.sm]}
            onPress={openLoginModal}
            activeOpacity={0.85}
          >
            <View style={styles.syncStatusHeader}>
              <View style={[styles.syncIconContainer, styles.lockIconContainer]}>
                <Ionicons name="lock-closed" size={26} color="#D97706" />
              </View>
              <View style={styles.syncTextContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={[styles.syncStateHeading, { color: '#92400E' }]}>
                    Cloud Backup is Disabled
                  </Text>
                  <View style={styles.disabledPill}>
                    <Text style={styles.disabledPillText}>Disabled</Text>
                  </View>
                </View>
                <Text style={styles.syncStateSub}>
                  Offline local storage only. Sign in to enable secure cloud backup &amp; multi-device sync.
                </Text>
              </View>
            </View>

            <View style={styles.syncCardActionRow}>
              <TouchableOpacity
                style={[styles.loginToBackupBtn, { flex: 1 }]}
                onPress={openLoginModal}
                activeOpacity={0.8}
              >
                <Ionicons name="log-in-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={styles.loginToBackupBtnText}>Log In to Enable Cloud Backup</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}

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
            sublabel: 'v1.0.0 (Expo SDK 54 Offline-First)',
            showChevron: false,
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

        {/* Developer Stress Testing Section */}
        {renderSection('DEVELOPER STRESS TEST', [
          {
            icon: 'flash-outline',
            iconColor: '#7C3AED',
            iconBg: '#F5F3FF',
            label: 'Generate 50,000 Test Transactions',
            sublabel: 'Stress-test Transaction History with 50,000 records',
            onPress: handleGenerateStressData,
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
            label: 'Delete 50,000 Test Transactions',
            sublabel: 'Safely removes test records only (real data preserved)',
            onPress: handleDeleteStressData,
          },
        ])}

        {/* App Branding Footer */}
        <View style={styles.brandingFooter}>
          <Image source={AppImages.logo} style={styles.brandingLogo} resizeMode="contain" />
          <Text style={styles.brandingTitle}>{BrandConfig.appName}</Text>
          <Text style={styles.brandingVersion}>Version {BrandConfig.version}</Text>
          <Text style={styles.brandingTagline}>{BrandConfig.tagline}</Text>
        </View>
      </ScrollView>

      {/* Stress Test Progress Modal */}
      <Modal visible={isStressGenerating} transparent animationType="fade">
        <View style={styles.stressModalBackdrop}>
          <View style={[styles.stressModalCard, Shadows.lg]}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.stressModalTitle}>Generating 50,000 Records</Text>
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

      {/* Support App UPI Modal */}
      <SupportAppModal
        visible={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
      />

      {/* Direct WhatsApp Feedback Modal */}
      <FeedbackScreen
        visible={isFeedbackModalOpen}
        onClose={() => setIsFeedbackModalOpen(false)}
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
  syncStatusCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  syncDisabledCard: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  syncStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  syncIconContainer: {
    marginRight: Spacing.md,
  },
  lockIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activePill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  activePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#15803D',
  },
  disabledPill: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  disabledPillText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B91C1C',
  },
  syncTextContainer: {
    flex: 1,
  },
  syncStateHeading: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  syncStateSub: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  syncCardActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  syncTriggerBtn: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  syncTriggerBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
  },
  loginToBackupBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D97706',
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  loginToBackupBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
  },
  viewReportBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSubtle,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewReportBtnText: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
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
