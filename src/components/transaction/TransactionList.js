import React, { useMemo } from 'react';
import { StyleSheet, View, Text, SectionList, RefreshControl } from 'react-native';
import { Colors } from '../../constants/colors';
import { Typography, Spacing } from '../../constants/theme';
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

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

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
  sectionHeader: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sectionTitle: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
