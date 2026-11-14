import { getDatabase } from './db';
import { getCurrentTimestamp, toUnixTimestamp } from '../utils/formatters';
import { DEFAULT_CATEGORIES } from '../constants/categories';
import { DEFAULT_CURRENCY, findCurrencyByCodeOrNo } from '../constants/currencies';

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
  includeImages = false,
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
        (CASE 
          WHEN typeof(t.transaction_date) = 'integer' OR (typeof(t.transaction_date) = 'text' AND t.transaction_date GLOB '[0-9]*' AND length(t.transaction_date) <= 12) 
            THEN date(t.transaction_date, 'unixepoch', 'localtime') 
          ELSE date(t.transaction_date) 
        END) as txDateOnly,
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
          OVER (
            ORDER BY 
              (CASE 
                WHEN typeof(t.transaction_date) = 'integer' OR (typeof(t.transaction_date) = 'text' AND t.transaction_date GLOB '[0-9]*' AND length(t.transaction_date) <= 12) 
                  THEN date(t.transaction_date, 'unixepoch', 'localtime') 
                ELSE date(t.transaction_date) 
              END) ASC, 
              t.transaction_date ASC,
              t.created_at ASC, 
              t.id ASC
          ) as runningBalance
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

  sql += ` ORDER BY txDateOnly DESC, transactionDate DESC, createdAt DESC, id DESC LIMIT ? OFFSET ?;`;
  params.push(limit, offset);

  const transactions = db.getAllSync(sql, params);

  if (!includeImages) {
    return transactions.map((tx) => ({
      ...tx,
      images: [],
    }));
  }

  // Fetch images for transactions in batch when requested
  return transactions.map((tx) => {
    let images = [];
    if (tx.imageCount > 0) {
      images = db.getAllSync(
        'SELECT id, local_uri as localUri, server_url as serverUrl, file_name as fileName, upload_status as uploadStatus FROM transaction_images WHERE transaction_id = ? OR transaction_uuid = ?;',
        [tx.id, tx.uuid || '']
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
        (CASE 
          WHEN typeof(t.transaction_date) = 'integer' OR (typeof(t.transaction_date) = 'text' AND t.transaction_date GLOB '[0-9]*' AND length(t.transaction_date) <= 12) 
            THEN date(t.transaction_date, 'unixepoch', 'localtime') 
          ELSE date(t.transaction_date) 
        END) as txDateOnly,
        t.created_at as createdAt,
        t.updated_at as updatedAt,
        t.sync_status as syncStatus,
        p.name as partyName,
        p.phone as partyPhone,
        c.name as categoryName,
        c.icon as categoryIcon,
        c.color as categoryColor,
        SUM(CASE WHEN t.type = 'got' THEN t.amount ELSE -t.amount END) 
          OVER (
            ORDER BY 
              (CASE 
                WHEN typeof(t.transaction_date) = 'integer' OR (typeof(t.transaction_date) = 'text' AND t.transaction_date GLOB '[0-9]*' AND length(t.transaction_date) <= 12) 
                  THEN date(t.transaction_date, 'unixepoch', 'localtime') 
                ELSE date(t.transaction_date) 
              END) ASC, 
              t.transaction_date ASC,
              t.created_at ASC, 
              t.id ASC
          ) as runningBalance
      FROM transactions t
      LEFT JOIN parties p ON t.party_id = p.id
      LEFT JOIN categories c ON t.category_id = c.id
    )
    SELECT * FROM RankedTransactions WHERE id = ?;
  `;
  const tx = db.getFirstSync(sql, [id]);
  if (!tx) return null;

  const images = db.getAllSync(
    'SELECT id, local_uri as localUri, server_url as serverUrl, file_name as fileName, upload_status as uploadStatus FROM transaction_images WHERE transaction_id = ? OR transaction_uuid = ?;',
    [id, tx.uuid || '']
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
  const cleanType = (type === 'gave' || type === 'give' || type === 'debit') ? 'gave' : 'got';
  const cleanMode = (paymentMode === 'online' || paymentMode === 'Online') ? 'online' : 'cash';

  let validPartyId = null;
  if (partyId && Number(partyId) > 0) {
    try {
      const pCheck = db.getFirstSync('SELECT id FROM parties WHERE id = ?;', [Number(partyId)]);
      if (pCheck) validPartyId = pCheck.id;
    } catch (e) {}
  }

  let validCategoryId = null;
  if (categoryId && Number(categoryId) > 0) {
    try {
      const cCheck = db.getFirstSync('SELECT id FROM categories WHERE id = ?;', [Number(categoryId)]);
      if (cCheck) validCategoryId = cCheck.id;
    } catch (e) {}
  }

  let insertedId = null;

  db.withTransactionSync(() => {
    const res = db.runSync(
      `INSERT INTO transactions (
        uuid, party_id, category_id, type, payment_mode, amount, note, transaction_date, created_at, updated_at, sync_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        txUuid,
        validPartyId,
        validCategoryId,
        cleanType,
        cleanMode,
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
        if (!img) continue;
        const uri = typeof img === 'string' ? img : (img.localUri || img.uri);
        if (!uri) continue;
        const fileName = img.fileName || uri.split('/').pop() || 'photo.jpg';
        db.runSync(
          `INSERT INTO transaction_images (
            transaction_id, transaction_uuid, local_uri, file_name, upload_status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?);`,
          [insertedId, txUuid, uri, fileName, 'pending', now]
        );
      }
    }

    // Add to sync_queue with full column compatibility
    const payload = JSON.stringify({
      id: insertedId,
      uuid: txUuid,
      partyId: validPartyId,
      categoryId: validCategoryId,
      type: cleanType,
      paymentMode: cleanMode,
      amount: numAmount,
      note: note ? note.trim() : '',
      transactionDate: txDate,
      imageCount: images ? images.length : 0,
    });

    try {
      db.runSync(
        `INSERT INTO sync_queue (
          entity_type, entity_uuid, table_name, record_uuid, action, payload, retry_count, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        ['transaction', txUuid, 'transactions', txUuid, 'create', payload, 0, 'pending', now]
      );
    } catch (qErr) {
      console.warn('sync_queue insert fallback:', qErr);
      try {
        db.runSync(
          `INSERT INTO sync_queue (action, table_name, record_uuid, payload, retry_count, created_at) VALUES (?, ?, ?, ?, 0, ?);`,
          ['create', 'transactions', txUuid, payload, now]
        );
      } catch (qErr2) {}
    }
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
  const cleanType = (type === 'gave' || type === 'give' || type === 'debit') ? 'gave' : 'got';
  const cleanMode = (paymentMode === 'online' || paymentMode === 'Online') ? 'online' : 'cash';

  let validPartyId = null;
  if (partyId && Number(partyId) > 0) {
    try {
      const pCheck = db.getFirstSync('SELECT id FROM parties WHERE id = ?;', [Number(partyId)]);
      if (pCheck) validPartyId = pCheck.id;
    } catch (e) {}
  }

  let validCategoryId = null;
  if (categoryId && Number(categoryId) > 0) {
    try {
      const cCheck = db.getFirstSync('SELECT id FROM categories WHERE id = ?;', [Number(categoryId)]);
      if (cCheck) validCategoryId = cCheck.id;
    } catch (e) {}
  }

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
        validPartyId,
        validCategoryId,
        cleanType,
        cleanMode,
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
        if (!img) continue;
        const uri = typeof img === 'string' ? img : (img.localUri || img.uri);
        if (!uri) continue;
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
      partyId: validPartyId,
      categoryId: validCategoryId,
      type: cleanType,
      paymentMode: cleanMode,
      amount: numAmount,
      note: note ? note.trim() : '',
      transactionDate: txDate,
    });

    try {
      db.runSync(
        `INSERT INTO sync_queue (
          entity_type, entity_uuid, table_name, record_uuid, action, payload, retry_count, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        ['transaction', txUuid, 'transactions', txUuid, 'update', payload, 0, 'pending', now]
      );
    } catch (qErr) {
      try {
        db.runSync(
          `INSERT INTO sync_queue (action, table_name, record_uuid, payload, retry_count, created_at) VALUES (?, ?, ?, ?, 0, ?);`,
          ['update', 'transactions', txUuid, payload, now]
        );
      } catch (qErr2) {}
    }
  });

  return getTransactionById(id);
};

