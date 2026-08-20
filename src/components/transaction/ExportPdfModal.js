import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors } from '../../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../../constants/theme';
import { formatCurrency, getDateRangePreset } from '../../utils/formatters';
import { getTransactions } from '../../database/queries';
import { exportTransactionsToPDF } from '../../services/exportService';

const DATE_PRESETS = [
  { id: 'all', label: 'All Time' },
  { id: 'this_month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'this_week', label: 'This Week' },
  { id: 'last_week', label: 'Last Week' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'custom', label: 'Custom Range 📅' },
];

const TYPE_OPTIONS = [
  { id: 'all', label: 'All Types' },
  { id: 'gave', label: 'You Gave' },
  { id: 'got', label: 'You Got' },
];

const MODE_OPTIONS = [
  { id: 'all', label: 'All Modes' },
  { id: 'cash', label: 'Cash' },
  { id: 'online', label: 'Online' },
];

export const ExportPdfModal = ({ visible, onClose, initialDateFilter = 'all' }) => {
  const [selectedPreset, setSelectedPreset] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedMode, setSelectedMode] = useState('all');

  // Custom date state
  const now = new Date();
  const [startDay, setStartDay] = useState(1);
  const [startMonth, setStartMonth] = useState(now.getMonth() + 1);
  const [startYear, setStartYear] = useState(now.getFullYear());

  const [endDay, setEndDay] = useState(now.getDate());
  const [endMonth, setEndMonth] = useState(now.getMonth() + 1);
  const [endYear, setEndYear] = useState(now.getFullYear());

  const [customStartDate, setCustomStartDate] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
  );
  const [customEndDate, setCustomEndDate] = useState(now.toISOString().split('T')[0]);

  const [isExporting, setIsExporting] = useState(false);

  // Sync with initial date filter when opened
  useEffect(() => {
    if (visible) {
      setSelectedPreset(initialDateFilter || 'all');
    }
  }, [visible, initialDateFilter]);

  // Update custom dates when date inputs change
  useEffect(() => {
    const sM = String(Math.min(Math.max(Number(startMonth) || 1, 1), 12)).padStart(2, '0');
    const sD = String(Math.min(Math.max(Number(startDay) || 1, 1), 31)).padStart(2, '0');
    const sY = String(startYear || 2026);

    const eM = String(Math.min(Math.max(Number(endMonth) || 1, 1), 12)).padStart(2, '0');
    const eD = String(Math.min(Math.max(Number(endDay) || 1, 1), 31)).padStart(2, '0');
    const eY = String(endYear || 2026);

    setCustomStartDate(`${sY}-${sM}-${sD}`);
    setCustomEndDate(`${eY}-${eM}-${eD}`);
  }, [startDay, startMonth, startYear, endDay, endMonth, endYear]);

  // Compute actual date range based on preset or custom
  const { startDate, endDate, dateRangeLabel } = useMemo(() => {
    if (selectedPreset === 'custom') {
      return {
        startDate: customStartDate,
        endDate: customEndDate,
        dateRangeLabel: `${customStartDate} to ${customEndDate}`,
      };
    }
    const preset = getDateRangePreset(selectedPreset);
    return {
      startDate: preset.startDate,
      endDate: preset.endDate,
      dateRangeLabel: preset.label,
    };
  }, [selectedPreset, customStartDate, customEndDate]);

  // Calculate live preview metrics
  const previewMetrics = useMemo(() => {
    if (!visible) return { count: 0, totalGot: 0, totalGave: 0, netBalance: 0 };

    const filterType = selectedType === 'all' ? null : selectedType;
    const filterMode = selectedMode === 'all' ? null : selectedMode;

    const items = getTransactions({
      limit: 10000,
      filterType,
      filterMode,
      startDate,
      endDate,
    });

    let got = 0;
    let gave = 0;
    for (const t of items) {
      const amt = Number(t.amount) || 0;
      if (t.type === 'got') got += amt;
      else gave += amt;
    }

    return {
      count: items.length,
      totalGot: got,
      totalGave: gave,
      netBalance: got - gave,
    };
  }, [visible, selectedType, selectedMode, startDate, endDate]);

  const setShortcutDays = (daysBack) => {
    const today = new Date();
    setEndDay(today.getDate());
    setEndMonth(today.getMonth() + 1);
    setEndYear(today.getFullYear());

    const past = new Date();
    past.setDate(past.getDate() - daysBack);
    setStartDay(past.getDate());
    setStartMonth(past.getMonth() + 1);
    setStartYear(past.getFullYear());
    setSelectedPreset('custom');
  };

  const handleExport = async () => {
    if (previewMetrics.count === 0) {
      Alert.alert('No Records', 'There are no transactions found in the selected range to export.');
      return;
    }

    setIsExporting(true);
    try {
      const filterType = selectedType === 'all' ? null : selectedType;
      const filterMode = selectedMode === 'all' ? null : selectedMode;

      await exportTransactionsToPDF({
        startDate,
        endDate,
        filterType,
        filterMode,
        dateRangeLabel,
      });

      onClose();
    } catch (err) {
      console.error('PDF Export Error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const netBal = previewMetrics.netBalance;
  const netBalColor = netBal > 0 ? Colors.gotDark : netBal < 0 ? Colors.gaveDark : Colors.textSecondary;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={[styles.card, Shadows.lg]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerIcon}>
              <Ionicons name="document-text" size={22} color="#DC2626" />
            </View>
            <View style={styles.headerTitles}>
              <Text style={styles.title}>Export to PDF</Text>
              <Text style={styles.subtitle}>Generate print-ready transaction statement</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false}>
            {/* 1. Date Range Presets */}
            <Text style={styles.sectionHeading}>1. SELECT DATE RANGE</Text>
            <View style={styles.presetsGrid}>
              {DATE_PRESETS.map((p) => {
                const isSel = selectedPreset === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.presetChip, isSel && styles.presetChipActive]}
                    onPress={() => setSelectedPreset(p.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.presetChipText, isSel && styles.presetChipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Date Inputs (Always available or highlighted when custom selected) */}
            {selectedPreset === 'custom' && (
              <View style={styles.customDateBox}>
                <View style={styles.shortcutRow}>
                  <Text style={styles.shortcutLabel}>Quick Range:</Text>
                  <TouchableOpacity style={styles.shortcutChip} onPress={() => setShortcutDays(7)}>
                    <Text style={styles.shortcutChipText}>7 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.shortcutChip} onPress={() => setShortcutDays(30)}>
                    <Text style={styles.shortcutChipText}>30 Days</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.shortcutChip} onPress={() => setShortcutDays(90)}>
                    <Text style={styles.shortcutChipText}>90 Days</Text>
                  </TouchableOpacity>
                </View>

                {/* Start Date */}
                <Text style={styles.dateFieldLabel}>START DATE (DD / MM / YYYY)</Text>
                <View style={styles.dateInputsRow}>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateSub}>Day</Text>
                    <TextInput
                      style={styles.dateField}
                      value={String(startDay)}
                      onChangeText={(val) => setStartDay(parseInt(val) || 1)}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <Text style={styles.slash}>/</Text>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateSub}>Month</Text>
                    <TextInput
                      style={styles.dateField}
                      value={String(startMonth)}
                      onChangeText={(val) => setStartMonth(parseInt(val) || 1)}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <Text style={styles.slash}>/</Text>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateSub}>Year</Text>
                    <TextInput
                      style={[styles.dateField, { width: 68 }]}
                      value={String(startYear)}
                      onChangeText={(val) => setStartYear(parseInt(val) || 2026)}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                </View>

                {/* End Date */}
                <Text style={[styles.dateFieldLabel, { marginTop: 8 }]}>END DATE (DD / MM / YYYY)</Text>
                <View style={styles.dateInputsRow}>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateSub}>Day</Text>
                    <TextInput
                      style={styles.dateField}
                      value={String(endDay)}
                      onChangeText={(val) => setEndDay(parseInt(val) || 1)}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <Text style={styles.slash}>/</Text>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateSub}>Month</Text>
                    <TextInput
                      style={styles.dateField}
                      value={String(endMonth)}
                      onChangeText={(val) => setEndMonth(parseInt(val) || 1)}
                      keyboardType="number-pad"
                      maxLength={2}
                    />
                  </View>
                  <Text style={styles.slash}>/</Text>
                  <View style={styles.dateBox}>
                    <Text style={styles.dateSub}>Year</Text>
                    <TextInput
                      style={[styles.dateField, { width: 68 }]}
                      value={String(endYear)}
                      onChangeText={(val) => setEndYear(parseInt(val) || 2026)}
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                  </View>
                </View>
              </View>
            )}

            {/* 2. Optional Filters */}
            <Text style={styles.sectionHeading}>2. TRANSACTION FILTERS</Text>
            <View style={styles.filterRow}>
              {TYPE_OPTIONS.map((t) => {
                const isSel = selectedType === t.id;
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.filterChip, isSel && styles.filterChipActive]}
                    onPress={() => setSelectedType(t.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={[styles.filterRow, { marginTop: 6 }]}>
              {MODE_OPTIONS.map((m) => {
                const isSel = selectedMode === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.filterChip, isSel && styles.filterChipActive]}
                    onPress={() => setSelectedMode(m.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.filterChipText, isSel && styles.filterChipTextActive]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 3. Live Statement Summary Box */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeaderRow}>
                <Text style={styles.summaryTitle}>PDF Statement Preview</Text>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>{previewMetrics.count} Transactions</Text>
                </View>
              </View>

              <View style={styles.summaryDetailsGrid}>
                <View style={styles.summaryCol}>
                  <Text style={styles.summarySubLabel}>Total Got</Text>
                  <Text style={[styles.summaryVal, { color: Colors.gotDark }]}>
                    +{formatCurrency(previewMetrics.totalGot)}
                  </Text>
                </View>

                <View style={styles.summaryCol}>
                  <Text style={styles.summarySubLabel}>Total Gave</Text>
                  <Text style={[styles.summaryVal, { color: Colors.gaveDark }]}>
                    -{formatCurrency(previewMetrics.totalGave)}
                  </Text>
                </View>

                <View style={styles.summaryCol}>
                  <Text style={styles.summarySubLabel}>Total Balance</Text>
                  <Text style={[styles.summaryVal, { color: netBalColor }]}>
                    {netBal >= 0 ? '+' : ''}{formatCurrency(netBal)}
                  </Text>
                </View>
              </View>

              <View style={styles.rangeInfoRow}>
                <Ionicons name="calendar-outline" size={13} color={Colors.textSecondary} />
                <Text style={styles.rangeInfoText}>Period: {dateRangeLabel}</Text>
              </View>
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={isExporting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.exportButton, isExporting && styles.exportButtonDisabled]}
              onPress={handleExport}
              disabled={isExporting}
              activeOpacity={0.85}
            >
              {isExporting ? (
                <View style={styles.btnLoadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.exportButtonText}>Generating PDF...</Text>
                </View>
              ) : (
                <View style={styles.btnLoadingRow}>
                  <Ionicons name="download-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={styles.exportButtonText}>Export &amp; Share PDF</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 440,
    maxHeight: '90%',
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.md,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm + 2,
  },
  headerTitles: {
    flex: 1,
  },
  title: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  closeBtn: {
    padding: 6,
  },
  scrollBody: {
    marginBottom: Spacing.md,
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs + 2,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  presetChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  presetChipText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeights.medium,
  },
  presetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  customDateBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: 6,
  },
  shortcutLabel: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
  },
  shortcutChip: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shortcutChipText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: Typography.fontWeights.semibold,
  },
  dateFieldLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  dateInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dateBox: {
    alignItems: 'center',
  },
  dateSub: {
    fontSize: 9,
    color: Colors.textMuted,
    marginBottom: 2,
    fontWeight: Typography.fontWeights.medium,
  },
  dateField: {
    width: 48,
    height: 38,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: Typography.fontWeights.bold,
    backgroundColor: '#FFFFFF',
    color: Colors.textPrimary,
  },
  slash: {
    fontSize: 18,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textMuted,
    marginTop: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  filterChip: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  filterChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  filterChipText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  summaryCard: {
    backgroundColor: '#F1F5F9',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  countBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  countBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  summaryDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 2,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  summaryCol: {
    alignItems: 'center',
    flex: 1,
  },
  summarySubLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  summaryVal: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.bold,
  },
  rangeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    justifyContent: 'center',
  },
  rangeInfoText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  cancelButtonText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  exportButton: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonDisabled: {
    opacity: 0.65,
  },
  exportButtonText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
