<?php
/**
 * User Registration API Endpoint (Mobile Number + Password First)
 * POST /api/v1/register.php
 * 
 * Allows instant account creation with just Mobile Number & Password.
 * User profile (Full name, Business details, Email) can be completed later.
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

$phone = isset($payload['phone']) ? trim($payload['phone']) : (isset($payload['mobile']) ? trim($payload['mobile']) : '');
$password = isset($payload['password']) ? trim($payload['password']) : '';
$name = isset($payload['name']) ? trim($payload['name']) : '';
$email = isset($payload['email']) ? trim($payload['email']) : '';
$currency = isset($payload['currency']) ? trim($payload['currency']) : '₹';

// Clean mobile number
$cleanPhone = preg_replace('/[^0-9]/', '', $phone);
if (strlen($cleanPhone) === 12 && substr($cleanPhone, 0, 2) === '91') {
    $cleanPhone = substr($cleanPhone, 2);
}

if (empty($cleanPhone) || strlen($cleanPhone) < 10) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Please enter a valid 10-digit mobile number.'
    ], 400);
}

if (empty($password) || strlen($password) < 4) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Password must be at least 4 characters long.'
    ], 400);
}

// If name is empty, assign a friendly default (can be updated later in profile)
if (empty($name)) {
    $name = 'User ' . substr($cleanPhone, -4);
}

if (empty($email)) {
    $email = $cleanPhone . '@gmsexpense.local';
}

$db = getDbConnection();
if (!$db) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Database connection failed. Please check MySQL settings.'
    ], 503);
}

try {
    // Check if phone already registered
    $stmt = $db->prepare("SELECT id, phone, email FROM users WHERE phone = :phone OR phone LIKE :phone_like LIMIT 1");
    $stmt->execute([
        ':phone'      => $cleanPhone,
        ':phone_like' => '%' . $cleanPhone,
    ]);
    $existing = $stmt->fetch();

    if ($existing) {
        sendJsonResponse([
            'success' => false,
            'message' => 'An account with mobile number ' . htmlspecialchars($cleanPhone) . ' already exists. Please sign in instead.'
        ], 409);
    }

    // Hash Password
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);

    // Insert new user
    $insertStmt = $db->prepare("
        INSERT INTO users (name, phone, email, password_hash, currency, created_at)
        VALUES (:name, :phone, :email, :password_hash, :currency, CURRENT_TIMESTAMP)
    ");
    $insertStmt->execute([
        ':name'          => $name,
        ':phone'         => $cleanPhone,
        ':email'         => $email,
        ':password_hash' => $passwordHash,
        ':currency'      => $currency
    ]);

    $userId = intval($db->lastInsertId());
    $token = bin2hex(random_bytes(24));

    sendJsonResponse([
        'success' => true,
        'token'   => $token,
        'user'    => [
            'id'       => $userId,
            'name'     => $name,
            'phone'    => $cleanPhone,
            'email'    => $email,
            'currency' => $currency
        ],
        'message' => 'Account created successfully! You can complete your profile anytime.'
    ], 201);

} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Registration error: ' . $e->getMessage()
    ], 500);
}
