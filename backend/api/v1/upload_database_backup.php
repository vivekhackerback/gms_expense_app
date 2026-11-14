<?php
/**
 * SQLite Database File (.db) Upload API Endpoint
 * POST /api/v1/upload_database_backup.php
 * 
 * Directory Structure:
 * uploads/users/{mobile_number}/database/
 *   - expenses_khata.db (current active copy)
 *   - expenses_khata_{timestamp}.db (historical snapshots)
 *   - manifest.json (backup metadata & photo registry)
 */

require_once __DIR__ . '/db_connect.php';

// 1. Method Validation
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Method not allowed. Use POST.'
    ], 405);
}

// 2. Validate File Upload
if (!isset($_FILES['db_file'])) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'No database file provided. Expected "db_file" in multipart/form-data.'
    ], 400);
}

$uploadError = $_FILES['db_file']['error'];
if ($uploadError !== UPLOAD_ERR_OK) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Database file upload error code: ' . $uploadError
    ], 400);
}

$tmpPath = $_FILES['db_file']['tmp_name'];
$fileSize = $_FILES['db_file']['size'];

// Check max database size (50MB)
if ($fileSize > 50 * 1024 * 1024) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Database file exceeds maximum size limit (50MB).'
    ], 400);
}

// Verify SQLite Header magic bytes ("SQLite format 3\000")
$fh = fopen($tmpPath, 'rb');
$header = fread($fh, 16);
fclose($fh);

if (strpos($header, 'SQLite format 3') !== 0) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Invalid SQLite database file. Header signature does not match.'
    ], 400);
}

// 3. User & Metadata parsing
$rawPhone = isset($_POST['phone']) ? trim($_POST['phone']) : (isset($_POST['mobile']) ? trim($_POST['mobile']) : '');
$countryCode = isset($_POST['country_code']) ? trim($_POST['country_code']) : (isset($_POST['dial_code']) ? trim($_POST['dial_code']) : null);
$parsed = parsePhoneNumber($rawPhone, $countryCode);
$e164Phone = $parsed['e164'];

$userId = isset($_POST['user_id']) ? intval($_POST['user_id']) : 1;
$txCount = isset($_POST['tx_count']) ? intval($_POST['tx_count']) : 0;
$partyCount = isset($_POST['party_count']) ? intval($_POST['party_count']) : 0;
$categoryCount = isset($_POST['category_count']) ? intval($_POST['category_count']) : 0;
$imageCount = isset($_POST['image_count']) ? intval($_POST['image_count']) : 0;

$now = time();

// 4. Dedicated International Directory Structure: uploads/{country_code+phone}/
$userDbDir = getUserUploadDir($rawPhone, $countryCode, 'database');
$userImagesDir = getUserUploadDir($rawPhone, $countryCode, 'images');
$txDir = getUserUploadDir($rawPhone, $countryCode, 'transactions');

// Save active database file
$targetDbFile = $userDbDir . '/expenses_khata.db';
$historyDbFile = $userDbDir . '/expenses_khata_' . $now . '.db';

if (!move_uploaded_file($tmpPath, $targetDbFile)) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Failed to save database file on server.'
    ], 500);
}

// Create a versioned copy for history
copy($targetDbFile, $historyDbFile);

// Scan user images directory for existing images
$existingImages = [];
if (is_dir($userImagesDir)) {
    $files = scandir($userImagesDir);
    foreach ($files as $f) {
        if ($f !== '.' && $f !== '..' && !is_dir($userImagesDir . '/' . $f)) {
            $existingImages[] = $f;
        }
    }
}

// Also check transaction image subdirectories if any
if (is_dir($txDir)) {
    $subfolders = scandir($txDir);
    foreach ($subfolders as $sf) {
        if ($sf !== '.' && $sf !== '..' && is_dir($txDir . '/' . $sf)) {
            $subFiles = scandir($txDir . '/' . $sf);
            foreach ($subFiles as $img) {
                if ($img !== '.' && $img !== '..' && !is_dir($txDir . '/' . $sf . '/' . $img)) {
                    $existingImages[] = $img;
                }
            }
        }
    }
}

$existingImages = array_values(array_unique($existingImages));

// 5. Create or Update Manifest
$manifest = [
    'user_id'         => $userId,
    'phone'           => $e164Phone,
    'country_code'    => $parsed['country_code'],
    'digits'          => $parsed['digits'],
    'last_backup_at'  => $now,
    'db_file_name'    => 'expenses_khata.db',
    'db_size_bytes'   => $fileSize,
    'stats' => [
        'transactions' => $txCount,
        'parties'      => $partyCount,
        'categories'   => $categoryCount,
        'images'       => count($existingImages) > 0 ? count($existingImages) : $imageCount,
    ],
    'images'          => $existingImages,
];

file_put_contents($userDbDir . '/manifest.json', json_encode($manifest, JSON_PRETTY_PRINT));

// 6. Return JSON response
sendJsonResponse([
    'success'         => true,
    'saved'           => true,
    'message'         => 'Complete SQLite database backup uploaded successfully.',
    'backup_time'     => $now,
    'db_size'         => $fileSize,
    'stats'           => $manifest['stats'],
    'image_count'     => count($existingImages),
], 200);
