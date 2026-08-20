import { getDatabase } from './db';
import { getCurrentTimestamp, toUnixTimestamp } from '../utils/formatters';

// Helper for generating UUID fallback
export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// -------------------------------------------------------------
// Balances
// -------------------------------------------------------------
export const getBalances = () => {
  const db = getDatabase();
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const startTodayTs = Math.floor(startToday.getTime() / 1000);
  const endToday = new Date(now);
  endToday.setHours(23, 59, 59, 999);
  const endTodayTs = Math.floor(endToday.getTime() / 1000);
  const todayIsoPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  const query = `
    SELECT
      COALESCE(SUM(CASE WHEN payment_mode = 'cash' AND type = 'got' THEN amount ELSE 0 END), 0) as cash_got,
      COALESCE(SUM(CASE WHEN payment_mode = 'cash' AND type = 'gave' THEN amount ELSE 0 END), 0) as cash_gave,
      COALESCE(SUM(CASE WHEN payment_mode = 'online' AND type = 'got' THEN amount ELSE 0 END), 0) as online_got,
      COALESCE(SUM(CASE WHEN payment_mode = 'online' AND type = 'gave' THEN amount ELSE 0 END), 0) as online_gave,
      COALESCE(SUM(CASE WHEN type = 'got' THEN amount ELSE 0 END), 0) as total_got,
      COALESCE(SUM(CASE WHEN type = 'gave' THEN amount ELSE 0 END), 0) as total_gave,
      COALESCE(SUM(CASE WHEN type = 'got' AND ((transaction_date >= ? AND transaction_date <= ?) OR transaction_date LIKE ?) THEN amount ELSE 0 END), 0) as today_got,
      COALESCE(SUM(CASE WHEN type = 'gave' AND ((transaction_date >= ? AND transaction_date <= ?) OR transaction_date LIKE ?) THEN amount ELSE 0 END), 0) as today_gave
    FROM transactions;
  `;

  const row = db.getFirstSync(query, [
    startTodayTs, endTodayTs, todayIsoPrefix + '%',
    startTodayTs, endTodayTs, todayIsoPrefix + '%'
  ]) || {
    cash_got: 0,
    cash_gave: 0,
    online_got: 0,
    online_gave: 0,
    total_got: 0,
    total_gave: 0,
    today_got: 0,
    today_gave: 0,
  };

  const cashGot = Number(row.cash_got);
  const cashGave = Number(row.cash_gave);
  const onlineGot = Number(row.online_got);
  const onlineGave = Number(row.online_gave);
  const totalGot = Number(row.total_got);
  const totalGave = Number(row.total_gave);
  const todayGot = Number(row.today_got);
  const todayGave = Number(row.today_gave);

  const cashBalance = cashGot - cashGave;
  const onlineBalance = onlineGot - onlineGave;
  const totalBalance = cashBalance + onlineBalance;

  return {
    cashGot,
    cashGave,
    cashBalance,
    onlineGot,
    onlineGave,
    onlineBalance,
    totalGot,
    totalGave,
    totalBalance,
    todayGot,
    todayGave,
  };
};

