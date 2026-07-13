/**
 * Reusable helper to sort employee rows across different tables.
 * Safely handles missing fields and resolves different aliases for name, ID, and salary.
 *
 * @param {Array} data - The array of row objects to sort.
 * @param {string} sortBy - The sort key (e.g. 'name_asc', 'salary_desc').
 * @returns {Array} - A new sorted array.
 */
export const sortEmployeeRows = (data, sortBy = 'name_asc') => {
  if (!data || !Array.isArray(data)) return [];

  return [...data].sort((a, b) => {
    // Safely extract names
    const getName = (obj) => {
      return (obj.employee_name || obj.name || obj.full_name || obj.employeeName || '').toString().toLowerCase();
    };

    // Safely extract IDs
    const getId = (obj) => {
      return (obj.employee_id || obj.office_id || obj.employee_code || obj.emp_id || obj.code || '').toString().toLowerCase();
    };

    // Safely extract salary
    const getSalary = (obj) => {
      return parseFloat(obj.salary || obj.base_salary || obj.monthly_salary || obj.net_payable || obj.basic_salary || 0) || 0;
    };

    switch (sortBy) {
      case 'name_asc':
        return getName(a).localeCompare(getName(b));
      case 'name_desc':
        return getName(b).localeCompare(getName(a));
      case 'employee_id_asc':
        return getId(a).localeCompare(getId(b), undefined, { numeric: true, sensitivity: 'base' });
      case 'employee_id_desc':
        return getId(b).localeCompare(getId(a), undefined, { numeric: true, sensitivity: 'base' });
      case 'salary_asc':
        return getSalary(a) - getSalary(b);
      case 'salary_desc':
        return getSalary(b) - getSalary(a);
      default:
        // Default backend sorting: ORDER BY employee name ASC
        return getName(a).localeCompare(getName(b));
    }
  });
};
