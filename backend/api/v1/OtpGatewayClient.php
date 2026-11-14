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

    public function getBaseUrl(): string
    {
        return $this->baseUrl;
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
     * Supports:
     * - Option A: country_code & mobile_number (Recommended in new API docs)
     * - Option B: Full international phone in E.164 (+918651615629)
     * - Option C: Legacy 10-digit number
     * 
     * Note: Meta enforces a strict 15-character limit on template parameter index 1 (purpose).
     */
    public function sendOtp(string $phone, string $purpose = 'Verification', int $expirySeconds = 300, ?string $countryCode = null, ?string $mobileNumber = null): array
    {
        $cleanPhone = preg_replace('/\D/', '', $phone);
        $cleanCountry = !empty($countryCode) ? (strpos($countryCode, '+') === 0 ? $countryCode : ('+' . preg_replace('/\D/', '', $countryCode))) : '+91';
        $cleanMobile = !empty($mobileNumber) ? preg_replace('/\D/', '', $mobileNumber) : $cleanPhone;

        // Strip leading country dial digits if accidentally part of mobileNumber
        $dialDigits = preg_replace('/\D/', '', $cleanCountry);
        if (!empty($dialDigits) && strpos($cleanMobile, $dialDigits) === 0 && strlen($cleanMobile) > 10) {
            $cleanMobile = substr($cleanMobile, strlen($dialDigits));
        }

        // Full E.164 phone string
        $e164Phone = (strpos($phone, '+') === 0) ? $phone : ($cleanCountry . $cleanMobile);

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

        $payload = [
            'country_code'   => $cleanCountry,
            'mobile_number'  => $cleanMobile,
            'phone'          => $e164Phone,
            'purpose'        => $cleanPurpose,
            'expiry_seconds' => $expirySeconds,
        ];

        return $this->request('POST', '/otp/send', $payload);
    }

    /**
     * Endpoint 2: Resend OTP
     * Route: POST /otp/resend
     * 
     * Resends an active OTP challenge or triggers a new challenge while respecting cooldown.
     * Preserves country dialing code.
     */
    public function resendOtp(string $challengeId, ?string $countryCode = null, ?string $mobileNumber = null): array
    {
        $payload = [
            'challenge_id' => trim($challengeId),
        ];
        if (!empty($countryCode)) {
            $payload['country_code'] = (strpos($countryCode, '+') === 0) ? $countryCode : ('+' . preg_replace('/\D/', '', $countryCode));
        }
        if (!empty($mobileNumber)) {
            $cleanMobile = preg_replace('/\D/', '', $mobileNumber);
            if (!empty($countryCode)) {
                $dialDigits = preg_replace('/\D/', '', $countryCode);
                if (strpos($cleanMobile, $dialDigits) === 0 && strlen($cleanMobile) > 10) {
                    $cleanMobile = substr($cleanMobile, strlen($dialDigits));
                }
            }
            $payload['mobile_number'] = $cleanMobile;
        }

        return $this->request('POST', '/otp/resend', $payload);
    }

    /**
     * Endpoint 3: Supported Countries Catalog
     * Route: GET /countries
     * 
     * Returns the 61-country catalog with code, name, dial_code, flag, example.
     */
    public function getCountries(?string $query = null): array
    {
        $path = '/countries' . (!empty($query) ? ('?q=' . urlencode(trim($query))) : '');
        return $this->request('GET', $path);
    }

    /**
     * Endpoint 4: Verify OTP
     * Route: POST /otp/verify
     * 
     * Supports validation by challenge_id or (country_code + mobile_number).
     */
    public function verifyOtp(string $challengeId, string $otp, ?string $countryCode = null, ?string $mobileNumber = null): array
    {
        $payload = [
            'challenge_id' => trim($challengeId),
            'otp'          => trim($otp),
        ];
        if (!empty($countryCode)) {
            $payload['country_code'] = (strpos($countryCode, '+') === 0) ? $countryCode : ('+' . preg_replace('/\D/', '', $countryCode));
        }
        if (!empty($mobileNumber)) {
            $cleanMobile = preg_replace('/\D/', '', $mobileNumber);
            if (!empty($countryCode)) {
                $dialDigits = preg_replace('/\D/', '', $countryCode);
                if (strpos($cleanMobile, $dialDigits) === 0 && strlen($cleanMobile) > 10) {
                    $cleanMobile = substr($cleanMobile, strlen($dialDigits));
                }
            }
            $payload['mobile_number'] = $cleanMobile;
        }

        return $this->request('POST', '/otp/verify', $payload);
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
            $isTimeout = (stripos((string)$error, 'timed out') !== false || stripos((string)$error, 'timeout') !== false || $code === 408);
            return [
                'success'   => false,
                'status'    => $isTimeout ? 'timeout' : 'failed',
                'message'   => $isTimeout ? 'Unable to send OTP. Try again.' : ('HTTP request failed: ' . ($error ?: 'Empty response')),
                'http_code' => $code,
            ];
        }

        $decoded = json_decode((string)$raw, true);
        if (!is_array($decoded)) {
            return [
                'success'   => false,
                'status'    => 'invalid_response',
                'message'   => 'Unable to verify OTP delivery status',
                'http_code' => $code,
                'raw'       => $raw,
            ];
        }

        $decoded['http_code'] = $code;
        return $decoded;
    }
}