// -------------------------------------------------------------
// Transactions
// -------------------------------------------------------------
export const getTransactions = ({
  limit = 50,
  offset = 0,
  filterType = null,      // 'gave' | 'got' | null
  filterMode = null,      // 'cash' | 'online' | null
  startDate = null,       // YYYY-MM-DD or Unix timestamp
  endDate = null,         // YYYY-MM-DD or Unix timestamp
  search = null,          // search string
  partyId = null,
  categoryId = null,
} = {}) => {
  const db = getDatabase();

  let sql = `
    WITH RankedTransactions AS (
      SELECT 
        t.id,
        t.uuid,
        t.party_id as partyId,
        t.category_id as categoryId,
        t.type,
        t.payment_mode as paymentMode,
        t.amount,
        t.note,
        t.transaction_date as transactionDate,
        t.created_at as createdAt,
        t.updated_at as updatedAt,
        t.sync_status as syncStatus,
        p.name as partyName,
        p.phone as partyPhone,
        c.name as categoryName,
        c.icon as categoryIcon,
        c.color as categoryColor,
        (SELECT COUNT(*) FROM transaction_images ti WHERE ti.transaction_id = t.id) as imageCount,
        SUM(CASE WHEN t.type = 'got' THEN t.amount ELSE -t.amount END) 
          OVER (ORDER BY t.transaction_date ASC, t.created_at ASC, t.id ASC) as runningBalance
      FROM transactions t
      LEFT JOIN parties p ON t.party_id = p.id
      LEFT JOIN categories c ON t.category_id = c.id
    )
    SELECT * FROM RankedTransactions
    WHERE 1=1
  `;
  const params = [];

  if (filterType) {
    sql += ` AND type = ?`;
    params.push(filterType);
  }

  if (filterMode) {
    sql += ` AND paymentMode = ?`;
    params.push(filterMode);
  }

  if (partyId) {
    sql += ` AND partyId = ?`;
    params.push(partyId);
  }

  if (categoryId) {
    sql += ` AND categoryId = ?`;
    params.push(categoryId);
  }

  if (startDate) {
    const startTs = typeof startDate === 'number' ? startDate : toUnixTimestamp(startDate);
    sql += ` AND transactionDate >= ?`;
    params.push(startTs);
  }

  if (endDate) {
    let endTs = typeof endDate === 'number' ? endDate : toUnixTimestamp(endDate);
    if (typeof endDate === 'string' && endDate.length === 10) {
      endTs += 86399; // full end of day
    }
    sql += ` AND transactionDate <= ?`;
    params.push(endTs);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    sql += ` AND (
      partyName LIKE ? OR 
      categoryName LIKE ? OR 
      note LIKE ? OR 
      CAST(amount AS TEXT) LIKE ?
    )`;
    params.push(term, term, term, term);
  }

  sql += ` ORDER BY transactionDate DESC, createdAt DESC, id DESC LIMIT ? OFFSET ?;`;
  params.push(limit, offset);

  const transactions = db.getAllSync(sql, params);

  // Fetch images for transactions in batch
  return transactions.map((tx) => {
    let images = [];
    if (tx.imageCount > 0) {
      images = db.getAllSync(
        'SELECT id, local_uri as localUri, file_name as fileName, upload_status as uploadStatus FROM transaction_images WHERE transaction_id = ?;',
        [tx.id]
      );
    }
    return {
      ...tx,
      images,
    };
  });
};

export const getTransactionById = (id) => {
  const db = getDatabase();
  const sql = `
    WITH RankedTransactions AS (
      SELECT 
        t.id,
        t.uuid,
        t.party_id as partyId,
        t.category_id as categoryId,
        t.type,
        t.payment_mode as paymentMode,
        t.amount,
        t.note,
        t.transaction_date as transactionDate,
        t.created_at as createdAt,
        t.updated_at as updatedAt,
        t.sync_status as syncStatus,
        p.name as partyName,
        p.phone as partyPhone,
        c.name as categoryName,
        c.icon as categoryIcon,
        c.color as categoryColor,
        SUM(CASE WHEN t.type = 'got' THEN t.amount ELSE -t.amount END) 
          OVER (ORDER BY datetime(t.transaction_date) ASC, datetime(t.created_at) ASC, t.id ASC) as runningBalance
      FROM transactions t
      LEFT JOIN parties p ON t.party_id = p.id
      LEFT JOIN categories c ON t.category_id = c.id
    )
    SELECT * FROM RankedTransactions WHERE id = ?;
  `;
  const tx = db.getFirstSync(sql, [id]);
  if (!tx) return null;

  const images = db.getAllSync(
    'SELECT id, local_uri as localUri, file_name as fileName, upload_status as uploadStatus FROM transaction_images WHERE transaction_id = ?;',
    [id]
  );

  return {
    ...tx,
    images: images || [],
  };
};

