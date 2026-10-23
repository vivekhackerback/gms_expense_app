<?php
/**
 * API Health & Router Verification Endpoint
 * GET /api/v1/api_health.php
 */

require_once __DIR__ . '/db_connect.php';

$startTime = microtime(true);
$db = getDbConnection();
$mysqlConnected = ($db !== null);

sendJsonResponse([
    'success'         => true,
    'status'          => 'healthy',
    'service'         => 'REST API Gateway v1',
    'api_version'     => 'v1',
    'endpoints'       => [
        'server_health'     => 'health.php',
        'transactions_sync' => 'transactions_sync.php',
        'image_upload'      => 'image_upload.php',
        'backup_status'     => 'backup_status.php',
        'backup_manifest'   => 'backup_manifest.php',
        'database_download' => 'download_database.php',
    ],
    'mysql_connected' => $mysqlConnected,
    'server_time'     => time(),
    'execution_ms'    => round((microtime(true) - $startTime) * 1000, 2),
    'message'         => 'API Gateway v1 routes are active and operational.'
], 200);
