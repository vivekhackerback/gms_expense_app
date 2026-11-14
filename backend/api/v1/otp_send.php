<?php
/**
 * WhatsApp OTP Gateway Send Proxy Endpoint
 * POST /api/v1/otp_send.php
 * 
 * Documentation: https://otp.losttag.in/docs
 * Supports international phone numbers and strict cross-country isolation.
 */

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/OtpGatewayClient.php';

header('Content-Type: application/json; charset=UTF-8');

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

$phoneInput = isset($payload['phone']) ? trim($payload['phone']) : '';
$countryCodeInput = isset($payload['country_code']) ? trim($payload['country_code']) : (isset($payload['dial_code']) ? trim($payload['dial_code']) : null);
$rawPurpose = isset($payload['purpose']) ? trim($payload['purpose']) : 'Registration';

// Meta WhatsApp Parameter Limit: Body parameter at index 1 must NOT exceed 15 chars (Error #132018)
if ($rawPurpose === 'Account Registration') {
    $rawPurpose = 'Registration';
} elseif ($rawPurpose === 'Login Verification') {
    $rawPurpose = 'Verification';
}
if (mb_strlen($rawPurpose) > 15) {
    $rawPurpose = mb_substr($rawPurpose, 0, 15);
}
if (empty($rawPurpose)) {
    $rawPurpose = 'Verification';
}
$purpose = $rawPurpose;
$expirySeconds = isset($payload['expiry_seconds']) ? (int)$payload['expiry_seconds'] : 300;

// Parse and normalize international phone number
$parsedPhone = parsePhoneNumber($phoneInput, $countryCodeInput);
$e164Phone = $parsedPhone['e164'];
$countryCode = $parsedPhone['country_code'];
$dialCode = $parsedPhone['dial_code'];
$nationalPhone = $parsedPhone['national_number'];
$userDigits = $parsedPhone['digits'];

if (empty($nationalPhone) || strlen($nationalPhone) < 5) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Please provide a valid mobile number.'
    ], 400);
}

// Target phone sent to gateway: 10-digit for default India (+91), full international number for other countries
$gatewayPhone = ($dialCode === '91') ? $nationalPhone : $userDigits;

$db = getDbConnection();
if (!$db) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Database connection unavailable.'
    ], 503);
}

try {
    // 1. If registering, check if phone is already registered
    $checkRegistered = isset($payload['check_registered']) ? (bool)$payload['check_registered'] : true;
    if ($checkRegistered) {
        $exists = false;
        if (hasUserPhoneColumns($db)) {
            $stmt = $db->prepare("
                SELECT id FROM users 
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
            $exists = (bool)$stmt->fetch();

            // Check legacy un-migrated Indian accounts if registering with +91
            if (!$exists && ($countryCode === '+91' || $dialCode === '91')) {
                $stmtLegacy = $db->prepare("
                    SELECT id FROM users 
                    WHERE (country_code IS NULL OR country_code = '+91' OR country_code = '') 
                      AND (phone = :p10 OR phone = :p12)
                    LIMIT 1
                ");
                $stmtLegacy->execute([
                    ':p10' => $nationalPhone,
                    ':p12' => '91' . $nationalPhone,
                ]);
                $exists = (bool)$stmtLegacy->fetch();
            }
        } else {
            // Fallback when country_code column is not present
            $stmt = $db->prepare("
                SELECT id FROM users 
                WHERE phone = :e164 
                   OR phone = :digits 
                   OR phone = :nat
                   OR phone = :full_nat
                LIMIT 1
            ");
            $stmt->execute([
                ':e164'     => $e164Phone,
                ':digits'   => $userDigits,
                ':nat'      => $nationalPhone,
                ':full_nat' => ($dialCode === '91' ? ('91' . $nationalPhone) : ($dialCode . $nationalPhone)),
            ]);
            $exists = (bool)$stmt->fetch();
        }

        if ($exists) {
            sendJsonResponse([
                'success'            => false,
                'already_registered' => true,
                'message'            => 'An account with mobile number ' . htmlspecialchars($e164Phone) . ' already exists. Please sign in instead.'
            ], 409);
        }
    }

    // 2. Initialize OTP Gateway Client from database config
    $otpClient = OtpGatewayClient::fromDatabase($db);

    // 3. Dispatch OTP via WhatsApp Gateway
    $result = $otpClient->sendOtp($gatewayPhone, $purpose, $expirySeconds);

    $serviceUrl = method_exists($otpClient, 'getBaseUrl') ? $otpClient->getBaseUrl() : 'https://otp.losttag.in/api/v1';

    $challengeId = $result['challenge_id'] ?? $result['verification_id'] ?? $result['id'] ?? null;
    $resendCooldown = isset($result['resend_cooldown']) ? (int)$result['resend_cooldown'] : 60;

    if (!empty($result['success'])) {
        sendJsonResponse([
            'success'             => true,
            'message'             => isset($result['message']) ? $result['message'] : 'OTP sent successfully via WhatsApp.',
            'challenge_id'        => $challengeId,
            'verification_id'     => $challengeId,
            'status'              => $result['status'] ?? 'pending',
            'resend_cooldown'     => $resendCooldown,
            'otp'                 => isset($result['otp']) ? $result['otp'] : null,
            'phone'               => $e164Phone,
            'country_code'        => $countryCode,
            'national_phone'      => $nationalPhone,
            'gateway_phone'       => $gatewayPhone,
            'simulated'           => !empty($result['simulated']),
            'expires_in_seconds'  => isset($result['expires_in_seconds']) ? (int)$result['expires_in_seconds'] : $expirySeconds,
            'service_url'         => $serviceUrl,
        ], 200);
    } else {
        $errorMsg = isset($result['message']) ? $result['message'] : 'Failed to send OTP via WhatsApp gateway.';
        sendJsonResponse([
            'success'     => false,
            'message'     => $errorMsg,
            'service_url' => $serviceUrl,
            'debug'       => $result,
        ], 400);
    }

} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'OTP Service Error: ' . $e->getMessage()
    ], 500);
}
