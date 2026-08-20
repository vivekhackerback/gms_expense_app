import React, { useState, useEffect, useCallback } from 'react';
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
import { formatCurrency, getDateRangePreset } from '../utils/formatters';
import { Header } from '../components/common/Header';
import { ExportPdfModal } from '../components/transaction/ExportPdfModal';
import { getReportsSummary, getCategoryBreakdown } from '../database/queries';
import { exportTransactionsToCSV } from '../services/exportService';

const PERIOD_TABS = [
  { id: 'today', label: 'Today' },
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'year', label: 'This Year' },
  { id: 'all', label: 'All Time' },
];

export const ReportsScreen = () => {
  const { isAddTransactionOpen, viewingTransactionId } = useApp();

  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [summary, setSummary] = useState({
    totalGot: 0,
    totalGave: 0,
    netBalance: 0,
    cashGot: 0,
    cashGave: 0,
    cashBalance: 0,
    onlineGot: 0,
    onlineGave: 0,
    onlineBalance: 0,
    totalTransactions: 0,
  });
  const [categoryBreakdown, setCategoryBreakdown] = useState([]);
  const [categoryTypeTab, setCategoryTypeTab] = useState('gave'); // 'gave' | 'got'
  const [refreshing, setRefreshing] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  const loadReport = useCallback(() => {
    const { startDate, endDate } = getDateRangePreset(selectedPeriod);
    const sum = getReportsSummary(startDate, endDate);
    setSummary(sum);

    const cats = getCategoryBreakdown(startDate, endDate, categoryTypeTab);
    setCategoryBreakdown(cats);
  }, [selectedPeriod, categoryTypeTab]);

  useEffect(() => {
    loadReport();
  }, [loadReport, isAddTransactionOpen, viewingTransactionId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    loadReport();
    setRefreshing(false);
  };

  const handleExportCSV = async () => {
    await exportTransactionsToCSV();
  };

  // Calculate highest category amount for relative progress bar widths
  const maxCategoryAmount = categoryBreakdown.length > 0 ? Number(categoryBreakdown[0].totalAmount) : 1;

  return (
    <View style={styles.container}>
      <Header
        title="Reports & Analytics"
        rightElement={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerPdfBtn}
              onPress={() => setIsPdfModalOpen(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="document-text-outline" size={15} color="#DC2626" style={{ marginRight: 3 }} />
              <Text style={styles.headerPdfBtnText}>PDF</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportBtn}
              onPress={handleExportCSV}
              activeOpacity={0.7}
            >
              <Ionicons name="download-outline" size={17} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Period Selection Bar */}
      <View style={styles.periodBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodScroll}
        >
          {PERIOD_TABS.map((tab) => {
            const isSelected = selectedPeriod === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.periodTab,
                  isSelected && styles.periodTabActive,
                ]}
                onPress={() => setSelectedPeriod(tab.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.periodTabText,
                    isSelected && styles.periodTabTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {/* 1. Overall Period Net Summary */}
        <View style={[styles.card, Shadows.sm]}>
          <Text style={styles.cardHeaderTitle}>Net Overview</Text>

          <View style={styles.netOverviewRow}>
            <View style={styles.netStatCol}>
              <Text style={[styles.netStatLabel, { color: Colors.gotDark }]}>You Got</Text>
              <Text style={[styles.netStatValue, { color: Colors.got }]}>
                {formatCurrency(summary.totalGot)}
              </Text>
            </View>

            <View style={styles.netDividerVertical} />

            <View style={styles.netStatCol}>
              <Text style={[styles.netStatLabel, { color: Colors.gaveDark }]}>You Gave</Text>
              <Text style={[styles.netStatValue, { color: Colors.gave }]}>
                {formatCurrency(summary.totalGave)}
              </Text>
            </View>

            <View style={styles.netDividerVertical} />

            <View style={styles.netStatCol}>
              <Text style={styles.netStatLabel}>Net</Text>
              <Text
                style={[
                  styles.netStatValue,
                  { color: summary.netBalance >= 0 ? Colors.got : Colors.gave },
                ]}
              >
                {summary.netBalance >= 0 ? '+' : ''}{formatCurrency(summary.netBalance)}
              </Text>
            </View>
          </View>
        </View>

        {/* 2. Cash vs Online Breakdown Cards */}
        <View style={styles.twoColRow}>
          {/* Cash Summary */}
          <View style={[styles.card, styles.colCard, Shadows.sm]}>
            <View style={styles.channelHeader}>
              <Ionicons name="cash-outline" size={18} color="#B45309" style={{ marginRight: 4 }} />
              <Text style={[styles.channelTitle, { color: '#B45309' }]}>Cash</Text>
            </View>

            <View style={styles.channelRow}>
              <Text style={styles.channelLabel}>Cash Got</Text>
              <Text style={[styles.channelValue, { color: Colors.got }]}>
                {formatCurrency(summary.cashGot)}
              </Text>
            </View>

            <View style={styles.channelRow}>
              <Text style={styles.channelLabel}>Cash Gave</Text>
              <Text style={[styles.channelValue, { color: Colors.gave }]}>
                {formatCurrency(summary.cashGave)}
              </Text>
            </View>

            <View style={[styles.channelRow, styles.channelBalanceRow]}>
              <Text style={styles.channelBalanceLabel}>Cash Balance</Text>
              <Text style={[styles.channelBalanceValue, { color: '#B45309' }]}>
                {formatCurrency(summary.cashBalance)}
              </Text>
            </View>
          </View>

          {/* Online Summary */}
          <View style={[styles.card, styles.colCard, Shadows.sm]}>
            <View style={styles.channelHeader}>
              <Ionicons name="card-outline" size={18} color="#1D4ED8" style={{ marginRight: 4 }} />
              <Text style={[styles.channelTitle, { color: '#1D4ED8' }]}>Online</Text>
            </View>

            <View style={styles.channelRow}>
              <Text style={styles.channelLabel}>Online Got</Text>
              <Text style={[styles.channelValue, { color: Colors.got }]}>
                {formatCurrency(summary.onlineGot)}
              </Text>
            </View>

            <View style={styles.channelRow}>
              <Text style={styles.channelLabel}>Online Gave</Text>
              <Text style={[styles.channelValue, { color: Colors.gave }]}>
                {formatCurrency(summary.onlineGave)}
              </Text>
            </View>

            <View style={[styles.channelRow, styles.channelBalanceRow]}>
              <Text style={styles.channelBalanceLabel}>Online Balance</Text>
              <Text style={[styles.channelBalanceValue, { color: '#1D4ED8' }]}>
                {formatCurrency(summary.onlineBalance)}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. Category-Wise Breakdown */}
        <View style={[styles.card, Shadows.sm]}>
          <View style={styles.categoryHeaderSection}>
            <Text style={styles.cardHeaderTitle}>Category Breakdown</Text>
            
            {/* Toggle You Gave vs You Got */}
            <View style={styles.catTypeToggle}>
              <TouchableOpacity
                style={[
                  styles.catTypeBtn,
                  categoryTypeTab === 'gave' && styles.catTypeBtnActiveGave,
                ]}
                onPress={() => setCategoryTypeTab('gave')}
              >
                <Text
                  style={[
                    styles.catTypeBtnText,
                    categoryTypeTab === 'gave' && styles.catTypeBtnTextActive,
                  ]}
                >
                  Gave (Expense)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.catTypeBtn,
                  categoryTypeTab === 'got' && styles.catTypeBtnActiveGot,
                ]}
                onPress={() => setCategoryTypeTab('got')}
              >
                <Text
                  style={[
                    styles.catTypeBtnText,
                    categoryTypeTab === 'got' && styles.catTypeBtnTextActive,
                  ]}
                >
                  Got (Income)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {categoryBreakdown.length === 0 ? (
            <View style={styles.noCategoriesBox}>
              <Text style={styles.noCategoriesText}>No data available for this period.</Text>
            </View>
          ) : (
            <View style={styles.categoriesList}>
              {categoryBreakdown.map((cat, index) => {
                const amount = Number(cat.totalAmount || 0);
                const percent = ((amount / (categoryTypeTab === 'gave' ? (summary.totalGave || 1) : (summary.totalGot || 1))) * 100).toFixed(0);
                const progressWidth = `${Math.min(100, Math.max(5, (amount / maxCategoryAmount) * 100))}%`;

                return (
                  <View key={index} style={styles.categoryRowItem}>
                    <View style={styles.categoryItemHeader}>
                      <View style={styles.catNameGroup}>
                        <View
                          style={[
                            styles.catIconWrap,
                            { backgroundColor: (cat.categoryColor || Colors.primary) + '20' },
                          ]}
                        >
                          <Ionicons
                            name={cat.categoryIcon || 'grid-outline'}
                            size={16}
                            color={cat.categoryColor || Colors.primary}
                          />
                        </View>
                        <Text style={styles.catNameText}>{cat.categoryName}</Text>
                        <Text style={styles.catTxCount}>({cat.transactionCount})</Text>
                      </View>

                      <View style={styles.catAmountGroup}>
                        <Text style={styles.catAmountText}>{formatCurrency(amount)}</Text>
                        <Text style={styles.catPercentText}>{percent}%</Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressBarBackground}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: progressWidth,
                            backgroundColor: cat.categoryColor || Colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* PDF Export Modal */}
      <ExportPdfModal
        visible={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        initialDateFilter={selectedPeriod}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  headerPdfBtnText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: '#DC2626',
  },
  exportBtn: {
    padding: Spacing.xs,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.sm,
  },
  periodBar: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  periodScroll: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  periodTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSubtle,
  },
  periodTabActive: {
    backgroundColor: Colors.primary,
  },
  periodTabText: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.medium,
    color: Colors.textSecondary,
  },
  periodTabTextActive: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 140,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  cardHeaderTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  netOverviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  netStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  netDividerVertical: {
    width: 1,
    height: 36,
    backgroundColor: Colors.borderLight,
  },
  netStatLabel: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  netStatValue: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  colCard: {
    flex: 1,
  },
  channelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  channelTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  channelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  channelLabel: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
  },
  channelValue: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
  },
  channelBalanceRow: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    marginTop: Spacing.xs,
    marginBottom: 0,
  },
  channelBalanceLabel: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  channelBalanceValue: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  categoryHeaderSection: {
    marginBottom: Spacing.md,
  },
  catTypeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: 2,
    marginTop: Spacing.xs,
  },
  catTypeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: BorderRadius.sm,
  },
  catTypeBtnActiveGave: {
    backgroundColor: Colors.gave,
  },
  catTypeBtnActiveGot: {
    backgroundColor: Colors.got,
  },
  catTypeBtnText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.medium,
    color: Colors.textSecondary,
  },
  catTypeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  categoriesList: {
    gap: Spacing.md,
  },
  categoryRowItem: {
    marginBottom: Spacing.xs,
  },
  categoryItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  catNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  catIconWrap: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catNameText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
  },
  catTxCount: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
  },
  catAmountGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  catAmountText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  catPercentText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    width: 32,
    textAlign: 'right',
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  noCategoriesBox: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  noCategoriesText: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textMuted,
  },
});
