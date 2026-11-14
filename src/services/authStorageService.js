import * as FileSystem from 'expo-file-system/legacy';
import { getDatabase } from '../database/db';

const AUTH_FILE_NAME = 'auth_session.json';

// In-memory cache for fast synchronous access
let memSession = {
  token: null,
  user: null,
  isLoggedIn: false,
};

/**
 * Returns the absolute path to the persistent auth file
 */
const getAuthFilePath = () => {
  const docDir = FileSystem.documentDirectory;
  if (!docDir) return null;
  return `${docDir.replace(/\/+$/, '')}/${AUTH_FILE_NAME}`;
};

/**
 * Synchronous session getter (fast in-memory + SQLite fallback)
 */
export const getAuthSession = () => {
  if (memSession.isLoggedIn && memSession.token && memSession.user) {
    return memSession;
  }

  // Fallback: Check SQLite settings table
  try {
    const db = getDatabase();
    if (db) {
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
      if (token && user) {
        memSession = { token, user, isLoggedIn: true };
        return memSession;
      }
    }
  } catch (e) {
    // Database may not be initialized yet
  }

  return memSession;
};

/**
 * Restores the authentication session from durable disk storage on startup
 */
export const restoreAuthSessionAsync = async () => {
  const filePath = getAuthFilePath();
  if (filePath) {
    try {
      const info = await FileSystem.getInfoAsync(filePath);
      if (info && info.exists && info.size > 0) {
        const raw = await FileSystem.readAsStringAsync(filePath);
        const data = JSON.parse(raw);
        if (data && data.token && data.user) {
          memSession = {
            token: data.token,
            user: data.user,
            isLoggedIn: true,
          };

          // Sync into SQLite settings table if database is open
          try {
            const db = getDatabase();
            if (db) {
              db.runSync(
                "INSERT INTO settings (key, value) VALUES ('auth_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
                [data.token]
              );
              db.runSync(
                "INSERT INTO settings (key, value) VALUES ('auth_user', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value;",
                [JSON.stringify(data.user)]
              );
            }
          } catch (dbErr) {}

          return memSession;
        }
      }
    } catch (err) {
      console.warn('⚠️ [AUTH_STORAGE] Error reading auth file on startup:', err);
    }
  }

  // Fallback: Check SQLite settings table if file didn't exist
  try {
    const db = getDatabase();
    if (db) {
      const tokenRow = db.getFirstSync("SELECT value FROM settings WHERE key = 'auth_token';");
      const userRow = db.getFirstSync("SELECT value FROM settings WHERE key = 'auth_user';");
      const token = tokenRow?.value || null;
      let user = null;
      if (userRow?.value) {
        try {
          user = JSON.parse(userRow.value);
        } catch (e) {}
      }
      if (token && user) {
        memSession = { token, user, isLoggedIn: true };
        // Persist to file for future restarts
        if (filePath) {
          try {
            await FileSystem.writeAsStringAsync(filePath, JSON.stringify(memSession));
          } catch (writeErr) {}
        }
        return memSession;
      }
    }
  } catch (dbErr) {}

  memSession = { token: null, user: null, isLoggedIn: false };
  return memSession;
};

/**
 * Saves authentication session to both persistent file and SQLite settings table
 */
export const saveAuthSession = (token, user) => {
  if (!token || !user) return false;

  memSession = {
    token,
    user,
    isLoggedIn: true,
  };

  // 1. Asynchronously persist to dedicated auth file
  const filePath = getAuthFilePath();
  if (filePath) {
    FileSystem.writeAsStringAsync(filePath, JSON.stringify(memSession)).catch((err) => {
      console.warn('⚠️ [AUTH_STORAGE] Failed writing auth file:', err);
    });
  }

  // 2. Persist to SQLite settings table
  try {
    const db = getDatabase();
    if (db) {
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
    }
    return true;
  } catch (e) {
    console.warn('⚠️ [AUTH_STORAGE] Failed saving auth session to SQLite:', e);
    return true; // Still true since saved to memory and file
  }
};

/**
 * Clears authentication session from memory, file, and SQLite settings table
 */
export const clearAuthSession = () => {
  memSession = {
    token: null,
    user: null,
    isLoggedIn: false,
  };

  // 1. Remove/clear persistent auth file
  const filePath = getAuthFilePath();
  if (filePath) {
    FileSystem.deleteAsync(filePath, { idempotent: true }).catch(() => {
      FileSystem.writeAsStringAsync(filePath, JSON.stringify({})).catch(() => {});
    });
  }

  // 2. Clear SQLite settings table
  try {
    const db = getDatabase();
    if (db) {
      db.withTransactionSync(() => {
        db.runSync("DELETE FROM settings WHERE key = 'auth_token';");
        db.runSync("DELETE FROM settings WHERE key = 'auth_user';");
      });
    }
    return true;
  } catch (e) {
    console.warn('⚠️ [AUTH_STORAGE] Failed clearing auth session from SQLite:', e);
    return true;
  }
};
