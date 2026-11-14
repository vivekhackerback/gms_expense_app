-- ==============================================================================
-- Migration: Add International Phone Support & Unique Constraint
-- GMS Expense & Khata App Backend
-- ==============================================================================

USE gmsexpense_db;

-- 1. Add country_code and national_phone columns if not already present
SET @dbname = DATABASE();
SET @tablename = 'users';

-- Add country_code column
SET @precheck = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname 
      AND TABLE_NAME = @tablename 
      AND COLUMN_NAME = 'country_code'
);
SET @sql = IF(@precheck = 0, 
    'ALTER TABLE users ADD COLUMN country_code VARCHAR(10) NOT NULL DEFAULT "+91" AFTER password_hash', 
    'SELECT "country_code column already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add national_phone column
SET @precheck = (
    SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname 
      AND TABLE_NAME = @tablename 
      AND COLUMN_NAME = 'national_phone'
);
SET @sql = IF(@precheck = 0, 
    'ALTER TABLE users ADD COLUMN national_phone VARCHAR(25) NULL AFTER phone', 
    'SELECT "national_phone column already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Modify phone column to VARCHAR(25) to comfortably store international E.164 strings (+918651615629)
ALTER TABLE users MODIFY COLUMN phone VARCHAR(25) NOT NULL;

-- 2. Migrate existing phone numbers to normalized E.164 (+<dial_code><national_phone>)
-- For records where phone does not begin with '+' (legacy Indian numbers)
UPDATE users
SET 
    national_phone = CASE 
        WHEN phone REGEXP '^[0-9]+$' AND LENGTH(phone) = 12 AND phone LIKE '91%' THEN SUBSTRING(phone, 3)
        WHEN phone REGEXP '^[0-9]+$' THEN phone
        ELSE REGEXP_REPLACE(phone, '[^0-9]', '')
    END,
    country_code = '+91'
WHERE (phone NOT LIKE '+%' OR national_phone IS NULL OR national_phone = '');

UPDATE users
SET phone = CONCAT('+91', national_phone)
WHERE phone NOT LIKE '+%' AND national_phone IS NOT NULL AND national_phone != '';

-- For records already having '+' in phone, populate national_phone if empty
UPDATE users
SET national_phone = REGEXP_REPLACE(phone, '^\\+[0-9]{1,3}', '')
WHERE phone LIKE '+%' AND (national_phone IS NULL OR national_phone = '');

-- 3. Add UNIQUE constraint to phone column (prevent duplicate international accounts)
SET @index_exists = (
    SELECT COUNT(*) FROM information_schema.STATISTICS 
    WHERE TABLE_SCHEMA = @dbname 
      AND TABLE_NAME = @tablename 
      AND INDEX_NAME = 'uq_user_phone'
);
SET @sql_idx = IF(@index_exists = 0,
    'ALTER TABLE users ADD UNIQUE KEY uq_user_phone (phone)',
    'SELECT "uq_user_phone index already exists" AS message'
);
PREPARE stmt_idx FROM @sql_idx;
EXECUTE stmt_idx;
DEALLOCATE PREPARE stmt_idx;
