// Currency formatter
export const formatCurrency = (amount, options = {}) => {
  const rawNum = Number(amount) || 0;
  const isNegative = rawNum < 0;
  const num = Math.abs(rawNum);

  // Format with Indian numbering system (lakhs/crores)
  const formatted = num.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });

  if (isNegative) {
    return `-₹${formatted}`;
  }
  return `₹${formatted}`;
};

// -------------------------------------------------------------
// Unix Timestamp & Timezone Helpers (Asia/Kolkata / IST)
// -------------------------------------------------------------

export const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns current Unix timestamp in SECONDS
 */
export const getCurrentTimestamp = () => {
  return Math.floor(Date.now() / 1000);
};

/**
 * Converts any date representation (Unix timestamp in seconds/ms, ISO string, Date object)
 * to a standardized integer Unix timestamp in SECONDS.
 */
export const toUnixTimestamp = (input) => {
  if (input === null || input === undefined || input === '') {
    return getCurrentTimestamp();
  }
  if (typeof input === 'number') {
    // If milliseconds (> 100 billion), convert to seconds
    return input > 100000000000 ? Math.floor(input / 1000) : Math.floor(input);
  }
  if (typeof input === 'string') {
    // If numeric string
    const num = Number(input);
    if (!isNaN(num) && num > 0) {
      return num > 100000000000 ? Math.floor(num / 1000) : Math.floor(num);
    }
    // Parse ISO / date string
    const parsed = new Date(input).getTime();
    return isNaN(parsed) ? getCurrentTimestamp() : Math.floor(parsed / 1000);
  }
  if (input instanceof Date) {
    return Math.floor(input.getTime() / 1000);
  }
  return getCurrentTimestamp();
};

/**
 * Converts any date input to a Javascript Date object
 */
export const parseToDate = (input) => {
  if (!input && input !== 0) return new Date();
  if (input instanceof Date) return input;
  if (typeof input === 'number') {
    return new Date(input < 100000000000 ? input * 1000 : input);
  }
  if (typeof input === 'string') {
    const num = Number(input);
    if (!isNaN(num) && num > 0) {
      return new Date(num < 100000000000 ? num * 1000 : num);
    }
    return new Date(input);
  }
  return new Date();
};

// -------------------------------------------------------------
// Date Formatters (Display in User's Timezone / Asia/Kolkata)
// -------------------------------------------------------------

export const formatDateGroup = (dateInput) => {
  if (!dateInput && dateInput !== 0) return '';
  const date = parseToDate(dateInput);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  ) {
    return 'Today';
  }

  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
};

export const formatFullDateTime = (dateInput) => {
  if (!dateInput && dateInput !== 0) return { date: '', time: '', combined: '' };
  const date = parseToDate(dateInput);
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const dateFormatted = `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
  
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // '0' should be '12'
  const minutesFormatted = minutes < 10 ? '0' + minutes : minutes;
  const timeFormatted = `${hours}:${minutesFormatted} ${ampm}`;

  return {
    date: dateFormatted,
    time: timeFormatted,
    combined: `${dateFormatted}, ${timeFormatted}`,
  };
};

export const formatDayNameFullDate = (dateInput) => {
  if (!dateInput && dateInput !== 0) return '';
  const date = parseToDate(dateInput);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const fullMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${days[date.getDay()]}, ${date.getDate()} ${fullMonths[date.getMonth()]} ${date.getFullYear()}`;
};

// -------------------------------------------------------------
// Relative Time Ago Formatter
// -------------------------------------------------------------

/**
 * Formats a date/timestamp into a friendly relative time ago string.
 * Examples: "Just now", "1 min ago", "5 mins ago", "1 hour ago", "Yesterday", "10 days ago", "1 month ago"
 */
