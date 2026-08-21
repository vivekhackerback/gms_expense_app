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
  try {
    const net = await checkNetworkConnectivity();
    if (!net.isConnected) {
      addBackupActivityLog('db_backup_upload', 'failed', 'Full backup failed: Device is offline');
      return { success: false, message: 'Device is offline. Internet connection required to upload database.' };
    }

    const auth = getAuthSession();
    if (!auth.isLoggedIn) {
      return { success: false, message: 'Please log in to backup your database to the server.' };
    }

    const userPhone = auth?.user?.phone || '9876543210';
    const userId = auth?.user?.id || 1;

    onProgress?.({ step: 1, totalSteps: 2, title: 'Preparing Database...', percent: 20 });

    // 1. Commit SQLite WAL checkpoint to ensure all data is in expenses_khata.db file
    checkpointDatabase();

    const dbPath = await getDatabaseFilePath();
    if (!dbPath) {
      return { success: false, message: 'Cannot resolve SQLite database file path on this device.' };
    }

    let dbInfo = null;
    try {
      dbInfo = await FileSystem.getInfoAsync(dbPath);
    } catch (e) {
      console.warn('Error checking dbPath info:', e);
    }

    if (!dbInfo || !dbInfo.exists) {
      if (dbPath.startsWith('file://')) {
        try {
          const altPath = dbPath.replace('file://', '');
          const altInfo = await FileSystem.getInfoAsync(altPath);
          if (altInfo && altInfo.exists) {
            dbInfo = altInfo;
          }
        } catch (e) {}
      }
    }

    // Fallback: If still not found, ensure DB is initialized and checkpointed
    if (!dbInfo || !dbInfo.exists) {
      try {
        initDatabase();
        checkpointDatabase();
        dbInfo = await FileSystem.getInfoAsync(dbPath);
      } catch (e) {}
    }

    const fileSize = dbInfo?.size || 0;

    // Gather summary counts
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
    } catch (e) {
      console.warn('Could not read DB counts:', e);
    }

    onProgress?.({ step: 1, totalSteps: 2, title: 'Uploading SQLite Database File...', percent: 45 });

    // 2. Upload SQLite .db file
    const uploadResult = await FileSystem.uploadAsync(API_CONFIG.DATABASE_BACKUP_UPLOAD_URL, dbPath, {
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
      headers: {
        'Accept': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(auth.token ? { 'Authorization': `Bearer ${auth.token}` } : {}),
      },
    });

    if (uploadResult.status !== 200) {
      const errMsg = `Server returned HTTP ${uploadResult.status}`;
      addBackupActivityLog('db_backup_upload', 'failed', `Database upload failed (${errMsg})`);
      return { success: false, message: `Upload failed: ${errMsg}` };
    }

    let uploadJson = null;
    try {
      uploadJson = JSON.parse(uploadResult.body);
    } catch (e) {
      addBackupActivityLog('db_backup_upload', 'failed', 'Invalid JSON from backup server');
      return { success: false, message: 'Invalid response from backup server.' };
    }

    if (!uploadJson.success) {
      addBackupActivityLog('db_backup_upload', 'failed', uploadJson.message || 'Database upload rejected');
      return { success: false, message: uploadJson.message || 'Database upload rejected by server.' };
    }

    onProgress?.({ step: 2, totalSteps: 2, title: 'Uploading Associated Photos...', percent: 70 });

    // 3. Scan & upload all photos in transaction_photos directory
    let uploadedImagesCount = 0;
    const imagesDir = getImagesDir();
    if (imagesDir && Platform.OS !== 'web') {
      try {
        const dirInfo = await FileSystem.getInfoAsync(imagesDir);
        if (dirInfo.exists) {
          const files = await FileSystem.readDirectoryAsync(imagesDir);
          const totalFiles = files.length;

          for (let i = 0; i < totalFiles; i++) {
            const fileName = files[i];
            const fileUri = `${imagesDir}${fileName}`;
            
            try {
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

              const headers = {
                'Accept': 'application/json',
                'ngrok-skip-browser-warning': 'true',
                ...(auth.token ? { 'Authorization': `Bearer ${auth.token}` } : {}),
              };

              const imgRes = await fetch(API_CONFIG.IMAGE_UPLOAD_URL, {
                method: 'POST',
                headers,
                body: formData,
              });

              if (imgRes.ok) {
                uploadedImagesCount++;
              }
            } catch (err) {
              console.warn('Failed to upload photo:', fileName, err);
            }

            const currentPercent = 70 + Math.round(((i + 1) / (totalFiles || 1)) * 28);
            onProgress?.({
              step: 2,
              totalSteps: 2,
              title: `Uploading Associated Photos (${i + 1}/${totalFiles})...`,
              percent: Math.min(currentPercent, 98),
            });
          }
        }
      } catch (err) {
        console.warn('Error reading images directory for backup:', err);
      }
    }

    onProgress?.({ step: 2, totalSteps: 2, title: 'Backup Completed!', percent: 100 });

    const sizeKb = fileSize > 0 ? (fileSize / 1024).toFixed(1) : '0';
    const successMsg = `Full database (${sizeKb} KB, ${txCount} txs) and ${uploadedImagesCount} photos backed up to server ✓`;
    addBackupActivityLog('db_backup_upload', 'success', successMsg);

    return {
      success: true,
      message: 'Complete SQLite database and photos successfully uploaded to server.',
      stats: {
        transactions: txCount,
        parties: partyCount,
        categories: categoryCount,
        images: uploadedImagesCount,
        dbSize: fileSize,
      },
    };
  } catch (error) {
    const errText = error?.message || 'Unknown backup error';
    addBackupActivityLog('db_backup_upload', 'failed', `Backup error: ${errText}`);
    return { success: false, message: `Backup failed: ${errText}` };
  }
};

