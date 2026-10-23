<?php
/**
 * Database Connection & Global Configuration Helper
 * GMS Expense & Khata App Backend
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-App-Version, X-Platform');
header('Content-Type: application/json; charset=UTF-8');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database Credentials (Update with your live MySQL settings)
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'gmsexpense_db');
define('DB_USER', getenv('DB_USER') ?: 'gmsexpense_user');
define('DB_PASS', getenv('DB_PASS') ?: 'your_mysql_password_here');
define('DB_CHARSET', 'utf8mb4');

$GLOBALS['db_connection_error'] = null;

function getDbConnection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    if (defined('DB_PASS') && DB_PASS === 'your_mysql_password_here') {
        $GLOBALS['db_connection_error'] = "DB_PASS is set to placeholder 'your_mysql_password_here' in db_connect.php. Please set your MySQL database password.";
    }

    $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $pdo;
    } catch (PDOException $e) {
        $GLOBALS['db_connection_error'] = $e->getMessage();
        return null;
    }
}

function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit();
}
