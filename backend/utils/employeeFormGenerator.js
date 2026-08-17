const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const {
  getCompanyLogoPath,
  registerPayslipFonts
} = require('./payslipGenerator');
const { getBrandingSettings } = require('./brandingSettingsHelper');

function formatINR(value) {
  const num = Number(value || 0);
  const rounded = Math.round(num);

  return `\u20B9${rounded.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function drawDetailRow(doc, {
  label,
  value,
  labelX,
  valueX,
  y,
  labelWidth,
  valueWidth,
  rowWidth,
  fontSize = 8.5,
  boldValue = true,
  fonts
}) {
  const safeValue = (value !== undefined && value !== null && String(value).trim() !== '') ? String(value) : '-';
  const { fontRegular, fontBold } = fonts;

  doc.font(fontRegular).fontSize(fontSize);
  const labelHeight = doc.heightOfString(label, { width: labelWidth });

  doc.font(boldValue ? fontBold : fontRegular).fontSize(fontSize);
  const valueHeight = doc.heightOfString(safeValue, { width: valueWidth, align: 'right' });

  const textHeight = Math.max(labelHeight, valueHeight);
  const rowHeight = Math.max(15, textHeight + 3);

  doc.font(fontRegular).fontSize(fontSize).fillColor('#475569').text(label, labelX, y, {
    width: labelWidth,
    align: 'left'
  });

  doc.font(boldValue ? fontBold : fontRegular).fontSize(fontSize).fillColor('#0F172A').text(safeValue, valueX, y, {
    width: valueWidth,
    align: 'right'
  });

  const lineY = y + rowHeight - 1;
  doc.moveTo(labelX, lineY).lineTo(labelX + rowWidth, lineY).strokeColor('#F1F5F9').lineWidth(0.5).stroke();

  return lineY + 4;
}

function renderEmployeeFormHeader(doc, employee, logoPath, fonts, branding = null) {
  const { fontBold } = fonts;
  const companyName = branding?.company_name || 'Manuscript Technomedia LLP';
  const logoWidth = branding?.logo_width || 32;
  const logoHeight = branding?.logo_height || 32;
  const fontSize = branding?.company_name_font_size || 17;
  const actualLogoPath = branding?.physical_logo_path || logoPath || getCompanyLogoPath();

  if (actualLogoPath && fs.existsSync(actualLogoPath)) {
    try {
      doc.image(actualLogoPath, 145, 44, { width: logoWidth, height: logoHeight });
      doc.fontSize(fontSize).font(fontBold).fillColor('#0F172A').text(companyName, 150 + logoWidth + 8, 48);
    } catch (logoErr) {
      console.warn('Could not embed logo in employee form PDF:', logoErr.message);
      doc.fontSize(fontSize).font(fontBold).fillColor('#0F172A').text(companyName, 40, 50, { align: 'center' });
    }
  } else {
    doc.fontSize(fontSize).font(fontBold).fillColor('#0F172A').text(companyName, 40, 50, { align: 'center' });
  }

  doc.fontSize(13).font(fontBold).fillColor('#0F172A').text('EMPLOYEE DETAILS FORM', 40, 82, { align: 'center' });

  doc.moveTo(50, 108).lineTo(545, 108).strokeColor('#CBD5E1').lineWidth(1).stroke();
}

function renderEmploymentAndPersonalDetails(doc, emp, fonts, startY = 118) {
  const { fontBold } = fonts;

  // --- EMPLOYMENT DETAILS (Left Column: X 50 to 280) ---
  doc.fontSize(9.5).font(fontBold).fillColor('#0F172A').text('EMPLOYMENT DETAILS', 50, startY);
  doc.moveTo(50, startY + 13).lineTo(280, startY + 13).strokeColor('#CBD5E1').lineWidth(1).stroke();

  // --- PERSONAL & CONTACT DETAILS (Right Column: X 315 to 545) ---
  doc.fontSize(9.5).font(fontBold).fillColor('#0F172A').text('PERSONAL & CONTACT DETAILS', 315, startY);
  doc.moveTo(315, startY + 13).lineTo(545, startY + 13).strokeColor('#CBD5E1').lineWidth(1).stroke();

  let leftY = startY + 20;
  const empRows = [
    { label: 'Employee ID', value: emp.employee_id || emp.emp_code_real },
    { label: 'Full Name', value: emp.name || emp.employee_name },
    { label: 'Job Role', value: emp.job_role },
    { label: 'Department', value: emp.department_name || emp.department },
    { label: 'Joining Date', value: formatDate(emp.joining_date) }
  ];

  if (emp.resigned_date) {
    empRows.push({ label: 'Resigned Date', value: formatDate(emp.resigned_date) });
  }

  empRows.forEach(row => {
    leftY = drawDetailRow(doc, {
      label: row.label,
      value: row.value,
      labelX: 50,
      valueX: 135,
      y: leftY,
      labelWidth: 85,
      valueWidth: 145,
      rowWidth: 230,
      fontSize: 8.5,
      boldValue: true,
      fonts
    });
  });

  let rightY = startY + 20;
  const personalRows = [
    { label: 'Date of Birth', value: formatDate(emp.date_of_birth) },
    { label: 'Mobile Number', value: emp.mobile },
    { label: 'Alternate Phone', value: emp.alternate_phone_number || '-' },
    { label: 'Email Address', value: emp.email },
    { label: 'Permanent Address', value: emp.permanent_address || '-' }
  ];

  personalRows.forEach(row => {
    rightY = drawDetailRow(doc, {
      label: row.label,
      value: row.value,
      labelX: 315,
      valueX: 415,
      y: rightY,
      labelWidth: 100,
      valueWidth: 130,
      rowWidth: 230,
      fontSize: 8.5,
      boldValue: true,
      fonts
    });
  });

  const sectionEndY = Math.max(leftY, rightY);
  doc.moveTo(50, sectionEndY + 2).lineTo(545, sectionEndY + 2).strokeColor('#CBD5E1').lineWidth(1).stroke();

  return sectionEndY + 10;
}

function renderBankAndIdentityDetails(doc, emp, fonts, startY) {
  const { fontBold } = fonts;

  // --- BANK ACCOUNT DETAILS (Left Column: X 50 to 280) ---
  doc.fontSize(9.5).font(fontBold).fillColor('#0F172A').text('BANK ACCOUNT DETAILS', 50, startY);
  doc.moveTo(50, startY + 13).lineTo(280, startY + 13).strokeColor('#CBD5E1').lineWidth(1).stroke();

  // --- IDENTITY & STATUTORY DETAILS (Right Column: X 315 to 545) ---
  doc.fontSize(9.5).font(fontBold).fillColor('#0F172A').text('IDENTITY DETAILS', 315, startY);
  doc.moveTo(315, startY + 13).lineTo(545, startY + 13).strokeColor('#CBD5E1').lineWidth(1).stroke();

  let leftY = startY + 20;
  const bankRows = [
    { label: 'Bank Name', value: emp.bank_name },
    { label: 'Account Holder', value: emp.account_holder_name },
    { label: 'Account Number', value: emp.account_number },
    { label: 'IFSC Code', value: emp.ifsc_code },
    { label: 'Bank Address', value: emp.bank_address }
  ];

  bankRows.forEach(row => {
    leftY = drawDetailRow(doc, {
      label: row.label,
      value: row.value,
      labelX: 50,
      valueX: 135,
      y: leftY,
      labelWidth: 85,
      valueWidth: 145,
      rowWidth: 230,
      fontSize: 8.5,
      boldValue: true,
      fonts
    });
  });

  let rightY = startY + 20;
  const idRows = [
    { label: 'PAN Card Number', value: emp.pan_card_number },
    { label: 'Aadhaar Number', value: emp.aadhar_card_number }
  ];

  idRows.forEach(row => {
    rightY = drawDetailRow(doc, {
      label: row.label,
      value: row.value,
      labelX: 315,
      valueX: 415,
      y: rightY,
      labelWidth: 100,
      valueWidth: 130,
      rowWidth: 230,
      fontSize: 8.5,
      boldValue: true,
      fonts
    });
  });

  const sectionEndY = Math.max(leftY, rightY);
  doc.moveTo(50, sectionEndY + 2).lineTo(545, sectionEndY + 2).strokeColor('#CBD5E1').lineWidth(1).stroke();

  return sectionEndY + 10;
}

function renderSalaryStructure(doc, emp, fonts, startY) {
  const { fontBold } = fonts;

  const monthlySalary = parseFloat(emp.monthly_salary || emp.base_salary || 0);
  const basic = parseFloat(emp.basic_salary || 0);
  const hra = parseFloat(emp.hra || 0);
  const special = parseFloat(emp.special_allowance || 0);
  const pt = parseFloat(emp.professional_tax || 0);
  const tds = parseFloat(emp.tds || 0);
  const staffAdvance = parseFloat(emp.staff_advance || 0);

  // --- SALARY & ALLOWANCES (Left Column: X 50 to 280) ---
  doc.fontSize(9.5).font(fontBold).fillColor('#0F172A').text('SALARY & ALLOWANCES', 50, startY);
  doc.moveTo(50, startY + 13).lineTo(280, startY + 13).strokeColor('#CBD5E1').lineWidth(1).stroke();

  // --- STATUTORY & DEDUCTIONS (Right Column: X 315 to 545) ---
  doc.fontSize(9.5).font(fontBold).fillColor('#0F172A').text('STATUTORY & DEDUCTIONS', 315, startY);
  doc.moveTo(315, startY + 13).lineTo(545, startY + 13).strokeColor('#CBD5E1').lineWidth(1).stroke();

  let leftY = startY + 20;
  const salaryRows = [
    { label: 'Basic Salary', value: formatINR(basic) },
    { label: 'HRA', value: formatINR(hra) },
    { label: 'Special Allowance', value: formatINR(special) },
    { label: 'Monthly Gross', value: formatINR(monthlySalary) }
  ];

  salaryRows.forEach(row => {
    leftY = drawDetailRow(doc, {
      label: row.label,
      value: row.value,
      labelX: 50,
      valueX: 135,
      y: leftY,
      labelWidth: 85,
      valueWidth: 145,
      rowWidth: 230,
      fontSize: 8.5,
      boldValue: true,
      fonts
    });
  });

  let rightY = startY + 20;
  const deductionRows = [
    { label: 'Professional Tax', value: formatINR(pt) },
    { label: 'TDS', value: formatINR(tds) },
    { label: 'Staff Advance', value: formatINR(staffAdvance) }
  ];

  deductionRows.forEach(row => {
    rightY = drawDetailRow(doc, {
      label: row.label,
      value: row.value,
      labelX: 315,
      valueX: 415,
      y: rightY,
      labelWidth: 100,
      valueWidth: 130,
      rowWidth: 230,
      fontSize: 8.5,
      boldValue: true,
      fonts
    });
  });

  const sectionEndY = Math.max(leftY, rightY);
  doc.moveTo(50, sectionEndY + 2).lineTo(545, sectionEndY + 2).strokeColor('#CBD5E1').lineWidth(1).stroke();

  return sectionEndY + 10;
}

function renderFormFooterNotes(doc, fonts, generatedDateStr, startY) {
  const { fontBold, fontItalic } = fonts;

  doc.fontSize(8.5).font(fontItalic).fillColor('#64748B').text(
    'Note: This is a computer-generated employee details form and does not require a signature.',
    40,
    startY + 8,
    { align: 'center' }
  );

  doc.fontSize(8).font(fontBold).fillColor('#94A3B8').text(
    `Generated on: ${generatedDateStr}`,
    40,
    startY + 23,
    { align: 'center' }
  );

  return startY + 40;
}

function renderRegisteredOfficeFooter(doc, fonts, cardBottomY, branding = null) {
  const { fontRegular } = fonts;
  const footerLineY = Math.max(775, cardBottomY + 25);

  // Thin black horizontal line
  doc.moveTo(40, footerLineY)
     .lineTo(555, footerLineY)
     .strokeColor('#000000')
     .lineWidth(0.75)
     .stroke();

  // Black centered registered office text
  const textY = footerLineY + 8;
  const footerText = branding?.registered_office_address || 'Manuscript Technomedia LLP, Reg. Office. No. 22, 3rd Cross, Vivekananda Nagar, Bangalore-33, Karnataka, India.';

  doc.fontSize(8.5)
     .font(fontRegular)
     .fillColor('#000000')
     .text(footerText, 40, textY, {
       width: 515,
       align: 'center'
     });

  return textY + 16;
}

function renderEmployeeFormPage(doc, employee, generatedDateStr, logoPath, fonts, options = {}) {
  const branding = options.branding || null;
  renderEmployeeFormHeader(doc, employee, logoPath, fonts, branding);
  const personalEndY = renderEmploymentAndPersonalDetails(doc, employee, fonts, 118);
  const bankEndY = renderBankAndIdentityDetails(doc, employee, fonts, personalEndY);
  const salaryEndY = renderSalaryStructure(doc, employee, fonts, bankEndY);
  const contentEndY = renderFormFooterNotes(doc, fonts, generatedDateStr, salaryEndY);

  // Main content card border
  const cardHeight = Math.max(560, contentEndY - 35 + 10);
  doc.rect(40, 35, 515, cardHeight).strokeColor('#CBD5E1').lineWidth(1).stroke();

  const cardBottomY = 35 + cardHeight;
  renderRegisteredOfficeFooter(doc, fonts, cardBottomY, branding);
}

const generateEmployeeFormBuffer = async (employee, options = {}) => {
  const branding = options.branding || await getBrandingSettings();
  const mergedOptions = { ...options, branding };

  return new Promise((resolve, reject) => {
    try {
      const logoPath = branding.physical_logo_path || getCompanyLogoPath();
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const fonts = registerPayslipFonts(doc);

      const buffers = [];
      doc.on('data', b => buffers.push(b));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      const generatedDateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      renderEmployeeFormPage(doc, employee, generatedDateStr, logoPath, fonts, mergedOptions);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  renderEmployeeFormPage,
  generateEmployeeFormBuffer
};
