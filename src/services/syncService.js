import * as Network from 'expo-network';
import API_CONFIG from '../constants/api_config';
import { toUnixTimestamp } from '../utils/formatters';
import {
  getSyncStats,
  getDetailedBackupReportStats,
  getPendingTransactions,
  getPendingImages,
  markTransactionsUploading,
  markTransactionsFailed,
  markTransactionsServerConfirmed,
  markImagesUploading,
  markImagesFailed,
  markImagesServerConfirmed,
  addBackupActivityLog,
  getBackupActivityLogs,
  getSetting,
  updateSetting,
  getAuthSession,
} from '../database/queries';

export const checkNetworkConnectivity = async () => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    return {
      isConnected: Boolean(networkState.isConnected && networkState.isInternetReachable !== false),
      type: networkState.type || 'UNKNOWN',
      isWifi: networkState.type === Network.NetworkStateType.WIFI,
    };
  } catch (error) {
    return { isConnected: true, type: 'UNKNOWN', isWifi: false };
  }
};

/**
 * Real API Endpoint Health Test (ZERO SIMULATION)
 * Tests actual connectivity, HTTP response, and JSON schema against the real PHP server.
 */
export const testAllApiEndpoints = async () => {
  const netInfo = await checkNetworkConnectivity();
  if (!netInfo.isConnected) {
    console.log('[ServerHealth] Device is offline. Cannot reach server.');
    addBackupActivityLog('health_check', 'failed', 'Server health check failed: Device is offline');
    return {
      serverConnected: false,
      overallStatus: 'Server Offline',
      endpoints: [
        { name: 'Server Health (health.php)', key: 'SERVER_HEALTH_URL', url: API_CONFIG.SERVER_HEALTH_URL, status: 'offline', message: 'Device is offline (Server Offline)' },
        { name: 'Transaction Sync (transactions_sync.php)', key: 'TRANSACTION_SYNC_URL', url: API_CONFIG.TRANSACTION_SYNC_URL, status: 'offline', message: 'Device is offline' },
        { name: 'Image Upload (image_upload.php)', key: 'IMAGE_UPLOAD_URL', url: API_CONFIG.IMAGE_UPLOAD_URL, status: 'offline', message: 'Device is offline' },
        { name: 'Backup Status (backup_status.php)', key: 'BACKUP_STATUS_URL', url: API_CONFIG.BACKUP_STATUS_URL, status: 'offline', message: 'Device is offline' },
      ],
    };
  }

  const endpointList = [
    { name: 'Server Health (health.php)', key: 'SERVER_HEALTH_URL', url: API_CONFIG.SERVER_HEALTH_URL, method: 'GET', isPrimaryHealth: true },
    { name: 'Transaction Sync (transactions_sync.php)', key: 'TRANSACTION_SYNC_URL', url: API_CONFIG.TRANSACTION_SYNC_URL, method: 'GET' },
    { name: 'Image Upload (image_upload.php)', key: 'IMAGE_UPLOAD_URL', url: API_CONFIG.IMAGE_UPLOAD_URL, method: 'GET' },
    { name: 'Backup Status (backup_status.php)', key: 'BACKUP_STATUS_URL', url: API_CONFIG.BACKUP_STATUS_URL, method: 'GET' },
    { name: 'Backup Manifest (backup_manifest.php)', key: 'DATABASE_BACKUP_INFO_URL', url: API_CONFIG.DATABASE_BACKUP_INFO_URL, method: 'GET' },
    { name: 'Database Download (download_database.php)', key: 'DATABASE_BACKUP_DOWNLOAD_URL', url: API_CONFIG.DATABASE_BACKUP_DOWNLOAD_URL, method: 'GET' },
  ];

  const results = [];
  let primaryHealthWorking = false;
  let primaryStatusMessage = 'Server Offline';

  for (const ep of endpointList) {
    const startTime = Date.now();

    console.log(`[ServerHealth] Requesting: ${ep.method} ${ep.url}`);

    if (!ep.url) {
      console.warn(`[ServerHealth] Missing URL for ${ep.name}`);
      results.push({ ...ep, status: 'failed', latencyMs: 0, message: 'URL not configured' });
      continue;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(ep.url, {
        method: ep.method,
        headers: API_CONFIG.HEADERS,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;
      const statusCode = response.status;
      const rawText = await response.text();

      console.log(`[ServerHealth] ${ep.name} -> HTTP Status: ${statusCode}, Body Preview: ${rawText.substring(0, 150)}`);

      if (statusCode === 200) {
        let json = null;
        try {
          json = JSON.parse(rawText);
        } catch (parseErr) {
          console.warn(`[ServerHealth] JSON Parse Error for ${ep.url}:`, parseErr.message);
          results.push({
            ...ep,
            status: 'failed',
            statusCode: 200,
            latencyMs: latency,
            message: 'Invalid API Response (Non-JSON)',
          });
          if (ep.isPrimaryHealth) {
            primaryStatusMessage = 'Invalid API Response';
          }
          continue;
        }

        // Validate JSON fields
        const isSuccess = json.success === true;
        const isHealthy = json.status === 'healthy' || json.server === 'online' || isSuccess;
        const isMysqlConnected = json.mysql_connected !== false;

        if (isSuccess && isHealthy && isMysqlConnected) {
          results.push({
            ...ep,
            status: 'working',
            statusCode: 200,
            latencyMs: latency,
            message: `Server Online (PHP ${json.php_version || '8.x'} · MySQL ✓ · ${latency}ms)`,
            details: json,
          });
          if (ep.isPrimaryHealth) {
            primaryHealthWorking = true;
            primaryStatusMessage = 'Server Online';
          }
        } else if (isSuccess && !isMysqlConnected) {
          results.push({
            ...ep,
            status: 'failed',
            statusCode: 200,
            latencyMs: latency,
            message: 'MySQL Disconnected (Database Error)',
            details: json,
          });
          if (ep.isPrimaryHealth) {
            primaryStatusMessage = 'MySQL Disconnected';
          }
        } else {
          results.push({
            ...ep,
            status: 'failed',
            statusCode: 200,
            latencyMs: latency,
            message: json.message || 'Health Check Failed',
            details: json,
          });
          if (ep.isPrimaryHealth) {
            primaryStatusMessage = 'Health Check Failed';
          }
        }
      } else if (statusCode === 404) {
        results.push({
          ...ep,
          status: 'failed',
          statusCode: 404,
          latencyMs: latency,
          message: 'Health API Not Found (HTTP 404)',
        });
        if (ep.isPrimaryHealth) {
          primaryStatusMessage = 'Health API Not Found';
        }
      } else if (statusCode === 500) {
        results.push({
          ...ep,
          status: 'failed',
          statusCode: 500,
          latencyMs: latency,
          message: 'Health API Server Error (HTTP 500)',
        });
        if (ep.isPrimaryHealth) {
          primaryStatusMessage = 'Health API Server Error';
        }
      } else {
        results.push({
          ...ep,
          status: 'failed',
          statusCode: statusCode,
          latencyMs: latency,
          message: `HTTP ${statusCode} Error`,
        });
        if (ep.isPrimaryHealth) {
          primaryStatusMessage = `HTTP ${statusCode} Error`;
        }
      }
    } catch (networkError) {
      clearTimeout(timeoutId);
      const isTimeout = networkError.name === 'AbortError';
      const errorMsg = isTimeout ? 'Connection Timeout (8s)' : 'Server Offline (DNS / Network Failed)';
      console.warn(`[ServerHealth] Network error on ${ep.url}:`, networkError.message);

      results.push({
        ...ep,
        status: 'failed',
        statusCode: 0,
        latencyMs: 0,
        message: errorMsg,
      });
      if (ep.isPrimaryHealth) {
        primaryStatusMessage = isTimeout ? 'Connection Timeout' : 'Server Offline';
      }
    }
  }

  addBackupActivityLog(
    'health_check',
    primaryHealthWorking ? 'success' : 'failed',
    primaryHealthWorking ? `Server verified: ${primaryStatusMessage} ✓` : `Health check failed: ${primaryStatusMessage}`
  );

  return {
    serverConnected: primaryHealthWorking,
    overallStatus: primaryStatusMessage,
    endpoints: results,
  };
};

/**
 * Real SQLite Transaction Upload to PHP (ZERO SIMULATION)
 * Reads pending records from SQLite, sends POST to `transactions_sync.php`,
 * and updates SQLite to UPLOADED ONLY after verified PHP MySQL confirmation.
 */
export const syncTextData = async () => {
  const pendingList = getPendingTransactions(50);
  const pendingCount = pendingList.length;

  if (pendingCount === 0) {
    return { success: true, count: 0, message: 'All text data is already synchronized with server.' };
  }

  const netInfo = await checkNetworkConnectivity();
  if (!netInfo.isConnected) {
    addBackupActivityLog('text_sync', 'pending', `${pendingCount} records waiting for server connection`);
    return { success: false, count: pendingCount, message: 'Offline. Pending text data will sync automatically once online.' };
  }

  const pendingUuids = pendingList.map(t => t.uuid);

  // 1. Mark state as UPLOADING
  markTransactionsUploading(pendingUuids);

  const payload = {
    device_uuid: 'device_' + (pendingList[0]?.id || 'mobile'),
    records: pendingList.map(t => ({
      uuid: t.uuid,
      party_id: t.party_id,
      party_name: t.party_name,
      category_id: t.category_id,
      category_name: t.category_name,
      type: t.type,
      payment_mode: t.payment_mode,
      amount: t.amount,
      note: t.note,
      transaction_date: toUnixTimestamp(t.transaction_date),
      created_at: toUnixTimestamp(t.created_at),
      updated_at: toUnixTimestamp(t.updated_at),
    })),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(API_CONFIG.TRANSACTION_SYNC_URL, {
      method: 'POST',
      headers: API_CONFIG.HEADERS,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      markTransactionsFailed(pendingUuids);
      const errText = `HTTP ${response.status} Error`;
      addBackupActivityLog('text_sync', 'failed', `Sync failed (${errText})`);
      return { success: false, count: pendingCount, message: `Server error: ${errText}` };
    }

    const data = await response.json();

    // 2. ONLY mark UPLOADED if PHP confirms saved: true
    if (data.success === true && data.saved === true) {
      markTransactionsServerConfirmed(data.synced_records || []);
      addBackupActivityLog('text_sync', 'success', `${data.count || pendingCount} transactions synchronized ✓`);
      return {
        success: true,
        count: data.count || pendingCount,
        message: `Successfully uploaded ${data.count || pendingCount} records to server.`,
      };
    } else {
      markTransactionsFailed(pendingUuids);
      const failMsg = data.message || 'Server rejected transaction save';
      addBackupActivityLog('text_sync', 'failed', failMsg);
      return { success: false, count: pendingCount, message: failMsg };
    }
  } catch (error) {
    clearTimeout(timeoutId);
    markTransactionsFailed(pendingUuids);
    const errDetail = error.name === 'AbortError' ? 'Timeout' : (error.message || 'Network error');
    addBackupActivityLog('text_sync', 'failed', `Sync failed: ${errDetail}`);
    return { success: false, count: pendingCount, message: `Connection failed: ${errDetail}` };
  }
};

export const processSyncQueue = async () => {
  return syncTextData();
};

import { resolveLocalImageUri, getImageMimeType } from './imageService';

let isImageUploadInProgress = false;

/**
 * Receipt Image Upload
 * Fetches pending transaction images from SQLite, constructs multipart/form-data payloads,
 * sends them to IMAGE_UPLOAD_URL, and updates SQLite status upon server confirmation.
 */
export const uploadPendingImages = async (customBatchLimit = 20) => {
  if (isImageUploadInProgress) {
    console.log('[ImageSync] Image upload already in progress, skipping duplicate request.');
    return { success: true, count: 0, message: 'Image upload already in progress.' };
  }

  const netInfo = await checkNetworkConnectivity();
  if (!netInfo.isConnected) {
    const offlineMsg = 'Device is offline. Pending receipt images will upload automatically once connected.';
    addBackupActivityLog('image_upload', 'pending', offlineMsg);
    return { success: false, count: 0, message: offlineMsg, offline: true };
  }

  const auth = getAuthSession();
  if (!auth.isLoggedIn) {
    return {
      success: false,
      count: 0,
      requiresLogin: true,
      message: 'Please sign in to upload receipt images to cloud.',
    };
  }

  const userPhone = auth?.user?.phone || '9876543210';
  const userId = auth?.user?.id || 1;

  const pendingList = getPendingImages(customBatchLimit);
  const pendingCount = pendingList.length;

  if (pendingCount === 0) {
    return {
      success: true,
      count: 0,
      failedCount: 0,
      message: 'All receipt photos are synchronized with server.',
    };
  }

  isImageUploadInProgress = true;
  const pendingIds = pendingList.map(img => img.id).filter(Boolean);
  markImagesUploading(pendingIds);

  let successCount = 0;
  let failedCount = 0;
  const failedIds = [];
  const confirmedImages = [];

  console.log(`[ImageSync] Starting upload of ${pendingCount} pending receipt images...`);

  try {
    for (const img of pendingList) {
      try {
        // 1. Resolve local file path on device
        const resolvedUri = await resolveLocalImageUri(img.local_uri, img.file_name);
        if (!resolvedUri) {
          console.warn(`[ImageSync] File not found on device for image ID ${img.id}:`, img.local_uri);
          failedCount++;
          failedIds.push(img.id);
          addBackupActivityLog('image_upload', 'failed', `File not found on device: ${img.file_name || 'receipt'}`);
          continue;
        }

        // 2. Prepare FormData payload
        const fileName = img.file_name || resolvedUri.split('/').pop() || `receipt_${Date.now()}.jpg`;
        const mimeType = getImageMimeType(resolvedUri, fileName);

        const formData = new FormData();
        formData.append('file', {
          uri: resolvedUri,
          name: fileName,
          type: mimeType,
        });

        const txUuid = img.transaction_uuid || `TXN_${img.transaction_id || Date.now()}`;
        formData.append('transaction_uuid', txUuid);
        if (img.transaction_id) {
          formData.append('transaction_id', String(img.transaction_id));
        }
        formData.append('phone', String(userPhone));
        formData.append('user_id', String(userId));
        formData.append('file_name', fileName);

        // 3. Send upload request to PHP backend
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout per photo

        const response = await fetch(API_CONFIG.IMAGE_UPLOAD_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'ngrok-skip-browser-warning': 'true',
            ...(auth.token ? { 'Authorization': `Bearer ${auth.token}` } : {}),
          },
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        const rawText = await response.text();
        if (!response.ok) {
          console.error(`[ImageSync] Upload HTTP ${response.status} for ${fileName}:`, rawText);
          failedCount++;
          failedIds.push(img.id);
          addBackupActivityLog('image_upload', 'failed', `Upload failed (HTTP ${response.status}): ${fileName}`);
          continue;
        }

        let json = null;
        try {
          json = JSON.parse(rawText);
        } catch (pe) {
          console.error(`[ImageSync] Invalid JSON response for ${fileName}:`, rawText);
          failedCount++;
          failedIds.push(img.id);
          addBackupActivityLog('image_upload', 'failed', `Invalid server response for ${fileName}`);
          continue;
        }

        if (json.success === true && json.saved === true) {
          successCount++;
          confirmedImages.push({
            id: img.id,
            transaction_uuid: txUuid,
            file_name: json.file_name || fileName,
            server_url: json.storage_url || json.storage_path,
            server_id: json.server_id,
          });
          console.log(`[ImageSync] Uploaded receipt image: ${fileName} -> ${json.storage_url || json.file_name}`);
        } else {
          failedCount++;
          failedIds.push(img.id);
          const failMsg = json.message || 'Server rejected image upload';
          console.warn(`[ImageSync] Server rejected ${fileName}:`, failMsg);
          addBackupActivityLog('image_upload', 'failed', `${fileName}: ${failMsg}`);
        }
      } catch (err) {
        failedCount++;
        failedIds.push(img.id);
        const errMsg = err.name === 'AbortError' ? 'Upload timeout (25s)' : (err.message || 'Network error');
        console.warn(`[ImageSync] Exception uploading image ID ${img.id}:`, errMsg);
        addBackupActivityLog('image_upload', 'failed', `Error uploading ${img.file_name || 'receipt'}: ${errMsg}`);
      }
    }

    // 4. Update SQLite database statuses
    if (confirmedImages.length > 0) {
      markImagesServerConfirmed(confirmedImages);
      addBackupActivityLog(
        'image_upload',
        'success',
        `Successfully uploaded ${successCount} receipt photo${successCount > 1 ? 's' : ''} to cloud ✓`
      );
    }

    if (failedIds.length > 0) {
      markImagesFailed(failedIds);
    }

    const message = failedCount > 0
      ? `Uploaded ${successCount} image${successCount > 1 ? 's' : ''}, ${failedCount} failed.`
      : `Successfully uploaded ${successCount} receipt photo${successCount > 1 ? 's' : ''} to server.`;

    return {
      success: failedCount === 0 && successCount > 0,
      count: successCount,
      failedCount,
      message,
    };
  } finally {
    isImageUploadInProgress = false;
  }
};

/**
 * Checks if the scheduled image backup time is due and triggers background image sync
 */
export const checkScheduledImageBackup = async () => {
  try {
    const stats = getDetailedBackupReportStats();
    if (!stats.images.scheduleEnabled) {
      return { skipped: true, reason: 'schedule_disabled' };
    }

    const netInfo = await checkNetworkConnectivity();
    if (!netInfo.isConnected) {
      return { skipped: true, reason: 'device_offline' };
    }

    const auth = getAuthSession();
    if (!auth.isLoggedIn) {
      return { skipped: true, reason: 'not_logged_in' };
    }

    // Check if there are any pending or failed images
    if (stats.images.pending === 0 && stats.images.failed === 0) {
      return { skipped: true, reason: 'no_pending_images' };
    }

    const schedTime = stats.images.scheduleTime || '02:00';
    const [schedH, schedM] = schedTime.split(':').map(n => parseInt(n, 10) || 0);

    const now = new Date();
    const currentH = now.getHours();
    const currentM = now.getMinutes();

    const schedMinutes = schedH * 60 + schedM;
    const currentMinutes = currentH * 60 + currentM;
    const diff = Math.abs(currentMinutes - schedMinutes);

    const lastSyncSec = parseInt(stats.images.lastSync || '0', 10);
    const nowSec = Math.floor(Date.now() / 1000);
    const isDue = (nowSec - lastSyncSec) >= 86400 || (diff <= 30 && (nowSec - lastSyncSec) > 3600);

    if (!isDue) {
      return { skipped: true, reason: 'not_due_yet' };
    }

    console.log(`⏰ [IMAGE_SCHEDULE] Running scheduled image backup at ${schedTime}...`);
    const res = await uploadPendingImages(50);
    return { executed: true, result: res };
  } catch (e) {
    console.warn('Scheduled image backup check error:', e);
    return { skipped: true, error: e };
  }
};

/**
 * Automatically syncs text data in background when connected to internet
 */
export const autoSyncTextIfConnected = async () => {
  try {
    const autoSync = getSetting('auto_sync_enabled', '1') !== '0';
    if (!autoSync) return { skipped: true };

    const netInfo = await checkNetworkConnectivity();
    if (!netInfo.isConnected) return { skipped: true, reason: 'offline' };

    const stats = getDetailedBackupReportStats();
    if (stats.transactions.pending > 0 || stats.system.queuePending > 0) {
      return await syncTextData();
    }
    return { skipped: true, reason: 'no_pending' };
  } catch (e) {
    return { skipped: true, error: e };
  }
};
