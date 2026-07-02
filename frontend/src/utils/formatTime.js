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
  try {
    const d = new Date(timestamp);
    if (isNaN(d.getTime())) return '-';
    
    // Explicitly use IST to prevent browser local timezone shifting
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);
  } catch (err) {
    return '-';
  }
};

// Format date
export const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
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
