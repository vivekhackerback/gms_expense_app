<?php
/**
 * Download SQLite Database File API Endpoint
 * GET /api/v1/download_database.php?phone=9876543210
 * 
 * Streams the user's latest SQLite database (.db) file directly for download.
 */

require_once __DIR__ . '/db_connect.php';

$rawPhone = isset($_GET['phone']) ? trim($_GET['phone']) : (isset($_GET['mobile']) ? trim($_GET['mobile']) : '');
$cleanPhone = preg_replace('/[^0-9]/', '', $rawPhone);
if (empty($cleanPhone) || strlen($cleanPhone) < 4) {
    $cleanPhone = '9876543210';
}

$baseUploadsDir = realpath(__DIR__ . '/../../uploads');
if (!$baseUploadsDir) {
    $baseUploadsDir = __DIR__ . '/../../uploads';
}

$userDbFile = $baseUploadsDir . '/users/' . $cleanPhone . '/database/expenses_khata.db';

if (!file_exists($userDbFile)) {
    sendJsonResponse([
        'success' => false,
        'message' => 'No database backup file found on server for this phone number.'
    ], 404);
}

// Disable output buffering & clean
if (ob_get_level()) {
    ob_end_clean();
}

$fileSize = filesize($userDbFile);

// Headers for binary file download
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Content-Description: File Transfer');
header('Content-Type: application/x-sqlite3');
header('Content-Disposition: attachment; filename="expenses_khata.db"');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');
header('Content-Length: ' . $fileSize);

readfile($userDbFile);
exit();
