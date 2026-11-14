<?php
/**
 * User Storage & Phone Normalization Central Helper
 * GMS Expense & Khata App Backend
 * 
 * Provides centralized functions for:
 * 1. International phone number normalization (E.164 standard, dial codes, national numbers)
 * 2. Dedicated user upload directory resolution and creation based on complete international numbers
 * 3. Backward-compatible directory migration for legacy accounts
 */

// Common Country Dial Codes mapping (for detecting country when phone starts with '+')
const PHONE_DIAL_CODES = [
    '93'   => 'Afghanistan',
    '355'  => 'Albania',
    '213'  => 'Algeria',
    '376'  => 'Andorra',
    '244'  => 'Angola',
    '54'   => 'Argentina',
    '374'  => 'Armenia',
    '61'   => 'Australia',
    '43'   => 'Austria',
    '994'  => 'Azerbaijan',
    '973'  => 'Bahrain',
    '880'  => 'Bangladesh',
    '375'  => 'Belarus',
    '32'   => 'Belgium',
    '501'  => 'Belize',
    '229'  => 'Benin',
    '975'  => 'Bhutan',
    '591'  => 'Bolivia',
    '387'  => 'Bosnia and Herzegovina',
    '267'  => 'Botswana',
    '55'   => 'Brazil',
    '673'  => 'Brunei',
    '359'  => 'Bulgaria',
    '226'  => 'Burkina Faso',
    '257'  => 'Burundi',
    '855'  => 'Cambodia',
    '237'  => 'Cameroon',
    '1'    => 'United States / Canada',
    '238'  => 'Cape Verde',
    '236'  => 'Central African Republic',
    '235'  => 'Chad',
    '56'   => 'Chile',
    '86'   => 'China',
    '57'   => 'Colombia',
    '269'  => 'Comoros',
    '242'  => 'Congo',
    '506'  => 'Costa Rica',
    '385'  => 'Croatia',
    '53'   => 'Cuba',
    '357'  => 'Cyprus',
    '420'  => 'Czech Republic',
    '45'   => 'Denmark',
    '253'  => 'Djibouti',
    '593'  => 'Ecuador',
    '20'   => 'Egypt',
    '503'  => 'El Salvador',
    '240'  => 'Equatorial Guinea',
    '291'  => 'Eritrea',
    '372'  => 'Estonia',
    '251'  => 'Ethiopia',
    '679'  => 'Fiji',
    '358'  => 'Finland',
    '33'   => 'France',
    '241'  => 'Gabon',
    '220'  => 'Gambia',
    '995'  => 'Georgia',
    '49'   => 'Germany',
    '233'  => 'Ghana',
    '30'   => 'Greece',
    '502'  => 'Guatemala',
    '224'  => 'Guinea',
    '592'  => 'Guyana',
    '509'  => 'Haiti',
    '504'  => 'Honduras',
    '852'  => 'Hong Kong',
    '36'   => 'Hungary',
    '354'  => 'Iceland',
    '91'   => 'India',
    '62'   => 'Indonesia',
    '98'   => 'Iran',
    '964'  => 'Iraq',
    '353'  => 'Ireland',
    '972'  => 'Israel',
    '39'   => 'Italy',
    '225'  => 'Ivory Coast',
    '81'   => 'Japan',
    '962'  => 'Jordan',
    '7'    => 'Kazakhstan / Russia',
    '254'  => 'Kenya',
    '965'  => 'Kuwait',
    '996'  => 'Kyrgyzstan',
    '856'  => 'Laos',
    '371'  => 'Latvia',
    '961'  => 'Lebanon',
    '231'  => 'Liberia',
    '218'  => 'Libya',
    '423'  => 'Liechtenstein',
    '370'  => 'Lithuania',
    '352'  => 'Luxembourg',
    '853'  => 'Macau',
    '389'  => 'Macedonia',
    '261'  => 'Madagascar',
    '265'  => 'Malawi',
    '60'   => 'Malaysia',
    '960'  => 'Maldives',
    '223'  => 'Mali',
    '356'  => 'Malta',
    '222'  => 'Mauritania',
    '230'  => 'Mauritius',
    '52'   => 'Mexico',
    '373'  => 'Moldova',
    '377'  => 'Monaco',
    '976'  => 'Mongolia',
    '382'  => 'Montenegro',
    '212'  => 'Morocco',
    '258'  => 'Mozambique',
    '95'   => 'Myanmar',
    '264'  => 'Namibia',
    '977'  => 'Nepal',
    '31'   => 'Netherlands',
    '64'   => 'New Zealand',
    '505'  => 'Nicaragua',
    '227'  => 'Niger',
    '234'  => 'Nigeria',
    '47'   => 'Norway',
    '968'  => 'Oman',
    '92'   => 'Pakistan',
    '970'  => 'Palestine',
    '507'  => 'Panama',
    '595'  => 'Paraguay',
    '51'   => 'Peru',
    '63'   => 'Philippines',
    '48'   => 'Poland',
    '351'  => 'Portugal',
    '974'  => 'Qatar',
    '40'   => 'Romania',
    '250'  => 'Rwanda',
    '966'  => 'Saudi Arabia',
    '221'  => 'Senegal',
    '381'  => 'Serbia',
    '248'  => 'Seychelles',
    '232'  => 'Sierra Leone',
    '65'   => 'Singapore',
    '421'  => 'Slovakia',
    '386'  => 'Slovenia',
    '252'  => 'Somalia',
    '27'   => 'South Africa',
    '82'   => 'South Korea',
    '34'   => 'Spain',
    '94'   => 'Sri Lanka',
    '249'  => 'Sudan',
    '597'  => 'Suriname',
    '46'   => 'Sweden',
    '41'   => 'Switzerland',
    '963'  => 'Syria',
    '886'  => 'Taiwan',
    '992'  => 'Tajikistan',
    '255'  => 'Tanzania',
    '66'   => 'Thailand',
    '228'  => 'Togo',
    '216'  => 'Tunisia',
    '90'   => 'Turkey',
    '993'  => 'Turkmenistan',
    '256'  => 'Uganda',
    '380'  => 'Ukraine',
    '971'  => 'United Arab Emirates',
    '44'   => 'United Kingdom',
    '598'  => 'Uruguay',
    '998'  => 'Uzbekistan',
    '58'   => 'Venezuela',
    '84'   => 'Vietnam',
    '967'  => 'Yemen',
    '260'  => 'Zambia',
    '263'  => 'Zimbabwe',
];

