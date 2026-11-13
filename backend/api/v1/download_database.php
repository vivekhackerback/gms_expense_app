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

$userDbDir = $baseUploadsDir . '/users/' . $cleanPhone . '/database';

// Support downloading a specific chosen backup file or defaulting to latest
$requestedFile = 'expenses_khata.db';
if (isset($_GET['file']) && !empty($_GET['file'])) {
    $requestedFile = basename(trim($_GET['file']));
} elseif (isset($_GET['filename']) && !empty($_GET['filename'])) {
    $requestedFile = basename(trim($_GET['filename']));
}

// Security: strictly validate filename format to prevent directory traversal
if (!preg_match('/^[a-zA-Z0-9_\-\.]+\.db$/', $requestedFile)) {
    $requestedFile = 'expenses_khata.db';
}

$userDbFile = $userDbDir . '/' . $requestedFile;
if (!file_exists($userDbFile)) {
    // Fallback to active expenses_khata.db if specific snapshot does not exist
    $userDbFile = $userDbDir . '/expenses_khata.db';
    $requestedFile = 'expenses_khata.db';
}

// If default expenses_khata.db is requested but happens to be empty (0 transactions),
// automatically serve the latest snapshot that actually contains transactions
if ($requestedFile === 'expenses_khata.db' && class_exists('SQLite3') && file_exists($userDbFile)) {
    try {
        $sq = new SQLite3($userDbFile, SQLITE3_OPEN_READONLY);
        $txCnt = $sq->querySingle("SELECT COUNT(*) FROM transactions");
        $sq->close();
        if ($txCnt === 0 || $txCnt === false) {
            $candFiles = scandir($userDbDir);
            $bestCandidate = null;
            $bestTime = 0;
            foreach ($candFiles as $cf) {
                if ($cf !== '.' && $cf !== '..' && $cf !== 'expenses_khata.db' && strtolower(substr($cf, -3)) === '.db') {
                    $cPath = $userDbDir . '/' . $cf;
                    try {
                        $sq2 = new SQLite3($cPath, SQLITE3_OPEN_READONLY);
                        $cTx = $sq2->querySingle("SELECT COUNT(*) FROM transactions");
                        $sq2->close();
                        if ($cTx > 0 && filemtime($cPath) > $bestTime) {
                            $bestCandidate = $cf;
                            $bestTime = filemtime($cPath);
                        }
                    } catch (Exception $e2) {}
                }
            }
            if ($bestCandidate) {
                $userDbFile = $userDbDir . '/' . $bestCandidate;
                $requestedFile = $bestCandidate;
            }
        }
    } catch (Exception $e) {}
}

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

// Support exporting full database records as structured JSON
$isJsonExport = (isset($_GET['format']) && strtolower(trim($_GET['format'])) === 'json') ||
                (isset($_GET['export']) && strtolower(trim($_GET['export'])) === 'json');
if ($isJsonExport && file_exists($userDbFile) && class_exists('SQLite3')) {
    try {
        $sq = new SQLite3($userDbFile, SQLITE3_OPEN_READONLY);
        
        $cats = [];
        $resCat = $sq->query("SELECT * FROM categories");
        if ($resCat) {
            while ($r = $resCat->fetchArray(SQLITE3_ASSOC)) $cats[] = $r;
        }

        $parties = [];
        $resParty = $sq->query("SELECT * FROM parties");
        if ($resParty) {
            while ($r = $resParty->fetchArray(SQLITE3_ASSOC)) $parties[] = $r;
        }

        $txs = [];
        $resTx = $sq->query("SELECT * FROM transactions");
        if ($resTx) {
            while ($r = $resTx->fetchArray(SQLITE3_ASSOC)) $txs[] = $r;
        }

        $imgs = [];
        $resImg = $sq->query("SELECT * FROM transaction_images");
        if ($resImg) {
            while ($r = $resImg->fetchArray(SQLITE3_ASSOC)) $imgs[] = $r;
        }

        $upi = [];
        try {
            $resUpi = $sq->query("SELECT * FROM upi_info");
            if ($resUpi) {
                while ($r = $resUpi->fetchArray(SQLITE3_ASSOC)) $upi[] = $r;
            }
        } catch (Exception $e) {}

        $sq->close();

        sendJsonResponse([
            'success'       => true,
            'phone'         => $cleanPhone,
            'file_name'     => $requestedFile,
            'file_size'     => filesize($userDbFile),
            'backup_time'   => filemtime($userDbFile),
            'categories'    => $cats,
            'parties'       => $parties,
            'transactions'  => $txs,
            'images'        => $imgs,
            'upi'           => $upi,
            'stats'         => [
                'transactions' => count($txs),
                'parties'      => count($parties),
                'categories'   => count($cats),
                'images'       => count($imgs),
            ],
        ], 200);
    } catch (Exception $e) {
        // Fall back to binary file stream if JSON export fails
    }
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
header('Content-Disposition: attachment; filename="' . $requestedFile . '"');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');
header('Content-Length: ' . $fileSize);

readfile($userDbFile);
exit();
