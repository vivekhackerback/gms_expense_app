import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  SectionList,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
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
 * Live Pulse Dot indicator for TODAY's section header
 * Pure static view to ensure native view hierarchy stability on Android
 */
const TodayLivePulseDot = React.memo(() => (
  <View style={styles.livePulseDot} />
));

/**
 * Sticky Date Indicator Floating Banner
 * Floats at the top of the transaction list showing the currently visible date.
 * Rendered outside SectionList to avoid any native view hierarchy virtualization issues.
 */
const StickyDateIndicator = React.memo(({ dateInfo }) => {
  if (!dateInfo) return null;

  const { primaryLabel, fullDate, isToday, isYesterday, totalGot, totalGave, count } = dateInfo;

  let iconName = 'calendar-outline';
  let iconColor = Colors.primary;
  let displayTitle = fullDate || primaryLabel;

  if (isToday) {
    iconName = 'sparkles';
    iconColor = '#059669';
    displayTitle = `Today · ${fullDate}`;
  } else if (isYesterday) {
    iconName = 'time-outline';
    iconColor = '#475569';
    displayTitle = `Yesterday · ${fullDate}`;
  }

  return (
    <View style={styles.stickyHeaderWrapper} pointerEvents="none">
      <View style={[styles.stickyDateCard, Shadows.md]}>
        <View style={styles.stickyLeftGroup}>
          <View style={[styles.stickyIconBadge, isToday && styles.todayIconBadge, isYesterday && styles.yesterdayIconBadge]}>
            <Ionicons name={iconName} size={13} color={iconColor} />
          </View>
          <Text style={styles.stickyDateText} numberOfLines={1}>
            {displayTitle}
          </Text>
        </View>

        <View style={styles.stickyRightGroup}>
          <View style={styles.stickyCountPill}>
            <Text style={styles.stickyCountText}>{count} txn{count > 1 ? 's' : ''}</Text>
          </View>
          {(totalGot > 0 || totalGave > 0) && (
            <View style={styles.stickyAmountsRow}>
              {totalGot > 0 && (
                <Text style={styles.stickyGotAmount}>+{formatCurrency(totalGot)}</Text>
              )}
              {totalGot > 0 && totalGave > 0 && (
                <Text style={styles.stickyAmountDot}>·</Text>
              )}
              {totalGave > 0 && (
                <Text style={styles.stickyGaveAmount}>-{formatCurrency(totalGave)}</Text>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
});

/**
 * Memoized Date Section Header
 * Zero JS-thread animation loops for instant 60fps scrolling
 */
const DateHeader = React.memo(({ section }) => {
  const { primaryLabel, fullDate, isToday, isYesterday, totalGot, totalGave, count, dateObj } = section;

  const dayNumber = dateObj ? dateObj.getDate() : '';
  const monthShort = dateObj ? MONTH_NAMES_SHORT[dateObj.getMonth()] : '';

  let cardBg = '#FFFFFF';
  let cardBorder = '#E2E8F0';
  let calHeaderBg = Colors.primary;
  let iconName = 'calendar-outline';
  let iconColor = Colors.primary;
  let badgeTextStyle = styles.standardBadgeText;

  if (isToday) {
    iconName = 'sparkles';
    iconColor = '#059669';
    badgeTextStyle = styles.todayBadgeText;
    cardBg = '#F0FDF4';
    cardBorder = '#BBF7D0';
    calHeaderBg = '#059669';
  } else if (isYesterday) {
    iconName = 'time-outline';
    iconColor = '#475569';
    badgeTextStyle = styles.yesterdayBadgeText;
    cardBg = '#F8FAFC';
    cardBorder = '#E2E8F0';
    calHeaderBg = '#475569';
  }

  return (
    <View style={styles.sectionHeaderContainer}>
      <View
        style={[
          styles.dateCard,
          Shadows.sm,
          {
            backgroundColor: cardBg,
            borderColor: cardBorder,
          },
        ]}
      >
        {/* Mini Calendar Tile */}
        <View style={styles.calendarMiniBlock}>
          <View
            style={[
              styles.calendarMiniHeader,
              { backgroundColor: calHeaderBg },
            ]}
          >
            <Text style={styles.calendarMiniMonth}>{monthShort}</Text>
          </View>
          <View style={styles.calendarMiniBody}>
            <Text style={styles.calendarMiniDay}>{dayNumber}</Text>
          </View>
        </View>

        {/* Date Label & Subtitle */}
        <View style={styles.dateInfoGroup}>
          <View style={styles.dateLabelRow}>
            <Ionicons name={iconName} size={13} color={iconColor} style={{ marginRight: 4 }} />
            <Text style={[styles.datePrimaryLabel, badgeTextStyle]}>{primaryLabel}</Text>
            {isToday && <TodayLivePulseDot />}
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
      </View>
    </View>
  );
});

export const TransactionList = ({
  transactions = [],
  onTransactionPress,
  refreshing = false,
  onRefresh,
  onEndReached,
  onEndReachedThreshold = 0.5,
  isLoadingMore = false,
  hasMore = true,
  ListHeaderComponent,
  ListEmptyComponent,
}) => {
  // Group transactions into rich sections by date with stats
  const sections = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];

    const map = new Map();

    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      let dateKey = tx.txDateOnly;
      let dateObj = null;

      if (!dateKey) {
        const rawDate = tx.transactionDate || tx.createdAt;
        dateObj = parseToDate(rawDate);
        dateKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
      }

      let entry = map.get(dateKey);
      if (!entry) {
        if (!dateObj) {
          const rawDate = tx.transactionDate || tx.createdAt;
          dateObj = parseToDate(rawDate);
        }
        entry = {
          dateObj,
          dateKey,
          items: [],
          totalGot: 0,
          totalGave: 0,
        };
        map.set(dateKey, entry);
      }
      
      entry.items.push(tx);
      const amt = Number(tx.amount) || 0;
      if (tx.type === 'got') entry.totalGot += amt;
      else if (tx.type === 'gave') entry.totalGave += amt;
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return Array.from(map.values()).map((group) => {
      const isToday = group.dateKey === todayStr;
      const isYesterday = group.dateKey === yesterdayStr;
      
      let primaryLabel = '';
      if (isToday) primaryLabel = 'TODAY';
      else if (isYesterday) primaryLabel = 'YESTERDAY';
      else {
        primaryLabel = `${days[group.dateObj.getDay()]}, ${group.dateObj.getDate()} ${MONTH_NAMES_SHORT[group.dateObj.getMonth()]}`;
      }

      const fullDate = formatDayNameFullDate(group.dateObj);

      return {
        key: `sec_${group.dateKey}`,
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

  const [activeDate, setActiveDate] = useState(null);
  const lastKeyRef = useRef(null);

  // Sync initial top section whenever sections change
  useEffect(() => {
    if (sections && sections.length > 0) {
      const topSec = sections[0];
      lastKeyRef.current = topSec.key;
      setActiveDate({
        key: topSec.key,
        primaryLabel: topSec.primaryLabel,
        fullDate: topSec.fullDate,
        isToday: topSec.isToday,
        isYesterday: topSec.isYesterday,
        totalGot: topSec.totalGot,
        totalGave: topSec.totalGave,
        count: topSec.count,
      });
    } else {
      lastKeyRef.current = null;
      setActiveDate(null);
    }
  }, [sections]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 10,
    waitForInteraction: false,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (!viewableItems || viewableItems.length === 0) return;

    const first = viewableItems[0];
    let sec = first.section;
    if (!sec && first.item) {
      const rawDate = first.item.txDateOnly || first.item.transactionDate;
      if (rawDate) {
        sec = sections.find((s) => s.key && s.key.includes(String(rawDate)));
      }
    }

    if (sec && sec.key && sec.key !== lastKeyRef.current) {
      lastKeyRef.current = sec.key;
      setActiveDate({
        key: sec.key,
        primaryLabel: sec.primaryLabel,
        fullDate: sec.fullDate,
        isToday: sec.isToday,
        isYesterday: sec.isYesterday,
        totalGot: sec.totalGot,
        totalGave: sec.totalGave,
        count: sec.count,
      });
    }
  }).current;

  const renderSectionHeader = useCallback(({ section }) => (
    <DateHeader section={section} />
  ), []);

  const renderItem = useCallback(({ item }) => (
    <TransactionRow item={item} onPress={onTransactionPress} />
  ), [onTransactionPress]);

  const keyExtractor = useCallback((item, index) => {
    return `tx_${item.id != null ? item.id : (item.uuid || index)}`;
  }, []);

  const renderFooter = useCallback(() => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color={Colors.primary} />
          <Text style={styles.footerLoaderText}>Loading older transactions...</Text>
        </View>
      );
    }
    if (transactions.length > 0 && !hasMore) {
      return (
        <View style={styles.footerEnd}>
          <Text style={styles.footerEndText}>All transactions loaded</Text>
        </View>
      );
    }
    return <View style={styles.footerSpacer} />;
  }, [isLoadingMore, hasMore, transactions.length]);

  return (
    <View style={styles.listWrapper}>
      {activeDate && sections.length > 0 && (
        <StickyDateIndicator dateInfo={activeDate} />
      )}
      <SectionList
        sections={sections}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        stickySectionHeadersEnabled={Platform.OS === 'ios'}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={renderFooter}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
        initialNumToRender={15}
        maxToRenderPerBatch={15}
        windowSize={7}
        updateCellsBatchingPeriod={50}
        removeClippedSubviews={false}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
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
    </View>
  );
};

const styles = StyleSheet.create({
  listWrapper: {
    flex: 1,
    position: 'relative',
  },
  stickyHeaderWrapper: {
    position: 'absolute',
    top: 6,
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 100,
    elevation: 8,
  },
  stickyDateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  stickyLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.sm,
  },
  stickyIconBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs + 2,
  },
  todayIconBadge: {
    backgroundColor: '#ECFDF5',
  },
  yesterdayIconBadge: {
    backgroundColor: '#F1F5F9',
  },
  stickyDateText: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  stickyRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stickyCountPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: BorderRadius.full,
  },
  stickyCountText: {
    fontSize: 9.5,
    fontWeight: Typography.fontWeights.bold,
    color: '#475569',
  },
  stickyAmountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stickyGotAmount: {
    fontSize: 10.5,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.got,
  },
  stickyGaveAmount: {
    fontSize: 10.5,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.gave,
  },
  stickyAmountDot: {
    fontSize: 9,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textMuted,
    marginHorizontal: 2,
  },
  listContent: {
    paddingTop: 46, // Clearance for floating sticky date indicator
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
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: 8,
  },
  footerLoaderText: {
    fontSize: Typography.fontSizes.xs + 1,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
  },
  footerEnd: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
  },
  footerEndText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    fontWeight: Typography.fontWeights.medium,
  },
  footerSpacer: {
    height: 16,
  },
});
