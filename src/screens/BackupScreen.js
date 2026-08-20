import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useApp } from '../context/AppContext';
import { Colors } from '../constants/colors';
import { Typography, Spacing, BorderRadius, Shadows } from '../constants/theme';
import { formatFullDateTime } from '../utils/formatters';
import { exportTransactionsToCSV, exportFullJSONBackup, exportTransactionsToPDF } from '../services/exportService';
import API_CONFIG from '../constants/api_config';
import { testAllApiEndpoints } from '../services/syncService';

const SCHEDULE_PRESETS = [
  { label: '12:00 AM (Midnight)', time: '00:00' },
  { label: '01:00 AM', time: '01:00' },
  { label: '02:00 AM (Default)', time: '02:00' },
  { label: '03:00 AM', time: '03:00' },
  { label: '04:00 AM', time: '04:00' },
  { label: '11:00 PM', time: '23:00' },
];

export const BackupScreen = () => {
  const insets = useSafeAreaInsets();
  const {
    detailedBackupStats,
    networkStatus,
    isSyncing,
    isImageSyncing,
    triggerSync,
    triggerImageSync,
    updateImageSchedule,
    toggleImageScheduleEnabled,
    eraseLocalDeviceData,
    backupActivityLogs,
    refreshAll,
    setActiveTab,
    isLoggedIn,
    currentUser,
    openLoginModal,
  } = useApp();

  // Server health test state
  const [isTestingServer, setIsTestingServer] = useState(false);
  const [serverHealthResult, setServerHealthResult] = useState(null);

  // Schedule modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [tempHour, setTempHour] = useState('02');
  const [tempMinute, setTempMinute] = useState('00');

  // Erase 4-Step Modal State
  const [eraseModalStep, setEraseModalStep] = useState(0); // 0: Closed, 1: Step 1 Warning, 2: Step 2 Confirmation, 3: Step 3 Type confirmation
  const [eraseInputWord, setEraseInputWord] = useState('');
  const [isErasing, setIsErasing] = useState(false);

  const { transactions, images, system } = detailedBackupStats;

  // Intercept Android hardware back button to always return to 'More' screen
  useEffect(() => {
    const onBackPress = () => {
      setActiveTab('More');
      return true;
    };

    const backHandlerSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => backHandlerSubscription.remove();
  }, [setActiveTab]);

  // Run initial server test on mount if online
  useEffect(() => {
    handleTestServerConnection(true);
  }, []);

  const handleTestServerConnection = async (isSilent = false) => {
    setIsTestingServer(true);
    try {
      const res = await testAllApiEndpoints();
      setServerHealthResult(res);
      refreshAll();
      if (!isSilent) {
        Alert.alert(
          res.serverConnected ? 'Server Connected' : 'Server Check Result',
          res.serverConnected
            ? 'All configured API endpoints are online and responding.'
            : 'One or more API endpoints are currently unreachable. Please check network connectivity.'
        );
      }
    } catch (e) {
      console.warn('Server test error:', e);
    } finally {
      setIsTestingServer(false);
    }
  };

  // Format timestamps
  const textSyncFormatted = transactions.lastSync
    ? formatFullDateTime(transactions.lastSync).combined
    : 'Not yet synchronized';
  const imageSyncFormatted = images.lastSync
    ? formatFullDateTime(images.lastSync).combined
    : 'Not yet uploaded';

  // Master status determination
  let masterStatus = 'Synced';
  let masterColor = Colors.gotDark;
  let masterBg = Colors.gotBg;
  let masterBorder = Colors.gotLight;
  let masterIcon = 'checkmark-circle';

  if (!networkStatus.isConnected) {
    masterStatus = 'Offline';
    masterColor = '#DC2626';
    masterBg = '#FEF2F2';
    masterBorder = '#FECACA';
    masterIcon = 'cloud-offline-outline';
  } else if (isSyncing || isImageSyncing) {
    masterStatus = 'Uploading';
    masterColor = '#1D4ED8';
    masterBg = '#EFF6FF';
    masterBorder = '#BFDBFE';
    masterIcon = 'sync-outline';
  } else if (transactions.pending > 0 || images.pending > 0) {
    masterStatus = 'Pending';
    masterColor = '#B45309';
    masterBg = '#FFFBEB';
    masterBorder = '#FDE68A';
    masterIcon = 'time-outline';
  }

  // Format schedule display
  const formatTimeDisplay = (timeStr) => {
    if (!timeStr) return '02:00 AM';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr, 10) || 0;
    const m = parseInt(mStr, 10) || 0;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    const minPadded = String(m).padStart(2, '0');
    return `${hour12}:${minPadded} ${ampm}`;
  };

  const handleManualTextSync = async () => {
    const res = await triggerSync();
    if (res) {
      Alert.alert('Text Synchronization', res.message);
    }
  };

  const handleManualImageSync = async () => {
    const res = await triggerImageSync();
    if (res) {
      Alert.alert('Image Backup', res.message);
    }
  };

  const handleSaveCustomSchedule = () => {
    const h = String(Math.min(Math.max(parseInt(tempHour, 10) || 0, 0), 23)).padStart(2, '0');
    const m = String(Math.min(Math.max(parseInt(tempMinute, 10) || 0, 0), 59)).padStart(2, '0');
    const formatted = `${h}:${m}`;
    updateImageSchedule(formatted);
    setIsScheduleModalOpen(false);
    Alert.alert('Schedule Updated', `Image uploads will run automatically at ${formatTimeDisplay(formatted)}.`);
  };

  // Erase flow
  const startEraseFlow = () => {
    setEraseInputWord('');
    setEraseModalStep(1);
  };

  const cancelEraseFlow = () => {
    setEraseModalStep(0);
    setEraseInputWord('');
    setIsErasing(false);
  };

  const proceedToStep2 = () => {
    setEraseModalStep(2);
  };

  const proceedToStep3 = () => {
    setEraseModalStep(3);
  };

  const executeLocalErase = async () => {
    if (eraseInputWord.trim().toUpperCase() !== 'DELETE' && eraseInputWord.trim().toUpperCase() !== 'ERASE') {
      Alert.alert('Verification Failed', 'Please type DELETE or ERASE exactly to confirm.');
      return;
    }

    setIsErasing(true);
    try {
      await new Promise((res) => setTimeout(res, 600));
      eraseLocalDeviceData();
      cancelEraseFlow();
      Alert.alert(
        'Device Data Erased',
        'All transactions and local data on this device have been cleared. Your backed-up data on the server was NOT touched and remains safe.'
      );
    } catch (err) {
      console.error('Error erasing data:', err);
      Alert.alert('Error', 'Failed to erase local data.');
      setIsErasing(false);
    }
  };

  const handleBackNavigation = () => {
    setActiveTab('More');
  };

  if (!isLoggedIn) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.topHeader}>
          <View style={styles.headerLeftGroup}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBackNavigation}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerTitles}>
              <Text style={styles.headerMainTitle}>Cloud Backup &amp; Sync</Text>
              <Text style={styles.headerSubtitle}>Account Sign In Required</Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.lockedScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.lockedCard, Shadows.md]}>
            <View style={styles.lockedIconWrap}>
              <Ionicons name="cloud-offline" size={48} color="#D97706" />
            </View>

            <Text style={styles.lockedTitle}>Log In to Upload &amp; Backup</Text>
            <Text style={styles.lockedDesc}>
              Cloud backup and automatic synchronization are disabled. You must sign in or create an account before your ledger can be backed up to the server.
            </Text>

            <TouchableOpacity
              style={styles.lockedLoginBtn}
              onPress={openLoginModal}
              activeOpacity={0.85}
            >
              <Ionicons name="log-in-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={styles.lockedLoginBtnText}>Sign In / Create Account</Text>
            </TouchableOpacity>

            <View style={styles.lockedFeaturesList}>
              <View style={styles.featureItem}>
                <View style={[styles.featureIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name="cloud-upload" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureItemTitle}>Automatic Server Backup</Text>
                  <Text style={styles.featureItemDesc}>Sync all transactions to secure MySQL database.</Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.featureIconWrap, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name="shield-checkmark" size={20} color={Colors.gotDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureItemTitle}>Zero Data Loss</Text>
                  <Text style={styles.featureItemDesc}>Restore your complete ledger anytime on any phone.</Text>
                </View>
              </View>

              <View style={styles.featureItem}>
                <View style={[styles.featureIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <Ionicons name="images" size={20} color="#D97706" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.featureItemTitle}>Bill &amp; Receipt Photo Backup</Text>
                  <Text style={styles.featureItemDesc}>High-speed nightly photo media upload to cloud storage.</Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Full-Screen Page Header with Back Button */}
      <View style={styles.topHeader}>
        <View style={styles.headerLeftGroup}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBackNavigation}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerTitles}>
            <Text style={styles.headerMainTitle}>Backup &amp; Sync Dashboard</Text>
            <Text style={styles.headerSubtitle}>Real-time ledger safety &amp; API monitor</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={refreshAll}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Master Status Card */}
        <View style={[styles.masterCard, { backgroundColor: masterBg, borderColor: masterBorder }, Shadows.sm]}>
          <View style={styles.masterTopRow}>
            <View style={styles.masterIconGroup}>
              <Ionicons name={masterIcon} size={30} color={masterColor} />
              <View style={{ marginLeft: 12 }}>
                <Text style={[styles.masterStatusTitle, { color: masterColor }]}>
                  Sync Status: {masterStatus}
                </Text>
                <Text style={styles.masterStatusSub}>
                  {networkStatus.isConnected
                    ? `${networkStatus.type} Online · Target: ${API_CONFIG.BASE_DOMAIN.replace('https://', '')}`
                    : 'No Internet · Local SQLite Ledger Safe'}
                </Text>
              </View>
            </View>
          </View>

          {/* Quick Metric Pills */}
          <View style={styles.quickSummaryRow}>
            <View style={styles.quickPill}>
              <Text style={styles.quickPillLabel}>Text Data</Text>
              <Text style={[styles.quickPillVal, { color: transactions.pending > 0 ? '#B45309' : Colors.gotDark }]}>
                {transactions.pending === 0 ? '✓ Synced' : `${transactions.pending} Pending`}
              </Text>
            </View>

            <View style={styles.quickPill}>
              <Text style={styles.quickPillLabel}>Images</Text>
              <Text style={[styles.quickPillVal, { color: images.pending > 0 ? '#B45309' : Colors.gotDark }]}>
                {images.pending === 0 ? '✓ Uploaded' : `${images.pending} Pending`}
              </Text>
            </View>

            <View style={styles.quickPill}>
              <Text style={styles.quickPillLabel}>Auto-Sync</Text>
              <Text style={[styles.quickPillVal, { color: Colors.primaryDark }]}>
                {system.autoSyncEnabled ? 'Active' : 'Paused'}
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION 1: Server Status & API Health */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <Ionicons name="server" size={20} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Server Status &amp; API Health</Text>
            </View>
            <View style={[styles.statusTag, serverHealthResult?.serverConnected ? styles.tagSynced : styles.tagFailed]}>
              <Text style={[styles.statusTagText, serverHealthResult?.serverConnected ? styles.tagTextSynced : styles.tagTextFailed]}>
                {isTestingServer ? 'Checking...' : (serverHealthResult?.overallStatus || 'Offline / Checking')}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionDesc}>
            All endpoints are configured centrally in <Text style={{ fontWeight: 'bold' }}>`api_config`</Text>. Testing performs real HTTP requests to verify domain DNS, PHP execution, and service availability.
          </Text>

          {/* Endpoints Health List */}
          <View style={styles.endpointTable}>
            {(serverHealthResult?.endpoints || [
              { name: 'Server Health (health.php)', status: 'checking', message: 'Awaiting connection test' },
              { name: 'Transaction Sync (transactions_sync.php)', status: 'checking', message: 'Awaiting connection test' },
              { name: 'Image Upload (image_upload.php)', status: 'checking', message: 'Awaiting connection test' },
              { name: 'Backup Status (backup_status.php)', status: 'checking', message: 'Awaiting connection test' },
            ]).map((ep, idx) => {
              const isWorking = ep.status === 'working';
              const isChecking = ep.status === 'checking';
              const dotColor = isWorking ? '#059669' : (isChecking ? '#3B82F6' : '#DC2626');
              const textColor = isWorking ? '#059669' : (isChecking ? '#2563EB' : '#DC2626');

              return (
                <View key={idx} style={[styles.endpointRow, idx > 0 && styles.endpointBorder]}>
                  <View style={styles.endpointLeft}>
                    <View style={[styles.healthDot, { backgroundColor: dotColor }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.endpointName}>{ep.name}</Text>
                      <Text style={styles.endpointUrl} numberOfLines={1}>{ep.message || ep.url || ep.name}</Text>
                    </View>
                  </View>

                  <View style={styles.endpointRight}>
                    <Text style={[styles.endpointStatusText, { color: textColor }]}>
                      {isWorking ? '✓ Working' : (isChecking ? '● Checking' : '✕ Failed')}
                    </Text>
                    {ep.latencyMs ? (
                      <Text style={styles.endpointLatency}>{ep.latencyMs}ms</Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>

          <TouchableOpacity
            style={[styles.testServerBtn, isTestingServer && styles.actionBtnDisabled]}
            onPress={() => handleTestServerConnection(false)}
            disabled={isTestingServer}
            activeOpacity={0.8}
          >
            {isTestingServer ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.btnRow}>
                <Ionicons name="pulse-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.testServerBtnText}>Test Server Connection</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* SECTION 2: Transaction & Data Backup */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <Ionicons name="document-text" size={20} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Transaction &amp; SQLite Backup</Text>
            </View>
            <View style={[styles.statusTag, transactions.pending > 0 ? styles.tagPending : styles.tagSynced]}>
              <Text style={[styles.statusTagText, transactions.pending > 0 ? styles.tagTextPending : styles.tagTextSynced]}>
                {transactions.pending > 0 ? `${transactions.pending} Pending` : 'Uploaded ✓'}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionDesc}>
            Transactions automatically synchronize in the background when connected to the internet. <Text style={{ fontWeight: 'bold' }}>Marked as uploaded ONLY after server confirms storage.</Text>
          </Text>

          {/* 4-Card Metric Grid */}
          <View style={styles.metricGrid}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Total</Text>
              <Text style={styles.metricVal}>{transactions.total}</Text>
            </View>
            <View style={[styles.metricBox, styles.metricBoxSuccess]}>
              <Text style={styles.metricLabel}>Uploaded</Text>
              <Text style={[styles.metricVal, { color: Colors.gotDark }]}>{transactions.uploaded}</Text>
            </View>
            <View style={[styles.metricBox, transactions.pending > 0 ? styles.metricBoxPending : null]}>
              <Text style={styles.metricLabel}>Pending</Text>
              <Text style={[styles.metricVal, { color: transactions.pending > 0 ? '#B45309' : Colors.textSecondary }]}>
                {transactions.pending}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Failed</Text>
              <Text style={[styles.metricVal, { color: transactions.failed > 0 ? Colors.danger : Colors.textMuted }]}>
                {transactions.failed}
              </Text>
            </View>
          </View>

          <View style={styles.timestampRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.timestampText}>Last Successful Sync: {textSyncFormatted}</Text>
          </View>

          {/* Sync Action Button */}
          <TouchableOpacity
            style={[styles.actionBtn, isSyncing && styles.actionBtnDisabled]}
            onPress={handleManualTextSync}
            disabled={isSyncing}
            activeOpacity={0.8}
          >
            {isSyncing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.btnRow}>
                <Ionicons name="sync-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>
                  {transactions.pending > 0 ? `Sync ${transactions.pending} Pending Transactions` : 'Verify & Synchronize Now'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* SECTION 3: Image Media Backup & Schedule */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <Ionicons name="images" size={20} color={Colors.online} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Receipt &amp; Image Media Backup</Text>
            </View>
            <View style={[styles.statusTag, images.pending > 0 ? styles.tagPending : styles.tagSynced]}>
              <Text style={[styles.statusTagText, images.pending > 0 ? styles.tagTextPending : styles.tagTextSynced]}>
                {images.pending > 0 ? `${images.pending} Waiting` : 'Uploaded ✓'}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionDesc}>
            Receipt photos use a separate daily upload cycle to optimize network bandwidth and battery life.
          </Text>

          {/* 4-Card Metric Grid */}
          <View style={styles.metricGrid}>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Total Photos</Text>
              <Text style={styles.metricVal}>{images.total}</Text>
            </View>
            <View style={[styles.metricBox, styles.metricBoxSuccess]}>
              <Text style={styles.metricLabel}>Uploaded</Text>
              <Text style={[styles.metricVal, { color: Colors.gotDark }]}>{images.uploaded}</Text>
            </View>
            <View style={[styles.metricBox, images.pending > 0 ? styles.metricBoxPending : null]}>
              <Text style={styles.metricLabel}>Waiting</Text>
              <Text style={[styles.metricVal, { color: images.pending > 0 ? '#B45309' : Colors.textSecondary }]}>
                {images.pending}
              </Text>
            </View>
            <View style={styles.metricBox}>
              <Text style={styles.metricLabel}>Failed</Text>
              <Text style={[styles.metricVal, { color: images.failed > 0 ? Colors.danger : Colors.textMuted }]}>
                {images.failed}
              </Text>
            </View>
          </View>

          {/* Schedule Info Box */}
          <View style={styles.scheduleInfoBox}>
            <View style={styles.scheduleHeaderRow}>
              <View style={styles.scheduleLeft}>
                <Ionicons name="alarm-outline" size={20} color={Colors.primary} style={{ marginRight: 6 }} />
                <View>
                  <Text style={styles.scheduleLabel}>Upload Schedule</Text>
                  <Text style={styles.scheduleValue}>Daily at {formatTimeDisplay(images.scheduleTime)}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.changeScheduleBtn}
                onPress={() => {
                  const [h, m] = (images.scheduleTime || '02:00').split(':');
                  setTempHour(h || '02');
                  setTempMinute(m || '00');
                  setIsScheduleModalOpen(true);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.changeScheduleBtnText}>Change Time</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.scheduleSubRow}>
              <Text style={styles.scheduleSubText}>Scheduled automatic upload</Text>
              <Switch
                value={images.scheduleEnabled}
                onValueChange={(val) => toggleImageScheduleEnabled(val)}
                trackColor={{ false: Colors.border, true: Colors.gotLight }}
                thumbColor={images.scheduleEnabled ? Colors.gotDark : '#f4f3f4'}
              />
            </View>
          </View>

          <View style={styles.timestampRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textMuted} style={{ marginRight: 4 }} />
            <Text style={styles.timestampText}>Last Image Upload: {imageSyncFormatted}</Text>
          </View>

          {/* Image Sync Action Button */}
          <TouchableOpacity
            style={[styles.imageActionBtn, isImageSyncing && styles.actionBtnDisabled]}
            onPress={handleManualImageSync}
            disabled={isImageSyncing}
            activeOpacity={0.8}
          >
            {isImageSyncing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.btnRow}>
                <Ionicons name="cloud-upload-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.actionBtnText}>
                  {images.pending > 0 ? `Upload ${images.pending} Pending Images Now` : 'Verify Image Storage'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* SECTION 4: Recent Backup Activity / History */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionTitleGroup}>
              <Ionicons name="list-circle-outline" size={20} color={Colors.primary} style={{ marginRight: 6 }} />
              <Text style={styles.sectionTitle}>Recent Backup Activity</Text>
            </View>
            <Text style={styles.activityCountBadge}>{(backupActivityLogs || []).length} events</Text>
          </View>

          <Text style={styles.sectionDesc}>
            Audit log of background sync events, health checks, and server responses.
          </Text>

          {(!backupActivityLogs || backupActivityLogs.length === 0) ? (
            <View style={styles.emptyActivityBox}>
              <Ionicons name="checkmark-done-circle-outline" size={28} color={Colors.textMuted} />
              <Text style={styles.emptyActivityText}>No recent backup errors or pending alerts.</Text>
            </View>
          ) : (
            <View style={styles.activityList}>
              {backupActivityLogs.slice(0, 8).map((log, idx) => {
                const isSuccess = log.status === 'success';
                const isFailed = log.status === 'failed';
                const formattedTime = formatFullDateTime(log.timestamp).time;

                return (
                  <View key={log.id || idx} style={[styles.activityRow, idx > 0 && styles.activityBorder]}>
                    <View style={styles.activityTimeCol}>
                      <Text style={styles.activityTimeText}>{formattedTime}</Text>
                    </View>

                    <View style={styles.activityContentCol}>
                      <View style={styles.activityStatusPillRow}>
                        <Ionicons
                          name={isSuccess ? 'checkmark-circle' : isFailed ? 'close-circle' : 'information-circle'}
                          size={15}
                          color={isSuccess ? Colors.gotDark : isFailed ? Colors.danger : Colors.warning}
                          style={{ marginRight: 4 }}
                        />
                        <Text style={[styles.activityMsg, isFailed && { color: Colors.danger }]}>
                          {log.message}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* SECTION 5: Manual Offline Archive & Exports */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Manual Exports &amp; Data Archive</Text>
          <Text style={styles.sectionDesc}>
            Generate offline database files and statements for secure external backups.
          </Text>

          <View style={styles.exportButtonsRow}>
            <TouchableOpacity
              style={styles.exportItemBtn}
              onPress={() => exportFullJSONBackup()}
              activeOpacity={0.7}
            >
              <Ionicons name="archive-outline" size={20} color="#B45309" />
              <Text style={styles.exportItemText}>JSON Backup</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportItemBtn}
              onPress={() => exportTransactionsToCSV()}
              activeOpacity={0.7}
            >
              <Ionicons name="grid-outline" size={20} color={Colors.primary} />
              <Text style={styles.exportItemText}>CSV Export</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exportItemBtn}
              onPress={() => exportTransactionsToPDF()}
              activeOpacity={0.7}
            >
              <Ionicons name="document-text-outline" size={20} color="#DC2626" />
              <Text style={styles.exportItemText}>PDF Statement</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* SECTION 6: Danger Zone — Single Dedicated Location */}
        <View style={styles.dangerZoneCard}>
          <View style={styles.dangerHeaderRow}>
            <Ionicons name="warning" size={22} color={Colors.danger} style={{ marginRight: 8 }} />
            <Text style={styles.dangerTitle}>Danger Zone: Erase Local Data</Text>
          </View>

          <Text style={styles.dangerNotice}>
            This is the single dedicated location in the app for resetting mobile data. To prevent accidental data loss, erasing requires a 4-step progressive confirmation.
          </Text>

          <View style={styles.serverSafetyBanner}>
            <Ionicons name="shield-checkmark" size={18} color="#059669" style={{ marginRight: 6, marginTop: 1 }} />
            <Text style={styles.serverSafetyText}>
              <Text style={{ fontWeight: 'bold' }}>Server Safety Guarantee:</Text> Erasing this device will only wipe local SQLite tables. Your backed-up data on the server will <Text style={{ fontWeight: 'bold' }}>NEVER</Text> be deleted.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.startEraseBtn}
            onPress={startEraseFlow}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
            <Text style={styles.startEraseBtnText}>Erase Device Data Only...</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Schedule Time Picker Modal */}
      <Modal
        visible={isScheduleModalOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsScheduleModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, Shadows.lg]}>
            <View style={styles.modalHeaderRow}>
              <Ionicons name="time" size={22} color={Colors.primary} />
              <Text style={styles.modalHeaderTitle}>Set Image Upload Time</Text>
            </View>

            <Text style={styles.modalSub}>
              Select the daily scheduled time when images should automatically upload to the server:
            </Text>

            {/* Preset Chips */}
            <View style={styles.schedulePresetsGrid}>
              {SCHEDULE_PRESETS.map((p) => {
                const isCurrent = `${tempHour}:${tempMinute}` === p.time;
                return (
                  <TouchableOpacity
                    key={p.time}
                    style={[styles.schedulePresetChip, isCurrent && styles.schedulePresetChipActive]}
                    onPress={() => {
                      const [h, m] = p.time.split(':');
                      setTempHour(h);
                      setTempMinute(m);
                    }}
                  >
                    <Text style={[styles.schedulePresetChipText, isCurrent && styles.schedulePresetChipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Hour/Minute Input */}
            <Text style={styles.inputSectionLabel}>CUSTOM TIME (24-HOUR FORMAT)</Text>
            <View style={styles.timeInputsRow}>
              <View style={styles.timeBox}>
                <Text style={styles.timeBoxLabel}>Hour (00-23)</Text>
                <TextInput
                  style={styles.timeField}
                  value={tempHour}
                  onChangeText={setTempHour}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
              <Text style={styles.timeColon}>:</Text>
              <View style={styles.timeBox}>
                <Text style={styles.timeBoxLabel}>Minute (00-59)</Text>
                <TextInput
                  style={styles.timeField}
                  value={tempMinute}
                  onChangeText={setTempMinute}
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsScheduleModalOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleSaveCustomSchedule}
              >
                <Text style={styles.modalSaveBtnText}>Save Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 4-Step Erase Protected Modal */}
      <Modal
        visible={eraseModalStep > 0}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelEraseFlow}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.eraseCard, Shadows.lg]}>
            {/* Step indicator header */}
            <View style={styles.eraseStepHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>Step {eraseModalStep} of 3</Text>
              </View>
              <Text style={styles.eraseStepTitle}>
                {eraseModalStep === 1
                  ? 'Permanent Device Reset'
                  : eraseModalStep === 2
                  ? 'Confirm Local Removal'
                  : 'Final Verification Required'}
              </Text>
            </View>

            {/* Step 1: Explanation */}
            {eraseModalStep === 1 && (
              <View>
                <View style={styles.eraseWarningBox}>
                  <Ionicons name="alert-circle" size={24} color={Colors.danger} style={{ marginRight: 8, marginTop: 2 }} />
                  <Text style={styles.eraseWarningText}>
                    You are about to wipe all local transactions, parties, and image files stored on this device.
                  </Text>
                </View>

                <View style={styles.eraseBulletList}>
                  <Text style={styles.bulletItem}>• Erases local SQLite database (`expenses_khata.db`)</Text>
                  <Text style={styles.bulletItem}>• Clears local receipt photos from device storage</Text>
                  <Text style={styles.bulletItem}>• Resets local customer lists and custom categories</Text>
                </View>

                <View style={styles.serverExplicitCallout}>
                  <Text style={styles.serverExplicitCalloutText}>
                    This will permanently erase data from this device only. Your backed-up data on the server will not be deleted.
                  </Text>
                </View>

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={cancelEraseFlow}>
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stepNextBtn} onPress={proceedToStep2}>
                    <Text style={styles.stepNextBtnText}>Proceed to Step 2 &rarr;</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Step 2: Re-confirmation warning */}
            {eraseModalStep === 2 && (
              <View>
                <View style={[styles.eraseWarningBox, { backgroundColor: '#FEF2F2' }]}>
                  <Text style={[styles.eraseWarningText, { color: '#991B1B' }]}>
                    Are you absolutely certain? This operation CANNOT be undone locally.
                  </Text>
                </View>

                <Text style={styles.step2Explanation}>
                  If you haven't synchronized your latest transactions yet, unsynced local data will be permanently lost from this phone.
                </Text>

                <View style={styles.serverExplicitCallout}>
                  <Text style={styles.serverExplicitCalloutText}>
                    This will permanently erase data from this device only. Your backed-up data on the server will not be deleted.
                  </Text>
                </View>

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={cancelEraseFlow}>
                    <Text style={styles.modalCancelBtnText}>Cancel &amp; Keep Data</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.stepDangerBtn} onPress={proceedToStep3}>
                    <Text style={styles.stepDangerBtnText}>Continue to Verification &rarr;</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Step 3: Type confirmation phrase */}
            {eraseModalStep === 3 && (
              <View>
                <Text style={styles.step3Prompt}>
                  To confirm local erasure, please type <Text style={{ fontWeight: 'bold', color: Colors.danger }}>DELETE</Text> in the box below:
                </Text>

                <TextInput
                  style={styles.verificationInput}
                  placeholder="Type DELETE to confirm"
                  value={eraseInputWord}
                  onChangeText={setEraseInputWord}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />

                <View style={styles.serverExplicitCallout}>
                  <Text style={styles.serverExplicitCalloutText}>
                    This will permanently erase data from this device only. Your backed-up data on the server will not be deleted.
                  </Text>
                </View>

                <View style={styles.modalBtnRow}>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={cancelEraseFlow} disabled={isErasing}>
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.executeEraseBtn,
                      (eraseInputWord.trim().toUpperCase() !== 'DELETE' && eraseInputWord.trim().toUpperCase() !== 'ERASE') || isErasing
                        ? styles.executeEraseBtnDisabled
                        : null,
                    ]}
                    onPress={executeLocalErase}
                    disabled={
                      (eraseInputWord.trim().toUpperCase() !== 'DELETE' && eraseInputWord.trim().toUpperCase() !== 'ERASE') || isErasing
                    }
                  >
                    {isErasing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.executeEraseBtnText}>Erase Device Data Now</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backBtn: {
    marginRight: Spacing.sm + 2,
    padding: 4,
  },
  headerTitles: {
    flex: 1,
  },
  headerMainTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  headerActionBtn: {
    backgroundColor: Colors.surfaceSubtle,
    padding: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  masterCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    marginBottom: Spacing.md,
  },
  masterTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  masterIconGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  masterStatusTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  masterStatusSub: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  quickSummaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: Spacing.md,
  },
  quickPill: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.sm,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  quickPillLabel: {
    fontSize: 9.5,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.semibold,
    textTransform: 'uppercase',
  },
  quickPillVal: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    marginTop: 2,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  sectionDesc: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  tagSynced: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  tagPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  tagFailed: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
  },
  tagTextSynced: {
    color: '#059669',
  },
  tagTextPending: {
    color: '#B45309',
  },
  tagTextFailed: {
    color: '#DC2626',
  },
  endpointTable: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  endpointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  endpointBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  endpointLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  healthDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  endpointName: {
    fontSize: 12.5,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textPrimary,
  },
  endpointUrl: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
    maxWidth: 220,
  },
  endpointRight: {
    alignItems: 'flex-end',
  },
  endpointStatusText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
  },
  endpointLatency: {
    fontSize: 9.5,
    color: Colors.textMuted,
    marginTop: 1,
  },
  testServerBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  testServerBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  metricBox: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.sm,
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  metricBoxSuccess: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  metricBoxPending: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
  },
  metricVal: {
    fontSize: 15,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginTop: 2,
  },
  timestampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    marginTop: 4,
  },
  timestampText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: Typography.fontWeights.medium,
  },
  actionBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageActionBtn: {
    backgroundColor: Colors.online,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDisabled: {
    opacity: 0.65,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
  },
  scheduleInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm + 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  scheduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scheduleLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.bold,
    textTransform: 'uppercase',
  },
  scheduleValue: {
    fontSize: 12.5,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  changeScheduleBtn: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  changeScheduleBtnText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.primary,
  },
  scheduleSubRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  scheduleSubText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeights.medium,
  },
  activityCountBadge: {
    fontSize: 10.5,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    backgroundColor: Colors.surfaceSubtle,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  emptyActivityBox: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: 6,
  },
  emptyActivityText: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textMuted,
  },
  activityList: {
    backgroundColor: '#F8FAFC',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: Spacing.md,
  },
  activityBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  activityTimeCol: {
    width: 60,
  },
  activityTimeText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textMuted,
  },
  activityContentCol: {
    flex: 1,
  },
  activityStatusPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityMsg: {
    fontSize: 11.5,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeights.medium,
    flex: 1,
  },
  exportButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  exportItemBtn: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: BorderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
    gap: 4,
  },
  exportItemText: {
    fontSize: 10.5,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  dangerZoneCard: {
    backgroundColor: '#FFF1F2',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    marginTop: Spacing.xs,
  },
  dangerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dangerTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: '#9F1239',
  },
  dangerNotice: {
    fontSize: Typography.fontSizes.xs,
    color: '#881337',
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  serverSafetyBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ECFDF5',
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginBottom: Spacing.md,
  },
  serverSafetyText: {
    flex: 1,
    fontSize: 11,
    color: '#065F46',
    lineHeight: 17,
  },
  startEraseBtn: {
    backgroundColor: '#BE123C',
    borderRadius: BorderRadius.md,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startEraseBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.md,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 420,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  modalHeaderTitle: {
    fontSize: Typography.fontSizes.lg,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
  },
  modalSub: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  schedulePresetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.md,
  },
  schedulePresetChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  schedulePresetChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  schedulePresetChipText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.medium,
    color: Colors.textPrimary,
  },
  schedulePresetChipTextActive: {
    color: '#FFFFFF',
    fontWeight: Typography.fontWeights.bold,
  },
  inputSectionLabel: {
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textSecondary,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  timeInputsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: Spacing.lg,
  },
  timeBox: {
    alignItems: 'center',
  },
  timeBoxLabel: {
    fontSize: 9.5,
    color: Colors.textMuted,
    marginBottom: 3,
  },
  timeField: {
    width: 60,
    height: 42,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: Typography.fontWeights.bold,
    backgroundColor: Colors.surfaceSubtle,
    color: Colors.textPrimary,
  },
  timeColon: {
    fontSize: 22,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textMuted,
    marginTop: 14,
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  modalCancelBtnText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.semibold,
    color: Colors.textSecondary,
  },
  modalSaveBtn: {
    flex: 1.5,
    paddingVertical: 11,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveBtnText: {
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
    color: '#FFFFFF',
  },
  eraseCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 440,
    borderWidth: 2,
    borderColor: '#FCA5A5',
  },
  eraseStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  stepBadge: {
    backgroundColor: '#BE123C',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  stepBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: Typography.fontWeights.bold,
  },
  eraseStepTitle: {
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
    color: '#9F1239',
  },
  eraseWarningBox: {
    flexDirection: 'row',
    backgroundColor: '#FFF1F2',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#FECDD3',
    marginBottom: Spacing.sm,
  },
  eraseWarningText: {
    flex: 1,
    fontSize: Typography.fontSizes.xs + 1,
    fontWeight: Typography.fontWeights.bold,
    color: '#9F1239',
    lineHeight: 18,
  },
  eraseBulletList: {
    paddingVertical: 6,
    gap: 4,
    marginBottom: Spacing.sm,
  },
  bulletItem: {
    fontSize: 11.5,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeights.medium,
  },
  serverExplicitCallout: {
    backgroundColor: '#ECFDF5',
    padding: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#A7F3D0',
    marginVertical: Spacing.sm,
  },
  serverExplicitCalloutText: {
    fontSize: 11,
    fontWeight: Typography.fontWeights.bold,
    color: '#065F46',
    lineHeight: 16,
    textAlign: 'center',
  },
  stepNextBtn: {
    flex: 1.5,
    backgroundColor: Colors.primaryDark,
    borderRadius: BorderRadius.md,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNextBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
  step2Explanation: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  stepDangerBtn: {
    flex: 1.5,
    backgroundColor: '#BE123C',
    borderRadius: BorderRadius.md,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDangerBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
  step3Prompt: {
    fontSize: 12.5,
    color: Colors.textPrimary,
    lineHeight: 18,
    marginBottom: 8,
  },
  verificationInput: {
    height: 44,
    borderWidth: 2,
    borderColor: '#BE123C',
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    backgroundColor: '#FFF1F2',
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  executeEraseBtn: {
    flex: 1.5,
    backgroundColor: '#BE123C',
    borderRadius: BorderRadius.md,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  executeEraseBtnDisabled: {
    backgroundColor: '#E2E8F0',
  },
  executeEraseBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.sm,
    fontWeight: Typography.fontWeights.bold,
  },
  lockedScrollContent: {
    padding: Spacing.lg,
    paddingBottom: 60,
  },
  lockedCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl || 20,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  lockedIconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  lockedTitle: {
    fontSize: Typography.fontSizes.xl,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  lockedDesc: {
    fontSize: Typography.fontSizes.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  lockedLoginBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryDark || Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  lockedLoginBtnText: {
    color: '#FFFFFF',
    fontSize: Typography.fontSizes.md,
    fontWeight: Typography.fontWeights.bold,
  },
  lockedFeaturesList: {
    width: '100%',
    gap: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  featureItemTitle: {
    fontSize: Typography.fontSizes.sm + 0.5,
    fontWeight: Typography.fontWeights.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  featureItemDesc: {
    fontSize: Typography.fontSizes.xs,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
});
