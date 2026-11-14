<?php
/**
 * User Registration API Endpoint (International Mobile Number + Password First)
 * POST /api/v1/register.php
 * 
 * Supports global accounts with country dialing codes.
 * Ensures users with identical local mobile numbers from different countries
 * are treated as completely independent accounts (e.g. +91 8651615629 vs +1 8651615629).
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
$password = isset($payload['password']) ? trim($payload['password']) : '';
$name = isset($payload['name']) ? trim($payload['name']) : '';
$email = isset($payload['email']) ? trim($payload['email']) : '';
$currency = isset($payload['currency']) ? trim($payload['currency']) : '₹';

// Parse and normalize international phone number
$parsedPhone = parsePhoneNumber($phoneInput, $countryCodeInput);
$e164Phone = $parsedPhone['e164'];
$countryCode = $parsedPhone['country_code'];
$dialCode = $parsedPhone['dial_code'];
$nationalPhone = $parsedPhone['national_number'];
$userDigits = $parsedPhone['digits'];

// Validate national phone length
if (empty($nationalPhone) || strlen($nationalPhone) < 5) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Please enter a valid mobile number.'
    ], 400);
}

// Support pre-registration availability check
$isCheckOnly = !empty($payload['check_phone']) || (isset($payload['action']) && $payload['action'] === 'check_phone') || !empty($payload['check_only']);

$db = getDbConnection();
if (!$db) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Database connection failed. Please check MySQL settings.'
    ], 503);
}

// Check if user already exists
// Matches exact E.164, exact digits, or matching country_code + national_phone
// Prevents cross-country false collisions
function findExistingUser($db, $e164, $digits, $countryCode, $nationalPhone, $dialCode) {
    if (hasUserPhoneColumns($db)) {
        // 1. Direct match with country_code and national_phone columns
        $stmt = $db->prepare("
            SELECT id, name, phone, email, country_code, national_phone 
            FROM users 
            WHERE phone = :e164 
               OR phone = :digits
               OR (country_code = :cc AND (national_phone = :nat OR phone = :nat_exact))
            LIMIT 1
        ");
        $stmt->execute([
            ':e164'      => $e164,
            ':digits'    => $digits,
            ':cc'        => $countryCode,
            ':nat'       => $nationalPhone,
            ':nat_exact' => $nationalPhone,
        ]);
        $user = $stmt->fetch();
        if ($user) {
            return $user;
        }

        // 2. Backward compatibility for un-migrated legacy Indian accounts (+91):
        if ($countryCode === '+91' || $dialCode === '91') {
            $stmtLegacy = $db->prepare("
                SELECT id, name, phone, email, country_code, national_phone 
                FROM users 
                WHERE (country_code IS NULL OR country_code = '+91' OR country_code = '') 
                  AND (phone = :p10 OR phone = :p12)
                LIMIT 1
            ");
            $stmtLegacy->execute([
                ':p10' => $nationalPhone,
                ':p12' => '91' . $nationalPhone,
            ]);
            return $stmtLegacy->fetch();
        }
    } else {
        // Fallback when country_code column is not yet added in table
        $stmt = $db->prepare("
            SELECT id, name, phone, email 
            FROM users 
            WHERE phone = :e164 
               OR phone = :digits 
               OR phone = :nat
               OR phone = :full_nat
            LIMIT 1
        ");
        $stmt->execute([
            ':e164'     => $e164,
            ':digits'   => $digits,
            ':nat'      => $nationalPhone,
            ':full_nat' => ($dialCode === '91' ? ('91' . $nationalPhone) : ($dialCode . $nationalPhone)),
        ]);
        $user = $stmt->fetch();
        if ($user) {
            $user['country_code'] = $countryCode;
            $user['national_phone'] = $nationalPhone;
            return $user;
        }
    }

    return null;
}

if ($isCheckOnly) {
    $existing = findExistingUser($db, $e164Phone, $userDigits, $countryCode, $nationalPhone, $dialCode);
    if ($existing) {
        sendJsonResponse([
            'success'            => false,
            'already_registered' => true,
            'message'            => 'An account with mobile number ' . htmlspecialchars($e164Phone) . ' already exists. Please sign in instead.'
        ], 409);
    } else {
        sendJsonResponse([
            'success'            => true,
            'already_registered' => false,
            'message'            => 'Mobile number is available.'
        ], 200);
    }
}

if (empty($password) || strlen($password) < 4) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Password must be at least 4 characters long.'
    ], 400);
}

// Friendly fallback name
if (empty($name)) {
    $name = 'User ' . substr($nationalPhone, -4);
}

// Safe fallback email using full international digits to prevent collisions
if (empty($email)) {
    $email = $userDigits . '@gmsexpense.local';
}

try {
    // Check if phone already registered
    $existing = findExistingUser($db, $e164Phone, $userDigits, $countryCode, $nationalPhone, $dialCode);
    if ($existing) {
        sendJsonResponse([
            'success' => false,
            'message' => 'An account with mobile number ' . htmlspecialchars($e164Phone) . ' already exists. Please sign in instead.'
        ], 409);
    }

    // Hash Password
    $passwordHash = password_hash($password, PASSWORD_BCRYPT);
    $now = time();

    // Insert new user into database
    try {
        $insertStmt = $db->prepare("
            INSERT INTO users (name, country_code, phone, national_phone, email, password_hash, currency, created_at, updated_at)
            VALUES (:name, :country_code, :phone, :national_phone, :email, :password_hash, :currency, :created_at, :updated_at)
        ");
        $insertStmt->execute([
            ':name'           => $name,
            ':country_code'   => $countryCode,
            ':phone'          => $e164Phone,
            ':national_phone' => $nationalPhone,
            ':email'          => $email,
            ':password_hash'  => $passwordHash,
            ':currency'       => $currency,
            ':created_at'     => $now,
            ':updated_at'     => $now,
        ]);
    } catch (PDOException $colEx) {
        // Fallback in case country_code / national_phone columns are not yet applied
        $insertStmt = $db->prepare("
            INSERT INTO users (name, phone, email, password_hash, currency, created_at)
            VALUES (:name, :phone, :email, :password_hash, :currency, CURRENT_TIMESTAMP)
        ");
        $insertStmt->execute([
            ':name'          => $name,
            ':phone'         => $e164Phone,
            ':email'         => $email,
            ':password_hash' => $passwordHash,
            ':currency'      => $currency,
        ]);
    }

    $userId = intval($db->lastInsertId());
    $token = bin2hex(random_bytes(24));

    // Initialize dedicated international user upload directory
    getUserUploadDir($e164Phone, $countryCode);

    sendJsonResponse([
        'success' => true,
        'token'   => $token,
        'user'    => [
            'id'             => $userId,
            'name'           => $name,
            'phone'          => $e164Phone,
            'country_code'   => $countryCode,
            'national_phone' => $nationalPhone,
            'email'          => $email,
            'currency'       => $currency
        ],
        'message' => 'Account created successfully! You can complete your profile anytime.'
    ], 201);

} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Registration error: ' . $e->getMessage()
    ], 500);
}
