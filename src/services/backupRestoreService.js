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

    // 6. Upload SQLite .db file to Server
    console.log('🚀 [BACKUP_STEP_6] Initiating multipart database upload...');
    console.log('📤 [BACKUP_STEP_6] Target Upload URL:', API_CONFIG.DATABASE_BACKUP_UPLOAD_URL);
    console.log('📤 [BACKUP_STEP_6] Upload Parameters:', {
      phone: String(userPhone),
      user_id: String(userId),
      tx_count: String(txCount),
      party_count: String(partyCount),
      category_count: String(categoryCount),
      image_count: String(imagesInDbCount),
    });

    const uploadHeaders = {
      'Accept': 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(auth.token ? { 'Authorization': `Bearer ${auth.token}` } : {}),
    };
    console.log('📤 [BACKUP_STEP_6] Upload Headers:', uploadHeaders);

    const uploadStartTime = Date.now();
    let uploadResult = null;
    try {
      uploadResult = await FileSystem.uploadAsync(API_CONFIG.DATABASE_BACKUP_UPLOAD_URL, dbPath, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'db_file',
        parameters: {
          phone: String(userPhone),
          user_id: String(userId),
          tx_count: String(txCount),
          party_count: String(partyCount),
          category_count: String(categoryCount),
          image_count: String(imagesInDbCount),
        },
        headers: uploadHeaders,
      });
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
      httpStatus: uploadResult?.status,
      headers: uploadResult?.headers,
      bodyPreview: uploadResult?.body?.substring ? uploadResult.body.substring(0, 300) : uploadResult?.body,
    });

    if (uploadResult.status !== 200) {
      console.error('❌ [BACKUP_FAILED] Database Upload Server Error (Non-200 HTTP Status):', {
        httpStatus: uploadResult.status,
        responseBody: uploadResult.body,
        responseHeaders: uploadResult.headers,
        targetUrl: API_CONFIG.DATABASE_BACKUP_UPLOAD_URL,
        dbPath,
        fileSize,
      });

      const errMsg = `Server returned HTTP ${uploadResult.status}: ${uploadResult.body?.substring(0, 120) || 'Unknown error'}`;
      addBackupActivityLog('db_backup_upload', 'failed', `Database upload failed (HTTP ${uploadResult.status})`);
      return {
        success: false,
        message: `Database upload failed: HTTP ${uploadResult.status}`,
        stage: 'http_error_status',
        httpStatus: uploadResult.status,
        responseBody: uploadResult.body,
      };
    }

    // 7. Parse Server Response JSON
    let uploadJson = null;
    try {
      uploadJson = JSON.parse(uploadResult.body);
      console.log('✅ [BACKUP_STEP_7] Parsed Server Response JSON:', uploadJson);
    } catch (jsonErr) {
      console.error('❌ [BACKUP_FAILED] JSON Parse Error on Database Upload Response:', {
        parseError: jsonErr?.message,
        rawResponseBody: uploadResult.body,
      });
      addBackupActivityLog('db_backup_upload', 'failed', 'Invalid JSON response from backup server');
      return {
        success: false,
        message: 'Invalid response from backup server (Non-JSON).',
        stage: 'json_parse_error',
        rawBody: uploadResult.body,
      };
    }

    if (!uploadJson.success) {
      console.error('❌ [BACKUP_FAILED] Server Rejected Database Upload:', {
        serverMessage: uploadJson.message,
        fullResponse: uploadJson,
      });
      const rejectMsg = uploadJson.message || 'Database upload rejected by server.';
      addBackupActivityLog('db_backup_upload', 'failed', rejectMsg);
      return {
        success: false,
        message: rejectMsg,
        stage: 'server_rejected',
        serverResponse: uploadJson,
      };
    }

    onProgress?.({ step: 2, totalSteps: 2, title: 'Uploading Associated Photos...', percent: 70 });

    // 8. Scan & Upload All Photos in transaction_photos Directory
    let uploadedImagesCount = 0;
    let failedImagesCount = 0;
    const imagesDir = getImagesDir();
    console.log(`📸 [BACKUP_STEP_8] Photos directory: ${imagesDir}`);

    if (imagesDir && Platform.OS !== 'web') {
      try {
        const dirInfo = await FileSystem.getInfoAsync(imagesDir);
        console.log('📸 [BACKUP_STEP_8] Photos directory info:', dirInfo);

        if (dirInfo.exists) {
          const files = await FileSystem.readDirectoryAsync(imagesDir);
          const totalFiles = files.length;
          console.log(`📸 [BACKUP_STEP_8] Found ${totalFiles} local photo file(s) to check and upload.`);

          for (let i = 0; i < totalFiles; i++) {
            const fileName = files[i];
            const fileUri = `${imagesDir}${fileName}`;
            
            try {
              console.log(`📤 [PHOTO_UPLOAD_${i + 1}/${totalFiles}] Uploading photo: ${fileName}...`);
              const formData = new FormData();
              formData.append('transaction_uuid', 'BACKUP_' + fileName.replace(/[^a-zA-Z0-9]/g, '_'));
              formData.append('phone', String(userPhone));
              formData.append('user_id', String(userId));
              formData.append('file_name', fileName);
              formData.append('file', {
                uri: fileUri,
                name: fileName,
                type: 'image/jpeg',
              });

              const photoHeaders = {
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                ...(auth.token ? { 'Authorization': `Bearer ${auth.token}` } : {}),
              };

              const imgRes = await fetch(API_CONFIG.IMAGE_UPLOAD_URL, {
                method: 'POST',
                headers: photoHeaders,
                body: formData,
              });

              const imgText = await imgRes.text();
              console.log(`📥 [PHOTO_UPLOAD_${i + 1}/${totalFiles}] ${fileName} HTTP ${imgRes.status} Response:`, imgText.substring(0, 150));

              if (imgRes.ok) {
                uploadedImagesCount++;
              } else {
                failedImagesCount++;
                console.error(`⚠️ [PHOTO_UPLOAD_FAILED] Photo upload error for ${fileName}:`, {
                  httpStatus: imgRes.status,
                  responseBody: imgText,
                });
              }
            } catch (photoErr) {
              failedImagesCount++;
              console.error(`❌ [PHOTO_UPLOAD_EXCEPTION] Exception uploading photo ${fileName}:`, {
                fileName,
                fileUri,
                error: photoErr?.message,
                stack: photoErr?.stack,
              });
            }

            const currentPercent = 70 + Math.round(((i + 1) / (totalFiles || 1)) * 28);
            onProgress?.({
              step: 2,
              totalSteps: 2,
              title: `Uploading Associated Photos (${i + 1}/${totalFiles})...`,
              percent: Math.min(currentPercent, 98),
            });
          }
        } else {
          console.log('ℹ️ [BACKUP_STEP_8] Photos directory does not exist yet (no local receipts stored).');
        }
      } catch (imgDirErr) {
        console.error('⚠️ [BACKUP_STEP_8] Error scanning photos directory:', {
          imagesDir,
          error: imgDirErr?.message,
          stack: imgDirErr?.stack,
        });
      }
    }

    onProgress?.({ step: 2, totalSteps: 2, title: 'Backup Completed!', percent: 100 });

    const sizeKb = fileSize > 0 ? (fileSize / 1024).toFixed(1) : '0';
    const successMsg = `Full database (${sizeKb} KB, ${txCount} txs) and ${uploadedImagesCount} photos backed up to server ✓`;
    console.log('\n========================================');
    console.log('🎉 [BACKUP_SUCCESS] Full backup completed successfully!');
    console.log(`📊 Summary: ${sizeKb} KB DB file, ${txCount} transactions, ${partyCount} parties, ${uploadedImagesCount} photos uploaded (${failedImagesCount} failed).`);
    console.log('========================================\n');

    addBackupActivityLog('db_backup_upload', 'success', successMsg);

    return {
      success: true,
      message: 'Complete SQLite database and photos successfully uploaded to server.',
      stats: {
        transactions: txCount,
        parties: partyCount,
        categories: categoryCount,
        images: uploadedImagesCount,
        failedImages: failedImagesCount,
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

    // 2. Close Active SQLite Connection Cleanly
    console.log('🔒 [RESTORE_STEP_2] Closing active SQLite connection before replacing file...');
    closeDatabase();

    // 3. Resolve Target Database Path and Ensure Directory Exists
    let targetDbPath = await getDatabaseFilePath();
    if (!targetDbPath) {
      targetDbPath = `${FileSystem.documentDirectory || ''}SQLite/expenses_khata.db`;
    }
    console.log('📁 [RESTORE_STEP_3] Target DB restore path:', targetDbPath);

    const lastSlash = targetDbPath.lastIndexOf('/');
    if (lastSlash > 0) {
      const parentDir = targetDbPath.substring(0, lastSlash + 1);
      try {
        const parentInfo = await FileSystem.getInfoAsync(parentDir);
        if (!parentInfo.exists) {
          console.log('📁 [RESTORE_STEP_3] Creating database parent directory:', parentDir);
          await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });
        }
      } catch (dirErr) {
        console.warn('⚠️ [RESTORE_STEP_3] Error creating DB parent directory:', dirErr);
      }
    }

    const targetDbWal = `${targetDbPath}-wal`;
    const targetDbShm = `${targetDbPath}-shm`;

    // Remove any leftover WAL / SHM files
    try {
      const walInfo = await FileSystem.getInfoAsync(targetDbWal);
      if (walInfo.exists) await FileSystem.deleteAsync(targetDbWal, { idempotent: true });
      const shmInfo = await FileSystem.getInfoAsync(targetDbShm);
      if (shmInfo.exists) await FileSystem.deleteAsync(targetDbShm, { idempotent: true });
    } catch (cleanErr) {
      console.warn('⚠️ [RESTORE_STEP_3] Error cleaning old WAL/SHM:', cleanErr);
    }

    // Download the database file directly
    const downloadUrl = info.db_download_url || `${API_CONFIG.DATABASE_BACKUP_DOWNLOAD_URL}?phone=${encodeURIComponent(userPhone)}`;
    console.log('🚀 [RESTORE_STEP_3] Downloading database file from:', downloadUrl, 'to:', targetDbPath);

    const downloadRes = await FileSystem.downloadAsync(
      downloadUrl,
      targetDbPath,
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
      initDatabase();
      addBackupActivityLog('cloud_restore', 'failed', `Database download failed (HTTP ${downloadRes.status})`);
      return { success: false, message: `Failed to download database file (HTTP ${downloadRes.status}).` };
    }

    onProgress?.({ step: 2, totalSteps: 3, title: 'Downloading Associated Photos...', percent: 60 });

    // 4. Download Photos
    let downloadedPhotosCount = 0;
    const imagesDir = getImagesDir();
    console.log('📸 [RESTORE_STEP_4] Local images directory:', imagesDir);

    if (imagesDir && Platform.OS !== 'web') {
      try {
        const imgDirInfo = await FileSystem.getInfoAsync(imagesDir);
        if (!imgDirInfo.exists) {
          await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });
        }

        const imagesToDownload = info.images || [];
        const totalImages = imagesToDownload.length;
        console.log(`📸 [RESTORE_STEP_4] Downloading ${totalImages} associated photo(s)...`);

        for (let i = 0; i < totalImages; i++) {
          const item = imagesToDownload[i];
          if (!item.file_name || !item.download_url) continue;

          const targetImgPath = `${imagesDir}${item.file_name}`;

          try {
            console.log(`📥 [PHOTO_RESTORE_${i + 1}/${totalImages}] Downloading ${item.file_name} from:`, item.download_url);
            const imgDownloadRes = await FileSystem.downloadAsync(
              item.download_url,
              targetImgPath,
              {
                headers: {
                  'ngrok-skip-browser-warning': 'true',
                  ...(auth.token ? { 'Authorization': `Bearer ${auth.token}` } : {}),
                },
              }
            );

            if (imgDownloadRes.status === 200) {
              downloadedPhotosCount++;
            } else {
              console.warn(`⚠️ [PHOTO_RESTORE_FAIL] Failed download for ${item.file_name}: HTTP ${imgDownloadRes.status}`);
            }
          } catch (imgErr) {
            console.error(`❌ [PHOTO_RESTORE_ERR] Error downloading photo ${item.file_name}:`, imgErr);
          }

          const currentPercent = 60 + Math.round(((i + 1) / (totalImages || 1)) * 30);
          onProgress?.({
            step: 2,
            totalSteps: 3,
            title: `Downloading Associated Photos (${i + 1}/${totalImages})...`,
            percent: Math.min(currentPercent, 90),
          });
        }
      } catch (imgDirErr) {
        console.error('⚠️ [RESTORE_STEP_4] Photos directory error:', imgDirErr);
      }
    }

    onProgress?.({ step: 3, totalSteps: 3, title: 'Restoring & Indexing Local Ledger...', percent: 95 });

    // 5. Re-open and Re-initialize SQLite Database
    console.log('🔄 [RESTORE_STEP_5] Re-opening and verifying SQLite database...');
    const db = initDatabase();

    // 6. Normalize local_uri Paths
    if (imagesDir) {
      try {
        const allImgs = db.getAllSync('SELECT id, file_name FROM transaction_images WHERE file_name IS NOT NULL;');
        console.log(`🖼️ [RESTORE_STEP_6] Normalizing ${allImgs?.length || 0} photo URI records in SQLite...`);
        if (allImgs && allImgs.length > 0) {
          for (const row of allImgs) {
            const correctUri = `${imagesDir}${row.file_name}`;
            db.runSync('UPDATE transaction_images SET local_uri = ?, upload_status = ? WHERE id = ?;', [
              correctUri,
              'uploaded',
              row.id,
            ]);
          }
        }
      } catch (normErr) {
        console.warn('⚠️ [RESTORE_STEP_6] Warning normalizing photo URIs:', normErr);
      }
    }

    onProgress?.({ step: 3, totalSteps: 3, title: 'Data Restoration Completed!', percent: 100 });

    const txCount = info.stats?.transactions || 0;
    const restoreMsg = `Restored ${txCount} transactions & ${downloadedPhotosCount} photos from server ✓`;
    console.log('\n========================================');
    console.log('🎉 [RESTORE_SUCCESS] Full restoration completed successfully!');
    console.log(`📊 Summary: ${txCount} transactions, ${downloadedPhotosCount} photos restored.`);
    console.log('========================================\n');

    addBackupActivityLog('cloud_restore', 'success', restoreMsg);

    return {
      success: true,
      message: 'Your complete data and photos have been restored successfully!',
      stats: info.stats,
      photosRestored: downloadedPhotosCount,
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
