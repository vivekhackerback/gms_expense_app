import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { Header } from '../components/common/Header';
import { exportTransactionsToCSV, exportFullJSONBackup } from '../services/exportService';
import { wipeAndResetDatabase } from '../database/queries';

export const MoreScreen = () => {
  const {
    syncStats,
    isSyncing,
    triggerSync,
    networkStatus,
    setIsManageCategoriesOpen,
    setIsManagePartiesOpen,
    refreshAll,
  } = useApp();

  const handleManualSync = async () => {
    const res = await triggerSync();
    if (res) {
      Alert.alert('Sync Status', res.message);
    }
  };

  const handleExportCSV = async () => {
    await exportTransactionsToCSV();
  };

  const handleExportJSON = async () => {
    await exportFullJSONBackup();
  };

  const handleResetData = () => {
    Alert.alert(
      'Reset All Data',
      'This will erase all local transactions, custom categories, and parties. This action cannot be undone. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Everything',
          style: 'destructive',
          onPress: () => {
            wipeAndResetDatabase();
            refreshAll();
            Alert.alert('Data Reset', 'All transactions and local data have been cleared.');
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
        {/* Sync Status Banner */}
        <View style={[styles.syncStatusCard, Shadows.sm]}>
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
                Network: {networkStatus.isConnected ? 'Connected' : 'Offline'} · Local SQLite Active
              </Text>
            </View>
          </View>

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
        </View>

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
            icon: 'document-text-outline',
            iconColor: Colors.got,
            iconBg: Colors.gotBg,
            label: 'Export to CSV',
            sublabel: 'Download spreadsheet report',
            onPress: handleExportCSV,
          },
          {
            icon: 'archive-outline',
            iconColor: '#B45309',
            iconBg: Colors.cashBg,
            label: 'Backup Data (JSON)',
            sublabel: 'Full offline database backup',
            onPress: handleExportJSON,
          },
          {
            icon: 'trash-bin-outline',
            iconColor: Colors.danger,
            iconBg: Colors.gaveBg,
            label: 'Reset All Data',
            sublabel: 'Wipe all transactions and local ledger',
            isDestructive: true,
            onPress: handleResetData,
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
    paddingBottom: 90,
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
  syncTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
  },
  syncTriggerBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.sm,
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
  menuItemRightText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
  },
});
