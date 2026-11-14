<?php
/**
 * WhatsApp OTP Gateway Domain Configuration & Version Check Endpoint
 * GET /api/v1/get_otp_domain.php
 * 
 * Integration Documentation: https://otp.losttag.in/docs
 * 
 * Supports lightweight server-side updated_at and otp_update version check.
 * Query Params:
 *   ?client_otp_update=1
 */

require_once __DIR__ . '/db_connect.php';

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$db = getDbConnection();

if (!$db) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Database connection unavailable.'
    ], 503);
}

try {
    // 1. Ensure table exists (Self-healing schema)
    $db->exec("CREATE TABLE IF NOT EXISTS `otp_domain` (
        `id` INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        `domain` VARCHAR(255) NOT NULL DEFAULT 'https://otp.losttag.in',
        `api_base_url` VARCHAR(255) NOT NULL DEFAULT 'https://otp.losttag.in/api/v1',
        `api_key` VARCHAR(255) NULL,
        `api_secret` VARCHAR(255) NULL,
        `sender_phone_id` VARCHAR(100) NULL,
        `template_name` VARCHAR(100) NOT NULL DEFAULT 'otp_service',
        `purpose` VARCHAR(100) NOT NULL DEFAULT 'Verification',
        `expiry_seconds` INT UNSIGNED NOT NULL DEFAULT 300,
        `resend_cooldown` INT UNSIGNED NOT NULL DEFAULT 60,
        `max_attempts` INT UNSIGNED NOT NULL DEFAULT 5,
        `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
        `is_active` TINYINT(1) NOT NULL DEFAULT 1,
        `otp_update` INT NOT NULL DEFAULT 1,
        `created_at` BIGINT UNSIGNED NOT NULL DEFAULT 0,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;");

    // Dynamic column checks if upgraded from earlier version
    $columnsToCheck = [
        'api_base_url'    => "VARCHAR(255) NOT NULL DEFAULT 'https://otp.losttag.in/api/v1'",
        'sender_phone_id' => "VARCHAR(100) NULL",
        'template_name'   => "VARCHAR(100) NOT NULL DEFAULT 'otp_service'",
        'purpose'         => "VARCHAR(100) NOT NULL DEFAULT 'Verification'",
        'expiry_seconds'  => "INT UNSIGNED NOT NULL DEFAULT 300",
        'resend_cooldown' => "INT UNSIGNED NOT NULL DEFAULT 60",
        'max_attempts'    => "INT UNSIGNED NOT NULL DEFAULT 5",
        'otp_update'      => "INT NOT NULL DEFAULT 1",
    ];

    foreach ($columnsToCheck as $col => $def) {
        try {
            $checkCol = $db->query("SHOW COLUMNS FROM `otp_domain` LIKE '{$col}'");
            if ($checkCol && $checkCol->rowCount() === 0) {
                $db->exec("ALTER TABLE `otp_domain` ADD COLUMN `{$col}` {$def};");
            }
        } catch (Exception $colEx) {
            // Ignored
        }
    }

    // 2. Fetch the latest active OTP domain record
    $stmt = $db->prepare("SELECT * FROM otp_domain WHERE is_active = 1 OR status = 'active' ORDER BY updated_at DESC, id DESC LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    // If no row exists, insert the default record
    if (!$row) {
        $nowTs = time();
        $insertStmt = $db->prepare("INSERT INTO otp_domain (
            id, domain, api_base_url, api_key, sender_phone_id, template_name, purpose, expiry_seconds, resend_cooldown, max_attempts, status, is_active, otp_update, created_at
        ) VALUES (
            1, 'https://otp.losttag.in', 'https://otp.losttag.in/api/v1', '', '1432742293247493', 'otp_service', 'Verification', 300, 60, 5, 'active', 1, 1, :created_at
        )");
        $insertStmt->execute([':created_at' => $nowTs]);

        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
    }

    $serverDomain = trim($row['domain'] ?? 'https://otp.losttag.in');
    $serverApiBaseUrl = trim($row['api_base_url'] ?? 'https://otp.losttag.in/api/v1');
    $serverOtpUpdate = isset($row['otp_update']) ? (int)$row['otp_update'] : 1;
    $serverUpdatedAt = isset($row['updated_at']) ? trim($row['updated_at']) : '';
    $serverPurpose = trim($row['purpose'] ?? 'Verification');
    if ($serverPurpose === 'Account Registration') {
        $serverPurpose = 'Registration';
    } elseif ($serverPurpose === 'Login Verification') {
        $serverPurpose = 'Verification';
    }
    if (mb_strlen($serverPurpose) > 15) {
        $serverPurpose = mb_substr($serverPurpose, 0, 15);
    }

    // Check client_otp_update and client_base_url parameters to detect any database migrations
    $clientOtpUpdate = isset($_GET['client_otp_update']) && is_numeric($_GET['client_otp_update'])
        ? (int)$_GET['client_otp_update']
        : null;
    $clientBaseUrl = isset($_GET['client_base_url']) ? trim($_GET['client_base_url']) : null;

    $isChanged = ($clientOtpUpdate === null 
        || $serverOtpUpdate > $clientOtpUpdate 
        || ($clientBaseUrl !== null && rtrim($clientBaseUrl, '/') !== rtrim($serverApiBaseUrl, '/')));

    // Never expose private API secret in public client endpoint
    sendJsonResponse([
        'success'         => true,
        'changed'         => $isChanged,
        'domain'          => $serverDomain,
        'api_base_url'    => $serverApiBaseUrl,
        'template_name'   => $row['template_name'] ?? 'otp_service',
        'purpose'         => $serverPurpose,
        'expiry_seconds'  => (int)($row['expiry_seconds'] ?? 300),
        'resend_cooldown' => (int)($row['resend_cooldown'] ?? 60),
        'max_attempts'    => (int)($row['max_attempts'] ?? 5),
        'status'          => $row['status'] ?? 'active',
        'otp_update'      => $serverOtpUpdate,
        'updated_at'      => $serverUpdatedAt,
    ], 200);

} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Server error while checking OTP domain config: ' . $e->getMessage()
    ], 500);
}
