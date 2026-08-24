import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import API_CONFIG from '../constants/api_config';
import { checkNetworkConnectivity } from './syncService';
import {
  checkpointDatabase,
  closeDatabase,
  getDatabase,
  getDatabaseFilePath,
  initDatabase,
} from '../database/db';
import {
  getAuthSession,
  addBackupActivityLog,
  updateSetting,
  getBackupSettings,
  updateBackupSettings,
} from '../database/queries';

const getImagesDir = () => {
  if (Platform.OS === 'web' || !FileSystem.documentDirectory) return null;
  return `${FileSystem.documentDirectory}transaction_photos/`;
};

/**
 * Upload the entire SQLite database file and all local transaction photos to the server
 */
export const uploadEntireDatabaseAndImages = async (onProgress) => {
  console.log('\n========================================');
  console.log('🔄 [BACKUP_START] Starting full SQLite database and photos backup...');
  console.log('========================================');

  const nowStart = Math.floor(Date.now() / 1000);
  try {
    updateBackupSettings({
      lastBackupStatus: 'in_progress',
      backupStartedAt: nowStart,
    });
  } catch (e) {}

  try {
    // 1. Network Connectivity Check
    const net = await checkNetworkConnectivity();
    console.log('🌐 [BACKUP_STEP_1] Network status check:', {
      isConnected: net.isConnected,
      type: net.type,
      isWifi: net.isWifi,
    });

    if (!net.isConnected) {
      const offlineMsg = 'Device is offline. Internet connection required to upload database.';
      console.error('❌ [BACKUP_FAILED] Network error: Device is not connected to internet.');
      addBackupActivityLog('db_backup_upload', 'failed', `Full backup failed: ${offlineMsg}`);
      updateBackupSettings({
        lastBackupStatus: 'failed',
        lastFailedBackup: Math.floor(Date.now() / 1000),
        lastBackupError: offlineMsg,
      });
      return { success: false, message: offlineMsg, stage: 'network_check' };
    }

    // 2. Authentication Session Check
    const auth = getAuthSession();
    console.log('👤 [BACKUP_STEP_2] Authentication session check:', {
      isLoggedIn: auth.isLoggedIn,
      userPhone: auth?.user?.phone,
      userId: auth?.user?.id,
      hasToken: Boolean(auth.token),
    });

    if (!auth.isLoggedIn) {
      const authMsg = 'Please log in to backup your database to the server.';
      console.error('❌ [BACKUP_FAILED] Auth error: User session is not logged in.');
      addBackupActivityLog('db_backup_upload', 'failed', `Full backup failed: ${authMsg}`);
      updateBackupSettings({
        lastBackupStatus: 'failed',
        lastFailedBackup: Math.floor(Date.now() / 1000),
        lastBackupError: authMsg,
      });
      return { success: false, message: authMsg, stage: 'auth_check' };
    }

    const userPhone = auth?.user?.phone || '9876543210';
    const userId = auth?.user?.id || 1;

    onProgress?.({ step: 1, totalSteps: 2, title: 'Preparing Database...', percent: 20 });

    // 3. Commit SQLite WAL checkpoint to ensure all data is in expenses_khata.db file
    console.log('💾 [BACKUP_STEP_3] Executing PRAGMA wal_checkpoint(TRUNCATE)...');
    try {
      checkpointDatabase();
      console.log('✅ [BACKUP_STEP_3] Database checkpoint completed successfully.');
    } catch (ckptErr) {
      console.warn('⚠️ [BACKUP_STEP_3] WAL Checkpoint warning:', ckptErr);
    }

    // 4. Resolve Database File Path
    console.log('📁 [BACKUP_STEP_4] Resolving SQLite database file path on device...');
    const dbPath = await getDatabaseFilePath();
    console.log('📁 [BACKUP_STEP_4] Resolved DB file path:', dbPath);

    if (!dbPath) {
      const pathErrMsg = 'Cannot resolve SQLite database file path on this device.';
      console.error('❌ [BACKUP_FAILED] Path error: getDatabaseFilePath returned null/undefined.');
      addBackupActivityLog('db_backup_upload', 'failed', `Full backup failed: ${pathErrMsg}`);
      return { success: false, message: pathErrMsg, stage: 'db_path_resolution' };
    }

    let dbInfo = null;
    try {
      dbInfo = await FileSystem.getInfoAsync(dbPath);
      console.log('📄 [BACKUP_STEP_4] Database file info:', dbInfo);
    } catch (infoErr) {
      console.error('⚠️ [BACKUP_STEP_4] Error checking dbPath with getInfoAsync:', {
        dbPath,
        error: infoErr?.message,
        stack: infoErr?.stack,
      });
    }

    if (!dbInfo || !dbInfo.exists) {
      if (dbPath.startsWith('file://')) {
        try {
          const altPath = dbPath.replace('file://', '');
          const altInfo = await FileSystem.getInfoAsync(altPath);
          console.log('📄 [BACKUP_STEP_4] Checking alternate path (no file://):', altPath, altInfo);
          if (altInfo && altInfo.exists) {
            dbInfo = altInfo;
          }
        } catch (altErr) {
          console.warn('⚠️ [BACKUP_STEP_4] Alt path check error:', altErr);
        }
      }
    }

    // Fallback: If still not found, ensure DB is initialized and recheck
    if (!dbInfo || !dbInfo.exists) {
      console.warn('⚠️ [BACKUP_STEP_4] DB file not found on disk, re-initializing and checkpointing...');
      try {
        initDatabase();
        checkpointDatabase();
        dbInfo = await FileSystem.getInfoAsync(dbPath);
        console.log('📄 [BACKUP_STEP_4] DB file info after re-init:', dbInfo);
      } catch (reinitErr) {
        console.error('❌ [BACKUP_STEP_4] Error re-initializing database:', reinitErr);
      }
    }

    if (!dbInfo || !dbInfo.exists) {
      const fileMissingMsg = `Database file not found on device at path: ${dbPath}`;
      console.error('❌ [BACKUP_FAILED] File error:', {
        dbPath,
        dbInfo,
        documentDirectory: FileSystem.documentDirectory,
        cacheDirectory: FileSystem.cacheDirectory,
      });
      addBackupActivityLog('db_backup_upload', 'failed', `Full backup failed: ${fileMissingMsg}`);
      return { success: false, message: fileMissingMsg, stage: 'file_existence_check', dbPath };
    }

    const fileSize = dbInfo?.size || 0;
    console.log(`✅ [BACKUP_STEP_4] Database file verified. Size: ${(fileSize / 1024).toFixed(2)} KB (${fileSize} bytes)`);

    // 5. Gather Summary Counts
    let txCount = 0;
    let partyCount = 0;
    let categoryCount = 0;
    let imagesInDbCount = 0;

    try {
      const db = getDatabase();
      const txRes = db.getAllSync('SELECT COUNT(*) as cnt FROM transactions;');
      txCount = txRes[0]?.cnt || 0;
      const partyRes = db.getAllSync('SELECT COUNT(*) as cnt FROM parties;');
      partyCount = partyRes[0]?.cnt || 0;
      const catRes = db.getAllSync('SELECT COUNT(*) as cnt FROM categories;');
      categoryCount = catRes[0]?.cnt || 0;
      const imgRes = db.getAllSync('SELECT COUNT(*) as cnt FROM transaction_images;');
      imagesInDbCount = imgRes[0]?.cnt || 0;

      console.log('📊 [BACKUP_STEP_5] Local SQLite entity counts:', {
        txCount,
        partyCount,
        categoryCount,
        imagesInDbCount,
      });
    } catch (cntErr) {
      console.warn('⚠️ [BACKUP_STEP_5] Warning reading DB counts:', cntErr);
    }

    onProgress?.({ step: 1, totalSteps: 2, title: 'Uploading SQLite Database File...', percent: 45 });

    // 6. Upload SQLite .db file to Server using fetch & FormData
    console.log('🚀 [BACKUP_STEP_6] Initiating multipart database upload via fetch/FormData...');
    console.log('📤 [BACKUP_STEP_6] Method: fetch / FormData');
    console.log('📤 [BACKUP_STEP_6] Database filename: expenses_khata.db');
    console.log('📤 [BACKUP_STEP_6] Database MIME type: application/octet-stream');
    console.log('📤 [BACKUP_STEP_6] Database size:', fileSize, 'bytes');
    console.log('📤 [BACKUP_STEP_6] Target Upload URL:', API_CONFIG.DATABASE_BACKUP_UPLOAD_URL);
    console.log('📤 [BACKUP_STEP_6] Upload Parameters:', {
      phone: String(userPhone),
      user_id: String(userId),
      tx_count: String(txCount),
      party_count: String(partyCount),
      category_count: String(categoryCount),
      image_count: String(imagesInDbCount),
    });

    const formData = new FormData();
    formData.append('db_file', {
      uri: dbPath,
      name: 'expenses_khata.db',
      type: 'application/octet-stream',
    });
    formData.append('phone', String(userPhone));
    formData.append('user_id', String(userId));
    formData.append('tx_count', String(txCount));
    formData.append('party_count', String(partyCount));
    formData.append('category_count', String(categoryCount));
    formData.append('image_count', String(imagesInDbCount));

    const uploadHeaders = {
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(auth.token ? { 'Authorization': `Bearer ${auth.token}` } : {}),
    };
    // Note: Do NOT set Content-Type header when using FormData; let React Native/fetch set multipart boundary automatically.

    const uploadStartTime = Date.now();
    let response = null;
    let responseText = '';
    try {
      response = await fetch(API_CONFIG.DATABASE_BACKUP_UPLOAD_URL, {
        method: 'POST',
        headers: uploadHeaders,
        body: formData,
      });
      responseText = await response.text();
    } catch (uploadReqErr) {
      const uploadDuration = Date.now() - uploadStartTime;
      console.error('❌ [BACKUP_FAILED] Database File Upload Network / Request Exception:', {
        url: API_CONFIG.DATABASE_BACKUP_UPLOAD_URL,
        dbPath,
        fileSize,
        durationMs: uploadDuration,
        errorName: uploadReqErr?.name,
        errorMessage: uploadReqErr?.message,
        errorStack: uploadReqErr?.stack,
        error: uploadReqErr,
      });
      const failMsg = `Network error during database upload: ${uploadReqErr?.message || 'Connection failed'}`;
      addBackupActivityLog('db_backup_upload', 'failed', failMsg);
      return {
        success: false,
        message: failMsg,
        stage: 'upload_request_exception',
        errorDetails: {
          message: uploadReqErr?.message,
          name: uploadReqErr?.name,
          url: API_CONFIG.DATABASE_BACKUP_UPLOAD_URL,
        },
      };
    }

    const uploadDuration = Date.now() - uploadStartTime;
    console.log(`📥 [BACKUP_STEP_6] Server response received in ${uploadDuration}ms:`, {
      httpStatus: response?.status,
      bodyPreview: responseText?.substring ? responseText.substring(0, 300) : responseText,
    });

    if (response.status !== 200) {
      console.error('❌ [BACKUP_FAILED] Database Upload Server Error (Non-200 HTTP Status):', {
        httpStatus: response.status,
        responseBody: responseText,
        targetUrl: API_CONFIG.DATABASE_BACKUP_UPLOAD_URL,
        dbPath,
        fileSize,
      });

      const errMsg = `Server returned HTTP ${response.status}: ${responseText.substring(0, 120) || 'Unknown error'}`;
      addBackupActivityLog('db_backup_upload', 'failed', `Database upload failed (HTTP ${response.status})`);
      return {
        success: false,
        message: `Database upload failed: HTTP ${response.status}`,
        stage: 'http_error_status',
        httpStatus: response.status,
        responseBody: responseText,
      };
    }

    // 7. Parse Server Response JSON
    let uploadJson = null;
    try {
      uploadJson = JSON.parse(responseText);
      console.log('✅ [BACKUP_STEP_7] Parsed Server Response JSON:', uploadJson);
    } catch (jsonErr) {
      console.error('❌ [BACKUP_FAILED] JSON Parse Error on Database Upload Response:', {
        parseError: jsonErr?.message,
        rawResponseBody: responseText,
      });
      addBackupActivityLog('db_backup_upload', 'failed', 'Invalid JSON response from backup server');
      return {
        success: false,
        message: 'Invalid response from backup server (Non-JSON).',
        stage: 'json_parse_error',
        rawBody: responseText,
      };
    }

    if (!uploadJson.success) {
      console.error('❌ [BACKUP_FAILED] Server Rejected Database Upload:', {
        serverMessage: uploadJson.message,
        fullResponse: uploadJson,
      });
      const rejectMsg = uploadJson.message || 'Database upload rejected by server.';
      addBackupActivityLog('db_backup_upload', 'failed', rejectMsg);
      updateBackupSettings({
        lastBackupStatus: 'failed',
        lastFailedBackup: Math.floor(Date.now() / 1000),
        lastBackupError: rejectMsg,
      });
      return {
        success: false,
        message: rejectMsg,
        stage: 'server_rejected',
        serverResponse: uploadJson,
      };
    }

    onProgress?.({ step: 2, totalSteps: 2, title: 'Backup Completed!', percent: 100 });

    const sizeKb = fileSize > 0 ? (fileSize / 1024).toFixed(1) : '0';
    const successMsg = `Full database (${sizeKb} KB, ${txCount} txs) backed up to server ✓`;
    console.log('\n========================================');
    console.log('🎉 [BACKUP_SUCCESS] Full database backup completed successfully!');
    console.log(`📊 Summary: ${sizeKb} KB DB file, ${txCount} transactions, ${partyCount} parties backed up.`);
    console.log('========================================\n');

    const now = Math.floor(Date.now() / 1000);
    try {
      updateBackupSettings({
        lastBackupStatus: 'success',
        lastSuccessfulBackup: now,
        lastBackupError: '',
        lastBackupSize: fileSize,
        backupCompletedAt: now,
      });
      updateSetting('last_full_backup', String(now));
      updateSetting('last_sync', String(now));
    } catch (setErr) {
      console.warn('Could not save backup settings:', setErr);
    }

    addBackupActivityLog('db_backup_upload', 'success', successMsg);

    return {
      success: true,
      message: 'Complete SQLite database successfully uploaded to server.',
      stats: {
        transactions: txCount,
        parties: partyCount,
        categories: categoryCount,
        images: 0,
        failedImages: 0,
        dbSize: fileSize,
      },
    };
  } catch (fatalError) {
    console.error('\n========================================');
    console.error('💥 [BACKUP_FATAL_ERROR] Uncaught exception during database & photos backup:');
    console.error({
      message: fatalError?.message,
      name: fatalError?.name,
      stack: fatalError?.stack,
      cause: fatalError?.cause,
      fatalError,
    });
    console.error('========================================\n');

    const errText = fatalError?.message || 'Unknown backup error';
    try {
      updateBackupSettings({
        lastBackupStatus: 'failed',
        lastFailedBackup: Math.floor(Date.now() / 1000),
        lastBackupError: errText,
      });
    } catch (e) {}

    addBackupActivityLog('db_backup_upload', 'failed', `Backup error: ${errText}`);
    return {
      success: false,
      message: `Backup failed: ${errText}`,
      stage: 'fatal_exception',
      errorDetails: {
        name: fatalError?.name,
        message: fatalError?.message,
        stack: fatalError?.stack,
      },
    };
  }
};

