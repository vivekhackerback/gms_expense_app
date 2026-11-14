/**
 * Supported Countries with Dialing Codes and Flags for Mobile Number Input
 * Default: India 🇮🇳 (+91)
 */

export const COUNTRIES = [
  // Popular / Primary
  { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳', timezone: 'Asia/Kolkata' },
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸', timezone: 'America/New_York' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧', timezone: 'Europe/London' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪', timezone: 'Asia/Dubai' },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦', timezone: 'America/Toronto' },
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺', timezone: 'Australia/Sydney' },
  { name: 'Saudi Arabia', code: 'SA', dialCode: '+966', flag: '🇸🇦', timezone: 'Asia/Riyadh' },
  { name: 'Singapore', code: 'SG', dialCode: '+65', flag: '🇸🇬', timezone: 'Asia/Singapore' },
  { name: 'Qatar', code: 'QA', dialCode: '+974', flag: '🇶🇦', timezone: 'Asia/Qatar' },
  { name: 'Kuwait', code: 'KW', dialCode: '+965', flag: '🇰🇼', timezone: 'Asia/Kuwait' },
  { name: 'Oman', code: 'OM', dialCode: '+968', flag: '🇴🇲', timezone: 'Asia/Muscat' },
  { name: 'Bahrain', code: 'BH', dialCode: '+973', flag: '🇧🇭', timezone: 'Asia/Bahrain' },

  // South Asia & Neighbors
  { name: 'Bangladesh', code: 'BD', dialCode: '+880', flag: '🇧🇩', timezone: 'Asia/Dhaka' },
  { name: 'Nepal', code: 'NP', dialCode: '+977', flag: '🇳🇵', timezone: 'Asia/Kathmandu' },
  { name: 'Sri Lanka', code: 'LK', dialCode: '+94', flag: '🇱🇰', timezone: 'Asia/Colombo' },
  { name: 'Pakistan', code: 'PK', dialCode: '+92', flag: '🇵🇰', timezone: 'Asia/Karachi' },
  { name: 'Maldives', code: 'MV', dialCode: '+960', flag: '🇲🇻', timezone: 'Indian/Maldives' },
  { name: 'Bhutan', code: 'BT', dialCode: '+975', flag: '🇧🇹', timezone: 'Asia/Thimphu' },

  // Southeast & East Asia
  { name: 'Malaysia', code: 'MY', dialCode: '+60', flag: '🇲🇾', timezone: 'Asia/Kuala_Lumpur' },
  { name: 'Indonesia', code: 'ID', dialCode: '+62', flag: '🇮🇩', timezone: 'Asia/Jakarta' },
  { name: 'Thailand', code: 'TH', dialCode: '+66', flag: '🇹🇭', timezone: 'Asia/Bangkok' },
  { name: 'Philippines', code: 'PH', dialCode: '+63', flag: '🇵🇭', timezone: 'Asia/Manila' },
  { name: 'Vietnam', code: 'VN', dialCode: '+84', flag: '🇻🇳', timezone: 'Asia/Ho_Chi_Minh' },
  { name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵', timezone: 'Asia/Tokyo' },
  { name: 'South Korea', code: 'KR', dialCode: '+82', flag: '🇰🇷', timezone: 'Asia/Seoul' },
  { name: 'Hong Kong', code: 'HK', dialCode: '+852', flag: '🇭🇰', timezone: 'Asia/Hong_Kong' },
  { name: 'Taiwan', code: 'TW', dialCode: '+886', flag: '🇹🇼', timezone: 'Asia/Taipei' },
  { name: 'China', code: 'CN', dialCode: '+86', flag: '🇨🇳', timezone: 'Asia/Shanghai' },

  // Europe
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪', timezone: 'Europe/Berlin' },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷', timezone: 'Europe/Paris' },
  { name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹', timezone: 'Europe/Rome' },
  { name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸', timezone: 'Europe/Madrid' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱', timezone: 'Europe/Amsterdam' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭', timezone: 'Europe/Zurich' },
  { name: 'Ireland', code: 'IE', dialCode: '+353', flag: '🇮🇪', timezone: 'Europe/Dublin' },
  { name: 'Sweden', code: 'SE', dialCode: '+46', flag: '🇸🇪', timezone: 'Europe/Stockholm' },
  { name: 'Norway', code: 'NO', dialCode: '+47', flag: '🇳🇴', timezone: 'Europe/Oslo' },
  { name: 'Denmark', code: 'DK', dialCode: '+45', flag: '🇩🇰', timezone: 'Europe/Copenhagen' },
  { name: 'Finland', code: 'FI', dialCode: '+358', flag: '🇫🇮', timezone: 'Europe/Helsinki' },
  { name: 'Belgium', code: 'BE', dialCode: '+32', flag: '🇧🇪', timezone: 'Europe/Brussels' },
  { name: 'Austria', code: 'AT', dialCode: '+43', flag: '🇦🇹', timezone: 'Europe/Vienna' },
  { name: 'Portugal', code: 'PT', dialCode: '+351', flag: '🇵🇹', timezone: 'Europe/Lisbon' },
  { name: 'Poland', code: 'PL', dialCode: '+48', flag: '🇵🇱', timezone: 'Europe/Warsaw' },
  { name: 'Greece', code: 'GR', dialCode: '+30', flag: '🇬🇷', timezone: 'Europe/Athens' },
  { name: 'Czech Republic', code: 'CZ', dialCode: '+420', flag: '🇨🇿', timezone: 'Europe/Prague' },
  { name: 'Romania', code: 'RO', dialCode: '+40', flag: '🇷🇴', timezone: 'Europe/Bucharest' },
  { name: 'Hungary', code: 'HU', dialCode: '+36', flag: '🇭🇺', timezone: 'Europe/Budapest' },
  { name: 'Turkey', code: 'TR', dialCode: '+90', flag: '🇹🇷', timezone: 'Europe/Istanbul' },
  { name: 'Russia', code: 'RU', dialCode: '+7', flag: '🇷🇺', timezone: 'Europe/Moscow' },
  { name: 'Ukraine', code: 'UA', dialCode: '+380', flag: '🇺🇦', timezone: 'Europe/Kyiv' },

  // Americas
  { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷', timezone: 'America/Sao_Paulo' },
  { name: 'Mexico', code: 'MX', dialCode: '+52', flag: '🇲🇽', timezone: 'America/Mexico_City' },
  { name: 'Argentina', code: 'AR', dialCode: '+54', flag: '🇦🇷', timezone: 'America/Argentina/Buenos_Aires' },
  { name: 'Colombia', code: 'CO', dialCode: '+57', flag: '🇨🇴', timezone: 'America/Bogota' },
  { name: 'Chile', code: 'CL', dialCode: '+56', flag: '🇨🇱', timezone: 'America/Santiago' },
  { name: 'Peru', code: 'PE', dialCode: '+51', flag: '🇵🇪', timezone: 'America/Lima' },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64', flag: '🇳🇿', timezone: 'Pacific/Auckland' },

  // Middle East & Africa
  { name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦', timezone: 'Africa/Johannesburg' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234', flag: '🇳🇬', timezone: 'Africa/Lagos' },
  { name: 'Kenya', code: 'KE', dialCode: '+254', flag: '🇰🇪', timezone: 'Africa/Nairobi' },
  { name: 'Egypt', code: 'EG', dialCode: '+20', flag: '🇪🇬', timezone: 'Africa/Cairo' },
  { name: 'Israel', code: 'IL', dialCode: '+972', flag: '🇮🇱', timezone: 'Asia/Jerusalem' },
  { name: 'Jordan', code: 'JO', dialCode: '+962', flag: '🇯🇴', timezone: 'Asia/Amman' },
  { name: 'Mauritius', code: 'MU', dialCode: '+230', flag: '🇲🇺', timezone: 'Indian/Mauritius' },
  { name: 'Ghana', code: 'GH', dialCode: '+233', flag: '🇬🇭', timezone: 'Africa/Accra' },
  { name: 'Tanzania', code: 'TZ', dialCode: '+255', flag: '🇹🇿', timezone: 'Africa/Dar_es_Salaam' },
  { name: 'Uganda', code: 'UG', dialCode: '+256', flag: '🇺🇬', timezone: 'Africa/Kampala' },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // India 🇮🇳 (+91)

export const findCountryByDialCode = (dialCode) => {
  if (!dialCode) return DEFAULT_COUNTRY;
  const clean = dialCode.startsWith('+') ? dialCode : `+${dialCode}`;
  return COUNTRIES.find((c) => c.dialCode === clean) || DEFAULT_COUNTRY;
};

export const findCountryByCode = (code) => {
  if (!code) return DEFAULT_COUNTRY;
  return COUNTRIES.find((c) => c.code.toUpperCase() === code.toUpperCase()) || DEFAULT_COUNTRY;
};

/**
 * Resolves the IANA timezone for a selected country name, code, dialing code, or object.
 * Default for India: "Asia/Kolkata" (UTC+05:30)
 * Default fallback: "Asia/Kolkata"
 */
export const getTimezoneForCountry = (query) => {
  if (!query) return 'Asia/Kolkata';
  if (typeof query === 'object' && query !== null) {
    if (query.timezone) return query.timezone;
    if (query.name) return getTimezoneForCountry(query.name);
    if (query.code) return getTimezoneForCountry(query.code);
    if (query.dialCode) return getTimezoneForCountry(query.dialCode);
  }
  const clean = String(query).trim();
  if (clean.toUpperCase() === 'UTC') return 'UTC';
  if (clean.includes('/')) return clean;

  const lower = clean.toLowerCase();
  const found = COUNTRIES.find(
    (c) =>
      c.name.toLowerCase() === lower ||
      c.code.toLowerCase() === lower ||
      c.dialCode.toLowerCase() === lower ||
      c.dialCode.replace('+', '') === lower
  );
  if (found && found.timezone) return found.timezone;

  // Currency code mappings fallback
  if (lower === 'inr') return 'Asia/Kolkata';
  if (lower === 'usd') return 'America/New_York';
  if (lower === 'gbp') return 'Europe/London';
  if (lower === 'cad') return 'America/Toronto';
  if (lower === 'aud') return 'Australia/Sydney';
  if (lower === 'jpy') return 'Asia/Tokyo';
  if (lower === 'aed') return 'Asia/Dubai';
  if (lower === 'sar') return 'Asia/Riyadh';
  if (lower === 'sgd') return 'Asia/Singapore';
  if (lower === 'eur') return 'Europe/Berlin';

  return 'Asia/Kolkata';
};