export const formatTimeAgo = (dateInput) => {
  if (!dateInput && dateInput !== 0 && dateInput !== '0') return 'No backup yet';

  const targetTs = toUnixTimestamp(dateInput);
  if (!targetTs || targetTs <= 0) return 'No backup yet';

  const nowTs = getCurrentTimestamp();
  const diffSeconds = Math.max(0, nowTs - targetTs);

  if (diffSeconds < 45) {
    return 'Just now';
  }
  if (diffSeconds < 90) {
    return '1 min ago';
  }
  const diffMins = Math.floor(diffSeconds / 60);
  if (diffMins < 60) {
    return `${diffMins} mins ago`;
  }
  const diffHours = Math.floor(diffSeconds / 3600);
  if (diffHours < 2) {
    return '1 hour ago';
  }
  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }

  const targetDate = parseToDate(targetTs);
  const nowDate = new Date();
  const yesterday = new Date();
  yesterday.setDate(nowDate.getDate() - 1);

  if (
    targetDate.getDate() === yesterday.getDate() &&
    targetDate.getMonth() === yesterday.getMonth() &&
    targetDate.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Yesterday';
  }

  const diffDays = Math.floor(diffSeconds / 86400);
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 30) {
    return `${diffDays} days ago`;
  }

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths <= 1) {
    return '1 month ago';
  }
  if (diffMonths < 12) {
    return `${diffMonths} months ago`;
  }

  const diffYears = Math.floor(diffDays / 365);
  return diffYears <= 1 ? '1 year ago' : `${diffYears} years ago`;
};

/**
 * Formats a future Unix timestamp into friendly relative string.
 * Examples: "Due now", "in 15 mins", "in 1 hour", "in 12 hours", "Tomorrow", "in 2 days"
 */
export const formatTimeFuture = (futureInput) => {
  if (!futureInput && futureInput !== 0 && futureInput !== '0') return 'Not scheduled';
  const targetTs = toUnixTimestamp(futureInput);
  if (!targetTs || targetTs <= 0) return 'Not scheduled';

  const nowTs = getCurrentTimestamp();
  const diffSeconds = targetTs - nowTs;

  if (diffSeconds <= 0) {
    return 'Due now';
  }
  if (diffSeconds < 60) {
    return 'in a few seconds';
  }
  if (diffSeconds < 120) {
    return 'in 1 min';
  }
  const diffMins = Math.floor(diffSeconds / 60);
  if (diffMins < 60) {
    return `in ${diffMins} mins`;
  }
  const diffHours = Math.floor(diffSeconds / 3600);
  if (diffHours < 2) {
    return 'in 1 hour';
  }
  if (diffHours < 24) {
    return `in ${diffHours} hours`;
  }
  const diffDays = Math.floor(diffSeconds / 86400);
  if (diffDays === 1) {
    return 'Tomorrow';
  }
  return `in ${diffDays} days`;
};

/**
 * Formats byte count into human-readable size (KB, MB)
 */
export const formatFileSize = (bytes) => {
  const num = Number(bytes) || 0;
  if (num <= 0) return '0 KB';
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
};

// Formats Unix timestamp to standard YYYY-MM-DD string
export const formatToDateString = (dateInput) => {
  const d = parseToDate(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Date Range Helpers for Filters and Reports using Unix Timestamps
export const getDateRangePreset = (presetKey, customStart = null, customEnd = null) => {
  const now = new Date();
  const todayStr = formatToDateString(now);

  const getStartOfDayTs = (d) => {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return Math.floor(copy.getTime() / 1000);
  };

  const getEndOfDayTs = (d) => {
    const copy = new Date(d);
    copy.setHours(23, 59, 59, 999);
    return Math.floor(copy.getTime() / 1000);
  };

  switch (presetKey) {
    case 'today': {
      return {
        startDate: todayStr,
        endDate: todayStr,
        startTimestamp: getStartOfDayTs(now),
        endTimestamp: getEndOfDayTs(now),
        label: 'Today',
      };
    }

    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = formatToDateString(yesterday);
      return {
        startDate: yesterdayStr,
        endDate: yesterdayStr,
        startTimestamp: getStartOfDayTs(yesterday),
        endTimestamp: getEndOfDayTs(yesterday),
        label: 'Yesterday',
      };
    }

    case 'week':
    case 'this_week': {
      const firstDayOfWeek = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      firstDayOfWeek.setDate(diff);
      const startStr = formatToDateString(firstDayOfWeek);
      return {
        startDate: startStr,
        endDate: todayStr,
        startTimestamp: getStartOfDayTs(firstDayOfWeek),
        endTimestamp: getEndOfDayTs(now),
        label: 'This Week',
      };
    }

    case 'last_week': {
      const firstDayOfThisWeek = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      firstDayOfThisWeek.setDate(diff);

      const endOfLastWeek = new Date(firstDayOfThisWeek);
      endOfLastWeek.setDate(endOfLastWeek.getDate() - 1); // Sunday

      const startOfLastWeek = new Date(endOfLastWeek);
      startOfLastWeek.setDate(startOfLastWeek.getDate() - 6); // Monday

      return {
        startDate: formatToDateString(startOfLastWeek),
        endDate: formatToDateString(endOfLastWeek),
        startTimestamp: getStartOfDayTs(startOfLastWeek),
        endTimestamp: getEndOfDayTs(endOfLastWeek),
        label: 'Last Week',
      };
    }

    case 'month':
    case 'this_month': {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        startDate: formatToDateString(firstDayOfMonth),
        endDate: todayStr,
        startTimestamp: getStartOfDayTs(firstDayOfMonth),
        endTimestamp: getEndOfDayTs(now),
        label: 'This Month',
      };
    }

    case 'last_month': {
      const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: formatToDateString(firstDayOfLastMonth),
        endDate: formatToDateString(lastDayOfLastMonth),
        startTimestamp: getStartOfDayTs(firstDayOfLastMonth),
        endTimestamp: getEndOfDayTs(lastDayOfLastMonth),
        label: 'Last Month',
      };
    }

    case 'year': {
      const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
      return {
        startDate: formatToDateString(firstDayOfYear),
        endDate: todayStr,
        startTimestamp: getStartOfDayTs(firstDayOfYear),
        endTimestamp: getEndOfDayTs(now),
        label: 'This Year',
      };
    }

    case 'custom': {
      const startD = customStart ? parseToDate(customStart) : now;
      const endD = customEnd ? parseToDate(customEnd) : now;
      return {
        startDate: customStart || todayStr,
        endDate: customEnd || todayStr,
        startTimestamp: getStartOfDayTs(startD),
        endTimestamp: getEndOfDayTs(endD),
        label: 'Custom Range',
      };
    }

    case 'all':
    default:
      return {
        startDate: null,
        endDate: null,
        startTimestamp: null,
        endTimestamp: null,
        label: 'All Time',
      };
  }
};