export const addTransaction = ({
  uuid = null,
  partyId = null,
  categoryId = null,
  type,
  paymentMode,
  amount,
  note = '',
  transactionDate = null,
  images = [],
}) => {
  const db = getDatabase();
  const txUuid = uuid || generateUUID();
  const now = getCurrentTimestamp();
  const txDate = transactionDate ? toUnixTimestamp(transactionDate) : now;
  const numAmount = parseFloat(amount) || 0;

  let insertedId = null;

  db.withTransactionSync(() => {
    const res = db.runSync(
      `INSERT INTO transactions (
        uuid, party_id, category_id, type, payment_mode, amount, note, transaction_date, created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        txUuid,
        partyId || null,
        categoryId || null,
        type,
        paymentMode,
        numAmount,
        note ? note.trim() : '',
        txDate,
        now,
        now,
        'pending',
      ]
    );
    insertedId = res.lastInsertRowId;

    // Insert images
    if (images && images.length > 0) {
      for (const img of images) {
        const uri = typeof img === 'string' ? img : (img.localUri || img.uri);
        const fileName = img.fileName || uri.split('/').pop() || 'photo.jpg';
        db.runSync(
          `INSERT INTO transaction_images (
            transaction_id, transaction_uuid, local_uri, file_name, upload_status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?);`,
          [insertedId, txUuid, uri, fileName, 'pending', now]
        );
      }
    }

    // Add to sync_queue
    const payload = JSON.stringify({
      id: insertedId,
      uuid: txUuid,
      partyId,
      categoryId,
      type,
      paymentMode,
      amount: numAmount,
      note,
      transactionDate: txDate,
      imageCount: images ? images.length : 0,
    });

    db.runSync(
      `INSERT INTO sync_queue (entity_type, entity_uuid, action, payload, created_at, status) 
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['transaction', txUuid, 'create', payload, now, 'pending']
    );
  });

  return getTransactionById(insertedId);
};

