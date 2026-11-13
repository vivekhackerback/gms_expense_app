/**
 * Supported Countries and Currencies
 * Default: India 🇮🇳 (INR - ₹)
 */

export const SUPPORTED_CURRENCIES = [
  { no: 1, name: 'India', code: 'INR', symbol: '₹', flag: '🇮🇳' },
  { no: 2, name: 'United States', code: 'USD', symbol: '$', flag: '🇺🇸' },
  { no: 3, name: 'United Kingdom', code: 'GBP', symbol: '£', flag: '🇬🇧' },
  { no: 4, name: 'Canada', code: 'CAD', symbol: 'CA$', flag: '🇨🇦' },
  { no: 5, name: 'Australia', code: 'AUD', symbol: 'A$', flag: '🇦🇺' },
  { no: 6, name: 'Germany', code: 'EUR', symbol: '€', flag: '🇩🇪' },
  { no: 7, name: 'France', code: 'EUR', symbol: '€', flag: '🇫🇷' },
  { no: 8, name: 'Japan', code: 'JPY', symbol: '¥', flag: '🇯🇵' },
  { no: 9, name: 'South Korea', code: 'KRW', symbol: '₩', flag: '🇰🇷' },
  { no: 10, name: 'Brazil', code: 'BRL', symbol: 'R$', flag: '🇧🇷' },
  { no: 11, name: 'Indonesia', code: 'IDR', symbol: 'Rp', flag: '🇮🇩' },
  { no: 12, name: 'Mexico', code: 'MXN', symbol: 'MX$', flag: '🇲🇽' },
  { no: 13, name: 'Singapore', code: 'SGD', symbol: 'S$', flag: '🇸🇬' },
  { no: 14, name: 'Malaysia', code: 'MYR', symbol: 'RM', flag: '🇲🇾' },
  { no: 15, name: 'Thailand', code: 'THB', symbol: '฿', flag: '🇹🇭' },
  { no: 16, name: 'Philippines', code: 'PHP', symbol: '₱', flag: '🇵🇭' },
  { no: 17, name: 'Vietnam', code: 'VND', symbol: '₫', flag: '🇻🇳' },
  { no: 18, name: 'Bangladesh', code: 'BDT', symbol: '৳', flag: '🇧🇩' },
  { no: 19, name: 'Pakistan', code: 'PKR', symbol: 'Rs', flag: '🇵🇰' },
  { no: 20, name: 'Nepal', code: 'NPR', symbol: 'रू', flag: '🇳🇵' },
  { no: 21, name: 'Sri Lanka', code: 'LKR', symbol: 'Rs', flag: '🇱🇰' },
  { no: 22, name: 'South Africa', code: 'ZAR', symbol: 'R', flag: '🇿🇦' },
  { no: 23, name: 'Nigeria', code: 'NGN', symbol: '₦', flag: '🇳🇬' },
  { no: 24, name: 'Kenya', code: 'KES', symbol: 'KSh', flag: '🇰🇪' },
  { no: 25, name: 'Egypt', code: 'EGP', symbol: 'E£', flag: '🇪🇬' },
  { no: 26, name: 'Saudi Arabia', code: 'SAR', symbol: '﷼', flag: '🇸🇦' },
  { no: 27, name: 'UAE', code: 'AED', symbol: 'د.إ', flag: '🇦🇪' },
  { no: 28, name: 'Qatar', code: 'QAR', symbol: 'QR', flag: '🇶🇦' },
  { no: 29, name: 'Kuwait', code: 'KWD', symbol: 'KD', flag: '🇰🇼' },
  { no: 30, name: 'Oman', code: 'OMR', symbol: 'RO', flag: '🇴🇲' },
  { no: 31, name: 'Turkey', code: 'TRY', symbol: '₺', flag: '🇹🇷' },
  { no: 32, name: 'Russia', code: 'RUB', symbol: '₽', flag: '🇷🇺' },
  { no: 33, name: 'Ukraine', code: 'UAH', symbol: '₴', flag: '🇺🇦' },
  { no: 34, name: 'Poland', code: 'PLN', symbol: 'zł', flag: '🇵🇱' },
  { no: 35, name: 'Netherlands', code: 'EUR', symbol: '€', flag: '🇳🇱' },
  { no: 36, name: 'Spain', code: 'EUR', symbol: '€', flag: '🇪🇸' },
  { no: 37, name: 'Italy', code: 'EUR', symbol: '€', flag: '🇮🇹' },
  { no: 38, name: 'Sweden', code: 'SEK', symbol: 'kr', flag: '🇸🇪' },
  { no: 39, name: 'Norway', code: 'NOK', symbol: 'kr', flag: '🇳🇴' },
  { no: 40, name: 'Switzerland', code: 'CHF', symbol: 'CHF', flag: '🇨🇭' },
  { no: 41, name: 'Argentina', code: 'ARS', symbol: 'AR$', flag: '🇦🇷' },
  { no: 42, name: 'Chile', code: 'CLP', symbol: 'CL$', flag: '🇨🇱' },
  { no: 43, name: 'Colombia', code: 'COP', symbol: 'COL$', flag: '🇨🇴' },
  { no: 44, name: 'Peru', code: 'PEN', symbol: 'S/', flag: '🇵🇪' },
  { no: 45, name: 'New Zealand', code: 'NZD', symbol: 'NZ$', flag: '🇳🇿' },
  { no: 46, name: 'Ireland', code: 'EUR', symbol: '€', flag: '🇮🇪' },
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
