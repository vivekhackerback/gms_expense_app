-- ==============================================================================
-- GMS Expense & Khata App — MySQL 8.0+ Server Database Schema
-- Database: gmsexpense_db
-- ==============================================================================

CREATE DATABASE IF NOT EXISTS gmsexpense_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE gmsexpense_db;

-- 1. Users (Tenants)
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NULL,
  currency VARCHAR(10) DEFAULT '₹',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Devices Registered
CREATE TABLE IF NOT EXISTS devices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  device_uuid VARCHAR(100) UNIQUE NOT NULL,
  device_name VARCHAR(100) NULL,
  last_synced_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Khata Parties / Contacts
CREATE TABLE IF NOT EXISTS parties (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  client_uuid CHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  UNIQUE KEY uq_user_party_uuid (user_id, client_uuid),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Categories
CREATE TABLE IF NOT EXISTS categories (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(100) DEFAULT 'grid-outline',
  color VARCHAR(20) DEFAULT '#64748B',
  is_custom TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Transactions Ledger
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  client_uuid CHAR(36) NOT NULL,
  party_id BIGINT UNSIGNED NULL,
  category_id BIGINT UNSIGNED NULL,
  type ENUM('gave', 'got') NOT NULL,
  payment_mode ENUM('cash', 'online') NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  note TEXT NULL,
  transaction_date DATETIME NOT NULL,
  client_created_at DATETIME NOT NULL,
  client_updated_at DATETIME NOT NULL,
  server_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  server_updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  UNIQUE KEY uq_user_tx_uuid (user_id, client_uuid),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_date (user_id, transaction_date),
  INDEX idx_user_type (user_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Transaction Receipt Images
CREATE TABLE IF NOT EXISTS transaction_images (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  transaction_uuid CHAR(36) NOT NULL,
  storage_url VARCHAR(1024) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes INT UNSIGNED NULL,
  mime_type VARCHAR(50) DEFAULT 'image/jpeg',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_tx_uuid (transaction_uuid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Sync Audit Logs
CREATE TABLE IF NOT EXISTS sync_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  device_uuid VARCHAR(100) NOT NULL,
  batch_count INT UNSIGNED NOT NULL,
  status ENUM('success', 'partial', 'failed') NOT NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed initial test user
INSERT INTO users (id, name, email, password_hash, phone) 
VALUES (1, 'GMS Admin', 'admin@gmsexpense.tplpro.in', '$2y$10$abcdefghijklmnopqrstuv', '9876543210')
ON DUPLICATE KEY UPDATE name = VALUES(name);