export const updateTransaction = (
  id,
  {
    partyId = null,
    categoryId = null,
    type,
    paymentMode,
    amount,
    note = '',
    transactionDate = null,
    images = [],
  }
) => {
  const db = getDatabase();
  const now = getCurrentTimestamp();
  const txDate = transactionDate ? toUnixTimestamp(transactionDate) : null;
  const numAmount = parseFloat(amount) || 0;

  db.withTransactionSync(() => {
    // Get existing transaction uuid
    const existing = db.getFirstSync('SELECT uuid FROM transactions WHERE id = ?;', [id]);
    if (!existing) return;

    const txUuid = existing.uuid;

    db.runSync(
      `UPDATE transactions SET
        party_id = ?,
        category_id = ?,
        type = ?,
        payment_mode = ?,
        amount = ?,
        note = ?,
        transaction_date = COALESCE(?, transaction_date),
        updated_at = ?,
        sync_status = 'pending'
      WHERE id = ?;`,
      [
        partyId || null,
        categoryId || null,
        type,
        paymentMode,
        numAmount,
        note ? note.trim() : '',
        txDate,
        now,
        id,
      ]
    );

    // Sync images
    db.runSync('DELETE FROM transaction_images WHERE transaction_id = ?;', [id]);
    if (images && images.length > 0) {
      for (const img of images) {
        const uri = typeof img === 'string' ? img : (img.localUri || img.uri);
        const fileName = img.fileName || uri.split('/').pop() || 'photo.jpg';
        db.runSync(
          `INSERT INTO transaction_images (
            transaction_id, transaction_uuid, local_uri, file_name, upload_status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?);`,
          [id, txUuid, uri, fileName, 'pending', now]
        );
      }
    }

    // Add update to sync_queue
    const payload = JSON.stringify({
      id,
      uuid: txUuid,
      partyId,
      categoryId,
      type,
      paymentMode,
      amount: numAmount,
      note,
      transactionDate,
    });

    db.runSync(
      `INSERT INTO sync_queue (entity_type, entity_uuid, action, payload, created_at, status) 
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['transaction', txUuid, 'update', payload, now, 'pending']
    );
  });

  return getTransactionById(id);
};

export const deleteTransaction = (id) => {
  const db = getDatabase();
  const now = new Date().toISOString();

  db.withTransactionSync(() => {
    const existing = db.getFirstSync('SELECT uuid FROM transactions WHERE id = ?;', [id]);
    if (!existing) return;

    const txUuid = existing.uuid;

    db.runSync('DELETE FROM transaction_images WHERE transaction_id = ?;', [id]);
    db.runSync('DELETE FROM transactions WHERE id = ?;', [id]);

    db.runSync(
      `INSERT INTO sync_queue (entity_type, entity_uuid, action, payload, created_at, status) 
       VALUES (?, ?, ?, ?, ?, ?);`,
      ['transaction', txUuid, 'delete', JSON.stringify({ id, uuid: txUuid }), now, 'pending']
    );
  });

  return true;
};

// -------------------------------------------------------------
// Parties (Khata)
// -------------------------------------------------------------
export const getParties = ({ search = null } = {}) => {
  const db = getDatabase();

  let sql = `
    SELECT 
      p.id,
      p.name,
      p.phone,
      p.created_at as createdAt,
      p.updated_at as updatedAt,
      COALESCE(SUM(CASE WHEN t.type = 'gave' THEN t.amount ELSE 0 END), 0) as totalGave,
      COALESCE(SUM(CASE WHEN t.type = 'got' THEN t.amount ELSE 0 END), 0) as totalGot,
      (COALESCE(SUM(CASE WHEN t.type = 'gave' THEN t.amount ELSE 0 END), 0) - 
       COALESCE(SUM(CASE WHEN t.type = 'got' THEN t.amount ELSE 0 END), 0)) as netBalance,
      MAX(t.transaction_date) as lastTransactionDate,
      COUNT(t.id) as transactionCount
    FROM parties p
    LEFT JOIN transactions t ON p.id = t.party_id
    WHERE 1=1
  `;
  const params = [];

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    sql += ` AND (p.name LIKE ? OR p.phone LIKE ?)`;
    params.push(term, term);
  }

  sql += ` GROUP BY p.id ORDER BY p.name COLLATE NOCASE ASC;`;

  return db.getAllSync(sql, params);
};

export const getPartyById = (id) => {
  const db = getDatabase();
  const sql = `
    SELECT 
      p.id,
      p.name,
      p.phone,
      p.created_at as createdAt,
      p.updated_at as updatedAt,
      COALESCE(SUM(CASE WHEN t.type = 'gave' THEN t.amount ELSE 0 END), 0) as totalGave,
      COALESCE(SUM(CASE WHEN t.type = 'got' THEN t.amount ELSE 0 END), 0) as totalGot,
      (COALESCE(SUM(CASE WHEN t.type = 'gave' THEN t.amount ELSE 0 END), 0) - 
       COALESCE(SUM(CASE WHEN t.type = 'got' THEN t.amount ELSE 0 END), 0)) as netBalance,
      MAX(t.transaction_date) as lastTransactionDate,
      COUNT(t.id) as transactionCount
    FROM parties p
    LEFT JOIN transactions t ON p.id = t.party_id
    WHERE p.id = ?
    GROUP BY p.id;
  `;
  return db.getFirstSync(sql, [id]);
};

export const addParty = ({ name, phone = '' }) => {
  const db = getDatabase();
  const now = getCurrentTimestamp();
  const res = db.runSync(
    `INSERT INTO parties (name, phone, created_at, updated_at) VALUES (?, ?, ?, ?);`,
    [name.trim(), phone ? phone.trim() : '', now, now]
  );
  return getPartyById(res.lastInsertRowId);
};

export const updateParty = (id, { name, phone = '' }) => {
  const db = getDatabase();
  const now = getCurrentTimestamp();
  db.runSync(
    `UPDATE parties SET name = ?, phone = ?, updated_at = ? WHERE id = ?;`,
    [name.trim(), phone ? phone.trim() : '', now, id]
  );
  return getPartyById(id);
};

export const deleteParty = (id) => {
  const db = getDatabase();
  db.runSync('DELETE FROM parties WHERE id = ?;', [id]);
  return true;
};

// -------------------------------------------------------------
// Categories
// -------------------------------------------------------------
export const getCategories = ({ includeDeleted = false } = {}) => {
  const db = getDatabase();
  let sql = `
    SELECT 
      c.id,
      c.name,
      c.icon,
      c.color,
      c.is_custom as isCustom,
      COALESCE(c.is_deleted, 0) as isDeleted,
      c.created_at as createdAt,
      COUNT(t.id) as usageCount
    FROM categories c
    LEFT JOIN transactions t ON c.id = t.category_id
  `;

  if (!includeDeleted) {
    sql += ` WHERE COALESCE(c.is_deleted, 0) = 0`;
  }

  sql += ` GROUP BY c.id ORDER BY c.is_custom ASC, c.id ASC;`;
  return db.getAllSync(sql);
};

export const addCategory = ({ name, icon = 'grid-outline', color = '#64748B' }) => {
  const db = getDatabase();
  const now = getCurrentTimestamp();
  const cleanName = name.trim();

  // Check if a category with this name already exists (e.g. soft-deleted)
  const existing = db.getFirstSync('SELECT id, is_deleted FROM categories WHERE LOWER(name) = LOWER(?);', [cleanName]);
  if (existing) {
    db.runSync(
      'UPDATE categories SET is_deleted = 0, icon = ?, color = ? WHERE id = ?;',
      [icon, color, existing.id]
    );
    return db.getFirstSync('SELECT * FROM categories WHERE id = ?;', [existing.id]);
  }

  const res = db.runSync(
    `INSERT INTO categories (name, icon, color, is_custom, is_deleted, created_at) VALUES (?, ?, ?, 1, 0, ?);`,
    [cleanName, icon, color, now]
  );
  return db.getFirstSync('SELECT * FROM categories WHERE id = ?;', [res.lastInsertRowId]);
};

export const updateCategory = (id, { name, icon, color }) => {
  const db = getDatabase();
  db.runSync(
    `UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?;`,
    [name.trim(), icon, color, id]
  );
  return db.getFirstSync('SELECT * FROM categories WHERE id = ?;', [id]);
};

// Soft delete category so existing transactions maintain their category details without disruption
export const deleteCategory = (id) => {
  const db = getDatabase();
  db.runSync('UPDATE categories SET is_deleted = 1 WHERE id = ?;', [id]);
  return true;
};

// -------------------------------------------------------------
// Reports Queries
// -------------------------------------------------------------
export const getReportsSummary = (startDate = null, endDate = null) => {
  const db = getDatabase();

  let sql = `
    SELECT
      COALESCE(SUM(CASE WHEN type = 'got' THEN amount ELSE 0 END), 0) as total_got,
      COALESCE(SUM(CASE WHEN type = 'gave' THEN amount ELSE 0 END), 0) as total_gave,
      COALESCE(SUM(CASE WHEN payment_mode = 'cash' AND type = 'got' THEN amount ELSE 0 END), 0) as cash_got,
      COALESCE(SUM(CASE WHEN payment_mode = 'cash' AND type = 'gave' THEN amount ELSE 0 END), 0) as cash_gave,
      COALESCE(SUM(CASE WHEN payment_mode = 'online' AND type = 'got' THEN amount ELSE 0 END), 0) as online_got,
      COALESCE(SUM(CASE WHEN payment_mode = 'online' AND type = 'gave' THEN amount ELSE 0 END), 0) as online_gave,
      COUNT(*) as total_transactions
    FROM transactions
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    const startTs = typeof startDate === 'number' ? startDate : toUnixTimestamp(startDate);
    sql += ` AND transaction_date >= ?`;
    params.push(startTs);
  }

  if (endDate) {
    let endTs = typeof endDate === 'number' ? endDate : toUnixTimestamp(endDate);
    if (typeof endDate === 'string' && endDate.length === 10) {
      endTs += 86399;
    }
    sql += ` AND transaction_date <= ?`;
    params.push(endTs);
  }

  const row = db.getFirstSync(sql, params) || {};

  const totalGot = Number(row.total_got || 0);
  const totalGave = Number(row.total_gave || 0);
  const cashGot = Number(row.cash_got || 0);
  const cashGave = Number(row.cash_gave || 0);
  const onlineGot = Number(row.online_got || 0);
  const onlineGave = Number(row.online_gave || 0);

  return {
    totalGot,
    totalGave,
    netBalance: totalGot - totalGave,
    cashGot,
    cashGave,
    cashBalance: cashGot - cashGave,
    onlineGot,
    onlineGave,
    onlineBalance: onlineGot - onlineGave,
    totalTransactions: Number(row.total_transactions || 0),
  };
};

export const getCategoryBreakdown = (startDate = null, endDate = null, type = 'gave') => {
  const db = getDatabase();

  let sql = `
    SELECT 
      COALESCE(c.name, 'Uncategorized') as categoryName,
      COALESCE(c.icon, 'grid-outline') as categoryIcon,
      COALESCE(c.color, '#64748B') as categoryColor,
      SUM(t.amount) as totalAmount,
      COUNT(t.id) as transactionCount
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.type = ?
  `;
  const params = [type];

  if (startDate) {
    const startTs = typeof startDate === 'number' ? startDate : toUnixTimestamp(startDate);
    sql += ` AND t.transaction_date >= ?`;
    params.push(startTs);
  }

  if (endDate) {
    let endTs = typeof endDate === 'number' ? endDate : toUnixTimestamp(endDate);
    if (typeof endDate === 'string' && endDate.length === 10) {
      endTs += 86399;
    }
    sql += ` AND t.transaction_date <= ?`;
    params.push(endTs);
  }

  sql += ` GROUP BY c.id, c.name, c.icon, c.color ORDER BY totalAmount DESC;`;

  return db.getAllSync(sql, params);
};

// -------------------------------------------------------------
// -------------------------------------------------------------
// Authentication Session Helpers
// -------------------------------------------------------------
export const getAuthSession = () => {
  try {
    const db = getDatabase();
    const tokenRow = db.getFirstSync("SELECT value FROM settings WHERE key = 'auth_token';");
    const userRow = db.getFirstSync("SELECT value FROM settings WHERE key = 'auth_user';");
    const token = tokenRow?.value || null;
    let user = null;
    if (userRow?.value) {
      try {
        user = JSON.parse(userRow.value);
      } catch (e) {
        user = null;
      }
    }
    return { token, user, isLoggedIn: Boolean(token && user) };
  } catch (e) {
    return { token: null, user: null, isLoggedIn: false };
  }
};

export const saveAuthSession = (token, user) => {
  try {
    const db = getDatabase();
    db.withTransactionSync(() => {
      db.runSync(
        "INSERT INTO settings (key, value) VALUES ('auth_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
        [token || '']
      );
      db.runSync(
        "INSERT INTO settings (key, value) VALUES ('auth_user', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
        [JSON.stringify(user || {})]
      );
    });
    return true;
  } catch (e) {
    console.error('Failed to save auth session:', e);
    return false;
  }
};

export const clearAuthSession = () => {
  try {
    const db = getDatabase();
    db.withTransactionSync(() => {
      db.runSync("DELETE FROM settings WHERE key = 'auth_token';");
      db.runSync("DELETE FROM settings WHERE key = 'auth_user';");
    });
    return true;
  } catch (e) {
    console.error('Failed to clear auth session:', e);
    return false;
  }
};

// -------------------------------------------------------------
// Sync & Backup Helpers
// -------------------------------------------------------------
export const getSyncStats = () => {
  const db = getDatabase();
  const pendingCount = db.getFirstSync(
    "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending';"
  )?.count || 0;

  const totalTransactions = db.getFirstSync(
    "SELECT COUNT(*) as count FROM transactions;"
  )?.count || 0;

  const lastSyncSetting = db.getFirstSync(
    "SELECT value FROM settings WHERE key = 'last_sync';"
  )?.value || null;

  return {
    pendingCount: Number(pendingCount),
    totalTransactions: Number(totalTransactions),
    lastSync: lastSyncSetting,
  };
};

export const getDetailedBackupReportStats = () => {
  const db = getDatabase();

  // 1. Transactions breakdown
  const txStats = db.getFirstSync(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN sync_status = 'synced' THEN 1 ELSE 0 END), 0) as synced,
      COALESCE(SUM(CASE WHEN sync_status = 'pending' OR sync_status IS NULL THEN 1 ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN sync_status = 'uploading' THEN 1 ELSE 0 END), 0) as uploading,
      COALESCE(SUM(CASE WHEN sync_status = 'failed' THEN 1 ELSE 0 END), 0) as failed
    FROM transactions;
  `) || { total: 0, synced: 0, pending: 0, uploading: 0, failed: 0 };

  // 2. Images breakdown
  const imgStats = db.getFirstSync(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN upload_status = 'uploaded' THEN 1 ELSE 0 END), 0) as uploaded,
      COALESCE(SUM(CASE WHEN upload_status = 'pending' OR upload_status IS NULL THEN 1 ELSE 0 END), 0) as pending,
      COALESCE(SUM(CASE WHEN upload_status = 'uploading' THEN 1 ELSE 0 END), 0) as uploading,
      COALESCE(SUM(CASE WHEN upload_status = 'failed' THEN 1 ELSE 0 END), 0) as failed
    FROM transaction_images;
  `) || { total: 0, uploaded: 0, pending: 0, uploading: 0, failed: 0 };

  // 3. Settings & Timestamps
  const settingsRows = db.getAllSync("SELECT key, value FROM settings;");
  const settingsMap = {};
  for (const s of settingsRows) {
    settingsMap[s.key] = s.value;
  }

  // 4. Sync Queue Pending Count
  const queuePending = db.getFirstSync(
    "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending';"
  )?.count || 0;

  return {
    transactions: {
      total: Number(txStats.total || 0),
      synced: Number(txStats.synced || 0),
      uploaded: Number(txStats.synced || 0),
      pending: Number(txStats.pending || 0),
      uploading: Number(txStats.uploading || 0),
      failed: Number(txStats.failed || 0),
      lastSync: settingsMap['last_sync'] || null,
      lastFailedSync: settingsMap['last_failed_sync'] || null,
    },
    images: {
      total: Number(imgStats.total || 0),
      uploaded: Number(imgStats.uploaded || 0),
      pending: Number(imgStats.pending || 0),
      uploading: Number(imgStats.uploading || 0),
      failed: Number(imgStats.failed || 0),
      lastSync: settingsMap['last_image_sync'] || null,
      scheduleTime: settingsMap['image_backup_time'] || '02:00',
      scheduleEnabled: settingsMap['image_backup_enabled'] !== '0',
    },
    system: {
      autoSyncEnabled: settingsMap['auto_sync_enabled'] !== '0',
      queuePending: Number(queuePending || 0),
    },
  };
};

