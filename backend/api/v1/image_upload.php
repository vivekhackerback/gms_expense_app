<?php
/**
 * Real Image Upload Endpoint (Multipart Form Data)
 * POST /api/v1/image_upload.php
 * 
 * Directory Structure:
 * uploads/users/{mobile_number}/transactions/{transaction_id}/
 * 
 * Filename Pattern:
 * {transaction_id}_{unix_timestamp}_{unique_id}.{extension}
 * Example: TXN_10001_1723456789_a8f3.jpg
 */

require_once __DIR__ . '/db_connect.php';

// 1. Validate HTTP Method
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Method not allowed. Use POST.'
    ], 405);
}

// 2. Validate File Upload Status & Errors
if (!isset($_FILES['file'])) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'No image file uploaded in request payload.'
    ], 400);
}

$uploadError = $_FILES['file']['error'];
if ($uploadError !== UPLOAD_ERR_OK) {
    $errorMessages = [
        UPLOAD_ERR_INI_SIZE   => 'The uploaded file exceeds the upload_max_filesize directive in php.ini.',
        UPLOAD_ERR_FORM_SIZE  => 'The uploaded file exceeds the MAX_FILE_SIZE directive in the HTML form.',
        UPLOAD_ERR_PARTIAL    => 'The uploaded file was only partially uploaded.',
        UPLOAD_ERR_NO_FILE    => 'No file was uploaded.',
        UPLOAD_ERR_NO_TMP_DIR => 'Missing a temporary folder on server.',
        UPLOAD_ERR_CANT_WRITE => 'Failed to write file to server disk.',
        UPLOAD_ERR_EXTENSION  => 'A PHP extension stopped the file upload.'
    ];
    $errMsg = isset($errorMessages[$uploadError]) ? $errorMessages[$uploadError] : "Unknown upload error code ($uploadError).";
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'File upload error: ' . $errMsg
    ], 400);
}

// 3. File Size Validation (Max 15MB)
$maxSizeBytes = 15 * 1024 * 1024;
$fileSize = $_FILES['file']['size'];
if ($fileSize > $maxSizeBytes) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'File size exceeds maximum allowed limit (15MB).'
    ], 400);
}

// 4. File Type & MIME Validation (Strict Security Check)
$tmpPath = $_FILES['file']['tmp_name'];
if (!is_uploaded_file($tmpPath)) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Security error: File is not a valid uploaded file.'
    ], 400);
}

$finfo = finfo_open(FILEINFO_MIME_TYPE);
$detectedMime = finfo_file($finfo, $tmpPath);
finfo_close($finfo);

$allowedMimes = [
    'image/jpeg' => 'jpg',
    'image/jpg'  => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];

if (!isset($allowedMimes[$detectedMime])) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Invalid file format. Only JPEG, PNG, and WebP images are permitted. Detected: ' . htmlspecialchars($detectedMime)
    ], 415);
}

$safeExtension = $allowedMimes[$detectedMime];

// 5. Extract & Sanitize User and Transaction Identifiers
$transactionUuid = isset($_POST['transaction_uuid']) ? trim($_POST['transaction_uuid']) : null;
$transactionId = isset($_POST['transaction_id']) ? trim($_POST['transaction_id']) : null;
$originalFileName = isset($_POST['file_name']) ? trim($_POST['file_name']) : $_FILES['file']['name'];
$originalFileName = basename($originalFileName); // Remove directory traversal attempts

if (empty($transactionUuid) && empty($transactionId)) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Missing transaction_uuid or transaction_id parameter.'
    ], 400);
}

// Determine User Phone (Dedicated Directory)
$rawPhone = isset($_POST['phone']) ? trim($_POST['phone']) : (isset($_POST['mobile']) ? trim($_POST['mobile']) : '');
$cleanPhone = preg_replace('/[^0-9]/', '', $rawPhone);
if (empty($cleanPhone) || strlen($cleanPhone) < 4) {
    $cleanPhone = '9876543210'; // Default tenant fallback
}

$userId = isset($_POST['user_id']) ? intval($_POST['user_id']) : 1;

// Determine Transaction Prefix & Folder (e.g. TXN_10001 or TXN_UUID)
if (!empty($transactionId)) {
    $cleanTxId = preg_replace('/[^a-zA-Z0-9_-]/', '', $transactionId);
    $txIdentifier = (stripos($cleanTxId, 'TXN_') === 0) ? $cleanTxId : ('TXN_' . $cleanTxId);
} else {
    // Generate clean identifier from UUID
    $shortUuid = substr(str_replace('-', '', $transactionUuid), 0, 10);
    $txIdentifier = 'TXN_' . strtoupper($shortUuid);
}

