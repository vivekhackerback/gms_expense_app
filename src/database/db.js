import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { DEFAULT_CATEGORIES } from '../constants/categories';

let dbInstance = null;

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

  // Create tables
  db.execSync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT 'grid-outline',
      color TEXT DEFAULT '#64748B',
      is_custom INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
      transaction_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      sync_status TEXT DEFAULT 'pending',
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
      created_at TEXT NOT NULL,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_uuid TEXT NOT NULL,
      action TEXT NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
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
  `);

  // Seed default categories if not already present
  const existingCategories = db.getAllSync('SELECT COUNT(*) as count FROM categories;');
  if (existingCategories[0]?.count === 0) {
    const now = new Date().toISOString();
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

  return db;
};
