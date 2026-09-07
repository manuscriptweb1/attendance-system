const pool = require('../config/database');
const { getOfferLetterSettings } = require('../utils/offerLetterSettingsHelper');
const { generateRelievingLetterPDF } = require('../utils/relievingLetterPdfGenerator');

// Helper to generate next relieving letter number e.g. REL-2026-0001
async function generateNextRelievingNumber() {
  const currentYear = new Date().getFullYear();
  const prefix = `REL-${currentYear}-`;

  const result = await pool.query(
    `SELECT letter_number 
     FROM relieving_letters 
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

// 1. Get all relieving letters with search & filters
const getRelievingLetters = async (req, res) => {
  try {
    const { search, status, employee_id, job_role } = req.query;

    let query = `
      SELECT rel.*, e.name as employee_current_name, e.status as employee_current_status
      FROM relieving_letters rel
      LEFT JOIN employees e ON rel.employee_id = e.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      params.push(`%${search.trim()}%`);
      query += ` AND (
        rel.letter_number ILIKE $${params.length} OR 
        rel.employee_name_snapshot ILIKE $${params.length} OR 
        rel.employee_id_snapshot ILIKE $${params.length} OR
        rel.job_title_snapshot ILIKE $${params.length}
      )`;
    }

    if (status && status !== 'All') {
      params.push(status);
      query += ` AND rel.status = $${params.length}`;
    }

    if (employee_id) {
      params.push(employee_id);
      query += ` AND rel.employee_id = $${params.length}`;
    }

    if (job_role) {
      params.push(job_role);
      query += ` AND rel.job_title_snapshot = $${params.length}`;
    }

    query += ` ORDER BY rel.id DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      letters: result.rows,
      relievingLetters: result.rows
    });
  } catch (error) {
    console.error('Get relieving letters error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching relieving letters'
    });
  }
};

// 2. Get single relieving letter by ID
const getRelievingLetterById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT rel.*, e.name as employee_current_name 
       FROM relieving_letters rel
       LEFT JOIN employees e ON rel.employee_id = e.employee_id
       WHERE rel.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Relieving letter not found'
      });
    }

    res.json({
      success: true,
      letter: result.rows[0]
    });
  } catch (error) {
    console.error('Get relieving letter by id error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching relieving letter details'
    });
  }
};

// 3. Create Relieving Letter (Draft or Generated)
const createRelievingLetter = async (req, res) => {
  try {
    const {
      employee_id,
      status = 'Draft',
      issue_date,
      resignation_date,
      joining_date,
      relieving_date,
      salutation = 'Mr.',
      employee_name,
      employee_email,
      employee_phone,
      employee_address,
      job_title,
      department,
      paragraph_1,
      paragraph_2,
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

    // Fetch employee details from DB
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
    const empName = employee_name || emp.name || 'Employee Name';
    const empEmail = employee_email !== undefined ? employee_email : (emp.personal_email || '');

    if (!empEmail || !empEmail.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Candidate personal email is required. Please provide a valid personal email.'
      });
    }

    const empPhone = employee_phone !== undefined ? employee_phone : (emp.mobile || emp.alternate_phone_number || '');
    const empAddress = employee_address !== undefined ? employee_address : (emp.permanent_address || emp.current_address || '');
    const finalJobTitle = job_title || emp.job_role || emp.designation || 'Editorial Assistant';
    const finalDepartment = department || emp.department_name || emp.department || 'General';
    const finalIssueDate = issue_date || new Date().toISOString().split('T')[0];
    const finalResignationDate = resignation_date || finalIssueDate;
    const finalJoiningDate = joining_date || emp.joining_date || finalIssueDate;
    const finalRelievingDate = relieving_date || finalIssueDate;

    // Fetch system branding settings
    const settings = await getOfferLetterSettings();
    const nextLetterNumber = await generateNextRelievingNumber();

    const insertQuery = `
      INSERT INTO relieving_letters (
        letter_number,
        employee_id,
        status,
        issue_date,
        resignation_date,
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
        paragraph_1_snapshot,
        paragraph_2_snapshot,
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
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30
      ) RETURNING *
    `;

    const values = [
      nextLetterNumber,
      empId,
      status,
      finalIssueDate,
      finalResignationDate,
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
      paragraph_1 || '',
      paragraph_2 || '',
      settings.company_name,
      settings.header_address,
      settings.header_phone,
      settings.header_email,
      settings.header_website,
      settings.footer_line_1,
      settings.footer_line_2,
      settings.footer_line_3,
      signatory_name || 'Dr. Mueen Ahmed',
      signatory_designation || settings.signatory_designation || 'Authorized Signatory',
      signatory_email || settings.signatory_email || 'connect@mstechnomedia.com',
      req.admin?.id || null,
      status === 'Generated' ? new Date() : null
    ];

    const result = await pool.query(insertQuery, values);

    res.status(201).json({
      success: true,
      message: `Relieving Letter ${nextLetterNumber} created successfully`,
      letter: result.rows[0]
    });
  } catch (error) {
    console.error('Create relieving letter error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while creating relieving letter'
    });
  }
};

// 4. Update Relieving Letter
const updateRelievingLetter = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      issue_date,
      resignation_date,
      joining_date,
      relieving_date,
      salutation,
      employee_name,
      employee_email,
      employee_phone,
      employee_address,
      job_title,
      department,
      paragraph_1,
      paragraph_2,
      signatory_name,
      signatory_designation,
      signatory_email
    } = req.body;

    const existingRes = await pool.query('SELECT * FROM relieving_letters WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Relieving letter not found'
      });
    }

    if (employee_email !== undefined && (!employee_email || !employee_email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Candidate personal email is required.'
      });
    }

    const updateQuery = `
      UPDATE relieving_letters SET
        status = COALESCE($1, status),
        issue_date = COALESCE($2, issue_date),
        resignation_date = COALESCE($3, resignation_date),
        joining_date = COALESCE($4, joining_date),
        relieving_date = COALESCE($5, relieving_date),
        salutation = COALESCE($6, salutation),
        employee_name_snapshot = COALESCE($7, employee_name_snapshot),
        employee_email_snapshot = COALESCE($8, employee_email_snapshot),
        employee_phone_snapshot = COALESCE($9, employee_phone_snapshot),
        employee_address_snapshot = COALESCE($10, employee_address_snapshot),
        job_title_snapshot = COALESCE($11, job_title_snapshot),
        department_snapshot = COALESCE($12, department_snapshot),
        paragraph_1_snapshot = COALESCE($13, paragraph_1_snapshot),
        paragraph_2_snapshot = COALESCE($14, paragraph_2_snapshot),
        signatory_name = COALESCE($15, signatory_name),
        signatory_designation = COALESCE($16, signatory_designation),
        signatory_email = COALESCE($17, signatory_email),
        updated_at = CURRENT_TIMESTAMP,
        generated_at = CASE WHEN $1 = 'Generated' AND generated_at IS NULL THEN CURRENT_TIMESTAMP ELSE generated_at END
      WHERE id = $18
      RETURNING *
    `;

    const values = [
      status || null,
      issue_date || null,
      resignation_date || null,
      joining_date || null,
      relieving_date || null,
      salutation || null,
      employee_name || null,
      employee_email !== undefined ? employee_email : null,
      employee_phone !== undefined ? employee_phone : null,
      employee_address !== undefined ? employee_address : null,
      job_title || null,
      department || null,
      paragraph_1 !== undefined ? paragraph_1 : null,
      paragraph_2 !== undefined ? paragraph_2 : null,
      signatory_name || null,
      signatory_designation || null,
      signatory_email || null,
      id
    ];

    const result = await pool.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Relieving letter updated successfully',
      letter: result.rows[0]
    });
  } catch (error) {
    console.error('Update relieving letter error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error while updating relieving letter'
    });
  }
};

// 5. Generate / Finalize Relieving Letter
const generateRelievingLetter = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE relieving_letters 
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
        message: 'Relieving letter not found'
      });
    }

    res.json({
      success: true,
      message: 'Relieving letter finalized and generated successfully',
      letter: result.rows[0]
    });
  } catch (error) {
    console.error('Generate relieving letter error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating relieving letter'
    });
  }
};

// 6. Delete Relieving Letter
const deleteRelievingLetter = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM relieving_letters WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Relieving letter not found'
      });
    }

    res.json({
      success: true,
      message: `Relieving Letter ${result.rows[0].letter_number} deleted successfully`
    });
  } catch (error) {
    console.error('Delete relieving letter error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting relieving letter'
    });
  }
};

// 7. Download Relieving Letter PDF
const downloadRelievingLetterPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM relieving_letters WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Relieving letter not found'
      });
    }

    const rel = result.rows[0];
    const settings = await getOfferLetterSettings();
    const doc = await generateRelievingLetterPDF(rel, { settings });

    const safeName = (rel.employee_name_snapshot || 'Candidate').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRelNum = (rel.letter_number || 'REL').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Relieving_Letter_${safeName}_${safeRelNum}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Download relieving letter PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate relieving letter PDF'
      });
    }
  }
};

// 8. Preview Relieving Letter PDF
const previewRelievingLetterPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM relieving_letters WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Relieving letter not found'
      });
    }

    const rel = result.rows[0];
    const settings = await getOfferLetterSettings();
    const doc = await generateRelievingLetterPDF(rel, { settings });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Preview relieving letter PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to preview relieving letter PDF'
      });
    }
  }
};

module.exports = {
  getRelievingLetters,
  getRelievingLetterById,
  createRelievingLetter,
  updateRelievingLetter,
  generateRelievingLetter,
  deleteRelievingLetter,
  downloadRelievingLetterPDF,
  previewRelievingLetterPDF
};
