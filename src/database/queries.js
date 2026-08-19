import { getDatabase } from './db';

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
  const todayStr = new Date().toISOString().split('T')[0];
  
  const query = `
    SELECT
      COALESCE(SUM(CASE WHEN payment_mode = 'cash' AND type = 'got' THEN amount ELSE 0 END), 0) as cash_got,
      COALESCE(SUM(CASE WHEN payment_mode = 'cash' AND type = 'gave' THEN amount ELSE 0 END), 0) as cash_gave,
      COALESCE(SUM(CASE WHEN payment_mode = 'online' AND type = 'got' THEN amount ELSE 0 END), 0) as online_got,
      COALESCE(SUM(CASE WHEN payment_mode = 'online' AND type = 'gave' THEN amount ELSE 0 END), 0) as online_gave,
      COALESCE(SUM(CASE WHEN type = 'got' THEN amount ELSE 0 END), 0) as total_got,
      COALESCE(SUM(CASE WHEN type = 'gave' THEN amount ELSE 0 END), 0) as total_gave,
      COALESCE(SUM(CASE WHEN type = 'got' AND date(transaction_date) = date(?) THEN amount ELSE 0 END), 0) as today_got,
      COALESCE(SUM(CASE WHEN type = 'gave' AND date(transaction_date) = date(?) THEN amount ELSE 0 END), 0) as today_gave
    FROM transactions;
  `;

  const row = db.getFirstSync(query, [todayStr, todayStr]) || {
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
  startDate = null,       // YYYY-MM-DD
  endDate = null,         // YYYY-MM-DD
  search = null,          // search string
  partyId = null,
  categoryId = null,
} = {}) => {
  const db = getDatabase();

  let sql = `
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
      (SELECT COUNT(*) FROM transaction_images ti WHERE ti.transaction_id = t.id) as imageCount
    FROM transactions t
    LEFT JOIN parties p ON t.party_id = p.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (filterType) {
    sql += ` AND t.type = ?`;
    params.push(filterType);
  }

  if (filterMode) {
    sql += ` AND t.payment_mode = ?`;
    params.push(filterMode);
  }

  if (partyId) {
    sql += ` AND t.party_id = ?`;
    params.push(partyId);
  }

  if (categoryId) {
    sql += ` AND t.category_id = ?`;
    params.push(categoryId);
  }

  if (startDate) {
    sql += ` AND date(t.transaction_date) >= date(?)`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND date(t.transaction_date) <= date(?)`;
    params.push(endDate);
  }

  if (search && search.trim().length > 0) {
    const term = `%${search.trim()}%`;
    sql += ` AND (
      p.name LIKE ? OR 
      c.name LIKE ? OR 
      t.note LIKE ? OR 
      CAST(t.amount AS TEXT) LIKE ?
    )`;
    params.push(term, term, term, term);
  }

  sql += ` ORDER BY datetime(t.transaction_date) DESC, t.id DESC`;

  if (limit) {
    sql += ` LIMIT ? OFFSET ?`;
    params.push(limit, offset);
  }

  return db.getAllSync(sql, params);
};

export const getTransactionById = (id) => {
  const db = getDatabase();
  const sql = `
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
      c.color as categoryColor
    FROM transactions t
    LEFT JOIN parties p ON t.party_id = p.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?;
  `;
  const transaction = db.getFirstSync(sql, [id]);
  if (!transaction) return null;

  // Get attached images
  const images = db.getAllSync(
    `SELECT id, transaction_id, transaction_uuid, local_uri as localUri, file_name as fileName, upload_status as uploadStatus, created_at as createdAt 
     FROM transaction_images 
     WHERE transaction_id = ? ORDER BY id ASC;`,
    [id]
  );

  return {
    ...transaction,
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
  const now = new Date().toISOString();
  const txDate = transactionDate || now;
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
  const now = new Date().toISOString();
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
        transactionDate,
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
  const now = new Date().toISOString();
  const res = db.runSync(
    `INSERT INTO parties (name, phone, created_at, updated_at) VALUES (?, ?, ?, ?);`,
    [name.trim(), phone ? phone.trim() : '', now, now]
  );
  return getPartyById(res.lastInsertRowId);
};

export const updateParty = (id, { name, phone = '' }) => {
  const db = getDatabase();
  const now = new Date().toISOString();
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
  const now = new Date().toISOString();
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
    sql += ` AND date(transaction_date) >= date(?)`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND date(transaction_date) <= date(?)`;
    params.push(endDate);
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
    sql += ` AND date(t.transaction_date) >= date(?)`;
    params.push(startDate);
  }

  if (endDate) {
    sql += ` AND date(t.transaction_date) <= date(?)`;
    params.push(endDate);
  }

  sql += ` GROUP BY c.id, c.name, c.icon, c.color ORDER BY totalAmount DESC;`;

  return db.getAllSync(sql, params);
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

export const markSyncQueueComplete = () => {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.runSync("UPDATE sync_queue SET status = 'synced' WHERE status = 'pending';");
  db.runSync("UPDATE transactions SET sync_status = 'synced' WHERE sync_status = 'pending';");
  db.runSync("INSERT OR REPLACE INTO settings (key, value) VALUES ('last_sync', ?);", [now]);
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

export const wipeAndResetDatabase = () => {
  const db = getDatabase();
  db.execSync(`
    DELETE FROM transaction_images;
    DELETE FROM sync_queue;
    DELETE FROM transactions;
    DELETE FROM parties;
    DELETE FROM categories WHERE is_custom = 1;
    UPDATE settings SET value = '' WHERE key = 'last_sync';
  `);
};
