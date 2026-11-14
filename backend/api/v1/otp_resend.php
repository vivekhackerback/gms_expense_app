<?php
/**
 * WhatsApp OTP Gateway Resend Proxy Endpoint
 * POST /api/v1/otp_resend.php
 * 
 * Documentation: https://otp.losttag.in/public/docs
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

$challengeId = isset($payload['challenge_id']) ? trim($payload['challenge_id']) : (isset($payload['verification_id']) ? trim($payload['verification_id']) : '');
$countryCode = isset($payload['country_code']) ? trim($payload['country_code']) : '+91';
$mobileNumber = isset($payload['mobile_number']) ? trim($payload['mobile_number']) : (isset($payload['phone']) ? trim($payload['phone']) : '');

if (empty($challengeId)) {
    sendJsonResponse([
        'success' => false,
        'delivery_status' => 'failed',
        'resend_cooldown' => 0,
        'message' => 'Missing challenge_id. Please request a new OTP first.'
    ], 400);
}

$db = getDbConnection();
if (!$db) {
    sendJsonResponse([
        'success' => false,
        'delivery_status' => 'server_error',
        'resend_cooldown' => 0,
        'message' => 'Database connection unavailable.'
    ], 503);
}

try {
    $otpClient = OtpGatewayClient::fromDatabase($db);
    $result = $otpClient->resendOtp($challengeId, $countryCode, $mobileNumber);

    $isSuccess = !empty($result['success']) && ($result['status'] ?? '') === 'sent';
    $newChallengeId = $result['challenge_id'] ?? $challengeId;
    $resendCooldown = $isSuccess ? (int)($result['resend_cooldown'] ?? 60) : 0;
    $deliveryStatus = $isSuccess ? 'success' : (($result['error_type'] ?? '') === 'timeout' ? 'timeout' : 'failed');

    if ($isSuccess) {
        sendJsonResponse([
            'success'             => true,
            'delivery_status'     => 'success',
            'status'              => 'sent',
            'message'             => $result['message'] ?? 'OTP resent successfully.',
            'challenge_id'        => $newChallengeId,
            'resend_cooldown'     => $resendCooldown,
            'expires_in'          => $result['expires_in'] ?? 300,
            'country_code'        => $result['country_code'] ?? $countryCode,
            'national_number'     => $result['national_number'] ?? $result['mobile_number'] ?? $mobileNumber,
            'whatsapp_message_id' => $result['whatsapp_message_id'] ?? null,
        ], 200);
    } else {
        $errorMessage = $result['message'] ?? 'Failed to resend OTP. Please try again.';
        if (stripos($errorMessage, 'internal server error') !== false || ($result['error_code'] ?? '') === 'INTERNAL_SERVER_ERROR') {
            $errorMessage = 'Failed to resend OTP. Please try again.';
        }
        sendJsonResponse([
            'success'         => false,
            'delivery_status' => $deliveryStatus,
            'status'          => $result['status'] ?? 'failed',
            'message'         => $errorMessage,
            'challenge_id'    => $challengeId,
            'resend_cooldown' => 0, // IMPORTANT: Never start countdown on failure
            'error_code'      => $result['error_code'] ?? 'RESEND_FAILED',
            'raw_gateway'     => $result['raw_gateway'] ?? null,
        ], 400);
    }
} catch (Exception $e) {
    sendJsonResponse([
        'success'         => false,
        'delivery_status' => 'server_error',
        'status'          => 'failed',
        'message'         => 'Error resending OTP: ' . $e->getMessage(),
        'resend_cooldown' => 0,
    ], 500);
}
