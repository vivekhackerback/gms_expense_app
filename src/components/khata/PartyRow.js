import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';
import { formatCurrency, formatDateGroup } from '../../utils/formatters';

export const PartyRow = ({ item, onPress }) => {
  const net = Number(item.netBalance || 0);
  
  // net > 0 means You Gave more than You Got => The party owes you => "You Will Get"
  // net < 0 means You Got more than You Gave => You owe the party => "You Will Give"
  const willGet = net > 0;
  const willGive = net < 0;
  const isSettled = net === 0;

  const statusLabel = isSettled
    ? 'Settled'
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

  const lastActiveText = item.lastTransactionDate
    ? `Last active: ${formatDateGroup(item.lastTransactionDate)}`
    : 'No transactions yet';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress && onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.leftSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(item.name || 'P').charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.phone ? (
            <Text style={styles.phone} numberOfLines={1}>
              {item.phone}
            </Text>
          ) : null}
          <Text style={styles.lastActive}>{lastActiveText}</Text>
        </View>
      </View>

      <View style={styles.rightSection}>
        <Text style={[styles.statusLabel, { color: statusColor }]}>
          {statusLabel}
        </Text>
        <Text style={[styles.amount, { color: amountColor }]}>
          {formatCurrency(Math.abs(net))}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  avatarText: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.primaryLight,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
  },
  phone: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  lastActive: {
    fontSize: Typography.fontSizes.xs - 1,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  statusLabel: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.medium,
    marginBottom: 2,
  },
  amount: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    letterSpacing: -0.2,
  },
});
