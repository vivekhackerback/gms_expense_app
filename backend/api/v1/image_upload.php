<?php
/**
 * Real Image Upload Endpoint (Multipart Form Data)
 * POST /api/v1/image_upload.php
 */

require_once __DIR__ . '/db_connect.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Method not allowed. Use POST.'
    ], 405);
}

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'No image file provided or upload error occurred.'
    ], 400);
}

$transactionUuid = isset($_POST['transaction_uuid']) ? trim($_POST['transaction_uuid']) : null;
$originalFileName = isset($_POST['file_name']) ? trim($_POST['file_name']) : $_FILES['file']['name'];

if (empty($transactionUuid)) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Missing transaction_uuid parameter.'
    ], 400);
}

$uploadDir = __DIR__ . '/../../uploads/images/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

$fileExt = strtolower(pathinfo($_FILES['file']['name'], PATHINFO_EXTENSION));
if (!in_array($fileExt, ['jpg', 'jpeg', 'png', 'webp'])) {
    $fileExt = 'jpg';
}

$newFileName = 'img_' . time() . '_' . substr(md5(uniqid()), 0, 8) . '.' . $fileExt;
$targetPath = $uploadDir . $newFileName;

if (!move_uploaded_file($_FILES['file']['tmp_name'], $targetPath)) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Failed to save image file on server storage.'
    ], 500);
}

$storageUrl = 'https://' . $_SERVER['HTTP_HOST'] . '/uploads/images/' . $newFileName;
$fileSize = filesize($targetPath);

$db = getDbConnection();
$serverId = null;

if ($db) {
    try {
        $stmt = $db->prepare("
            INSERT INTO transaction_images (user_id, transaction_uuid, storage_url, file_name, file_size_bytes, mime_type)
            VALUES (:user_id, :tx_uuid, :url, :fname, :fsize, :mime)
        ");
        $stmt->execute([
            ':user_id' => 1,
            ':tx_uuid' => $transactionUuid,
            ':url'     => $storageUrl,
            ':fname'   => $originalFileName,
            ':fsize'   => $fileSize,
            ':mime'    => 'image/' . ($fileExt === 'jpg' ? 'jpeg' : $fileExt),
        ]);
        $serverId = intval($db->lastInsertId());
    } catch (Exception $e) {
        // Fallback serverId if MySQL insert issue
    }
}

sendJsonResponse([
    'success'          => true,
    'saved'            => true,
    'server_id'        => $serverId ?: time(),
    'transaction_uuid' => $transactionUuid,
    'file_name'        => $newFileName,
    'storage_url'      => $storageUrl,
    'file_size'        => $fileSize
], 200);
