<?php
/**
 * Real Backup Status API Endpoint
 * GET /api/v1/backup_status.php
 */

require_once __DIR__ . '/db_connect.php';

$deviceUuid = isset($_GET['device_uuid']) ? trim($_GET['device_uuid']) : null;
$db = getDbConnection();

if (!$db) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Database connection unavailable.'
    ], 503);
}

try {
    $txCount = $db->query("SELECT COUNT(*) as count FROM transactions WHERE deleted_at IS NULL")->fetch()['count'] ?? 0;
    $imgCount = $db->query("SELECT COUNT(*) as count FROM transaction_images")->fetch()['count'] ?? 0;
    $lastTxTime = $db->query("SELECT MAX(created_at) as last_time FROM transactions")->fetch()['last_time'] ?? null;

    sendJsonResponse([
        'success'            => true,
        'server_status'      => 'online',
        'total_transactions' => intval($txCount),
        'total_images'       => intval($imgCount),
        'last_backup_time'   => $lastTxTime,
        'server_time'        => gmdate('Y-m-d\TH:i:s\Z')
    ], 200);
} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Error querying backup status: ' . $e->getMessage()
    ], 500);
}
