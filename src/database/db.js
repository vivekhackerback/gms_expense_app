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

  const purgeAllDatabaseFiles = (name = 'expenses_khata.db') => {
    try {
      if (dbInstance) {
        try { dbInstance.closeSync(); } catch (e) {}
        dbInstance = null;
      }
    } catch (e) {}

    // 1. Try standard expo-sqlite deleteDatabaseSync
    try {
      SQLite.deleteDatabaseSync(name);
    } catch (delErr) {
      console.warn(`[DB_PURGE] deleteDatabaseSync(${name}) warning:`, delErr);
    }

    // 2. Try deleting from known candidate directory paths
    const docDir = FileSystem.documentDirectory;
    if (docDir) {
      try {
        SQLite.deleteDatabaseSync(name, docDir);
      } catch (e) {}
      try {
        SQLite.deleteDatabaseSync(name, `${docDir.replace(/\/+$/, '')}/SQLite/`);
      } catch (e) {}
      try {
        SQLite.deleteDatabaseSync(name, `${docDir.replace(/\/+$/, '')}/databases/`);
      } catch (e) {}
    }
  };

  const openAndSetup = (dbName = 'expenses_khata.db') => {
    // Open synchronously per Expo SQLite SDK 54 specification
    dbInstance = SQLite.openDatabaseSync(dbName);

    // Enable WAL mode for better concurrency and write performance
    dbInstance.execSync('PRAGMA journal_mode = WAL;');
    dbInstance.execSync('PRAGMA foreign_keys = ON;');

    // 1. App Configuration & Key-Value Store
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );
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
        is_custom INTEGER DEFAULT 0,
        is_deleted INTEGER DEFAULT 0,
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
        transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
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
        entity_type TEXT,
        entity_uuid TEXT,
        action TEXT NOT NULL, -- 'create', 'update', 'delete', 'INSERT', 'UPDATE', 'DELETE'
        table_name TEXT,
        record_uuid TEXT,
        payload TEXT NOT NULL,
        retry_count INTEGER DEFAULT 0,
        last_attempt INTEGER,
        status TEXT DEFAULT 'pending',
        created_at INTEGER NOT NULL
      );
    `);

    // 7. Backup & Sync Activity History Log
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS backup_activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT,
        action_type TEXT,
        type TEXT,
        status TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        created_at INTEGER
      );
    `);

    // Dynamic Schema Migrations for existing DB instances
    try {
      const catCols = dbInstance.getAllSync("PRAGMA table_info('categories');");
      if (!catCols.some((col) => col.name === 'is_custom')) {
        dbInstance.execSync('ALTER TABLE categories ADD COLUMN is_custom INTEGER DEFAULT 0;');
      }
      if (!catCols.some((col) => col.name === 'is_deleted')) {
        dbInstance.execSync('ALTER TABLE categories ADD COLUMN is_deleted INTEGER DEFAULT 0;');
      }
    } catch (migErr) {
      console.warn('Migration error for categories columns:', migErr);
    }

    try {
      const imgCols = dbInstance.getAllSync("PRAGMA table_info('transaction_images');");
      if (!imgCols.some((col) => col.name === 'transaction_id')) {
        dbInstance.execSync('ALTER TABLE transaction_images ADD COLUMN transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE;');
      }
    } catch (migErr) {
      console.warn('Migration error for transaction_images.transaction_id:', migErr);
    }

    try {
      const queueCols = dbInstance.getAllSync("PRAGMA table_info('sync_queue');");
      if (!queueCols.some((col) => col.name === 'status')) {
        dbInstance.execSync("ALTER TABLE sync_queue ADD COLUMN status TEXT DEFAULT 'pending';");
      }
      if (!queueCols.some((col) => col.name === 'entity_type')) {
        dbInstance.execSync('ALTER TABLE sync_queue ADD COLUMN entity_type TEXT;');
      }
      if (!queueCols.some((col) => col.name === 'entity_uuid')) {
        dbInstance.execSync('ALTER TABLE sync_queue ADD COLUMN entity_uuid TEXT;');
      }
    } catch (migErr) {
      console.warn('Migration error for sync_queue columns:', migErr);
    }

    try {
      const logCols = dbInstance.getAllSync("PRAGMA table_info('backup_activity_logs');");
      if (!logCols.some((col) => col.name === 'timestamp')) {
        dbInstance.execSync('ALTER TABLE backup_activity_logs ADD COLUMN timestamp TEXT;');
      }
      if (!logCols.some((col) => col.name === 'action_type')) {
        dbInstance.execSync('ALTER TABLE backup_activity_logs ADD COLUMN action_type TEXT;');
      }
      if (!logCols.some((col) => col.name === 'details')) {
        dbInstance.execSync('ALTER TABLE backup_activity_logs ADD COLUMN details TEXT;');
      }
    } catch (migErr) {
      console.warn('Migration error for backup_activity_logs:', migErr);
    }

    // Create Indexes for ultra-fast listing & querying
    dbInstance.execSync(`
      CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);
      CREATE INDEX IF NOT EXISTS idx_tx_party ON transactions(party_id);
      CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
      CREATE INDEX IF NOT EXISTS idx_tx_sync ON transactions(sync_status);
      CREATE INDEX IF NOT EXISTS idx_img_tx_id ON transaction_images(transaction_id);
      CREATE INDEX IF NOT EXISTS idx_img_tx_uuid ON transaction_images(transaction_uuid);
      CREATE INDEX IF NOT EXISTS idx_img_upload_status ON transaction_images(upload_status);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    `);

    // Seed default categories if table is empty
    seedDefaultCategories(dbInstance);

    return dbInstance;
  };

  try {
    return openAndSetup('expenses_khata.db');
  } catch (error) {
    console.error('Failed to initialize database, initiating recovery:', error);
    const errMsg = String(error?.message || '');
    
    // Perform purge of corrupted files
    console.warn('⚠️ Corrupted/non-database file detected. Recreating clean database...');
    purgeAllDatabaseFiles('expenses_khata.db');

    try {
      // Retry opening fresh expenses_khata.db
      return openAndSetup('expenses_khata.db');
    } catch (secondErr) {
      console.error('Failed on second attempt, trying fallback database file:', secondErr);
      try {
        // As a last-resort fallback to ensure app NEVER crashes on launch, use alternate clean DB name
        purgeAllDatabaseFiles('expenses_khata_recovered.db');
        return openAndSetup('expenses_khata_recovered.db');
      } catch (recoveryErr) {
        console.error('Fatal recovery error in initDatabase:', recoveryErr);
        throw recoveryErr;
      }
    }
  }
};

const seedDefaultCategories = (db) => {
  const result = db.getAllSync('SELECT COUNT(*) as count FROM categories;');
  if (result[0]?.count === 0) {
    const now = getCurrentTimestamp();
    for (const cat of DEFAULT_CATEGORIES) {
      db.runSync(
        `INSERT INTO categories (name, icon, color, is_custom, is_deleted, is_default, is_active, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, 0, 0, 1, 1, ?, ?, 'synced');`,
        [cat.name, cat.icon, cat.color, now, now]
      );
    }
  }
};
