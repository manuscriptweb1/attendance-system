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

const normalizeTimestamp = (value) => {
  if (!value) return null;

  // If timestamp has no timezone, treat it safely as UTC
  if (
    typeof value === "string" &&
    !value.endsWith("Z") &&
    !value.includes("+") &&
    !value.includes("T")
  ) {
    return `${value.replace(" ", "T")}Z`;
  }

  if (
    typeof value === "string" &&
    !value.endsWith("Z") &&
    !value.includes("+")
  ) {
    return `${value}Z`;
  }

  return value;
};

// Format time from timestamp safely in Asia/Kolkata timezone
export const formatTime = (timestamp) => {
  const normalized = normalizeTimestamp(timestamp);
  if (!normalized) return '-';
  try {
    const d = new Date(normalized);
    if (isNaN(d.getTime())) return '-';
    
    // Explicitly use IST to prevent browser local timezone shifting
    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch (err) {
    return '-';
  }
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
