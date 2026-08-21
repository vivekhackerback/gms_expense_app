<?php
/**
 * Cloud Backup Manifest & Info API Endpoint
 * GET /api/v1/backup_manifest.php?phone=9876543210
 * POST /api/v1/backup_manifest.php
 * 
 * Returns the latest database backup details, metrics, and associated image download URLs.
 */

require_once __DIR__ . '/db_connect.php';

$rawPhone = '';
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $rawPhone = isset($_GET['phone']) ? trim($_GET['phone']) : (isset($_GET['mobile']) ? trim($_GET['mobile']) : '');
} else {
    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true) ?: $_POST;
    $rawPhone = isset($payload['phone']) ? trim($payload['phone']) : (isset($payload['mobile']) ? trim($payload['mobile']) : '');
}

$cleanPhone = preg_replace('/[^0-9]/', '', $rawPhone);
if (empty($cleanPhone) || strlen($cleanPhone) < 4) {
    $cleanPhone = '9876543210';
}

$baseUploadsDir = realpath(__DIR__ . '/../../uploads');
if (!$baseUploadsDir) {
    $baseUploadsDir = __DIR__ . '/../../uploads';
}

$userDbDir = $baseUploadsDir . '/users/' . $cleanPhone . '/database';
$targetDbFile = $userDbDir . '/expenses_khata.db';
$manifestFile = $userDbDir . '/manifest.json';

if (!file_exists($targetDbFile)) {
    sendJsonResponse([
        'success'        => true,
        'has_backup'     => false,
        'message'        => 'No cloud database backup found for this account.',
        'phone'          => $cleanPhone,
        'backup_time'    => null,
        'db_size'        => 0,
        'stats'          => [
            'transactions' => 0,
            'parties'      => 0,
            'categories'   => 0,
            'images'       => 0,
        ],
        'images'         => [],
    ], 200);
}

// Read Manifest or fallback to file stat
$manifest = [];
if (file_exists($manifestFile)) {
    $manifest = json_decode(file_get_contents($manifestFile), true) ?: [];
}

$dbSize = file_exists($targetDbFile) ? filesize($targetDbFile) : 0;
$backupTime = isset($manifest['last_backup_at']) ? $manifest['last_backup_at'] : filemtime($targetDbFile);

// Discover all images in user directory
$userImagesDir = $baseUploadsDir . '/users/' . $cleanPhone . '/images';
$allImages = [];

if (is_dir($userImagesDir)) {
    $files = scandir($userImagesDir);
    foreach ($files as $f) {
        if ($f !== '.' && $f !== '..' && !is_dir($userImagesDir . '/' . $f)) {
            $allImages[$f] = 'uploads/users/' . $cleanPhone . '/images/' . $f;
        }
    }
}

$txDir = $baseUploadsDir . '/users/' . $cleanPhone . '/transactions';
if (is_dir($txDir)) {
    $subfolders = scandir($txDir);
    foreach ($subfolders as $sf) {
        if ($sf !== '.' && $sf !== '..' && is_dir($txDir . '/' . $sf)) {
            $subFiles = scandir($txDir . '/' . $sf);
            foreach ($subFiles as $img) {
                if ($img !== '.' && $img !== '..' && !is_dir($txDir . '/' . $sf . '/' . $img)) {
                    $allImages[$img] = 'uploads/users/' . $cleanPhone . '/transactions/' . $sf . '/' . $img;
                }
            }
        }
    }
}

// Build protocol and base URL
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
$baseUrl = $protocol . $host . '/';

$imageList = [];
foreach ($allImages as $fileName => $relPath) {
    $imageList[] = [
        'file_name'    => $fileName,
        'download_url' => $baseUrl . $relPath,
        'relative_path'=> $relPath,
    ];
}

$dbDownloadUrl = $baseUrl . 'api/v1/download_database.php?phone=' . urlencode($cleanPhone);

sendJsonResponse([
    'success'         => true,
    'has_backup'      => true,
    'phone'           => $cleanPhone,
    'backup_time'     => $backupTime,
    'db_size'         => $dbSize,
    'db_download_url' => $dbDownloadUrl,
    'stats'           => isset($manifest['stats']) ? $manifest['stats'] : [
        'transactions' => 0,
        'parties'      => 0,
        'categories'   => 0,
        'images'       => count($imageList),
    ],
    'image_count'     => count($imageList),
    'images'          => $imageList,
    'message'         => 'Cloud backup found and ready for import.',
], 200);
