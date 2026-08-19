import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';
import { Header } from '../components/common/Header';
import { TransactionList } from '../components/transaction/TransactionList';

export const HomeScreen = () => {
  const {
    balances,
    recentTransactions,
    refreshAll,
    openTransactionDetails,
    setActiveTab,
    openAddTransaction,
  } = useApp();

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    refreshAll();
    setRefreshing(false);
  };

  const renderDashboardHeader = () => (
    <View style={styles.dashboardContainer}>
      {/* 1. Total Balance Card */}
      <View style={[styles.totalBalanceCard, Shadows.md]}>
        <Text style={styles.totalBalanceLabel}>Total Balance</Text>
        <Text
          style={[
            styles.totalBalanceAmount,
            { color: balances.totalBalance >= 0 ? Colors.textPrimary : Colors.danger },
          ]}
        >
          {formatCurrency(balances.totalBalance)}
        </Text>

        {/* Quick Gave / Got Action Buttons right on hero card for KhataBook speed */}
        <View style={styles.quickActionRow}>
          <TouchableOpacity
            style={[styles.quickActionButton, styles.quickActionGave]}
            onPress={() => openAddTransaction({ defaultType: 'gave' })}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-up-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.quickActionText}>You Gave</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionButton, styles.quickActionGot]}
            onPress={() => openAddTransaction({ defaultType: 'got' })}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-down-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.quickActionText}>You Got</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 2. Cash & Online Breakdown */}
      <View style={styles.twoColumnRow}>
        <View style={[styles.miniCard, styles.cashCard, Shadows.sm]}>
          <View style={styles.miniCardHeader}>
            <View style={[styles.miniDot, { backgroundColor: Colors.cash }]} />
            <Text style={styles.miniCardLabel}>Cash Balance</Text>
          </View>
          <Text style={[styles.miniCardAmount, { color: '#B45309' }]}>
            {formatCurrency(balances.cashBalance)}
          </Text>
          <Text style={styles.miniCardSub}>
            Got {formatCurrency(balances.cashGot)} · Gave {formatCurrency(balances.cashGave)}
          </Text>
        </View>

        <View style={[styles.miniCard, styles.onlineCard, Shadows.sm]}>
          <View style={styles.miniCardHeader}>
            <View style={[styles.miniDot, { backgroundColor: Colors.online }]} />
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

      {/* 3. You Got & You Gave Summary */}
      <View style={styles.twoColumnRow}>
        <View style={[styles.summaryCard, styles.gotSummaryCard, Shadows.sm]}>
          <View style={styles.summaryIconRow}>
            <Ionicons name="arrow-down-circle" size={20} color={Colors.got} />
            <Text style={[styles.summaryLabel, { color: Colors.gotDark }]}>You Got</Text>
          </View>
          <Text style={[styles.summaryAmount, { color: Colors.got }]}>
            {formatCurrency(balances.totalGot)}
          </Text>
        </View>

        <View style={[styles.summaryCard, styles.gaveSummaryCard, Shadows.sm]}>
          <View style={styles.summaryIconRow}>
            <Ionicons name="arrow-up-circle" size={20} color={Colors.gave} />
            <Text style={[styles.summaryLabel, { color: Colors.gaveDark }]}>You Gave</Text>
          </View>
          <Text style={[styles.summaryAmount, { color: Colors.gave }]}>
            {formatCurrency(balances.totalGave)}
          </Text>
        </View>
      </View>

      {/* Recent Transactions Section Title */}
      <View style={styles.recentHeaderRow}>
        <Text style={styles.recentTitle}>Recent Transactions</Text>
        <TouchableOpacity
          onPress={() => setActiveTab('Transactions')}
          style={styles.viewAllBtn}
          activeOpacity={0.7}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={14} color={Colors.primaryLight} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Expense & Khata" />

      <TransactionList
        transactions={recentTransactions}
        onTransactionPress={(tx) => openTransactionDetails(tx.id)}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListHeaderComponent={renderDashboardHeader()}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>No Transactions Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "You Gave", "You Got" or the floating + button to record your first transaction!
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  dashboardContainer: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
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
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.lg,
  },
  quickActionGave: {
    backgroundColor: Colors.gave,
  },
  quickActionGot: {
    backgroundColor: Colors.got,
  },
  quickActionText: {
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
  cashCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.cash,
  },
  onlineCard: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.online,
  },
  miniCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  miniDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  miniCardLabel: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  miniCardAmount: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    marginVertical: 2,
  },
  miniCardSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  summaryCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
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
    gap: 6,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
  summaryAmount: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  recentTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    padding: 4,
  },
  viewAllText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.primaryLight,
    fontWeight: Typography.fontWeights.semibold,
  },
  emptyState: {
    padding: Spacing.xxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
});
