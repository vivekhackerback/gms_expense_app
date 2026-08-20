import React, { useState } from 'react';
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
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { Header } from '../components/common/Header';

export const MoreScreen = () => {
  const {
    syncStats,
    isSyncing,
    triggerSync,
    networkStatus,
    setIsManageCategoriesOpen,
    setIsManagePartiesOpen,
    openBackupReport,
    currentUser,
    isLoggedIn,
    openLoginModal,
    updateUserProfile,
    logoutUser,
    refreshAll,
  } = useApp();

  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

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
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of your account on this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await logoutUser();
            Alert.alert('Logged Out', 'You have been logged out successfully.');
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
              <View style={styles.loginIconWrap}>
                <Ionicons name="person" size={22} color={Colors.primary} />
              </View>
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

        {/* Sync Status Banner */}
        <TouchableOpacity
          style={[styles.syncStatusCard, Shadows.sm]}
          onPress={openBackupReport}
          activeOpacity={0.85}
        >
          <View style={styles.syncStatusHeader}>
            <View style={styles.syncIconContainer}>
              <Ionicons
                name={syncStats.pendingCount > 0 ? 'cloud-upload-outline' : 'checkmark-circle-outline'}
                size={28}
                color={syncStats.pendingCount > 0 ? '#B45309' : Colors.got}
              />
            </View>
            <View style={styles.syncTextContainer}>
              <Text style={styles.syncStateHeading}>
                {syncStats.pendingCount > 0
                  ? `${syncStats.pendingCount} transactions pending`
                  : 'All data is saved & synchronized'}
              </Text>
              <Text style={styles.syncStateSub}>
                Network: {networkStatus.isConnected ? 'Connected' : 'Offline'} · Tap for Backup Report &rarr;
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
              <Text style={styles.viewReportBtnText}>View Report</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

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
            icon: 'cloud-done-outline',
            iconColor: Colors.online,
            iconBg: Colors.onlineLight,
            label: 'Backup & Sync Report',
            sublabel: 'Live sync status, image schedule & metrics',
            onPress: openBackupReport,
          },
        ])}

        {/* App Info */}
        {renderSection('ABOUT & SUPPORT', [
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
      </ScrollView>
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
  syncStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  syncIconContainer: {
    marginRight: Spacing.md,
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
});
