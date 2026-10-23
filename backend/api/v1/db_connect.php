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

// Search and load .env file if present
$envCandidatePaths = [
    __DIR__ . '/.env',
    dirname(__DIR__, 1) . '/.env',
    dirname(__DIR__, 2) . '/.env',
    dirname(__DIR__, 3) . '/.env',
    (isset($_SERVER['DOCUMENT_ROOT']) && $_SERVER['DOCUMENT_ROOT']) ? ($_SERVER['DOCUMENT_ROOT'] . '/.env') : null,
];

foreach ($envCandidatePaths as $envPath) {
    if ($envPath && file_exists($envPath) && is_readable($envPath)) {
        $envLines = @file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($envLines) {
            foreach ($envLines as $line) {
                $line = trim($line);
                if (empty($line) || strpos($line, '#') === 0) continue;
                if (strpos($line, '=') !== false) {
                    list($envKey, $envVal) = explode('=', $line, 2);
                    $envKey = trim($envKey);
                    $envVal = trim($envVal, " \t\n\r\0\x0B\"'");
                    if (!empty($envVal) && !getenv($envKey)) {
                        putenv("$envKey=$envVal");
                        $_ENV[$envKey] = $envVal;
                    }
                }
            }
            break;
        }
    }
}

// Database Credentials (Hostinger MySQL Settings)
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'u109731178_expense_db');
define('DB_USER', getenv('DB_USER') ?: 'u109731178_expense_user'); // Update with your exact Hostinger user if different
define('DB_PASS', getenv('DB_PASS') ?: 'your_mysql_password_here'); // Set your Hostinger database password
define('DB_CHARSET', 'utf8mb4');

$GLOBALS['db_connection_error'] = null;

function getDbConnection() {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    if (defined('DB_PASS') && DB_PASS === 'your_mysql_password_here') {
        $GLOBALS['db_connection_error'] = "DB_PASS is still set to placeholder 'your_mysql_password_here' in db_connect.php. Please set your Hostinger database password.";
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
        // If localhost failed (common UNIX socket issue on cPanel/Hostinger), try 127.0.0.1 TCP connection
        if (DB_HOST === 'localhost') {
            try {
                $tcpDsn = "mysql:host=127.0.0.1;port=3306;dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
                $pdo = new PDO($tcpDsn, DB_USER, DB_PASS, $options);
                $GLOBALS['db_connection_error'] = null;
                return $pdo;
            } catch (PDOException $tcpEx) {
                $GLOBALS['db_connection_error'] = $e->getMessage() . " (TCP fallback: " . $tcpEx->getMessage() . ")";
            }
        }
        return null;
    }
}

function sendJsonResponse($data, $statusCode = 200) {
    http_response_code($statusCode);
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    exit();
}
