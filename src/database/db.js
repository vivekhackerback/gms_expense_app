import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { DEFAULT_CATEGORIES } from '../constants/categories';
import { getCurrentTimestamp, toUnixTimestamp } from '../utils/formatters';

let dbInstance = null;

export const getDatabaseFilePath = async () => {
  // 1. Direct databasePath property on active SQLiteDatabase instance
  try {
    const db = getDatabase();
    if (db && db.databasePath) {
      let p = db.databasePath;
      if (!p.startsWith('file://') && !p.startsWith('http')) {
        p = `file://${p}`;
      }
      try {
        const info = await FileSystem.getInfoAsync(p);
        if (info && info.exists) {
          return p;
        }
      } catch (e) {}
      // If getInfoAsync failed with file:// prefix, try raw path
      try {
        const rawP = db.databasePath;
        const info2 = await FileSystem.getInfoAsync(rawP);
        if (info2 && info2.exists) {
          return p;
        }
      } catch (e) {}
    }
  } catch (e) {
    console.warn('Error checking db.databasePath:', e);
  }

  // 2. Default SQLite directory from expo-sqlite
  try {
    if (SQLite.defaultDatabaseDirectory) {
      const base = SQLite.defaultDatabaseDirectory.replace(/\/+$/, '');
      let p = `${base}/expenses_khata.db`;
      if (!p.startsWith('file://')) p = `file://${p}`;
      try {
        const info = await FileSystem.getInfoAsync(p);
        if (info && info.exists) {
          return p;
        }
      } catch (e) {}
    }
  } catch (e) {}

  // 3. Document directory candidate paths
  const docDir = FileSystem.documentDirectory;
  if (docDir) {
    const baseDoc = docDir.replace(/\/+$/, '');
    const candidates = [
      `${baseDoc}/SQLite/expenses_khata.db`,
      `${baseDoc}/expenses_khata.db`,
      `${baseDoc}/../databases/expenses_khata.db`,
      `${baseDoc}/databases/expenses_khata.db`,
    ];

    for (const c of candidates) {
      try {
        const info = await FileSystem.getInfoAsync(c);
        if (info && info.exists) {
          return c;
        }
      } catch (e) {}
    }
  }

  // 4. Cache directory candidate paths
  const cacheDir = FileSystem.cacheDirectory;
  if (cacheDir) {
    const baseCache = cacheDir.replace(/\/+$/, '');
    const candidates = [
      `${baseCache}/SQLite/expenses_khata.db`,
      `${baseCache}/expenses_khata.db`,
    ];
    for (const c of candidates) {
      try {
        const info = await FileSystem.getInfoAsync(c);
        if (info && info.exists) {
          return c;
        }
      } catch (e) {}
    }
  }

  // 5. If dbInstance has databasePath, return it as formatted file URI
  try {
    const db = getDatabase();
    if (db && db.databasePath) {
      const p = db.databasePath;
      return p.startsWith('file://') ? p : `file://${p}`;
    }
  } catch (e) {}

  // 6. Default fallback
  if (docDir) {
    return `${docDir.replace(/\/+$/, '')}/SQLite/expenses_khata.db`;
  }

  return null;
};

export const checkpointDatabase = () => {
  try {
    const db = getDatabase();
    db.execSync('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch (e) {
    console.warn('Could not checkpoint WAL:', e);
  }
};

export const closeDatabase = () => {
  try {
    if (dbInstance) {
      dbInstance.closeSync();
      dbInstance = null;
    }
  } catch (e) {
    console.warn('Error closing database:', e);
    dbInstance = null;
  }
};

export const getDatabase = () => {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
};

export const initDatabase = () => {
  if (dbInstance) return dbInstance;

  try {
    // Open synchronously per Expo SQLite SDK 54 specification
    dbInstance = SQLite.openDatabaseSync('expenses_khata.db');

    // Enable WAL mode for better concurrency and write performance
    dbInstance.execSync('PRAGMA journal_mode = WAL;');
    dbInstance.execSync('PRAGMA foreign_keys = ON;');

    // 1. App Configuration & Key-Value Store
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);

    // 2. Categories Table
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        icon TEXT NOT NULL,
        color TEXT NOT NULL,
        is_default INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        sync_status TEXT DEFAULT 'pending'
      );
    `);

    // 3. Parties / Khata Customers Table
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS parties (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        credit_limit REAL DEFAULT 0,
        opening_balance REAL DEFAULT 0,
        current_balance REAL DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        sync_status TEXT DEFAULT 'pending'
      );
    `);

    // 4. Main Transactions Table
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uuid TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL CHECK(type IN ('gave', 'got')),
        payment_mode TEXT NOT NULL CHECK(payment_mode IN ('cash', 'online')),
        amount REAL NOT NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        party_id INTEGER REFERENCES parties(id) ON DELETE SET NULL,
        note TEXT,
        transaction_date TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        sync_status TEXT DEFAULT 'pending'
      );
    `);

    // 5. Transaction Images (Multiple Bills / Receipts)
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS transaction_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transaction_uuid TEXT NOT NULL REFERENCES transactions(uuid) ON DELETE CASCADE,
        local_uri TEXT NOT NULL,
        server_url TEXT,
        file_name TEXT,
        upload_status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL
      );
    `);

    // 6. Sync Queue / Change Log Table
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
        table_name TEXT NOT NULL,
        record_uuid TEXT NOT NULL,
        payload TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_attempt INTEGER,
        created_at INTEGER NOT NULL
      );
    `);

    // 7. Backup & Sync Activity History Log
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS backup_activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    // Create Indexes for ultra-fast listing & querying
    dbInstance.execSync(`
      CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);
      CREATE INDEX IF NOT EXISTS idx_tx_party ON transactions(party_id);
      CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_tx_sync ON transactions(sync_status);
      CREATE INDEX IF NOT EXISTS idx_img_tx_uuid ON transaction_images(transaction_uuid);
      CREATE INDEX IF NOT EXISTS idx_img_upload_status ON transaction_images(upload_status);
    `);

    // Seed default categories if table is empty
    seedDefaultCategories(dbInstance);

    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
};

const seedDefaultCategories = (db) => {
  const result = db.getAllSync('SELECT COUNT(*) as count FROM categories;');
  if (result[0]?.count === 0) {
    const now = getCurrentTimestamp();
    for (const cat of DEFAULT_CATEGORIES) {
      db.runSync(
        `INSERT INTO categories (name, icon, color, is_default, is_active, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, 1, 1, ?, ?, 'synced');`,
        [cat.name, cat.icon, cat.color, now, now]
      );
    }
  }
};
