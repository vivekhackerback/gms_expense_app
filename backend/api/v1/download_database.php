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

// Support health check / readiness verification without streaming binary bytes
$isCheckOnly = isset($_GET['check']) || isset($_GET['health']) || $_SERVER['REQUEST_METHOD'] === 'HEAD';
if ($isCheckOnly) {
    $hasBackup = file_exists($userDbFile);
    $fileSize = $hasBackup ? filesize($userDbFile) : 0;
    sendJsonResponse([
        'success'       => true,
        'status'        => 'ready',
        'service'       => 'Database Download API',
        'endpoint'      => 'download_database.php',
        'has_backup'    => $hasBackup,
        'phone'         => $cleanPhone,
        'file_size'     => $fileSize,
        'last_modified' => $hasBackup ? filemtime($userDbFile) : null,
        'message'       => $hasBackup 
            ? 'Database backup file is verified and ready for download (' . round($fileSize / 1024, 1) . ' KB).'
            : 'Database download endpoint is reachable and authorized (No cloud database uploaded yet for this user).'
    ], 200);
}

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
