<?php
/**
 * Real UPI Info & Version Check Endpoint
 * GET /api/v1/get_upi.php
 * 
 * Supports lightweight server-side updated_at version check.
 * Query Params:
 *   ?client_updated_at=YYYY-MM-DD HH:MM:SS
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
    // 1. Ensure table exists with automatic updated_at timestamping
    $db->exec("CREATE TABLE IF NOT EXISTS `upi_info` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `upi_id` VARCHAR(255) NOT NULL,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // 2. Fetch the latest UPI row using prepared statement
    $stmt = $db->prepare("SELECT id, upi_id, updated_at FROM upi_info ORDER BY updated_at DESC, id DESC LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        sendJsonResponse([
            'success' => false,
            'message' => 'No UPI ID configured on server.'
        ], 404);
    }

    $serverUpiId = trim($row['upi_id']);
    $serverUpdatedAt = trim($row['updated_at']);

    // 3. Lightweight check: Compare client's local updated_at timestamp
    $clientUpdatedAt = isset($_GET['client_updated_at']) ? trim($_GET['client_updated_at']) : null;

    if ($clientUpdatedAt !== null && $clientUpdatedAt !== '' && $clientUpdatedAt === $serverUpdatedAt) {
        // Timestamps match: Configuration has NOT changed
        sendJsonResponse([
            'success'    => true,
            'changed'    => false,
            'updated_at' => $serverUpdatedAt
        ], 200);
    }

    // Timestamps do NOT match (or first fetch): Return latest upi_id and timestamp
    sendJsonResponse([
        'success'    => true,
        'changed'    => true,
        'upi_id'     => $serverUpiId,
        'updated_at' => $serverUpdatedAt
    ], 200);

} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Server error while checking UPI info: ' . $e->getMessage()
    ], 500);
}
