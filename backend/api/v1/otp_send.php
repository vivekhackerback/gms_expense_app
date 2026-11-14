<?php
/**
 * WhatsApp OTP Gateway Send Proxy Endpoint
 * POST /api/v1/otp_send.php
 * 
 * Documentation: https://otp.losttag.in/docs
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

$phone = isset($payload['phone']) ? trim($payload['phone']) : '';
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

// Clean phone (10 digits)
$cleanPhone = preg_replace('/\D/', '', $phone);
if (strlen($cleanPhone) === 12 && substr($cleanPhone, 0, 2) === '91') {
    $cleanPhone = substr($cleanPhone, 2);
}

if (empty($cleanPhone) || strlen($cleanPhone) < 10) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Please provide a valid 10-digit mobile number.'
    ], 400);
}

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
        $stmt = $db->prepare("SELECT id FROM users WHERE phone = :p1 OR phone LIKE :p2 LIMIT 1");
        $stmt->execute([
            ':p1' => $cleanPhone,
            ':p2' => '%' . $cleanPhone,
        ]);
        if ($stmt->fetch()) {
            sendJsonResponse([
                'success' => false,
                'already_registered' => true,
                'message' => 'An account with mobile number ' . htmlspecialchars($cleanPhone) . ' already exists. Please sign in instead.'
            ], 409);
        }
    }

    // 2. Initialize OTP Gateway Client from database config
    $otpClient = OtpGatewayClient::fromDatabase($db);

    // 3. Dispatch OTP via WhatsApp Gateway
    $result = $otpClient->sendOtp($cleanPhone, $purpose, $expirySeconds);

    if (!empty($result['success'])) {
        sendJsonResponse([
            'success'             => true,
            'message'             => $result['message'] ?? 'OTP sent to your WhatsApp number.',
            'challenge_id'        => $result['challenge_id'] ?? '',
            'status'              => $result['status'] ?? 'sent',
            'expires_in'          => $result['expires_in'] ?? 300,
            'resend_cooldown'     => $result['resend_cooldown'] ?? 60,
            'whatsapp_message_id' => $result['whatsapp_message_id'] ?? '',
        ], 200);
    } else {
        $msg = $result['message'] ?? 'Failed to send WhatsApp OTP. Please try again.';
        sendJsonResponse([
            'success' => false,
            'message' => $msg,
            'error_code' => $result['error_code'] ?? 'PROVIDER_ERROR',
        ], 400);
    }

} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Error requesting WhatsApp OTP: ' . $e->getMessage()
    ], 500);
}
