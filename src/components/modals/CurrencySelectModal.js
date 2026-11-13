import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  FlatList,
  TextInput,
  Platform,
  ToastAndroid,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { SUPPORTED_CURRENCIES } from '../../constants/currencies';

export const CurrencySelectModal = ({
  visible,
  onClose,
  currentCurrency,
  onSelectCurrency,
}) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCurrencies = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SUPPORTED_CURRENCIES;
    return SUPPORTED_CURRENCIES.filter((item) => {
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.symbol.toLowerCase().includes(q) ||
        String(item.no).includes(q)
      );
    });
  }, [searchQuery]);

  const handleSelect = (item) => {
    try {
      Haptics.selectionAsync();
    } catch (e) {}

    onSelectCurrency(item);

    if (Platform.OS === 'android') {
      ToastAndroid.show(`Currency set to ${item.name} (${item.symbol})`, ToastAndroid.SHORT);
    }
    onClose();
  };

  const renderCurrencyItem = ({ item }) => {
    const isSelected =
      currentCurrency?.code === item.code &&
      currentCurrency?.name === item.name;

    return (
      <TouchableOpacity
        style={[
          styles.currencyRow,
          isSelected && styles.currencyRowSelected,
        ]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        {/* Left: Number + Flag */}
        <View style={styles.leftCol}>
          <View style={[styles.numberBadge, isSelected && styles.numberBadgeSelected]}>
            <Text style={[styles.numberText, isSelected && styles.numberTextSelected]}>
              #{item.no}
            </Text>
          </View>
          <Text style={styles.flagEmoji}>{item.flag}</Text>
          <View style={styles.countryInfo}>
            <Text style={[styles.countryName, isSelected && styles.countryNameSelected]}>
              {item.name}
            </Text>
            <Text style={styles.currencyCode}>
              {item.code} • {item.symbol}
            </Text>
          </View>
        </View>

        {/* Right: Symbol Pill & Selection Icon */}
        <View style={styles.rightCol}>
          <View style={[styles.symbolPill, isSelected && styles.symbolPillSelected]}>
            <Text style={[styles.symbolPillText, isSelected && styles.symbolPillTextSelected]}>
              {item.symbol}
            </Text>
          </View>
          {isSelected ? (
            <Ionicons name="checkmark-circle" size={22} color={Colors.primary} style={styles.checkIcon} />
          ) : (
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} style={styles.checkIcon} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <View style={styles.headerIconBox}>
              <Ionicons name="globe-outline" size={22} color={Colors.primary} />
            </View>
            <View>
              <Text style={styles.headerTitle}>Choose Currency</Text>
              <Text style={styles.headerSubtitle}>
                Select country & currency for expense tracking
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Active Currency Summary Card */}
        {currentCurrency && (
          <View style={styles.activeBanner}>
            <View style={styles.activeBannerLeft}>
              <Text style={styles.activeBannerFlag}>{currentCurrency.flag || '🇮🇳'}</Text>
              <View>
                <Text style={styles.activeBannerLabel}>CURRENT CURRENCY</Text>
                <Text style={styles.activeBannerValue}>
                  {currentCurrency.name} ({currentCurrency.code})
                </Text>
              </View>
            </View>
            <View style={styles.activeBannerSymbol}>
              <Text style={styles.activeBannerSymbolText}>{currentCurrency.symbol || '₹'}</Text>
            </View>
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search 46 countries (e.g. USA, UK, INR, $)..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.resultsCount}>
            {filteredCurrencies.length} {filteredCurrencies.length === 1 ? 'country' : 'countries'}
          </Text>
        </View>

        {/* Currencies List */}
        <FlatList
          data={filteredCurrencies}
          keyExtractor={(item) => `${item.no}-${item.code}-${item.name}`}
          renderItem={renderCurrencyItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 20 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No matching country found</Text>
              <Text style={styles.emptySubtitle}>
                Try searching by country name, currency code (e.g., USD, EUR, INR) or symbol.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  headerIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  activeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: '#EFF6FF',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  activeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  activeBannerFlag: {
    fontSize: 26,
  },
  activeBannerLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
    color: '#2563EB',
    letterSpacing: 0.6,
  },
  activeBannerValue: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: '#1E293B',
    marginTop: 1,
  },
  activeBannerSymbol: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  activeBannerSymbolText: {
    fontSize: 18,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSizes.sm,
    color: Colors.text,
    paddingVertical: 0,
  },
  resultsCount: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 6,
    marginLeft: 4,
    fontWeight: Typography.fontWeights.medium,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    gap: 8,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  currencyRowSelected: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
    borderWidth: 1.5,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
  },
  numberBadge: {
    width: 28,
    height: 24,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberBadgeSelected: {
    backgroundColor: '#DCFCE7',
  },
  numberText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
  },
  numberTextSelected: {
    color: '#15803D',
  },
  flagEmoji: {
    fontSize: 26,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.text,
  },
  countryNameSelected: {
    color: '#15803D',
    fontWeight: Typography.fontWeights.bold,
  },
  currencyCode: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbolPill: {
    minWidth: 38,
    paddingHorizontal: 8,
    height: 30,
    borderRadius: 15,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolPillSelected: {
    backgroundColor: '#22C55E',
  },
  symbolPillText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
  },
  symbolPillTextSelected: {
    color: '#FFFFFF',
  },
  checkIcon: {
    marginLeft: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
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

