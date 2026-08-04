const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const getCompanyLogoPath = () => {
  const possiblePaths = [
    path.join(__dirname, '../../frontend/public/favicon/web-app-manifest-192x192.png'),
    path.join(__dirname, '../../frontend/public/favicon/favicon-96x96.png'),
    path.join(__dirname, '../public/favicon/web-app-manifest-192x192.png'),
    path.resolve(process.cwd(), 'frontend/public/favicon/web-app-manifest-192x192.png'),
    path.resolve(process.cwd(), 'frontend/public/favicon/favicon-96x96.png')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  return null;
};

const getSignaturePath = () => {
  const possiblePaths = [
    path.resolve(process.cwd(), "assets", "payslip", "company-seal-signature.png"),
    path.resolve(process.cwd(), "backend", "assets", "payslip", "company-seal-signature.png"),
    path.join(__dirname, "../assets/payslip/company-seal-signature.png"),
    path.join(__dirname, "../../backend/assets/payslip/company-seal-signature.png")
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }
  console.warn("Signature image not found at backend/assets/payslip/company-seal-signature.png");
  return null;
};

function resolvePayslipFont(fileName) {
  const possiblePaths = [
    path.join(__dirname, '../assets/fonts', fileName),
    path.join(__dirname, '../../backend/assets/fonts', fileName),
    path.join(__dirname, '../../assets/fonts', fileName),
    path.resolve(process.cwd(), 'assets/fonts', fileName),
    path.resolve(process.cwd(), 'backend/assets/fonts', fileName)
  ];

  return possiblePaths.find((p) => fs.existsSync(p));
}

function registerPayslipFonts(doc) {
  const regularFontPath = resolvePayslipFont('NotoSans-Regular.ttf') || resolvePayslipFont('Arial-Regular.ttf');
  const boldFontPath = resolvePayslipFont('NotoSans-Bold.ttf') || resolvePayslipFont('Arial-Bold.ttf');
  const italicFontPath = resolvePayslipFont('NotoSans-Italic.ttf') || resolvePayslipFont('Arial-Italic.ttf');

  if (!regularFontPath || !boldFontPath) {
    throw new Error('Payslip Unicode font missing. Add NotoSans-Regular.ttf and NotoSans-Bold.ttf to backend/assets/fonts.');
  }

  doc.registerFont('PayslipRegular', regularFontPath);
  doc.registerFont('PayslipBold', boldFontPath);
  if (italicFontPath) {
    doc.registerFont('PayslipItalic', italicFontPath);
  }

  return {
    fontRegular: 'PayslipRegular',
    fontBold: 'PayslipBold',
    fontItalic: italicFontPath ? 'PayslipItalic' : 'PayslipRegular'
  };
}

function formatDayValue(value) {
  const num = Number(value || 0);
  if (Number.isInteger(num)) {
    return String(num);
  }
  return String(parseFloat(num.toFixed(2)));
}

function formatINR(value) {
  const num = Number(value || 0);
  const rounded = Math.round(num);

  return `\u20B9${rounded.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })}`;
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
  fontSize = 9,
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
  const rowHeight = Math.max(16, textHeight + 4);

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

  return lineY + 5;
}

function renderPayslipHeader(doc, data, monthName, year, logoPath, fonts) {
  const { fontRegular, fontBold } = fonts;

  if (logoPath) {
    try {
      doc.image(logoPath, 145, 44, { width: 32, height: 32 });
      doc.fontSize(17).font(fontBold).fillColor('#0F172A').text('Manuscript Technomedia LLP', 185, 50);
    } catch (logoErr) {
      console.warn('Could not embed logo in payslip PDF:', logoErr.message);
      doc.fontSize(17).font(fontBold).fillColor('#0F172A').text('Manuscript Technomedia LLP', 40, 50, { align: 'center' });
    }
  } else {
    doc.fontSize(17).font(fontBold).fillColor('#0F172A').text('Manuscript Technomedia LLP', 40, 50, { align: 'center' });
  }

  doc.fontSize(14).font(fontBold).fillColor('#0F172A').text('PAY SLIP', 40, 82, { align: 'center' });
  doc.fontSize(10).font(fontRegular).fillColor('#475569').text(`For the month of ${monthName} ${year}`, 40, 102, { align: 'center' });

  doc.moveTo(50, 122).lineTo(545, 122).strokeColor('#CBD5E1').lineWidth(1).stroke();
}

function renderEmployeeAndAttendanceDetails(doc, r, fonts, startY = 135) {
  const { fontBold } = fonts;

  let absentDays = parseFloat(r.absent_days) || 0;
  if (absentDays === 0 && r.paid_days) {
    absentDays = Math.max(0, parseFloat(r.total_days || 0) - parseFloat(r.paid_days || 0));
  }

  // --- EMPLOYEE DETAILS (Left Column: X 50 to 280) ---
  doc.fontSize(10).font(fontBold).fillColor('#0F172A').text('EMPLOYEE DETAILS', 50, startY);
  doc.moveTo(50, startY + 15).lineTo(280, startY + 15).strokeColor('#CBD5E1').lineWidth(1).stroke();

  // --- ATTENDANCE DETAILS (Right Column: X 315 to 545) ---
  doc.fontSize(10).font(fontBold).fillColor('#0F172A').text('ATTENDANCE DETAILS', 315, startY);
  doc.moveTo(315, startY + 15).lineTo(545, startY + 15).strokeColor('#CBD5E1').lineWidth(1).stroke();

  let leftY = startY + 23;
  const empRows = [
    { label: 'Employee Code', value: r.emp_code_real || r.employee_code || r.employee_id },
    { label: 'Name', value: r.employee_name || r.name },
    { label: 'Designation', value: r.job_role },
    { label: 'Department', value: r.department_name }
  ];

  empRows.forEach(row => {
    leftY = drawDetailRow(doc, {
      label: row.label,
      value: row.value,
      labelX: 50,
      valueX: 140,
      y: leftY,
      labelWidth: 85,
      valueWidth: 140,
      rowWidth: 230,
      fontSize: 9,
      boldValue: true,
      fonts
    });
  });

  let rightY = startY + 23;
  const attRows = [
    { label: 'Working Days', value: formatDayValue(r.working_days) },
    { label: 'Paid Days', value: formatDayValue(r.paid_days) },
    { label: 'Present Days', value: formatDayValue(r.present_days) },
    { label: 'Absent Days', value: formatDayValue(absentDays) }
  ];

  attRows.forEach(row => {
    rightY = drawDetailRow(doc, {
      label: row.label,
      value: row.value,
      labelX: 315,
      valueX: 430,
      y: rightY,
      labelWidth: 110,
      valueWidth: 115,
      rowWidth: 230,
      fontSize: 9,
      boldValue: true,
      fonts
    });
  });

  const sectionEndY = Math.max(leftY, rightY);
  doc.moveTo(50, sectionEndY + 2).lineTo(545, sectionEndY + 2).strokeColor('#CBD5E1').lineWidth(1).stroke();

  return sectionEndY + 12;
}

function renderEarningsAndDeductions(doc, r, fonts, startY) {
  const { fontBold } = fonts;

  const basic = parseFloat(r.basic_salary) || 0;
  const hra = parseFloat(r.hra) || 0;
  const special = parseFloat(r.special_allowance) || 0;
  const gross = basic + hra + special;

  const lop = parseFloat(r.lop_amount) || 0;
  const pt = parseFloat(r.professional_tax) || 0;
  const tds = parseFloat(r.tds) || 0;
  const advance = parseFloat(r.staff_advance) || 0;
  const totalDeductions = lop + pt + tds + advance;

  // --- EARNINGS (Left Column: X 50 to 280) ---
  doc.fontSize(10).font(fontBold).fillColor('#0F172A').text('EARNINGS', 50, startY);
  doc.moveTo(50, startY + 15).lineTo(280, startY + 15).strokeColor('#CBD5E1').lineWidth(1).stroke();

  // --- DEDUCTIONS (Right Column: X 315 to 545) ---
  doc.fontSize(10).font(fontBold).fillColor('#0F172A').text('DEDUCTIONS', 315, startY);
  doc.moveTo(315, startY + 15).lineTo(545, startY + 15).strokeColor('#CBD5E1').lineWidth(1).stroke();

  let leftY = startY + 23;
  const earningsRows = [
    { label: 'Basic Salary', value: formatINR(basic) },
    { label: 'HRA', value: formatINR(hra) },
    { label: 'Special Allowance', value: formatINR(special) }
  ];

  earningsRows.forEach(row => {
    leftY = drawDetailRow(doc, {
      label: row.label,
      value: row.value,
      labelX: 50,
      valueX: 140,
      y: leftY,
      labelWidth: 85,
      valueWidth: 140,
      rowWidth: 230,
      fontSize: 9,
      boldValue: true,
      fonts
    });
  });

  leftY = drawDetailRow(doc, {
    label: 'Gross Earnings',
    value: formatINR(gross),
    labelX: 50,
    valueX: 140,
    y: leftY,
    labelWidth: 85,
    valueWidth: 140,
    rowWidth: 230,
    fontSize: 9.5,
    boldValue: true,
    fonts
  });

  let rightY = startY + 23;
  const deductionRows = [
    { label: 'Loss of Pay / LOP', value: formatINR(lop) },
    { label: 'Professional Tax', value: formatINR(pt) },
    { label: 'TDS', value: formatINR(tds) },
    { label: 'Staff Advance', value: formatINR(advance) }
  ];

  deductionRows.forEach(row => {
    rightY = drawDetailRow(doc, {
      label: row.label,
      value: row.value,
      labelX: 315,
      valueX: 430,
      y: rightY,
      labelWidth: 110,
      valueWidth: 115,
      rowWidth: 230,
      fontSize: 9,
      boldValue: true,
      fonts
    });
  });

  rightY = drawDetailRow(doc, {
    label: 'Total Deductions',
    value: formatINR(totalDeductions),
    labelX: 315,
    valueX: 430,
    y: rightY,
    labelWidth: 110,
    valueWidth: 115,
    rowWidth: 230,
    fontSize: 9.5,
    boldValue: true,
    fonts
  });

  const sectionEndY = Math.max(leftY, rightY);
  doc.moveTo(50, sectionEndY + 2).lineTo(545, sectionEndY + 2).strokeColor('#CBD5E1').lineWidth(1).stroke();

  return { gross, totalDeductions, nextY: sectionEndY + 15 };
}

function renderNetPayable(doc, r, gross, totalDeductions, fonts, startY) {
  const { fontBold } = fonts;
  const netPayable = parseFloat(r.net_payable) || (gross - totalDeductions);

  doc.rect(50, startY, 495, 48).fillAndStroke('#EFF6FF', '#93C5FD');
  doc.fontSize(11).font(fontBold).fillColor('#1E40AF').text('NET PAYABLE', 70, startY + 16);
  doc.fontSize(17).font(fontBold).fillColor('#1E3A8A').text(formatINR(netPayable), 340, startY + 13, { align: 'right', width: 190 });

  return startY + 60;
}

function renderPayslipNoteOrSignature(doc, fonts, generatedDateStr, startY, options = {}) {
  const { fontRegular, fontBold, fontItalic } = fonts;
  const includeSignature = options.includeSignature === true;
  const signaturePath = getSignaturePath();

  doc.moveTo(50, startY).lineTo(545, startY).strokeColor('#CBD5E1').lineWidth(1).stroke();

  if (includeSignature) {
    // SIGNED PDF FOOTER:
    // 1. Remove old note
    // 2. HD Signature/seal image at bottom-right (width: 120, imageX = 410, signatureY = startY + 10)
    // 3. Signatory text block centered under image (textBlockX = 395, width = 150, textY = signatureY + 98)
    // 4. Generated date at bottom-left

    const signatureWidth = 120;
    // Rendered height ratio for HD PNG (2280x1752): 1752/2280 = 0.7684 -> 120 * 0.7684 ≈ 92px
    const renderedImageHeight = (signaturePath && fs.existsSync(signaturePath)) ? 92 : 0;

    const signatureBlockWidth = 150;
    const imageX = 410;
    const textBlockX = 385;
    const signatureY = startY + 10;

    if (renderedImageHeight > 0) {
      try {
        doc.image(signaturePath, imageX, signatureY, { width: signatureWidth });
      } catch (imgErr) {
        console.warn('Could not embed signature PNG:', imgErr.message);
      }
    } else {
      console.warn("Signature image not found at backend/assets/payslip/company-seal-signature.png");
    }

    const textY = signatureY + (renderedImageHeight > 0 ? renderedImageHeight + 6 : 10);

    doc.fontSize(8.5).font(fontBold).fillColor('#111827').text('Authorized Signatory', textBlockX, textY, {
      width: signatureBlockWidth,
      align: 'center'
    });

    doc.fontSize(8.5).font(fontRegular).fillColor('#334155').text('Manuscript Technomedia LLP', textBlockX, textY + 13, {
      width: signatureBlockWidth,
      align: 'center'
    });

    // Generated date at bottom-left
    const dateY = signatureY + 98;
    doc.fontSize(8).font(fontBold).fillColor('#475569').text(`Generated on: ${generatedDateStr}`, 50, dateY, {
      width: 220,
      align: 'left'
    });

    return textY + 28;
  } else {
    // UNSIGNED PDF:
    // Keep old template note exactly as before
    doc.fontSize(8.5).font(fontItalic).fillColor('#64748B').text('Note: This is a computer-generated pay slip and does not require a signature.', 40, startY + 10, { align: 'center' });
    doc.fontSize(8).font(fontBold).fillColor('#94A3B8').text(`Generated on: ${generatedDateStr}`, 40, startY + 25, { align: 'center' });

    return startY + 45;
  }
}

function renderPayslipPage(doc, record, monthName, year, generatedDateStr, logoPath, fonts, options = {}) {
  renderPayslipHeader(doc, record, monthName, year, logoPath, fonts);
  const detailsEndY = renderEmployeeAndAttendanceDetails(doc, record, fonts, 135);
  const { gross, totalDeductions, nextY: earningsEndY } = renderEarningsAndDeductions(doc, record, fonts, detailsEndY);
  const netPayableEndY = renderNetPayable(doc, record, gross, totalDeductions, fonts, earningsEndY);
  const finalEndY = renderPayslipNoteOrSignature(doc, fonts, generatedDateStr, netPayableEndY, options);

  const bottomPadding = options.includeSignature ? 15 : 10;
  const cardHeight = Math.max(500, finalEndY - 35 + bottomPadding);
  doc.rect(40, 35, 515, cardHeight).strokeColor('#CBD5E1').lineWidth(1).stroke();
}

const generateSinglePayslipBuffer = async (record, month, year, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const monthName = monthNames[parseInt(month) - 1] || month;
      const logoPath = getCompanyLogoPath();
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const fonts = registerPayslipFonts(doc);

      const buffers = [];
      doc.on('data', b => buffers.push(b));
      doc.on('end', () => {
        resolve(Buffer.concat(buffers));
      });
      doc.on('error', reject);

      const generatedDateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      renderPayslipPage(doc, record, monthName, year, generatedDateStr, logoPath, fonts, options);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};

module.exports = {
  getCompanyLogoPath,
  getSignaturePath,
  resolvePayslipFont,
  registerPayslipFonts,
  renderPayslipHeader,
  renderEmployeeAndAttendanceDetails,
  renderEarningsAndDeductions,
  renderNetPayable,
  renderPayslipNoteOrSignature,
  renderPayslipPage,
  generateSinglePayslipBuffer
};
