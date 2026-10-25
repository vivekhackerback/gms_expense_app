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
    // 1. Ensure table exists with upi_update column
    $db->exec("CREATE TABLE IF NOT EXISTS `upi_info` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `upi_id` VARCHAR(255) NOT NULL,
        `upi_update` INT NOT NULL DEFAULT 1,
        `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Dynamic column check in case table was created previously without upi_update
    try {
        $checkCol = $db->query("SHOW COLUMNS FROM `upi_info` LIKE 'upi_update'");
        if ($checkCol && $checkCol->rowCount() === 0) {
            $db->exec("ALTER TABLE `upi_info` ADD COLUMN `upi_update` INT NOT NULL DEFAULT 1;");
        }
    } catch (Exception $colEx) {
        // Ignored if column already exists
    }

    // 2. Fetch the latest UPI row by upi_update and id
    $stmt = $db->prepare("SELECT id, upi_id, upi_update, updated_at FROM upi_info ORDER BY upi_update DESC, id DESC LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row) {
        sendJsonResponse([
            'success' => false,
            'message' => 'No UPI ID configured on server.'
        ], 404);
    }

    $serverUpiId = trim($row['upi_id']);
    $serverUpiUpdate = isset($row['upi_update']) ? (int)$row['upi_update'] : 1;
    $serverUpdatedAt = isset($row['updated_at']) ? trim($row['updated_at']) : '';

    // 3. Check client_upi_update parameter
    $clientUpiUpdate = isset($_GET['client_upi_update']) && is_numeric($_GET['client_upi_update'])
        ? (int)$_GET['client_upi_update']
        : null;

    if ($clientUpiUpdate !== null && $serverUpiUpdate <= $clientUpiUpdate) {
        // upi_update has NOT increased: Return lightweight response without fetching upi_id again
        sendJsonResponse([
            'success'    => true,
            'changed'    => false,
            'upi_update' => $serverUpiUpdate
        ], 200);
    }

    // upi_update has increased (or first fetch): Return latest upi_id and upi_update
    sendJsonResponse([
        'success'    => true,
        'changed'    => true,
        'upi_id'     => $serverUpiId,
        'upi_update' => $serverUpiUpdate,
        'updated_at' => $serverUpdatedAt
    ], 200);

} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Server error while checking UPI info: ' . $e->getMessage()
    ], 500);
}
