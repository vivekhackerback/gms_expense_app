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
    $txCount = 0;
    try {
        $txRow = $db->query("SELECT COUNT(*) as count FROM transactions WHERE deleted_at IS NULL")->fetch();
        $txCount = $txRow ? intval($txRow['count']) : 0;
    } catch (Exception $e) {
        try {
            $txRow = $db->query("SELECT COUNT(*) as count FROM transactions")->fetch();
            $txCount = $txRow ? intval($txRow['count']) : 0;
        } catch (Exception $e2) {}
    }

    $imgCount = 0;
    try {
        $imgRow = $db->query("SELECT COUNT(*) as count FROM transaction_images")->fetch();
        $imgCount = $imgRow ? intval($imgRow['count']) : 0;
    } catch (Exception $e) {}

    $lastTxTime = null;
    try {
        $lastRow = $db->query("SELECT MAX(COALESCE(server_synced_at, client_created_at, transaction_date)) as last_time FROM transactions")->fetch();
        $lastTxTime = $lastRow ? $lastRow['last_time'] : null;
    } catch (Exception $e) {
        try {
            $lastRow = $db->query("SELECT MAX(id) as last_time FROM transactions")->fetch();
            $lastTxTime = $lastRow ? $lastRow['last_time'] : null;
        } catch (Exception $e2) {}
    }

    sendJsonResponse([
        'success'            => true,
        'status'             => 'healthy',
        'server_status'      => 'online',
        'service'            => 'Backup Status Service',
        'total_transactions' => intval($txCount),
        'total_images'       => intval($imgCount),
        'last_backup_time'   => $lastTxTime ? (is_numeric($lastTxTime) ? intval($lastTxTime) : strtotime($lastTxTime)) : null,
        'server_time'        => time(),
        'message'            => 'Backup service is active with ' . intval($txCount) . ' recorded transactions.'
    ], 200);
} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'status'  => 'failed',
        'message' => 'Error querying backup status: ' . $e->getMessage()
    ], 500);
}
