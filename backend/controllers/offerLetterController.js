const pool = require('../config/database');
const { generateOfferLetterPDF } = require('../utils/offerLetterPdfGenerator');
const {
  getOfferLetterSettings,
  updateOfferLetterSettings,
  resetOfferLetterLogo
} = require('../utils/offerLetterSettingsHelper');

// Helper to generate the next offer number e.g. OFF-2026-0001
async function generateNextOfferNumber() {
  const currentYear = new Date().getFullYear();
  const prefix = `OFF-${currentYear}-`;
  
  const result = await pool.query(
    `SELECT offer_number 
     FROM offer_letters 
     WHERE offer_number LIKE $1 
     ORDER BY id DESC 
     LIMIT 1`,
    [`${prefix}%`]
  );

  if (result.rows.length === 0) {
    return `${prefix}0001`;
  }

  const lastOfferNum = result.rows[0].offer_number;
  const parts = lastOfferNum.split('-');
  const seqStr = parts[parts.length - 1];
  const seqNum = parseInt(seqStr, 10);
  
  if (isNaN(seqNum)) {
    return `${prefix}0001`;
  }

  const nextSeq = String(seqNum + 1).padStart(4, '0');
  return `${prefix}${nextSeq}`;
}

// 1. Get all offer letters with search and filters
const getOfferLetters = async (req, res) => {
  try {
    const { search, status, employee_id, job_role, start_date, end_date } = req.query;

    let query = `
      SELECT o.*, e.name as employee_current_name, e.status as employee_current_status
      FROM offer_letters o
      LEFT JOIN employees e ON o.employee_id = e.employee_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      params.push(`%${search.trim()}%`);
      query += ` AND (
        o.offer_number ILIKE $${params.length} OR 
        o.employee_name_snapshot ILIKE $${params.length} OR 
        o.employee_id_snapshot ILIKE $${params.length} OR
        o.job_title_snapshot ILIKE $${params.length}
      )`;
    }

    if (status && status !== 'All') {
      params.push(status);
      query += ` AND o.status = $${params.length}`;
    }

    if (employee_id) {
      params.push(employee_id);
      query += ` AND o.employee_id = $${params.length}`;
    }

    if (job_role) {
      params.push(`%${job_role}%`);
      query += ` AND o.job_title_snapshot ILIKE $${params.length}`;
    }

    if (start_date) {
      params.push(start_date);
      query += ` AND o.offer_date >= $${params.length}`;
    }

    if (end_date) {
      params.push(end_date);
      query += ` AND o.offer_date <= $${params.length}`;
    }

    query += ` ORDER BY o.id DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      offerLetters: result.rows
    });
  } catch (error) {
    console.error('Get offer letters error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching offer letters'
    });
  }
};

// 2. Get single offer letter by ID
const getOfferLetterById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT o.*, e.name as employee_current_name, e.permanent_address as employee_current_address
       FROM offer_letters o
       LEFT JOIN employees e ON o.employee_id = e.employee_id
       WHERE o.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offer letter not found'
      });
    }

    res.json({
      success: true,
      offerLetter: result.rows[0]
    });
  } catch (error) {
    console.error('Get offer letter by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching offer letter'
    });
  }
};

