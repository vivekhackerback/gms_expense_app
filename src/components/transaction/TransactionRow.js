import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { formatCurrency, formatFullDateTime } from '../../utils/formatters';

export const TransactionRow = ({ item, onPress, isRecentYesterday = false }) => {
  const [isNoteExpanded, setIsNoteExpanded] = useState(false);

  const isGave = item.type === 'gave';
  const typeText = isGave ? 'You Gave' : 'You Got';
  const modeText = item.paymentMode === 'cash' ? 'Cash' : 'Online';
  const isCash = item.paymentMode === 'cash';
  
  const { date, time } = formatFullDateTime(item.transactionDate || item.createdAt);

  const primaryTitle = item.partyName 
    ? item.partyName 
    : (item.categoryName || 'General Transaction');

  const showCategorySub = Boolean(item.partyName && item.categoryName);
  const hasImages = item.imageCount > 0;

  // Background styling:
  // For TODAY or View Transactions page: light red for Gave, light green for Got
  // For YESTERDAY only in Recent Transactions: very light gray background
  let cardBg = isGave ? '#FEF2F2' : '#ECFDF5';
  let cardBorder = isGave ? '#FEE2E2' : '#D1FAE5';

  if (isRecentYesterday) {
    cardBg = '#F3F4F6'; // Very light gray background for yesterday
    cardBorder = '#E5E7EB';
  }

  // Visual styling elements:
  const accentColor = isGave ? '#EF4444' : '#10B981';
  const amountColor = isGave ? '#DC2626' : '#059669';
  const typeBadgeBg = isGave ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';
  const typeBadgeText = isGave ? '#DC2626' : '#059669';
  const catBadgeTextColor = item.categoryColor || Colors.textPrimary;
  const catBadgeIconColor = item.categoryColor || Colors.primary;
  const modeBadgeBg = isCash ? Colors.cashLight : Colors.onlineLight;
  const modeBadgeTextColor = isCash ? '#B45309' : '#1D4ED8';
  const modeBadgeIconColor = isCash ? '#B45309' : '#1D4ED8';

  const hasRunningBalance = item.runningBalance !== undefined && item.runningBalance !== null;
  const numBalance = hasRunningBalance ? Number(item.runningBalance) : 0;
  let balanceTextColor = Colors.textSecondary;
  if (hasRunningBalance) {
    if (numBalance < 0) {
      balanceTextColor = Colors.gaveDark || '#DC2626'; // RED for negative balance
    } else if (numBalance > 0) {
      balanceTextColor = Colors.gotDark || '#059669';  // GREEN for positive balance
    } else {
      balanceTextColor = Colors.textSecondary;        // Neutral/default for zero
    }
  }

  return (
    <TouchableOpacity
      style={[
        styles.cardStrip,
        { backgroundColor: cardBg, borderColor: cardBorder },
        Shadows.sm,
      ]}
      onPress={() => onPress && onPress(item)}
      activeOpacity={0.75}
    >
      {/* Left Status Color Bar */}
      <View style={[styles.leftAccentBar, { backgroundColor: accentColor }]} />

      <View style={styles.contentContainer}>
        {/* Top Header Row: Category Badge + Mode + Date */}
        <View style={styles.topRow}>
          <View style={styles.topBadgesLeft}>
            {/* Category Badge */}
            <View style={styles.categoryBadge}>
              <Ionicons
                name={item.categoryIcon || (isGave ? 'arrow-up-circle' : 'arrow-down-circle')}
                size={13}
                color={catBadgeIconColor}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.categoryBadgeText, { color: catBadgeTextColor }]}>
                {item.categoryName || 'General'}
              </Text>
            </View>

            {/* Payment Method Badge */}
            <View style={[styles.modeBadge, { backgroundColor: modeBadgeBg }]}>
              <Ionicons
                name={isCash ? 'cash-outline' : 'card-outline'}
                size={12}
                color={modeBadgeIconColor}
                style={{ marginRight: 3 }}
              />
              <Text style={[styles.modeBadgeText, { color: modeBadgeTextColor }]}>
                {modeText}
              </Text>
            </View>
          </View>

          {/* Date & Time */}
          <View style={styles.dateContainer}>
            <Ionicons name="time-outline" size={12} color={Colors.textMuted} style={{ marginRight: 3 }} />
            <Text style={styles.dateText}>{date} · {time}</Text>
          </View>
        </View>

        {/* Middle Main Row: Title/Party + Type Pill + Amount + Running Balance */}
        <View style={styles.mainRow}>
          <View style={styles.titleInfoColumn}>
            <Text style={styles.primaryTitle} numberOfLines={1}>
              {primaryTitle}
            </Text>

            <View style={styles.typeIndicatorRow}>
              {/* You Gave / You Got Indicator Badge */}
              <View style={[styles.typePill, { backgroundColor: typeBadgeBg }]}>
                <Ionicons
                  name={isGave ? 'arrow-up' : 'arrow-down'}
                  size={12}
                  color={typeBadgeText}
                  style={{ marginRight: 2 }}
                />
                <Text style={[styles.typePillText, { color: typeBadgeText }]}>
                  {typeText}
                </Text>
              </View>

              {showCategorySub && (
                <Text style={styles.categorySubText} numberOfLines={1}>
                  · {item.categoryName}
                </Text>
              )}

              {hasImages && (
                <View style={styles.photoIndicator}>
                  <Ionicons name="camera" size={11} color={Colors.primary} />
                  <Text style={styles.photoIndicatorText}>
                    {item.imageCount} photo{item.imageCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Right Column: Amount + Running Balance after Transaction */}
          <View style={styles.amountColumn}>
            <Text style={[styles.amountText, { color: amountColor }]}>
              {isGave ? '-' : '+'}{formatCurrency(Math.abs(item.amount))}
            </Text>

            {/* Running Balance Display */}
            {hasRunningBalance && (
              <View style={styles.runningBalanceRow}>
                <Text style={styles.runningBalanceLabel}>Bal:</Text>
                <Text style={[styles.runningBalanceValue, { color: balanceTextColor }]}>
                  {formatCurrency(item.runningBalance)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Prominent, Clearly Visible Transaction Note/Remark */}
        {item.note ? (
          <TouchableOpacity
            style={styles.noteContainer}
            onPress={() => setIsNoteExpanded(!isNoteExpanded)}
            activeOpacity={0.8}
          >
            <Ionicons
              name="document-text-outline"
              size={13}
              color={Colors.textSecondary}
              style={{ marginRight: 5, marginTop: 1 }}
            />
            <Text
              style={styles.noteText}
              numberOfLines={isNoteExpanded ? undefined : 2}
            >
              {item.note}
            </Text>
            {item.note.length > 70 && (
              <Text style={styles.expandNoteHint}>
                {isNoteExpanded ? ' (less)' : ' ...more'}
              </Text>
            )}
          </TouchableOpacity>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  cardStrip: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.lg,
    marginVertical: 5,
    borderWidth: 1.2,
    overflow: 'hidden',
  },
  leftAccentBar: {
    width: 5,
  },
  contentContainer: {
    flex: 1,
    paddingVertical: Spacing.md - 1,
    paddingHorizontal: Spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  topBadgesLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs + 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
  },
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs + 2,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleInfoColumn: {
    flex: 1,
    marginRight: Spacing.md,
  },
  primaryTitle: {
    fontSize: Typography.fontSizes.md + 0.5,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: 3,
  },
  typeIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  typePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: BorderRadius.xs,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
  },
  categorySubText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
  },
  photoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    gap: 3,
  },
  photoIndicatorText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: Typography.fontWeights.bold,
  },
  amountColumn: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amountText: {
    fontSize: Typography.fontSizes.xl - 1,
    fontWeight: Typography.fontWeights.bold,
    letterSpacing: -0.3,
  },
  runningBalanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  runningBalanceLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginRight: 3,
    fontWeight: Typography.fontWeights.medium,
  },
  runningBalanceValue: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.bold,
  },
  noteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    marginTop: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  noteText: {
    flex: 1,
    fontSize: Typography.fontSizes.xs + 1,
    color: Colors.textPrimary,
    lineHeight: 18,
    fontWeight: Typography.fontWeights.medium,
  },
  expandNoteHint: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.primary,
    fontWeight: Typography.fontWeights.bold,
  },
});
