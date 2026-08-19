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
export const getDateRangePreset = (presetKey) => {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  switch (presetKey) {
    case 'today':
      return { startDate: todayStr, endDate: todayStr, label: 'Today' };

    case 'week': {
      const firstDayOfWeek = new Date(now);
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
      firstDayOfWeek.setDate(diff);
      const startStr = firstDayOfWeek.toISOString().split('T')[0];
      return { startDate: startStr, endDate: todayStr, label: 'This Week' };
    }

    case 'month': {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startStr = firstDayOfMonth.toISOString().split('T')[0];
      return { startDate: startStr, endDate: todayStr, label: 'This Month' };
    }

    case 'year': {
      const firstDayOfYear = new Date(now.getFullYear(), 0, 1);
      const startStr = firstDayOfYear.toISOString().split('T')[0];
      return { startDate: startStr, endDate: todayStr, label: 'This Year' };
    }

    case 'all':
    default:
      return { startDate: null, endDate: null, label: 'All Time' };
  }
};
