import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius } from '../../constants/theme';
import { formatCurrency, formatTimeOnly } from '../../utils/formatters';

export const TransactionRow = ({ item, onPress }) => {
  const isGave = item.type === 'gave';
  const typeText = isGave ? 'You Gave' : 'You Got';
  const modeText = item.paymentMode === 'cash' ? 'Cash' : 'Online';
  const timeText = formatTimeOnly(item.transactionDate || item.createdAt);
  
  const title = item.partyName 
    ? item.partyName 
    : (item.categoryName || 'General');

  const subtitleCategory = item.partyName && item.categoryName ? ` · ${item.categoryName}` : '';
  const hasImages = item.imageCount > 0;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress && onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.leftSection}>
        {/* Category / Mode Icon */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: isGave ? Colors.gaveBg : Colors.gotBg },
          ]}
        >
          <Ionicons
            name={item.categoryIcon || (isGave ? 'arrow-up' : 'arrow-down')}
            size={20}
            color={isGave ? Colors.gave : Colors.got}
          />
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>

          <View style={styles.metaRow}>
            <Text
              style={[
                styles.typeLabel,
                { color: isGave ? Colors.gaveDark : Colors.gotDark },
              ]}
            >
              {typeText}
            </Text>
            <Text style={styles.metaDot}> · </Text>
            
            <View
              style={[
                styles.modeBadge,
                item.paymentMode === 'cash' ? styles.cashBadge : styles.onlineBadge,
              ]}
            >
              <Text
                style={[
                  styles.modeText,
                  item.paymentMode === 'cash' ? styles.cashText : styles.onlineText,
                ]}
              >
                {modeText}
              </Text>
            </View>

            {subtitleCategory ? (
              <Text style={styles.categorySubText} numberOfLines={1}>
                {subtitleCategory}
              </Text>
            ) : null}

            {hasImages && (
              <View style={styles.imageIndicator}>
                <Ionicons name="image-outline" size={12} color={Colors.textSecondary} />
                <Text style={styles.imageCountText}>{item.imageCount}</Text>
              </View>
            )}
          </View>

          {item.note ? (
            <Text style={styles.noteText} numberOfLines={1}>
              {item.note}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.rightSection}>
        <Text
          style={[
            styles.amount,
            { color: isGave ? Colors.gave : Colors.got },
          ]}
        >
          {isGave ? '-' : '+'}{formatCurrency(item.amount)}
        </Text>
        <Text style={styles.timeText}>{timeText}</Text>
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
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'nowrap',
  },
  typeLabel: {
    fontSize: Typography.fontSizes.xs,
    fontWeight: Typography.fontWeights.bold,
  },
  metaDot: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
  },
  modeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
  },
  cashBadge: {
    backgroundColor: Colors.cashLight,
  },
  onlineBadge: {
    backgroundColor: Colors.onlineLight,
  },
  modeText: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
  },
  cashText: {
    color: '#B45309',
  },
  onlineText: {
    color: '#1D4ED8',
  },
  categorySubText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
  },
  imageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: BorderRadius.xs,
    gap: 2,
  },
  imageCountText: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.semibold,
  },
  noteText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
    fontStyle: 'italic',
  },
  rightSection: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  amount: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  timeText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
  },
});
