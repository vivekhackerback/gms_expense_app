/**
 * Centralized PHP API Configuration
 * 
 * All remote PHP backend server, CRM, and backup endpoints are configured here.
 * Base Domain: https://gmsexpense.tplpro.in
 * Base API Directory: /api/v1/
 * 
 * If the server domain or backend directory structure changes, update this single file.
 */

// const BASE_DOMAIN = 'https://gmsexpense.tplpro.in';
const BASE_DOMAIN = 'https://50df-2401-4900-b519-8a3c-487-9fb4-de-1d64.ngrok-free.app';
const API_VERSION = 'v1';
const API_BASE = `${BASE_DOMAIN}/api/${API_VERSION}`;

export const API_CONFIG = {
  // Base URLs
  BASE_DOMAIN,
  BASE_URL: `${BASE_DOMAIN}/api`,
  API_BASE,

  // -------------------------------------------------------------
  // 1. Transaction & SQLite Text Data Sync (PHP Endpoints)
  // -------------------------------------------------------------
  /** Endpoint for single/batch transaction sync from SQLite to MySQL */
  TRANSACTION_SYNC_URL: `${API_BASE}/transactions_sync.php`,
  /** Endpoint for full multi-entity batch sync (transactions, parties, categories) */
  BATCH_SYNC_URL: `${API_BASE}/batch_sync.php`,

  // -------------------------------------------------------------
  // 2. Image & Media Storage Upload (PHP Endpoints)
  // -------------------------------------------------------------
  /** Endpoint for uploading single receipt photo via multipart/form-data */
  IMAGE_UPLOAD_URL: `${API_BASE}/image_upload.php`,
  /** Endpoint for batch uploading multiple receipt photos */
  IMAGE_BATCH_UPLOAD_URL: `${API_BASE}/image_upload_batch.php`,

  // -------------------------------------------------------------
  // 3. Backup & Server Health Status (PHP Endpoints)
  // -------------------------------------------------------------
  /** Endpoint to test server reachability, PHP version & MySQL connection */
  SERVER_HEALTH_URL: `${API_BASE}/health.php`,
  /** Endpoint to check sync statistics and last backup timestamp for a device */
  BACKUP_STATUS_URL: `${API_BASE}/backup_status.php`,

  // -------------------------------------------------------------
  // 4. Cloud Restore / Data Download (PLANNED / FUTURE CRM)
  // -------------------------------------------------------------
  /** [PLANNED] Endpoint to restore full SQLite database from server backup */
  RESTORE_URL: `${API_BASE}/restore.php`,
  /** [PLANNED] Endpoint to download complete user database snapshot */
  DOWNLOAD_BACKUP_URL: `${API_BASE}/download_backup.php`,

  // -------------------------------------------------------------
  // 5. Authentication & Account Management (PHP Endpoints)
  // -------------------------------------------------------------
  /** User login with mobile number & password */
  AUTH_LOGIN_URL: `${API_BASE}/login.php`,
  /** User logout / session invalidate */
  AUTH_LOGOUT_URL: `${API_BASE}/logout.php`,
  /** User registration with mobile & password */
  AUTH_REGISTER_URL: `${API_BASE}/register.php`,
  /** Complete or update user profile later */
  AUTH_UPDATE_PROFILE_URL: `${API_BASE}/update_profile.php`,
  /** Bearer token verification */
  AUTH_VERIFY_TOKEN_URL: `${API_BASE}/verify_token.php`,

  // -------------------------------------------------------------
  // 6. Parties / Customers & Categories API (PLANNED / FUTURE CRM)
  // -------------------------------------------------------------
  /** [PLANNED] Customer / Khata ledger party synchronization */
  PARTIES_SYNC_URL: `${API_BASE}/parties_sync.php`,
  /** [PLANNED] Category master synchronization */
  CATEGORIES_SYNC_URL: `${API_BASE}/categories_sync.php`,

  // -------------------------------------------------------------
  // Connection & Request Headers
  // -------------------------------------------------------------
  DEFAULT_TIMEOUT_MS: 15000,
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
};

export default API_CONFIG;
