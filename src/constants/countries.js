/**
 * Supported Countries with Dialing Codes and Flags for Mobile Number Input
 * Default: India 🇮🇳 (+91)
 */

export const COUNTRIES = [
  // Popular / Primary
  { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳' },
  { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971', flag: '🇦🇪' },
  { name: 'Canada', code: 'CA', dialCode: '+1', flag: '🇨🇦' },
  { name: 'Australia', code: 'AU', dialCode: '+61', flag: '🇦🇺' },
  { name: 'Saudi Arabia', code: 'SA', dialCode: '+966', flag: '🇸🇦' },
  { name: 'Singapore', code: 'SG', dialCode: '+65', flag: '🇸🇬' },
  { name: 'Qatar', code: 'QA', dialCode: '+974', flag: '🇶🇦' },
  { name: 'Kuwait', code: 'KW', dialCode: '+965', flag: '🇰🇼' },
  { name: 'Oman', code: 'OM', dialCode: '+968', flag: '🇴🇲' },
  { name: 'Bahrain', code: 'BH', dialCode: '+973', flag: '🇧🇭' },

  // South Asia & Neighbors
  { name: 'Bangladesh', code: 'BD', dialCode: '+880', flag: '🇧🇩' },
  { name: 'Nepal', code: 'NP', dialCode: '+977', flag: '🇳🇵' },
  { name: 'Sri Lanka', code: 'LK', dialCode: '+94', flag: '🇱🇰' },
  { name: 'Pakistan', code: 'PK', dialCode: '+92', flag: '🇵🇰' },
  { name: 'Maldives', code: 'MV', dialCode: '+960', flag: '🇲🇻' },
  { name: 'Bhutan', code: 'BT', dialCode: '+975', flag: '🇧🇹' },

  // Southeast & East Asia
  { name: 'Malaysia', code: 'MY', dialCode: '+60', flag: '🇲🇾' },
  { name: 'Indonesia', code: 'ID', dialCode: '+62', flag: '🇮🇩' },
  { name: 'Thailand', code: 'TH', dialCode: '+66', flag: '🇹🇭' },
  { name: 'Philippines', code: 'PH', dialCode: '+63', flag: '🇵🇭' },
  { name: 'Vietnam', code: 'VN', dialCode: '+84', flag: '🇻🇳' },
  { name: 'Japan', code: 'JP', dialCode: '+81', flag: '🇯🇵' },
  { name: 'South Korea', code: 'KR', dialCode: '+82', flag: '🇰🇷' },
  { name: 'Hong Kong', code: 'HK', dialCode: '+852', flag: '🇭🇰' },
  { name: 'Taiwan', code: 'TW', dialCode: '+886', flag: '🇹🇼' },
  { name: 'China', code: 'CN', dialCode: '+86', flag: '🇨🇳' },

  // Europe
  { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪' },
  { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷' },
  { name: 'Italy', code: 'IT', dialCode: '+39', flag: '🇮🇹' },
  { name: 'Spain', code: 'ES', dialCode: '+34', flag: '🇪🇸' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31', flag: '🇳🇱' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41', flag: '🇨🇭' },
  { name: 'Ireland', code: 'IE', dialCode: '+353', flag: '🇮🇪' },
  { name: 'Sweden', code: 'SE', dialCode: '+46', flag: '🇸🇪' },
  { name: 'Norway', code: 'NO', dialCode: '+47', flag: '🇳🇴' },
  { name: 'Denmark', code: 'DK', dialCode: '+45', flag: '🇩🇰' },
  { name: 'Finland', code: 'FI', dialCode: '+358', flag: '🇫🇮' },
  { name: 'Belgium', code: 'BE', dialCode: '+32', flag: '🇧🇪' },
  { name: 'Austria', code: 'AT', dialCode: '+43', flag: '🇦🇹' },
  { name: 'Portugal', code: 'PT', dialCode: '+351', flag: '🇵🇹' },
  { name: 'Poland', code: 'PL', dialCode: '+48', flag: '🇵🇱' },
  { name: 'Greece', code: 'GR', dialCode: '+30', flag: '🇬🇷' },
  { name: 'Czech Republic', code: 'CZ', dialCode: '+420', flag: '🇨🇿' },
  { name: 'Romania', code: 'RO', dialCode: '+40', flag: '🇷🇴' },
  { name: 'Hungary', code: 'HU', dialCode: '+36', flag: '🇭🇺' },
  { name: 'Turkey', code: 'TR', dialCode: '+90', flag: '🇹🇷' },
  { name: 'Russia', code: 'RU', dialCode: '+7', flag: '🇷🇺' },
  { name: 'Ukraine', code: 'UA', dialCode: '+380', flag: '🇺🇦' },

  // Americas
  { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷' },
  { name: 'Mexico', code: 'MX', dialCode: '+52', flag: '🇲🇽' },
  { name: 'Argentina', code: 'AR', dialCode: '+54', flag: '🇦🇷' },
  { name: 'Colombia', code: 'CO', dialCode: '+57', flag: '🇨🇴' },
  { name: 'Chile', code: 'CL', dialCode: '+56', flag: '🇨🇱' },
  { name: 'Peru', code: 'PE', dialCode: '+51', flag: '🇵🇪' },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64', flag: '🇳🇿' },

  // Middle East & Africa
  { name: 'South Africa', code: 'ZA', dialCode: '+27', flag: '🇿🇦' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234', flag: '🇳🇬' },
  { name: 'Kenya', code: 'KE', dialCode: '+254', flag: '🇰🇪' },
  { name: 'Egypt', code: 'EG', dialCode: '+20', flag: '🇪🇬' },
  { name: 'Israel', code: 'IL', dialCode: '+972', flag: '🇮🇱' },
  { name: 'Jordan', code: 'JO', dialCode: '+962', flag: '🇯🇴' },
  { name: 'Mauritius', code: 'MU', dialCode: '+230', flag: '🇲🇺' },
  { name: 'Ghana', code: 'GH', dialCode: '+233', flag: '🇬🇭' },
  { name: 'Tanzania', code: 'TZ', dialCode: '+255', flag: '🇹🇿' },
  { name: 'Uganda', code: 'UG', dialCode: '+256', flag: '🇺🇬' },
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
