export const getAttendanceStatusClass = (status) => {
  switch ((status || "-").toUpperCase()) {
    case "P":
      return "status-present attendance-matrix-badge";
    case "A":
      return "status-absent attendance-matrix-badge";
    case "L":
      return "status-late attendance-matrix-badge";
    case "HD":
      return "status-halfday attendance-matrix-badge";
    case "S":
      return "status-sunday attendance-matrix-badge";
    case "OH":
      return "status-office-holiday attendance-matrix-badge";
    case "GH":
      return "status-government-holiday attendance-matrix-badge";
    default:
      return "status-none attendance-matrix-badge";
  }
};
