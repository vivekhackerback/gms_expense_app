import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { Header } from '../components/common/Header';
import { SearchInput } from '../components/common/SearchInput';
import { TransactionList } from '../components/transaction/TransactionList';
import { ExportPdfModal } from '../components/transaction/ExportPdfModal';
import { getTransactions } from '../database/queries';
import { getDateRangePreset } from '../utils/formatters';

const TYPE_MODE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'gave', label: 'You Gave' },
  { id: 'got', label: 'You Got' },
  { id: 'cash', label: 'Cash' },
  { id: 'online', label: 'Online' },
];

const DATE_FILTERS = [
  { id: 'all', label: 'All Time' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'custom', label: 'Custom Range 📅' },
];

export const TransactionsScreen = () => {
  const { openTransactionDetails, isAddTransactionOpen, viewingTransactionId } = useApp();

  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Custom Date Range Modal State
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [isExportPdfOpen, setIsExportPdfOpen] = useState(false);
  const [customStartDate, setCustomStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split('T')[0]);

  // Temp Date inputs for custom modal
  const [startDay, setStartDay] = useState('1');
  const [startMonth, setStartMonth] = useState(String(new Date().getMonth() + 1));
  const [startYear, setStartYear] = useState(String(new Date().getFullYear()));

  const [endDay, setEndDay] = useState(String(new Date().getDate()));
  const [endMonth, setEndMonth] = useState(String(new Date().getMonth() + 1));
  const [endYear, setEndYear] = useState(String(new Date().getFullYear()));

  const loadTransactions = useCallback(() => {
    let filterType = null;
    let filterMode = null;

    if (selectedFilter === 'gave') filterType = 'gave';
    else if (selectedFilter === 'got') filterType = 'got';
    else if (selectedFilter === 'cash') filterMode = 'cash';
    else if (selectedFilter === 'online') filterMode = 'online';

    const { startDate, endDate } = getDateRangePreset(
      selectedDateFilter,
      customStartDate,
      customEndDate
    );

    const items = getTransactions({
      limit: 150,
      filterType,
      filterMode,
      startDate,
      endDate,
      search,
    });

    setTransactions(items);
  }, [selectedFilter, selectedDateFilter, customStartDate, customEndDate, search]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, isAddTransactionOpen, viewingTransactionId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    loadTransactions();
    setRefreshing(false);
  };

  const handleDateFilterPress = (filterId) => {
    if (filterId === 'custom') {
      // Pre-fill modal with current custom or default dates
      const now = new Date();
      setEndDay(String(now.getDate()));
      setEndMonth(String(now.getMonth() + 1));
      setEndYear(String(now.getFullYear()));

      const start = new Date();
      start.setDate(1); // 1st of current month as start default
      setStartDay('1');
      setStartMonth(String(start.getMonth() + 1));
      setStartYear(String(start.getFullYear()));

      setIsCustomModalOpen(true);
    } else {
      setSelectedDateFilter(filterId);
    }
  };

  const applyCustomRange = () => {
    try {
      const sDayNum = parseInt(startDay, 10);
      const sMonthNum = parseInt(startMonth, 10);
      const sYearNum = parseInt(startYear, 10);
      const eDayNum = parseInt(endDay, 10);
      const eMonthNum = parseInt(endMonth, 10);
      const eYearNum = parseInt(endYear, 10);

      if (
        isNaN(sDayNum) || isNaN(sMonthNum) || isNaN(sYearNum) ||
        isNaN(eDayNum) || isNaN(eMonthNum) || isNaN(eYearNum) ||
        sMonthNum < 1 || sMonthNum > 12 || sDayNum < 1 || sDayNum > 31 ||
        eMonthNum < 1 || eMonthNum > 12 || eDayNum < 1 || eDayNum > 31
      ) {
        Alert.alert('Invalid Date', 'Please enter valid day, month, and year values.');
        return;
      }

      const sMonthStr = String(sMonthNum).padStart(2, '0');
      const sDayStr = String(sDayNum).padStart(2, '0');
      const eMonthStr = String(eMonthNum).padStart(2, '0');
      const eDayStr = String(eDayNum).padStart(2, '0');

      const sDateStr = `${sYearNum}-${sMonthStr}-${sDayStr}`;
      const eDateStr = `${eYearNum}-${eMonthStr}-${eDayStr}`;

      if (sDateStr > eDateStr) {
        Alert.alert('Invalid Range', 'Start Date cannot be later than End Date.');
        return;
      }

      setCustomStartDate(sDateStr);
      setCustomEndDate(eDateStr);
      setSelectedDateFilter('custom');
      setIsCustomModalOpen(false);
    } catch (e) {
      Alert.alert('Invalid Date', 'Please enter valid numbers for days, months, and years.');
    }
  };

  const setPresetInModal = (daysBack) => {
    const now = new Date();
    setEndDay(String(now.getDate()));
    setEndMonth(String(now.getMonth() + 1));
    setEndYear(String(now.getFullYear()));

    const past = new Date();
    past.setDate(past.getDate() - daysBack);
    setStartDay(String(past.getDate()));
    setStartMonth(String(past.getMonth() + 1));
    setStartYear(String(past.getFullYear()));
  };

  return (
    <View style={styles.container}>
      <Header
        title="Transactions"
        rightElement={
          <TouchableOpacity
            style={styles.headerPdfBtn}
            onPress={() => setIsExportPdfOpen(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="document-text-outline" size={16} color="#DC2626" style={{ marginRight: 4 }} />
            <Text style={styles.headerPdfBtnText}>Export PDF</Text>
          </TouchableOpacity>
        }
      />

      {/* Search Bar & Filters */}
      <View style={styles.topFilterSection}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search party, category, note, amount..."
          style={styles.searchBar}
        />

        {/* Type & Mode Filter Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {TYPE_MODE_FILTERS.map((f) => {
            const isSelected = selectedFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.filterPill,
                  isSelected && styles.filterPillActive,
                ]}
                onPress={() => setSelectedFilter(f.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    isSelected && styles.filterPillTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Date Filter Pills (Today, Yesterday, This Week, Last Week, This Month, Last Month, Custom) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dateFilterScroll}
        >
          {DATE_FILTERS.map((d) => {
            const isSelected = selectedDateFilter === d.id;
            return (
              <TouchableOpacity
                key={d.id}
                style={[
                  styles.dateFilterPill,
                  isSelected && styles.dateFilterPillActive,
                ]}
                onPress={() => handleDateFilterPress(d.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dateFilterText,
                    isSelected && styles.dateFilterTextActive,
                  ]}
                >
                  {d.id === 'custom' && selectedDateFilter === 'custom'
                    ? `📅 ${customStartDate} to ${customEndDate}`
                    : d.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Transaction List */}
      <TransactionList
        transactions={transactions}
        onTransactionPress={(tx) => openTransactionDetails(tx.id)}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={44} color={Colors.border} />
            <Text style={styles.emptyTitle}>No matching transactions</Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? `No transactions matched "${search}".`
                : 'No transactions found for the selected date range and filters.'}
            </Text>
          </View>
        }
      />

      {/* Custom Date Range Picker Modal */}
      <Modal
        visible={isCustomModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsCustomModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, Shadows.lg]}>
            <View style={styles.modalHeaderRow}>
              <Ionicons name="calendar" size={22} color={Colors.primary} />
              <Text style={styles.modalTitle}>Custom Date Range</Text>
            </View>

            {/* Quick Helper Chips */}
            <Text style={styles.modalSubLabel}>QUICK SHORTCUTS</Text>
            <View style={styles.quickShortcutsRow}>
              <TouchableOpacity
                style={styles.quickShortcutChip}
                onPress={() => setPresetInModal(7)}
              >
                <Text style={styles.quickShortcutText}>Last 7 Days</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickShortcutChip}
                onPress={() => setPresetInModal(30)}
              >
                <Text style={styles.quickShortcutText}>Last 30 Days</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.quickShortcutChip}
                onPress={() => setPresetInModal(90)}
              >
                <Text style={styles.quickShortcutText}>Last 90 Days</Text>
              </TouchableOpacity>
            </View>

            {/* START DATE */}
            <Text style={styles.modalSubLabel}>START DATE (DD / MM / YYYY)</Text>
            <View style={styles.dateInputsRow}>
              <View style={styles.dateBox}>
                <Text style={styles.dateSub}>Day</Text>
                <TextInput
                  style={styles.dateField}
                  value={startDay}
                  onChangeText={setStartDay}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
              </View>
              <Text style={styles.slash}>/</Text>
              <View style={styles.dateBox}>
                <Text style={styles.dateSub}>Month</Text>
                <TextInput
                  style={styles.dateField}
                  value={startMonth}
                  onChangeText={setStartMonth}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
              </View>
              <Text style={styles.slash}>/</Text>
              <View style={styles.dateBox}>
                <Text style={styles.dateSub}>Year</Text>
                <TextInput
                  style={[styles.dateField, { width: 68 }]}
                  value={startYear}
                  onChangeText={setStartYear}
                  keyboardType="number-pad"
                  maxLength={4}
                  selectTextOnFocus
                />
              </View>
            </View>

            {/* END DATE */}
            <Text style={styles.modalSubLabel}>END DATE (DD / MM / YYYY)</Text>
            <View style={styles.dateInputsRow}>
              <View style={styles.dateBox}>
                <Text style={styles.dateSub}>Day</Text>
                <TextInput
                  style={styles.dateField}
                  value={endDay}
                  onChangeText={setEndDay}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
              </View>
              <Text style={styles.slash}>/</Text>
              <View style={styles.dateBox}>
                <Text style={styles.dateSub}>Month</Text>
                <TextInput
                  style={styles.dateField}
                  value={endMonth}
                  onChangeText={setEndMonth}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
              </View>
              <Text style={styles.slash}>/</Text>
              <View style={styles.dateBox}>
                <Text style={styles.dateSub}>Year</Text>
                <TextInput
                  style={[styles.dateField, { width: 68 }]}
                  value={endYear}
                  onChangeText={setEndYear}
                  keyboardType="number-pad"
                  maxLength={4}
                  selectTextOnFocus
                />
              </View>
            </View>

            {/* Modal Actions */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsCustomModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.applyBtn}
                onPress={applyCustomRange}
              >
                <Text style={styles.applyBtnText}>Apply Filter</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PDF Export Modal */}
      <ExportPdfModal
        visible={isExportPdfOpen}
        onClose={() => setIsExportPdfOpen(false)}
        initialDateFilter={selectedDateFilter}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topFilterSection: {
    backgroundColor: Colors.surface,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchBar: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  filterScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs + 2,
    marginBottom: Spacing.xs + 2,
  },
  filterPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  filterPillActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  filterPillText: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.medium,
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  dateFilterScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs + 2,
    paddingTop: 2,
  },
  dateFilterPill: {
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateFilterPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dateFilterText: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.medium,
    color: Colors.textSecondary,
  },
  dateFilterTextActive: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxxl,
    marginTop: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  // Custom Date Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    width: '100%',
    maxWidth: 340,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  modalSubLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  quickShortcutsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 6,
  },
  quickShortcutChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs + 2,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  quickShortcutText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.primary,
  },
  dateInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  dateBox: {
    alignItems: 'center',
  },
  dateSub: {
    fontSize: 10,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  dateField: {
    width: 56,
    height: 40,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    textAlign: 'center',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  slash: {
    fontSize: Typography.fontSizes.lg,
    color: Colors.textMuted,
    marginTop: 12,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: Typography.fontSizes.md,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.semibold,
  },
  applyBtn: {
    flex: 1.5,
    paddingVertical: Spacing.md - 2,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyBtnText: {
    fontSize: Typography.fontSizes.md,
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  headerPdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  headerPdfBtnText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: '#DC2626',
  },
});
