const pool = require('../config/database');
const { getOfferLetterSettings } = require('../utils/offerLetterSettingsHelper');

// Helper to generate the next experience letter number e.g. EXP-2026-0001
async function generateNextExperienceNumber() {
  const currentYear = new Date().getFullYear();
  const prefix = `EXP-${currentYear}-`;

  const result = await pool.query(
    `SELECT letter_number 
     FROM experience_letters 
     WHERE letter_number LIKE $1 
     ORDER BY id DESC 
     LIMIT 1`,
    [`${prefix}%`]
  );

  if (result.rows.length === 0) {
    return `${prefix}0001`;
  }

  const lastNum = result.rows[0].letter_number;
  const parts = lastNum.split('-');
  const seqStr = parts[parts.length - 1];
  const seqNum = parseInt(seqStr, 10);

  if (isNaN(seqNum)) {
    return `${prefix}0001`;
  }

  const nextSeq = String(seqNum + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

// 1. Get all experience letters with search & filters
const getExperienceLetters = async (req, res) => {
  try {
    const { search, status, employee_id, job_role } = req.query;

    let query = `
      SELECT exp.*, e.name as employee_current_name, e.status as employee_current_status
      FROM experience_letters exp
      LEFT JOIN employees e ON exp.employee_id = e.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      params.push(`%${search.trim()}%`);
      query += ` AND (
        exp.letter_number ILIKE $${params.length} OR 
        exp.employee_name_snapshot ILIKE $${params.length} OR 
        exp.employee_id_snapshot ILIKE $${params.length} OR
        exp.job_title_snapshot ILIKE $${params.length}
      )`;
    }

    if (status && status !== 'All') {
      params.push(status);
      query += ` AND exp.status = $${params.length}`;
    }

    if (employee_id) {
      params.push(employee_id);
      query += ` AND exp.employee_id = $${params.length}`;
    }

    if (job_role) {
      params.push(job_role);
      query += ` AND exp.job_title_snapshot = $${params.length}`;
    }

    query += ` ORDER BY exp.id DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      letters: result.rows,
      experienceLetters: result.rows
    });
  } catch (error) {
    console.error('Get experience letters error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching experience letters'
    });
  }
};

// 2. Get single experience letter by ID
const getExperienceLetterById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT exp.*, e.name as employee_current_name 
       FROM experience_letters exp
       LEFT JOIN employees e ON exp.employee_id = e.employee_id
       WHERE exp.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Experience letter not found'
      });
    }

    res.json({
      success: true,
      letter: result.rows[0]
    });
  } catch (error) {
    console.error('Get experience letter by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching experience letter details'
    });
  }
};

