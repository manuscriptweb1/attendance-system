const pool = require('../config/database');
const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
const { getClientIP } = require('../services/networkValidationService');
const { validateDateInput } = require('../utils/dateValidation');

// Helper function to get local date in YYYY-MM-DD format
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Get all holidays
const getAllHolidays = async (req, res) => {
  try {
    const { year, month } = req.query;
    
    let query = "SELECT id, TO_CHAR(holiday_date, 'YYYY-MM-DD') AS holiday_date, holiday_type, holiday_title, holiday_note, is_enabled, created_at, created_by, updated_at FROM holidays";
    const params = [];
    
    if (year) {
      query += ' WHERE EXTRACT(YEAR FROM holiday_date) = $1';
      params.push(year);
      
      if (month) {
        query += ' AND EXTRACT(MONTH FROM holiday_date) = $2';
        params.push(month);
      }
    }
    
    query += ' ORDER BY holiday_date ASC';
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      holidays: result.rows
    });
  } catch (error) {
    console.error('Get holidays error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching holidays'
    });
  }
};

// Get holiday by date
const getHolidayByDate = async (req, res) => {
  try {
    const { date } = req.params;
    
    const result = await pool.query(
      "SELECT id, TO_CHAR(holiday_date, 'YYYY-MM-DD') AS holiday_date, holiday_type, holiday_title, holiday_note, is_enabled, created_at, created_by, updated_at FROM holidays WHERE holiday_date = $1",
      [date]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }
    
    res.json({
      success: true,
      holiday: result.rows[0]
    });
  } catch (error) {
    console.error('Get holiday error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching holiday'
    });
  }
};

// Add new holiday
const addHoliday = async (req, res) => {
  try {
    const { holiday_date, holiday_type, holiday_title, holiday_note, is_enabled } = req.body;
    const adminId = req.user.id;
    
    // Validation
    if (!holiday_date || !holiday_type || !holiday_title) {
      return res.status(400).json({
        success: false,
        message: 'Holiday date, type, and title are required'
      });
    }
    
    // Validate holiday type
    if (!['Government Holiday', 'Office Holiday'].includes(holiday_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid holiday type. Must be "Government Holiday" or "Office Holiday"'
      });
    }
    
    // Check if date is Sunday
    const date = new Date(holiday_date);
    if (date.getDay() === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot create holiday on Sunday. Sundays are automatically treated as holidays.'
      });
    }
    
    // Check if holiday already exists for this date
    const existing = await pool.query(
      'SELECT * FROM holidays WHERE holiday_date = $1',
      [holiday_date]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Holiday already exists for this date'
      });
    }
    
    // Insert holiday
    const numericAdminId = Number.isInteger(Number(adminId)) ? Number(adminId) : null;
    const result = await pool.query(
      `INSERT INTO holidays (holiday_date, holiday_type, holiday_title, holiday_note, is_enabled, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [holiday_date, holiday_type, holiday_title, holiday_note || null, is_enabled !== undefined ? is_enabled : true, numericAdminId]
    );

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.CREATE_HOLIDAY,
      moduleName: MODULE_NAMES.HOLIDAY,
      description: `Created holiday: ${holiday_title} on ${holiday_date}`,
      newData: { holiday_date, holiday_type, holiday_title, holiday_note, is_enabled },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: 'Holiday added successfully',
      holiday: result.rows[0]
    });
  } catch (error) {
    console.error('Add holiday error:', error);
    
    if (error.isOperational) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.code === '23505' ? 'Holiday already exists for this date' : 'Error adding holiday'
    });
  }
};

// Update holiday
const updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { holiday_type, holiday_title, holiday_note, is_enabled, holiday_date } = req.body;
    
    // Validation
    if (!holiday_type || !holiday_title) {
      return res.status(400).json({
        success: false,
        message: 'Holiday type and title are required'
      });
    }

    // Validate holiday date if provided
    if (holiday_date) {
      validateDateInput(holiday_date, { allowFuture: true });
    }
    
    // Validate holiday type
    if (!['Government Holiday', 'Office Holiday'].includes(holiday_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid holiday type'
      });
    }
    
    // Update holiday
    const result = await pool.query(
      `UPDATE holidays 
       SET holiday_date = COALESCE($1, holiday_date), holiday_type = $2, holiday_title = $3, holiday_note = $4, 
           is_enabled = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [holiday_date ? new Date(holiday_date).toISOString().split('T')[0] : null, holiday_type, holiday_title, holiday_note || null, is_enabled !== undefined ? is_enabled : true, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.UPDATE_HOLIDAY,
      moduleName: MODULE_NAMES.HOLIDAY,
      description: `Updated holiday: ${holiday_title}`,
      newData: { holiday_date, holiday_type, holiday_title, holiday_note, is_enabled },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: 'Holiday updated successfully',
      holiday: result.rows[0]
    });
  } catch (error) {
    console.error('Update holiday error:', error);
    
    if (error.isOperational) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error updating holiday'
    });
  }
};

