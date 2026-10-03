import { getDatabase } from '../database/db';
import { getCurrentTimestamp } from '../utils/formatters';

const DEFAULT_SAMPLE_NOTES = [
  'Grocery shopping & kitchen supplies',
  'Client invoice settlement',
  'Office electricity & power bill',
  'Vegetables & dairy supplies',
  'Freelance milestone payment',
  'Hardware store materials',
  'Team lunch & tea snacks',
  'Monthly internet broadband bill',
  'Petrol & vehicle fuel',
  'Vendor advance payment',
  'Pharmacy & medical supplies',
  'Staff salary advance',
  'Stationery & document printing',
  'Customer ledger settlement',
  'Water utility bill payment',
  'Online software cloud subscription',
  'Mobile recharge & communication',
  'Machinery maintenance & repair',
  'Consulting fees received',
  'Packaging boxes & dispatch materials',
  'Logistics & courier delivery charge',
  'Shop maintenance & cleaning supplies',
];

const SAMPLE_AMOUNTS = [
  50, 80, 120, 200, 350, 500, 750, 1100, 1500, 2200, 3400, 4800,
  6500, 8500, 12000, 15500, 22000, 35000, 48000, 75000, 95000
];

/**
 * Fast Pseudo-UUID generator for bulk stress test records
 */
const generateStressUUID = (index) => {
  const hex = Math.random().toString(16).substring(2, 10);
  const hex2 = Math.random().toString(16).substring(2, 6);
  return `stress_50k_${Date.now()}_${index}_${hex}${hex2}`;
};

/**
 * Returns current count of test records vs real records
 */
export const getStressTestStatus = () => {
  const db = getDatabase();
  try {
    const testRow = db.getFirstSync(
      "SELECT COUNT(*) as count FROM transactions WHERE sync_status = 'test_stress_50k' OR uuid LIKE 'stress_50k_%';"
    );
    const totalRow = db.getFirstSync('SELECT COUNT(*) as count FROM transactions;');
    const testCount = testRow ? Number(testRow.count) : 0;
    const totalCount = totalRow ? Number(totalRow.count) : 0;
    const realCount = totalCount - testCount;
    return {
      testCount,
      realCount,
      totalCount,
    };
  } catch (e) {
    console.error('Error fetching stress test status:', e);
    return { testCount: 0, realCount: 0, totalCount: 0 };
  }
};

/**
 * Safely removes ONLY generated stress-test transactions.
 * Never touches real user transactions.
 */
export const deleteStressTestTransactions = () => {
  const db = getDatabase();
  let deletedCount = 0;
  try {
    db.withTransactionSync(() => {
      const res = db.runSync(
        "DELETE FROM transactions WHERE sync_status = 'test_stress_50k' OR uuid LIKE 'stress_50k_%';"
      );
      deletedCount = res.changes || 0;
    });
  } catch (e) {
    console.error('Failed to delete stress test transactions:', e);
    throw e;
  }
  return deletedCount;
};

/**
 * Generates exactly `targetCount` (default: 50,000) realistic transactions
 * Spread across the past 365 days.
 *
 * Uses batched prepared statements inside transactions for maximum SQLite performance (takes ~2 seconds).
 *
 * @param {Object} options
 * @param {number} options.targetCount Total records to generate (default 50,000)
 * @param {number} options.chunkSize Batch size per transaction (default 5,000)
 * @param {Function} options.onProgress Callback with { current, total, percentage }
 */
export const generateStressTestTransactions = async ({
  targetCount = 50000,
  chunkSize = 5000,
  onProgress = null,
} = {}) => {
  const db = getDatabase();
  const now = getCurrentTimestamp();

  // 1. Gather existing valid category IDs and party IDs for realistic foreign keys
  let categoryIds = [];
  try {
    const catRows = db.getAllSync('SELECT id FROM categories WHERE is_deleted = 0;');
    if (catRows && catRows.length > 0) {
      categoryIds = catRows.map((r) => r.id);
    }
  } catch (e) {}

  let partyIds = [];
  try {
    const partyRows = db.getAllSync('SELECT id FROM parties WHERE is_active = 1;');
    if (partyRows && partyRows.length > 0) {
      partyIds = partyRows.map((r) => r.id);
    }
  } catch (e) {}

  // 2. Sample notes pool
  let notesPool = DEFAULT_SAMPLE_NOTES;
  try {
    const existingNotes = db.getAllSync(
      "SELECT note FROM transactions WHERE note IS NOT NULL AND length(note) > 3 AND sync_status != 'test_stress_50k' LIMIT 30;"
    );
    if (existingNotes && existingNotes.length > 5) {
      notesPool = [
        ...DEFAULT_SAMPLE_NOTES,
        ...existingNotes.map((r) => r.note).filter(Boolean),
      ];
    }
  } catch (e) {}

  let totalInserted = 0;
  const numChunks = Math.ceil(targetCount / chunkSize);

  for (let c = 0; c < numChunks; c++) {
    const countThisChunk = Math.min(chunkSize, targetCount - totalInserted);
    if (countThisChunk <= 0) break;

    // Execute chunk inside a single SQLite transaction with a prepared statement
    db.withTransactionSync(() => {
      const stmt = db.prepareSync(`
        INSERT INTO transactions (
          uuid, party_id, category_id, type, payment_mode, amount, note, transaction_date, created_at, updated_at, sync_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'test_stress_50k');
      `);

      try {
        for (let i = 0; i < countThisChunk; i++) {
          const globalIdx = totalInserted + i;
          const txUuid = generateStressUUID(globalIdx);

          // Spread across 365 days (~137 transactions per day)
          const dayOffset = Math.floor((globalIdx / targetCount) * 365);
          // Randomize time within the day (between 8:00 AM and 10:00 PM)
          const secondInDay = 28800 + Math.floor(Math.random() * 50400);
          const txDate = now - (dayOffset * 86400) + secondInDay;

          // 55% got (income/received), 45% gave (expense/paid)
          const type = Math.random() < 0.55 ? 'got' : 'gave';
          const paymentMode = Math.random() < 0.5 ? 'cash' : 'online';

          // Pick realistic amount
          const baseAmount = SAMPLE_AMOUNTS[Math.floor(Math.random() * SAMPLE_AMOUNTS.length)];
          const jitter = Math.floor(Math.random() * 40) - 20;
          const amount = Math.max(10, baseAmount + jitter);

          // Foreign keys
          const partyId = partyIds.length > 0 && Math.random() < 0.75
            ? partyIds[Math.floor(Math.random() * partyIds.length)]
            : null;

          const categoryId = categoryIds.length > 0
            ? categoryIds[Math.floor(Math.random() * categoryIds.length)]
            : null;

          // Note
          const baseNote = notesPool[Math.floor(Math.random() * notesPool.length)];
          const note = `[TEST #${globalIdx + 1}] ${baseNote}`;

          stmt.executeSync([
            txUuid,
            partyId,
            categoryId,
            type,
            paymentMode,
            amount,
            note,
            txDate,
            txDate,
            txDate,
          ]);
        }
      } finally {
        stmt.finalizeSync();
      }
    });

    totalInserted += countThisChunk;

    if (onProgress) {
      const percentage = Math.min(100, Math.round((totalInserted / targetCount) * 100));
      onProgress({ current: totalInserted, total: targetCount, percentage });
    }

    // Yield control briefly to allow UI to breathe and update progress
    await new Promise((resolve) => setTimeout(resolve, 15));
  }

  return totalInserted;
};