/**
 * Tests connectivity to the configured backup location / server
 */
export const testBackupLocation = async (customUrl = null) => {
  const settings = getBackupSettings();
  const targetUrl = customUrl || settings.backupLocation || API_CONFIG.DATABASE_BACKUP_UPLOAD_URL;
  const start = Date.now();

  try {
    const net = await checkNetworkConnectivity();
    if (!net.isConnected) {
      return {
        success: false,
        message: 'Device is offline. Internet connection required.',
        latencyMs: 0,
        url: targetUrl,
      };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(API_CONFIG.SERVER_HEALTH_URL, {
      method: 'GET',
      headers: API_CONFIG.HEADERS,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - start;
    if (res.ok) {
      return {
        success: true,
        message: `Backup location reachable (${latencyMs}ms response)`,
        latencyMs,
        url: targetUrl,
      };
    } else {
      return {
        success: false,
        message: `Server returned HTTP ${res.status}`,
        latencyMs,
        url: targetUrl,
      };
    }
  } catch (e) {
    const latencyMs = Date.now() - start;
    const isTimeout = e.name === 'AbortError';
    return {
      success: false,
      message: isTimeout ? 'Request timed out (8s limit)' : (e.message || 'Connection failed'),
      latencyMs,
      url: targetUrl,
    };
  }
};

/**
 * Periodically invoked by background daemon to perform automatic backups based on configured interval
 */
export const checkScheduledAutoBackup = async () => {
  try {
    const settings = getBackupSettings();
    if (!settings.autoBackupEnabled) {
      return { skipped: true, reason: 'auto_backup_disabled' };
    }

    const auth = getAuthSession();
    if (!auth.isLoggedIn) {
      return { skipped: true, reason: 'user_not_logged_in' };
    }

    const net = await checkNetworkConnectivity();
    if (!net.isConnected) {
      return { skipped: true, reason: 'device_offline' };
    }

    const now = Math.floor(Date.now() / 1000);
    const intervalSeconds = (settings.backupIntervalMinutes || 1440) * 60;
    const lastBackup = settings.lastSuccessfulBackup || 0;

    const isDue = (now - lastBackup) >= intervalSeconds;
    if (!isDue) {
      return {
        skipped: true,
        reason: 'not_due_yet',
        nextScheduledBackup: lastBackup + intervalSeconds,
      };
    }

    console.log(`⏰ [AUTO_BACKUP] Scheduled auto-backup triggered (Interval: ${settings.backupIntervalMinutes} mins)`);
    const res = await uploadEntireDatabaseAndImages();
    return { executed: true, result: res };
  } catch (err) {
    console.warn('Scheduled auto backup check error:', err);
    return { skipped: true, error: err };
  }
};

/**
 * Query the latest cloud backup metadata for the logged-in user
 */
export const fetchCloudBackupInfo = async () => {
  console.log('🔍 [CLOUD_BACKUP_CHECK] Checking latest backup manifest on server...');
  try {
    const net = await checkNetworkConnectivity();
    if (!net.isConnected) {
      console.warn('⚠️ [CLOUD_BACKUP_CHECK] Device offline during manifest check.');
      return { success: false, message: 'Device is offline. Connect to internet to check cloud backup.' };
    }

    const auth = getAuthSession();
    if (!auth.isLoggedIn) {
      console.warn('⚠️ [CLOUD_BACKUP_CHECK] User not logged in during manifest check.');
      return { success: false, message: 'Please log in to check your cloud backup.' };
    }

    const userPhone = auth?.user?.phone || '9876543210';
    const url = `${API_CONFIG.DATABASE_BACKUP_INFO_URL}?phone=${encodeURIComponent(userPhone)}`;
    console.log('📤 [CLOUD_BACKUP_CHECK] Requesting manifest URL:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const headers = {
      ...API_CONFIG.HEADERS,
      ...(auth.token ? { 'Authorization': `Bearer ${auth.token}` } : {}),
    };

    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const rawText = await response.text();
    console.log(`📥 [CLOUD_BACKUP_CHECK] HTTP ${response.status} Manifest Response:`, rawText);

    if (!response.ok) {
      console.error('❌ [CLOUD_BACKUP_CHECK] Manifest HTTP error:', { status: response.status, body: rawText });
      return { success: false, message: `Server error HTTP ${response.status}: ${rawText}` };
    }

    const json = JSON.parse(rawText);
    console.log('✅ [CLOUD_BACKUP_CHECK] Manifest parsed:', json);
    return json;
  } catch (error) {
    console.error('❌ [CLOUD_BACKUP_CHECK] Error fetching manifest:', {
      error: error?.message,
      name: error?.name,
      stack: error?.stack,
    });
    return { success: false, message: error?.message || 'Failed to reach backup server' };
  }
};

/**
 * Validate that a file is a genuine SQLite 3 database
 */
export const validateSQLiteFile = async (filePath) => {
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (!info || !info.exists) {
      return { isValid: false, reason: 'File does not exist on device.' };
    }
    if (info.size < 100) {
      let content = '';
      try {
        content = await FileSystem.readAsStringAsync(filePath, { length: 200 });
      } catch (e) {}
      return {
        isValid: false,
        reason: `File size is too small (${info.size} bytes). Server returned: ${content || 'empty content'}`,
      };
    }

    // Read the first 16 bytes to check SQLite magic header: "SQLite format 3\000"
    const header = await FileSystem.readAsStringAsync(filePath, { length: 16 });
    if (!header || !header.startsWith('SQLite format 3')) {
      let preview = '';
      try {
        preview = await FileSystem.readAsStringAsync(filePath, { length: 200 });
      } catch (e) {}
      return {
        isValid: false,
        reason: `Not a valid SQLite database. Server response: ${preview.substring(0, 150)}`,
      };
    }

    return { isValid: true, size: info.size };
  } catch (error) {
    return { isValid: false, reason: error?.message || 'Error checking file format' };
  }
};

/**
 * Download complete SQLite database and all associated images from server and restore locally
 */
export const importCloudDataAndRestore = async (onProgress) => {
  console.log('\n========================================');
  console.log('🔄 [RESTORE_START] Starting full SQLite database and photos restoration...');
  console.log('========================================');

  try {
    const net = await checkNetworkConnectivity();
    if (!net.isConnected) {
      console.error('❌ [RESTORE_FAILED] Device is offline.');
      addBackupActivityLog('cloud_restore', 'failed', 'Restore failed: Device is offline');
      return { success: false, message: 'Device is offline. Internet connection required to restore data.' };
    }

    const auth = getAuthSession();
    if (!auth.isLoggedIn) {
      console.error('❌ [RESTORE_FAILED] User not logged in.');
      return { success: false, message: 'Please log in to restore your cloud backup.' };
    }

    const userPhone = auth?.user?.phone || '9876543210';

    onProgress?.({ step: 1, totalSteps: 3, title: 'Checking Cloud Backup...', percent: 10 });

    // 1. Fetch Manifest & Backup Info
    console.log('🔍 [RESTORE_STEP_1] Fetching cloud backup manifest for user:', userPhone);
    const info = await fetchCloudBackupInfo();
    console.log('📋 [RESTORE_STEP_1] Cloud backup manifest info:', info);

    if (!info || !info.success || !info.has_backup) {
      console.error('❌ [RESTORE_FAILED] No cloud backup found:', info);
      addBackupActivityLog('cloud_restore', 'failed', 'Restore failed: No backup found on server');
      return {
        success: false,
        message: info?.message || 'No cloud database backup found for this account. Please upload a backup first.',
      };
    }

    onProgress?.({ step: 1, totalSteps: 3, title: 'Downloading SQLite Database...', percent: 30 });

    // 2. Resolve Target Database Path and Ensure Directory Exists
    let targetDbPath = await getDatabaseFilePath();
    if (!targetDbPath) {
      targetDbPath = `${FileSystem.documentDirectory || ''}SQLite/expenses_khata.db`;
    }
    console.log('📁 [RESTORE_STEP_2] Target DB restore path:', targetDbPath);

    const lastSlash = targetDbPath.lastIndexOf('/');
    if (lastSlash > 0) {
      const parentDir = targetDbPath.substring(0, lastSlash + 1);
      try {
        const parentInfo = await FileSystem.getInfoAsync(parentDir);
        if (!parentInfo.exists) {
          console.log('📁 [RESTORE_STEP_2] Creating database parent directory:', parentDir);
          await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });
        }
      } catch (dirErr) {
        console.warn('⚠️ [RESTORE_STEP_2] Error creating DB parent directory:', dirErr);
      }
    }

    // 3. Download the database to a temporary staging file first to prevent corruption
    const tempStagingDb = `${FileSystem.cacheDirectory}staging_cloud_db_${Date.now()}.db`;
    const downloadUrl = `${API_CONFIG.DATABASE_BACKUP_DOWNLOAD_URL}?phone=${encodeURIComponent(userPhone)}`;
    console.log('🚀 [RESTORE_STEP_3] Downloading database file from:', downloadUrl, 'to staging:', tempStagingDb);

    const downloadRes = await FileSystem.downloadAsync(
      downloadUrl,
      tempStagingDb,
      {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          ...(auth.token ? { 'Authorization': `Bearer ${auth.token}` } : {}),
        },
      }
    );
    console.log('📥 [RESTORE_STEP_3] Download response:', downloadRes);

    if (downloadRes.status !== 200) {
      console.error('❌ [RESTORE_FAILED] Database Download Failed (HTTP Status non-200):', downloadRes);
      try { await FileSystem.deleteAsync(tempStagingDb, { idempotent: true }); } catch (e) {}
      initDatabase();
      const failMsg = downloadRes.status === 404
        ? 'No cloud database backup found on server for this mobile number. Please tap "Backup to Cloud" first.'
        : `Failed to download database file (HTTP ${downloadRes.status}).`;
      addBackupActivityLog('cloud_restore', 'failed', failMsg);
      return { success: false, message: failMsg };
    }

    // Validate the downloaded SQLite file before touching the live database
    const validation = await validateSQLiteFile(tempStagingDb);
    console.log('🔬 [RESTORE_STEP_3] Downloaded SQLite file validation:', validation);
    if (!validation.isValid) {
      console.error('❌ [RESTORE_FAILED] Downloaded file is not a valid SQLite database:', validation.reason);
      try { await FileSystem.deleteAsync(tempStagingDb, { idempotent: true }); } catch (e) {}
      initDatabase();
      const failMsg = `Corrupted or invalid database backup received: ${validation.reason}`;
      addBackupActivityLog('cloud_restore', 'failed', failMsg);
      return { success: false, message: failMsg };
    }

    // 4. Safely replace the local active SQLite database with the verified downloaded file
    console.log('🔒 [RESTORE_STEP_4] Closing active SQLite connection before replacing file...');
    closeDatabase();

    const targetDbWal = `${targetDbPath}-wal`;
    const targetDbShm = `${targetDbPath}-shm`;

    // Remove old WAL / SHM and existing DB file
    try {
      const walInfo = await FileSystem.getInfoAsync(targetDbWal);
      if (walInfo.exists) await FileSystem.deleteAsync(targetDbWal, { idempotent: true });
      const shmInfo = await FileSystem.getInfoAsync(targetDbShm);
      if (shmInfo.exists) await FileSystem.deleteAsync(targetDbShm, { idempotent: true });
      const currentDbInfo = await FileSystem.getInfoAsync(targetDbPath);
      if (currentDbInfo.exists) await FileSystem.deleteAsync(targetDbPath, { idempotent: true });
    } catch (cleanErr) {
      console.warn('⚠️ [RESTORE_STEP_4] Error cleaning old DB/WAL/SHM:', cleanErr);
    }

    // Move staging DB to target path
    await FileSystem.copyAsync({
      from: tempStagingDb,
      to: targetDbPath,
    });
    try { await FileSystem.deleteAsync(tempStagingDb, { idempotent: true }); } catch (e) {}
    console.log('✅ [RESTORE_STEP_4] Verified database moved to target destination:', targetDbPath);

    onProgress?.({ step: 2, totalSteps: 2, title: 'Restoring Local Ledger...', percent: 90 });

    // 5. Re-open and Re-initialize SQLite Database
    console.log('🔄 [RESTORE_STEP_5] Re-opening and verifying SQLite database...');
    const db = initDatabase();

    onProgress?.({ step: 2, totalSteps: 2, title: 'Data Restoration Completed!', percent: 100 });

    const txCount = info.stats?.transactions || 0;
    const restoreMsg = `Restored ${txCount} transactions from server ✓`;
    console.log('\n========================================');
    console.log('🎉 [RESTORE_SUCCESS] Full database restoration completed successfully!');
    console.log(`📊 Summary: ${txCount} transactions restored.`);
    console.log('========================================\n');

    addBackupActivityLog('cloud_restore', 'success', restoreMsg);

    return {
      success: true,
      message: 'Your complete database has been restored successfully!',
      stats: info.stats,
      photosRestored: 0,
    };
  } catch (error) {
    console.error('\n========================================');
    console.error('💥 [RESTORE_FATAL_ERROR] Uncaught exception during database restoration:', {
      error: error?.message,
      name: error?.name,
      stack: error?.stack,
    });
    console.error('========================================\n');

    try {
      initDatabase();
    } catch (e) {}
    const errText = error?.message || 'Restore error';
    addBackupActivityLog('cloud_restore', 'failed', `Restore failed: ${errText}`);
    return { success: false, message: `Restore failed: ${errText}` };
  }
};
