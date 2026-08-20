/**
 * Centralized API Configuration
 * 
 * All remote server, CRM, and backup endpoints are configured here.
 * If the server domain or backend routes change, update this single file.
 */

const BASE_DOMAIN = 'https://api.gmsexpense.com'; // Default production domain
const API_VERSION = 'v1';
const API_BASE = `${BASE_DOMAIN}/api/${API_VERSION}`;

export const API_CONFIG = {
  // Base URLs
  BASE_DOMAIN,
  BASE_URL: `${BASE_DOMAIN}/api`,
  API_BASE,

  // 1. Transaction & SQLite Text Data Sync
  TRANSACTION_SYNC_URL: `${API_BASE}/transactions/sync`,
  BATCH_SYNC_URL: `${API_BASE}/sync/batch`,

  // 2. Image & Media Storage Upload
  IMAGE_UPLOAD_URL: `${API_BASE}/images/upload`,
  IMAGE_BATCH_UPLOAD_URL: `${API_BASE}/images/upload-batch`,

  // 3. Backup & Health Status
  BACKUP_STATUS_URL: `${API_BASE}/backup/status`,
  SERVER_HEALTH_URL: `${API_BASE}/health`,

  // 4. Cloud Restore / Data Download
  RESTORE_URL: `${API_BASE}/backup/restore`,
  DOWNLOAD_BACKUP_URL: `${API_BASE}/backup/download`,

  // 5. Authentication & Account Management (CRM Integration)
  AUTH_LOGIN_URL: `${API_BASE}/auth/login`,
  AUTH_REGISTER_URL: `${API_BASE}/auth/register`,
  AUTH_VERIFY_TOKEN_URL: `${API_BASE}/auth/verify`,

  // 6. Parties / Customers API (Khata & Ledger CRM)
  PARTIES_SYNC_URL: `${API_BASE}/parties/sync`,

  // 7. Categories API
  CATEGORIES_SYNC_URL: `${API_BASE}/categories/sync`,

  // Configuration Constants
  DEFAULT_TIMEOUT_MS: 15000,
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

export default API_CONFIG;
