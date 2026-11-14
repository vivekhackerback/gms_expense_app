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
    // 1. Check registration state based on purpose / payload
    $requireRegistered = !empty($payload['require_registered']) || ($rawPurpose === 'reset_password') || ($rawPurpose === 'Forgot Password');
    $checkRegistered = isset($payload['check_registered']) ? (bool)$payload['check_registered'] : !$requireRegistered;

    if ($requireRegistered) {
        $userExists = false;
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
            $userExists = (bool)$stmt->fetch();

            if (!$userExists && ($countryCode === '+91' || $dialCode === '91')) {
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
                $userExists = (bool)$stmtLegacy->fetch();
            }
        } else {
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
            $userExists = (bool)$stmt->fetch();
        }

        if (!$userExists) {
            sendJsonResponse([
                'success'   => false,
                'not_found' => true,
                'message'   => 'No registered account found with mobile number ' . htmlspecialchars($e164Phone) . '. Please create an account first.'
            ], 404);
        }
    } elseif ($checkRegistered) {
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

    // 3. Dispatch OTP via WhatsApp Gateway using new format (country_code, mobile_number, and E.164 phone)
    $result = $otpClient->sendOtp($e164Phone, $purpose, $expirySeconds, $countryCode, $nationalPhone);

    $serviceUrl = method_exists($otpClient, 'getBaseUrl') ? $otpClient->getBaseUrl() : 'https://otp.losttag.in/api/v1';

    $challengeId = $result['challenge_id'] ?? $result['verification_id'] ?? $result['id'] ?? null;
    $resendCooldown = isset($result['resend_cooldown']) ? (int)$result['resend_cooldown'] : 60;

    // Strict Delivery Status Validation
    // Never assume delivery succeeded merely because of HTTP 200 or truthy object
    $rawSuccess = $result['success'] ?? false;
    $statusLower = strtolower(trim((string)($result['status'] ?? '')));
    $waStatusLower = isset($result['whatsapp']['status']) ? strtolower(trim((string)$result['whatsapp']['status'])) : '';
    $httpCode = isset($result['http_code']) ? (int)$result['http_code'] : 200;

    $failedStatuses = ['failed', 'failure', 'undelivered', 'rejected', 'error', 'timeout', 'invalid_response'];
    $isStatusFailed = in_array($statusLower, $failedStatuses, true) || in_array($waStatusLower, ['failed', 'failure', 'undelivered', 'error'], true);
    $isBooleanSuccess = ($rawSuccess === true || $rawSuccess === 1 || $rawSuccess === '1');

    $isDeliverySuccess = $isBooleanSuccess && !$isStatusFailed && !empty($challengeId) && ($httpCode < 400);

    if ($isDeliverySuccess) {
        // SUCCESS CASE:
        // Confirmed successful OTP delivery -> Start 60s resend countdown
        sendJsonResponse([
            'success'             => true,
            'delivery_status'     => 'success',
            'status'              => 'sent',
            'message'             => $result['message'] ?? 'OTP sent successfully via WhatsApp.',
            'challenge_id'        => $challengeId,
            'verification_id'     => $challengeId,
            'resend_cooldown'     => $resendCooldown > 0 ? $resendCooldown : 60,
            'allow_retry'         => false,
            'otp'                 => isset($result['otp']) ? $result['otp'] : null,
            'phone'               => $e164Phone,
            'country_code'        => $countryCode,
            'national_number'     => $nationalPhone,
            'national_phone'      => $nationalPhone,
            'mobile_number'       => $nationalPhone,
            'gateway_phone'       => $gatewayPhone,
            'simulated'           => !empty($result['simulated']),
            'expires_in_seconds'  => isset($result['expires_in']) ? (int)$result['expires_in'] : (isset($result['expires_in_seconds']) ? (int)$result['expires_in_seconds'] : $expirySeconds),
            'whatsapp_message_id' => $result['whatsapp_message_id'] ?? null,
            'service_url'         => $serviceUrl,
        ], 200);
    } else {
        // FAILURE CASE:
        // Categorize error type: timeout, invalid_response, or failed
        // ALWAYS set resend_cooldown to 0 so the user can retry immediately without waiting!
        if ($statusLower === 'timeout' || $httpCode === 408 || $httpCode === 504) {
            $deliveryStatus = 'timeout';
            $failMsg = 'Unable to send OTP. Try again.';
            $responseCode = 504;
        } elseif ($statusLower === 'invalid_response' || $httpCode === 502) {
            $deliveryStatus = 'invalid_response';
            $failMsg = 'Unable to verify OTP delivery status';
            $responseCode = 502;
        } else {
            $deliveryStatus = 'failed';
            $failMsg = !empty($result['message']) ? trim((string)$result['message']) : 'Failed to send OTP. Please try again.';
            // Sanitize: never echo misleading success wording if delivery failed
            if (stripos($failMsg, 'success') !== false || stripos($failMsg, 'accepted') !== false || stripos($failMsg, 'dispatched') !== false) {
                $failMsg = 'Failed to send OTP. Please try again.';
            }
            if (stripos($failMsg, 'internal server error') !== false || ($result['error_code'] ?? '') === 'INTERNAL_SERVER_ERROR') {
                $failMsg = 'Failed to send OTP. Please try again.';
            }
            $responseCode = 400;
        }

        sendJsonResponse([
            'success'             => false,
            'delivery_status'     => $deliveryStatus,
            'status'              => 'failed',
            'message'             => $failMsg,
            'challenge_id'        => null,
            'verification_id'     => null,
            'resend_cooldown'     => 0, // NEVER start countdown on failure!
            'allow_retry'         => true,
            'phone'               => $e164Phone,
            'country_code'        => $countryCode,
            'national_phone'      => $nationalPhone,
            'gateway_phone'       => $gatewayPhone,
            'service_url'         => $serviceUrl,
            'debug'               => $result,
        ], $responseCode);
    }

} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'OTP Service Error: ' . $e->getMessage()
    ], 500);
}
