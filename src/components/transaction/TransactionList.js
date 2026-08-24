import React, { useMemo, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, SectionList, RefreshControl, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { formatCurrency, formatDayNameFullDate, parseToDate } from '../../utils/formatters';
import { TransactionRow } from './TransactionRow';

const MONTH_NAMES_SHORT = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
];

/**
 * Animated Date Section Header
 * Provides smooth, professional color transitions on the calendar tile and border
 */
const AnimatedDateHeader = ({ section }) => {
  const { primaryLabel, fullDate, isToday, isYesterday, totalGot, totalGave, count, dateObj } = section;

  // Animation value for gentle breathing color & border transition (0 -> 1 -> 0)
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: isToday ? 2000 : 2800,
          useNativeDriver: false,
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: isToday ? 2000 : 2800,
          useNativeDriver: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animValue, isToday]);

  const dayNumber = dateObj ? dateObj.getDate() : '';
  const monthShort = dateObj ? MONTH_NAMES_SHORT[dateObj.getMonth()] : '';

  // Interpolated colors based on section type
  let animatedBgColor;
  let animatedBorderColor;
  let animatedCalHeaderBg;
  let iconName = 'calendar-outline';
  let iconColor = Colors.primary;
  let badgeTextStyle = styles.standardBadgeText;

  if (isToday) {
    iconName = 'sparkles';
    iconColor = '#059669';
    badgeTextStyle = styles.todayBadgeText;

    animatedBgColor = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['#F0FDF4', '#DCFCE7'],
    });
    animatedBorderColor = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['#BBF7D0', '#86EFAC'],
    });
    animatedCalHeaderBg = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['#059669', '#10B981'],
    });
  } else if (isYesterday) {
    iconName = 'time-outline';
    iconColor = '#475569';
    badgeTextStyle = styles.yesterdayBadgeText;

    animatedBgColor = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['#F8FAFC', '#F1F5F9'],
    });
    animatedBorderColor = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['#E2E8F0', '#CBD5E1'],
    });
    animatedCalHeaderBg = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['#475569', '#64748B'],
    });
  } else {
    animatedBgColor = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['#FFFFFF', '#F8FAFC'],
    });
    animatedBorderColor = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['#E2E8F0', '#CBD5E1'],
    });
    animatedCalHeaderBg = animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [Colors.primary, '#2563EB'],
    });
  }

  // Smooth subtle pulse for live dot
  const dotOpacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 1.0],
  });
  const dotScale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1.15],
  });

  return (
    <View style={styles.sectionHeaderContainer}>
      {/* Animated Date Separator Card */}
      <Animated.View
        style={[
          styles.dateCard,
          Shadows.sm,
          {
            backgroundColor: animatedBgColor,
            borderColor: animatedBorderColor,
          },
        ]}
      >
        {/* Animated Mini Calendar Tile */}
        <View style={styles.calendarMiniBlock}>
          <Animated.View
            style={[
              styles.calendarMiniHeader,
              { backgroundColor: animatedCalHeaderBg },
            ]}
          >
            <Text style={styles.calendarMiniMonth}>{monthShort}</Text>
          </Animated.View>
          <View style={styles.calendarMiniBody}>
            <Text style={styles.calendarMiniDay}>{dayNumber}</Text>
          </View>
        </View>

        {/* Date Label & Subtitle */}
        <View style={styles.dateInfoGroup}>
          <View style={styles.dateLabelRow}>
            <Ionicons name={iconName} size={13} color={iconColor} style={{ marginRight: 4 }} />
            <Text style={[styles.datePrimaryLabel, badgeTextStyle]}>{primaryLabel}</Text>
            {isToday && (
              <Animated.View
                style={[
                  styles.livePulseDot,
                  {
                    opacity: dotOpacity,
                    transform: [{ scale: dotScale }],
                  },
                ]}
              />
            )}
          </View>
          <Text style={styles.dateFullText} numberOfLines={1}>{fullDate}</Text>
        </View>

        {/* Daily Summary Stats Pill */}
        <View style={styles.dailyStatsContainer}>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>{count} txn{count > 1 ? 's' : ''}</Text>
          </View>
          {(totalGot > 0 || totalGave > 0) && (
            <View style={styles.dailyAmountsRow}>
              {totalGot > 0 && (
                <Text style={styles.dailyGotAmount}>+{formatCurrency(totalGot)}</Text>
              )}
              {totalGot > 0 && totalGave > 0 && (
                <Text style={styles.amountDividerDot}>·</Text>
              )}
              {totalGave > 0 && (
                <Text style={styles.dailyGaveAmount}>-{formatCurrency(totalGave)}</Text>
              )}
            </View>
          )}
        </View>
      </Animated.View>
    </View>
  );
};

export const TransactionList = ({
  transactions = [],
  onTransactionPress,
  refreshing = false,
  onRefresh,
  ListHeaderComponent,
  ListEmptyComponent,
}) => {
  // Group transactions into rich sections by date with stats
  const sections = useMemo(() => {
    const map = new Map();

    for (const tx of transactions) {
      const rawDate = tx.transactionDate || tx.createdAt;
      const dateObj = parseToDate(rawDate);
      const dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      
      if (!map.has(dateKey)) {
        map.set(dateKey, {
          dateObj,
          dateKey,
          items: [],
          totalGot: 0,
          totalGave: 0,
        });
      }
      const entry = map.get(dateKey);
      entry.items.push(tx);
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'got') entry.totalGot += amt;
      else if (tx.type === 'gave') entry.totalGave += amt;
    }

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    return Array.from(map.values()).map((group) => {
      const isToday = group.dateKey === todayStr;
      const isYesterday = group.dateKey === yesterdayStr;
      
      let primaryLabel = '';
      if (isToday) primaryLabel = 'TODAY';
      else if (isYesterday) primaryLabel = 'YESTERDAY';
      else {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        primaryLabel = `${days[group.dateObj.getDay()]}, ${group.dateObj.getDate()} ${MONTH_NAMES_SHORT[group.dateObj.getMonth()]}`;
      }

      const fullDate = formatDayNameFullDate(group.dateObj);

      return {
        key: group.dateKey,
        primaryLabel,
        fullDate,
        dateObj: group.dateObj,
        isToday,
        isYesterday,
        totalGot: group.totalGot,
        totalGave: group.totalGave,
        count: group.items.length,
        data: group.items,
      };
    });
  }, [transactions]);

  const renderSectionHeader = ({ section }) => (
    <AnimatedDateHeader section={section} />
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
  sectionHeaderContainer: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.xs,
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 7,
    borderWidth: 1,
  },
  calendarMiniBlock: {
    width: 36,
    height: 38,
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    marginRight: Spacing.sm + 2,
  },
  calendarMiniHeader: {
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarMiniMonth: {
    fontSize: 8,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  calendarMiniBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  calendarMiniDay: {
    fontSize: 14,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginTop: -1,
  },
  dateInfoGroup: {
    flex: 1,
    justifyContent: 'center',
  },
  dateLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  datePrimaryLabel: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    letterSpacing: 0.3,
  },
  todayBadgeText: {
    color: '#065F46',
  },
  yesterdayBadgeText: {
    color: '#334155',
  },
  standardBadgeText: {
    color: Colors.textPrimary,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    marginLeft: 5,
  },
  dateFullText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.medium,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  dailyStatsContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: Spacing.xs,
  },
  countPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  countPillText: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
    color: '#475569',
  },
  dailyAmountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dailyGotAmount: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.got,
  },
  dailyGaveAmount: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.gave,
  },
  amountDividerDot: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textMuted,
    marginHorizontal: 3,
  },
});
