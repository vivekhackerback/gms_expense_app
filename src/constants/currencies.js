/**
 * Supported Countries and Currencies
 * Default: India 🇮🇳 (INR - ₹)
 */

export const SUPPORTED_CURRENCIES = [
  { no: 1, name: 'India', code: 'INR', symbol: '₹', flag: '🇮🇳', timezone: 'Asia/Kolkata' },
  { no: 2, name: 'United States', code: 'USD', symbol: '$', flag: '🇺🇸', timezone: 'America/New_York' },
  { no: 3, name: 'United Kingdom', code: 'GBP', symbol: '£', flag: '🇬🇧', timezone: 'Europe/London' },
  { no: 4, name: 'Canada', code: 'CAD', symbol: 'CA$', flag: '🇨🇦', timezone: 'America/Toronto' },
  { no: 5, name: 'Australia', code: 'AUD', symbol: 'A$', flag: '🇦🇺', timezone: 'Australia/Sydney' },
  { no: 6, name: 'Germany', code: 'EUR', symbol: '€', flag: '🇩🇪', timezone: 'Europe/Berlin' },
  { no: 7, name: 'France', code: 'EUR', symbol: '€', flag: '🇫🇷', timezone: 'Europe/Paris' },
  { no: 8, name: 'Japan', code: 'JPY', symbol: '¥', flag: '🇯🇵', timezone: 'Asia/Tokyo' },
  { no: 9, name: 'South Korea', code: 'KRW', symbol: '₩', flag: '🇰🇷', timezone: 'Asia/Seoul' },
  { no: 10, name: 'Brazil', code: 'BRL', symbol: 'R$', flag: '🇧🇷', timezone: 'America/Sao_Paulo' },
  { no: 11, name: 'Indonesia', code: 'IDR', symbol: 'Rp', flag: '🇮🇩', timezone: 'Asia/Jakarta' },
  { no: 12, name: 'Mexico', code: 'MXN', symbol: 'MX$', flag: '🇲🇽', timezone: 'America/Mexico_City' },
  { no: 13, name: 'Singapore', code: 'SGD', symbol: 'S$', flag: '🇸🇬', timezone: 'Asia/Singapore' },
  { no: 14, name: 'Malaysia', code: 'MYR', symbol: 'RM', flag: '🇲🇾', timezone: 'Asia/Kuala_Lumpur' },
  { no: 15, name: 'Thailand', code: 'THB', symbol: '฿', flag: '🇹🇭', timezone: 'Asia/Bangkok' },
  { no: 16, name: 'Philippines', code: 'PHP', symbol: '₱', flag: '🇵🇭', timezone: 'Asia/Manila' },
  { no: 17, name: 'Vietnam', code: 'VND', symbol: '₫', flag: '🇻🇳', timezone: 'Asia/Ho_Chi_Minh' },
  { no: 18, name: 'Bangladesh', code: 'BDT', symbol: '৳', flag: '🇧🇩', timezone: 'Asia/Dhaka' },
  { no: 19, name: 'Pakistan', code: 'PKR', symbol: 'Rs', flag: '🇵🇰', timezone: 'Asia/Karachi' },
  { no: 20, name: 'Nepal', code: 'NPR', symbol: 'रू', flag: '🇳🇵', timezone: 'Asia/Kathmandu' },
  { no: 21, name: 'Sri Lanka', code: 'LKR', symbol: 'Rs', flag: '🇱🇰', timezone: 'Asia/Colombo' },
  { no: 22, name: 'South Africa', code: 'ZAR', symbol: 'R', flag: '🇿🇦', timezone: 'Africa/Johannesburg' },
  { no: 23, name: 'Nigeria', code: 'NGN', symbol: '₦', flag: '🇳🇬', timezone: 'Africa/Lagos' },
  { no: 24, name: 'Kenya', code: 'KES', symbol: 'KSh', flag: '🇰🇪', timezone: 'Africa/Nairobi' },
  { no: 25, name: 'Egypt', code: 'EGP', symbol: 'E£', flag: '🇪🇬', timezone: 'Africa/Cairo' },
  { no: 26, name: 'Saudi Arabia', code: 'SAR', symbol: '﷼', flag: '🇸🇦', timezone: 'Asia/Riyadh' },
  { no: 27, name: 'UAE', code: 'AED', symbol: 'د.إ', flag: '🇦🇪', timezone: 'Asia/Dubai' },
  { no: 28, name: 'Qatar', code: 'QAR', symbol: 'QR', flag: '🇶🇦', timezone: 'Asia/Qatar' },
  { no: 29, name: 'Kuwait', code: 'KWD', symbol: 'KD', flag: '🇰🇼', timezone: 'Asia/Kuwait' },
  { no: 30, name: 'Oman', code: 'OMR', symbol: 'RO', flag: '🇴🇲', timezone: 'Asia/Muscat' },
  { no: 31, name: 'Turkey', code: 'TRY', symbol: '₺', flag: '🇹🇷', timezone: 'Europe/Istanbul' },
  { no: 32, name: 'Russia', code: 'RUB', symbol: '₽', flag: '🇷🇺', timezone: 'Europe/Moscow' },
  { no: 33, name: 'Ukraine', code: 'UAH', symbol: '₴', flag: '🇺🇦', timezone: 'Europe/Kyiv' },
  { no: 34, name: 'Poland', code: 'PLN', symbol: 'zł', flag: '🇵🇱', timezone: 'Europe/Warsaw' },
  { no: 35, name: 'Netherlands', code: 'EUR', symbol: '€', flag: '🇳🇱', timezone: 'Europe/Amsterdam' },
  { no: 36, name: 'Spain', code: 'EUR', symbol: '€', flag: '🇪🇸', timezone: 'Europe/Madrid' },
  { no: 37, name: 'Italy', code: 'EUR', symbol: '€', flag: '🇮🇹', timezone: 'Europe/Rome' },
  { no: 38, name: 'Sweden', code: 'SEK', symbol: 'kr', flag: '🇸🇪', timezone: 'Europe/Stockholm' },
  { no: 39, name: 'Norway', code: 'NOK', symbol: 'kr', flag: '🇳🇴', timezone: 'Europe/Oslo' },
  { no: 40, name: 'Switzerland', code: 'CHF', symbol: 'CHF', flag: '🇨🇭', timezone: 'Europe/Zurich' },
  { no: 41, name: 'Argentina', code: 'ARS', symbol: 'AR$', flag: '🇦🇷', timezone: 'America/Argentina/Buenos_Aires' },
  { no: 42, name: 'Chile', code: 'CLP', symbol: 'CL$', flag: '🇨🇱', timezone: 'America/Santiago' },
  { no: 43, name: 'Colombia', code: 'COP', symbol: 'COL$', flag: '🇨🇴', timezone: 'America/Bogota' },
  { no: 44, name: 'Peru', code: 'PEN', symbol: 'S/', flag: '🇵🇪', timezone: 'America/Lima' },
  { no: 45, name: 'New Zealand', code: 'NZD', symbol: 'NZ$', flag: '🇳🇿', timezone: 'Pacific/Auckland' },
  { no: 46, name: 'Ireland', code: 'EUR', symbol: '€', flag: '🇮🇪', timezone: 'Europe/Dublin' },
];

export const DEFAULT_CURRENCY = SUPPORTED_CURRENCIES[0]; // India 🇮🇳 (INR - ₹)

export const findCurrencyByCodeOrNo = (query) => {
  if (!query) return DEFAULT_CURRENCY;
  if (typeof query === 'number') {
    return SUPPORTED_CURRENCIES.find((c) => c.no === query) || DEFAULT_CURRENCY;
  }
  const clean = String(query).trim().toLowerCase();
  return (
    SUPPORTED_CURRENCIES.find(
      (c) =>
        c.code.toLowerCase() === clean ||
        c.name.toLowerCase() === clean ||
        String(c.no) === clean
    ) || DEFAULT_CURRENCY
  );
};
