import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import {
  formatFullDateTime,
  formatTimeAgo,
  formatTimeFuture,
  formatFileSize,
} from '../utils/formatters';
import API_CONFIG from '../constants/api_config';

const INTERVAL_PRESETS = [
  { label: '1 Hour', minutes: 60 },
  { label: '6 Hours', minutes: 360 },
  { label: '12 Hours', minutes: 720 },
  { label: '24 Hours (Default)', minutes: 1440 },
  { label: '48 Hours', minutes: 2880 },
  { label: 'Custom', minutes: -1 },
];

const HIDE_INFO_PRESETS = [
  { label: '2 mins', minutes: 2 },
  { label: '5 mins', minutes: 5 },
  { label: '15 mins', minutes: 15 },
  { label: '30 mins', minutes: 30 },
  { label: '60 mins (Default)', minutes: 60 },
  { label: '120 mins', minutes: 120 },
  { label: 'Custom', minutes: -1 },
];

const RETENTION_PRESETS = [
  { label: '3', count: 3 },
  { label: '5', count: 5 },
  { label: '7 (Default)', count: 7 },
  { label: '10', count: 10 },
  { label: '14', count: 14 },
  { label: '30', count: 30 },
  { label: 'Custom', count: -1 },
];

export const BackupSettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const {
    backupSettings,
    saveBackupSettings,
    isBackupSettingsOpen,
    closeBackupSettings,
    uploadFullDatabaseBackup,
    importAndRestoreData,
    testBackupEndpoint,
    isLoggedIn,
    openLoginModal,
    refreshAll,
  } = useApp();

  // Local Form States
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(true);
  const [intervalMinutes, setIntervalMinutes] = useState('1440');
  const [selectedIntervalPreset, setSelectedIntervalPreset] = useState(1440);

  const [hideDetailedMinutes, setHideDetailedMinutes] = useState('60');
  const [selectedHidePreset, setSelectedHidePreset] = useState(60);

  const [keepBackups, setKeepBackups] = useState('7');
  const [selectedRetentionPreset, setSelectedRetentionPreset] = useState(7);

  const [backupLocation, setBackupLocation] = useState('');

  // Status & Testing States
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isSavedToast, setIsSavedToast] = useState(false);

  // Sync state with backupSettings on open
  useEffect(() => {
    if (isBackupSettingsOpen && backupSettings) {
      setAutoBackupEnabled(Boolean(backupSettings.autoBackupEnabled));
      
      const intVal = backupSettings.backupIntervalMinutes || 1440;
      setIntervalMinutes(String(intVal));
      const matchInt = INTERVAL_PRESETS.find((p) => p.minutes === intVal);
      setSelectedIntervalPreset(matchInt ? intVal : -1);

      const hideVal = backupSettings.hideDetailedInfoMinutes || 60;
      setHideDetailedMinutes(String(hideVal));
      const matchHide = HIDE_INFO_PRESETS.find((p) => p.minutes === hideVal);
      setSelectedHidePreset(matchHide ? hideVal : -1);

      const keepVal = backupSettings.keepBackupsCount || 7;
      setKeepBackups(String(keepVal));
      const matchRet = RETENTION_PRESETS.find((p) => p.count === keepVal);
      setSelectedRetentionPreset(matchRet ? keepVal : -1);

      setBackupLocation(backupSettings.backupLocation || API_CONFIG.DATABASE_BACKUP_UPLOAD_URL);
      setTestResult(null);
    }
  }, [isBackupSettingsOpen, backupSettings]);

  if (!isBackupSettingsOpen) return null;

  // Formatting helpers
  const intervalNum = parseInt(intervalMinutes, 10) || 1440;
  const intervalHours = (intervalNum / 60).toFixed(1).replace(/\.0$/, '');
  const intervalDays = (intervalNum / 1440).toFixed(1).replace(/\.0$/, '');

  const hideNum = parseInt(hideDetailedMinutes, 10) || 60;
  const hideHours = (hideNum / 60).toFixed(1).replace(/\.0$/, '');

  const lastSuccessfulTs = backupSettings.lastSuccessfulBackup;
  const lastFailedTs = backupSettings.lastFailedBackup;
  const nextScheduledTs = backupSettings.nextScheduledBackup;

  const handleToggleAutoBackup = (enabled) => {
    setAutoBackupEnabled(enabled);
    saveBackupSettings({ autoBackupEnabled: enabled });
  };

  const handleSelectIntervalPreset = (presetMinutes) => {
    setSelectedIntervalPreset(presetMinutes);
    if (presetMinutes > 0) {
      setIntervalMinutes(String(presetMinutes));
      saveBackupSettings({ backupIntervalMinutes: presetMinutes });
    }
  };

  const handleCustomIntervalChange = (val) => {
    const clean = val.replace(/[^0-9]/g, '');
    setIntervalMinutes(clean);
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num >= 5) {
      saveBackupSettings({ backupIntervalMinutes: num });
    }
  };

  const handleSelectHidePreset = (presetMinutes) => {
    setSelectedHidePreset(presetMinutes);
    if (presetMinutes > 0) {
      setHideDetailedMinutes(String(presetMinutes));
      saveBackupSettings({ hideDetailedInfoMinutes: presetMinutes });
    }
  };

  const handleCustomHideChange = (val) => {
    const clean = val.replace(/[^0-9]/g, '');
    setHideDetailedMinutes(clean);
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num >= 1) {
      saveBackupSettings({ hideDetailedInfoMinutes: num });
    }
  };

  const handleSelectRetentionPreset = (count) => {
    setSelectedRetentionPreset(count);
    if (count > 0) {
      setKeepBackups(String(count));
      saveBackupSettings({ keepBackupsCount: count });
    }
  };

  const handleCustomRetentionChange = (val) => {
    const clean = val.replace(/[^0-9]/g, '');
    setKeepBackups(clean);
    const num = parseInt(clean, 10);
    if (!isNaN(num) && num >= 1) {
      saveBackupSettings({ keepBackupsCount: num });
    }
  };

  const validateAndSave = (showToast = true) => {
    const intMins = parseInt(intervalMinutes, 10);
    if (isNaN(intMins) || intMins < 5) {
      if (showToast) Alert.alert('Invalid Interval', 'Backup interval must be at least 5 minutes.');
      return false;
    }

    const hideMins = parseInt(hideDetailedMinutes, 10);
    if (isNaN(hideMins) || hideMins < 1) {
      if (showToast) Alert.alert('Invalid Duration', 'Hide detailed info duration must be at least 1 minute.');
      return false;
    }

    const retentionCnt = parseInt(keepBackups, 10);
    if (isNaN(retentionCnt) || retentionCnt < 1) {
      if (showToast) Alert.alert('Invalid Retention', 'Keep backups count must be at least 1.');
      return false;
    }

    try {
      saveBackupSettings({
        autoBackupEnabled,
        backupIntervalMinutes: intMins,
        hideDetailedInfoMinutes: hideMins,
        keepBackupsCount: retentionCnt,
        backupLocation: backupLocation.trim(),
      });

      if (showToast) {
        setIsSavedToast(true);
        setTimeout(() => setIsSavedToast(false), 2500);
      }
      return true;
    } catch (err) {
      if (showToast) Alert.alert('Error', 'Failed to save settings: ' + err.message);
      return false;
    }
  };

  const handleClose = () => {
    validateAndSave(false);
    closeBackupSettings();
  };

  const handleManualBackup = async () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }

    setIsBackingUp(true);
    try {
      const res = await uploadFullDatabaseBackup();
      setIsBackingUp(false);
      refreshAll();
      if (res.success) {
        Alert.alert('Backup Succeeded ✓', res.message || 'Full database backed up to server.');
      } else {
        Alert.alert('Backup Failed', res.message || 'Unable to complete backup.');
      }
    } catch (e) {
      setIsBackingUp(false);
      Alert.alert('Backup Error', e.message);
    }
  };

  const handleTestLocation = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testBackupEndpoint(backupLocation.trim());
      setTestResult(res);
    } catch (e) {
      setTestResult({ success: false, message: e.message, latencyMs: 0 });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRestorePrompt = () => {
    if (!isLoggedIn) {
      openLoginModal();
      return;
    }

    Alert.alert(
      'Restore Cloud Backup',
      'Restoring will replace current local transactions with your verified cloud database backup. Are you sure you want to proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore Now',
          style: 'destructive',
          onPress: async () => {
            setIsRestoring(true);
            try {
              const res = await importAndRestoreData();
              setIsRestoring(false);
              refreshAll();
              if (res.success) {
                Alert.alert('Restoration Complete ✓', res.message || 'Your data has been restored.');
              } else {
                Alert.alert('Restore Failed', res.message || 'Unable to restore backup.');
              }
            } catch (err) {
              setIsRestoring(false);
              Alert.alert('Restore Error', err.message);
            }
          },
        },
      ]
    );
  };

  // Determine status color & badge
  let statusBadge = {
    label: '✓ Backup completed',
    color: '#065F46',
    bg: '#ECFDF5',
    border: '#A7F3D0',
    icon: 'checkmark-circle',
  };

  if (backupSettings.lastBackupStatus === 'failed') {
    statusBadge = {
      label: '⚠ Backup failed',
      color: '#991B1B',
      bg: '#FEF2F2',
      border: '#FECACA',
      icon: 'alert-circle',
    };
  } else if (backupSettings.lastBackupStatus === 'in_progress' || isBackingUp) {
    statusBadge = {
      label: '🔄 Backing up...',
      color: '#1D4ED8',
      bg: '#EFF6FF',
      border: '#BFDBFE',
      icon: 'sync',
    };
  } else if (!lastSuccessfulTs) {
    statusBadge = {
      label: '⏳ Ready for initial backup',
      color: '#92400E',
      bg: '#FFFBEB',
      border: '#FDE68A',
      icon: 'time-outline',
    };
  }

  return (
    <Modal
      visible={isBackupSettingsOpen}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) + 6 }]}>
          <TouchableOpacity onPress={handleClose} style={styles.headerBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Backup Settings</Text>
            <Text style={styles.headerSubtitle}>Timing, Automation & Storage Controls</Text>
          </View>
          <TouchableOpacity onPress={() => validateAndSave(true)} style={styles.saveBtn} activeOpacity={0.8}>
            <Ionicons name="checkmark" size={17} color="#FFFFFF" style={{ marginRight: 3 }} />
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>

        {/* Saved Success Toast */}
        {isSavedToast && (
          <View style={styles.toastBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#065F46" style={{ marginRight: 6 }} />
            <Text style={styles.toastText}>Backup settings updated successfully ✓</Text>
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Card 1: Status & Timing Overview */}
          <View style={[styles.card, Shadows.sm]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="pulse-outline" size={18} color={Colors.primary} />
                <Text style={styles.cardTitle}>Backup Status & Diagnostics</Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: statusBadge.bg, borderColor: statusBadge.border },
                ]}
              >
                <Ionicons
                  name={statusBadge.icon}
                  size={12}
                  color={statusBadge.color}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.statusPillText, { color: statusBadge.color }]}>
                  {statusBadge.label}
                </Text>
              </View>
            </View>

            {/* Error banner if last backup failed */}
            {backupSettings.lastBackupStatus === 'failed' && (
              <View style={styles.errorAlertBox}>
                <Ionicons name="warning-outline" size={18} color="#DC2626" style={{ marginRight: 8, marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorAlertTitle}>Last Backup Failed</Text>
                  <Text style={styles.errorAlertMsg}>
                    {backupSettings.lastBackupError || 'Unable to connect to backup server.'}
                  </Text>
                  {lastSuccessfulTs ? (
                    <Text style={styles.errorAlertSub}>
                      Last successful backup: {formatTimeAgo(lastSuccessfulTs)}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* Timing Statistics Grid */}
            <View style={styles.statsGrid}>
              <View style={styles.statBox}>
                <Text style={styles.statBoxLabel}>Last Backup</Text>
                <Text style={styles.statBoxValuePrimary}>
                  {lastSuccessfulTs ? formatTimeAgo(lastSuccessfulTs) : 'Never'}
                </Text>
                <Text style={styles.statBoxSub}>
                  {lastSuccessfulTs ? formatFullDateTime(lastSuccessfulTs).combined : 'No record'}
                </Text>
              </View>

              <View style={styles.statBox}>
                <Text style={styles.statBoxLabel}>Next Backup</Text>
                <Text style={[styles.statBoxValuePrimary, { color: autoBackupEnabled ? Colors.online : Colors.textMuted }]}>
                  {autoBackupEnabled
                    ? nextScheduledTs
                      ? formatTimeFuture(nextScheduledTs)
                      : 'Due now'
                    : 'Disabled'}
                </Text>
                <Text style={styles.statBoxSub}>
                  {autoBackupEnabled && nextScheduledTs
                    ? formatFullDateTime(nextScheduledTs).combined
                    : 'Auto-backup OFF'}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.metaCol}>
                <Text style={styles.metaKey}>Backup Size:</Text>
                <Text style={styles.metaVal}>{formatFileSize(backupSettings.lastBackupSize)}</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.metaKey}>Auto Schedule:</Text>
                <Text style={[styles.metaVal, { color: autoBackupEnabled ? '#059669' : '#DC2626' }]}>
                  {autoBackupEnabled ? `Every ${intervalHours} hrs` : 'Disabled'}
                </Text>
              </View>
            </View>
          </View>

          {/* Card 2: Automation & Timing Controls */}
          <View style={[styles.card, Shadows.sm]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="time-outline" size={18} color={Colors.primary} />
                <Text style={styles.cardTitle}>Automatic Backup Timing</Text>
              </View>
            </View>

            {/* Toggle Switch */}
            <View style={styles.switchRow}>
              <View style={{ flex: 1, paddingRight: Spacing.md }}>
                <Text style={styles.settingLabel}>Automatic Periodic Backup</Text>
                <Text style={styles.settingDesc}>
                  Automatically uploads ledger database when due in background without interrupting transactions.
                </Text>
              </View>
              <Switch
                value={autoBackupEnabled}
                onValueChange={handleToggleAutoBackup}
                trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
                thumbColor={autoBackupEnabled ? Colors.primary : '#94A3B8'}
              />
            </View>

            {/* Backup Interval Selection */}
            {autoBackupEnabled && (
              <View style={styles.controlSection}>
                <Text style={styles.controlTitle}>Backup Interval (Frequency)</Text>
                <Text style={styles.controlSub}>
                  Configured: <Text style={{ fontWeight: 'bold', color: Colors.primary }}>{intervalMinutes} minutes</Text> ({intervalHours} hours / {intervalDays} days)
                </Text>

                <View style={styles.chipsRow}>
                  {INTERVAL_PRESETS.map((p) => {
                    const isSelected =
                      p.minutes === -1
                        ? selectedIntervalPreset === -1
                        : selectedIntervalPreset === p.minutes;
                    return (
                      <TouchableOpacity
                        key={p.label}
                        style={[styles.chip, isSelected && styles.chipActive]}
                        onPress={() => handleSelectIntervalPreset(p.minutes)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                          {p.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Custom Minutes Input */}
                {selectedIntervalPreset === -1 && (
                  <View style={styles.customInputRow}>
                    <Text style={styles.customInputPrefix}>Custom Minutes:</Text>
                    <TextInput
                      style={styles.numericInput}
                      value={intervalMinutes}
                      onChangeText={handleCustomIntervalChange}
                      keyboardType="number-pad"
                      placeholder="e.g. 1440"
                    />
                    <Text style={styles.customInputSuffix}>min</Text>
                  </View>
                )}
              </View>
            )}

            {/* Hide Detailed Info Duration */}
            <View style={[styles.controlSection, { marginTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.md }]}>
              <Text style={styles.controlTitle}>Hide Detailed Info After Backup</Text>
              <Text style={styles.controlSub}>
                Shows "✓ Full backup completed" immediately, then switches to compact "Last backup: X ago" after: <Text style={{ fontWeight: 'bold', color: Colors.primary }}>{hideDetailedMinutes} minutes</Text> ({hideHours} hrs)
              </Text>

              <View style={styles.chipsRow}>
                {HIDE_INFO_PRESETS.map((p) => {
                  const isSelected =
                    p.minutes === -1
                      ? selectedHidePreset === -1
                      : selectedHidePreset === p.minutes;
                  return (
                    <TouchableOpacity
                      key={p.label}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => handleSelectHidePreset(p.minutes)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Custom Hide Minutes Input */}
              {selectedHidePreset === -1 && (
                <View style={styles.customInputRow}>
                  <Text style={styles.customInputPrefix}>Custom Hide Time:</Text>
                  <TextInput
                    style={styles.numericInput}
                    value={hideDetailedMinutes}
                    onChangeText={handleCustomHideChange}
                    keyboardType="number-pad"
                    placeholder="e.g. 60"
                  />
                  <Text style={styles.customInputSuffix}>min</Text>
                </View>
              )}
            </View>
          </View>

          {/* Card 3: Retention & Server Configuration */}
          <View style={[styles.card, Shadows.sm]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="file-tray-full-outline" size={18} color={Colors.primary} />
                <Text style={styles.cardTitle}>Retention & Backup Location</Text>
              </View>
            </View>

            {/* Retention Control */}
            <View style={styles.controlSection}>
              <Text style={styles.controlTitle}>Keep Last N Backups</Text>
              <Text style={styles.controlSub}>
                Automatically maintains only the last <Text style={{ fontWeight: 'bold', color: Colors.primary }}>{keepBackups}</Text> backup archives.
              </Text>

              <View style={styles.chipsRow}>
                {RETENTION_PRESETS.map((p) => {
                  const isSelected =
                    p.count === -1
                      ? selectedRetentionPreset === -1
                      : selectedRetentionPreset === p.count;
                  return (
                    <TouchableOpacity
                      key={p.label}
                      style={[styles.chip, isSelected && styles.chipActive]}
                      onPress={() => handleSelectRetentionPreset(p.count)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {selectedRetentionPreset === -1 && (
                <View style={styles.customInputRow}>
                  <Text style={styles.customInputPrefix}>Keep Copies:</Text>
                  <TextInput
                    style={styles.numericInput}
                    value={keepBackups}
                    onChangeText={handleCustomRetentionChange}
                    keyboardType="number-pad"
                    placeholder="e.g. 7"
                  />
                  <Text style={styles.customInputSuffix}>backups</Text>
                </View>
              )}
            </View>

            {/* Location URL & Test */}
            <View style={[styles.controlSection, { marginTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.borderLight, paddingTop: Spacing.md }]}>
              <Text style={styles.controlTitle}>Backup Server Location / Endpoint</Text>
              <Text style={styles.controlSub}>Cloud destination for database uploads & synchronization.</Text>

              <View style={styles.urlInputWrap}>
                <TextInput
                  style={styles.urlInput}
                  value={backupLocation}
                  onChangeText={setBackupLocation}
                  placeholder="https://yourserver.com/api/v1/upload_database_backup.php"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.testLocationRow}>
                <TouchableOpacity
                  style={[styles.testBtn, isTesting && { opacity: 0.7 }]}
                  onPress={handleTestLocation}
                  disabled={isTesting}
                  activeOpacity={0.8}
                >
                  {isTesting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 6 }} />
                  ) : (
                    <Ionicons name="speedometer-outline" size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.testBtnText}>{isTesting ? 'Testing...' : 'Test Location'}</Text>
                </TouchableOpacity>

                {testResult && (
                  <View style={[styles.testResultBadge, { backgroundColor: testResult.success ? '#ECFDF5' : '#FEF2F2' }]}>
                    <Ionicons
                      name={testResult.success ? 'checkmark-circle' : 'alert-circle'}
                      size={14}
                      color={testResult.success ? '#065F46' : '#DC2626'}
                      style={{ marginRight: 4 }}
                    />
                    <Text
                      style={[
                        styles.testResultText,
                        { color: testResult.success ? '#065F46' : '#DC2626' },
                      ]}
                      numberOfLines={1}
                    >
                      {testResult.message}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Card 4: Quick Action Operations */}
          <View style={[styles.card, Shadows.sm]}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <Ionicons name="hardware-chip-outline" size={18} color={Colors.primary} />
                <Text style={styles.cardTitle}>Manual Operations</Text>
              </View>
            </View>

            <View style={styles.actionsColumn}>
              {/* Backup Now Button */}
              <TouchableOpacity
                style={[styles.actionBtnPrimary, isBackingUp && { opacity: 0.7 }]}
                onPress={handleManualBackup}
                disabled={isBackingUp}
                activeOpacity={0.85}
              >
                {isBackingUp ? (
                  <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="cloud-upload" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.actionBtnPrimaryText}>
                  {isBackingUp ? 'Backing Up Database...' : 'Backup Now'}
                </Text>
              </TouchableOpacity>

              {/* Restore Backup Button */}
              <TouchableOpacity
                style={[styles.actionBtnSecondary, isRestoring && { opacity: 0.7 }]}
                onPress={handleRestorePrompt}
                disabled={isRestoring}
                activeOpacity={0.85}
              >
                {isRestoring ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="cloud-download-outline" size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                )}
                <Text style={styles.actionBtnSecondaryText}>
                  {isRestoring ? 'Restoring Database...' : 'Restore Cloud Backup'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerBtn: {
    padding: Spacing.xs,
    marginRight: Spacing.sm,
    marginLeft: -Spacing.xs,
  },
  headerTitleWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
  },
  saveBtnText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  toastBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
  },
  toastText: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.semibold,
    color: '#065F46',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 60,
    gap: Spacing.md,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
    gap: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
  },
  errorAlertBox: {
    flexDirection: 'row',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorAlertTitle: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: '#991B1B',
  },
  errorAlertMsg: {
    fontSize: 12,
    color: '#B91C1C',
    marginTop: 2,
  },
  errorAlertSub: {
    fontSize: 11,
    color: '#7F1D1D',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  statBoxLabel: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  statBoxValuePrimary: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  statBoxSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    paddingTop: Spacing.sm,
  },
  metaCol: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaKey: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  metaVal: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  settingLabel: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  settingDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    lineHeight: 16,
  },
  controlSection: {
    marginTop: Spacing.md,
  },
  controlTitle: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  controlSub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: {
    backgroundColor: '#1E293B',
    borderColor: '#0F172A',
  },
  chipText: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.medium,
    color: '#475569',
  },
  chipTextActive: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  customInputPrefix: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginRight: Spacing.sm,
  },
  numericInput: {
    flex: 1,
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    paddingVertical: 4,
  },
  customInputSuffix: {
    fontSize: 12,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  urlInputWrap: {
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    marginBottom: Spacing.sm,
  },
  urlInput: {
    fontSize: 11,
    color: Colors.textPrimary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  testLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.online,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  testBtnText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  testResultBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  testResultText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.semibold,
    flex: 1,
  },
  actionsColumn: {
    gap: Spacing.sm,
  },
  actionBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  actionBtnPrimaryText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  actionBtnSecondaryText: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.primary,
  },
});