$txFolder = $txIdentifier;

// 6. Generate Unique Filename: {transaction_id}_{unix_timestamp}_{unique_id}.{extension}
$now = time(); // Unix timestamp in seconds
$uniqueHex = bin2hex(random_bytes(2)); // 4-char random hex (e.g. a8f3)
$generatedFileName = sprintf('%s_%d_%s.%s', $txIdentifier, $now, $uniqueHex, $safeExtension);

// 7. Structured Directory Storage: uploads/users/{mobile}/transactions/{tx_folder}/
$baseUploadsDir = realpath(__DIR__ . '/../../uploads');
if (!$baseUploadsDir) {
    $baseUploadsDir = __DIR__ . '/../../uploads';
    if (!is_dir($baseUploadsDir)) {
        mkdir($baseUploadsDir, 0755, true);
    }
}

$userDir = $baseUploadsDir . '/users/' . $cleanPhone . '/transactions/' . $txFolder;
if (!is_dir($userDir)) {
    if (!mkdir($userDir, 0755, true)) {
        sendJsonResponse([
            'success' => false,
            'saved'   => false,
            'message' => 'Failed to create dedicated user transaction directory on server.'
        ], 500);
    }
}

$targetFilePath = $userDir . '/' . $generatedFileName;

// Ensure no collision (regenerate unique hex if file already exists)
while (file_exists($targetFilePath)) {
    $uniqueHex = bin2hex(random_bytes(2));
    $generatedFileName = sprintf('%s_%d_%s.%s', $txIdentifier, $now, $uniqueHex, $safeExtension);
    $targetFilePath = $userDir . '/' . $generatedFileName;
}

// 8. Move Uploaded File to Final Destination
if (!move_uploaded_file($tmpPath, $targetFilePath)) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Failed to store image file into user directory.'
    ], 500);
}

// Construct Storage URLs and Relative Path
$relativeStoragePath = 'uploads/users/' . $cleanPhone . '/transactions/' . $txFolder . '/' . $generatedFileName;
$protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https://' : 'http://';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
$storageUrl = $protocol . $host . '/' . $relativeStoragePath;

// 9. Persist to MySQL Database
$db = getDbConnection();
$serverId = null;

if ($db) {
    try {
        $stmt = $db->prepare("
            INSERT INTO transaction_images (
                user_id, transaction_uuid, storage_url, file_name, 
                original_file_name, file_size_bytes, mime_type, created_at, server_synced_at
            ) VALUES (
                :user_id, :tx_uuid, :url, :fname, 
                :orig_fname, :fsize, :mime, :created_at, :server_synced_at
            )
        ");
        $stmt->execute([
            ':user_id'          => $userId,
            ':tx_uuid'          => $transactionUuid ?: $txIdentifier,
            ':url'              => $storageUrl,
            ':fname'            => $generatedFileName,
            ':orig_fname'       => $originalFileName,
            ':fsize'            => $fileSize,
            ':mime'             => $detectedMime,
            ':created_at'       => $now,
            ':server_synced_at' => $now,
        ]);
        $serverId = intval($db->lastInsertId());
    } catch (Exception $e) {
        // If column original_file_name does not exist yet, fallback gracefully
        try {
            $stmt = $db->prepare("
                INSERT INTO transaction_images (
                    user_id, transaction_uuid, storage_url, file_name, 
                    file_size_bytes, mime_type, created_at, server_synced_at
                ) VALUES (
                    :user_id, :tx_uuid, :url, :fname, 
                    :fsize, :mime, :created_at, :server_synced_at
                )
            ");
            $stmt->execute([
                ':user_id'          => $userId,
                ':tx_uuid'          => $transactionUuid ?: $txIdentifier,
                ':url'              => $storageUrl,
                ':fname'            => $generatedFileName,
                ':fsize'            => $fileSize,
                ':mime'             => $detectedMime,
                ':created_at'       => $now,
                ':server_synced_at' => $now,
            ]);
            $serverId = intval($db->lastInsertId());
        } catch (Exception $fallbackErr) {
            // Ignore DB log error
        }
    }
}

// 10. Return Structured JSON Response
sendJsonResponse([
    'success'            => true,
    'saved'              => true,
    'server_id'          => $serverId ?: $now,
    'transaction_uuid'   => $transactionUuid ?: $txIdentifier,
    'file_name'          => $generatedFileName,
    'original_file_name' => $originalFileName,
    'storage_path'       => $relativeStoragePath,
    'storage_url'        => $storageUrl,
    'file_size'          => $fileSize,
    'mime_type'          => $detectedMime,
    'created_at'         => $now,
], 200);
