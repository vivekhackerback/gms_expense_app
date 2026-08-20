<?php
/**
 * Update User Profile API Endpoint
 * POST /api/v1/update_profile.php
 * 
 * Allows user to complete or edit their profile (Full Name, Business Name, Email) anytime.
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
$phone = isset($payload['phone']) ? trim($payload['phone']) : '';
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

try {
    if ($userId > 0) {
        $stmt = $db->prepare("UPDATE users SET name = :name, email = COALESCE(NULLIF(:email, ''), email), updated_at = CURRENT_TIMESTAMP WHERE id = :id");
        $stmt->execute([':name' => $name, ':email' => $email, ':id' => $userId]);
    } else {
        $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
        $stmt = $db->prepare("UPDATE users SET name = :name, email = COALESCE(NULLIF(:email, ''), email), updated_at = CURRENT_TIMESTAMP WHERE phone = :phone OR phone LIKE :phone_like");
        $stmt->execute([':name' => $name, ':email' => $email, ':phone' => $cleanPhone, ':phone_like' => '%' . $cleanPhone]);
    }

    // Fetch updated user
    $selectStmt = $db->prepare("SELECT id, name, phone, email, currency FROM users WHERE id = :id OR phone = :phone LIMIT 1");
    $selectStmt->execute([':id' => $userId, ':phone' => $phone]);
    $updatedUser = $selectStmt->fetch();

    sendJsonResponse([
        'success' => true,
        'user'    => $updatedUser,
        'message' => 'Profile updated successfully.'
    ], 200);

} catch (Exception $e) {
    sendJsonResponse([
        'success' => false,
        'message' => 'Error updating profile: ' . $e->getMessage()
    ], 500);
}