/**
 * Normalizes a country dial code to pure digits (e.g., '+91' -> '91', '1' -> '1')
 */
function normalizeCountryDialCode(?string $countryCode): string {
    if ($countryCode === null || trim($countryCode) === '') {
        return '91'; // Default India
    }
    $digits = preg_replace('/\D/', '', $countryCode);
    return !empty($digits) ? $digits : '91';
}

/**
 * Parses and normalizes an input phone number and optional country code.
 * 
 * Supports:
 * - International format with '+': e.g. "+1 8651615629", "+91 8651615629"
 * - International format without '+': e.g. "18651615629" with country_code "1"
 * - Separate country code: phone "8651615629", country_code "+1" or "1"
 * - Legacy 10-digit Indian numbers: "8651615629" defaults to country "+91"
 * 
 * Returns an associative array:
 * [
 *     'country_code'    => '+1',          // standard format with '+'
 *     'dial_code'       => '1',           // digits only
 *     'national_number' => '8651615629',  // local mobile number
 *     'e164'            => '+18651615629',// full E.164 phone number
 *     'digits'          => '18651615629', // directory identifier digits
 * ]
 */
function parsePhoneNumber(?string $phone, ?string $countryCode = null): array {
    $rawPhone = trim($phone ?? '');
    $hasPlus = (strpos($rawPhone, '+') === 0);
    $allDigits = preg_replace('/\D/', '', $rawPhone);

    // If explicit countryCode was passed
    $passedDial = !empty($countryCode) ? normalizeCountryDialCode($countryCode) : null;

    $dialCode = '91';
    $nationalNumber = $allDigits;

    if ($hasPlus) {
        // Find best matching country dial code (longest match first)
        $matched = false;
        // Check 3-digit, 2-digit, 1-digit prefixes
        for ($len = 4; $len >= 1; $len--) {
            if (strlen($allDigits) > $len) {
                $prefix = substr($allDigits, 0, $len);
                if (isset(PHONE_DIAL_CODES[$prefix])) {
                    $dialCode = $prefix;
                    $nationalNumber = substr($allDigits, $len);
                    $matched = true;
                    break;
                }
            }
        }
        // If no predefined dial code matched, fallback to passed country code or first 1-3 digits
        if (!$matched && $passedDial && strpos($allDigits, $passedDial) === 0) {
            $dialCode = $passedDial;
            $nationalNumber = substr($allDigits, strlen($passedDial));
        } elseif (!$matched) {
            // Default to passedDial or 91
            $dialCode = $passedDial ?: '91';
            if ($passedDial && strpos($allDigits, $passedDial) === 0) {
                $nationalNumber = substr($allDigits, strlen($passedDial));
            }
        }
    } else {
        // No '+' in phone string
        if ($passedDial !== null) {
            $dialCode = $passedDial;
            // If the user already typed the dial code at the beginning of the number
            // (e.g. dialCode is '91' and phone is '918651615629' (12 digits) or dialCode is '1' and phone is '18651615629' (11 digits))
            if (strpos($allDigits, $dialCode) === 0 && strlen($allDigits) > strlen($dialCode) + 4) {
                $nationalNumber = substr($allDigits, strlen($dialCode));
            } else {
                $nationalNumber = $allDigits;
            }
        } else {
            // Default to India (+91)
            $dialCode = '91';
            if (strlen($allDigits) === 12 && substr($allDigits, 0, 2) === '91') {
                $nationalNumber = substr($allDigits, 2);
            } else {
                $nationalNumber = $allDigits;
            }
        }
    }

    // Strip any leading zeros from national number
    $nationalNumber = ltrim($nationalNumber, '0');
    if ($nationalNumber === '') {
        $nationalNumber = $allDigits;
    }

    $e164 = '+' . $dialCode . $nationalNumber;
    $digits = $dialCode . $nationalNumber;

    return [
        'country_code'    => '+' . $dialCode,
        'dial_code'       => $dialCode,
        'national_number' => $nationalNumber,
        'e164'            => $e164,
        'digits'          => $digits,
    ];
}

