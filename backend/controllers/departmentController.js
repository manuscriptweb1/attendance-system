const pool = require('../config/database');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');

// Get all departments with employee count
const getAllDepartments = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT d.*, COUNT(e.id) as employee_count 
       FROM departments d 
       LEFT JOIN employees e ON d.id = e.department_id 
       GROUP BY d.id 
       ORDER BY d.name ASC`
    );

    res.json({
      success: true,
      departments: result.rows
    });
  } catch (error) {
    console.error('Get departments error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Add new department
const addDepartment = async (req, res) => {
  try {
    let { name, description, status } = req.body;

    // Validation
    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Department name is required' 
      });
    }

    name = name.trim();
    description = description ? description.trim() : null;
    status = status || 'Active';

    // Check for case-insensitive duplicates
    const checkResult = await pool.query(
      'SELECT * FROM departments WHERE LOWER(name) = LOWER($1)',
      [name]
    );

    if (checkResult.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        errorCode: 'DEPARTMENT_ALREADY_EXISTS',
        message: 'A department with this name already exists.' 
      });
    }

    // Insert department
    const result = await pool.query(
      `INSERT INTO departments (name, description, status) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [name, description, status]
    );

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: 'CREATE_DEPARTMENT',
      moduleName: 'DEPARTMENT',
      description: `Created department - ${name}`,
      newData: { name, description, status },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.status(201).json({
      success: true,
      message: 'Department added successfully',
      department: result.rows[0]
    });

  } catch (error) {
    console.error('Add department error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Update department
const updateDepartment = async (req, res) => {
  try {
    const { id } = req.params;
    let { name, description, status } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ 
        success: false, 
        message: 'Department name is required' 
      });
    }

    name = name.trim();
    description = description ? description.trim() : null;

    // Check if department exists
    const checkExist = await pool.query(
      'SELECT * FROM departments WHERE id = $1',
      [id]
    );

    if (checkExist.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Department not found' 
      });
    }

    // Check for duplicate name in other departments
    const checkDuplicate = await pool.query(
      'SELECT * FROM departments WHERE LOWER(name) = LOWER($1) AND id != $2',
      [name, id]
    );

    if (checkDuplicate.rows.length > 0) {
      return res.status(409).json({ 
        success: false, 
        errorCode: 'DEPARTMENT_ALREADY_EXISTS',
        message: 'A department with this name already exists.' 
      });
    }

    const oldData = {
      name: checkExist.rows[0].name,
      description: checkExist.rows[0].description,
      status: checkExist.rows[0].status
    };

    // Update
    const result = await pool.query(
      `UPDATE departments 
       SET name = $1, description = $2, status = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4 
       RETURNING *`,
      [name, description, status, id]
    );

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: 'UPDATE_DEPARTMENT',
      moduleName: 'DEPARTMENT',
      description: `Updated department - ${name}`,
      oldData,
      newData: { name, description, status },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Department updated successfully',
      department: result.rows[0]
    });

  } catch (error) {
    console.error('Update department error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

// Delete department
const deleteDepartment = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if department exists
    const checkExist = await pool.query(
      'SELECT * FROM departments WHERE id = $1',
      [id]
    );

    if (checkExist.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Department not found' 
      });
    }

    // Check if it's assigned to any employees
    const checkEmployees = await pool.query(
      'SELECT COUNT(*) FROM employees WHERE department_id = $1',
      [id]
    );

    if (parseInt(checkEmployees.rows[0].count) > 0) {
      return res.status(409).json({ 
        success: false, 
        message: 'This department is currently assigned to employees and cannot be deleted.' 
      });
    }

    // Delete
    const result = await pool.query(
      'DELETE FROM departments WHERE id = $1 RETURNING *',
      [id]
    );

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: 'DELETE_DEPARTMENT',
      moduleName: 'DEPARTMENT',
      description: `Deleted department - ${checkExist.rows[0].name}`,
      oldData: {
        name: checkExist.rows[0].name,
        description: checkExist.rows[0].description
      },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });

    res.json({
      success: true,
      message: 'Department deleted successfully',
      department: result.rows[0]
    });

  } catch (error) {
    console.error('Delete department error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
};

module.exports = {
  getAllDepartments,
  addDepartment,
  updateDepartment,
  deleteDepartment
};