// 3. Create Experience Letter (Draft or Generated)
const createExperienceLetter = async (req, res) => {
  try {
    const {
      employee_id,
      status = 'Draft',
      issue_date,
      joining_date,
      relieving_date,
      salutation = 'Mr.',
      employee_name,
      employee_email,
      employee_phone,
      employee_address,
      job_title,
      department,
      monthly_salary = 0,
      salary_in_words = '',
      paragraph_1,
      paragraph_2,
      paragraph_3,
      paragraph_4,
      paragraph_5,
      signatory_name,
      signatory_designation,
      signatory_email
    } = req.body;

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: 'Employee ID is required'
      });
    }

    if (!joining_date || !relieving_date) {
      return res.status(400).json({
        success: false,
        message: 'Joining date and Relieving date are required'
      });
    }

    // Fetch employee details
    const empRes = await pool.query(
      `SELECT e.*, d.name as department_name 
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.employee_id = $1 OR e.id::text = $1 
       LIMIT 1`,
      [employee_id]
    );

    const emp = empRes.rows[0] || {};
    const empId = emp.employee_id || employee_id;
    const empName = employee_name || emp.name || 'Employee';
    const empEmail = employee_email !== undefined ? employee_email : (emp.personal_email || emp.email || '');
    const empPhone = employee_phone !== undefined ? employee_phone : (emp.mobile || emp.alternate_phone_number || '');
    const empAddress = employee_address !== undefined ? employee_address : (emp.permanent_address || emp.current_address || '');
    const finalJobTitle = job_title || emp.job_role || emp.designation || 'Web Developer';
    const finalDepartment = department || emp.department_name || emp.department || 'General';
    const finalJoiningDate = joining_date || emp.joining_date || new Date().toISOString().split('T')[0];
    const finalRelievingDate = relieving_date || new Date().toISOString().split('T')[0];

    // Fetch system branding settings for snapshot
    const settings = await getOfferLetterSettings();
    const nextLetterNumber = await generateNextExperienceNumber();

    const insertQuery = `
      INSERT INTO experience_letters (
        letter_number,
        employee_id,
        status,
        issue_date,
        joining_date,
        relieving_date,
        salutation,
        employee_name_snapshot,
        employee_id_snapshot,
        employee_email_snapshot,
        employee_phone_snapshot,
        employee_address_snapshot,
        job_title_snapshot,
        department_snapshot,
        monthly_salary,
        salary_in_words,
        paragraph_1_snapshot,
        paragraph_2_snapshot,
        paragraph_3_snapshot,
        paragraph_4_snapshot,
        paragraph_5_snapshot,
        company_name_snapshot,
        header_address_snapshot,
        header_phone_snapshot,
        header_email_snapshot,
        header_website_snapshot,
        footer_line_1_snapshot,
        footer_line_2_snapshot,
        footer_line_3_snapshot,
        signatory_name,
        signatory_designation,
        signatory_email,
        created_by,
        generated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34
      ) RETURNING *
    `;

    const values = [
      nextLetterNumber,
      empId,
      status,
      issue_date || new Date().toISOString().split('T')[0],
      finalJoiningDate,
      finalRelievingDate,
      salutation,
      empName,
      empId,
      empEmail,
      empPhone,
      empAddress,
      finalJobTitle,
      finalDepartment,
      parseFloat(monthly_salary) || 0,
      salary_in_words || '',
      paragraph_1 || '',
      paragraph_2 || '',
      paragraph_3 || '',
      paragraph_4 || '',
      paragraph_5 || '',
      settings.company_name,
      settings.header_address,
      settings.header_phone,
      settings.header_email,
      settings.header_website,
      settings.footer_line_1,
      settings.footer_line_2,
      settings.footer_line_3,
      signatory_name || settings.signatory_name || 'Dr. Mueen Ahmed KK',
      signatory_designation || settings.signatory_designation || 'Authorized Signatory',
      signatory_email || settings.signatory_email || 'connect@mstechnomedia.com',
      req.admin?.id || null,
      status === 'Generated' ? new Date() : null
    ];

    const result = await pool.query(insertQuery, values);

    res.status(201).json({
      success: true,
      message: `Experience Letter ${nextLetterNumber} created successfully`,
      letter: result.rows[0]
    });
  } catch (error) {
    console.error('Create experience letter error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating experience letter'
    });
  }
};