/**
 * Returns the normalized E.164 phone string (e.g., '+918651615629' or '+18651615629')
 */
function getUserPhoneE164(?string $phone, ?string $countryCode = null): string {
    $parsed = parsePhoneNumber($phone, $countryCode);
    return $parsed['e164'];
}

/**
 * Returns the full normalized phone digits (e.g., '918651615629' or '18651615629')
 * Suitable for upload directory names and fallback identifiers.
 */
function getUserPhoneDigits(?string $phone, ?string $countryCode = null): string {
    $parsed = parsePhoneNumber($phone, $countryCode);
    return $parsed['digits'];
}

/**
 * Returns the base absolute directory for uploads (`backend/uploads`)
 */
function getUserUploadsBaseDir(): string {
    $baseUploadsDir = realpath(__DIR__ . '/../../uploads');
    if (!$baseUploadsDir) {
        $baseUploadsDir = __DIR__ . '/../../uploads';
    }
    if (!is_dir($baseUploadsDir)) {
        @mkdir($baseUploadsDir, 0755, true);
    }
    return $baseUploadsDir;
}

/**
 * Resolves the dedicated user upload directory based on the complete international phone number.
 * 
 * Directory Structure:
 * UPLOADS/{country_code_and_phone}/[subfolder]
 * Examples:
 * - uploads/918651615629/transactions/TXN_101/
 * - uploads/18651615629/database/
 * - uploads/918651615629/profile/
 * 
 * Includes backward compatibility:
 * If the user previously had a folder at `uploads/users/{localPhone}` or `uploads/{localPhone}` (legacy 10 digits),
 * and the target international directory does not exist yet, it automatically moves the existing files over
 * safely without loss or overwriting.
 * 
 * @param string|null $phone User phone number
 * @param string|null $countryCode Dialing code e.g. '+91' or '1'
 * @param string $subfolder Optional subfolder like 'transactions', 'database', 'profile', 'documents'
 * @return string Absolute directory path on disk
 */
