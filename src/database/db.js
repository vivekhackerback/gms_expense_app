import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { DEFAULT_CATEGORIES } from '../constants/categories';
import { getCurrentTimestamp, toUnixTimestamp } from '../utils/formatters';

let dbInstance = null;
let currentDbName = null;

export const DB_PREFIX = 'expenses_khata_';
export const DB_META_FILE = 'expenses_khata_meta.json';

/**
 * Calculates the database name dynamically using the Unix timestamp:
 * expenses_khata_{unix_timestamp}.db
 *
 * @param {number} [timestamp] - Current Unix timestamp in seconds
 * @param {boolean} [includeExtension=true] - Whether to append .db
 * @returns {string} Calculated database name e.g. "expenses_khata_1731600000.db"
 */
export const calculateDatabaseName = (timestamp = Math.floor(Date.now() / 1000), includeExtension = true) => {
  const ts = Math.floor(Number(timestamp) || Date.now() / 1000);
  const base = `${DB_PREFIX}${ts}`;
  return includeExtension ? `${base}.db` : base;
};

/**
 * Returns database base name without .db extension
 * e.g. "expenses_khata_1731600000"
 */
export const getDatabaseBaseName = (dbName = getDatabaseName()) => {
  return String(dbName || '').replace(/\.db$/, '');
};

/**
 * Manually set or override the active database name
 */
export const setDatabaseName = (name) => {
  if (name) {
    currentDbName = name.endsWith('.db') ? name : `${name}.db`;
  }
};

/**
 * Gets the current database name dynamically.
 * Never hardcodes the database name.
 */
export const getDatabaseName = () => {
  if (currentDbName) return currentDbName;
  currentDbName = calculateDatabaseName();
  return currentDbName;
};

/**
 * Saves the active database metadata to disk so it is preserved across app restarts
 */
export const saveDatabaseMetaAsync = async (name) => {
  try {
    const docDir = FileSystem.documentDirectory;
    if (!docDir) return;
    const metaPath = `${docDir.replace(/\/+$/, '')}/${DB_META_FILE}`;
    const payload = {
      dbName: name,
      baseName: getDatabaseBaseName(name),
      updatedAt: Date.now(),
    };
    await FileSystem.writeAsStringAsync(metaPath, JSON.stringify(payload));
  } catch (e) {
    console.warn('Could not save database metadata:', e);
  }
};

/**
 * Scans directories for existing timestamped database files matching expenses_khata_{timestamp}.db
 */
export const scanForExistingExpensesKhataDbAsync = async () => {
  const dirs = [];
  if (SQLite.defaultDatabaseDirectory) {
    dirs.push(SQLite.defaultDatabaseDirectory);
  }
  if (FileSystem.documentDirectory) {
    dirs.push(`${FileSystem.documentDirectory.replace(/\/+$/, '')}/SQLite`);
    dirs.push(FileSystem.documentDirectory);
  }

  const matches = [];
  for (const dir of dirs) {
    try {
      const info = await FileSystem.getInfoAsync(dir);
      if (info.exists && info.isDirectory) {
        const files = await FileSystem.readDirectoryAsync(dir);
        for (const file of files) {
          const match = file.match(/^expenses_khata_(\d+)(\.db)?$/);
          if (match) {
            const ts = parseInt(match[1], 10);
            const normalizedName = file.endsWith('.db') ? file : `${file}.db`;
            matches.push({ name: normalizedName, ts });
          }
        }
      }
    } catch (e) {}
  }

  if (matches.length > 0) {
    matches.sort((a, b) => b.ts - a.ts);
    return matches[0].name;
  }
  return null;
};

