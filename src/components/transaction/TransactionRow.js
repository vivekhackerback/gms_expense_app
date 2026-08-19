import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { formatCurrency, formatFullDateTime } from '../../utils/formatters';

export const TransactionRow = ({ item, onPress }) => {
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

  const cardBg = isGave ? '#FEF2F2' : '#ECFDF5';
  const cardBorder = isGave ? '#FEE2E2' : '#D1FAE5';
  const accentColor = isGave ? '#EF4444' : '#10B981';
  const amountColor = isGave ? '#DC2626' : '#059669';
  const typeBadgeBg = isGave ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)';
  const typeBadgeText = isGave ? '#DC2626' : '#059669';

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
      {/* Left Colored Status Accent Bar */}
      <View style={[styles.leftAccentBar, { backgroundColor: accentColor }]} />

      <View style={styles.contentContainer}>
        {/* Top Header Row: Category Badge + Mode + Date/Time */}
        <View style={styles.topRow}>
          <View style={styles.topBadgesLeft}>
            {/* Category Badge */}
            <View style={styles.categoryBadge}>
              <Ionicons
                name={item.categoryIcon || (isGave ? 'arrow-up-circle' : 'arrow-down-circle')}
                size={13}
                color={item.categoryColor || Colors.primary}
                style={{ marginRight: 4 }}
              />
              <Text style={[styles.categoryBadgeText, { color: item.categoryColor || Colors.textPrimary }]}>
                {item.categoryName || 'General'}
              </Text>
            </View>

            {/* Payment Method Badge */}
            <View style={[styles.modeBadge, isCash ? styles.cashModeBadge : styles.onlineModeBadge]}>
              <Ionicons
                name={isCash ? 'cash-outline' : 'card-outline'}
                size={12}
                color={isCash ? '#B45309' : '#1D4ED8'}
                style={{ marginRight: 3 }}
              />
              <Text style={[styles.modeBadgeText, isCash ? styles.cashModeText : styles.onlineModeText]}>
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

        {/* Middle Main Row: Party/Title + Type Indicator + Amount */}
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
                  <Ionicons name="camera-outline" size={11} color={Colors.textSecondary} />
                  <Text style={styles.photoIndicatorText}>{item.imageCount}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Amount Display */}
          <View style={styles.amountColumn}>
            <Text style={[styles.amountText, { color: amountColor }]}>
              {isGave ? '-' : '+'}{formatCurrency(item.amount)}
            </Text>
          </View>
        </View>

        {/* Bottom Note/Remark Row (if note exists) */}
        {item.note ? (
          <View style={styles.noteRow}>
            <Ionicons name="chatbubble-ellipses-outline" size={12} color={Colors.textMuted} style={{ marginRight: 4, marginTop: 1 }} />
            <Text style={styles.noteText} numberOfLines={2}>
              {item.note}
            </Text>
          </View>
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
    borderWidth: 1,
    overflow: 'hidden',
  },
  leftAccentBar: {
    width: 5,
  },
  contentContainer: {
    flex: 1,
    paddingVertical: Spacing.md - 2,
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
  cashModeBadge: {
    backgroundColor: Colors.cashLight,
  },
  onlineModeBadge: {
    backgroundColor: Colors.onlineLight,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
  },
  cashModeText: {
    color: '#B45309',
  },
  onlineModeText: {
    color: '#1D4ED8',
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
    backgroundColor: 'rgba(0,0,0,0.04)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
    gap: 2,
  },
  photoIndicatorText: {
    fontSize: 10,
    color: Colors.textSecondary,
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
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.65)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs + 2,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
  },
  noteText: {
    flex: 1,
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 16,
  },
});
