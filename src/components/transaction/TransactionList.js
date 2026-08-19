import React, { useMemo } from 'react';
import { StyleSheet, View, Text, SectionList, RefreshControl } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';
import { formatDateGroup } from '../../utils/formatters';
import { TransactionRow } from './TransactionRow';

export const TransactionList = ({
  transactions = [],
  onTransactionPress,
  refreshing = false,
  onRefresh,
  ListHeaderComponent,
  ListEmptyComponent,
}) => {
  // Group transactions into sections by date
  const sections = useMemo(() => {
    const map = new Map();

    for (const tx of transactions) {
      const groupKey = formatDateGroup(tx.transactionDate || tx.createdAt);
      if (!map.has(groupKey)) {
        map.set(groupKey, []);
      }
      map.get(groupKey).push(tx);
    }

    return Array.from(map.entries()).map(([title, data]) => ({
      title,
      data,
    }));
  }, [transactions]);

  const renderSectionHeader = ({ section: { title } }) => {
    const isToday = title === 'Today';
    const isYesterday = title === 'Yesterday';

    return (
      <View style={styles.sectionHeaderWrap}>
        <View style={[styles.sectionBadge, isToday && styles.todayBadge, isYesterday && styles.yesterdayBadge]}>
          <View
            style={[
              styles.sectionDot,
              isToday && styles.todayDot,
              isYesterday && styles.yesterdayDot,
            ]}
          />
          <Text
            style={[
              styles.sectionTitle,
              isToday && styles.todayText,
              isYesterday && styles.yesterdayText,
            ]}
          >
            {title}
          </Text>
        </View>
      </View>
    );
  };

  const renderItem = ({ item }) => (
    <TransactionRow item={item} onPress={onTransactionPress} />
  );

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => String(item.id || item.uuid)}
      renderItem={renderItem}
      renderSectionHeader={renderSectionHeader}
      stickySectionHeadersEnabled={true}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        ) : undefined
      }
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: 140, // Generous clearance for floating button & bottom tabs
  },
  sectionHeaderWrap: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  todayBadge: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  yesterdayBadge: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
  },
  sectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textMuted,
    marginRight: 6,
  },
  todayDot: {
    backgroundColor: '#10B981',
  },
  yesterdayDot: {
    backgroundColor: '#64748B',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  todayText: {
    color: '#065F46',
  },
  yesterdayText: {
    color: '#334155',
  },
});