// Toggle holiday status
const toggleHolidayStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_enabled } = req.body;
    
    if (is_enabled === undefined) {
      return res.status(400).json({
        success: false,
        message: 'is_enabled field is required'
      });
    }
    
    const result = await pool.query(
      `UPDATE holidays 
       SET is_enabled = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [is_enabled, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.TOGGLE_HOLIDAY,
      moduleName: MODULE_NAMES.HOLIDAY,
      description: `${is_enabled ? 'Enabled' : 'Disabled'} holiday: ${result.rows[0].holiday_title}`,
      newData: { holiday_title: result.rows[0].holiday_title, is_enabled },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: `Holiday ${is_enabled ? 'enabled' : 'disabled'} successfully`,
      holiday: result.rows[0]
    });
  } catch (error) {
    console.error('Toggle holiday error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling holiday status'
    });
  }
};

// Delete holiday
const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM holidays WHERE id = $1 RETURNING *',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Holiday not found'
      });
    }

    // Log activity
    await logAdminActivity({
      adminId: req.user.id,
      adminName: req.user.username,
      adminEmail: req.user.email || '',
      actionType: ADMIN_ACTION_TYPES.DELETE_HOLIDAY,
      moduleName: MODULE_NAMES.HOLIDAY,
      description: `Deleted holiday: ${result.rows[0].holiday_title}`,
      oldData: { holiday_title: result.rows[0].holiday_title, holiday_date: result.rows[0].holiday_date },
      ipAddress: getClientIP(req),
      browserInfo: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: 'Holiday deleted successfully'
    });
  } catch (error) {
    console.error('Delete holiday error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting holiday'
    });
  }
};

// Check if date is holiday (for employee dashboard)
const checkHolidayStatus = async (req, res) => {
  try {
    const { date } = req.query;
    const checkDate = date || getLocalDateString(); // Use local date instead of UTC
    
    // Check if Sunday (using proper date parsing)
    const [year, month, day] = checkDate.split('-').map(Number);
    const dateObj = new Date(year, month - 1, day); // month is 0-indexed
    const isSunday = dateObj.getDay() === 0;
    
    console.log('=== HOLIDAY CHECK - SUNDAY CHECK ===');
    console.log('Check Date:', checkDate);
    console.log('Date Object:', dateObj.toDateString());
    console.log('Is Sunday:', isSunday);
    
    if (isSunday) {
      return res.json({
        success: true,
        isHoliday: true,
        holidayType: 'Sunday',
        holidayTitle: 'Sunday',
        holidayNote: 'Weekly off day',
        message: 'Today is Sunday. Attendance is not required.'
      });
    }
    
    // Check if enabled holiday exists
    const result = await pool.query(
      'SELECT * FROM holidays WHERE holiday_date = $1 AND is_enabled = true',
      [checkDate]
    );
    
    if (result.rows.length > 0) {
      const holiday = result.rows[0];
      return res.json({
        success: true,
        isHoliday: true,
        holidayType: holiday.holiday_type,
        holidayTitle: holiday.holiday_title,
        holidayNote: holiday.holiday_note,
        message: `Today is a ${holiday.holiday_type}: ${holiday.holiday_title}. Attendance is not required today.`
      });
    }
    
    res.json({
      success: true,
      isHoliday: false,
      message: 'Today is a working day'
    });
  } catch (error) {
    console.error('Check holiday status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking holiday status'
    });
  }
};

/**
 * @desc    Clear holiday records for a date range
 * @route   DELETE /api/holidays/clear-range
 * @access  Private/Admin
 */
const clearHolidayRange = async (req, res) => {
  try {
    const { fromDate, toDate, confirmText } = req.body;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ success: false, message: 'From Date and To Date are required' });
    }
    
    if (confirmText !== 'DELETE') {
      return res.status(400).json({ success: false, message: 'Invalid confirmation text' });
    }
    
    if (new Date(fromDate) > new Date(toDate)) {
      return res.status(400).json({ success: false, message: 'From Date cannot be after To Date' });
    }

    const { logAdminActivity, ADMIN_ACTION_TYPES, MODULE_NAMES } = require('../services/adminActivityService');
    const adminId = req.user.id;
    const adminName = req.user.name;

    const result = await pool.query(
      'DELETE FROM holidays WHERE holiday_date BETWEEN $1 AND $2 RETURNING id',
      [fromDate, toDate]
    );

    // Log the action
    await logAdminActivity({
      adminId,
      adminName,
      actionType: ADMIN_ACTION_TYPES.CLEAR_RANGE,
      moduleName: MODULE_NAMES.HOLIDAY,
      description: `Cleared holiday records from ${fromDate} to ${toDate}. Count: ${result.rowCount}`,
      ipAddress: req.ip
    });

    res.json({
      success: true,
      message: 'Holiday records cleared successfully',
      deletedCount: result.rowCount
    });

  } catch (error) {
    console.error('Clear holiday range error:', error);
    res.status(500).json({ success: false, message: 'Server error while clearing records' });
  }
};

module.exports = {
  getAllHolidays,
  getHolidayByDate,
  addHoliday,
  updateHoliday,
  toggleHolidayStatus,
  deleteHoliday,
  checkHolidayStatus,
  clearHolidayRange
};
