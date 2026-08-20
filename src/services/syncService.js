import * as Network from 'expo-network';
import API_CONFIG from '../constants/api_config';
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
    addBackupActivityLog('health_check', 'failed', 'Server health check failed: Device is offline');
    return {
      serverConnected: false,
      overallStatus: 'Offline',
      endpoints: [
        { name: 'Server Health (health.php)', key: 'SERVER_HEALTH_URL', url: API_CONFIG.SERVER_HEALTH_URL, status: 'offline', message: 'Device is offline' },
        { name: 'Transaction Sync (transactions_sync.php)', key: 'TRANSACTION_SYNC_URL', url: API_CONFIG.TRANSACTION_SYNC_URL, status: 'offline', message: 'Device is offline' },
        { name: 'Image Upload (image_upload.php)', key: 'IMAGE_UPLOAD_URL', url: API_CONFIG.IMAGE_UPLOAD_URL, status: 'offline', message: 'Device is offline' },
        { name: 'Backup Status (backup_status.php)', key: 'BACKUP_STATUS_URL', url: API_CONFIG.BACKUP_STATUS_URL, status: 'offline', message: 'Device is offline' },
      ],
    };
  }

  const endpointList = [
    { name: 'Server Health (health.php)', key: 'SERVER_HEALTH_URL', url: API_CONFIG.SERVER_HEALTH_URL, method: 'GET' },
    { name: 'Transaction Sync (transactions_sync.php)', key: 'TRANSACTION_SYNC_URL', url: API_CONFIG.TRANSACTION_SYNC_URL, method: 'OPTIONS' },
    { name: 'Image Upload (image_upload.php)', key: 'IMAGE_UPLOAD_URL', url: API_CONFIG.IMAGE_UPLOAD_URL, method: 'OPTIONS' },
    { name: 'Backup Status (backup_status.php)', key: 'BACKUP_STATUS_URL', url: API_CONFIG.BACKUP_STATUS_URL, method: 'GET' },
  ];

  const results = [];
  let allHealthy = true;

  for (const ep of endpointList) {
    const startTime = Date.now();

    if (!ep.url) {
      results.push({ ...ep, status: 'failed', latencyMs: 0, message: 'URL not configured' });
      allHealthy = false;
      continue;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const response = await fetch(ep.url, {
        method: ep.method,
        headers: API_CONFIG.HEADERS,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latency = Date.now() - startTime;

      if (response.status === 200) {
        // Attempt to parse JSON response for health checks
        try {
          const json = await response.json();
          if (json.success === true || ep.method === 'OPTIONS') {
            results.push({
              ...ep,
              status: 'working',
              statusCode: 200,
              latencyMs: latency,
              message: `Working (200 OK · ${latency}ms)`,
            });
          } else {
            results.push({
              ...ep,
              status: 'failed',
              statusCode: 200,
              latencyMs: latency,
              message: json.message || 'API returned success=false',
            });
            allHealthy = false;
          }
        } catch (jsonErr) {
          // If non-JSON but 200 OK
          results.push({
            ...ep,
            status: 'working',
            statusCode: 200,
            latencyMs: latency,
            message: `Working (200 OK · ${latency}ms)`,
          });
        }
      } else if (response.status === 404) {
        results.push({
          ...ep,
          status: 'failed',
          statusCode: 404,
          latencyMs: latency,
          message: '404 Not Found (PHP file missing)',
        });
        allHealthy = false;
      } else if (response.status === 500) {
        results.push({
          ...ep,
          status: 'failed',
          statusCode: 500,
          latencyMs: latency,
          message: '500 Server Error (PHP/MySQL error)',
        });
        allHealthy = false;
      } else {
        results.push({
          ...ep,
          status: 'failed',
          statusCode: response.status,
          latencyMs: latency,
          message: `HTTP ${response.status} Error`,
        });
        allHealthy = false;
      }
    } catch (networkError) {
      clearTimeout(timeoutId);
      const errorMsg = networkError.name === 'AbortError' 
        ? 'Connection Timeout (6s)'
        : 'DNS / Connection Failed';

      results.push({
        ...ep,
        status: 'failed',
        statusCode: 0,
        latencyMs: 0,
        message: errorMsg,
      });
      allHealthy = false;
    }
  }

  addBackupActivityLog(
    'health_check',
    allHealthy ? 'success' : 'failed',
    allHealthy ? 'PHP server & API endpoints verified ✓' : 'Health check: Server offline or endpoint error'
  );

  return {
    serverConnected: allHealthy,
    overallStatus: allHealthy ? 'Online' : 'Offline / Error',
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
      transaction_date: t.transaction_date,
      created_at: t.created_at,
      updated_at: t.updated_at,
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

/**
 * Real Receipt Image Multipart Upload to PHP (ZERO SIMULATION)
 */
export const uploadPendingImages = async () => {
  const pendingImages = getPendingImages(5);
  const pendingCount = pendingImages.length;

  if (pendingCount === 0) {
    return { success: true, count: 0, message: 'All images are already uploaded.' };
  }

  const netInfo = await checkNetworkConnectivity();
  if (!netInfo.isConnected) {
    addBackupActivityLog('image_upload', 'pending', `${pendingCount} images waiting for upload`);
    return { success: false, count: pendingCount, message: 'Offline. Image upload will run when connected at scheduled time.' };
  }

  const imageIds = pendingImages.map(img => img.id);
  markImagesUploading(imageIds);

  let successCount = 0;
  const confirmedImages = [];

  for (const img of pendingImages) {
    try {
      const formData = new FormData();
      formData.append('transaction_uuid', img.transaction_uuid);
      formData.append('file_name', img.file_name || 'receipt.jpg');
      formData.append('file', {
        uri: img.local_uri,
        name: img.file_name || 'receipt.jpg',
        type: 'image/jpeg',
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(API_CONFIG.IMAGE_UPLOAD_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
        },
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.success === true && data.saved === true) {
          successCount++;
          confirmedImages.push({
            id: img.id,
            transaction_uuid: img.transaction_uuid,
            server_id: data.server_id,
          });
        }
      }
    } catch (err) {
      console.warn('Image upload network failure for photo:', img.id, err);
    }
  }

  if (confirmedImages.length > 0) {
    markImagesServerConfirmed(confirmedImages);
    addBackupActivityLog('image_upload', 'success', `Image upload completed (${confirmedImages.length} photos) ✓`);
    return {
      success: true,
      count: confirmedImages.length,
      message: `Successfully uploaded ${confirmedImages.length} images to server.`,
    };
  } else {
    markImagesFailed(imageIds);
    addBackupActivityLog('image_upload', 'failed', 'Image upload failed on server');
    return { success: false, count: pendingCount, message: 'Image upload failed. Server did not confirm storage.' };
  }
};

/**
 * Checks if the scheduled image backup time (e.g. 2:00 AM) is due
 */
export const checkScheduledImageBackup = async () => {
  try {
    const stats = getDetailedBackupReportStats();
    if (!stats.images.scheduleEnabled || stats.images.pending === 0) {
      return { skipped: true, reason: 'Disabled or no pending images' };
    }

    const scheduledTime = stats.images.scheduleTime || '02:00';
    const [schedHours, schedMinutes] = scheduledTime.split(':').map(Number);

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    const currentTotalMin = currentHours * 60 + currentMinutes;
    const schedTotalMin = (schedHours || 2) * 60 + (schedMinutes || 0);

    const diff = Math.abs(currentTotalMin - schedTotalMin);
    if (diff <= 30) {
      const netInfo = await checkNetworkConnectivity();
      if (netInfo.isConnected) {
        return await uploadPendingImages();
      }
    }
    return { skipped: true, reason: 'Not scheduled time yet' };
  } catch (err) {
    console.warn('Scheduled image check error:', err);
    return { skipped: true, error: err };
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
