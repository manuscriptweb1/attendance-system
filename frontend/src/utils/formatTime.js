// Format working hours from decimal to hours and minutes
export const formatWorkingHours = (decimalHours) => {
  if (!decimalHours || decimalHours === 0) return '-';
  
  const hours = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hours) * 60);
  
  if (hours === 0) {
    return `${minutes} min${minutes !== 1 ? 's' : ''}`;
  } else if (minutes === 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  } else {
    return `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
  }
};

// Format time from timestamp safely in Asia/Kolkata timezone
export const formatTime = (timestamp) => {
  if (!timestamp) return '-';

  if (typeof timestamp === 'string') {
    const trimmed = timestamp.trim();
    // Raw time string like '18:00' or '18:00:00'
    if (/^\d{1,2}:\d{2}(?::\d{2})?$/.test(trimmed)) {
      return format24To12Hour(trimmed);
    }

    // If it's an ISO UTC string ending with Z or with timezone offset (+/-)
    if (trimmed.endsWith('Z') || /[+-]\d{2}(?::?\d{2})?$/.test(trimmed)) {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        return d.toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
    }

    // If it is 'YYYY-MM-DDTHH:mm:ss' or 'YYYY-MM-DD HH:mm:ss' without timezone, the time is already local IST
    const timeMatch = trimmed.match(/[T ](\d{1,2}:\d{2})(?::\d{2})?/);
    if (timeMatch) {
      return format24To12Hour(timeMatch[1]);
    }
  }

  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
};

// Format date
export const formatDate = (date) => {
  if (!date) return '-';
  if (typeof date === 'string') {
    const datePart = date.split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      }
    }
  }
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

// Convert 24-hour time format (HH:MM) to 12-hour format (hh:MM AM/PM)
export const format24To12Hour = (time24) => {
  if (!time24) return time24;
  
  const [hours, minutes] = time24.split(':');
  const hour = parseInt(hours, 10);
  const minute = minutes;
  
  if (hour === 0) {
    return `12:${minute} AM`;
  } else if (hour < 12) {
    return `${hour}:${minute} AM`;
  } else if (hour === 12) {
    return `12:${minute} PM`;
  } else {
    return `${hour - 12}:${minute} PM`;
  }
};
