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
  addBackupActivityLog,
  getAuthSession,
  saveAuthSession,
  clearAuthSession,
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
  getBackupSettings,
  updateBackupSettings,
  DEFAULT_BACKUP_SETTINGS,
} from '../database/queries';
import {
  checkNetworkConnectivity,
  syncTextData,
  uploadPendingImages,
  checkScheduledImageBackup,
  autoSyncTextIfConnected,
} from '../services/syncService';
import {
  uploadEntireDatabaseAndImages,
  fetchCloudBackupInfo,
  importCloudDataAndRestore,
  testBackupLocation,
  checkScheduledAutoBackup,
} from '../services/backupRestoreService';
import API_CONFIG from '../constants/api_config';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState('Home'); // Home, Transactions, Khata, Reports, More, Backup
  const [previousTab, setPreviousTab] = useState('More');
  
  // Authentication State
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

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
  const [backupSettings, setBackupSettings] = useState(DEFAULT_BACKUP_SETTINGS);
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
  const [isBackupSettingsOpen, setIsBackupSettingsOpen] = useState(false);

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

      const bSettings = getBackupSettings();
      setBackupSettings(bSettings);

      const logs = getBackupActivityLogs(20);
      setBackupActivityLogs(logs);

      const session = getAuthSession();
      if (session.isLoggedIn && session.user) {
        setCurrentUser(session.user);
        setAuthToken(session.token);
        setIsLoggedIn(true);
      } else {
        setCurrentUser(null);
        setAuthToken(null);
        setIsLoggedIn(false);
      }
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

      // Only perform cloud backup/sync when user is logged in
      const session = getAuthSession();
      if (net.isConnected && session.isLoggedIn) {
        // 1. Auto-sync pending text data
        const textRes = await autoSyncTextIfConnected();
        if (textRes && textRes.success && textRes.count > 0) {
          refreshAll();
        }

        // 2. Auto scheduled full database backup if due
        const autoBkRes = await checkScheduledAutoBackup();
        if (autoBkRes && autoBkRes.executed) {
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
        const session = getAuthSession();
        if (session.isLoggedIn) {
          setCurrentUser(session.user);
          setAuthToken(session.token);
          setIsLoggedIn(true);
        }

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
    setActiveTab('More');
  };

  const openBackupSettings = () => {
    setIsBackupSettingsOpen(true);
  };

  const closeBackupSettings = () => {
    setIsBackupSettingsOpen(false);
  };

  const saveBackupSettings = (newSettings) => {
    const updated = updateBackupSettings(newSettings);
    refreshAll();
    return updated;
  };

  const testBackupEndpoint = async (url = null) => {
    return await testBackupLocation(url);
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
    if (!isLoggedIn) {
      return {
        success: false,
        requiresLogin: true,
        message: 'Please sign in or create an account to enable cloud backup.',
      };
    }
    if (isSyncing) return;
    setIsSyncing(true);
    const result = await syncTextData();
    refreshAll();
    setIsSyncing(false);
    return result;
  };

  const triggerImageSync = async () => {
    if (!isLoggedIn) {
      return {
        success: false,
        requiresLogin: true,
        message: 'Please sign in to backup receipt photos to cloud.',
      };
    }
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

  // Full SQLite Database & Media Backup & Restore Actions
  const uploadFullDatabaseBackup = async (onProgress) => {
    if (!isLoggedIn) {
      return {
        success: false,
        requiresLogin: true,
        message: 'Please sign in to backup your database and photos to the cloud.',
      };
    }
    const res = await uploadEntireDatabaseAndImages(onProgress);
    refreshAll();
    return res;
  };

  const getCloudBackupInfo = async () => {
    return await fetchCloudBackupInfo();
  };

  const importAndRestoreData = async (onProgress) => {
    if (!isLoggedIn) {
      return {
        success: false,
        requiresLogin: true,
        message: 'Please sign in to restore your cloud data.',
      };
    }
    const res = await importCloudDataAndRestore(onProgress);
    refreshAll();
    return res;
  };

  // Safe Local-Only Erase
  const eraseLocalDeviceData = () => {
    const success = eraseLocalDeviceDataOnly();
    refreshAll();
    return success;
  };

  // Authentication Actions
  const openLoginModal = () => {
    setIsLoginModalOpen(true);
  };

  const closeLoginModal = () => {
    setIsLoginModalOpen(false);
  };

  const openLogoutModal = () => {
    setIsLogoutModalOpen(true);
  };

  const closeLogoutModal = () => {
    setIsLogoutModalOpen(false);
  };

  const loginUser = async (phone, password) => {
    try {
      const net = await checkNetworkConnectivity();
      if (!net.isConnected) {
        return { success: false, message: 'Device is offline. Internet connection required to log in.' };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(API_CONFIG.AUTH_LOGIN_URL, {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify({ phone, password }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (response.ok && data.success === true) {
        saveAuthSession(data.token, data.user);
        setCurrentUser(data.user);
        setAuthToken(data.token);
        setIsLoggedIn(true);
        addBackupActivityLog('auth', 'success', `User logged in: ${data.user.name || phone}`);
        refreshAll();
        // Immediately trigger cloud sync now that user is authenticated
        setTimeout(() => {
          runBackgroundChecks();
        }, 300);
        return { success: true, user: data.user, message: data.message || 'Login successful. Cloud backup is now enabled!' };
      } else {
        const failMsg = data.message || 'Invalid mobile number or password.';
        addBackupActivityLog('auth', 'failed', `Login failed for ${phone}: ${failMsg}`);
        return { success: false, message: failMsg };
      }
    } catch (err) {
      const errDetail = err.name === 'AbortError' ? 'Connection timeout (10s)' : (err.message || 'Network request failed');
      addBackupActivityLog('auth', 'failed', `Login error: ${errDetail}`);
      return { success: false, message: `Login failed: ${errDetail}` };
    }
  };

  const registerUser = async (name, phone, password, email = '') => {
    try {
      const net = await checkNetworkConnectivity();
      if (!net.isConnected) {
        return { success: false, message: 'Device is offline. Internet connection required to create an account.' };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const response = await fetch(API_CONFIG.AUTH_REGISTER_URL, {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify({ name, phone, password, email }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if ((response.status === 200 || response.status === 201) && data.success === true) {
        saveAuthSession(data.token, data.user);
        setCurrentUser(data.user);
        setAuthToken(data.token);
        setIsLoggedIn(true);
        addBackupActivityLog('auth', 'success', `New account registered: ${data.user.name} (${data.user.phone})`);
        refreshAll();
        // Immediately trigger cloud sync for newly registered account
        setTimeout(() => {
          runBackgroundChecks();
        }, 300);
        return { success: true, user: data.user, message: data.message || 'Account created successfully. Cloud backup is now enabled!' };
      } else {
        const failMsg = data.message || 'Unable to create account. Please check your details.';
        addBackupActivityLog('auth', 'failed', `Registration failed for ${phone}: ${failMsg}`);
        return { success: false, message: failMsg };
      }
    } catch (err) {
      const errDetail = err.name === 'AbortError' ? 'Connection timeout (12s)' : (err.message || 'Network request failed');
      addBackupActivityLog('auth', 'failed', `Registration error: ${errDetail}`);
      return { success: false, message: `Registration failed: ${errDetail}` };
    }
  };

  const logoutUser = async () => {
    try {
      // Optional: notify server
      try {
        fetch(API_CONFIG.AUTH_LOGOUT_URL, {
          method: 'POST',
          headers: API_CONFIG.HEADERS,
        }).catch(() => {});
      } catch (e) {}

      clearAuthSession();
      setCurrentUser(null);
      setAuthToken(null);
      setIsLoggedIn(false);
      addBackupActivityLog('auth', 'info', 'User logged out');
      refreshAll();
      return { success: true };
    } catch (e) {
      console.error('Logout error:', e);
      return { success: false, message: e.message };
    }
  };

  const updateUserProfile = async (name, email = '') => {
    try {
      const net = await checkNetworkConnectivity();
      if (!net.isConnected) {
        return { success: false, message: 'Device is offline. Internet connection required to update profile.' };
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(API_CONFIG.AUTH_UPDATE_PROFILE_URL, {
        method: 'POST',
        headers: API_CONFIG.HEADERS,
        body: JSON.stringify({
          user_id: currentUser?.id,
          phone: currentUser?.phone,
          name: name.trim(),
          email: email.trim(),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const data = await response.json();
      if (response.ok && data.success === true && data.user) {
        const updatedUser = { ...currentUser, ...data.user };
        saveAuthSession(authToken, updatedUser);
        setCurrentUser(updatedUser);
        addBackupActivityLog('auth', 'success', `Profile updated: ${updatedUser.name}`);
        refreshAll();
        return { success: true, user: updatedUser, message: data.message || 'Profile updated.' };
      } else {
        return { success: false, message: data.message || 'Failed to update profile.' };
      }
    } catch (err) {
      return { success: false, message: err.message || 'Profile update request failed.' };
    }
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
        uploadFullDatabaseBackup,
        getCloudBackupInfo,
        importAndRestoreData,

        // Authentication State & Actions
        currentUser,
        authToken,
        isLoggedIn,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        isLogoutModalOpen,
        openLogoutModal,
        closeLogoutModal,
        loginUser,
        registerUser,
        updateUserProfile,
        logoutUser,

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
        navigateToBackup,
        backupSettings,
        isBackupSettingsOpen,
        openBackupSettings,
        closeBackupSettings,
        saveBackupSettings,
        testBackupEndpoint,

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