// Activity Logs CRUD
export const addBackupActivityLog = (actionType, status, message, details = '') => {
  try {
    const db = getDatabase();
    const now = getCurrentTimestamp();
    db.runSync(
      `INSERT INTO backup_activity_logs (timestamp, action_type, status, message, details) VALUES (?, ?, ?, ?, ?);`,
      [now, actionType, status, message, details ? String(details) : '']
    );

    // Maintain max 50 recent logs
    db.runSync(`
      DELETE FROM backup_activity_logs WHERE id NOT IN (
        SELECT id FROM backup_activity_logs ORDER BY id DESC LIMIT 50
      );
    `);
  } catch (err) {
    console.warn('Failed to insert backup activity log:', err);
  }
};

export const getBackupActivityLogs = (limit = 20) => {
  try {
    const db = getDatabase();
    return db.getAllSync(
      `SELECT * FROM backup_activity_logs ORDER BY id DESC LIMIT ?;`,
      [limit]
    );
  } catch (err) {
    return [];
  }
};

export const getSetting = (key, defaultValue = '') => {
  const db = getDatabase();
  const row = db.getFirstSync("SELECT value FROM settings WHERE key = ?;", [key]);
  return row ? row.value : defaultValue;
};

export const updateSetting = (key, value) => {
  const db = getDatabase();
  db.runSync(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
    [key, String(value)]
  );
};

