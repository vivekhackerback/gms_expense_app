import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { formatCurrency } from '../utils/formatters';
import { getPartyById, getTransactions } from '../database/queries';
import { TransactionList } from '../components/transaction/TransactionList';

export const PartyDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const {
    activePartyId,
    closePartyDetails,
    openAddTransaction,
    openTransactionDetails,
    deletePartyItem,
    isAddTransactionOpen,
    viewingTransactionId,
  } = useApp();

  const [party, setParty] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadPartyData = useCallback(() => {
    if (!activePartyId) return;
    const p = getPartyById(activePartyId);
    setParty(p);
    const txs = getTransactions({ partyId: activePartyId, limit: 200 });
    setTransactions(txs);
  }, [activePartyId]);

  useEffect(() => {
    loadPartyData();
  }, [loadPartyData, isAddTransactionOpen, viewingTransactionId]);

  if (!activePartyId || !party) return null;

  const net = Number(party.netBalance || 0);
  const willGet = net > 0;
  const willGive = net < 0;
  const isSettled = net === 0;

  const statusLabel = isSettled
    ? 'All Settled'
    : willGet
    ? 'You Will Get'
    : 'You Will Give';

  const statusColor = isSettled
    ? Colors.textMuted
    : willGet
    ? Colors.gotDark
    : Colors.gaveDark;

  const amountColor = isSettled
    ? Colors.textMuted
    : willGet
    ? Colors.got
    : Colors.gave;

  const handleDeleteParty = () => {
    Alert.alert(
      'Delete Party',
      `Are you sure you want to delete ${party.name}? Associated transactions will remain in expense history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePartyItem(party.id);
            closePartyDetails();
          },
        },
      ]
    );
  };

  const renderHeader = () => (
    <View style={styles.partyHeroCard}>
      <View style={styles.partyAvatarLarge}>
        <Text style={styles.avatarLargeText}>
          {party.name.charAt(0).toUpperCase()}
        </Text>
      </View>

      <Text style={styles.partyNameHero}>{party.name}</Text>
      {party.phone ? (
        <Text style={styles.partyPhoneHero}>{party.phone}</Text>
      ) : null}

      <View style={styles.netBalanceBox}>
        <Text style={[styles.netStatusLabel, { color: statusColor }]}>
          {statusLabel}
        </Text>
        <Text style={[styles.netAmount, { color: amountColor }]}>
          {formatCurrency(Math.abs(net))}
        </Text>
      </View>

      {/* Direct [ You Gave ] [ You Got ] Quick Buttons for this Party */}
      <View style={styles.quickActionRow}>
        <TouchableOpacity
          style={[styles.quickBtn, styles.quickBtnGave]}
          onPress={() => openAddTransaction({ defaultType: 'gave', defaultPartyId: party.id })}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-up-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.quickBtnText}>You Gave</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickBtn, styles.quickBtnGot]}
          onPress={() => openAddTransaction({ defaultType: 'got', defaultPartyId: party.id })}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-down-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.quickBtnText}>You Got</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.ledgerHeaderRow}>
        <Text style={styles.ledgerTitle}>Transaction History ({transactions.length})</Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={Boolean(activePartyId)}
      animationType="slide"
      onRequestClose={closePartyDetails}
    >
      <SafeAreaView style={styles.container}>
        {/* Top Header */}
        <View style={[styles.navHeader, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
          <TouchableOpacity onPress={closePartyDetails} style={styles.navBackBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.navHeaderTitle} numberOfLines={1}>{party.name}</Text>
          <TouchableOpacity onPress={handleDeleteParty} style={styles.navDeleteBtn} activeOpacity={0.7}>
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
          </TouchableOpacity>
        </View>

        <TransactionList
          transactions={transactions}
          onTransactionPress={(tx) => openTransactionDetails(tx.id)}
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            loadPartyData();
            setRefreshing(false);
          }}
          ListHeaderComponent={renderHeader()}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={44} color={Colors.border} />
              <Text style={styles.emptyTitle}>No Entries Yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap "You Gave" or "You Got" above to add an entry for {party.name}.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  navBackBtn: {
    padding: Spacing.xs,
  },
  navHeaderTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: Spacing.sm,
  },
  navDeleteBtn: {
    padding: Spacing.xs,
  },
  partyHeroCard: {
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    marginBottom: Spacing.sm,
  },
  partyAvatarLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  avatarLargeText: {
    fontSize: Typography.fontSizes.xxl,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.accent,
  },
  partyNameHero: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  partyPhoneHero: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  netBalanceBox: {
    alignItems: 'center',
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  netStatusLabel: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  netAmount: {
    fontSize: Typography.fontSizes.amountHero,
    fontWeight: Typography.fontWeights.bold,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
    marginBottom: Spacing.lg,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  quickBtnGave: {
    backgroundColor: Colors.gave,
  },
  quickBtnGot: {
    backgroundColor: Colors.got,
  },
  quickBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  ledgerHeaderRow: {
    width: '100%',
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  ledgerTitle: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