// 3. Create offer letter (Draft or Generated)
const createOfferLetter = async (req, res) => {
  try {
    const {
      employee_id,
      status = 'Draft',
      offer_date = new Date().toISOString().split('T')[0],
      interview_date,
      joining_date,
      acceptance_deadline_date,
      
      // Override or explicit employee snapshots
      salutation = 'Mr.',
      employee_name,
      employee_email,
      employee_phone,
      employee_address,

      // Position terms
      job_title,
      department,
      reporting_to = 'Dr. Mueen Ahmed KK, [Managing Director]',
      work_location = 'Office Premises',
      employment_type = 'Full-time',
      work_hours = '9:30 AM – 6:30 PM, Monday–Saturday',
      probation_period = "3 months, extendable at the company's discretion.",

      // Responsibilities
      responsibilities = [],

      // Compensation
      monthly_salary = 0,
      variable_percentage = 5,
      annual_paid_leaves = 12,
      pf_applicable = 'Not Applicable',
      esi_applicable = 'Not Applicable',
      gratuity_applicable = 'Not Applicable',
      other_allowances = 'Not Applicable',

      // Custom signatory overrides if any
      signatory_name,
      signatory_designation,
      signatory_email
    } = req.body;

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        message: 'Employee is required'
      });
    }

    if (!salutation || !salutation.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Title / Salutation (Mr. or Ms.) is required'
      });
    }

    if (!joining_date) {
      return res.status(400).json({
        success: false,
        message: 'Joining Date is required'
      });
    }

    // Fetch employee data from DB for default snapshot values
    const empResult = await pool.query(
      `SELECT e.*, d.name as department_name
       FROM employees e
       LEFT JOIN departments d ON e.department_id = d.id
       WHERE e.employee_id = $1`,
      [employee_id]
    );

    if (empResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Employee not found'
      });
    }

    const emp = empResult.rows[0];
    const settings = await getOfferLetterSettings();

    // Calculations
    const monthlySalaryNum = Number(monthly_salary || emp.monthly_salary || 0);
    const varPctNum = Number(variable_percentage || 0);
    const annualFixedSalary = monthlySalaryNum * 12;
    const variableAmount = (annualFixedSalary * varPctNum) / 100;
    const totalCTC = annualFixedSalary + variableAmount;

    const offerNumber = await generateNextOfferNumber();
    const isGenerated = status === 'Generated';

    const insertResult = await pool.query(`
      INSERT INTO offer_letters (
        offer_number,
        employee_id,
        status,
        offer_date,
        interview_date,
        joining_date,
        acceptance_deadline_date,
        
        salutation,
        employee_name_snapshot,
        employee_id_snapshot,
        employee_email_snapshot,
        employee_phone_snapshot,
        employee_address_snapshot,

        job_title_snapshot,
        department_snapshot,
        reporting_to,
        work_location,
        employment_type,
        work_hours,
        probation_period,

        responsibilities_snapshot,

        monthly_salary,
        annual_fixed_salary,
        variable_percentage,
        variable_amount,
        total_ctc,
        annual_paid_leaves,
        pf_applicable,
        esi_applicable,
        gratuity_applicable,
        other_allowances,

        company_name_snapshot,
        header_address_snapshot,
        header_phone_snapshot,
        header_email_snapshot,
        header_website_snapshot,
        footer_line_1_snapshot,
        footer_line_2_snapshot,
        signatory_name,
        signatory_designation,
        signatory_email,

        created_by,
        generated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18, $19, $20,
        $21,
        $22, $23, $24, $25, $26, $27, $28, $29, $30, $31,
        $32, $33, $34, $35, $36, $37, $38, $39, $40, $41,
        $42, $43
      )
      RETURNING *
    `, [
      offerNumber,
      emp.employee_id,
      status,
      offer_date,
      interview_date || offer_date,
      joining_date,
      acceptance_deadline_date || joining_date,

      salutation || 'Mr.',
      employee_name || emp.name,
      emp.employee_id,
      employee_email || emp.personal_email || emp.email,
      employee_phone || emp.mobile,
      employee_address || emp.permanent_address || '',

      job_title || emp.job_role || 'Employee',
      department || emp.department_name || 'General',
      reporting_to,
      work_location,
      employment_type,
      work_hours,
      probation_period,

      JSON.stringify(responsibilities),

      monthlySalaryNum,
      annualFixedSalary,
      varPctNum,
      variableAmount,
      totalCTC,
      parseInt(annual_paid_leaves, 10) || 12,
      pf_applicable,
      esi_applicable,
      gratuity_applicable,
      other_allowances,

      settings.company_name,
      settings.header_address,
      settings.header_phone,
      settings.header_email,
      settings.header_website,
      settings.footer_line_1,
      settings.footer_line_2,
      signatory_name || settings.signatory_name,
      signatory_designation || settings.signatory_designation,
      signatory_email || settings.signatory_email,

      req.admin?.id || null,
      isGenerated ? new Date() : null
    ]);

    res.status(201).json({
      success: true,
      message: isGenerated ? 'Offer letter generated successfully' : 'Offer letter draft saved',
      offerLetter: insertResult.rows[0]
    });
  } catch (error) {
    console.error('Create offer letter error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating offer letter'
    });
  }
};