export const markTransactionsUploading = (uuids = []) => {
  const db = getDatabase();
  if (!uuids || uuids.length === 0) {
    db.runSync("UPDATE transactions SET sync_status = 'uploading' WHERE sync_status = 'pending';");
  } else {
    for (const uuid of uuids) {
      db.runSync("UPDATE transactions SET sync_status = 'uploading' WHERE uuid = ?;", [uuid]);
    }
  }
};

export const markTransactionsFailed = (uuids = []) => {
  const db = getDatabase();
  const now = getCurrentTimestamp();
  if (!uuids || uuids.length === 0) {
    db.runSync("UPDATE transactions SET sync_status = 'failed' WHERE sync_status = 'uploading';");
  } else {
    for (const uuid of uuids) {
      db.runSync("UPDATE transactions SET sync_status = 'failed' WHERE uuid = ?;", [uuid]);
    }
  }
  db.runSync("INSERT INTO settings (key, value) VALUES ('last_failed_sync', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;", [String(now)]);
};

/**
 * Marks transactions as uploaded ONLY AFTER server returns confirmed saved status and server IDs.
 */
export const markTransactionsServerConfirmed = (confirmedRecords = []) => {
  const db = getDatabase();
  const now = getCurrentTimestamp();

  db.withTransactionSync(() => {
    if (confirmedRecords.length === 0) {
      db.runSync("UPDATE sync_queue SET status = 'synced' WHERE status = 'pending';");
      db.runSync("UPDATE transactions SET sync_status = 'synced', server_synced_at = ? WHERE sync_status = 'pending' OR sync_status = 'uploading';", [now]);
    } else {
      for (const rec of confirmedRecords) {
        db.runSync(
          "UPDATE transactions SET sync_status = 'synced', server_id = ?, server_synced_at = ? WHERE uuid = ?;",
          [rec.server_id || null, now, rec.uuid]
        );
        db.runSync(
          "UPDATE sync_queue SET status = 'synced' WHERE entity_uuid = ?;",
          [rec.uuid]
        );
      }
    }
    db.runSync("INSERT INTO settings (key, value) VALUES ('last_sync', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;", [String(now)]);
  });
};

