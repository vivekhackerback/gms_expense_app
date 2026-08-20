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
$now = time(); // Standard Unix timestamp in seconds

try {
    $db->beginTransaction();

    $stmt = $db->prepare("
        INSERT INTO transactions (
            user_id, client_uuid, party_id, category_id, type, payment_mode, 
            amount, note, transaction_date, client_created_at, client_updated_at, server_synced_at
        ) VALUES (
            :user_id, :client_uuid, :party_id, :category_id, :type, :payment_mode, 
            :amount, :note, :transaction_date, :client_created_at, :client_updated_at, :server_synced_at
        ) ON DUPLICATE KEY UPDATE
            party_id = VALUES(party_id),
            category_id = VALUES(category_id),
            type = VALUES(type),
            payment_mode = VALUES(payment_mode),
            amount = VALUES(amount),
            note = VALUES(note),
            transaction_date = VALUES(transaction_date),
            client_updated_at = VALUES(client_updated_at),
            server_synced_at = VALUES(server_synced_at)
    ");

    $selectStmt = $db->prepare("SELECT id FROM transactions WHERE client_uuid = :client_uuid LIMIT 1");

    foreach ($records as $rec) {
        if (empty($rec['uuid']) || !isset($rec['amount']) || empty($rec['type'])) {
            continue;
        }

        $txDate = isset($rec['transaction_date']) 
            ? (is_numeric($rec['transaction_date']) ? intval($rec['transaction_date']) : strtotime($rec['transaction_date'])) 
            : $now;

        $clientCreatedAt = isset($rec['created_at']) 
            ? (is_numeric($rec['created_at']) ? intval($rec['created_at']) : strtotime($rec['created_at'])) 
            : $now;

        $clientUpdatedAt = isset($rec['updated_at']) 
            ? (is_numeric($rec['updated_at']) ? intval($rec['updated_at']) : strtotime($rec['updated_at'])) 
            : $now;

        $stmt->execute([
            ':user_id'           => $userId,
            ':client_uuid'       => $rec['uuid'],
            ':party_id'          => !empty($rec['party_id']) ? intval($rec['party_id']) : null,
            ':category_id'       => !empty($rec['category_id']) ? intval($rec['category_id']) : null,
            ':type'              => ($rec['type'] === 'got') ? 'got' : 'gave',
            ':payment_mode'      => (isset($rec['payment_mode']) && $rec['payment_mode'] === 'online') ? 'online' : 'cash',
            ':amount'            => floatval($rec['amount']),
            ':note'              => isset($rec['note']) ? trim($rec['note']) : null,
            ':transaction_date'  => $txDate,
            ':client_created_at' => $clientCreatedAt,
            ':client_updated_at' => $clientUpdatedAt,
            ':server_synced_at'  => $now,
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
        'server_timestamp' => $now
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
