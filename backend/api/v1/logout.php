<?php
/**
 * User Logout API Endpoint
 * POST /api/v1/logout.php
 */

require_once __DIR__ . '/db_connect.php';

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true) ?: [];

$token = null;
$authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) 
    ? trim($_SERVER['HTTP_AUTHORIZATION']) 
    : (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) ? trim($_SERVER['REDIRECT_HTTP_AUTHORIZATION']) : '');

if (preg_match('/Bearer\s+(\S+)/i', $authHeader, $matches)) {
    $token = $matches[1];
}
if (!$token && !empty($payload['token'])) {
    $token = trim($payload['token']);
}

$userId = isset($payload['user_id']) ? intval($payload['user_id']) : 0;

$db = getDbConnection();
if ($db) {
    try {
        if (!empty($token)) {
            $db->prepare("UPDATE users SET session_token = NULL WHERE session_token = :token")->execute([':token' => $token]);
        }
        if ($userId > 0) {
            $db->prepare("UPDATE users SET session_token = NULL WHERE id = :id")->execute([':id' => $userId]);
        }
    } catch (Exception $e) {}
}

sendJsonResponse([
    'success' => true,
    'message' => 'Logged out successfully.'
], 200);
