import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { formatCurrency, formatInputWithCommas } from '../../utils/formatters';

export const EmiCalculatorModal = ({ visible, onClose, currency }) => {
  const insets = useSafeAreaInsets();
  const [loanAmount, setLoanAmount] = useState('100,000');
  const [interestRate, setInterestRate] = useState('10.5');
  const [tenureMonths, setTenureMonths] = useState('12');
  const [isTenureInYears, setIsTenureInYears] = useState(false);

  const symbol = currency?.symbol || '₹';

  // Calculate EMI
  const calculations = useMemo(() => {
    const P = parseFloat(loanAmount.replace(/,/g, '')) || 0;
    const annualRate = parseFloat(interestRate) || 0;
    const rawTenure = parseFloat(tenureMonths) || 0;
    const N = isTenureInYears ? rawTenure * 12 : rawTenure;

    if (P <= 0 || N <= 0) {
      return {
        emi: 0,
        totalInterest: 0,
        totalPayment: 0,
        principalPercent: 100,
        interestPercent: 0,
        monthsCount: N,
      };
    }

    if (annualRate <= 0) {
      const emi = P / N;
      return {
        emi,
        totalInterest: 0,
        totalPayment: P,
        principalPercent: 100,
        interestPercent: 0,
        monthsCount: N,
      };
    }

    // Monthly interest rate
    const r = annualRate / (12 * 100);
    // EMI = P * r * (1 + r)^N / ((1 + r)^N - 1)
    const factor = Math.pow(1 + r, N);
    const emi = (P * r * factor) / (factor - 1);
    const totalPayment = emi * N;
    const totalInterest = Math.max(0, totalPayment - P);

    const principalPercent = totalPayment > 0 ? (P / totalPayment) * 100 : 100;
    const interestPercent = totalPayment > 0 ? (totalInterest / totalPayment) * 100 : 0;

    return {
      emi,
      totalInterest,
      totalPayment,
      principalPercent,
      interestPercent,
      monthsCount: N,
    };
  }, [loanAmount, interestRate, tenureMonths, isTenureInYears]);

  const handlePresetAmount = (amt) => {
    try {
      Haptics.selectionAsync();
    } catch (e) {}
    setLoanAmount(formatInputWithCommas(String(amt)));
  };

  const handleReset = () => {
    try {
      Haptics.selectionAsync();
    } catch (e) {}
    setLoanAmount('100,000');
    setInterestRate('10.5');
    setTenureMonths('12');
    setIsTenureInYears(false);
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
              <Ionicons name="calculator-outline" size={22} color="#2563EB" />
            </View>
            <View>
              <Text style={styles.headerTitle}>EMI & Loan Calculator</Text>
              <Text style={styles.headerSubtitle}>
                Calculate monthly installments and interest
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
            {/* Calculation Result Hero Card */}
            <View style={[styles.resultHeroCard, Shadows.md]}>
              <Text style={styles.resultHeroLabel}>ESTIMATED MONTHLY INSTALLMENT</Text>
              <Text style={styles.resultHeroAmount}>
                {formatCurrency(Math.round(calculations.emi))}
                <Text style={styles.resultHeroPerMonth}> / month</Text>
              </Text>

              <View style={styles.breakdownRow}>
                <View style={styles.breakdownCol}>
                  <Text style={styles.breakdownLabel}>Total Interest</Text>
                  <Text style={[styles.breakdownValue, { color: '#DC2626' }]}>
                    {formatCurrency(Math.round(calculations.totalInterest))}
                  </Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownCol}>
                  <Text style={styles.breakdownLabel}>Total Payable</Text>
                  <Text style={[styles.breakdownValue, { color: '#1E293B' }]}>
                    {formatCurrency(Math.round(calculations.totalPayment))}
                  </Text>
                </View>
                <View style={styles.breakdownDivider} />
                <View style={styles.breakdownCol}>
                  <Text style={styles.breakdownLabel}>Total Months</Text>
                  <Text style={[styles.breakdownValue, { color: Colors.primary }]}>
                    {calculations.monthsCount}
                  </Text>
                </View>
              </View>

              {/* Progress Proportion Bar */}
              <View style={styles.proportionBarBg}>
                <View
                  style={[
                    styles.proportionBarPrincipal,
                    { width: `${calculations.principalPercent}%` },
                  ]}
                />
                <View
                  style={[
                    styles.proportionBarInterest,
                    { width: `${calculations.interestPercent}%` },
                  ]}
                />
              </View>
              <View style={styles.proportionLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#2563EB' }]} />
                  <Text style={styles.legendText}>
                    Principal ({Math.round(calculations.principalPercent)}%)
                  </Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendText}>
                    Interest ({Math.round(calculations.interestPercent)}%)
                  </Text>
                </View>
              </View>
            </View>

            {/* Inputs Form */}
            <View style={styles.card}>
              {/* 1. Loan Amount */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Loan Amount ({symbol})</Text>
                <View style={styles.inputBox}>
                  <Text style={styles.inputSymbol}>{symbol}</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0"
                    placeholderTextColor={Colors.textMuted}
                    value={loanAmount}
                    onChangeText={(t) => setLoanAmount(formatInputWithCommas(t))}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.presetRow}>
                  {[50000, 100000, 250000, 500000].map((amt) => (
                    <TouchableOpacity
                      key={amt}
                      style={styles.presetChip}
                      onPress={() => handlePresetAmount(amt)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.presetChipText}>{formatCurrency(amt)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 2. Interest Rate */}
              <View style={styles.inputGroup}>
                <Text style={styles.fieldLabel}>Annual Interest Rate (%)</Text>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    placeholder="e.g. 10.5"
                    placeholderTextColor={Colors.textMuted}
                    value={interestRate}
                    onChangeText={setInterestRate}
                    keyboardType="numeric"
                  />
                  <Text style={styles.inputUnit}>% p.a.</Text>
                </View>
              </View>

              {/* 3. Tenure */}
              <View style={styles.inputGroup}>
                <View style={styles.tenureHeaderRow}>
                  <Text style={styles.fieldLabel}>Tenure / Duration</Text>
                  <View style={styles.tenureToggle}>
                    <TouchableOpacity
                      style={[
                        styles.tenureToggleBtn,
                        !isTenureInYears && styles.tenureToggleBtnActive,
                      ]}
                      onPress={() => setIsTenureInYears(false)}
                    >
                      <Text
                        style={[
                          styles.tenureToggleText,
                          !isTenureInYears && styles.tenureToggleTextActive,
                        ]}
                      >
                        Months
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.tenureToggleBtn,
                        isTenureInYears && styles.tenureToggleBtnActive,
                      ]}
                      onPress={() => setIsTenureInYears(true)}
                    >
                      <Text
                        style={[
                          styles.tenureToggleText,
                          isTenureInYears && styles.tenureToggleTextActive,
                        ]}
                      >
                        Years
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.inputBox}>
                  <TextInput
                    style={styles.textInput}
                    placeholder={isTenureInYears ? 'e.g. 1' : 'e.g. 12'}
                    placeholderTextColor={Colors.textMuted}
                    value={tenureMonths}
                    onChangeText={setTenureMonths}
                    keyboardType="numeric"
                  />
                  <Text style={styles.inputUnit}>
                    {isTenureInYears ? 'Years' : 'Months'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Reset Button */}
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={handleReset}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={16} color={Colors.textSecondary} style={{ marginRight: 6 }} />
              <Text style={styles.resetBtnText}>Reset Calculator</Text>
            </TouchableOpacity>
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
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  resultHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resultHeroLabel: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
  },
  resultHeroAmount: {
    fontSize: 28,
    fontWeight: Typography.fontWeights.bold,
    color: '#2563EB',
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  resultHeroPerMonth: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.normal,
    color: Colors.textSecondary,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  breakdownCol: {
    flex: 1,
    alignItems: 'center',
  },
  breakdownDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  breakdownLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
  },
  breakdownValue: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    marginTop: 2,
  },
  proportionBarBg: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  proportionBarPrincipal: {
    backgroundColor: '#2563EB',
    height: '100%',
  },
  proportionBarInterest: {
    backgroundColor: '#EF4444',
    height: '100%',
  },
  proportionLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  inputGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.text,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 48,
    backgroundColor: '#FAFAFA',
  },
  inputSymbol: {
    fontSize: 18,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    marginRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.text,
    paddingVertical: 0,
  },
  inputUnit: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textMuted,
    marginLeft: 6,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  tenureHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tenureToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.full,
    padding: 2,
  },
  tenureToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  tenureToggleBtnActive: {
    backgroundColor: '#FFFFFF',
    ...Shadows.sm,
  },
  tenureToggleText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.medium,
    color: Colors.textSecondary,
  },
  tenureToggleTextActive: {
    color: '#2563EB',
    fontWeight: Typography.fontWeights.bold,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  resetBtnText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
});