/**
 * Query the latest cloud backup metadata for the logged-in user
 */
export const fetchCloudBackupInfo = async () => {
  try {
    const net = await checkNetworkConnectivity();
    if (!net.isConnected) {
      return { success: false, message: 'Device is offline. Connect to internet to check cloud backup.' };
    }

    const auth = getAuthSession();
    if (!auth.isLoggedIn) {
      return { success: false, message: 'Please log in to check your cloud backup.' };
    }

    const userPhone = auth?.user?.phone || '9876543210';
    const url = `${API_CONFIG.DATABASE_BACKUP_INFO_URL}?phone=${encodeURIComponent(userPhone)}`;

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

    if (!response.ok) {
      return { success: false, message: `Server error HTTP ${response.status}` };
    }

    const json = await response.json();
    return json;
  } catch (error) {
    return { success: false, message: error?.message || 'Failed to reach backup server' };
  }
};

/**
 * Download complete SQLite database and all associated images from server and restore locally
 */
export const importCloudDataAndRestore = async (onProgress) => {
  try {
    const net = await checkNetworkConnectivity();
    if (!net.isConnected) {
      addBackupActivityLog('cloud_restore', 'failed', 'Restore failed: Device is offline');
      return { success: false, message: 'Device is offline. Internet connection required to restore data.' };
    }

    const auth = getAuthSession();
    if (!auth.isLoggedIn) {
      return { success: false, message: 'Please log in to restore your cloud backup.' };
    }

    const userPhone = auth?.user?.phone || '9876543210';

    onProgress?.({ step: 1, totalSteps: 3, title: 'Checking Cloud Backup...', percent: 10 });

    // 1. Fetch manifest & backup info
    const info = await fetchCloudBackupInfo();
    if (!info || !info.success || !info.has_backup) {
      addBackupActivityLog('cloud_restore', 'failed', 'Restore failed: No backup found on server');
      return {
        success: false,
        message: info?.message || 'No cloud database backup found for this account. Please upload a backup first.',
      };
    }

    onProgress?.({ step: 1, totalSteps: 3, title: 'Downloading SQLite Database...', percent: 30 });

    // 2. Close active SQLite connection cleanly so the database file can be replaced
    closeDatabase();

    // 3. Resolve target database path and ensure directory exists
    let targetDbPath = await getDatabaseFilePath();
    if (!targetDbPath) {
      targetDbPath = `${FileSystem.documentDirectory || ''}SQLite/expenses_khata.db`;
    }

    const lastSlash = targetDbPath.lastIndexOf('/');
    if (lastSlash > 0) {
      const parentDir = targetDbPath.substring(0, lastSlash + 1);
      try {
        const parentInfo = await FileSystem.getInfoAsync(parentDir);
        if (!parentInfo.exists) {
          await FileSystem.makeDirectoryAsync(parentDir, { intermediates: true });
        }
      } catch (e) {}
    }

    const targetDbWal = `${targetDbPath}-wal`;
    const targetDbShm = `${targetDbPath}-shm`;

    // Remove any leftover WAL / SHM files
    try {
      const walInfo = await FileSystem.getInfoAsync(targetDbWal);
      if (walInfo.exists) await FileSystem.deleteAsync(targetDbWal, { idempotent: true });
      const shmInfo = await FileSystem.getInfoAsync(targetDbShm);
      if (shmInfo.exists) await FileSystem.deleteAsync(targetDbShm, { idempotent: true });
    } catch (e) {}

    // Download the database file directly
    const downloadRes = await FileSystem.downloadAsync(
      info.db_download_url || `${API_CONFIG.DATABASE_BACKUP_DOWNLOAD_URL}?phone=${encodeURIComponent(userPhone)}`,
      targetDbPath,
      {
        headers: {
          'ngrok-skip-browser-warning': 'true',
          ...(auth.token ? { 'Authorization': `Bearer ${auth.token}` } : {}),
        },
      }
    );

    if (downloadRes.status !== 200) {
      // Try to re-init database if download fails
      initDatabase();
      addBackupActivityLog('cloud_restore', 'failed', `Database download failed (HTTP ${downloadRes.status})`);
      return { success: false, message: `Failed to download database file (HTTP ${downloadRes.status}).` };
    }

    onProgress?.({ step: 2, totalSteps: 3, title: 'Downloading Associated Photos...', percent: 60 });

    // 4. Ensure transaction photos directory exists
    let downloadedPhotosCount = 0;
    const imagesDir = getImagesDir();

    if (imagesDir && Platform.OS !== 'web') {
      const imgDirInfo = await FileSystem.getInfoAsync(imagesDir);
      if (!imgDirInfo.exists) {
        await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });
      }

      const imagesToDownload = info.images || [];
      const totalImages = imagesToDownload.length;

      for (let i = 0; i < totalImages; i++) {
        const item = imagesToDownload[i];
        if (!item.file_name || !item.download_url) continue;

        const targetImgPath = `${imagesDir}${item.file_name}`;

        try {
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
          }
        } catch (imgErr) {
          console.warn('Failed to download photo:', item.file_name, imgErr);
        }

        const currentPercent = 60 + Math.round(((i + 1) / (totalImages || 1)) * 30);
        onProgress?.({
          step: 2,
          totalSteps: 3,
          title: `Downloading Associated Photos (${i + 1}/${totalImages})...`,
          percent: Math.min(currentPercent, 90),
        });
      }
    }

    onProgress?.({ step: 3, totalSteps: 3, title: 'Restoring & Indexing Local Ledger...', percent: 95 });

    // 5. Re-open and re-initialize SQLite Database
    const db = initDatabase();

    // 6. Normalize local_uri paths in transaction_images to match the current device's IMAGES_DIR
    if (imagesDir) {
      try {
        const allImgs = db.getAllSync('SELECT id, file_name FROM transaction_images WHERE file_name IS NOT NULL;');
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
        console.warn('Error normalizing photo URIs:', normErr);
      }
    }

    onProgress?.({ step: 3, totalSteps: 3, title: 'Data Restoration Completed!', percent: 100 });

    const txCount = info.stats?.transactions || 0;
    const restoreMsg = `Restored ${txCount} transactions & ${downloadedPhotosCount} photos from server ✓`;
    addBackupActivityLog('cloud_restore', 'success', restoreMsg);

    return {
      success: true,
      message: 'Your complete data and photos have been restored successfully!',
      stats: info.stats,
      photosRestored: downloadedPhotosCount,
    };
  } catch (error) {
    console.error('Import error:', error);
    try {
      initDatabase();
    } catch (e) {}
    const errText = error?.message || 'Restore error';
    addBackupActivityLog('cloud_restore', 'failed', `Restore failed: ${errText}`);
    return { success: false, message: `Restore failed: ${errText}` };
  }
};
