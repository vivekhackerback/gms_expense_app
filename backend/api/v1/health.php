<?php
/**
 * Real Server & Database Health Check Endpoint
 * GET /api/v1/health.php
 */

require_once __DIR__ . '/db_connect.php';

$startTime = microtime(true);
$db = getDbConnection();
$mysqlConnected = ($db !== null);

$response = [
    'success'         => $mysqlConnected,
    'server'          => 'online',
    'status'          => $mysqlConnected ? 'healthy' : 'degraded',
    'php_version'     => phpversion(),
    'mysql_connected' => $mysqlConnected,
    'server_time'     => gmdate('Y-m-d\TH:i:s\Z'),
    'execution_ms'    => round((microtime(true) - $startTime) * 1000, 2),
    'message'         => $mysqlConnected 
        ? 'PHP API and MySQL database are working properly.' 
        : 'PHP server is reachable, but MySQL database connection failed.'
];

sendJsonResponse($response, $mysqlConnected ? 200 : 503);