// Formats user input with Indian commas on-the-fly (e.g. 125000 -> 1,25,000)
export const formatInputWithCommas = (val) => {
  if (!val) return '';
  // Remove non-digit and non-decimal chars
  const clean = val.replace(/[^0-9.]/g, '');
  if (!clean) return '';

  const parts = clean.split('.');
  let integerPart = parts[0];
  const decimalPart = parts[1];

  // Remove leading zeros if not followed by decimal
  if (integerPart.length > 1 && integerPart.startsWith('0')) {
    integerPart = integerPart.replace(/^0+/, '') || '0';
  }

  // Format integer with Indian numbering system
  if (integerPart) {
    let lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    if (otherNumbers !== '') {
      lastThree = ',' + lastThree;
    }
    integerPart = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;
  }

  if (parts.length > 1) {
    // Limit decimal to 2 digits
    return `${integerPart}.${decimalPart.substring(0, 2)}`;
  }
  return integerPart;
};

// Converts number to Indian Words (Rupees and Paise)
export const numberToWords = (num) => {
  if (num === null || num === undefined || num === '') return '';
  const val = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num;
  if (isNaN(val) || val <= 0) return '';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  const convertLessThanOneThousand = (n) => {
    let current = '';
    if (n >= 100) {
      current += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      current += tens[Math.floor(n / 10)] + (n % 10 !== 0 ? '-' + ones[n % 10] : '') + ' ';
    } else if (n > 0) {
      current += ones[n] + ' ';
    }
    return current.trim();
  };

  const integerPart = Math.floor(val);
  const decimalPart = Math.round((val - integerPart) * 100);

  if (integerPart === 0 && decimalPart === 0) return '';

  let words = '';

  const crore = Math.floor(integerPart / 10000000);
  const lakh = Math.floor((integerPart % 10000000) / 100000);
  const thousand = Math.floor((integerPart % 100000) / 1000);
  const remainder = integerPart % 1000;

  if (crore > 0) {
    words += convertLessThanOneThousand(crore) + ' Crore ';
  }
  if (lakh > 0) {
    words += convertLessThanOneThousand(lakh) + ' Lakh ';
  }
  if (thousand > 0) {
    words += convertLessThanOneThousand(thousand) + ' Thousand ';
  }
  if (remainder > 0) {
    words += convertLessThanOneThousand(remainder) + ' ';
  }

  words = words.trim();
  if (words.length > 0) {
    words += ' Rupees';
  }

  if (decimalPart > 0) {
    const paiseWords = convertLessThanOneThousand(decimalPart);
    if (words.length > 0) {
      words += ' and ' + paiseWords + ' Paise';
    } else {
      words = paiseWords + ' Paise';
    }
  }

  return words;
};

