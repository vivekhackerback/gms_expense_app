import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import API_CONFIG from '../constants/api_config';
import { checkNetworkConnectivity, uploadPendingImages } from './syncService';
import { ensureImageDirectoryExists, downloadAndSaveImageLocally } from './imageService';
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
  getDetailedBackupReportStats,
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

    // 2.1 Sync/Upload any pending transaction receipt photos first
    console.log('📸 [BACKUP_STEP_IMAGE] Checking and uploading pending transaction photos...');
    onProgress?.({ step: 1, totalSteps: 3, title: 'Uploading Receipt Photos...', percent: 15 });
    try {
      const imgUploadRes = await uploadPendingImages(100);
      console.log('📸 [BACKUP_STEP_IMAGE] Photo upload result:', imgUploadRes);
    } catch (imgSyncErr) {
      console.warn('⚠️ [BACKUP_STEP_IMAGE] Photo upload error (will proceed with DB backup):', imgSyncErr);
    }

    onProgress?.({ step: 2, totalSteps: 3, title: 'Preparing SQLite Database...', percent: 35 });

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

    // 6. Upload SQLite .db file to Server
    console.log('🚀 [BACKUP_STEP_6] Initiating database upload...');
    const savedLocation = getBackupSettings()?.backupLocation?.trim();
    const targetUploadUrl = (savedLocation && savedLocation.startsWith('http') && !savedLocation.includes('gmsexpense.tplpro.in'))
      ? savedLocation
      : API_CONFIG.DATABASE_BACKUP_UPLOAD_URL;

    console.log('📤 [BACKUP_STEP_6] Database filename: expenses_khata.db');
    console.log('📤 [BACKUP_STEP_6] Database size:', fileSize, 'bytes', `(${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);
    console.log('📤 [BACKUP_STEP_6] Target Upload URL:', targetUploadUrl);

    const uploadHeaders = {
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(auth.token ? { 'Authorization': `Bearer ${auth.token}` } : {}),
    };

    const uploadParameters = {
      phone: String(userPhone),
      user_id: String(userId),
      tx_count: String(txCount),
      party_count: String(partyCount),
      category_count: String(categoryCount),
      image_count: String(imagesInDbCount),
    };

    console.log('📤 [BACKUP_STEP_6] Upload Parameters:', uploadParameters);

    const uploadStartTime = Date.now();
    let responseStatus = 0;
    let responseText = '';
    let uploadMethodUsed = '';

    try {
      // ─── Strategy A (Primary): Direct native FileSystem.uploadAsync on the DB file ───
      // OkHttp reads the file via streaming (file.asRequestBody()), which works on
      // Android/POSIX even when SQLite holds the file open (no mandatory file locking).
      // This avoids copying 20MB into JS memory or staging a temp file.
      // NOTE: Do NOT use FileSystem.copyAsync on an open SQLite file — it throws
      // java.io.IOException because the file is locked by the WAL journal.
      if (Platform.OS !== 'web') {
        try {
          console.log('🔄 [BACKUP_STEP_6] Strategy A: Direct native FileSystem.uploadAsync on DB file...');
          // Ensure the URI has the file:// prefix that uploadAsync expects
          const uploadUri = dbPath.startsWith('file://') ? dbPath : `file://${dbPath}`;
          console.log('📤 [BACKUP_STEP_6] Upload file URI:', uploadUri);

          const uploadResult = await FileSystem.uploadAsync(
            targetUploadUrl,
            uploadUri,
            {
              httpMethod: 'POST',
              uploadType: FileSystem.FileSystemUploadType.MULTIPART,
              fieldName: 'db_file',
              mimeType: 'application/octet-stream',
              headers: uploadHeaders,
              parameters: uploadParameters,
            }
          );

          responseStatus = uploadResult.status;
          responseText = uploadResult.body;
          uploadMethodUsed = 'direct_upload_async';
          console.log(`✅ [BACKUP_STEP_6] Strategy A completed: HTTP ${responseStatus} in ${Date.now() - uploadStartTime}ms`);
        } catch (stratAErr) {
          console.warn('⚠️ [BACKUP_STEP_6] Strategy A failed:', {
            error: stratAErr?.message,
            code: stratAErr?.code,
            stack: stratAErr?.stack,
          });
          console.log('🔄 [BACKUP_STEP_6] Falling back to Strategy B...');
        }
      }

      // ─── Strategy B (Fallback): serializeSync → write temp file (base64) → uploadAsync ───
      // This creates a clean in-memory snapshot of the database (bypassing file locks),
      // writes it to a temporary cache file, then uploads that temp file via native OkHttp.
      // Memory cost: ~27MB base64 string for a 20MB database (temporary).
      if (!responseStatus || responseStatus < 200 || responseStatus >= 300) {
        try {
          console.log('🔄 [BACKUP_STEP_6] Strategy B: serializeSync → temp file → uploadAsync...');
          const db = getDatabase();
          const serializeStart = Date.now();
          const dbBytes = typeof db.serializeSync === 'function'
            ? db.serializeSync()
            : (typeof db.serializeAsync === 'function' ? await db.serializeAsync() : null);

          if (!dbBytes || dbBytes.length === 0) {
            throw new Error('serializeSync returned empty/null — database may be corrupted');
          }

          console.log(`📦 [BACKUP_STEP_6] Serialized ${dbBytes.length} bytes in ${Date.now() - serializeStart}ms`);

          // Convert Uint8Array to base64 string (for FileSystem.writeAsStringAsync)
          const chunkSize = 32768; // Process in 32KB chunks to avoid call stack overflow
          let base64Str = '';
          for (let i = 0; i < dbBytes.length; i += chunkSize) {
            const chunk = dbBytes.subarray(i, Math.min(i + chunkSize, dbBytes.length));
            base64Str += String.fromCharCode.apply(null, chunk);
          }
          base64Str = btoa(base64Str);
          console.log(`📦 [BACKUP_STEP_6] Base64 encoded: ${base64Str.length} chars`);

          // Write to temporary cache file
          const tempFile = `${FileSystem.cacheDirectory}db_backup_${Date.now()}.db`;
          await FileSystem.writeAsStringAsync(tempFile, base64Str, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Verify temp file was written correctly
          const tempInfo = await FileSystem.getInfoAsync(tempFile);
          console.log(`📄 [BACKUP_STEP_6] Temp file written:`, {
            path: tempFile,
            exists: tempInfo.exists,
            size: tempInfo.size,
            expectedSize: dbBytes.length,
            sizeMatch: tempInfo.size === dbBytes.length,
          });

          if (!tempInfo.exists || tempInfo.size === 0) {
            throw new Error(`Temp file write failed: exists=${tempInfo.exists}, size=${tempInfo.size}`);
          }

          // Upload the temp file via native OkHttp multipart
          if (Platform.OS !== 'web') {
            const uploadResult = await FileSystem.uploadAsync(
              targetUploadUrl,
              tempFile,
              {
                httpMethod: 'POST',
                uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                fieldName: 'db_file',
                mimeType: 'application/octet-stream',
                headers: uploadHeaders,
                parameters: uploadParameters,
              }
            );
            responseStatus = uploadResult.status;
            responseText = uploadResult.body;
            uploadMethodUsed = 'serialize_temp_upload_async';
          } else {
            // Web fallback: read the temp file as blob
            const fileContent = await FileSystem.readAsStringAsync(tempFile, {
              encoding: FileSystem.EncodingType.Base64,
            });
            const binaryStr = atob(fileContent);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            const dbBlob = new Blob([bytes], { type: 'application/octet-stream' });
            const formData = new FormData();
            formData.append('db_file', dbBlob, 'expenses_khata.db');
            Object.entries(uploadParameters).forEach(([k, v]) => formData.append(k, v));

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);
            const fetchRes = await fetch(targetUploadUrl, {
              method: 'POST',
              headers: uploadHeaders,
              body: formData,
              signal: controller.signal,
            });
            clearTimeout(timeoutId);
            responseStatus = fetchRes.status;
            responseText = await fetchRes.text();
            uploadMethodUsed = 'serialize_blob_fetch';
          }

          console.log(`✅ [BACKUP_STEP_6] Strategy B completed: HTTP ${responseStatus} in ${Date.now() - uploadStartTime}ms`);

          // Cleanup temp file
          try {
            await FileSystem.deleteAsync(tempFile, { idempotent: true });
          } catch (_) {}
        } catch (stratBErr) {
          console.warn('⚠️ [BACKUP_STEP_6] Strategy B failed:', {
            error: stratBErr?.message,
            code: stratBErr?.code,
            stack: stratBErr?.stack,
          });
          console.log('🔄 [BACKUP_STEP_6] Falling back to Strategy C...');
        }
      }

      // ─── Strategy C (Last Resort): serializeSync → Blob → FormData → fetch ───
      // Pure JS approach. Works on all platforms. ~40MB JS memory for 20MB DB.
      if (!responseStatus || responseStatus < 200 || responseStatus >= 300) {
        console.log('🔄 [BACKUP_STEP_6] Strategy C: serializeSync → Blob → FormData → fetch...');
        const db = getDatabase();
        const dbBytes = typeof db.serializeSync === 'function'
          ? db.serializeSync()
          : (typeof db.serializeAsync === 'function' ? await db.serializeAsync() : null);

        if (!dbBytes || dbBytes.length === 0) {
          throw new Error('Cannot serialize database — all upload strategies exhausted');
        }

        const dbBlob = new Blob([dbBytes], { type: 'application/octet-stream' });
        const formData = new FormData();
        formData.append('db_file', dbBlob, 'expenses_khata.db');
        Object.entries(uploadParameters).forEach(([k, v]) => formData.append(k, v));

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout for large files
        const fetchRes = await fetch(targetUploadUrl, {
          method: 'POST',
          headers: uploadHeaders,
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        responseStatus = fetchRes.status;
        responseText = await fetchRes.text();
        uploadMethodUsed = 'serialize_blob_fetch_direct';
        console.log(`✅ [BACKUP_STEP_6] Strategy C completed: HTTP ${responseStatus} in ${Date.now() - uploadStartTime}ms`);
      }
    } catch (uploadReqErr) {
      const uploadDuration = Date.now() - uploadStartTime;

      // Classify the error: filesystem vs network vs timeout
      const errMsg = uploadReqErr?.message || '';
      const isFilesystemError = errMsg.includes('IOException') || errMsg.includes('copyAsync')
        || errMsg.includes('ERR_UNEXPECTED') || errMsg.includes('permission')
        || errMsg.includes('ENOENT') || errMsg.includes('No such file');
      const isTimeoutError = uploadReqErr?.name === 'AbortError' || errMsg.includes('aborted')
        || errMsg.includes('timeout');
      const isNetworkError = errMsg.includes('Network') || errMsg.includes('network')
        || errMsg.includes('ECONNREFUSED') || errMsg.includes('ETIMEDOUT');

      let errorCategory = 'unknown';
      let userMessage = '';
      if (isFilesystemError) {
        errorCategory = 'filesystem';
        userMessage = `Database file error: ${errMsg}`;
      } else if (isTimeoutError) {
        errorCategory = 'timeout';
        userMessage = `Upload timed out after ${Math.round(uploadDuration / 1000)}s. Try on a faster connection.`;
      } else if (isNetworkError) {
        errorCategory = 'network';
        userMessage = `Network error during upload: ${errMsg}`;
      } else {
        errorCategory = 'upload_error';
        userMessage = `Database upload failed: ${errMsg || 'Connection failed'}`;
      }

      console.error(`❌ [BACKUP_FAILED] Database Upload Exception [${errorCategory}]:`, {
        url: targetUploadUrl,
        dbPath,
        fileSize,
        durationMs: uploadDuration,
        errorCategory,
        errorName: uploadReqErr?.name,
        errorMessage: errMsg,
        errorCode: uploadReqErr?.code,
        errorStack: uploadReqErr?.stack,
      });

      addBackupActivityLog('db_backup_upload', 'failed', userMessage);
      return {
        success: false,
        message: userMessage,
        stage: `upload_${errorCategory}`,
        errorDetails: {
          category: errorCategory,
          message: errMsg,
          name: uploadReqErr?.name,
          url: targetUploadUrl,
          durationMs: uploadDuration,
        },
      };
    }

    const uploadDuration = Date.now() - uploadStartTime;
    console.log(`📥 [BACKUP_STEP_6] Server response received via [${uploadMethodUsed}] in ${uploadDuration}ms:`, {
      httpStatus: responseStatus,
      bodyPreview: responseText?.substring ? responseText.substring(0, 300) : responseText,
    });

    if (responseStatus !== 200) {
      console.error('❌ [BACKUP_FAILED] Database Upload Server Error (Non-200 HTTP Status):', {
        httpStatus: responseStatus,
        responseBody: responseText,
        targetUrl: targetUploadUrl,
        dbPath,
        fileSize,
      });

      let serverMsg = '';
      try {
        const j = JSON.parse(responseText);
        serverMsg = j?.message;
      } catch (e) {}

      const errMsg = serverMsg || `Server returned HTTP ${responseStatus}: ${responseText.substring(0, 100) || 'Unknown error'}`;
      addBackupActivityLog('db_backup_upload', 'failed', `Database upload failed: ${errMsg}`);
      return {
        success: false,
        message: `Database upload failed (HTTP ${responseStatus}): ${errMsg}`,
        stage: 'http_error_status',
        httpStatus: responseStatus,
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

    onProgress?.({ step: 3, totalSteps: 3, title: 'Verifying Cloud Storage...', percent: 95 });

    // 8. Re-query actual detailed stats from SQLite to report accurate image counts
    let imgStats = { total: 0, uploaded: 0, pending: 0, failed: 0 };
    try {
      const detailed = getDetailedBackupReportStats();
      if (detailed && detailed.images) {
        imgStats = detailed.images;
      }
    } catch (statErr) {
      console.warn('⚠️ Warning getting final stats:', statErr);
    }

    const sizeKb = fileSize > 0 ? (fileSize / 1024).toFixed(1) : '0';
    const totalPhotos = imgStats.total || imagesInDbCount || 0;
    const uploadedPhotos = imgStats.uploaded || 0;
    const failedPhotos = (imgStats.failed || 0) + (imgStats.pending || 0);

    const now = Math.floor(Date.now() / 1000);
    try {
      updateBackupSettings({
        lastBackupStatus: failedPhotos > 0 ? 'failed' : 'success',
        lastSuccessfulBackup: failedPhotos > 0 ? (getBackupSettings().lastSuccessfulBackup || 0) : now,
        lastFailedBackup: failedPhotos > 0 ? now : 0,
        lastBackupError: failedPhotos > 0 ? `${failedPhotos} receipt photo(s) failed to upload` : '',
        lastBackupSize: fileSize,
        backupCompletedAt: now,
      });
      if (failedPhotos === 0) {
        updateSetting('last_full_backup', String(now));
        updateSetting('last_sync', String(now));
      }
    } catch (setErr) {
      console.warn('Could not save backup settings:', setErr);
    }

    if (failedPhotos > 0) {
      const partialMsg = `Database backed up (${sizeKb} KB, ${txCount} txs), but ${failedPhotos} photo(s) failed to upload.`;
      console.warn('⚠️ [BACKUP_PARTIAL]', partialMsg);
      addBackupActivityLog('db_backup_upload', 'failed', partialMsg);
      return {
        success: false,
        message: partialMsg,
        stats: {
          transactions: txCount,
          parties: partyCount,
          categories: categoryCount,
          images: totalPhotos,
          uploadedImages: uploadedPhotos,
          failedImages: failedPhotos,
          pendingImages: imgStats.pending || 0,
          dbSize: fileSize,
        },
      };
    }

    onProgress?.({ step: 3, totalSteps: 3, title: 'Backup Completed!', percent: 100 });
    const successMsg = `Full database (${sizeKb} KB, ${txCount} txs) and all ${uploadedPhotos} photos backed up ✓`;
    console.log('\n========================================');
    console.log('🎉 [BACKUP_SUCCESS] Full database and photos backup completed successfully!');
    console.log(`📊 Summary: ${sizeKb} KB DB file, ${txCount} transactions, ${uploadedPhotos} photos verified on server.`);
    console.log('========================================\n');

    addBackupActivityLog('db_backup_upload', 'success', successMsg);

    return {
      success: true,
      message: 'Complete SQLite database and receipt photos successfully uploaded to server.',
      stats: {
        transactions: txCount,
        parties: partyCount,
        categories: categoryCount,
        images: totalPhotos,
        uploadedImages: uploadedPhotos,
        failedImages: 0,
        pendingImages: 0,
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
 * Download complete SQLite database and all associated images from server and restore locally.
 * Supports choosing a specific backup file snapshot or defaulting to the latest active backup.
 */
export const importCloudDataAndRestore = async (onProgress, selectedBackupFile = null) => {
  console.log('\n========================================');
  console.log('🔄 [RESTORE_START] Starting full SQLite database and photos restoration...');
  if (selectedBackupFile) {
    console.log('📦 [RESTORE_START] Selected target backup snapshot:', selectedBackupFile.file_name || selectedBackupFile.label);
  }
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
        console.warn('⚠️ [RESTORE_STEP_2] Error creating DB parent directory (ignored):', dirErr);
      }
    }

    // 3. Download database to temporary staging file in document directory
    const stagingFileName = `staging_cloud_db_${Date.now()}.db`;
    const tempStagingDb = `${FileSystem.documentDirectory}${stagingFileName}`;
    let downloadUrl = `${API_CONFIG.DATABASE_BACKUP_DOWNLOAD_URL}?phone=${encodeURIComponent(userPhone)}`;
    if (selectedBackupFile) {
      if (selectedBackupFile.download_url) {
        downloadUrl = selectedBackupFile.download_url;
      } else if (selectedBackupFile.file_name) {
        downloadUrl = `${API_CONFIG.DATABASE_BACKUP_DOWNLOAD_URL}?phone=${encodeURIComponent(userPhone)}&file=${encodeURIComponent(selectedBackupFile.file_name)}`;
      }
    }
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

    // 4. Safely inspect and transfer database tables
    console.log('🔒 [RESTORE_STEP_4] Restoring SQLite database from verified staging file...');
    checkpointDatabase();

    const rawDocDir = (FileSystem.documentDirectory || '').replace(/^file:\/\//, '').replace(/\/+$/, '');
    let stagingDb = null;
    let stagingTransactions = [];
    let stagingParties = [];
    let stagingCategories = [];
    let stagingImages = [];
    let stagingUpi = [];

    try {
      console.log(`🔄 [RESTORE_STEP_4] Opening staging DB instance: ${rawDocDir}/${stagingFileName}`);
      stagingDb = SQLite.openDatabaseSync(stagingFileName, {}, rawDocDir);

      try {
        stagingTransactions = stagingDb.getAllSync('SELECT * FROM transactions;');
      } catch (e) {
        console.warn('⚠️ Could not read transactions from staging DB:', e?.message);
      }

      try {
        stagingParties = stagingDb.getAllSync('SELECT * FROM parties;');
      } catch (e) {}

      try {
        stagingCategories = stagingDb.getAllSync('SELECT * FROM categories;');
      } catch (e) {}

      try {
        stagingImages = stagingDb.getAllSync('SELECT * FROM transaction_images;');
      } catch (e) {}

      try {
        stagingUpi = stagingDb.getAllSync('SELECT * FROM upi_info;');
      } catch (e) {}

      console.log(`📊 [RESTORE_STEP_4] Verified staging DB rows: ${stagingTransactions.length} transactions, ${stagingParties.length} parties, ${stagingCategories.length} categories, ${stagingImages.length} images.`);
    } catch (stagingOpenErr) {
      console.warn('⚠️ [RESTORE_STEP_4] Error opening staging DB:', stagingOpenErr?.message);
    }

    const activeDb = getDatabase();

    // Strategy A: Native SQLite Online Backup API
    let restoredViaBackupApi = false;
    if (stagingDb) {
      try {
        if (typeof SQLite.backupDatabaseAsync === 'function') {
          console.log('🔄 [RESTORE_STEP_4] Attempting SQLite.backupDatabaseAsync...');
          await SQLite.backupDatabaseAsync({
            sourceDatabase: stagingDb,
            destDatabase: activeDb,
          });
          restoredViaBackupApi = true;
        } else if (typeof SQLite.backupDatabaseSync === 'function') {
          console.log('🔄 [RESTORE_STEP_4] Attempting SQLite.backupDatabaseSync...');
          SQLite.backupDatabaseSync({
            sourceDatabase: stagingDb,
            destDatabase: activeDb,
          });
          restoredViaBackupApi = true;
        }
      } catch (nativeBackupErr) {
        console.warn('⚠️ [RESTORE_STEP_4] Native SQLite backup API error:', nativeBackupErr?.message);
      }
    }

    // Verify if activeDb contains the expected transactions after backup API
    let activeTxCount = 0;
    try {
      const checkRow = activeDb.getFirstSync('SELECT COUNT(*) as count FROM transactions;');
      activeTxCount = checkRow?.count || 0;
    } catch (e) {}

    // Strategy B: If activeDb is still empty but staging had transactions, transfer via atomic SQL
    if (activeTxCount === 0 && stagingTransactions.length > 0) {
      console.log(`🔄 [RESTORE_STEP_4] Transferring ${stagingTransactions.length} transactions via atomic SQL transaction...`);
      try {
        activeDb.execSync('PRAGMA foreign_keys = OFF;');
        activeDb.execSync('BEGIN TRANSACTION;');

        // 1. Categories
        if (stagingCategories.length > 0) {
          try {
            activeDb.execSync('DELETE FROM categories;');
            const stmtCat = activeDb.prepareSync(
              'INSERT OR REPLACE INTO categories (id, name, icon, color, is_custom, is_deleted, is_default, is_active, created_at, updated_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);'
            );
            for (const c of stagingCategories) {
              stmtCat.executeSync([
                c.id,
                c.name,
                c.icon,
                c.color,
                c.is_custom ?? 0,
                c.is_deleted ?? 0,
                c.is_default ?? 0,
                c.is_active ?? 1,
                c.created_at || Date.now(),
                c.updated_at || Date.now(),
                c.sync_status || 'synced',
              ]);
            }
            stmtCat.finalizeSync();
          } catch (catErr) {
            console.warn('Category transfer warning:', catErr?.message);
          }
        }

        // 2. Parties
        if (stagingParties.length > 0) {
          try {
            activeDb.execSync('DELETE FROM parties;');
            const stmtParty = activeDb.prepareSync(
              'INSERT OR REPLACE INTO parties (id, name, phone, address, credit_limit, opening_balance, current_balance, is_active, created_at, updated_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);'
            );
            for (const p of stagingParties) {
              stmtParty.executeSync([
                p.id,
                p.name,
                p.phone || '',
                p.address || '',
                p.credit_limit || 0,
                p.opening_balance || 0,
                p.current_balance || 0,
                p.is_active ?? 1,
                p.created_at || Date.now(),
                p.updated_at || Date.now(),
                p.sync_status || 'synced',
              ]);
            }
            stmtParty.finalizeSync();
          } catch (partyErr) {
            console.warn('Party transfer warning:', partyErr?.message);
          }
        }

        // 3. Transactions
        activeDb.execSync('DELETE FROM transactions;');
        const stmtTx = activeDb.prepareSync(
          'INSERT OR REPLACE INTO transactions (id, uuid, type, payment_mode, amount, category_id, party_id, note, transaction_date, created_at, updated_at, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);'
        );
        for (const t of stagingTransactions) {
          stmtTx.executeSync([
            t.id,
            t.uuid,
            t.type,
            t.payment_mode,
            t.amount,
            t.category_id,
            t.party_id,
            t.note || '',
            String(t.transaction_date),
            t.created_at,
            t.updated_at || t.created_at,
            t.sync_status || 'synced',
          ]);
        }
        stmtTx.finalizeSync();

        // 4. Transaction Images
        if (stagingImages.length > 0) {
          try {
            activeDb.execSync('DELETE FROM transaction_images;');
            const stmtImg = activeDb.prepareSync(
              'INSERT OR REPLACE INTO transaction_images (id, transaction_id, transaction_uuid, local_uri, server_url, server_id, server_synced_at, file_name, original_file_name, upload_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);'
            );
            for (const img of stagingImages) {
              stmtImg.executeSync([
                img.id,
                img.transaction_id,
                img.transaction_uuid,
                img.local_uri || '',
                img.server_url || '',
                img.server_id || null,
                img.server_synced_at || null,
                img.file_name || '',
                img.original_file_name || '',
                img.upload_status || 'uploaded',
                img.created_at || Date.now(),
              ]);
            }
            stmtImg.finalizeSync();
          } catch (imgErr) {
            console.warn('Image table transfer warning:', imgErr?.message);
          }
        }

        // 5. UPI Info
        if (stagingUpi.length > 0) {
          try {
            activeDb.execSync('DELETE FROM upi_info;');
            const stmtUpi = activeDb.prepareSync(
              'INSERT OR REPLACE INTO upi_info (id, upi_id, upi_update, updated_at) VALUES (?, ?, ?, ?);'
            );
            for (const u of stagingUpi) {
              stmtUpi.executeSync([u.id, u.upi_id, u.upi_update ?? 1, u.updated_at || '']);
            }
            stmtUpi.finalizeSync();
          } catch (upiErr) {}
        }

        activeDb.execSync('COMMIT;');
        activeDb.execSync('PRAGMA foreign_keys = ON;');
        console.log('✅ [RESTORE_STEP_4] Atomic SQL transfer completed successfully!');
      } catch (sqlTransferErr) {
        console.error('❌ [RESTORE_STEP_4] SQL transfer error:', sqlTransferErr);
        try { activeDb.execSync('ROLLBACK;'); } catch (e) {}
      }
    }

    // Close staging DB and delete temporary downloaded staging database file
    if (stagingDb) {
      try { stagingDb.closeSync(); } catch (e) {}
    }
    try {
      await FileSystem.deleteAsync(tempStagingDb, { idempotent: true });
    } catch (cleanErr) {
      console.warn('⚠️ [RESTORE_STEP_4] Staging file cleanup warning:', cleanErr?.message);
    }

    onProgress?.({ step: 2, totalSteps: 3, title: 'Restoring Local Ledger...', percent: 70 });

    // 5. Re-open and Re-initialize SQLite Database to ensure all caches and connections are fresh
    console.log('🔄 [RESTORE_STEP_5] Re-opening and verifying SQLite database...');
    closeDatabase();
    const db = initDatabase();

    // Verify actual row count in live database
    let finalTxCount = 0;
    try {
      const vRow = db.getFirstSync('SELECT COUNT(*) as count FROM transactions;');
      finalTxCount = vRow?.count || 0;
      console.log(`✅ [RESTORE_STEP_5] Verified: Live SQLite database now contains ${finalTxCount} transactions.`);
    } catch (vErr) {
      console.warn('Verification query warning:', vErr?.message);
    }

    // 6. Download and restore all transaction receipt photos
    onProgress?.({ step: 3, totalSteps: 3, title: 'Restoring Receipt Photos...', percent: 75 });
    console.log('🖼️ [RESTORE_STEP_6] Downloading and restoring transaction receipt photos...');
    await ensureImageDirectoryExists();

    let photosRestoredCount = 0;
    let photosFailedCount = 0;

    let restoredImages = [];
    try {
      restoredImages = db.getAllSync(
        'SELECT id, transaction_id, transaction_uuid, local_uri, server_url, file_name FROM transaction_images;'
      );
    } catch (readErr) {
      console.warn('⚠️ [RESTORE_STEP_6] Error reading restored transaction_images:', readErr);
    }

    const manifestMap = new Map();
    if (Array.isArray(info.images)) {
      for (const mImg of info.images) {
        if (mImg.file_name) {
          manifestMap.set(mImg.file_name, mImg.download_url);
        }
      }
    }

    const docDir = FileSystem.documentDirectory || '';
    const imagesDir = `${docDir}transaction_photos/`;

    for (const img of restoredImages) {
      const fileName = img.file_name || (img.local_uri ? img.local_uri.split('/').pop() : `photo_${img.id}.jpg`);
      const targetLocalUri = `${imagesDir}${fileName}`;

      let existsLocally = false;
      try {
        const fileStat = await FileSystem.getInfoAsync(targetLocalUri);
        if (fileStat && fileStat.exists && fileStat.size > 0) {
          existsLocally = true;
        }
      } catch (e) {}

      // If missing on disk, download from server
      if (!existsLocally) {
        const downloadUrl = img.server_url || manifestMap.get(fileName);
        if (downloadUrl) {
          try {
            console.log(`📥 [RESTORE_STEP_6] Downloading photo from: ${downloadUrl}`);
            const savedUri = await downloadAndSaveImageLocally(downloadUrl, fileName, auth.token);
            if (savedUri) {
              existsLocally = true;
            }
          } catch (dlErr) {
            console.warn(`⚠️ [RESTORE_STEP_6] Failed to download photo ${fileName}:`, dlErr.message);
          }
        }
      }

      if (existsLocally) {
        photosRestoredCount++;
        try {
          db.runSync(
            "UPDATE transaction_images SET local_uri = ?, upload_status = 'uploaded' WHERE id = ?;",
            [targetLocalUri, img.id]
          );
        } catch (upErr) {}
      } else {
        photosFailedCount++;
        try {
          db.runSync(
            "UPDATE transaction_images SET upload_status = 'failed' WHERE id = ?;",
            [img.id]
          );
        } catch (upErr) {}
      }
    }

    onProgress?.({ step: 3, totalSteps: 3, title: 'Data Restoration Completed!', percent: 100 });

    const txCount = finalTxCount > 0 ? finalTxCount : (info.stats?.transactions || 0);
    const restoreMsg = photosFailedCount > 0
      ? `Restored ${txCount} transactions & ${photosRestoredCount} photos (${photosFailedCount} missing on server)`
      : `Restored ${txCount} transactions & all ${photosRestoredCount} photos from server ✓`;

    console.log('\n========================================');
    console.log('🎉 [RESTORE_SUCCESS] Full database & photos restoration completed!');
    console.log(`📊 Summary: ${txCount} transactions verified in SQLite, ${photosRestoredCount} photos restored (${photosFailedCount} failed).`);
    console.log('========================================\n');

    addBackupActivityLog('cloud_restore', photosFailedCount > 0 ? 'pending' : 'success', restoreMsg);

    return {
      success: true,
      message: restoreMsg,
      stats: {
        ...info.stats,
        transactions: txCount,
        images: photosRestoredCount,
      },
      photosRestored: photosRestoredCount,
      photosFailed: photosFailedCount,
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
