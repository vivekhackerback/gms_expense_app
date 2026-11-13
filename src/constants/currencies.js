/**
 * Supported Countries and Currencies
 * Default: India 🇮🇳 (INR - ₹)
 */

export const SUPPORTED_CURRENCIES = [
  { no: 1, name: 'India', code: 'INR', symbol: '₹', flag: '🇮🇳', locale: 'en-IN' },
  { no: 2, name: 'United States', code: 'USD', symbol: '$', flag: '🇺🇸', locale: 'en-US' },
  { no: 3, name: 'United Kingdom', code: 'GBP', symbol: '£', flag: '🇬🇧', locale: 'en-GB' },
  { no: 4, name: 'Canada', code: 'CAD', symbol: 'CA$', flag: '🇨🇦', locale: 'en-CA' },
  { no: 5, name: 'Australia', code: 'AUD', symbol: 'A$', flag: '🇦🇺', locale: 'en-AU' },
  { no: 6, name: 'Germany', code: 'EUR', symbol: '€', flag: '🇩🇪', locale: 'de-DE' },
  { no: 7, name: 'France', code: 'EUR', symbol: '€', flag: '🇫🇷', locale: 'fr-FR' },
  { no: 8, name: 'Japan', code: 'JPY', symbol: '¥', flag: '🇯🇵', locale: 'ja-JP' },
  { no: 9, name: 'South Korea', code: 'KRW', symbol: '₩', flag: '🇰🇷', locale: 'ko-KR' },
  { no: 10, name: 'Brazil', code: 'BRL', symbol: 'R$', flag: '🇧🇷', locale: 'pt-BR' },
  { no: 11, name: 'Indonesia', code: 'IDR', symbol: 'Rp', flag: '🇮🇩', locale: 'id-ID' },
  { no: 12, name: 'Mexico', code: 'MXN', symbol: 'MX$', flag: '🇲🇽', locale: 'es-MX' },
  { no: 13, name: 'Singapore', code: 'SGD', symbol: 'S$', flag: '🇸🇬', locale: 'en-SG' },
  { no: 14, name: 'Malaysia', code: 'MYR', symbol: 'RM', flag: '🇲🇾', locale: 'ms-MY' },
  { no: 15, name: 'Thailand', code: 'THB', symbol: '฿', flag: '🇹🇭', locale: 'th-TH' },
  { no: 16, name: 'Philippines', code: 'PHP', symbol: '₱', flag: '🇵🇭', locale: 'en-PH' },
  { no: 17, name: 'Vietnam', code: 'VND', symbol: '₫', flag: '🇻🇳', locale: 'vi-VN' },
  { no: 18, name: 'Bangladesh', code: 'BDT', symbol: '৳', flag: '🇧🇩', locale: 'bn-BD' },
  { no: 19, name: 'Pakistan', code: 'PKR', symbol: 'Rs', flag: '🇵🇰', locale: 'ur-PK' },
  { no: 20, name: 'Nepal', code: 'NPR', symbol: 'रू', flag: '🇳🇵', locale: 'ne-NP' },
  { no: 21, name: 'Sri Lanka', code: 'LKR', symbol: 'Rs', flag: '🇱🇰', locale: 'si-LK' },
  { no: 22, name: 'South Africa', code: 'ZAR', symbol: 'R', flag: '🇿🇦', locale: 'en-ZA' },
  { no: 23, name: 'Nigeria', code: 'NGN', symbol: '₦', flag: '🇳🇬', locale: 'en-NG' },
  { no: 24, name: 'Kenya', code: 'KES', symbol: 'KSh', flag: '🇰🇪', locale: 'en-KE' },
  { no: 25, name: 'Egypt', code: 'EGP', symbol: 'E£', flag: '🇪🇬', locale: 'ar-EG' },
  { no: 26, name: 'Saudi Arabia', code: 'SAR', symbol: '﷼', flag: '🇸🇦', locale: 'ar-SA' },
  { no: 27, name: 'UAE', code: 'AED', symbol: 'د.إ', flag: '🇦🇪', locale: 'ar-AE' },
  { no: 28, name: 'Qatar', code: 'QAR', symbol: 'QR', flag: '🇶🇦', locale: 'ar-QA' },
  { no: 29, name: 'Kuwait', code: 'KWD', symbol: 'KD', flag: '🇰🇼', locale: 'ar-KW' },
  { no: 30, name: 'Oman', code: 'OMR', symbol: 'RO', flag: '🇴🇲', locale: 'ar-OM' },
  { no: 31, name: 'Turkey', code: 'TRY', symbol: '₺', flag: '🇹🇷', locale: 'tr-TR' },
  { no: 32, name: 'Russia', code: 'RUB', symbol: '₽', flag: '🇷🇺', locale: 'ru-RU' },
  { no: 33, name: 'Ukraine', code: 'UAH', symbol: '₴', flag: '🇺🇦', locale: 'uk-UA' },
  { no: 34, name: 'Poland', code: 'PLN', symbol: 'zł', flag: '🇵🇱', locale: 'pl-PL' },
  { no: 35, name: 'Netherlands', code: 'EUR', symbol: '€', flag: '🇳🇱', locale: 'nl-NL' },
  { no: 36, name: 'Spain', code: 'EUR', symbol: '€', flag: '🇪🇸', locale: 'es-ES' },
  { no: 37, name: 'Italy', code: 'EUR', symbol: '€', flag: '🇮🇹', locale: 'it-IT' },
  { no: 38, name: 'Sweden', code: 'SEK', symbol: 'kr', flag: '🇸🇪', locale: 'sv-SE' },
  { no: 39, name: 'Norway', code: 'NOK', symbol: 'kr', flag: '🇳🇴', locale: 'nb-NO' },
  { no: 40, name: 'Switzerland', code: 'CHF', symbol: 'CHF', flag: '🇨🇭', locale: 'de-CH' },
  { no: 41, name: 'Argentina', code: 'ARS', symbol: 'AR$', flag: '🇦🇷', locale: 'es-AR' },
  { no: 42, name: 'Chile', code: 'CLP', symbol: 'CL$', flag: '🇨🇱', locale: 'es-CL' },
  { no: 43, name: 'Colombia', code: 'COP', symbol: 'COL$', flag: '🇨🇴', locale: 'es-CO' },
  { no: 44, name: 'Peru', code: 'PEN', symbol: 'S/', flag: '🇵🇪', locale: 'es-PE' },
  { no: 45, name: 'New Zealand', code: 'NZD', symbol: 'NZ$', flag: '🇳🇿', locale: 'en-NZ' },
  { no: 46, name: 'Ireland', code: 'EUR', symbol: '€', flag: '🇮🇪', locale: 'en-IE' },
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

