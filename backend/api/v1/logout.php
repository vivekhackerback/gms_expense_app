<?php
/**
 * User Logout API Endpoint
 * POST /api/v1/logout.php
 */

require_once __DIR__ . '/db_connect.php';

sendJsonResponse([
    'success' => true,
    'message' => 'Logged out successfully.'
], 200);
