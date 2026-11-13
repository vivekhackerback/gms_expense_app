import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Platform,
  ToastAndroid,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { formatCurrency, formatInputWithCommas } from '../../utils/formatters';

export const MonthlyBudgetModal = ({
  visible,
  onClose,
  currentBudget,
  onSaveBudget,
  currentSpent = 0,
  currency,
}) => {
  const insets = useSafeAreaInsets();
  const [budgetInput, setBudgetInput] = useState('');

  const symbol = currency?.symbol || '₹';

  useEffect(() => {
    if (visible) {
      if (currentBudget > 0) {
        setBudgetInput(formatInputWithCommas(String(currentBudget)));
      } else {
        setBudgetInput('');
      }
    }
  }, [visible, currentBudget]);

  const handlePreset = (amount) => {
    try {
      Haptics.selectionAsync();
    } catch (e) {}
    setBudgetInput(formatInputWithCommas(String(amount)));
  };

  const handleSave = () => {
    const clean = parseFloat(budgetInput.replace(/,/g, '')) || 0;
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {}

    onSaveBudget(clean);
    if (Platform.OS === 'android') {
      ToastAndroid.show(
        clean > 0 ? `Monthly budget set to ${formatCurrency(clean)}!` : 'Monthly budget removed.',
        ToastAndroid.SHORT
      );
    }
    onClose();
  };

  const handleClear = () => {
    try {
      Haptics.selectionAsync();
    } catch (e) {}
    onSaveBudget(0);
    if (Platform.OS === 'android') {
      ToastAndroid.show('Monthly budget removed.', ToastAndroid.SHORT);
    }
    onClose();
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
              <Ionicons name="pie-chart-outline" size={22} color="#059669" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Monthly Budget Target</Text>
              <Text style={styles.headerSubtitle}>
                Control and monitor your spending limit
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: Math.max(insets.bottom, 24) + 20 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {/* Current Spend Card */}
            <View style={styles.spentSummaryCard}>
              <View>
                <Text style={styles.spentSummaryLabel}>THIS MONTH'S SPENDING</Text>
                <Text style={styles.spentSummaryAmount}>{formatCurrency(currentSpent)}</Text>
              </View>
              <View style={styles.spentIconWrap}>
                <Ionicons name="wallet-outline" size={24} color="#059669" />
              </View>
            </View>

            {/* Input Card */}
            <View style={styles.card}>
              <Text style={styles.fieldLabel}>Set Monthly Spending Limit</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.symbolText}>{symbol}</Text>
                <TextInput
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  value={budgetInput}
                  onChangeText={(text) => setBudgetInput(formatInputWithCommas(text))}
                  keyboardType="numeric"
                  autoFocus
                />
              </View>

              {/* Preset Quick Chips */}
              <Text style={styles.presetHeading}>Quick Preset Targets</Text>
              <View style={styles.presetRow}>
                {[10000, 25000, 50000, 100000].map((amt) => (
                  <TouchableOpacity
                    key={amt}
                    style={styles.presetChip}
                    onPress={() => handlePreset(amt)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.presetChipText}>{formatCurrency(amt)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Action Buttons */}
            <TouchableOpacity
              style={[styles.saveBtn, Shadows.sm]}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.saveBtnText}>
                {budgetInput.trim() && parseFloat(budgetInput.replace(/,/g, '')) > 0
                  ? 'Save Budget Target'
                  : 'Clear Budget'}
              </Text>
            </TouchableOpacity>

            {currentBudget > 0 && (
              <TouchableOpacity
                style={styles.clearBtn}
                onPress={handleClear}
                activeOpacity={0.7}
              >
                <Text style={styles.clearBtnText}>Remove Budget Target</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
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
    backgroundColor: '#ECFDF5',
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
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  spentSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ECFDF5',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  spentSummaryLabel: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: '#065F46',
    letterSpacing: 0.8,
  },
  spentSummaryAmount: {
    fontSize: 22,
    fontWeight: Typography.fontWeights.bold,
    color: '#047857',
    marginTop: 2,
  },
  spentIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  fieldLabel: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  amountInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 52,
    backgroundColor: '#FAFAFA',
  },
  symbolText: {
    fontSize: 22,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    fontSize: 22,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
    paddingVertical: 0,
  },
  presetHeading: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.text,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
  },
  saveBtnText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  clearBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  clearBtnText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.danger,
  },
});

