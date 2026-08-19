// Currency formatter
export const formatCurrency = (amount) => {
  const num = Math.abs(Number(amount) || 0);
  // Format with Indian numbering system (lakhs/crores)
  const formatted = num.toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
  return `₹${formatted}`;
};

// Date formatters
export const formatDateGroup = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
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

export const formatFullDateTime = (dateString) => {
  if (!dateString) return { date: '', time: '' };
  const date = new Date(dateString);
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

export const formatDayNameFullDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const fullMonths = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${days[date.getDay()]}, ${date.getDate()} ${fullMonths[date.getMonth()]} ${date.getFullYear()}`;
};

export const formatTimeOnly = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesFormatted = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesFormatted} ${ampm}`;
};

// Date Range Helpers for Filters and Reports
export const getDateRangePreset = (presetKey, customStart = null, customEnd = null) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  switch (presetKey) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr, label: 'Today' };

    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];
      return { startDate: yesterdayStr, endDate: yesterdayStr, label: 'Yesterday' };
    }

    case 'week':
    case 'this_week': {
      const firstDayOfWeek = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
      firstDayOfWeek.setDate(diff);
      const startStr = firstDayOfWeek.toISOString().split('T')[0];
      return { startDate: startStr, endDate: todayStr, label: 'This Week' };
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
        startDate: startOfLastWeek.toISOString().split('T')[0],
        endDate: endOfLastWeek.toISOString().split('T')[0],
        label: 'Last Week',
      };
    }

    case 'month':
    case 'this_month': {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startStr = firstDayOfMonth.toISOString().split('T')[0];
      return { startDate: startStr, endDate: todayStr, label: 'This Month' };
    }

    case 'last_month': {
      const firstDayOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        startDate: firstDayOfLastMonth.toISOString().split('T')[0],
        endDate: lastDayOfLastMonth.toISOString().split('T')[0],
        label: 'Last Month',
      };
    }

    case 'year': {
      const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
      const startStr = firstDayOfYear.toISOString().split('T')[0];
      return { startDate: startStr, endDate: todayStr, label: 'This Year' };
    }

    case 'custom': {
      return {
        startDate: customStart || todayStr,
        endDate: customEnd || todayStr,
        label: 'Custom Range',
      };
    }

    case 'all':
    default:
      return { startDate: null, endDate: null, label: 'All Time' };
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

