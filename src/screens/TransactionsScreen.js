import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius } from '../constants/theme';
import { Header } from '../components/common/Header';
import { SearchInput } from '../components/common/SearchInput';
import { TransactionList } from '../components/transaction/TransactionList';
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
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
];

export const TransactionsScreen = () => {
  const { openTransactionDetails, isAddTransactionOpen, viewingTransactionId } = useApp();

  const [search, setSearch] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [selectedDateFilter, setSelectedDateFilter] = useState('all');
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = useCallback(() => {
    let filterType = null;
    let filterMode = null;

    if (selectedFilter === 'gave') filterType = 'gave';
    else if (selectedFilter === 'got') filterType = 'got';
    else if (selectedFilter === 'cash') filterMode = 'cash';
    else if (selectedFilter === 'online') filterMode = 'online';

    const { startDate, endDate } = getDateRangePreset(selectedDateFilter);

    const items = getTransactions({
      limit: 100,
      filterType,
      filterMode,
      startDate,
      endDate,
      search,
    });

    setTransactions(items);
  }, [selectedFilter, selectedDateFilter, search]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, isAddTransactionOpen, viewingTransactionId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    loadTransactions();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <Header title="Transactions" />

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

        {/* Date Filter Pills */}
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
                onPress={() => setSelectedDateFilter(d.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dateFilterText,
                    isSelected && styles.dateFilterTextActive,
                  ]}
                >
                  {d.label}
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
                : 'No transactions found for the selected filters.'}
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
  topFilterSection: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  searchBar: {
    marginBottom: Spacing.sm,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 4,
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
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
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
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: 6,
    paddingBottom: 4,
  },
  dateFilterPill: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'transparent',
  },
  dateFilterPillActive: {
    backgroundColor: Colors.surfaceSubtle,
  },
  dateFilterText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    fontWeight: Typography.fontWeights.medium,
  },
  dateFilterTextActive: {
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeights.bold,
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
  },
});