const findLegacyDbPathAsync = async () => {
  const docDir = FileSystem.documentDirectory;
  const sqliteDir = SQLite.defaultDatabaseDirectory;
  const candidates = [];
  if (sqliteDir) candidates.push(`${sqliteDir.replace(/\/+$/, '')}/expenses_khata.db`);
  if (docDir) {
    const base = docDir.replace(/\/+$/, '');
    candidates.push(`${base}/SQLite/expenses_khata.db`);
    candidates.push(`${base}/expenses_khata.db`);
  }
  for (const c of candidates) {
    try {
      const info = await FileSystem.getInfoAsync(c);
      if (info && info.exists && info.size > 0) return c;
    } catch (e) {}
  }
  return null;
};

/**
 * Resolves the database name on startup:
 * 1. Checks memory cache
 * 2. Reads meta config file
 * 3. Scans SQLite directory for existing timestamped database
 * 4. Migrates legacy unversioned database if present
 * 5. Dynamically calculates new database name using current Unix timestamp
 */
export const resolveOrCreateDatabaseNameAsync = async () => {
  let resolvedName = null;

  // 1. Try reading saved meta file
  const docDir = FileSystem.documentDirectory;
  if (docDir) {
    try {
      const metaPath = `${docDir.replace(/\/+$/, '')}/${DB_META_FILE}`;
      const info = await FileSystem.getInfoAsync(metaPath);
      if (info.exists) {
        const raw = await FileSystem.readAsStringAsync(metaPath);
        const parsed = JSON.parse(raw);
        if (parsed && parsed.dbName) {
          resolvedName = parsed.dbName;
        }
      }
    } catch (e) {}
  }

  // 2. Scan directories for existing expenses_khata_{timestamp}.db
  if (!resolvedName) {
    try {
      const existing = await scanForExistingExpensesKhataDbAsync();
      if (existing) {
        resolvedName = existing;
      }
    } catch (e) {}
  }

  // 3. Migrate legacy expenses_khata.db if present
  if (!resolvedName) {
    try {
      const legacyPath = await findLegacyDbPathAsync();
      if (legacyPath) {
        const newTimestamp = Math.floor(Date.now() / 1000);
        const newName = calculateDatabaseName(newTimestamp);
        const targetDir = SQLite.defaultDatabaseDirectory || `${FileSystem.documentDirectory}SQLite/`;
        const targetPath = `${targetDir.replace(/\/+$/, '')}/${newName}`;
        try {
          await FileSystem.copyAsync({ from: legacyPath, to: targetPath });
        } catch (copyErr) {}
        resolvedName = newName;
      }
    } catch (e) {}
  }

  // 4. If currentDbName is already set and no saved db found, keep currentDbName
  if (!resolvedName && currentDbName) {
    resolvedName = currentDbName;
  }

  // 5. Otherwise dynamically calculate new database name using current Unix timestamp
  if (!resolvedName) {
    resolvedName = calculateDatabaseName();
  }

  // If active database instance differs from resolved database, close old instance
  if (dbInstance && currentDbName && currentDbName !== resolvedName) {
    try {
      dbInstance.closeSync();
    } catch (e) {}
    dbInstance = null;
  }

  currentDbName = resolvedName;
  await saveDatabaseMetaAsync(resolvedName);
  return resolvedName;
};

