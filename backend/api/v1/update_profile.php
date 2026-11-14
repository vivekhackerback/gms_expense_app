<?php
/**
 * Update User Profile API Endpoint
 * POST /api/v1/update_profile.php
 * 
 * Allows user to complete or edit their profile (Full Name, Business Name, Email) anytime.
 * Uses exact international phone identification to ensure tenant isolation.
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

$userId = isset($payload['user_id']) ? intval($payload['user_id']) : 0;
$phoneInput = isset($payload['phone']) ? trim($payload['phone']) : (isset($payload['mobile']) ? trim($payload['mobile']) : '');
$countryCodeInput = isset($payload['country_code']) ? trim($payload['country_code']) : null;
$name = isset($payload['name']) ? trim($payload['name']) : '';
$email = isset($payload['email']) ? trim($payload['email']) : '';

if (empty($name)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Please provide a name.'
    ], 400);
}

$db = getDbConnection();
if (!$db) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Database connection failed.'
    ], 503);
}

$parsedPhone = parsePhoneNumber($phoneInput, $countryCodeInput);
$e164Phone = $parsedPhone['e164'];
$countryCode = $parsedPhone['country_code'];
$nationalPhone = $parsedPhone['national_number'];
$userDigits = $parsedPhone['digits'];

try {
    if ($userId > 0) {
        $stmt = $db->prepare("UPDATE users SET name = :name, email = COALESCE(NULLIF(:email, ''), email), updated_at = CURRENT_TIMESTAMP WHERE id = :id");
        $stmt->execute([':name' => $name, ':email' => $email, ':id' => $userId]);
    } else {
        $stmt = $db->prepare("
            UPDATE users 
            SET name = :name, email = COALESCE(NULLIF(:email, ''), email), updated_at = CURRENT_TIMESTAMP 
            WHERE phone = :e164 
               OR phone = :digits 
               OR (country_code = :cc AND national_phone = :nat)
        ");
        $stmt->execute([
            ':name'   => $name,
            ':email'  => $email,
            ':e164'   => $e164Phone,
            ':digits' => $userDigits,
            ':cc'     => $countryCode,
            ':nat'    => $nationalPhone,
        ]);
    }

    // Fetch updated user
    $selectStmt = $db->prepare("
        SELECT id, name, phone, email, currency, country_code, national_phone 
        FROM users 
        WHERE id = :id 
           OR phone = :e164 
           OR phone = :digits 
           OR (country_code = :cc AND national_phone = :nat)
        LIMIT 1
    ");
    $selectStmt->execute([
        ':id'     => $userId,
        ':e164'   => $e164Phone,
        ':digits' => $userDigits,
        ':cc'     => $countryCode,
        ':nat'    => $nationalPhone,
    ]);
    $updatedUser = $selectStmt->fetch();

    sendJsonResponse([
        'success' => true,
        'user'    => $updatedUser,
        'message' => 'Profile updated successfully.'
    ], 200);

} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Update failed: ' . $e->getMessage()
    ], 500);
}
