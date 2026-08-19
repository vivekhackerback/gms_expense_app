import * as Network from 'expo-network';
import { getSyncStats, markSyncQueueComplete } from '../database/queries';

export const checkNetworkConnectivity = async () => {
  try {
    const networkState = await Network.getNetworkStateAsync();
    return {
      isConnected: Boolean(networkState.isConnected && networkState.isInternetReachable !== false),
      type: networkState.type,
    };
  } catch (error) {
    // Web or fallback
    return { isConnected: true, type: 'UNKNOWN' };
  }
};

// Simulate sync with future backend endpoint
export const processSyncQueue = async () => {
  const stats = getSyncStats();
  if (stats.pendingCount === 0) {
    return { success: true, count: 0, message: 'All data already synced' };
  }

  const netInfo = await checkNetworkConnectivity();
  if (!netInfo.isConnected) {
    return { success: false, count: stats.pendingCount, message: 'No internet connection' };
  }

  try {
    // In future this will send items to PHP backend / API
    // For now we simulate smooth sync completion
    await new Promise((resolve) => setTimeout(resolve, 800));
    markSyncQueueComplete();
    return { success: true, count: stats.pendingCount, message: `Successfully synced ${stats.pendingCount} items` };
  } catch (error) {
    return { success: false, count: stats.pendingCount, message: 'Sync failed, will retry later' };
  }
};
