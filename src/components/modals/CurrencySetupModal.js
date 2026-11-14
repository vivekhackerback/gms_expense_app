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
import { SUPPORTED_CURRENCIES, DEFAULT_CURRENCY } from '../../constants/currencies';
import { formatCurrency } from '../../utils/formatters';

export const CurrencySetupModal = ({
  visible,
  onComplete,
  initialCurrency = DEFAULT_CURRENCY,
}) => {
  const insets = useSafeAreaInsets();
  const [selectedCurrency, setSelectedCurrency] = useState(initialCurrency || DEFAULT_CURRENCY);
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
    setSelectedCurrency(item);
  };

  const handleConfirm = () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}

    if (Platform.OS === 'android') {
      try {
        ToastAndroid.show(`Currency set to ${selectedCurrency.name} (${selectedCurrency.symbol})`, ToastAndroid.SHORT);
      } catch (e) {}
    }

    onComplete(selectedCurrency);
  };

  const previewAmountFormatted = formatCurrency(15420, {
    symbol: selectedCurrency.symbol,
    code: selectedCurrency.code,
  });

  const renderCurrencyItem = ({ item }) => {
    const isSelected =
      selectedCurrency?.code === item.code &&
      selectedCurrency?.name === item.name;

    return (
      <TouchableOpacity
        style={[
          styles.currencyRow,
          isSelected && styles.currencyRowSelected,
        ]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        {/* Left: Flag & Country Details */}
        <View style={styles.leftCol}>
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

        {/* Right: Symbol Pill & Radio / Checkmark */}
        <View style={styles.rightCol}>
          <View style={[styles.symbolPill, isSelected && styles.symbolPillSelected]}>
            <Text style={[styles.symbolPillText, isSelected && styles.symbolPillTextSelected]}>
              {item.symbol}
            </Text>
          </View>
          <View style={[styles.radioCircle, isSelected && styles.radioCircleSelected]}>
            {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      transparent={false}
      statusBarTranslucent={false}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        {/* Onboarding Welcome Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="cash-outline" size={28} color={Colors.primary} />
          </View>
          <Text style={styles.welcomeTitle}>Welcome to Expenses Khata 👋</Text>
          <Text style={styles.welcomeSubtitle}>
            Select your preferred currency for setup. All transactions, budgets, reports, and khata entries will automatically display this symbol.
          </Text>
        </View>

        {/* Live Selection & Preview Banner */}
        <View style={[styles.previewCard, Shadows.sm]}>
          <View style={styles.previewLeft}>
            <Text style={styles.previewFlag}>{selectedCurrency.flag || '🇮🇳'}</Text>
            <View>
              <Text style={styles.previewSubTitle}>SELECTED CURRENCY</Text>
              <Text style={styles.previewTitle}>
                {selectedCurrency.name} ({selectedCurrency.code})
              </Text>
            </View>
          </View>
          <View style={styles.previewRight}>
            <Text style={styles.previewExampleLabel}>Live Preview</Text>
            <Text style={styles.previewAmountText}>{previewAmountFormatted}</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search currency by country or code (USD, EUR, INR)..."
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
        </View>

        {/* List of Currencies */}
        <FlatList
          data={filteredCurrencies}
          keyExtractor={(item) => `${item.no}-${item.code}-${item.name}`}
          renderItem={renderCurrencyItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom, 20) + 90 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No matching currency found</Text>
              <Text style={styles.emptySubtitle}>Try searching by country or currency code</Text>
            </View>
          }
        />

        {/* Fixed Confirm Button at Bottom */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmButtonText}>
              Confirm & Start Tracking ({selectedCurrency.symbol})
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
        </View>
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
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  welcomeTitle: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: Typography.fontSizes.sm,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.md,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: '#3B82F6',
  },
  previewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  previewFlag: {
    fontSize: 32,
    marginRight: Spacing.md,
  },
  previewSubTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: 0.8,
  },
  previewTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: '#0F172A',
  },
  previewRight: {
    alignItems: 'flex-end',
    backgroundColor: '#EFF6FF',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.md,
  },
  previewExampleLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  previewAmountText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSizes.sm,
    color: '#0F172A',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  currencyRowSelected: {
    backgroundColor: '#F0F9FF',
    borderColor: '#0284C7',
    borderWidth: 1.5,
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flagEmoji: {
    fontSize: 26,
    marginRight: Spacing.md,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: Typography.fontSizes.sm + 1,
    fontWeight: Typography.fontWeights.medium,
    color: '#0F172A',
  },
  countryNameSelected: {
    fontWeight: Typography.fontWeights.bold,
    color: '#0369A1',
  },
  currencyCode: {
    fontSize: Typography.fontSizes.xs,
    color: '#64748B',
    marginTop: 2,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  symbolPill: {
    minWidth: 42,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolPillSelected: {
    backgroundColor: '#E0F2FE',
  },
  symbolPillText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: '#334155',
  },
  symbolPillTextSelected: {
    color: '#0284C7',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleSelected: {
    borderColor: '#0284C7',
    backgroundColor: '#0284C7',
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: '#475569',
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: Typography.fontSizes.xs,
    color: '#94A3B8',
    marginTop: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    ...Shadows.lg,
  },
  confirmButton: {
    backgroundColor: '#2563EB',
    height: 48,
    borderRadius: BorderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
});
