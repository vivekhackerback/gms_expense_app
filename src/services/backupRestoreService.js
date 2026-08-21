import { File, Directory, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
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
  if (Platform.OS === 'web') return null;
  try {
    return new Directory(Paths.document, 'transaction_photos');
  } catch (e) {
    return null;
  }
};

const getImagesDirUri = () => {
  const dir = getImagesDir();
  return dir ? `${dir.uri.replace(/\/*$/, '')}/` : null;
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

    let dbFile = new File(dbPath);
    // If not found with uri, try raw path or retry checkpoint
    if (!dbFile.exists && dbPath.startsWith('file://')) {
      const altFile = new File(dbPath.replace('file://', ''));
      if (altFile.exists) {
        dbFile = altFile;
      }
    }

    // Fallback: If still not found, ensure DB is initialized and checkpointed
    if (!dbFile.exists) {
      try {
        initDatabase();
        checkpointDatabase();
        dbFile = new File(dbPath);
      } catch (e) {}
    }

    const fileSize = dbFile.exists ? (dbFile.size || 0) : 0;

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
    const uploadResult = await LegacyFileSystem.uploadAsync(API_CONFIG.DATABASE_BACKUP_UPLOAD_URL, dbPath, {
      httpMethod: 'POST',
      uploadType: LegacyFileSystem.FileSystemUploadType.MULTIPART,
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
    const imgDir = getImagesDir();
    if (imgDir && Platform.OS !== 'web' && imgDir.exists) {
      try {
        const entries = imgDir.list();
        const files = entries.filter((e) => e instanceof File || !e.isDirectory);
        const totalFiles = files.length;

        for (let i = 0; i < totalFiles; i++) {
          const item = files[i];
          const fileName = item.name;
          const fileUri = item.uri;
          
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
      const docUri = Paths.document?.uri || '';
      targetDbPath = `${docUri.replace(/\/*$/, '')}/SQLite/expenses_khata.db`;
    }

    const targetDbFile = new File(targetDbPath);
    if (!targetDbFile.parentDirectory.exists) {
      try {
        targetDbFile.parentDirectory.create();
      } catch (e) {}
    }

    const targetDbWal = new File(`${targetDbPath}-wal`);
    const targetDbShm = new File(`${targetDbPath}-shm`);

    // Remove any leftover WAL / SHM files
    try {
      if (targetDbWal.exists) targetDbWal.delete();
      if (targetDbShm.exists) targetDbShm.delete();
    } catch (e) {}

    // Download the database file directly
    const downloadRes = await LegacyFileSystem.downloadAsync(
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
    const imagesDirUri = getImagesDirUri();

    if (imagesDir && Platform.OS !== 'web') {
      if (!imagesDir.exists) {
        try {
          imagesDir.create();
        } catch (e) {}
      }

      const imagesToDownload = info.images || [];
      const totalImages = imagesToDownload.length;

      for (let i = 0; i < totalImages; i++) {
        const item = imagesToDownload[i];
        if (!item.file_name || !item.download_url) continue;

        const targetImgFile = new File(imagesDir, item.file_name);

        try {
          const imgDownloadRes = await LegacyFileSystem.downloadAsync(
            item.download_url,
            targetImgFile.uri,
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
    if (imagesDirUri) {
      try {
        const allImgs = db.getAllSync('SELECT id, file_name FROM transaction_images WHERE file_name IS NOT NULL;');
        if (allImgs && allImgs.length > 0) {
          for (const row of allImgs) {
            const correctUri = `${imagesDirUri}${row.file_name}`;
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
