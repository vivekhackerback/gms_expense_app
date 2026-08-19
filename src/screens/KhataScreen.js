import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';
import { Header } from '../components/common/Header';
import { SearchInput } from '../components/common/SearchInput';
import { PartyRow } from '../components/khata/PartyRow';

export const KhataScreen = () => {
  const {
    parties,
    refreshAll,
    openPartyDetails,
    setIsManagePartiesOpen,
  } = useApp();

  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    refreshAll();
    setRefreshing(false);
  };

  // Filter parties by search
  const filteredParties = useMemo(() => {
    if (!search.trim()) return parties;
    const term = search.toLowerCase().trim();
    return parties.filter(
      (p) =>
        p.name.toLowerCase().includes(term) ||
        (p.phone && p.phone.toLowerCase().includes(term))
    );
  }, [parties, search]);

  // Aggregate Khata Balances
  const khataSummary = useMemo(() => {
    let totalWillGet = 0;
    let totalWillGive = 0;

    for (const p of parties) {
      const net = Number(p.netBalance || 0);
      if (net > 0) {
        totalWillGet += net;
      } else if (net < 0) {
        totalWillGive += Math.abs(net);
      }
    }

    return { totalWillGet, totalWillGive };
  }, [parties]);

  const renderHeader = () => (
    <View style={styles.topSection}>
      {/* Khata Summary Cards */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, styles.willGetCard, Shadows.sm]}>
          <Text style={[styles.summaryCardLabel, { color: Colors.gotDark }]}>
            You Will Get
          </Text>
          <Text style={[styles.summaryCardAmount, { color: Colors.got }]}>
            {formatCurrency(khataSummary.totalWillGet)}
          </Text>
        </View>

        <View style={[styles.summaryCard, styles.willGiveCard, Shadows.sm]}>
          <Text style={[styles.summaryCardLabel, { color: Colors.gaveDark }]}>
            You Will Give
          </Text>
          <Text style={[styles.summaryCardAmount, { color: Colors.gave }]}>
            {formatCurrency(khataSummary.totalWillGive)}
          </Text>
        </View>
      </View>

      {/* Search & Add Party Bar */}
      <View style={styles.searchAndAddRow}>
        <SearchInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search Party by name / phone..."
          style={styles.searchBar}
        />
        <TouchableOpacity
          style={[styles.addPartyBtn, Shadows.sm]}
          onPress={() => setIsManagePartiesOpen(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="person-add" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.addPartyBtnText}>Add Party</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Header title="Digital Khata" />

      <FlatList
        data={filteredParties}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <PartyRow item={item} onPress={(p) => openPartyDetails(p.id)} />
        )}
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={Colors.border} />
            <Text style={styles.emptyTitle}>
              {search ? 'No Matching Parties' : 'No Parties Added Yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {search
                ? `No contact matches "${search}".`
                : 'Add customers, suppliers, or friends to track credit & balances.'}
            </Text>
            {!search && (
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => setIsManagePartiesOpen(true)}
              >
                <Text style={styles.emptyAddBtnText}>+ Add Your First Party</Text>
              </TouchableOpacity>
            )}
          </View>
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
  topSection: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
  },
  willGetCard: {
    backgroundColor: Colors.gotBg,
    borderColor: Colors.gotLight,
  },
  willGiveCard: {
    backgroundColor: Colors.gaveBg,
    borderColor: Colors.gaveLight,
  },
  summaryCardLabel: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
    marginBottom: 4,
  },
  summaryCardAmount: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
  },
  searchAndAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  searchBar: {
    flex: 1,
  },
  addPartyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    height: 42,
    borderRadius: BorderRadius.md,
  },
  addPartyBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
  },
  listContent: {
    paddingBottom: 140,
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
  emptyAddBtn: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  emptyAddBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
});
