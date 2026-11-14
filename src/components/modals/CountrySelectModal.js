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
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { COUNTRIES, DEFAULT_COUNTRY } from '../../constants/countries';

export const CountrySelectModal = ({
  visible,
  onClose,
  selectedCountry = DEFAULT_COUNTRY,
  onSelectCountry,
}) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCountries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return COUNTRIES;

    const cleanQ = q.replace(/^\+/, '');
    return COUNTRIES.filter((c) => {
      const matchName = c.name.toLowerCase().includes(q);
      const matchDial = c.dialCode.replace(/^\+/, '').includes(cleanQ);
      const matchCode = c.code.toLowerCase().includes(q);
      return matchName || matchDial || matchCode;
    });
  }, [searchQuery]);

  const handleSelect = (item) => {
    try {
      Haptics.selectionAsync();
    } catch (e) {}

    onSelectCountry(item);
    setSearchQuery('');
    onClose();
  };

  const renderCountryItem = ({ item }) => {
    const isSelected = selectedCountry?.code === item.code && selectedCountry?.dialCode === item.dialCode;

    return (
      <TouchableOpacity
        style={[styles.countryRow, isSelected && styles.countryRowSelected]}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
      >
        <View style={styles.leftCol}>
          <Text style={styles.flagEmoji}>{item.flag}</Text>
          <View style={styles.countryInfo}>
            <Text style={[styles.countryName, isSelected && styles.countryNameSelected]}>
              {item.name}
            </Text>
            <Text style={styles.countryIso}>
              {item.code}
            </Text>
          </View>
        </View>

        <View style={styles.rightCol}>
          <View style={[styles.dialCodePill, isSelected && styles.dialCodePillSelected]}>
            <Text style={[styles.dialCodeText, isSelected && styles.dialCodeTextSelected]}>
              {item.dialCode}
            </Text>
          </View>
          {isSelected && (
            <Ionicons name="checkmark-circle" size={20} color="#16A34A" style={{ marginLeft: 8 }} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.modalCard, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <Ionicons name="earth" size={20} color={Colors.primary} />
              </View>
              <View style={{ marginLeft: 12 }}>
                <Text style={styles.headerTitle}>Select Country Code</Text>
                <Text style={styles.headerSubtitle}>
                  Choose your country for WhatsApp verification
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => {
                setSearchQuery('');
                onClose();
              }}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={styles.searchContainer}>
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by country or code (e.g. India, +91, US)..."
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              clearButtonMode="while-editing"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results Counter */}
          <View style={styles.countRow}>
            <Text style={styles.countText}>
              {filteredCountries.length} {filteredCountries.length === 1 ? 'country' : 'countries'} found
            </Text>
          </View>

          {/* Country List */}
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => `${item.code}_${item.dialCode}`}
            renderItem={renderCountryItem}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Ionicons name="globe-outline" size={40} color={Colors.textMuted} style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTitle}>No country found</Text>
                <Text style={styles.emptySub}>Try searching with another name or dialing code</Text>
              </View>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: BorderRadius.xxl,
    borderTopRightRadius: BorderRadius.xxl,
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    maxHeight: '85%',
    ...Shadows.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: Typography.fontSizes.md + 1,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: Typography.fontSizes.sm,
    color: Colors.textPrimary,
    paddingVertical: 2,
  },
  countRow: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: 2,
  },
  countText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: Typography.fontWeights.medium,
  },
  listContent: {
    paddingBottom: Spacing.lg,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.md,
  },
  countryRowSelected: {
    backgroundColor: '#F0FDF4',
  },
  leftCol: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flagEmoji: {
    fontSize: 26,
    marginRight: 12,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: Typography.fontSizes.sm + 1,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
  },
  countryNameSelected: {
    color: '#15803D',
    fontWeight: Typography.fontWeights.bold,
  },
  countryIso: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  rightCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dialCodePill: {
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  dialCodePillSelected: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  dialCodeText: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.3,
  },
  dialCodeTextSelected: {
    color: '#15803D',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  emptySub: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
    marginTop: 4,
  },
});

export default CountrySelectModal;
