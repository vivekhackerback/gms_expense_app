-- ==============================================================================
-- Migration: Add `otp_domain` Table to MySQL Database
-- Gateway Integration Reference: https://otp.losttag.in/docs
-- Database: gmsexpense_db / u109731178_expense_db
-- ==============================================================================

USE gmsexpense_db;

-- 9. WhatsApp OTP Gateway Domain Configuration Table
CREATE TABLE IF NOT EXISTS `otp_domain` (
  `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `domain` VARCHAR(255) NOT NULL DEFAULT 'https://otp.losttag.in',
  `api_base_url` VARCHAR(255) NOT NULL DEFAULT 'https://otp.losttag.in/api/v1',
  `api_key` VARCHAR(255) NULL COMMENT 'X-API-Key provisioned for gateway access',
  `api_secret` VARCHAR(255) NULL COMMENT 'API Secret for HMAC-SHA256 signature verification',
  `sender_phone_id` VARCHAR(100) NULL COMMENT 'Meta WhatsApp Phone ID if applicable',
  `template_name` VARCHAR(100) NOT NULL DEFAULT 'otp_service' COMMENT 'WhatsApp template name approved in Zixflow/Meta',
  `purpose` VARCHAR(100) NOT NULL DEFAULT 'Verification' COMMENT 'Default purpose message for OTP (max 15 chars per Meta #132018)',
  `expiry_seconds` INT UNSIGNED NOT NULL DEFAULT 300 COMMENT 'OTP validity duration in seconds (default: 5 minutes)',
  `resend_cooldown` INT UNSIGNED NOT NULL DEFAULT 60 COMMENT 'Seconds user must wait before resending OTP',
  `max_attempts` INT UNSIGNED NOT NULL DEFAULT 5 COMMENT 'Maximum invalid verification attempts allowed',
  `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `otp_update` INT NOT NULL DEFAULT 1 COMMENT 'Incrementing version counter for client sync check',
  `created_at` BIGINT UNSIGNED NOT NULL,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seed initial OTP gateway configuration row
INSERT INTO `otp_domain` (
  `id`,
  `domain`,
  `api_base_url`,
  `api_key`,
  `api_secret`,
  `sender_phone_id`,
  `template_name`,
  `purpose`,
  `expiry_seconds`,
  `resend_cooldown`,
  `max_attempts`,
  `status`,
  `is_active`,
  `otp_update`,
  `created_at`
) VALUES (
  1,
  'https://otp.losttag.in',
  'https://otp.losttag.in/api/v1',
  '',
  '',
  '1432742293247493',
  'otp_service',
  'Verification',
  300,
  60,
  5,
  'active',
  1,
  1,
  UNIX_TIMESTAMP()
)
ON DUPLICATE KEY UPDATE
  `domain` = VALUES(`domain`),
  `api_base_url` = VALUES(`api_base_url`),
  `template_name` = VALUES(`template_name`),
  `expiry_seconds` = VALUES(`expiry_seconds`),
  `resend_cooldown` = VALUES(`resend_cooldown`),
  `max_attempts` = VALUES(`max_attempts`),
  `otp_update` = VALUES(`otp_update`);
