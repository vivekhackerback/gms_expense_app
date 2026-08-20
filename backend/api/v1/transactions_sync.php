<?php
/**
 * Real Transaction Sync API Endpoint
 * POST /api/v1/transactions_sync.php
 * 
 * Receives JSON batch from SQLite, validates records,
 * performs idempotent UPSERT on MySQL `transactions` table using `client_uuid`,
 * and returns verified server IDs.
 */

require_once __DIR__ . '/db_connect.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Method not allowed. Use POST.'
    ], 405);
}

$rawInput = file_get_contents('php://input');
$payload = json_decode($rawInput, true);

if (!$payload || !isset($payload['records']) || !is_array($payload['records'])) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Invalid JSON request. Expected { records: [...] }.'
    ], 400);
}

$db = getDbConnection();
if (!$db) {
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Database connection unavailable.'
    ], 503);
}

$records = $payload['records'];
$deviceUuid = isset($payload['device_uuid']) ? trim($payload['device_uuid']) : 'default_device';
$userId = 1; // Default tenant or extract from Auth token

$syncedRecords = [];
$now = gmdate('Y-m-d H:i:s');

try {
    $db->beginTransaction();

    $stmt = $db->prepare("
        INSERT INTO transactions (
            user_id, client_uuid, party_id, category_id, type, payment_mode, 
            amount, note, transaction_date, client_created_at, client_updated_at
        ) VALUES (
            :user_id, :client_uuid, :party_id, :category_id, :type, :payment_mode, 
            :amount, :note, :transaction_date, :client_created_at, :client_updated_at
        ) ON DUPLICATE KEY UPDATE
            party_id = VALUES(party_id),
            category_id = VALUES(category_id),
            type = VALUES(type),
            payment_mode = VALUES(payment_mode),
            amount = VALUES(amount),
            note = VALUES(note),
            transaction_date = VALUES(transaction_date),
            client_updated_at = VALUES(client_updated_at),
            server_updated_at = CURRENT_TIMESTAMP
    ");

    $selectStmt = $db->prepare("SELECT id FROM transactions WHERE client_uuid = :client_uuid LIMIT 1");

    foreach ($records as $rec) {
        if (empty($rec['uuid']) || !isset($rec['amount']) || empty($rec['type'])) {
            continue;
        }

        $stmt->execute([
            ':user_id'           => $userId,
            ':client_uuid'       => $rec['uuid'],
            ':party_id'          => !empty($rec['party_id']) ? intval($rec['party_id']) : null,
            ':category_id'       => !empty($rec['category_id']) ? intval($rec['category_id']) : null,
            ':type'              => ($rec['type'] === 'got') ? 'got' : 'gave',
            ':payment_mode'      => (isset($rec['payment_mode']) && $rec['payment_mode'] === 'online') ? 'online' : 'cash',
            ':amount'            => floatval($rec['amount']),
            ':note'              => isset($rec['note']) ? trim($rec['note']) : null,
            ':transaction_date'  => isset($rec['transaction_date']) ? date('Y-m-d H:i:s', strtotime($rec['transaction_date'])) : $now,
            ':client_created_at' => isset($rec['created_at']) ? date('Y-m-d H:i:s', strtotime($rec['created_at'])) : $now,
            ':client_updated_at' => isset($rec['updated_at']) ? date('Y-m-d H:i:s', strtotime($rec['updated_at'])) : $now,
        ]);

        $selectStmt->execute([':client_uuid' => $rec['uuid']]);
        $row = $selectStmt->fetch();
        $serverId = $row ? intval($row['id']) : $db->lastInsertId();

        $syncedRecords[] = [
            'uuid'      => $rec['uuid'],
            'server_id' => $serverId,
            'status'    => 'saved'
        ];
    }

    $db->commit();

    sendJsonResponse([
        'success'          => true,
        'saved'            => true,
        'count'            => count($syncedRecords),
        'synced_records'   => $syncedRecords,
        'server_timestamp' => gmdate('Y-m-d\TH:i:s\Z')
    ], 200);

} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    sendJsonResponse([
        'success' => false,
        'saved'   => false,
        'message' => 'Transaction save failed: ' . $e->getMessage()
    ], 500);
}
