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

// Scan directory for all available SQLite backup snapshots (.db files)
$backupFiles = [];
if (is_dir($userDbDir)) {
    $dbDirFiles = scandir($userDbDir);
    foreach ($dbDirFiles as $df) {
        if ($df !== '.' && $df !== '..' && strtolower(substr($df, -3)) === '.db') {
            $fullFilePath = $userDbDir . '/' . $df;
            $fSize = filesize($fullFilePath);
            $fTime = filemtime($fullFilePath);
            $isLatest = ($df === 'expenses_khata.db');

            // Parse timestamp if named expenses_khata_{timestamp}.db
            $parsedTime = $fTime;
            if (preg_match('/expenses_khata_(\d+)\.db$/', $df, $m)) {
                $parsedTime = intval($m[1]);
            }

            $label = $isLatest ? 'Latest Cloud Backup' : 'Cloud Snapshot (' . date('d M Y, h:i A', $parsedTime) . ')';

            $backupFiles[] = [
                'file_name'          => $df,
                'label'              => $label,
                'file_size'          => $fSize,
                'file_size_formatted'=> ($fSize >= 1048576) ? round($fSize / 1048576, 2) . ' MB' : round($fSize / 1024, 1) . ' KB',
                'backup_time'        => $parsedTime,
                'formatted_time'     => date('d M Y, h:i A', $parsedTime),
                'is_latest'          => $isLatest,
            ];
        }
    }

    // Sort backups: latest active first, then other snapshots by backup_time descending
    usort($backupFiles, function ($a, $b) {
        if ($a['is_latest'] && !$b['is_latest']) return -1;
        if (!$a['is_latest'] && $b['is_latest']) return 1;
        return $b['backup_time'] - $a['backup_time'];
    });
}

if (empty($backupFiles) && !file_exists($targetDbFile)) {
    sendJsonResponse([
        'success'        => true,
        'has_backup'     => false,
        'message'        => 'No cloud database backup found for this account.',
        'phone'          => $cleanPhone,
        'backup_time'    => null,
        'db_size'        => 0,
        'backup_files'   => [],
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

$dbSize = file_exists($targetDbFile) ? filesize($targetDbFile) : (isset($backupFiles[0]['file_size']) ? $backupFiles[0]['file_size'] : 0);
$backupTime = isset($manifest['last_backup_at']) ? $manifest['last_backup_at'] : (file_exists($targetDbFile) ? filemtime($targetDbFile) : (isset($backupFiles[0]['backup_time']) ? $backupFiles[0]['backup_time'] : time()));

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
$isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || 
           (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ||
           (isset($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on');
$protocol = $isHttps ? 'https://' : 'http://';
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';

// Detect script directory to properly handle subfolders like /expense_app_crm/
$scriptName = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '';
$apiDirPos = strpos($scriptName, '/api/v1/');
$pathPrefix = ($apiDirPos !== false) ? substr($scriptName, 0, $apiDirPos) : '';

$projectBaseUrl = $protocol . $host . $pathPrefix . '/';

$imageList = [];
foreach ($allImages as $fileName => $relPath) {
    $imageList[] = [
        'file_name'    => $fileName,
        'download_url' => $projectBaseUrl . $relPath,
        'relative_path'=> $relPath,
    ];
}

$dbDownloadUrl = $projectBaseUrl . 'api/v1/download_database.php?phone=' . urlencode($cleanPhone);

// Attach download URLs to all backup files
foreach ($backupFiles as &$bf) {
    $bf['download_url'] = $projectBaseUrl . 'api/v1/download_database.php?phone=' . urlencode($cleanPhone) . '&file=' . urlencode($bf['file_name']);
}
unset($bf);

$manifestStats = isset($manifest['stats']) && is_array($manifest['stats']) ? $manifest['stats'] : [
    'transactions' => 0,
    'parties'      => 0,
    'categories'   => 0,
];
$manifestStats['images'] = count($imageList);

sendJsonResponse([
    'success'         => true,
    'has_backup'      => true,
    'phone'           => $cleanPhone,
    'backup_time'     => $backupTime,
    'db_size'         => $dbSize,
    'db_download_url' => $dbDownloadUrl,
    'backup_files'    => $backupFiles,
    'backup_files_count' => count($backupFiles),
    'stats'           => $manifestStats,
    'image_count'     => count($imageList),
    'images'          => $imageList,
    'message'         => 'Cloud backup found and ready for import.',
], 200);