export const getDatabaseFilePath = async () => {
  const dbName = getDatabaseName();
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
      let p = `${base}/${dbName}`;
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
      `${baseDoc}/SQLite/${dbName}`,
      `${baseDoc}/${dbName}`,
      `${baseDoc}/../databases/${dbName}`,
      `${baseDoc}/databases/${dbName}`,
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
      `${baseCache}/SQLite/${dbName}`,
      `${baseCache}/${dbName}`,
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
    return `${docDir.replace(/\/+$/, '')}/SQLite/${dbName}`;
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

export const initDatabase = (customDbName = null) => {
  if (customDbName) {
    const formatted = customDbName.endsWith('.db') ? customDbName : `${customDbName}.db`;
    if (dbInstance && currentDbName && currentDbName !== formatted) {
      try {
        dbInstance.closeSync();
      } catch (e) {}
      dbInstance = null;
    }
    setDatabaseName(formatted);
  }
  const activeDbName = getDatabaseName();
  if (dbInstance) return dbInstance;

  const purgeAllDatabaseFiles = (name = activeDbName) => {
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

  const openAndSetup = (dbName = activeDbName) => {
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
        sort_order INTEGER DEFAULT 0,
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
        server_id INTEGER,
        server_synced_at INTEGER,
        file_name TEXT,
        original_file_name TEXT,
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

    // 8. UPI Payment Recipient Info Table
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS upi_info (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        upi_id TEXT NOT NULL,
        upi_update INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT DEFAULT ''
      );
    `);

    // Migration for upi_info columns if not present
    try {
      const upiCols = dbInstance.getAllSync("PRAGMA table_info('upi_info');");
      const upiColNames = upiCols.map((col) => col.name);
      if (!upiColNames.includes('upi_update')) {
        dbInstance.execSync("ALTER TABLE upi_info ADD COLUMN upi_update INTEGER DEFAULT 1;");
      }
      if (!upiColNames.includes('updated_at')) {
        dbInstance.execSync("ALTER TABLE upi_info ADD COLUMN updated_at TEXT DEFAULT '';");
      }
    } catch (migErr) {
      console.warn('Migration error for upi_info columns:', migErr);
    }

    // Ensure default initial row exists so app never shows "Connect to internet"
    try {
      const upiCount = dbInstance.getFirstSync("SELECT COUNT(*) as count FROM upi_info WHERE upi_id IS NOT NULL AND TRIM(upi_id) != '';");
      if (!upiCount || Number(upiCount.count) === 0) {
        dbInstance.runSync("INSERT INTO `upi_info` (`id`, `upi_id`, `upi_update`, `updated_at`) VALUES (1, '8651615629@jio', 1, '2026-10-25 04:32:08');");
      } else {
        // Clean up legacy placeholder if present
        try {
          dbInstance.runSync("UPDATE `upi_info` SET `upi_id` = '8651615629@jio' WHERE `upi_id` LIKE '%-2@ybl%';");
        } catch (cleanErr) {}
      }
    } catch (upiErr) {
      console.warn('Could not ensure default upi_info:', upiErr);
    }

    // 9. WhatsApp OTP Gateway Domain Configuration Table (https://otp.losttag.in/docs)
    dbInstance.execSync(`
      CREATE TABLE IF NOT EXISTS otp_domain (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        domain TEXT NOT NULL DEFAULT 'https://otp.losttag.in',
        api_base_url TEXT NOT NULL DEFAULT 'https://otp.losttag.in/api/v1',
        api_key TEXT DEFAULT '',
        api_secret TEXT DEFAULT '',
        sender_phone_id TEXT DEFAULT '1432742293247493',
        template_name TEXT DEFAULT 'otp_service',
        purpose TEXT DEFAULT 'Verification',
        expiry_seconds INTEGER DEFAULT 300,
        resend_cooldown INTEGER DEFAULT 60,
        max_attempts INTEGER DEFAULT 5,
        status TEXT DEFAULT 'active',
        is_active INTEGER DEFAULT 1,
        otp_update INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER,
        updated_at TEXT DEFAULT ''
      );
    `);

    // Migration for otp_domain columns if not present
    try {
      const otpCols = dbInstance.getAllSync("PRAGMA table_info('otp_domain');");
      const otpColNames = otpCols.map((col) => col.name);
      if (!otpColNames.includes('api_base_url')) {
        dbInstance.execSync("ALTER TABLE otp_domain ADD COLUMN api_base_url TEXT DEFAULT 'https://otp.losttag.in/api/v1';");
      }
      if (!otpColNames.includes('sender_phone_id')) {
        dbInstance.execSync("ALTER TABLE otp_domain ADD COLUMN sender_phone_id TEXT DEFAULT '1432742293247493';");
      }
      if (!otpColNames.includes('template_name')) {
        dbInstance.execSync("ALTER TABLE otp_domain ADD COLUMN template_name TEXT DEFAULT 'otp_service';");
      }
      if (!otpColNames.includes('purpose')) {
        dbInstance.execSync("ALTER TABLE otp_domain ADD COLUMN purpose TEXT DEFAULT 'Verification';");
      }
      if (!otpColNames.includes('expiry_seconds')) {
        dbInstance.execSync("ALTER TABLE otp_domain ADD COLUMN expiry_seconds INTEGER DEFAULT 300;");
      }
      if (!otpColNames.includes('resend_cooldown')) {
        dbInstance.execSync("ALTER TABLE otp_domain ADD COLUMN resend_cooldown INTEGER DEFAULT 60;");
      }
      if (!otpColNames.includes('max_attempts')) {
        dbInstance.execSync("ALTER TABLE otp_domain ADD COLUMN max_attempts INTEGER DEFAULT 5;");
      }
      if (!otpColNames.includes('otp_update')) {
        dbInstance.execSync("ALTER TABLE otp_domain ADD COLUMN otp_update INTEGER DEFAULT 1;");
      }
      if (!otpColNames.includes('status')) {
        dbInstance.execSync("ALTER TABLE otp_domain ADD COLUMN status TEXT DEFAULT 'active';");
      }
      if (!otpColNames.includes('is_active')) {
        dbInstance.execSync("ALTER TABLE otp_domain ADD COLUMN is_active INTEGER DEFAULT 1;");
      }
      if (!otpColNames.includes('updated_at')) {
        dbInstance.execSync("ALTER TABLE otp_domain ADD COLUMN updated_at TEXT DEFAULT '';");
      }
    } catch (migErr) {
      console.warn('Migration error for otp_domain columns:', migErr);
    }

    // Ensure default initial row exists and sanitize purpose length to max 15 chars
    try {
      const otpCount = dbInstance.getFirstSync("SELECT COUNT(*) as count FROM otp_domain WHERE domain IS NOT NULL AND TRIM(domain) != '';");
      if (!otpCount || Number(otpCount.count) === 0) {
        dbInstance.runSync(
          "INSERT INTO `otp_domain` (`id`, `domain`, `api_base_url`, `api_key`, `api_secret`, `sender_phone_id`, `template_name`, `purpose`, `expiry_seconds`, `resend_cooldown`, `max_attempts`, `status`, `is_active`, `otp_update`, `created_at`, `updated_at`) VALUES (1, 'https://otp.losttag.in', 'https://otp.losttag.in/api/v1', '', '', '1432742293247493', 'otp_service', 'Verification', 300, 60, 5, 'active', 1, 1, strftime('%s', 'now'), datetime('now'));"
        );
      } else {
        // Automatically sanitize legacy length > 15 to avoid Meta parameter limit error #132018
        try {
          dbInstance.runSync("UPDATE `otp_domain` SET `purpose` = 'Verification' WHERE length(`purpose`) > 15;");
        } catch (lenErr) {}
      }
    } catch (otpErr) {
      console.warn('Could not ensure default otp_domain:', otpErr);
    }

    // Dynamic Schema Migrations for existing DB instances
    try {
      const catCols = dbInstance.getAllSync("PRAGMA table_info('categories');");
      if (!catCols.some((col) => col.name === 'is_custom')) {
        dbInstance.execSync('ALTER TABLE categories ADD COLUMN is_custom INTEGER DEFAULT 0;');
      }
      if (!catCols.some((col) => col.name === 'is_deleted')) {
        dbInstance.execSync('ALTER TABLE categories ADD COLUMN is_deleted INTEGER DEFAULT 0;');
      }
      if (!catCols.some((col) => col.name === 'sort_order')) {
        dbInstance.execSync('ALTER TABLE categories ADD COLUMN sort_order INTEGER DEFAULT 0;');
        dbInstance.execSync('UPDATE categories SET sort_order = id WHERE sort_order = 0 OR sort_order IS NULL;');
      }
    } catch (migErr) {
      console.warn('Migration error for categories columns:', migErr);
    }

    try {
      const imgCols = dbInstance.getAllSync("PRAGMA table_info('transaction_images');");
      if (!imgCols.some((col) => col.name === 'transaction_id')) {
        dbInstance.execSync('ALTER TABLE transaction_images ADD COLUMN transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE;');
      }
      if (!imgCols.some((col) => col.name === 'server_url')) {
        dbInstance.execSync('ALTER TABLE transaction_images ADD COLUMN server_url TEXT;');
      }
      if (!imgCols.some((col) => col.name === 'server_id')) {
        dbInstance.execSync('ALTER TABLE transaction_images ADD COLUMN server_id INTEGER;');
      }
      if (!imgCols.some((col) => col.name === 'server_synced_at')) {
        dbInstance.execSync('ALTER TABLE transaction_images ADD COLUMN server_synced_at INTEGER;');
      }
      if (!imgCols.some((col) => col.name === 'original_file_name')) {
        dbInstance.execSync('ALTER TABLE transaction_images ADD COLUMN original_file_name TEXT;');
      }
    } catch (migErr) {
      console.warn('Migration error for transaction_images columns:', migErr);
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
      const colNames = logCols.map((col) => col.name);
      if (!colNames.includes('timestamp')) {
        dbInstance.execSync('ALTER TABLE backup_activity_logs ADD COLUMN timestamp TEXT;');
      }
      if (!colNames.includes('action_type')) {
        dbInstance.execSync('ALTER TABLE backup_activity_logs ADD COLUMN action_type TEXT;');
      }
      if (!colNames.includes('type')) {
        dbInstance.execSync('ALTER TABLE backup_activity_logs ADD COLUMN type TEXT;');
      }
      if (!colNames.includes('details')) {
        dbInstance.execSync('ALTER TABLE backup_activity_logs ADD COLUMN details TEXT;');
      }
      if (!colNames.includes('created_at')) {
        dbInstance.execSync('ALTER TABLE backup_activity_logs ADD COLUMN created_at INTEGER;');
      }
    } catch (migErr) {
      console.warn('Migration error for backup_activity_logs:', migErr);
    }

    try {
      const txCols = dbInstance.getAllSync("PRAGMA table_info('transactions');");
      if (!txCols.some((col) => col.name === 'updated_at')) {
        dbInstance.execSync('ALTER TABLE transactions ADD COLUMN updated_at INTEGER DEFAULT (strftime(\'%s\', \'now\'));');
      }
    } catch (migErr) {
      console.warn('Migration error for transactions.updated_at:', migErr);
    }

    // Create Indexes for ultra-fast listing & querying
    dbInstance.execSync(`
      CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);
      CREATE INDEX IF NOT EXISTS idx_tx_updated ON transactions(updated_at);
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
    return openAndSetup(activeDbName);
  } catch (error) {
    console.error('Failed to initialize database, initiating recovery:', error);
    const errMsg = String(error?.message || '');
    
    // Perform purge of corrupted files
    console.warn('⚠️ Corrupted/non-database file detected. Recreating clean database...');
    purgeAllDatabaseFiles(activeDbName);

    try {
      // Retry opening fresh dynamic database
      return openAndSetup(activeDbName);
    } catch (secondErr) {
      console.error('Failed on second attempt, trying fallback database file:', secondErr);
      try {
        // Fallback with fresh dynamically calculated timestamped database name
        const recoveryTimestamp = Math.floor(Date.now() / 1000);
        const recoveryName = calculateDatabaseName(recoveryTimestamp);
        setDatabaseName(recoveryName);
        purgeAllDatabaseFiles(recoveryName);
        return openAndSetup(recoveryName);
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
    DEFAULT_CATEGORIES.forEach((cat, index) => {
      db.runSync(
        `INSERT INTO categories (name, icon, color, is_custom, is_deleted, is_default, is_active, sort_order, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, 0, 0, 1, 1, ?, ?, ?, 'synced');`,
        [cat.name, cat.icon, cat.color, index + 1, now, now]
      );
    });
  }
};
