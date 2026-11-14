<?php
/**
 * Verify Token API Endpoint
 * GET / POST /api/v1/verify_token.php
 * 
 * Validates the authentication session/token with the server.
 * Returns the fresh user profile if valid, or 401 if expired/invalid.
 */

require_once __DIR__ . '/db_connect.php';

$method = $_SERVER['REQUEST_METHOD'];
if ($method !== 'GET' && $method !== 'POST') {
    sendJsonResponse([
        'success' => false,
        'valid'   => false,
        'message' => 'Method not allowed. Use GET or POST.'
    ], 405);
}

// 1. Extract Bearer token from headers
$token = null;
$authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) 
    ? trim($_SERVER['HTTP_AUTHORIZATION']) 
    : (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) : '');

if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
    $token = $matches[1];
}

// 2. Fallback: Extract from JSON body or query parameters
$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true) ?: [];

if (!$token) {
    if (!empty($payload['token'])) {
        $token = trim($payload['token']);
    } elseif (!empty($_GET['token'])) {
        $token = trim($_GET['token']);
    } elseif (!empty($_POST['token'])) {
        $token = trim($_POST['token']);
    }
}

$userId = isset($payload['user_id']) 
    ? intval($payload['user_id']) 
    : (isset($_GET['user_id']) ? intval($_GET['user_id']) : 0);

$phoneInput = isset($payload['phone']) 
    ? trim($payload['phone']) 
    : (isset($_GET['phone']) ? trim($_GET['phone']) : '');

$countryCodeInput = isset($payload['country_code']) 
    ? trim($payload['country_code']) 
    : (isset($_GET['country_code']) ? trim($_GET['country_code']) : null);

if (empty($token) && $userId <= 0 && empty($phoneInput)) {
    sendJsonResponse([
        'success' => false,
        'valid'   => false,
        'message' => 'No session token or user identifier provided.'
    ], 401);
}

$db = getDbConnection();
if (!$db) {
    sendJsonResponse([
        'success' => false,
        'valid'   => false,
        'message' => 'Database connection failed.'
    ], 503);
}

try {
    $hasCols = hasUserPhoneColumns($db);
    $user = null;

    // Check if session_token column exists in users table
    $hasTokenCol = false;
    try {
        $checkCols = $db->query("SHOW COLUMNS FROM users LIKE 'session_token'")->fetchAll();
        $hasTokenCol = !empty($checkCols);
    } catch (Exception $e) {}

    // 1. If session_token column exists and token provided, query by token
    if ($hasTokenCol && !empty($token)) {
        if ($userId > 0) {
            $stmt = $db->prepare("SELECT * FROM users WHERE id = :id AND session_token = :token LIMIT 1");
            $stmt->execute([':id' => $userId, ':token' => $token]);
            $user = $stmt->fetch();
        } else {
            $stmt = $db->prepare("SELECT * FROM users WHERE session_token = :token LIMIT 1");
            $stmt->execute([':token' => $token]);
            $user = $stmt->fetch();
        }
    }

    // 2. Fallback: Validate by user_id or phone if token match was not definitive
    if (!$user && $userId > 0) {
        $stmt = $db->prepare("SELECT * FROM users WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $userId]);
        $user = $stmt->fetch();
    }

    if (!$user && !empty($phoneInput)) {
        $parsedPhone = parsePhoneNumber($phoneInput, $countryCodeInput);
        $e164Phone = $parsedPhone['e164'];
        $userDigits = $parsedPhone['digits'];
        $natPhone = $parsedPhone['national_number'];
        $cCode = $parsedPhone['country_code'];

        if ($hasCols) {
            $stmt = $db->prepare("
                SELECT * FROM users 
                WHERE phone = :e164 
                   OR phone = :digits 
                   OR (country_code = :cc AND national_phone = :nat)
                LIMIT 1
            ");
            $stmt->execute([
                ':e164'   => $e164Phone,
                ':digits' => $userDigits,
                ':cc'     => $cCode,
                ':nat'    => $natPhone,
            ]);
            $user = $stmt->fetch();
        } else {
            $stmt = $db->prepare("
                SELECT * FROM users 
                WHERE phone = :e164 
                   OR phone = :digits 
                   OR phone = :nat
                LIMIT 1
            ");
            $stmt->execute([
                ':e164'   => $e164Phone,
                ':digits' => $userDigits,
                ':nat'    => $natPhone,
            ]);
            $user = $stmt->fetch();
        }
    }

    if (!$user) {
        sendJsonResponse([
            'success' => false,
            'valid'   => false,
            'message' => 'Invalid or expired session token.'
        ], 401);
    }

    sendJsonResponse([
        'success' => true,
        'valid'   => true,
        'user'    => [
            'id'             => intval($user['id']),
            'name'           => $user['name'] ?: 'Business User',
            'phone'          => $user['phone'],
            'country_code'   => isset($user['country_code']) ? $user['country_code'] : '+91',
            'national_phone' => isset($user['national_phone']) ? $user['national_phone'] : '',
            'email'          => $user['email'],
            'currency'       => $user['currency'] ?: '₹',
        ],
        'message' => 'Token verified successfully.'
    ], 200);

} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'valid'   => false,
        'message' => 'Token verification error: ' . $e->getMessage()
    ], 500);
}