export const markSyncQueueComplete = () => {
  markTransactionsServerConfirmed([]);
};

export const markImagesUploading = (ids = []) => {
  const db = getDatabase();
  if (!ids || ids.length === 0) {
    db.runSync("UPDATE transaction_images SET upload_status = 'uploading' WHERE upload_status = 'pending';");
  } else {
    for (const id of ids) {
      db.runSync("UPDATE transaction_images SET upload_status = 'uploading' WHERE id = ?;", [id]);
    }
  }
};

export const markImagesFailed = (ids = []) => {
  const db = getDatabase();
  if (!ids || ids.length === 0) {
    db.runSync("UPDATE transaction_images SET upload_status = 'failed' WHERE upload_status = 'uploading';");
  } else {
    for (const id of ids) {
      db.runSync("UPDATE transaction_images SET upload_status = 'failed' WHERE id = ?;", [id]);
    }
  }
};

/**
 * Marks images as uploaded ONLY AFTER server returns confirmed saved status and server IDs.
 */
export const markImagesServerConfirmed = (confirmedImages = []) => {
  const db = getDatabase();
  const now = getCurrentTimestamp();

  db.withTransactionSync(() => {
    if (confirmedImages.length === 0) {
      db.runSync("UPDATE transaction_images SET upload_status = 'uploaded', server_synced_at = ? WHERE upload_status = 'pending' OR upload_status = 'uploading' OR upload_status = 'failed';", [now]);
    } else {
      for (const img of confirmedImages) {
        db.runSync(
          "UPDATE transaction_images SET upload_status = 'uploaded', server_id = ?, server_synced_at = ? WHERE id = ? OR transaction_uuid = ?;",
          [img.server_id || null, now, img.id || null, img.transaction_uuid || '']
        );
      }
    }
    db.runSync("INSERT INTO settings (key, value) VALUES ('last_image_sync', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;", [String(now)]);
  });
};

