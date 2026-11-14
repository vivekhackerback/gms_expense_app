<?php
/**
 * WhatsApp OTP Gateway Verify Proxy Endpoint
 * POST /api/v1/otp_verify.php
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

$challengeId = isset($payload['challenge_id']) ? trim($payload['challenge_id']) : '';
$otp = isset($payload['otp']) ? trim($payload['otp']) : '';

if (empty($challengeId)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Missing challenge_id. Please request a new OTP.'
    ], 400);
}

if (empty($otp) || strlen($otp) < 4) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Please enter a valid OTP code.'
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
    // 1. Initialize OTP Gateway Client from database config
    $otpClient = OtpGatewayClient::fromDatabase($db);

    // 2. Verify OTP with gateway
    $result = $otpClient->verifyOtp($challengeId, $otp);

    if (!empty($result['success']) && !empty($result['verified'])) {
        sendJsonResponse([
            'success'      => true,
            'verified'     => true,
            'message'      => $result['message'] ?? 'OTP verified successfully.',
            'challenge_id' => $result['challenge_id'] ?? $challengeId,
            'verified_at'  => $result['verified_at'] ?? date('c'),
        ], 200);
    } else {
        $msg = $result['message'] ?? 'Invalid OTP code. Please check and try again.';
        sendJsonResponse([
            'success'            => false,
            'verified'           => false,
            'message'            => $msg,
            'attempts_remaining' => $result['attempts_remaining'] ?? null,
            'error_code'         => $result['error_code'] ?? 'INVALID_OTP',
        ], 400);
    }

} catch (Exception $e) {
    sendJsonResponse([
        'success'  => false,
        'verified' => false,
        'message'  => 'Error verifying OTP: ' . $e->getMessage()
    ], 500);
}