// 4. Update Experience Letter
const updateExperienceLetter = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      issue_date,
      relieving_date,
      salutation,
      employee_name,
      employee_email,
      employee_phone,
      employee_address,
      job_title,
      department,
      monthly_salary,
      salary_in_words,
      paragraph_1,
      paragraph_2,
      paragraph_3,
      paragraph_4,
      paragraph_5,
      signatory_name,
      signatory_designation,
      signatory_email
    } = req.body;

    // Check existing
    const existingRes = await pool.query('SELECT * FROM experience_letters WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Experience letter not found'
      });
    }

    const current = existingRes.rows[0];

    const updateQuery = `
      UPDATE experience_letters SET
        status = COALESCE($1, status),
        issue_date = COALESCE($2, issue_date),
        relieving_date = COALESCE($3, relieving_date),
        salutation = COALESCE($4, salutation),
        employee_name_snapshot = COALESCE($5, employee_name_snapshot),
        employee_email_snapshot = COALESCE($6, employee_email_snapshot),
        employee_phone_snapshot = COALESCE($7, employee_phone_snapshot),
        employee_address_snapshot = COALESCE($8, employee_address_snapshot),
        job_title_snapshot = COALESCE($9, job_title_snapshot),
        department_snapshot = COALESCE($10, department_snapshot),
        monthly_salary = COALESCE($11, monthly_salary),
        salary_in_words = COALESCE($12, salary_in_words),
        paragraph_1_snapshot = COALESCE($13, paragraph_1_snapshot),
        paragraph_2_snapshot = COALESCE($14, paragraph_2_snapshot),
        paragraph_3_snapshot = COALESCE($15, paragraph_3_snapshot),
        paragraph_4_snapshot = COALESCE($16, paragraph_4_snapshot),
        paragraph_5_snapshot = COALESCE($17, paragraph_5_snapshot),
        signatory_name = COALESCE($18, signatory_name),
        signatory_designation = COALESCE($19, signatory_designation),
        signatory_email = COALESCE($20, signatory_email),
        updated_at = CURRENT_TIMESTAMP,
        generated_at = CASE WHEN $1 = 'Generated' AND generated_at IS NULL THEN CURRENT_TIMESTAMP ELSE generated_at END
      WHERE id = $21
      RETURNING *
    `;

    const values = [
      status || null,
      issue_date || null,
      relieving_date || null,
      salutation || null,
      employee_name || null,
      employee_email !== undefined ? employee_email : null,
      employee_phone !== undefined ? employee_phone : null,
      employee_address !== undefined ? employee_address : null,
      job_title || null,
      department || null,
      monthly_salary !== undefined ? parseFloat(monthly_salary) : null,
      salary_in_words || null,
      paragraph_1 !== undefined ? paragraph_1 : null,
      paragraph_2 !== undefined ? paragraph_2 : null,
      paragraph_3 !== undefined ? paragraph_3 : null,
      paragraph_4 !== undefined ? paragraph_4 : null,
      paragraph_5 !== undefined ? paragraph_5 : null,
      signatory_name || null,
      signatory_designation || null,
      signatory_email || null,
      id
    ];

    const result = await pool.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Experience letter updated successfully',
      letter: result.rows[0]
    });
  } catch (error) {
    console.error('Update experience letter error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating experience letter'
    });
  }
};

// 5. Generate / Finalize Experience Letter
const generateExperienceLetter = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE experience_letters 
       SET status = 'Generated', 
           generated_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Experience letter not found'
      });
    }

    res.json({
      success: true,
      message: 'Experience letter finalized and generated successfully',
      letter: result.rows[0]
    });
  } catch (error) {
    console.error('Generate experience letter error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating experience letter'
    });
  }
};

// 6. Delete Experience Letter
const deleteExperienceLetter = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM experience_letters WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Experience letter not found'
      });
    }

    res.json({
      success: true,
      message: `Experience Letter ${result.rows[0].letter_number} deleted successfully`
    });
  } catch (error) {
    console.error('Delete experience letter error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting experience letter'
    });
  }
};

// 7. Download Experience Letter PDF
const downloadExperienceLetterPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM experience_letters WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Experience letter not found'
      });
    }

    const exp = result.rows[0];
    const settings = await getOfferLetterSettings();
    const { generateExperienceLetterPDF } = require('../utils/experienceLetterPdfGenerator');
    const includeSignature = req.query.signature !== 'false' && req.query.signature !== false;
    const doc = await generateExperienceLetterPDF(exp, { settings, includeSignature });

    const safeName = (exp.employee_name_snapshot || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeExpNum = (exp.letter_number || 'EXP').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Experience_Letter_${safeName}_${safeExpNum}${includeSignature ? '_signed' : ''}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Download experience letter PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate experience letter PDF'
      });
    }
  }
};

// 8. Preview Experience Letter PDF
const previewExperienceLetterPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM experience_letters WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Experience letter not found'
      });
    }

    const exp = result.rows[0];
    const settings = await getOfferLetterSettings();
    const { generateExperienceLetterPDF } = require('../utils/experienceLetterPdfGenerator');
    const includeSignature = req.query.signature !== 'false' && req.query.signature !== false;
    const doc = await generateExperienceLetterPDF(exp, { settings, includeSignature });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Preview experience letter PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to preview experience letter PDF'
      });
    }
  }
};

module.exports = {
  getExperienceLetters,
  getExperienceLetterById,
  createExperienceLetter,
  updateExperienceLetter,
  generateExperienceLetter,
  deleteExperienceLetter,
  downloadExperienceLetterPDF,
  previewExperienceLetterPDF
};
