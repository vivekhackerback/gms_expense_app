import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { initDatabase } from '../database/db';
import {
  getBalances,
  getTransactions,
  getParties,
  getCategories,
  getSyncStats,
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
import { checkNetworkConnectivity, processSyncQueue } from '../services/syncService';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [activeTab, setActiveTab] = useState('Home'); // Home, Transactions, Khata, Reports, More
  
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
  });
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [parties, setParties] = useState([]);
  const [categories, setCategories] = useState([]);
  const [syncStats, setSyncStats] = useState({ pendingCount: 0, totalTransactions: 0, lastSync: null });
  const [networkStatus, setNetworkStatus] = useState({ isConnected: true, type: 'UNKNOWN' });
  const [isSyncing, setIsSyncing] = useState(false);

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

  // Refresh all local data instantly
  const refreshAll = useCallback(() => {
    try {
      const newBalances = getBalances();
      setBalances(newBalances);

      const recent = getTransactions({ limit: 10 });
      setRecentTransactions(recent);

      const allParties = getParties();
      setParties(allParties);

      const allCategories = getCategories();
      setCategories(allCategories);

      const stats = getSyncStats();
      setSyncStats(stats);
    } catch (err) {
      console.error('Error refreshing state:', err);
    }
  }, []);

  // Initialize DB and initial state on mount
  useEffect(() => {
    const initialize = async () => {
      try {
        initDatabase();
        refreshAll();
        const net = await checkNetworkConnectivity();
        setNetworkStatus(net);
        setIsInitialized(true);
      } catch (e) {
        console.error('Initialization error:', e);
        setIsInitialized(true);
      }
    };
    initialize();
  }, [refreshAll]);

  // Modal Actions
  const openAddTransaction = (options = {}) => {
    setEditingTransaction(null);
    setAddTransactionDefaults({
      type: options.defaultType || 'gave',
      paymentMode: options.defaultMode || 'cash',
      partyId: options.defaultPartyId || null,
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

  // Transaction Operations
  const saveTransaction = (data) => {
    let result;
    if (editingTransaction && editingTransaction.id) {
      result = dbUpdateTransaction(editingTransaction.id, data);
    } else {
      result = dbAddTransaction(data);
    }
    refreshAll();
    return result;
  };

  const deleteTransactionItem = (id) => {
    const success = dbDeleteTransaction(id);
    refreshAll();
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

  // Sync Trigger
  const triggerSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    const result = await processSyncQueue();
    refreshAll();
    setIsSyncing(false);
    return result;
  };

  return (
    <AppContext.Provider
      value={{
        isInitialized,
        activeTab,
        setActiveTab,
        balances,
        recentTransactions,
        parties,
        categories,
        syncStats,
        networkStatus,
        isSyncing,
        refreshAll,
        triggerSync,

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
