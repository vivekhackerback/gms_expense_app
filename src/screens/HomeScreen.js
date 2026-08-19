import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SectionList,
  RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { formatCurrency, formatDayNameFullDate } from '../utils/formatters';
import { Header } from '../components/common/Header';
import { TransactionRow } from '../components/transaction/TransactionRow';

export const HomeScreen = () => {
  const {
    balances,
    recentTransactions,
    openAddTransaction,
    openTransactionDetails,
    refreshAll,
    setActiveTab,
  } = useApp();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    refreshAll();
    setTimeout(() => setRefreshing(false), 300);
  };

  // Filter and group strictly for TODAY and YESTERDAY
  const sections = useMemo(() => {
    const today = new Date();
    const todayDateStr = today.toDateString();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateStr = yesterday.toDateString();

    const todayItems = [];
    const yesterdayItems = [];

    for (const tx of recentTransactions) {
      const txDateObj = new Date(tx.transactionDate || tx.createdAt);
      const txDateStr = txDateObj.toDateString();

      if (txDateStr === todayDateStr) {
        todayItems.push(tx);
      } else if (txDateStr === yesterdayDateStr) {
        yesterdayItems.push(tx);
      }
    }

    const result = [];
    if (todayItems.length > 0) {
      result.push({
        type: 'today',
        title: 'TODAY',
        fullDate: formatDayNameFullDate(today),
        data: todayItems,
      });
    }

    if (yesterdayItems.length > 0) {
      result.push({
        type: 'yesterday',
        title: 'YESTERDAY',
        fullDate: formatDayNameFullDate(yesterday),
        data: yesterdayItems,
      });
    }

    return result;
  }, [recentTransactions]);

  const hasRecentActivity = sections.length > 0;

  const renderDashboardHeader = () => (
    <View style={styles.dashboardContainer}>
      {/* 1. Total Balance Card */}
      <View style={[styles.totalBalanceCard, Shadows.sm]}>
        <Text style={styles.totalBalanceLabel}>Total Balance</Text>
        <Text
          style={[
            styles.totalBalanceAmount,
            {
              color:
                balances.totalBalance >= 0
                  ? Colors.balancePositive
                  : Colors.balanceNegative,
            },
          ]}
        >
          {formatCurrency(balances.totalBalance)}
        </Text>

        {/* Quick Add Buttons: You Gave / You Got */}
        <View style={styles.quickActionRow}>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.gaveButton, Shadows.sm]}
            onPress={() => openAddTransaction({ type: 'gave' })}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-up-circle" size={20} color="#FFFFFF" />
            <Text style={styles.gaveButtonText}>You Gave ₹</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, styles.gotButton, Shadows.sm]}
            onPress={() => openAddTransaction({ type: 'got' })}
            activeOpacity={0.85}
          >
            <Ionicons name="arrow-down-circle" size={20} color="#FFFFFF" />
            <Text style={styles.gotButtonText}>You Got ₹</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Mini Account Breakdown: Cash & Online */}
      <View style={styles.twoColumnRow}>
        {/* Cash Card */}
        <View style={[styles.miniCard, Shadows.sm]}>
          <View style={styles.miniCardHeader}>
            <Ionicons name="cash-outline" size={18} color="#B45309" />
            <Text style={styles.miniCardLabel}>Cash Balance</Text>
          </View>
          <Text style={[styles.miniCardAmount, { color: '#B45309' }]}>
            {formatCurrency(balances.cashBalance)}
          </Text>
          <Text style={styles.miniCardSub}>
            Got {formatCurrency(balances.cashGot)} · Gave {formatCurrency(balances.cashGave)}
          </Text>
        </View>

        {/* Online Card */}
        <View style={[styles.miniCard, Shadows.sm]}>
          <View style={styles.miniCardHeader}>
            <Ionicons name="card-outline" size={18} color="#1D4ED8" />
            <Text style={styles.miniCardLabel}>Online Balance</Text>
          </View>
          <Text style={[styles.miniCardAmount, { color: '#1D4ED8' }]}>
            {formatCurrency(balances.onlineBalance)}
          </Text>
          <Text style={styles.miniCardSub}>
            Got {formatCurrency(balances.onlineGot)} · Gave {formatCurrency(balances.onlineGave)}
          </Text>
        </View>
      </View>

      {/* 3. You Got Today & You Gave Today Summary */}
      <View style={styles.twoColumnRow}>
        <View style={[styles.summaryCard, styles.gotSummaryCard, Shadows.sm]}>
          <View style={styles.summaryIconRow}>
            <Ionicons name="arrow-down-circle" size={18} color={Colors.got} />
            <Text style={[styles.summaryLabel, { color: Colors.gotDark }]}>You Got Today</Text>
          </View>
          <Text style={[styles.summaryAmount, { color: Colors.got }]}>
            {formatCurrency(balances.todayGot || 0)}
          </Text>
        </View>

        <View style={[styles.summaryCard, styles.gaveSummaryCard, Shadows.sm]}>
          <View style={styles.summaryIconRow}>
            <Ionicons name="arrow-up-circle" size={18} color={Colors.gave} />
            <Text style={[styles.summaryLabel, { color: Colors.gaveDark }]}>You Gave Today</Text>
          </View>
          <Text style={[styles.summaryAmount, { color: Colors.gave }]}>
            {formatCurrency(balances.todayGave || 0)}
          </Text>
        </View>
      </View>

      {/* Recent Transactions Section Title */}
      <View style={styles.recentHeaderRow}>
        <View style={styles.recentTitleGroup}>
          <Text style={styles.recentTitle}>Recent Transactions</Text>
          <Text style={styles.recentSubtitle}>Today & Yesterday</Text>
        </View>
        <TouchableOpacity
          onPress={() => setActiveTab('Transactions')}
          style={styles.viewAllBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.viewAllText}>View All History</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSectionHeader = ({ section }) => {
    const isToday = section.type === 'today';

    return (
      <View style={styles.dateGroupHeaderWrap}>
        <View
          style={[
            styles.dateBadgeContainer,
            isToday ? styles.todayBadgeContainer : styles.yesterdayBadgeContainer,
          ]}
        >
          <View
            style={[
              styles.statusDot,
              isToday ? styles.todayDot : styles.yesterdayDot,
            ]}
          />
          <Text
            style={[
              styles.dateBadgeText,
              isToday ? styles.todayBadgeText : styles.yesterdayBadgeText,
            ]}
          >
            {section.title}
          </Text>
        </View>
        <Text style={styles.fullDateText}>{section.fullDate}</Text>
      </View>
    );
  };

  const renderItem = ({ item, section }) => {
    const isYesterdayItem = section.type === 'yesterday';
    return (
      <TransactionRow
        item={item}
        onPress={() => openTransactionDetails(item.id)}
        isRecentYesterday={isYesterdayItem}
      />
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Expense & Khata" />

      <SectionList
        sections={sections}
        keyExtractor={(item) => String(item.id || item.uuid)}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={renderDashboardHeader()}
        ListEmptyComponent={
          !hasRecentActivity ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={44} color={Colors.border} />
              <Text style={styles.emptyTitle}>No Transactions for Today or Yesterday</Text>
              <Text style={styles.emptySubtitle}>
                Tap "You Gave" or "You Got" above to quickly record a transaction!
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingBottom: 140, // Generous clearance for floating button & bottom tabs
  },
  dashboardContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xs,
  },
  totalBalanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
  },
  totalBalanceLabel: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  totalBalanceAmount: {
    fontSize: Typography.fontSizes.amountHero,
    fontWeight: Typography.fontWeights.bold,
    letterSpacing: -0.5,
    marginBottom: Spacing.lg,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  gaveButton: {
    backgroundColor: Colors.gave,
  },
  gotButton: {
    backgroundColor: Colors.got,
  },
  gaveButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  gotButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  twoColumnRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  miniCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  miniCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  miniCardLabel: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  miniCardAmount: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    marginBottom: 2,
  },
  miniCardSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  summaryCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  gotSummaryCard: {
    backgroundColor: Colors.gotBg,
    borderColor: Colors.gotLight,
  },
  gaveSummaryCard: {
    backgroundColor: Colors.gaveBg,
    borderColor: Colors.gaveLight,
  },
  summaryIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
  },
  summaryAmount: {
    fontSize: Typography.fontSizes.xl - 1,
    fontWeight: Typography.fontWeights.bold,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
    paddingHorizontal: 2,
  },
  recentTitleGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  recentTitle: {
    fontSize: Typography.fontSizes.md + 1,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  recentSubtitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    fontWeight: Typography.fontWeights.medium,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  viewAllText: {
    fontSize: Typography.fontSizes.xs + 1,
    color: Colors.primary,
    fontWeight: Typography.fontWeights.bold,
  },
  // Distinct Date Section Headers for HomeScreen
  dateGroupHeaderWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm + 2,
    paddingBottom: 4,
  },
  dateBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs + 2,
    borderWidth: 1,
  },
  todayBadgeContainer: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  yesterdayBadgeContainer: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  todayDot: {
    backgroundColor: '#10B981',
  },
  yesterdayDot: {
    backgroundColor: '#64748B',
  },
  dateBadgeText: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
    letterSpacing: 0.8,
  },
  todayBadgeText: {
    color: '#065F46',
  },
  yesterdayBadgeText: {
    color: '#334155',
  },
  fullDateText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  emptyTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    marginBottom: 4,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Typography.fontSizes.xs + 1,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
