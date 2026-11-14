<?php
/**
 * WhatsApp OTP Gateway Client for PHP
 * Implementation based on https://otp.losttag.in/docs
 */

declare(strict_types=1);

class OtpGatewayClient
{
    private string $baseUrl;
    private string $apiKey;
    private ?string $apiSecret;

    public function __construct(string $baseUrl = 'https://otp.losttag.in/api/v1', string $apiKey = '', ?string $apiSecret = null)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->apiKey = $apiKey;
        $this->apiSecret = $apiSecret;
    }

    /**
     * Factory method to initialize client using active `otp_domain` configuration in database.
     */
    public static function fromDatabase(PDO $db): self
    {
        $stmt = $db->query("SELECT domain, api_base_url, api_key, api_secret FROM otp_domain WHERE is_active = 1 OR status = 'active' ORDER BY updated_at DESC, id DESC LIMIT 1");
        $config = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : null;

        $baseUrl = '';
        if (!empty($config['api_base_url'])) {
            $baseUrl = trim($config['api_base_url']);
        } elseif (!empty($config['domain'])) {
            $baseUrl = rtrim(trim($config['domain']), '/') . '/api/v1';
        } else {
            $baseUrl = 'https://otp.losttag.in/api/v1';
        }
        $apiKey = $config['api_key'] ?? '';
        $apiSecret = $config['api_secret'] ?? null;

        return new self($baseUrl, $apiKey, $apiSecret);
    }

    /**
     * Endpoint 1: Request & Send OTP
     * Route: POST /otp/send
     * 
     * Note: Meta enforces a strict 15-character limit on template parameter index 1 (purpose).
     */
    public function sendOtp(string $phone, string $purpose = 'Verification', int $expirySeconds = 300): array
    {
        // Strip non-digit characters
        $cleanPhone = preg_replace('/\D/', '', $phone);

        // Sanitize purpose to never exceed Meta's 15-character parameter limit (#132018)
        $cleanPurpose = trim($purpose);
        if ($cleanPurpose === 'Account Registration') {
            $cleanPurpose = 'Registration';
        } elseif ($cleanPurpose === 'Login Verification') {
            $cleanPurpose = 'Verification';
        }
        if (mb_strlen($cleanPurpose) > 15) {
            $cleanPurpose = mb_substr($cleanPurpose, 0, 15);
        }
        if (empty($cleanPurpose)) {
            $cleanPurpose = 'Verification';
        }

        return $this->request('POST', '/otp/send', [
            'phone'          => $cleanPhone,
            'purpose'        => $cleanPurpose,
            'expiry_seconds' => $expirySeconds,
        ]);
    }

    /**
     * Endpoint 2: Verify OTP
     * Route: POST /otp/verify
     */
    public function verifyOtp(string $challengeId, string $otp): array
    {
        return $this->request('POST', '/otp/verify', [
            'challenge_id' => trim($challengeId),
            'otp'          => trim($otp),
        ]);
    }

    /**
     * Endpoint 3: Check OTP & WhatsApp Delivery Status
     * Route: GET /otp/status/{challenge_id}
     */
    public function checkStatus(string $challengeId): array
    {
        return $this->request('GET', '/otp/status/' . urlencode(trim($challengeId)));
    }

    /**
     * Endpoint 4: Account Usage & Gateway Health
     * Route: GET /account/usage
     */
    public function getAccountUsage(): array
    {
        return $this->request('GET', '/account/usage');
    }

    private function request(string $method, string $path, array $data = []): array
    {
        $url = $this->baseUrl . $path;
        $ch = curl_init();

        $headers = [
            'Content-Type: application/json',
            'Accept: application/json',
        ];

        if (!empty($this->apiKey)) {
            $headers[] = 'X-API-Key: ' . $this->apiKey;
        }

        // Optional HMAC-SHA256 signature (Option B in docs)
        if (!empty($this->apiSecret)) {
            $timestamp = time();
            $rawBody = ($method === 'POST' && !empty($data)) ? json_encode($data) : '';
            $signaturePayload = "{$timestamp}.{$method}.{$path}.{$rawBody}";
            $signature = hash_hmac('sha256', $signaturePayload, $this->apiSecret);

            $headers[] = 'X-API-Timestamp: ' . $timestamp;
            $headers[] = 'X-API-Signature: ' . $signature;
        }

        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }

        $raw = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($raw === false || empty($raw)) {
            return [
                'success'   => false,
                'message'   => 'HTTP request failed: ' . ($error ?: 'Empty response'),
                'http_code' => $code,
            ];
        }

        $decoded = json_decode((string)$raw, true);
        return $decoded ?? [
            'success'   => false,
            'message'   => 'Invalid JSON response from OTP gateway',
            'http_code' => $code,
            'raw'       => $raw,
        ];
    }
}