// 4. Update offer letter
const updateOfferLetter = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      status,
      offer_date,
      interview_date,
      joining_date,
      acceptance_deadline_date,
      
      salutation,
      employee_name,
      employee_email,
      employee_phone,
      employee_address,

      job_title,
      department,
      reporting_to,
      work_location,
      employment_type,
      work_hours,
      probation_period,

      responsibilities,

      monthly_salary,
      variable_percentage,
      annual_paid_leaves,
      pf_applicable,
      esi_applicable,
      gratuity_applicable,
      other_allowances,

      signatory_name,
      signatory_designation,
      signatory_email
    } = req.body;

    const existingRes = await pool.query('SELECT * FROM offer_letters WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offer letter not found'
      });
    }

    const existing = existingRes.rows[0];
    const monthlySalaryNum = monthly_salary !== undefined ? Number(monthly_salary) : Number(existing.monthly_salary);
    const varPctNum = variable_percentage !== undefined ? Number(variable_percentage) : Number(existing.variable_percentage);
    const annualFixedSalary = monthlySalaryNum * 12;
    const variableAmount = (annualFixedSalary * varPctNum) / 100;
    const totalCTC = annualFixedSalary + variableAmount;

    const newStatus = status || existing.status;
    const isGenerated = newStatus === 'Generated';
    const generatedAt = isGenerated ? (existing.generated_at || new Date()) : null;

    const updateResult = await pool.query(`
      UPDATE offer_letters
      SET
        status = $1,
        offer_date = COALESCE($2, offer_date),
        interview_date = COALESCE($3, interview_date),
        joining_date = COALESCE($4, joining_date),
        acceptance_deadline_date = COALESCE($5, acceptance_deadline_date),

        salutation = COALESCE($6, salutation),
        employee_name_snapshot = COALESCE($7, employee_name_snapshot),
        employee_email_snapshot = COALESCE($8, employee_email_snapshot),
        employee_phone_snapshot = COALESCE($9, employee_phone_snapshot),
        employee_address_snapshot = COALESCE($10, employee_address_snapshot),

        job_title_snapshot = COALESCE($11, job_title_snapshot),
        department_snapshot = COALESCE($12, department_snapshot),
        reporting_to = COALESCE($13, reporting_to),
        work_location = COALESCE($14, work_location),
        employment_type = COALESCE($15, employment_type),
        work_hours = COALESCE($16, work_hours),
        probation_period = COALESCE($17, probation_period),

        responsibilities_snapshot = COALESCE($18, responsibilities_snapshot),

        monthly_salary = $19,
        annual_fixed_salary = $20,
        variable_percentage = $21,
        variable_amount = $22,
        total_ctc = $23,
        annual_paid_leaves = COALESCE($24, annual_paid_leaves),
        pf_applicable = COALESCE($25, pf_applicable),
        esi_applicable = COALESCE($26, esi_applicable),
        gratuity_applicable = COALESCE($27, gratuity_applicable),
        other_allowances = COALESCE($28, other_allowances),

        signatory_name = COALESCE($29, signatory_name),
        signatory_designation = COALESCE($30, signatory_designation),
        signatory_email = COALESCE($31, signatory_email),

        generated_at = $32,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $33
      RETURNING *
    `, [
      newStatus,
      offer_date || null,
      interview_date || null,
      joining_date || null,
      acceptance_deadline_date || null,

      salutation || null,
      employee_name || null,
      employee_email || null,
      employee_phone || null,
      employee_address || null,

      job_title || null,
      department || null,
      reporting_to || null,
      work_location || null,
      employment_type || null,
      work_hours || null,
      probation_period || null,

      responsibilities ? JSON.stringify(responsibilities) : null,

      monthlySalaryNum,
      annualFixedSalary,
      varPctNum,
      variableAmount,
      totalCTC,
      annual_paid_leaves !== undefined ? parseInt(annual_paid_leaves, 10) : null,
      pf_applicable || null,
      esi_applicable || null,
      gratuity_applicable || null,
      other_allowances || null,

      signatory_name || null,
      signatory_designation || null,
      signatory_email || null,

      generatedAt,
      id
    ]);

    res.json({
      success: true,
      message: 'Offer letter updated successfully',
      offerLetter: updateResult.rows[0]
    });
  } catch (error) {
    console.error('Update offer letter error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating offer letter'
    });
  }
};

