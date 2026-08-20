import * as Network from 'expo-network';
import API_CONFIG from '../constants/api_config';
import {
  getSyncStats,
  getDetailedBackupReportStats,
  markSyncQueueComplete,
  markAllImagesUploaded,
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
    // Web or fallback
    return { isConnected: true, type: 'UNKNOWN', isWifi: false };
  }
};

/**
 * Synchronizes pending text data (transactions, parties, categories, etc.)
 */
export const syncTextData = async () => {
  const stats = getDetailedBackupReportStats();
  const pendingCount = stats.transactions.pending + stats.system.queuePending;

  if (pendingCount === 0) {
    return { success: true, count: 0, message: 'All text data is already synchronized.' };
  }

  const netInfo = await checkNetworkConnectivity();
  if (!netInfo.isConnected) {
    return { success: false, count: pendingCount, message: 'Offline. Pending text data will sync automatically once online.' };
  }

  try {
    // Simulated upload to backend API (deduplicated by UUID)
    await new Promise((resolve) => setTimeout(resolve, 800));
    markSyncQueueComplete();
    return {
      success: true,
      count: pendingCount,
      message: `Successfully synchronized ${pendingCount} text records.`,
    };
  } catch (error) {
    console.error('Text sync error:', error);
    return { success: false, count: pendingCount, message: 'Text data sync failed. Will retry automatically.' };
  }
};

export const processSyncQueue = async () => {
  return syncTextData();
};

/**
 * Uploads pending transaction images
 */
export const uploadPendingImages = async () => {
  const stats = getDetailedBackupReportStats();
  const pendingCount = stats.images.pending + stats.images.failed;

  if (pendingCount === 0) {
    return { success: true, count: 0, message: 'All images are already uploaded.' };
  }

  const netInfo = await checkNetworkConnectivity();
  if (!netInfo.isConnected) {
    return { success: false, count: pendingCount, message: 'Offline. Image upload will run when connected at scheduled time.' };
  }

  try {
    // Simulated multi-image batch upload to server image storage
    await new Promise((resolve) => setTimeout(resolve, 1200));
    markAllImagesUploaded();
    return {
      success: true,
      count: pendingCount,
      message: `Successfully uploaded ${pendingCount} images to server.`,
    };
  } catch (error) {
    console.error('Image upload error:', error);
    return { success: false, count: pendingCount, message: 'Image upload failed. Will retry at next scheduled interval.' };
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

    const scheduledTime = stats.images.scheduleTime || '02:00'; // e.g. "02:00"
    const [schedHours, schedMinutes] = scheduledTime.split(':').map(Number);

    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();

    // Check if within 30-minute window of the scheduled time
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

