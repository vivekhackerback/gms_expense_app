<?php
/**
 * Real UPI Info API Endpoint
 * GET /api/v1/get_upi.php
 * 
 * Returns latest upi_id and updated_at timestamp.
 */

require_once __DIR__ . '/db_connect.php';

$db = getDbConnection();

if (!$db) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Database connection unavailable.'
    ], 503);
}

try {
    // Ensure table exists on server
    $db->exec("CREATE TABLE IF NOT EXISTS `upi_info` (
        `id` INT AUTO_INCREMENT PRIMARY KEY,
        `upi_id` VARCHAR(255) NOT NULL,
        `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;");

    // Fetch latest upi_id ordered by updated_at descending
    $stmt = $db->query("SELECT id, upi_id, updated_at FROM upi_info ORDER BY updated_at DESC, id DESC LIMIT 1");
    $row = $stmt->fetch();

    if (!$row) {
        // Seed initial record if empty
        $db->exec("INSERT INTO `upi_info` (`id`, `upi_id`, `updated_at`) VALUES (NULL, '8651615629-2@ybl', '2026-10-25 03:32:08')");
        $stmt = $db->query("SELECT id, upi_id, updated_at FROM upi_info ORDER BY updated_at DESC, id DESC LIMIT 1");
        $row = $stmt->fetch();
    }

    sendJsonResponse([
        'success'    => true,
        'data'       => [
            'id'         => intval($row['id']),
            'upi_id'     => trim($row['upi_id']),
            'updated_at' => trim($row['updated_at'])
        ],
        'message'    => 'Latest UPI information fetched successfully.'
    ], 200);
} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Error querying upi_info: ' . $e->getMessage()
    ], 500);
}
