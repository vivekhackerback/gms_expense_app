import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Platform,
  ToastAndroid,
  ScrollView,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { formatCurrency, formatInputWithCommas } from '../../utils/formatters';
import {
  getMonthlyCategorySpendReport,
  setCategoryBudget,
  setMonthlyBudget,
  getMonthlyBudget,
} from '../../database/queries';

export const MonthlyBudgetModal = ({
  visible,
  onClose,
  currency,
  onBudgetUpdated,
}) => {
  const insets = useSafeAreaInsets();
  const symbol = currency?.symbol || '₹';

  const [report, setReport] = useState(() => getMonthlyCategorySpendReport());
  const [filterTab, setFilterTab] = useState('all'); // 'all' | 'budgeted' | 'over'
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [editBudgetInput, setEditBudgetInput] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadReport = useCallback(() => {
    const data = getMonthlyCategorySpendReport();
    setReport(data);
  }, []);

  useEffect(() => {
    if (visible) {
      loadReport();
    }
  }, [visible, loadReport]);

  const filteredItems = useMemo(() => {
    if (!report?.items) return [];
    if (filterTab === 'budgeted') {
      return report.items.filter((item) => item.budget > 0);
    }
    if (filterTab === 'over') {
      return report.items.filter((item) => item.isOverBudget);
    }
    return report.items;
  }, [report, filterTab]);

  const openCategoryEdit = (cat) => {
    try {
      Haptics.selectionAsync();
    } catch (e) {}
    setSelectedCategory(cat);
    setEditBudgetInput(cat.budget > 0 ? formatInputWithCommas(String(cat.budget)) : '');
    setIsEditModalOpen(true);
  };

  const handleSaveCategoryBudget = () => {
    if (!selectedCategory) return;
    const cleanAmount = parseFloat(editBudgetInput.replace(/,/g, '')) || 0;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}

    setCategoryBudget(selectedCategory.id, cleanAmount, selectedCategory.name);
    loadReport();
    if (onBudgetUpdated) onBudgetUpdated();

    if (Platform.OS === 'android') {
      ToastAndroid.show(
        cleanAmount > 0
          ? `${selectedCategory.name} budget set to ${formatCurrency(cleanAmount)}`
          : `${selectedCategory.name} budget removed`,
        ToastAndroid.SHORT
      );
    }

    setIsEditModalOpen(false);
    setSelectedCategory(null);
  };

  const handleClearCategoryBudget = () => {
    if (!selectedCategory) return;
    try {
      Haptics.selectionAsync();
    } catch (e) {}

    setCategoryBudget(selectedCategory.id, 0, selectedCategory.name);
    loadReport();
    if (onBudgetUpdated) onBudgetUpdated();

    if (Platform.OS === 'android') {
      ToastAndroid.show(`${selectedCategory.name} budget removed`, ToastAndroid.SHORT);
    }

    setIsEditModalOpen(false);
    setSelectedCategory(null);
  };

  const handleQuickPreset = (amount) => {
    try {
      Haptics.selectionAsync();
    } catch (e) {}
    setEditBudgetInput(formatInputWithCommas(String(amount)));
  };

  const overallPercent =
    report.totalBudget > 0
      ? Math.min(100, (report.totalSpent / report.totalBudget) * 100)
      : 0;
  const isOverallOver =
    report.totalBudget > 0 && report.totalSpent > report.totalBudget;

  const renderCategoryItem = ({ item }) => {
    const hasBudget = item.budget > 0;
    const barWidth = Math.min(100, Math.max(0, item.percent));

    let barColor = '#10B981'; // Green
    if (item.percent > 100) {
      barColor = '#EF4444'; // Red
    } else if (item.percent > 80) {
      barColor = '#F59E0B'; // Amber
    }

    return (
      <TouchableOpacity
        style={[styles.categoryCard, Shadows.sm, item.isOverBudget && styles.categoryCardOver]}
        onPress={() => openCategoryEdit(item)}
        activeOpacity={0.75}
      >
        <View style={styles.cardTopRow}>
          {/* Category Icon & Info */}
          <View style={styles.catLeftWrap}>
            <View
              style={[
                styles.catIconWrap,
                { backgroundColor: (item.color || Colors.primary) + '20' },
              ]}
            >
              <Ionicons
                name={item.icon || 'grid-outline'}
                size={22}
                color={item.color || Colors.primary}
              />
            </View>
            <View>
              <Text style={styles.catName}>{item.name}</Text>
              <Text style={styles.catMeta}>
                {item.txCount} {item.txCount === 1 ? 'expense' : 'expenses'} this month
              </Text>
            </View>
          </View>

          {/* Amounts on Right */}
          <View style={styles.catRightWrap}>
            <Text style={[styles.catSpentText, item.isOverBudget && { color: '#DC2626' }]}>
              {formatCurrency(item.spent)}
            </Text>
            <View style={styles.budgetPillWrap}>
              {hasBudget ? (
                <View style={[styles.budgetLimitPill, item.isOverBudget && styles.budgetLimitPillOver]}>
                  <Text style={[styles.budgetLimitText, item.isOverBudget && styles.budgetLimitTextOver]}>
                    Target: {formatCurrency(item.budget)}
                  </Text>
                </View>
              ) : (
                <View style={styles.noBudgetPill}>
                  <Ionicons name="add" size={12} color="#059669" style={{ marginRight: 2 }} />
                  <Text style={styles.noBudgetText}>Set Budget</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Progress Bar (if budget is set) */}
        {hasBudget ? (
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${barWidth}%`, backgroundColor: barColor },
                ]}
              />
            </View>
            <View style={styles.progressLabelRow}>
              <Text
                style={[
                  styles.progressRemainingText,
                  item.isOverBudget && styles.progressRemainingOverText,
                ]}
              >
                {item.isOverBudget
                  ? `⚠️ Over budget by ${formatCurrency(item.spent - item.budget)}`
                  : `✓ ${formatCurrency(item.remaining)} remaining`}
              </Text>
              <Text style={styles.progressPercentText}>{Math.round(item.percent)}%</Text>
            </View>
          </View>
        ) : item.spent > 0 ? (
          <View style={styles.noBudgetHintRow}>
            <Text style={styles.noBudgetHintText}>
              Spent {formatCurrency(item.spent)} without a limit • Tap to set target
            </Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
          </View>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <View style={styles.headerIconBox}>
              <Ionicons name="pie-chart" size={22} color="#059669" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Category-Wise Budgets</Text>
              <Text style={styles.headerSubtitle}>
                {report.monthName} Spending &amp; Targets
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Overview Hero Card */}
        <View style={styles.heroCardContainer}>
          <View style={[styles.heroCard, Shadows.sm]}>
            <View style={styles.heroTopRow}>
              <View>
                <Text style={styles.heroSublabel}>TOTAL SPENT THIS MONTH</Text>
                <Text style={[styles.heroSpentAmount, isOverallOver && { color: '#DC2626' }]}>
                  {formatCurrency(report.totalSpent)}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.heroSublabel}>TOTAL BUDGET TARGET</Text>
                <Text style={styles.heroTargetAmount}>
                  {report.totalBudget > 0 ? formatCurrency(report.totalBudget) : 'No Target Set'}
                </Text>
              </View>
            </View>

            {report.totalBudget > 0 && (
              <>
                <View style={styles.heroProgressBarBg}>
                  <View
                    style={[
                      styles.heroProgressBarFill,
                      {
                        width: `${overallPercent}%`,
                        backgroundColor: isOverallOver
                          ? '#EF4444'
                          : overallPercent > 80
                          ? '#F59E0B'
                          : '#10B981',
                      },
                    ]}
                  />
                </View>
                <View style={styles.heroFooterRow}>
                  <Text style={[styles.heroStatusText, isOverallOver && styles.heroStatusOverText]}>
                    {isOverallOver
                      ? `⚠️ Over total budget by ${formatCurrency(report.totalSpent - report.totalBudget)}`
                      : `✓ ${formatCurrency(report.totalBudget - report.totalSpent)} remaining (${Math.round(overallPercent)}% spent)`}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabsRow}>
          <TouchableOpacity
            style={[styles.filterTab, filterTab === 'all' && styles.filterTabActive]}
            onPress={() => setFilterTab('all')}
          >
            <Text style={[styles.filterTabText, filterTab === 'all' && styles.filterTabTextActive]}>
              All ({report.items.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filterTab === 'budgeted' && styles.filterTabActive]}
            onPress={() => setFilterTab('budgeted')}
          >
            <Text style={[styles.filterTabText, filterTab === 'budgeted' && styles.filterTabTextActive]}>
              With Budget ({report.items.filter((i) => i.budget > 0).length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterTab, filterTab === 'over' && styles.filterTabActive]}
            onPress={() => setFilterTab('over')}
          >
            <Text style={[styles.filterTabText, filterTab === 'over' && styles.filterTabTextActive]}>
              Over Budget ({report.items.filter((i) => i.isOverBudget).length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Categories List */}
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderCategoryItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 30 },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-done-circle-outline" size={44} color="#10B981" />
              <Text style={styles.emptyTitle}>
                {filterTab === 'over'
                  ? 'Great Job! No Categories Over Budget'
                  : 'No Categories Match Filter'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {filterTab === 'over'
                  ? 'All your spending is within your defined targets.'
                  : 'Tap "All" to view and assign category budgets.'}
              </Text>
            </View>
          }
        />

        {/* Edit Category Budget Sub-Modal */}
        <Modal
          visible={isEditModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsEditModalOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, Shadows.lg]}>
              {/* Category Info Header */}
              {selectedCategory && (
                <View style={styles.modalHeaderRow}>
                  <View
                    style={[
                      styles.modalCatIcon,
                      { backgroundColor: (selectedCategory.color || Colors.primary) + '20' },
                    ]}
                  >
                    <Ionicons
                      name={selectedCategory.icon || 'grid-outline'}
                      size={22}
                      color={selectedCategory.color || Colors.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{selectedCategory.name} Budget</Text>
                    <Text style={styles.modalSpentNotice}>
                      Spent this month: {formatCurrency(selectedCategory.spent)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsEditModalOpen(false)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={22} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>
              )}

              {/* Amount Input */}
              <Text style={styles.modalInputLabel}>Monthly Budget Limit ({symbol})</Text>
              <View style={styles.modalInputRow}>
                <Text style={styles.modalSymbol}>{symbol}</Text>
                <TextInput
                  style={styles.modalTextInput}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  value={editBudgetInput}
                  onChangeText={(t) => setEditBudgetInput(formatInputWithCommas(t))}
                  keyboardType="numeric"
                  autoFocus
                />
              </View>

              {/* Quick Preset Buttons */}
              <Text style={styles.modalPresetsLabel}>Quick Targets</Text>
              <View style={styles.modalPresetsRow}>
                {[1000, 2500, 5000, 10000, 20000].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.modalPresetChip}
                    onPress={() => handleQuickPreset(amt)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalPresetChipText}>{formatCurrency(amt)}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActionButtons}>
                {selectedCategory?.budget > 0 && (
                  <TouchableOpacity
                    style={styles.modalClearBtn}
                    onPress={handleClearCategoryBudget}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.modalClearBtnText}>Remove</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.modalSaveBtn, Shadows.sm]}
                  onPress={handleSaveCategoryBudget}
                  activeOpacity={0.85}
                >
                  <Text style={styles.modalSaveBtnText}>Save Target</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCardContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroSublabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
  },
  heroSpentAmount: {
    fontSize: 22,
    fontWeight: Typography.fontWeights.bold,
    color: '#059669',
    marginTop: 2,
  },
  heroTargetAmount: {
    fontSize: 18,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
    marginTop: 2,
  },
  heroProgressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  heroProgressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  heroFooterRow: {
    marginTop: 6,
  },
  heroStatusText: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.semibold,
    color: '#059669',
  },
  heroStatusOverText: {
    color: '#DC2626',
    fontWeight: Typography.fontWeights.bold,
  },
  filterTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterTabActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    gap: 10,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  categoryCardOver: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFFBFB',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  catLeftWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  catIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catName: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
  },
  catMeta: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  catRightWrap: {
    alignItems: 'flex-end',
  },
  catSpentText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
  },
  budgetPillWrap: {
    marginTop: 4,
  },
  budgetLimitPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  budgetLimitPillOver: {
    backgroundColor: '#FEE2E2',
  },
  budgetLimitText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  budgetLimitTextOver: {
    color: '#B91C1C',
    fontWeight: Typography.fontWeights.bold,
  },
  noBudgetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  noBudgetText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: '#059669',
  },
  progressContainer: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  progressRemainingText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.semibold,
    color: '#059669',
  },
  progressRemainingOverText: {
    color: '#DC2626',
    fontWeight: Typography.fontWeights.bold,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textMuted,
  },
  noBudgetHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  noBudgetHintText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Sub-Modal Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: Spacing.md,
  },
  modalCatIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
  },
  modalSpentNotice: {
    fontSize: 12,
    color: '#059669',
    fontWeight: Typography.fontWeights.semibold,
    marginTop: 2,
  },
  modalInputLabel: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 50,
    backgroundColor: '#FAFAFA',
  },
  modalSymbol: {
    fontSize: 20,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
    marginRight: 8,
  },
  modalTextInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
    paddingVertical: 0,
  },
  modalPresetsLabel: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    marginBottom: 6,
  },
  modalPresetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  modalPresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalPresetChipText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.text,
  },
  modalActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: Spacing.lg,
  },
  modalClearBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalClearBtnText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: '#DC2626',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
});