export const deleteTransaction = (id) => {
  const db = getDatabase();
  const now = getCurrentTimestamp();

  db.withTransactionSync(() => {
    const existing = db.getFirstSync('SELECT uuid FROM transactions WHERE id = ?;', [id]);
    if (!existing) return;

    const txUuid = existing.uuid;

    db.runSync('DELETE FROM transaction_images WHERE transaction_id = ?;', [id]);
    db.runSync('DELETE FROM transactions WHERE id = ?;', [id]);

    const payload = JSON.stringify({ id, uuid: txUuid });
    try {
      db.runSync(
        `INSERT INTO sync_queue (
          entity_type, entity_uuid, table_name, record_uuid, action, payload, retry_count, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        ['transaction', txUuid, 'transactions', txUuid, 'delete', payload, 0, 'pending', now]
      );
    } catch (qErr) {
      try {
        db.runSync(
          `INSERT INTO sync_queue (action, table_name, record_uuid, payload, retry_count, created_at) VALUES (?, ?, ?, ?, 0, ?);`,
          ['delete', 'transactions', txUuid, payload, now]
        );
      } catch (qErr2) {}
    }
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
      COALESCE(c.sort_order, c.id) as sortOrder,
      COUNT(t.id) as usageCount
    FROM categories c
    LEFT JOIN transactions t ON c.id = t.category_id
  `;

  if (!includeDeleted) {
    sql += ` WHERE COALESCE(c.is_deleted, 0) = 0`;
  }

  sql += ` GROUP BY c.id ORDER BY COALESCE(c.sort_order, c.id) ASC, c.id ASC;`;
  return db.getAllSync(sql);
};

export const updateCategoriesOrder = (orderedIds = []) => {
  if (!orderedIds || !orderedIds.length) return true;
  const db = getDatabase();
  const now = getCurrentTimestamp();
  db.withTransactionSync(() => {
    orderedIds.forEach((id, index) => {
      db.runSync(
        'UPDATE categories SET sort_order = ?, updated_at = ? WHERE id = ?;',
        [index + 1, now, id]
      );
    });
  });
  return true;
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

  const maxOrder = db.getFirstSync('SELECT MAX(COALESCE(sort_order, id)) as maxOrder FROM categories;')?.maxOrder || 0;
  const newOrder = Number(maxOrder) + 1;

  const res = db.runSync(
    `INSERT INTO categories (name, icon, color, is_custom, is_deleted, sort_order, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?, ?);`,
    [cleanName, icon, color, newOrder, now, now]
  );
  return db.getFirstSync('SELECT * FROM categories WHERE id = ?;', [res.lastInsertRowId]);
};

export const updateCategory = (id, { name, icon, color }) => {
  const db = getDatabase();
  const now = getCurrentTimestamp();
  db.runSync(
    `UPDATE categories SET name = ?, icon = ?, color = ?, updated_at = ? WHERE id = ?;`,
    [name.trim(), icon, color, now, id]
  );
  return db.getFirstSync('SELECT * FROM categories WHERE id = ?;', [id]);
};

// Soft delete category so existing transactions maintain their category details without disruption
export const deleteCategory = (id) => {
  const db = getDatabase();
  db.runSync('UPDATE categories SET is_deleted = 1 WHERE id = ?;', [id]);
  // Also remove any budget associated with this deleted category so total budget updates
  try {
    setCategoryBudget(id, 0);
  } catch (e) {}
  return true;
};

/**
 * Resets/Restores default categories to their original structure & names
 * without disrupting existing transactions or deleting user custom categories.
 */
export const resetCategoriesToDefault = () => {
  const db = getDatabase();
  const now = getCurrentTimestamp();

  db.withTransactionSync(() => {
    // 1. For each default category from DEFAULT_CATEGORIES
    DEFAULT_CATEGORIES.forEach((def, index) => {
      const existing = db.getFirstSync(
        'SELECT id FROM categories WHERE id = ? OR LOWER(name) = LOWER(?);',
        [def.id, def.name]
      );

      if (existing) {
        db.runSync(
          `UPDATE categories SET 
            name = ?, 
            icon = ?, 
            color = ?, 
            is_custom = 0, 
            is_deleted = 0, 
            is_default = 1, 
            is_active = 1, 
            sort_order = ?,
            updated_at = ? 
           WHERE id = ?;`,
          [def.name, def.icon, def.color, index + 1, now, existing.id]
        );
      } else {
        db.runSync(
          `INSERT INTO categories (id, name, icon, color, is_custom, is_deleted, is_default, is_active, sort_order, created_at, updated_at, sync_status)
           VALUES (?, ?, ?, ?, 0, 0, 1, 1, ?, ?, ?, 'synced');`,
          [def.id, def.name, def.icon, def.color, index + 1, now, now]
        );
      }
    });
  });

  return getCategories();
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

  const lastFullBackupSetting = db.getFirstSync(
    "SELECT value FROM settings WHERE key = 'last_full_backup';"
  )?.value || lastSyncSetting || null;

  const pendingImagesCount = db.getFirstSync(
    "SELECT COUNT(*) as count FROM transaction_images WHERE upload_status = 'pending' OR upload_status = 'uploading' OR upload_status = 'failed' OR upload_status IS NULL;"
  )?.count || 0;

  return {
    pendingCount: Number(pendingCount),
    pendingImagesCount: Number(pendingImagesCount),
    totalTransactions: Number(totalTransactions),
    lastSync: lastSyncSetting,
    lastFullBackup: lastFullBackupSetting,
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
      lastFullBackup: settingsMap['last_full_backup'] || settingsMap['last_sync'] || null,
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
      lastFullBackup: settingsMap['last_full_backup'] || settingsMap['last_sync'] || null,
    },
  };
};

// Activity Logs CRUD
export const addBackupActivityLog = (actionType, status, message, details = '') => {
  try {
    const db = getDatabase();
    const now = getCurrentTimestamp();

    // Ensure table columns exist
    try {
      const cols = db.getAllSync("PRAGMA table_info('backup_activity_logs');");
      const names = cols.map((c) => c.name);
      if (!names.includes('type')) {
        try { db.execSync('ALTER TABLE backup_activity_logs ADD COLUMN type TEXT;'); } catch (e) {}
      }
      if (!names.includes('action_type')) {
        try { db.execSync('ALTER TABLE backup_activity_logs ADD COLUMN action_type TEXT;'); } catch (e) {}
      }
      if (!names.includes('timestamp')) {
        try { db.execSync('ALTER TABLE backup_activity_logs ADD COLUMN timestamp TEXT;'); } catch (e) {}
      }
      if (!names.includes('details')) {
        try { db.execSync('ALTER TABLE backup_activity_logs ADD COLUMN details TEXT;'); } catch (e) {}
      }
      if (!names.includes('created_at')) {
        try { db.execSync('ALTER TABLE backup_activity_logs ADD COLUMN created_at INTEGER;'); } catch (e) {}
      }
    } catch (colErr) {}

    try {
      db.runSync(
        `INSERT INTO backup_activity_logs (
          timestamp, action_type, type, status, message, details, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [now, actionType, actionType, status, message, details ? String(details) : '', now]
      );
    } catch (insertErr) {
      try {
        db.runSync(
          `INSERT INTO backup_activity_logs (timestamp, action_type, status, message, details) VALUES (?, ?, ?, ?, ?);`,
          [now, actionType, status, message, details ? String(details) : '']
        );
      } catch (e2) {
        try {
          db.runSync(
            `INSERT INTO backup_activity_logs (action_type, status, message) VALUES (?, ?, ?);`,
            [actionType, status, message]
          );
        } catch (e3) {
          try {
            db.runSync(
              `INSERT INTO backup_activity_logs (status, message) VALUES (?, ?);`,
              [status, message]
            );
          } catch (e4) {}
        }
      }
    }

    // Maintain max 50 recent logs
    try {
      db.runSync(`
        DELETE FROM backup_activity_logs WHERE id NOT IN (
          SELECT id FROM backup_activity_logs ORDER BY id DESC LIMIT 50
        );
      `);
    } catch (delErr) {}
  } catch (err) {
    console.warn('Failed to insert backup activity log:', err);
  }
};

export const getBackupActivityLogs = (limit = 50) => {
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

export const clearBackupActivityLogs = () => {
  try {
    const db = getDatabase();
    db.runSync('DELETE FROM backup_activity_logs;');
    return true;
  } catch (err) {
    console.warn('Failed to clear backup activity logs:', err);
    return false;
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

export const getAppCurrency = () => {
  try {
    const raw = getSetting('app_currency');
    if (!raw) return DEFAULT_CURRENCY;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.symbol) return DEFAULT_CURRENCY;
    return findCurrencyByCodeOrNo(parsed.code || parsed.name || parsed.no);
  } catch (e) {
    return DEFAULT_CURRENCY;
  }
};

export const updateAppCurrency = (currency) => {
  try {
    if (!currency || !currency.symbol) return DEFAULT_CURRENCY;
    const clean = {
      no: currency.no,
      name: currency.name,
      code: currency.code,
      symbol: currency.symbol,
      flag: currency.flag,
    };
    updateSetting('app_currency', JSON.stringify(clean));
    return clean;
  } catch (e) {
    console.error('Failed to update app currency setting:', e);
    return DEFAULT_CURRENCY;
  }
};

export const DEFAULT_BACKUP_SETTINGS = {
  autoBackupEnabled: true,
  backupIntervalMinutes: 1440, // 24 hours
  hideDetailedInfoMinutes: 60, // 60 minutes
  keepBackupsCount: 7, // keep 7 backups
  backupLocation: '',
  lastBackupStatus: 'idle', // 'success' | 'failed' | 'in_progress' | 'idle'
  lastSuccessfulBackup: null,
  lastFailedBackup: null,
  lastBackupError: null,
  lastBackupSize: 0,
  backupStartedAt: null,
  backupCompletedAt: null,
  nextScheduledBackup: null,
};

export const getBackupSettings = () => {
  try {
    const db = getDatabase();
    const rows = db.getAllSync("SELECT key, value FROM settings;");
    const map = {};
    for (const r of rows) {
      map[r.key] = r.value;
    }

    const autoBackupEnabled = map['auto_backup_enabled'] !== '0';
    const backupIntervalMinutes = Math.max(5, parseInt(map['backup_interval_minutes'], 10) || 1440);
    const hideDetailedInfoMinutes = Math.max(1, parseInt(map['hide_detailed_info_minutes'], 10) || 60);
    const keepBackupsCount = Math.max(1, parseInt(map['keep_backups_count'], 10) || 7);
    const rawLoc = map['backup_location'] || '';
    const backupLocation = rawLoc.includes('gmsexpense.tplpro.in') ? '' : rawLoc;
    const lastBackupStatus = map['last_backup_status'] || (map['last_full_backup'] || map['last_sync'] ? 'success' : 'idle');
    const lastSuccessfulBackup = map['last_successful_backup'] || map['last_full_backup'] || map['last_sync'] || null;
    const lastFailedBackup = map['last_failed_backup'] || map['last_failed_sync'] || null;
    const lastBackupError = map['last_backup_error'] || null;
    const lastBackupSize = parseInt(map['last_backup_size'], 10) || 0;
    const backupStartedAt = map['backup_started_at'] || null;
    const backupCompletedAt = map['backup_completed_at'] || null;

    let nextScheduledBackup = null;
    if (autoBackupEnabled && lastSuccessfulBackup) {
      nextScheduledBackup = Number(lastSuccessfulBackup) + (backupIntervalMinutes * 60);
    }

    return {
      autoBackupEnabled,
      backupIntervalMinutes,
      hideDetailedInfoMinutes,
      keepBackupsCount,
      backupLocation,
      lastBackupStatus,
      lastSuccessfulBackup: lastSuccessfulBackup ? Number(lastSuccessfulBackup) : null,
      lastFailedBackup: lastFailedBackup ? Number(lastFailedBackup) : null,
      lastBackupError,
      lastBackupSize,
      backupStartedAt: backupStartedAt ? Number(backupStartedAt) : null,
      backupCompletedAt: backupCompletedAt ? Number(backupCompletedAt) : null,
      nextScheduledBackup,
    };
  } catch (err) {
    console.warn('Error reading backup settings:', err);
    return { ...DEFAULT_BACKUP_SETTINGS };
  }
};

export const updateBackupSettings = (newSettings = {}) => {
  const db = getDatabase();
  db.withTransactionSync(() => {
    if (newSettings.autoBackupEnabled !== undefined) {
      updateSetting('auto_backup_enabled', newSettings.autoBackupEnabled ? '1' : '0');
    }
    if (newSettings.backupIntervalMinutes !== undefined) {
      const mins = Math.max(5, parseInt(newSettings.backupIntervalMinutes, 10) || 1440);
      updateSetting('backup_interval_minutes', String(mins));
    }
    if (newSettings.hideDetailedInfoMinutes !== undefined) {
      const mins = Math.max(1, parseInt(newSettings.hideDetailedInfoMinutes, 10) || 60);
      updateSetting('hide_detailed_info_minutes', String(mins));
    }
    if (newSettings.keepBackupsCount !== undefined) {
      const cnt = Math.max(1, parseInt(newSettings.keepBackupsCount, 10) || 7);
      updateSetting('keep_backups_count', String(cnt));
    }
    if (newSettings.backupLocation !== undefined) {
      updateSetting('backup_location', String(newSettings.backupLocation).trim());
    }
    if (newSettings.lastBackupStatus !== undefined) {
      updateSetting('last_backup_status', String(newSettings.lastBackupStatus));
    }
    if (newSettings.lastSuccessfulBackup !== undefined) {
      updateSetting('last_successful_backup', String(newSettings.lastSuccessfulBackup || ''));
      updateSetting('last_full_backup', String(newSettings.lastSuccessfulBackup || ''));
    }
    if (newSettings.lastFailedBackup !== undefined) {
      updateSetting('last_failed_backup', String(newSettings.lastFailedBackup || ''));
    }
    if (newSettings.lastBackupError !== undefined) {
      updateSetting('last_backup_error', String(newSettings.lastBackupError || ''));
    }
    if (newSettings.lastBackupSize !== undefined) {
      updateSetting('last_backup_size', String(newSettings.lastBackupSize || '0'));
    }
  });

  return getBackupSettings();
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
      db.runSync(
        "UPDATE transaction_images SET upload_status = 'uploaded', server_synced_at = ? WHERE upload_status = 'pending' OR upload_status = 'uploading' OR upload_status = 'failed';",
        [now]
      );
    } else {
      for (const img of confirmedImages) {
        if (img.id) {
          db.runSync(
            "UPDATE transaction_images SET upload_status = 'uploaded', server_id = ?, server_url = COALESCE(?, server_url), server_synced_at = ?, file_name = COALESCE(?, file_name) WHERE id = ?;",
            [img.server_id || null, img.server_url || null, now, img.file_name || null, img.id]
          );
        } else if (img.transaction_uuid) {
          db.runSync(
            "UPDATE transaction_images SET upload_status = 'uploaded', server_id = ?, server_url = COALESCE(?, server_url), server_synced_at = ?, file_name = COALESCE(?, file_name) WHERE transaction_uuid = ? AND (file_name = ? OR local_uri LIKE ?);",
            [img.server_id || null, img.server_url || null, now, img.file_name || null, img.transaction_uuid, img.file_name || '', `%${img.file_name || ''}`]
          );
        }
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

export const getPendingImages = (limit = 20) => {
  const db = getDatabase();
  return db.getAllSync(`
    SELECT 
      ti.id,
      ti.transaction_id,
      COALESCE(ti.transaction_uuid, t.uuid) as transaction_uuid,
      ti.local_uri,
      ti.server_url,
      ti.file_name,
      ti.original_file_name,
      ti.upload_status,
      ti.created_at
    FROM transaction_images ti
    LEFT JOIN transactions t ON ti.transaction_id = t.id
    WHERE ti.upload_status = 'pending' OR ti.upload_status = 'uploading' OR ti.upload_status = 'failed' OR ti.upload_status IS NULL
    ORDER BY ti.id ASC
    LIMIT ?;
  `, [limit]);
};

export const getAllTransactionImages = () => {
  const db = getDatabase();
  return db.getAllSync(`
    SELECT 
      ti.id,
      ti.transaction_id,
      COALESCE(ti.transaction_uuid, t.uuid) as transaction_uuid,
      ti.local_uri,
      ti.server_url,
      ti.file_name,
      ti.original_file_name,
      ti.upload_status,
      ti.created_at
    FROM transaction_images ti
    LEFT JOIN transactions t ON ti.transaction_id = t.id
    ORDER BY ti.id ASC;
  `);
};

export const updateRestoredImage = ({ id, localUri, serverUrl, fileName }) => {
  const db = getDatabase();
  const now = getCurrentTimestamp();
  if (id) {
    db.runSync(
      "UPDATE transaction_images SET local_uri = ?, server_url = COALESCE(?, server_url), file_name = COALESCE(?, file_name), upload_status = 'uploaded', server_synced_at = ? WHERE id = ?;",
      [localUri, serverUrl || null, fileName || null, now, id]
    );
  }
};

export const exportAllData = () => {
  const db = getDatabase();
  const transactions = db.getAllSync(`
    SELECT t.*, p.name as party_name, c.name as category_name 
    FROM transactions t 
    LEFT JOIN parties p ON t.party_id = p.id 
    LEFT JOIN categories c ON t.category_id = c.id
    ORDER BY 
      (CASE 
        WHEN typeof(t.transaction_date) = 'integer' OR (typeof(t.transaction_date) = 'text' AND t.transaction_date GLOB '[0-9]*' AND length(t.transaction_date) <= 12) 
          THEN date(t.transaction_date, 'unixepoch', 'localtime') 
        ELSE date(t.transaction_date) 
      END) DESC, 
      t.updated_at DESC, 
      t.id DESC;
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

// -------------------------------------------------------------
// UPI Info Queries & Dynamic Local Storage
// -------------------------------------------------------------
export const DEFAULT_UPI_ID = '8651615629@jio';
export const DEFAULT_UPI_UPDATE = 1;
export const DEFAULT_UPI_UPDATED_AT = '2026-10-25 04:32:08';

/**
 * Ensures upi_info table has all required columns with constant default values
 */
export const ensureUpiInfoColumns = (db) => {
  try {
    const cols = db.getAllSync("PRAGMA table_info('upi_info');");
    const colNames = cols.map((c) => c.name);

    if (!colNames.includes('upi_update')) {
      try {
        db.execSync('ALTER TABLE `upi_info` ADD COLUMN `upi_update` INTEGER DEFAULT 1;');
      } catch (e) {}
    }
    if (!colNames.includes('updated_at')) {
      try {
        db.execSync("ALTER TABLE `upi_info` ADD COLUMN `updated_at` TEXT DEFAULT '';");
      } catch (e) {}
    }
  } catch (e) {
    console.warn('[DB] ensureUpiInfoColumns warning:', e?.message);
  }
};

/**
 * Returns the latest successfully cached UPI record from local SQLite: { id, upiId, upiUpdate, updatedAt }
 */
export const getLocalUpiRecord = () => {
  try {
    const db = getDatabase();
    ensureUpiInfoColumns(db);

    const row = db.getFirstSync(
      'SELECT id, upi_id, upi_update, updated_at FROM upi_info WHERE upi_id IS NOT NULL AND TRIM(upi_id) != "" ORDER BY id DESC LIMIT 1;'
    );
    if (row && row.upi_id) {
      const upiId = String(row.upi_id).trim();
      if (upiId.includes('@')) {
        return {
          id: row.id,
          upiId,
          upiUpdate: Number(row.upi_update != null ? row.upi_update : DEFAULT_UPI_UPDATE),
          updatedAt: row.updated_at ? String(row.updated_at).trim() : DEFAULT_UPI_UPDATED_AT,
        };
      }
    }

    // Auto-seed table if empty so app always has a valid initial configuration
    try {
      db.runSync(
        'INSERT INTO `upi_info` (`id`, `upi_id`, `upi_update`, `updated_at`) VALUES (1, ?, ?, ?);',
        [DEFAULT_UPI_ID, DEFAULT_UPI_UPDATE, DEFAULT_UPI_UPDATED_AT]
      );
    } catch (insertErr) {}

    return {
      id: 1,
      upiId: DEFAULT_UPI_ID,
      upiUpdate: DEFAULT_UPI_UPDATE,
      updatedAt: DEFAULT_UPI_UPDATED_AT,
    };
  } catch (e) {
    console.warn('[DB] Could not query local upi_info:', e?.message);
  }

  return { id: null, upiId: DEFAULT_UPI_ID, upiUpdate: DEFAULT_UPI_UPDATE, updatedAt: DEFAULT_UPI_UPDATED_AT };
};

/**
 * Saves a validated UPI record to local SQLite table upi_info.
 * Overwrites any old records so local storage strictly keeps only the latest fetched upi_id.
 */
export const saveLocalUpiRecord = (upiId, upiUpdate = 1, updatedAt = null) => {
  if (!upiId || typeof upiId !== 'string' || !upiId.includes('@')) {
    console.warn('[DB] Refusing to save invalid upi_id:', upiId);
    return false;
  }

  const cleanUpiId = upiId.trim();
  const parsedUpdate = parseInt(upiUpdate, 10);
  const safeUpdate = !isNaN(parsedUpdate) ? parsedUpdate : 1;
  const formattedUpdatedAt = updatedAt
    ? String(updatedAt).trim()
    : new Date().toISOString().replace('T', ' ').substring(0, 19);

  try {
    const db = getDatabase();
    ensureUpiInfoColumns(db);

    db.withTransactionSync(() => {
      // Overwrite / clear older rows so SQLite strictly preserves only the latest valid upi_id
      db.runSync('DELETE FROM upi_info;');
      db.runSync(
        'INSERT INTO `upi_info` (`id`, `upi_id`, `upi_update`, `updated_at`) VALUES (1, ?, ?, ?);',
        [cleanUpiId, safeUpdate, formattedUpdatedAt]
      );
    });

    return true;
  } catch (e) {
    console.warn('[DB] Could not save upi_info:', e?.message);
    return false;
  }
};

export const getUpiInfo = () => {
  return getLocalUpiRecord().upiId;
};

export const insertUpiInfo = (upiId, upiUpdate = 1, updatedAt = null) => {
  return saveLocalUpiRecord(upiId, upiUpdate, updatedAt);
};

// -------------------------------------------------------------
// Monthly Budget & Spend Tracking Queries
// -------------------------------------------------------------

export const getThisMonthSpend = () => {
  try {
    const db = getDatabase();
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const startTs = Math.floor(startMonth.getTime() / 1000);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const endTs = Math.floor(endMonth.getTime() / 1000);
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const row = db.getFirstSync(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'gave' AND ((transaction_date >= ? AND transaction_date <= ?) OR transaction_date LIKE ?) THEN amount ELSE 0 END), 0) as total_spent,
        COALESCE(SUM(CASE WHEN type = 'got' AND ((transaction_date >= ? AND transaction_date <= ?) OR transaction_date LIKE ?) THEN amount ELSE 0 END), 0) as total_income,
        COUNT(CASE WHEN ((transaction_date >= ? AND transaction_date <= ?) OR transaction_date LIKE ?) THEN 1 END) as tx_count
      FROM transactions;
    `, [
      startTs, endTs, `${monthPrefix}%`,
      startTs, endTs, `${monthPrefix}%`,
      startTs, endTs, `${monthPrefix}%`,
    ]);

    return {
      spent: Number(row?.total_spent || 0),
      income: Number(row?.total_income || 0),
      count: Number(row?.tx_count || 0),
    };
  } catch (e) {
    console.warn('Error querying monthly spend:', e);
    return { spent: 0, income: 0, count: 0 };
  }
};

export const getMonthlyBudget = () => {
  try {
    const val = getSetting('monthly_budget', '0');
    return Number(val) || 0;
  } catch (e) {
    return 0;
  }
};

export const setMonthlyBudget = (amount) => {
  try {
    const num = Math.max(0, Number(amount) || 0);
    updateSetting('monthly_budget', String(num));
    return num;
  } catch (e) {
    console.error('Error saving monthly budget:', e);
    return 0;
  }
};

export const getCategoryBudgets = () => {
  try {
    const raw = getSetting('category_budgets', '{}');
    return JSON.parse(raw) || {};
  } catch (e) {
    return {};
  }
};

export const setCategoryBudget = (categoryId, amount, categoryName = null) => {
  try {
    const db = getDatabase();
    const budgets = getCategoryBudgets();
    const num = Math.max(0, Number(amount) || 0);
    const keyStr = String(categoryId);
    const keyNum = Number(categoryId);

    if (num <= 0) {
      delete budgets[keyStr];
      if (!isNaN(keyNum)) delete budgets[keyNum];
      if (categoryName) delete budgets[categoryName];
    } else {
      budgets[keyStr] = num;
      if (categoryName && categoryName !== keyStr) {
        delete budgets[categoryName];
      }
    }

    // Prune any budgets belonging to deleted categories
    try {
      const activeCats = db.getAllSync('SELECT id, name FROM categories WHERE COALESCE(is_deleted, 0) = 0;');
      const activeKeys = new Set(activeCats.map((c) => String(c.id)));
      for (const k of Object.keys(budgets)) {
        if (!activeKeys.has(String(k))) {
          delete budgets[k];
        }
      }
    } catch (err) {}

    updateSetting('category_budgets', JSON.stringify(budgets));

    // Calculate total of active category budgets and always sync monthly_budget setting
    const total = Object.values(budgets).reduce((acc, curr) => acc + (Number(curr) || 0), 0);
    updateSetting('monthly_budget', String(total));

    return budgets;
  } catch (e) {
    console.error('Error saving category budget:', e);
    return {};
  }
};

export const getMonthlyCategorySpendReport = () => {
  try {
    const db = getDatabase();
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
    const startTs = Math.floor(startMonth.getTime() / 1000);
    const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const endTs = Math.floor(endMonth.getTime() / 1000);
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const budgets = getCategoryBudgets();

    const rows = db.getAllSync(`
      SELECT 
        c.id,
        c.name,
        c.icon,
        c.color,
        COALESCE(c.sort_order, c.id) as sortOrder,
        COALESCE(SUM(CASE WHEN t.type = 'gave' AND ((t.transaction_date >= ? AND t.transaction_date <= ?) OR t.transaction_date LIKE ?) THEN t.amount ELSE 0 END), 0) as spent,
        COUNT(CASE WHEN t.type = 'gave' AND ((t.transaction_date >= ? AND t.transaction_date <= ?) OR t.transaction_date LIKE ?) THEN 1 END) as txCount
      FROM categories c
      LEFT JOIN transactions t ON c.id = t.category_id
      WHERE COALESCE(c.is_deleted, 0) = 0
      GROUP BY c.id
      ORDER BY spent DESC, sortOrder ASC;
    `, [
      startTs, endTs, `${monthPrefix}%`,
      startTs, endTs, `${monthPrefix}%`,
    ]);

    let totalSpent = 0;
    let totalBudget = 0;

    const items = rows.map((r) => {
      const spent = Number(r.spent) || 0;
      const budget = Number(budgets[r.id]) || Number(budgets[String(r.id)]) || Number(budgets[r.name]) || 0;
      totalSpent += spent;
      totalBudget += budget;

      const remaining = budget > 0 ? budget - spent : 0;
      const percent = budget > 0 ? (spent / budget) * 100 : 0;
      const isOverBudget = budget > 0 && spent > budget;

      return {
        id: r.id,
        name: r.name,
        icon: r.icon,
        color: r.color,
        sortOrder: r.sortOrder,
        spent,
        txCount: Number(r.txCount) || 0,
        budget,
        remaining,
        percent,
        isOverBudget,
      };
    });

    const hasCategoryBudgets = Object.keys(budgets).length > 0;
    // Only fall back to global monthly_budget if no category budgets have ever been defined
    if (totalBudget === 0 && !hasCategoryBudgets) {
      totalBudget = getMonthlyBudget();
    }

    return {
      items,
      totalSpent,
      totalBudget,
      monthName: now.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
    };
  } catch (e) {
    console.error('Error fetching monthly category spend report:', e);
    return { items: [], totalSpent: 0, totalBudget: 0, monthName: '' };
  }
};

// -------------------------------------------------------------
// WhatsApp OTP Gateway Domain Configuration (https://otp.losttag.in/docs)
// -------------------------------------------------------------
export const DEFAULT_OTP_DOMAIN = 'https://otp.losttag.in';
export const DEFAULT_OTP_API_BASE_URL = 'https://otp.losttag.in/api/v1';
export const DEFAULT_OTP_TEMPLATE = 'otp_service';
export const DEFAULT_OTP_PURPOSE = 'Verification';
export const DEFAULT_OTP_EXPIRY_SECONDS = 300;
export const DEFAULT_OTP_COOLDOWN = 60;
export const DEFAULT_OTP_MAX_ATTEMPTS = 5;
export const DEFAULT_OTP_UPDATE = 1;

/**
 * Ensures otp_domain table has all required columns with default values
 */
export const ensureOtpDomainColumns = (db) => {
  try {
    const cols = db.getAllSync("PRAGMA table_info('otp_domain');");
    const colNames = cols.map((c) => c.name);

    if (!colNames.includes('api_base_url')) {
      try { db.execSync("ALTER TABLE `otp_domain` ADD COLUMN `api_base_url` TEXT DEFAULT 'https://otp.losttag.in/api/v1';"); } catch (e) {}
    }
    if (!colNames.includes('sender_phone_id')) {
      try { db.execSync("ALTER TABLE `otp_domain` ADD COLUMN `sender_phone_id` TEXT DEFAULT '1432742293247493';"); } catch (e) {}
    }
    if (!colNames.includes('template_name')) {
      try { db.execSync("ALTER TABLE `otp_domain` ADD COLUMN `template_name` TEXT DEFAULT 'otp_service';"); } catch (e) {}
    }
    if (!colNames.includes('purpose')) {
      try { db.execSync("ALTER TABLE `otp_domain` ADD COLUMN `purpose` TEXT DEFAULT 'Verification';"); } catch (e) {}
    }
    if (!colNames.includes('expiry_seconds')) {
      try { db.execSync("ALTER TABLE `otp_domain` ADD COLUMN `expiry_seconds` INTEGER DEFAULT 300;"); } catch (e) {}
    }
    if (!colNames.includes('resend_cooldown')) {
      try { db.execSync("ALTER TABLE `otp_domain` ADD COLUMN `resend_cooldown` INTEGER DEFAULT 60;"); } catch (e) {}
    }
    if (!colNames.includes('max_attempts')) {
      try { db.execSync("ALTER TABLE `otp_domain` ADD COLUMN `max_attempts` INTEGER DEFAULT 5;"); } catch (e) {}
    }
    if (!colNames.includes('otp_update')) {
      try { db.execSync("ALTER TABLE `otp_domain` ADD COLUMN `otp_update` INTEGER DEFAULT 1;"); } catch (e) {}
    }
    if (!colNames.includes('status')) {
      try { db.execSync("ALTER TABLE `otp_domain` ADD COLUMN `status` TEXT DEFAULT 'active';"); } catch (e) {}
    }
    if (!colNames.includes('is_active')) {
      try { db.execSync("ALTER TABLE `otp_domain` ADD COLUMN `is_active` INTEGER DEFAULT 1;"); } catch (e) {}
    }
    if (!colNames.includes('updated_at')) {
      try { db.execSync("ALTER TABLE `otp_domain` ADD COLUMN `updated_at` TEXT DEFAULT '';"); } catch (e) {}
    }
  } catch (e) {
    console.warn('[DB] ensureOtpDomainColumns warning:', e?.message);
  }
};

/**
 * Returns the latest successfully cached OTP Gateway record from local SQLite
 */
export const getLocalOtpDomainRecord = () => {
  try {
    const db = getDatabase();
    ensureOtpDomainColumns(db);

    const row = db.getFirstSync(
      'SELECT id, domain, api_base_url, api_key, api_secret, sender_phone_id, template_name, purpose, expiry_seconds, resend_cooldown, max_attempts, status, is_active, otp_update, updated_at FROM otp_domain WHERE (is_active = 1 OR status = "active") AND domain IS NOT NULL AND TRIM(domain) != "" ORDER BY id DESC LIMIT 1;'
    );
    if (row && row.domain) {
      return {
        id: row.id,
        domain: String(row.domain).trim(),
        apiBaseUrl: row.api_base_url ? String(row.api_base_url).trim() : DEFAULT_OTP_API_BASE_URL,
        apiKey: row.api_key ? String(row.api_key).trim() : '',
        apiSecret: row.api_secret ? String(row.api_secret).trim() : '',
        senderPhoneId: row.sender_phone_id ? String(row.sender_phone_id).trim() : '1432742293247493',
        templateName: row.template_name ? String(row.template_name).trim() : DEFAULT_OTP_TEMPLATE,
        purpose: (row.purpose ? String(row.purpose).trim() : DEFAULT_OTP_PURPOSE).slice(0, 15),
        expirySeconds: Number(row.expiry_seconds || DEFAULT_OTP_EXPIRY_SECONDS),
        resendCooldown: Number(row.resend_cooldown || DEFAULT_OTP_COOLDOWN),
        maxAttempts: Number(row.max_attempts || DEFAULT_OTP_MAX_ATTEMPTS),
        status: row.status || 'active',
        isActive: Number(row.is_active != null ? row.is_active : 1),
        otpUpdate: Number(row.otp_update != null ? row.otp_update : DEFAULT_OTP_UPDATE),
        updatedAt: row.updated_at ? String(row.updated_at).trim() : '',
      };
    }

    // Auto-seed table if empty so app always has valid gateway configuration
    try {
      db.runSync(
        'INSERT INTO `otp_domain` (`id`, `domain`, `api_base_url`, `api_key`, `api_secret`, `sender_phone_id`, `template_name`, `purpose`, `expiry_seconds`, `resend_cooldown`, `max_attempts`, `status`, `is_active`, `otp_update`, `created_at`, `updated_at`) VALUES (1, ?, ?, "", "", "1432742293247493", ?, ?, ?, ?, ?, "active", 1, ?, strftime("%s", "now"), datetime("now"));',
        [DEFAULT_OTP_DOMAIN, DEFAULT_OTP_API_BASE_URL, DEFAULT_OTP_TEMPLATE, DEFAULT_OTP_PURPOSE, DEFAULT_OTP_EXPIRY_SECONDS, DEFAULT_OTP_COOLDOWN, DEFAULT_OTP_MAX_ATTEMPTS, DEFAULT_OTP_UPDATE]
      );
    } catch (insertErr) {}

    return {
      id: 1,
      domain: DEFAULT_OTP_DOMAIN,
      apiBaseUrl: DEFAULT_OTP_API_BASE_URL,
      apiKey: '',
      apiSecret: '',
      senderPhoneId: '1432742293247493',
      templateName: DEFAULT_OTP_TEMPLATE,
      purpose: DEFAULT_OTP_PURPOSE,
      expirySeconds: DEFAULT_OTP_EXPIRY_SECONDS,
      resendCooldown: DEFAULT_OTP_COOLDOWN,
      maxAttempts: DEFAULT_OTP_MAX_ATTEMPTS,
      status: 'active',
      isActive: 1,
      otpUpdate: DEFAULT_OTP_UPDATE,
      updatedAt: '',
    };
  } catch (e) {
    console.warn('[DB] Could not query local otp_domain:', e?.message);
  }

  return {
    id: null,
    domain: DEFAULT_OTP_DOMAIN,
    apiBaseUrl: DEFAULT_OTP_API_BASE_URL,
    apiKey: '',
    apiSecret: '',
    senderPhoneId: '1432742293247493',
    templateName: DEFAULT_OTP_TEMPLATE,
    purpose: DEFAULT_OTP_PURPOSE,
    expirySeconds: DEFAULT_OTP_EXPIRY_SECONDS,
    resendCooldown: DEFAULT_OTP_COOLDOWN,
    maxAttempts: DEFAULT_OTP_MAX_ATTEMPTS,
    status: 'active',
    isActive: 1,
    otpUpdate: DEFAULT_OTP_UPDATE,
    updatedAt: '',
  };
};

/**
 * Saves a validated OTP Gateway record to local SQLite table otp_domain.
 */
export const saveLocalOtpDomainRecord = (config) => {
  if (!config || !config.domain) {
    console.warn('[DB] Refusing to save invalid otp_domain config:', config);
    return false;
  }

  const domain = String(config.domain).trim();
  const apiBaseUrl = String(config.api_base_url || config.apiBaseUrl || `${domain}/api/v1`).trim();
  const apiKey = String(config.api_key || config.apiKey || '').trim();
  const apiSecret = String(config.api_secret || config.apiSecret || '').trim();
  const senderPhoneId = String(config.sender_phone_id || config.senderPhoneId || '1432742293247493').trim();
  const templateName = String(config.template_name || config.templateName || DEFAULT_OTP_TEMPLATE).trim();
  let purpose = String(config.purpose || DEFAULT_OTP_PURPOSE).trim();
  if (purpose === 'Account Registration') purpose = 'Registration';
  if (purpose === 'Login Verification') purpose = 'Verification';
  if (purpose.length > 15) purpose = purpose.slice(0, 15);
  const expirySeconds = Number(config.expiry_seconds || config.expirySeconds || DEFAULT_OTP_EXPIRY_SECONDS);
  const resendCooldown = Number(config.resend_cooldown || config.resendCooldown || DEFAULT_OTP_COOLDOWN);
  const maxAttempts = Number(config.max_attempts || config.maxAttempts || DEFAULT_OTP_MAX_ATTEMPTS);
  const status = String(config.status || 'active').trim();
  const isActive = config.is_active != null ? Number(config.is_active) : 1;
  const otpUpdate = Number(config.otp_update != null ? config.otp_update : (config.otpUpdate != null ? config.otpUpdate : 1));
  const updatedAt = config.updated_at || config.updatedAt || new Date().toISOString().replace('T', ' ').substring(0, 19);

  try {
    const db = getDatabase();
    ensureOtpDomainColumns(db);

    db.withTransactionSync(() => {
      db.runSync('DELETE FROM otp_domain;');
      db.runSync(
        'INSERT INTO `otp_domain` (`id`, `domain`, `api_base_url`, `api_key`, `api_secret`, `sender_phone_id`, `template_name`, `purpose`, `expiry_seconds`, `resend_cooldown`, `max_attempts`, `status`, `is_active`, `otp_update`, `created_at`, `updated_at`) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime("%s", "now"), ?);',
        [domain, apiBaseUrl, apiKey, apiSecret, senderPhoneId, templateName, purpose, expirySeconds, resendCooldown, maxAttempts, status, isActive, otpUpdate, updatedAt]
      );
    });

    return true;
  } catch (e) {
    console.warn('[DB] Could not save otp_domain:', e?.message);
    return false;
  }
};

/**
 * Directly returns active OTP API Base URL from local database
 */
export const getDynamicOtpBaseUrl = () => {
  const local = getLocalOtpDomainRecord();
  return local?.apiBaseUrl || (local?.domain ? `${local.domain.replace(/\/+$/, '')}/api/v1` : '');
};






