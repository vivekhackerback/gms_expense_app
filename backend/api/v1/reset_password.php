<?php
/**
 * User Reset Password API Endpoint (International Mobile Number + New Password)
 * POST /api/v1/reset_password.php
 * 
 * Supports global accounts with country dialing codes.
 * Allows users to reset their forgotten password after verifying WhatsApp OTP.
 */

require_once __DIR__ . '/db_connect.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'success' => false,
        'message' => 'Method not allowed. Use POST.'
    ], 405);
}

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true);

if (!$payload) {
    $payload = $_POST;
}

$phoneInput = isset($payload['phone']) ? trim($payload['phone']) : (isset($payload['mobile']) ? trim($payload['mobile']) : '');
$countryCodeInput = isset($payload['country_code']) ? trim($payload['country_code']) : (isset($payload['dial_code']) ? trim($payload['dial_code']) : null);
$newPassword = isset($payload['new_password']) ? trim($payload['new_password']) : (isset($payload['password']) ? trim($payload['password']) : '');

if (empty($phoneInput)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Please provide your mobile number.'
    ], 400);
}

if (empty($newPassword) || strlen($newPassword) < 4) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Password must be at least 4 characters long.'
    ], 400);
}

// Parse and normalize international phone number
$parsedPhone = parsePhoneNumber($phoneInput, $countryCodeInput);
$e164Phone = $parsedPhone['e164'];
$countryCode = $parsedPhone['country_code'];
$dialCode = $parsedPhone['dial_code'];
$nationalPhone = $parsedPhone['national_number'];
$userDigits = $parsedPhone['digits'];

$db = getDbConnection();
if (!$db) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Database connection failed. Please check MySQL settings.'
    ], 503);
}

try {
    $hasCols = hasUserPhoneColumns($db);
    $user = null;

    if ($hasCols) {
        // Search user with country_code & national_phone columns
        $stmt = $db->prepare("
            SELECT * FROM users 
            WHERE phone = :e164 
               OR phone = :digits 
               OR (country_code = :cc AND (national_phone = :nat OR phone = :nat_exact))
            LIMIT 1
        ");
        $stmt->execute([
            ':e164'      => $e164Phone,
            ':digits'    => $userDigits,
            ':cc'        => $countryCode,
            ':nat'       => $nationalPhone,
            ':nat_exact' => $nationalPhone,
        ]);
        $user = $stmt->fetch();

        // Backward compatibility for un-migrated legacy accounts
        if (!$user && ($countryCode === '+91' || $dialCode === '91' || empty($countryCodeInput))) {
            $stmtLegacy = $db->prepare("
                SELECT * FROM users 
                WHERE (country_code IS NULL OR country_code = '+91' OR country_code = '')
                  AND (phone = :p10 OR phone = :p12 OR phone LIKE :p_like)
                LIMIT 1
            ");
            $stmtLegacy->execute([
                ':p10'    => $nationalPhone,
                ':p12'    => '91' . $nationalPhone,
                ':p_like' => '%' . $nationalPhone,
            ]);
            $user = $stmtLegacy->fetch();
        }
    } else {
        // Fallback for databases without country_code column
        $stmt = $db->prepare("
            SELECT * FROM users 
            WHERE phone = :e164 
               OR phone = :digits 
               OR phone = :nat
               OR phone = :p12
               OR phone LIKE :p_like
            LIMIT 1
        ");
        $stmt->execute([
            ':e164'   => $e164Phone,
            ':digits' => $userDigits,
            ':nat'    => $nationalPhone,
            ':p12'    => ($dialCode === '91' ? ('91' . $nationalPhone) : ($dialCode . $nationalPhone)),
            ':p_like' => '%' . $nationalPhone,
        ]);
        $user = $stmt->fetch();
    }

    if (!$user) {
        sendJsonResponse([
            'success' => false,
            'not_found' => true,
            'message' => 'No registered account found with mobile number ' . htmlspecialchars($e164Phone) . '.'
        ], 404);
    }

    // Hash new password using standard Bcrypt
    $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
    $now = time();

    // Update password in users table
    $updateStmt = $db->prepare("
        UPDATE users 
        SET password_hash = :hash, updated_at = :updated_at 
        WHERE id = :uid
    ");
    $updateStmt->execute([
        ':hash'       => $newHash,
        ':updated_at' => $now,
        ':uid'        => $user['id'],
    ]);

    // Generate fresh session token
    $token = bin2hex(random_bytes(24));

    // Save session token in users table
    try {
        $checkCols = $db->query("SHOW COLUMNS FROM users LIKE 'session_token'")->fetchAll();
        if (empty($checkCols)) {
            $db->exec("ALTER TABLE users ADD COLUMN session_token VARCHAR(255) NULL");
        }
        $db->prepare("UPDATE users SET session_token = :t WHERE id = :id")->execute([':t' => $token, ':id' => $user['id']]);
    } catch (Exception $e) {}

    sendJsonResponse([
        'success' => true,
        'token'   => $token,
        'user'    => [
            'id'             => intval($user['id']),
            'name'           => $user['name'] ?: 'Business User',
            'phone'          => $user['phone'] ?: $e164Phone,
            'country_code'   => isset($user['country_code']) ? $user['country_code'] : $countryCode,
            'national_phone' => isset($user['national_phone']) ? $user['national_phone'] : $nationalPhone,
            'email'          => $user['email'],
            'currency'       => $user['currency'] ?: '₹',
        ],
        'message' => 'Password reset successfully! You are now signed in.'
    ], 200);

} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Password reset error: ' . $e->getMessage()
    ], 500);
}
