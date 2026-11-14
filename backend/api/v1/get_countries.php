<?php
/**
 * WhatsApp OTP Gateway Countries Catalog Proxy Endpoint
 * GET /api/v1/get_countries.php
 * 
 * Documentation: https://otp.losttag.in/public/docs
 */

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/OtpGatewayClient.php';

header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    sendJsonResponse([
        'success' => false,
        'message' => 'Method not allowed. Use GET.'
    ], 405);
}

$query = isset($_GET['q']) ? trim($_GET['q']) : null;

$db = getDbConnection();
if (!$db) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Database connection unavailable.'
    ], 503);
}

try {
    $otpClient = OtpGatewayClient::fromDatabase($db);
    $result = $otpClient->getCountries($query);

    sendJsonResponse($result, 200);
} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Error retrieving countries catalog: ' . $e->getMessage()
    ], 500);
}