function getUserUploadDir(?string $phone, ?string $countryCode = null, string $subfolder = ''): string {
    $parsed = parsePhoneNumber($phone, $countryCode);
    $userDigits = $parsed['digits'];
    $nationalDigits = $parsed['national_number'];
    $baseDir = getUserUploadsBaseDir();

    // Target user directory: uploads/{country_code + national_number}
    $targetUserDir = $baseDir . '/' . $userDigits;

    // Backward Compatibility Check:
    // If target directory does not exist yet, check for legacy paths
    if (!is_dir($targetUserDir)) {
        $legacyCandidates = [
            $baseDir . '/users/' . $nationalDigits,
            $baseDir . '/' . $nationalDigits,
        ];

        foreach ($legacyCandidates as $legacyPath) {
            if (is_dir($legacyPath)) {
                // If the user is Indian (+91) or the legacy path matches, safely migrate
                if ($parsed['dial_code'] === '91' || empty($countryCode)) {
                    @rename($legacyPath, $targetUserDir);
                    break;
                }
            }
        }
    }

    if (!is_dir($targetUserDir)) {
        @mkdir($targetUserDir, 0755, true);
    }

    if (!empty($subfolder)) {
        $sanitizedSub = trim(str_replace(['..', '\\'], ['', '/'], $subfolder), '/');
        $finalDir = $targetUserDir . '/' . $sanitizedSub;
        if (!is_dir($finalDir)) {
            @mkdir($finalDir, 0755, true);
        }
        return $finalDir;
    }

    return $targetUserDir;
}

/**
 * Returns the web-accessible relative storage path for a file.
 * Example: 'uploads/918651615629/transactions/TXN_1001/img.jpg'
 */
function getUserUploadRelativePath(?string $phone, ?string $countryCode = null, string $subfolder = '', string $filename = ''): string {
    $parsed = parsePhoneNumber($phone, $countryCode);
    $userDigits = $parsed['digits'];
    $rel = 'uploads/' . $userDigits;

    if (!empty($subfolder)) {
        $sanitizedSub = trim(str_replace(['..', '\\'], ['', '/'], $subfolder), '/');
        $rel .= '/' . $sanitizedSub;
    }

    if (!empty($filename)) {
        $cleanFilename = basename($filename);
        $rel .= '/' . $cleanFilename;
    }

    return $rel;
}

/**
 * Constructs a fully qualified public URL for an uploaded file relative path.
 */
function getUserPublicStorageUrl(string $relativePath): string {
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || 
               (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https') ||
               (isset($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on');
    $protocol = $isHttps ? 'https://' : 'http://';
    $host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';

    $scriptName = isset($_SERVER['SCRIPT_NAME']) ? $_SERVER['SCRIPT_NAME'] : '';
    $apiDirPos = strpos($scriptName, '/api/v1/');
    $pathPrefix = ($apiDirPos !== false) ? substr($scriptName, 0, $apiDirPos) : '';

    return $protocol . $host . $pathPrefix . '/' . ltrim($relativePath, '/');
}
