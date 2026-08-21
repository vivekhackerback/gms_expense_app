import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';
import { DEFAULT_CATEGORIES } from '../constants/categories';
import { getCurrentTimestamp, toUnixTimestamp } from '../utils/formatters';

let dbInstance = null;

export const getDatabaseFilePath = () => {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}SQLite/expenses_khata.db` : null;
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
  if (dbInstance) {
    try {
      checkpointDatabase();
      dbInstance.closeSync();
    } catch (e) {
      console.warn('Error closing database instance:', e);
    }
    dbInstance = null;
  }
};

export const getDatabase = () => {
  if (!dbInstance) {
    dbInstance = SQLite.openDatabaseSync('expenses_khata.db');
  }
  return dbInstance;
};

export const initDatabase = () => {
  const db = getDatabase();

  // Enable WAL mode for performance
  try {
    db.execSync('PRAGMA journal_mode = WAL;');
  } catch (e) {
    console.warn('Could not enable WAL mode:', e);
  }

  // Create tables with INTEGER Unix timestamps (single source of truth)
  db.execSync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT 'grid-outline',
      color TEXT DEFAULT '#64748B',
      is_custom INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      party_id INTEGER,
      category_id INTEGER,
      type TEXT NOT NULL CHECK(type IN ('gave', 'got')),
      payment_mode TEXT NOT NULL CHECK(payment_mode IN ('cash', 'online')),
      amount REAL NOT NULL,
      note TEXT,
      transaction_date INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      sync_status TEXT DEFAULT 'pending',
      server_id INTEGER NULL,
      server_synced_at INTEGER NULL,
      FOREIGN KEY (party_id) REFERENCES parties(id) ON DELETE SET NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS transaction_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER,
      transaction_uuid TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      file_name TEXT,
      upload_status TEXT DEFAULT 'pending',
      server_id INTEGER NULL,
      server_synced_at INTEGER NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_uuid TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL,
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backup_activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT
    );

    -- Indexes for high-performance querying
    CREATE INDEX IF NOT EXISTS idx_tx_uuid ON transactions(uuid);
    CREATE INDEX IF NOT EXISTS idx_tx_party ON transactions(party_id);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);
    CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_tx_mode ON transactions(payment_mode);
    CREATE INDEX IF NOT EXISTS idx_tx_images_tx ON transaction_images(transaction_uuid);
    CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_backup_logs ON backup_activity_logs(timestamp);
  `);

  // Migrations for is_deleted and server_id columns
  try {
    db.execSync('ALTER TABLE categories ADD COLUMN is_deleted INTEGER DEFAULT 0;');
  } catch (e) {}

  try {
    db.execSync('ALTER TABLE transactions ADD COLUMN server_id INTEGER NULL;');
  } catch (e) {}

  try {
    db.execSync('ALTER TABLE transactions ADD COLUMN server_synced_at INTEGER NULL;');
  } catch (e) {}

  try {
    db.execSync('ALTER TABLE transaction_images ADD COLUMN server_id INTEGER NULL;');
  } catch (e) {}

  try {
    db.execSync('ALTER TABLE transaction_images ADD COLUMN server_synced_at INTEGER NULL;');
  } catch (e) {}

  // -------------------------------------------------------------
  // Automatic Migration: Convert legacy ISO string dates to Unix timestamps
  // -------------------------------------------------------------
  try {
    const legacyTxs = db.getAllSync("SELECT id, transaction_date, created_at, updated_at, server_synced_at FROM transactions WHERE typeof(transaction_date) = 'text';");
    if (legacyTxs && legacyTxs.length > 0) {
      for (const row of legacyTxs) {
        db.runSync(
          "UPDATE transactions SET transaction_date = ?, created_at = ?, updated_at = ?, server_synced_at = ? WHERE id = ?;",
          [
            toUnixTimestamp(row.transaction_date),
            toUnixTimestamp(row.created_at),
            toUnixTimestamp(row.updated_at),
            row.server_synced_at ? toUnixTimestamp(row.server_synced_at) : null,
            row.id,
          ]
        );
      }
    }
  } catch (e) {}

  try {
    const legacyParties = db.getAllSync("SELECT id, created_at, updated_at FROM parties WHERE typeof(created_at) = 'text';");
    if (legacyParties && legacyParties.length > 0) {
      for (const row of legacyParties) {
        db.runSync(
          "UPDATE parties SET created_at = ?, updated_at = ? WHERE id = ?;",
          [toUnixTimestamp(row.created_at), toUnixTimestamp(row.updated_at), row.id]
        );
      }
    }
  } catch (e) {}

  try {
    const legacyCats = db.getAllSync("SELECT id, created_at FROM categories WHERE typeof(created_at) = 'text';");
    if (legacyCats && legacyCats.length > 0) {
      for (const row of legacyCats) {
        db.runSync(
          "UPDATE categories SET created_at = ? WHERE id = ?;",
          [toUnixTimestamp(row.created_at), row.id]
        );
      }
    }
  } catch (e) {}

  try {
    const legacyImages = db.getAllSync("SELECT id, created_at, server_synced_at FROM transaction_images WHERE typeof(created_at) = 'text';");
    if (legacyImages && legacyImages.length > 0) {
      for (const row of legacyImages) {
        db.runSync(
          "UPDATE transaction_images SET created_at = ?, server_synced_at = ? WHERE id = ?;",
          [toUnixTimestamp(row.created_at), row.server_synced_at ? toUnixTimestamp(row.server_synced_at) : null, row.id]
        );
      }
    }
  } catch (e) {}

  try {
    const legacyLogs = db.getAllSync("SELECT id, timestamp FROM backup_activity_logs WHERE typeof(timestamp) = 'text';");
    if (legacyLogs && legacyLogs.length > 0) {
      for (const row of legacyLogs) {
        db.runSync(
          "UPDATE backup_activity_logs SET timestamp = ? WHERE id = ?;",
          [toUnixTimestamp(row.timestamp), row.id]
        );
      }
    }
  } catch (e) {}

  // Seed default categories if not already present
  const existingCategories = db.getAllSync('SELECT COUNT(*) as count FROM categories;');
  if (existingCategories[0]?.count === 0) {
    const now = getCurrentTimestamp();
    for (const cat of DEFAULT_CATEGORIES) {
      db.runSync(
        `INSERT OR IGNORE INTO categories (id, name, icon, color, is_custom, created_at) VALUES (?, ?, ?, ?, ?, ?);`,
        [cat.id, cat.name, cat.icon, cat.color, cat.is_custom, now]
      );
    }
  }

  // Seed default settings
  db.runSync(`INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', '₹');`);
  db.runSync(`INSERT OR IGNORE INTO settings (key, value) VALUES ('app_version', '1.0.0');`);
  db.runSync(`INSERT OR IGNORE INTO settings (key, value) VALUES ('last_sync', '');`);
  db.runSync(`INSERT OR IGNORE INTO settings (key, value) VALUES ('last_image_sync', '');`);
  db.runSync(`INSERT OR IGNORE INTO settings (key, value) VALUES ('image_backup_time', '02:00');`);
  db.runSync(`INSERT OR IGNORE INTO settings (key, value) VALUES ('image_backup_enabled', '1');`);
  db.runSync(`INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_sync_enabled', '1');`);

  return db;
};
