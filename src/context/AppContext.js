import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { initDatabase } from '../database/db';
import {
  getBalances,
  getTransactions,
  getParties,
  getCategories,
  getSyncStats,
  getDetailedBackupReportStats,
  getBackupActivityLogs,
  updateSetting,
  eraseLocalDeviceDataOnly,
  addTransaction as dbAddTransaction,
  updateTransaction as dbUpdateTransaction,
  deleteTransaction as dbDeleteTransaction,
  addParty as dbAddParty,
  updateParty as dbUpdateParty,
  deleteParty as dbDeleteParty,
  addCategory as dbAddCategory,
  updateCategory as dbUpdateCategory,
  deleteCategory as dbDeleteCategory,
} from '../database/queries';
import {
  checkNetworkConnectivity,
  syncTextData,
  uploadPendingImages,
  checkScheduledImageBackup,
  autoSyncTextIfConnected,
} from '../services/syncService';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState('Home'); // Home, Transactions, Khata, Reports, More, Backup
  const [previousTab, setPreviousTab] = useState('More');
  
  // App Data State
  const [balances, setBalances] = useState({
    cashGot: 0,
    cashGave: 0,
    cashBalance: 0,
    onlineGot: 0,
    onlineGave: 0,
    onlineBalance: 0,
    totalGot: 0,
    totalGave: 0,
    totalBalance: 0,
    todayGot: 0,
    todayGave: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [parties, setParties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [syncStats, setSyncStats] = useState({ pendingCount: 0, totalTransactions: 0, lastSync: null });
  const [detailedBackupStats, setDetailedBackupStats] = useState({
    transactions: { total: 0, synced: 0, uploaded: 0, pending: 0, uploading: 0, failed: 0, lastSync: null, lastFailedSync: null },
    images: { total: 0, uploaded: 0, pending: 0, uploading: 0, failed: 0, lastSync: null, scheduleTime: '02:00', scheduleEnabled: true },
    system: { autoSyncEnabled: true, queuePending: 0 },
  });
  const [backupActivityLogs, setBackupActivityLogs] = useState([]);
  const [networkStatus, setNetworkStatus] = useState({ isConnected: true, type: 'UNKNOWN', isWifi: false });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isImageSyncing, setIsImageSyncing] = useState(false);

  // Modal / Navigation Overlay States
  const [isAddTransactionOpen, setIsAddTransactionOpen] = useState(false);
  const [addTransactionDefaults, setAddTransactionDefaults] = useState({
    type: 'gave',
    paymentMode: 'cash',
    partyId: null,
  });
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [viewingTransactionId, setViewingTransactionId] = useState(null);
  const [activePartyId, setActivePartyId] = useState(null);
  const [fullScreenImageUri, setFullScreenImageUri] = useState(null);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [isManagePartiesOpen, setIsManagePartiesOpen] = useState(false);
  const [isBackupReportOpen, setIsBackupReportOpen] = useState(false);

  const autoSyncRunningRef = useRef(false);

  // Refresh all local data instantly
  const refreshAll = useCallback(() => {
    try {
      const newBalances = getBalances();
      setBalances(newBalances);

      const recent = getTransactions({ limit: 25 });
      setRecentTransactions(recent);

      const allParties = getParties();
      setParties(allParties);

      const allCategories = getCategories();
      setCategories(allCategories);

      const stats = getSyncStats();
      setSyncStats(stats);

      const detailed = getDetailedBackupReportStats();
      setDetailedBackupStats(detailed);

      const logs = getBackupActivityLogs(20);
      setBackupActivityLogs(logs);
    } catch (err) {
      console.error('Error refreshing state:', err);
    }
  }, []);

  // Background Auto-Sync Daemon
  const runBackgroundChecks = useCallback(async () => {
    if (autoSyncRunningRef.current) return;
    autoSyncRunningRef.current = true;

    try {
      const net = await checkNetworkConnectivity();
      setNetworkStatus(net);

      if (net.isConnected) {
        // 1. Auto-sync pending text data
        const textRes = await autoSyncTextIfConnected();
        if (textRes && textRes.success && textRes.count > 0) {
          refreshAll();
        }

        // 2. Check scheduled image backup
        const imgRes = await checkScheduledImageBackup();
        if (imgRes && imgRes.success && imgRes.count > 0) {
          refreshAll();
        }
      }
    } catch (err) {
      console.warn('Background sync check error:', err);
    } finally {
      autoSyncRunningRef.current = false;
    }
  }, [refreshAll]);

  // Initialize DB and initial state on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        initDatabase();
        refreshAll();
        const net = await checkNetworkConnectivity();
        setNetworkStatus(net);
        setIsInitialized(true);

        // Run initial sync check
        runBackgroundChecks();
      } catch (e) {
        console.error('Initialization error:', e);
        setIsInitialized(true);
      }
    };
    initialize();

    // Set up periodic sync daemon check every 25 seconds
    const interval = setInterval(() => {
      runBackgroundChecks();
    }, 25000);

    return () => clearInterval(interval);
  }, [refreshAll, runBackgroundChecks]);

  // Modal Actions
  const openAddTransaction = (options = {}) => {
    setEditingTransaction(null);
    const initialType = options.type || options.defaultType || 'got';
    const initialMode = options.paymentMode || options.defaultMode || 'cash';
    const initialPartyId = options.partyId !== undefined ? options.partyId : (options.defaultPartyId || null);

    setAddTransactionDefaults({
      type: initialType,
      paymentMode: initialMode,
      partyId: initialPartyId,
    });
    setIsAddTransactionOpen(true);
  };

  const openEditTransaction = (tx) => {
    setEditingTransaction(tx);
    setIsAddTransactionOpen(true);
  };

  const closeAddTransaction = () => {
    setIsAddTransactionOpen(false);
    setEditingTransaction(null);
  };

  const openTransactionDetails = (id) => {
    setViewingTransactionId(id);
  };

  const closeTransactionDetails = () => {
    setViewingTransactionId(null);
  };

  const openPartyDetails = (partyId) => {
    setActivePartyId(partyId);
  };

  const closePartyDetails = () => {
    setActivePartyId(null);
  };

  const openFullScreenImage = (uri) => {
    setFullScreenImageUri(uri);
  };

  const closeFullScreenImage = () => {
    setFullScreenImageUri(null);
  };

  const navigateToBackup = (fromTab = null) => {
    refreshAll();
    setPreviousTab(fromTab || activeTab || 'More');
    setActiveTab('Backup');
  };

  const openBackupReport = (fromTab = null) => {
    navigateToBackup(fromTab);
  };

  const closeBackupReport = () => {
    setActiveTab(previousTab || 'More');
  };

  // Transaction Operations
  const saveTransaction = (data) => {
    let result;
    if (editingTransaction && editingTransaction.id) {
      result = dbUpdateTransaction(editingTransaction.id, data);
    } else {
      result = dbAddTransaction(data);
    }
    refreshAll();

    // Trigger auto-sync in background after saving
    setTimeout(() => {
      runBackgroundChecks();
    }, 500);

    return result;
  };

  const deleteTransactionItem = (id) => {
    const success = dbDeleteTransaction(id);
    refreshAll();

    setTimeout(() => {
      runBackgroundChecks();
    }, 500);

    return success;
  };

  // Party Operations
  const saveParty = (data) => {
    let result;
    if (data.id) {
      result = dbUpdateParty(data.id, data);
    } else {
      result = dbAddParty(data);
    }
    refreshAll();
    return result;
  };

  const deletePartyItem = (id) => {
    const success = dbDeleteParty(id);
    refreshAll();
    return success;
  };

  // Category Operations
  const saveCategory = (data) => {
    let result;
    if (data.id) {
      result = dbUpdateCategory(data.id, data);
    } else {
      result = dbAddCategory(data);
    }
    refreshAll();
    return result;
  };

  const deleteCategoryItem = (id) => {
    const success = dbDeleteCategory(id);
    refreshAll();
    return success;
  };

  // Sync Actions
  const triggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const result = await syncTextData();
    refreshAll();
    setIsSyncing(false);
    return result;
  };

  const triggerImageSync = async () => {
    if (isImageSyncing) return;
    setIsImageSyncing(true);
    const result = await uploadPendingImages();
    refreshAll();
    setIsImageSyncing(false);
    return result;
  };

  const updateImageSchedule = (timeString) => {
    updateSetting('image_backup_time', timeString);
    refreshAll();
  };

  const toggleImageScheduleEnabled = (enabled) => {
    updateSetting('image_backup_enabled', enabled ? '1' : '0');
    refreshAll();
  };

  // Safe Local-Only Erase
  const eraseLocalDeviceData = () => {
    const success = eraseLocalDeviceDataOnly();
    refreshAll();
    return success;
  };

  return (
    <AppContext.Provider
      value={{
        isInitialized,
        activeTab,
        setActiveTab,
        previousTab,
        navigateToBackup,
        balances,
        recentTransactions,
        parties,
        categories,
        syncStats,
        detailedBackupStats,
        backupActivityLogs,
        networkStatus,
        isSyncing,
        isImageSyncing,
        refreshAll,
        triggerSync,
        triggerImageSync,
        updateImageSchedule,
        toggleImageScheduleEnabled,
        eraseLocalDeviceData,

        // Modals & Navigation
        isAddTransactionOpen,
        addTransactionDefaults,
        editingTransaction,
        openAddTransaction,
        openEditTransaction,
        closeAddTransaction,

        viewingTransactionId,
        openTransactionDetails,
        closeTransactionDetails,

        activePartyId,
        openPartyDetails,
        closePartyDetails,

        fullScreenImageUri,
        openFullScreenImage,
        closeFullScreenImage,

        isManageCategoriesOpen,
        setIsManageCategoriesOpen,

        isManagePartiesOpen,
        setIsManagePartiesOpen,

        isBackupReportOpen,
        openBackupReport,
        closeBackupReport,

        // Data Mutations
        saveTransaction,
        deleteTransactionItem,
        saveParty,
        deletePartyItem,
        saveCategory,
        deleteCategoryItem,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

