-- ==============================================================================
-- GMS Expense & Khata App — MySQL 8.0+ Server Database Migration
-- Converts existing DATETIME / TIMESTAMP columns to BIGINT UNSIGNED Unix Timestamps
-- Database: gmsexpense_db
-- ==============================================================================

USE gmsexpense_db;

-- -------------------------------------------------------------
-- 1. Migrate `categories` Table
-- -------------------------------------------------------------
ALTER TABLE categories ADD COLUMN created_at_ts BIGINT UNSIGNED NULL;
UPDATE categories SET created_at_ts = UNIX_TIMESTAMP(created_at) WHERE created_at_ts IS NULL;
ALTER TABLE categories DROP COLUMN created_at;
ALTER TABLE categories CHANGE COLUMN created_at_ts created_at BIGINT UNSIGNED NOT NULL;

-- -------------------------------------------------------------
-- 2. Migrate `parties` Table
-- -------------------------------------------------------------
ALTER TABLE parties 
  ADD COLUMN created_at_ts BIGINT UNSIGNED NULL,
  ADD COLUMN updated_at_ts BIGINT UNSIGNED NULL,
  ADD COLUMN deleted_at_ts BIGINT UNSIGNED NULL;

UPDATE parties SET 
  created_at_ts = UNIX_TIMESTAMP(created_at),
  updated_at_ts = UNIX_TIMESTAMP(updated_at),
  deleted_at_ts = IF(deleted_at IS NOT NULL, UNIX_TIMESTAMP(deleted_at), NULL);

ALTER TABLE parties 
  DROP COLUMN created_at,
  DROP COLUMN updated_at,
  DROP COLUMN deleted_at;

ALTER TABLE parties 
  CHANGE COLUMN created_at_ts created_at BIGINT UNSIGNED NOT NULL,
  CHANGE COLUMN updated_at_ts updated_at BIGINT UNSIGNED NOT NULL,
  CHANGE COLUMN deleted_at_ts deleted_at BIGINT UNSIGNED NULL;

-- -------------------------------------------------------------
-- 3. Migrate `transactions` Table
-- -------------------------------------------------------------
ALTER TABLE transactions
  ADD COLUMN tx_date_ts BIGINT UNSIGNED NULL,
  ADD COLUMN client_created_at_ts BIGINT UNSIGNED NULL,
  ADD COLUMN client_updated_at_ts BIGINT UNSIGNED NULL,
  ADD COLUMN server_synced_at_ts BIGINT UNSIGNED NULL,
  ADD COLUMN deleted_at_ts BIGINT UNSIGNED NULL;

UPDATE transactions SET
  tx_date_ts = UNIX_TIMESTAMP(transaction_date),
  client_created_at_ts = UNIX_TIMESTAMP(client_created_at),
  client_updated_at_ts = UNIX_TIMESTAMP(client_updated_at),
  server_synced_at_ts = IF(server_created_at IS NOT NULL, UNIX_TIMESTAMP(server_created_at), UNIX_TIMESTAMP()),
  deleted_at_ts = IF(deleted_at IS NOT NULL, UNIX_TIMESTAMP(deleted_at), NULL);

ALTER TABLE transactions
  DROP COLUMN transaction_date,
  DROP COLUMN client_created_at,
  DROP COLUMN client_updated_at,
  DROP COLUMN server_created_at,
  DROP COLUMN server_updated_at,
  DROP COLUMN deleted_at;

ALTER TABLE transactions
  CHANGE COLUMN tx_date_ts transaction_date BIGINT UNSIGNED NOT NULL,
  CHANGE COLUMN client_created_at_ts client_created_at BIGINT UNSIGNED NOT NULL,
  CHANGE COLUMN client_updated_at_ts client_updated_at BIGINT UNSIGNED NOT NULL,
  CHANGE COLUMN server_synced_at_ts server_synced_at BIGINT UNSIGNED NULL,
  CHANGE COLUMN deleted_at_ts deleted_at BIGINT UNSIGNED NULL;

-- -------------------------------------------------------------
-- 4. Migrate `transaction_images` Table
-- -------------------------------------------------------------
ALTER TABLE transaction_images
  ADD COLUMN created_at_ts BIGINT UNSIGNED NULL,
  ADD COLUMN server_synced_at_ts BIGINT UNSIGNED NULL,
  ADD COLUMN original_file_name VARCHAR(255) NULL AFTER file_name;

UPDATE transaction_images SET
  created_at_ts = UNIX_TIMESTAMP(created_at),
  server_synced_at_ts = UNIX_TIMESTAMP(created_at);

ALTER TABLE transaction_images
  DROP COLUMN created_at;

ALTER TABLE transaction_images
  CHANGE COLUMN created_at_ts created_at BIGINT UNSIGNED NOT NULL,
  CHANGE COLUMN server_synced_at_ts server_synced_at BIGINT UNSIGNED NULL;

-- -------------------------------------------------------------
-- 5. Migrate `users` Table
-- -------------------------------------------------------------
ALTER TABLE users
  ADD COLUMN created_at_ts BIGINT UNSIGNED NULL,
  ADD COLUMN updated_at_ts BIGINT UNSIGNED NULL;

UPDATE users SET
  created_at_ts = UNIX_TIMESTAMP(created_at),
  updated_at_ts = UNIX_TIMESTAMP(updated_at);

ALTER TABLE users
  DROP COLUMN created_at,
  DROP COLUMN updated_at;

ALTER TABLE users
  CHANGE COLUMN created_at_ts created_at BIGINT UNSIGNED NOT NULL,
  CHANGE COLUMN updated_at_ts updated_at BIGINT UNSIGNED NOT NULL;

-- -------------------------------------------------------------
-- 6. Migrate `devices` Table
-- -------------------------------------------------------------
ALTER TABLE devices
  ADD COLUMN created_at_ts BIGINT UNSIGNED NULL,
  ADD COLUMN last_synced_at_ts BIGINT UNSIGNED NULL;

UPDATE devices SET
  created_at_ts = UNIX_TIMESTAMP(created_at),
  last_synced_at_ts = IF(last_synced_at IS NOT NULL, UNIX_TIMESTAMP(last_synced_at), NULL);

ALTER TABLE devices
  DROP COLUMN created_at,
  DROP COLUMN last_synced_at;

ALTER TABLE devices
  CHANGE COLUMN created_at_ts created_at BIGINT UNSIGNED NOT NULL,
  CHANGE COLUMN last_synced_at_ts last_synced_at BIGINT UNSIGNED NULL;