export const markAllImagesUploaded = () => {
  markImagesServerConfirmed([]);
};

export const getPendingTransactions = (limit = 50) => {
  const db = getDatabase();
  return db.getAllSync(`
    SELECT t.*, p.name as party_name, c.name as category_name
    FROM transactions t
    LEFT JOIN parties p ON t.party_id = p.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.sync_status = 'pending' OR t.sync_status = 'uploading' OR t.sync_status = 'failed' OR t.sync_status IS NULL
    ORDER BY t.created_at ASC, t.id ASC
    LIMIT ?;
  `, [limit]);
};

export const getPendingImages = (limit = 10) => {
  const db = getDatabase();
  return db.getAllSync(`
    SELECT *
    FROM transaction_images
    WHERE upload_status = 'pending' OR upload_status = 'uploading' OR upload_status = 'failed' OR upload_status IS NULL
    ORDER BY id ASC
    LIMIT ?;
  `, [limit]);
};

export const exportAllData = () => {
  const db = getDatabase();
  const transactions = db.getAllSync(`
    SELECT t.*, p.name as party_name, c.name as category_name 
    FROM transactions t 
    LEFT JOIN parties p ON t.party_id = p.id 
    LEFT JOIN categories c ON t.category_id = c.id;
  `);
  const parties = db.getAllSync('SELECT * FROM parties;');
  const categories = db.getAllSync('SELECT * FROM categories;');
  const images = db.getAllSync('SELECT * FROM transaction_images;');

  return {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    transactions,
    parties,
    categories,
    images,
  };
};

/**
 * Erases local SQLite tables and cached data ONLY.
 * Does NOT generate deletion queue items to server, preserving server-side backups!
 */
export const eraseLocalDeviceDataOnly = () => {
  const db = getDatabase();
  
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM transaction_images;');
    db.runSync('DELETE FROM sync_queue;');
    db.runSync('DELETE FROM transactions;');
    db.runSync('DELETE FROM parties;');
    db.runSync('DELETE FROM categories WHERE is_custom = 1;');
    db.runSync("UPDATE categories SET is_deleted = 0;");
    db.runSync("UPDATE settings SET value = '' WHERE key = 'last_sync';");
    db.runSync("UPDATE settings SET value = '' WHERE key = 'last_image_sync';");
  });
  return true;
};

export const wipeAndResetDatabase = () => {
  return eraseLocalDeviceDataOnly();
};
