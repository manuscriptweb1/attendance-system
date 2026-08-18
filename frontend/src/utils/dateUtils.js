function toDateInputValue(dateValue) {
  if (!dateValue) return "";

  if (typeof dateValue === "string") {
    return dateValue.split("T")[0];
  }

  if (dateValue instanceof Date) {
    if (isNaN(dateValue.getTime())) return "";
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, "0");
    const day = String(dateValue.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(dateValue, options = { day: '2-digit', month: 'short', year: 'numeric' }) {
  if (!dateValue) return '—';
  if (typeof dateValue === 'string') {
    const cleanDate = dateValue.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-GB', options);
      }
    }
  }
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return String(dateValue);
  return d.toLocaleDateString('en-GB', options);
}

function formatDisplayDate(dateValue) {
  return formatDate(dateValue);
}

export {
  toDateInputValue,
  formatDate,
  formatDisplayDate
};
