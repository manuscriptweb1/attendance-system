function toDateInputValue(dateValue) {
  if (!dateValue) return "";

  // If already YYYY-MM-DD, return only date part
  if (typeof dateValue === "string") {
    return dateValue.split("T")[0];
  }

  // For Date object, format using local date parts, not UTC ISO
  const year = dateValue.getFullYear();
  const month = String(dateValue.getMonth() + 1).padStart(2, "0");
  const day = String(dateValue.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateValue) {
  if (!dateValue) return "-";

  const dateOnly = toDateInputValue(dateValue);
  const [year, month, day] = dateOnly.split("-");

  if (!year || !month || !day) return "-";

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(day)} ${monthNames[Number(month) - 1]} ${year}`;
}

export {
  toDateInputValue,
  formatDisplayDate
};
