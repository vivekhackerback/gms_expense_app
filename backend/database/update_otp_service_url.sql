-- ==============================================================================
-- Migration / URL Update Guide for WhatsApp OTP Gateway
-- Database: gmsexpense_db / u109731178_expense_db
-- ==============================================================================
--
-- Whenever you migrate your OTP service to a new domain or server,
-- you DO NOT need to modify the mobile application or release an update.
--
-- Simply execute the SQL query below in phpMyAdmin or MySQL console.
-- The server and all installed mobile applications will automatically
-- detect the new base URL and switch to it immediately.
--

USE gmsexpense_db;

-- 1. Example: Migrate to a new domain or endpoint
UPDATE `otp_domain`
SET
  `domain`       = 'https://otp.losttag.in',          -- Replace with your new domain
  `api_base_url` = 'https://otp.losttag.in/api/v1',   -- Replace with your new API Base URL
  `api_key`      = '',                                -- Replace with your new X-API-Key if applicable
  `api_secret`   = '',                                -- Replace with your new secret if using HMAC
  `purpose`      = 'Verification',                    -- Keep <= 15 chars for Meta template limit
  `otp_update`   = `otp_update` + 1,                  -- Increments version so all client apps auto-refresh
  `updated_at`   = CURRENT_TIMESTAMP
WHERE `id` = 1;

-- 2. Verify current active OTP configuration
SELECT 
  `id`,
  `domain`,
  `api_base_url`,
  `api_key`,
  `template_name`,
  `purpose`,
  `status`,
  `otp_update`,
  `updated_at`
FROM `otp_domain`
WHERE `id` = 1;