// 5. Generate / Finalize Offer Letter
const generateOfferLetter = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE offer_letters
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
        message: 'Offer letter not found'
      });
    }

    res.json({
      success: true,
      message: 'Offer letter marked as Generated',
      offerLetter: result.rows[0]
    });
  } catch (error) {
    console.error('Generate offer letter error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while generating offer letter'
    });
  }
};

// 6. Delete offer letter
const deleteOfferLetter = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM offer_letters WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offer letter not found'
      });
    }

    res.json({
      success: true,
      message: 'Offer letter deleted successfully'
    });
  } catch (error) {
    console.error('Delete offer letter error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting offer letter'
    });
  }
};

// 7. Download PDF
const downloadOfferLetterPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM offer_letters WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offer letter not found'
      });
    }

    const offer = result.rows[0];
    const settings = await getOfferLetterSettings();
    const includeSignature = req.query.signature !== 'false' && req.query.signature !== false;
    const doc = await generateOfferLetterPDF(offer, { settings, includeSignature });

    const safeName = (offer.employee_name_snapshot || 'Candidate').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeOfferNum = (offer.offer_number || 'OFF').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Offer_Letter_${safeName}_${safeOfferNum}${includeSignature ? '_signed' : ''}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Download offer letter PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to generate offer letter PDF'
      });
    }
  }
};

// 8. Preview PDF (Inline stream or dynamic payload)
const previewOfferLetterPDF = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM offer_letters WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Offer letter not found'
      });
    }

    const offer = result.rows[0];
    const settings = await getOfferLetterSettings();
    const includeSignature = req.query.signature !== 'false' && req.query.signature !== false;
    const doc = await generateOfferLetterPDF(offer, { settings, includeSignature });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');

    doc.pipe(res);
    doc.end();
  } catch (error) {
    console.error('Preview offer letter PDF error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Failed to preview offer letter PDF'
      });
    }
  }
};

// 9. Dedicated Offer Letter Settings
const getOfferLetterSettingsHandler = async (req, res) => {
  try {
    const settings = await getOfferLetterSettings(true);
    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Get offer letter settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching settings'
    });
  }
};

const updateOfferLetterSettingsHandler = async (req, res) => {
  try {
    const updated = await updateOfferLetterSettings(req.body);
    res.json({
      success: true,
      message: 'Offer letter settings updated successfully',
      settings: updated
    });
  } catch (error) {
    console.error('Update offer letter settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating settings'
    });
  }
};

const resetOfferLetterLogoHandler = async (req, res) => {
  try {
    const updated = await resetOfferLetterLogo();
    res.json({
      success: true,
      message: 'Offer letter logo reset to default',
      settings: updated
    });
  } catch (error) {
    console.error('Reset offer letter logo error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resetting logo'
    });
  }
};

// 10. Role Responsibility Templates CRUD
const getRoleTemplates = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM role_responsibility_templates ORDER BY job_role ASC');
    res.json({
      success: true,
      templates: result.rows
    });
  } catch (error) {
    console.error('Get role templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching role templates'
    });
  }
};

const saveRoleTemplate = async (req, res) => {
  try {
    const { job_role, categories = [], experience_work_summary = '' } = req.body;

    if (!job_role || !job_role.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Job role name is required'
      });
    }

    const trimmedRole = job_role.trim();

    const result = await pool.query(`
      INSERT INTO role_responsibility_templates (job_role, categories, experience_work_summary, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (job_role) DO UPDATE
      SET categories = $2, 
          experience_work_summary = COALESCE($3, role_responsibility_templates.experience_work_summary),
          updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `, [trimmedRole, JSON.stringify(categories), experience_work_summary]);

    res.json({
      success: true,
      message: 'Role template saved successfully',
      template: result.rows[0]
    });
  } catch (error) {
    console.error('Save role template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while saving role template'
    });
  }
};

const deleteRoleTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM role_responsibility_templates WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    res.json({
      success: true,
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Delete role template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting template'
    });
  }
};

module.exports = {
  getOfferLetters,
  getOfferLetterById,
  createOfferLetter,
  updateOfferLetter,
  generateOfferLetter,
  deleteOfferLetter,
  downloadOfferLetterPDF,
  previewOfferLetterPDF,
  getOfferLetterSettingsHandler,
  updateOfferLetterSettingsHandler,
  resetOfferLetterLogoHandler,
  getRoleTemplates,
  saveRoleTemplate,
  deleteRoleTemplate
};
