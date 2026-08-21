const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const { getOfferLetterSettings, resolveOfferLetterLogoPath } = require('./offerLetterSettingsHelper');
const { getCompanyLogoPath } = require('./payslipGenerator');

// Cache font paths
const fontPathCache = {};
function resolveFont(fileName) {
  if (fontPathCache[fileName] !== undefined) return fontPathCache[fileName];
  const possiblePaths = [
    path.join(__dirname, '../assets/fonts', fileName),
    path.join(__dirname, '../../backend/assets/fonts', fileName),
    path.join(__dirname, '../../assets/fonts', fileName),
    path.resolve(process.cwd(), 'assets/fonts', fileName),
    path.resolve(process.cwd(), 'backend/assets/fonts', fileName),
    path.join('C:/Windows/Fonts', fileName)
  ];

  const found = possiblePaths.find((p) => fs.existsSync(p)) || null;
  fontPathCache[fileName] = found;
  return found;
}

function registerOfferFonts(doc) {
  const regularPath = resolveFont('BOOKOS.TTF') || resolveFont('NotoSans-Regular.ttf') || resolveFont('Arial-Regular.ttf');
  const boldPath = resolveFont('BOOKOSB.TTF') || resolveFont('NotoSans-Bold.ttf') || resolveFont('Arial-Bold.ttf');
  const italicPath = resolveFont('BOOKOSI.TTF') || resolveFont('NotoSans-Italic.ttf') || resolveFont('Arial-Italic.ttf');

  let fontRegular = 'Helvetica';
  let fontBold = 'Helvetica-Bold';
  let fontItalic = 'Helvetica-Oblique';

  if (regularPath && fs.existsSync(regularPath)) {
    try {
      doc.registerFont('Bookman-Regular', regularPath);
      fontRegular = 'Bookman-Regular';
    } catch (e) {
      console.warn('Could not register regular font:', e.message);
    }
  }

  if (boldPath && fs.existsSync(boldPath)) {
    try {
      doc.registerFont('Bookman-Bold', boldPath);
      fontBold = 'Bookman-Bold';
    } catch (e) {
      console.warn('Could not register bold font:', e.message);
    }
  }

  if (italicPath && fs.existsSync(italicPath)) {
    try {
      doc.registerFont('Bookman-Italic', italicPath);
      fontItalic = 'Bookman-Italic';
    } catch (e) {
      console.warn('Could not register italic font:', e.message);
    }
  }

  const calibriReg = resolveFont('calibri.ttf') || resolveFont('CALIBRI.TTF');
  const calibriBold = resolveFont('calibrib.ttf') || resolveFont('CALIBRIB.TTF');
  const rupeeFontPath = resolveFont('segoeui.ttf') || resolveFont('arial.ttf') || resolveFont('calibri.ttf');

  let fontFooterRegular = 'Helvetica';
  let fontFooterBold = 'Helvetica-Bold';
  let fontRupee = 'Helvetica';

  if (rupeeFontPath && fs.existsSync(rupeeFontPath)) {
    try {
      doc.registerFont('RupeeFont', rupeeFontPath);
      fontRupee = 'RupeeFont';
    } catch (e) {
      console.warn('Could not register Rupee font:', e.message);
    }
  }

  if (calibriReg && fs.existsSync(calibriReg)) {
    try {
      doc.registerFont('Calibri-Regular', calibriReg);
      fontFooterRegular = 'Calibri-Regular';
    } catch (e) {
      console.warn('Could not register Calibri regular font:', e.message);
    }
  }

  if (calibriBold && fs.existsSync(calibriBold)) {
    try {
      doc.registerFont('Calibri-Bold', calibriBold);
      fontFooterBold = 'Calibri-Bold';
    } catch (e) {
      console.warn('Could not register Calibri bold font:', e.message);
    }
  }

  return { fontRegular, fontBold, fontItalic, fontFooterRegular, fontFooterBold, fontRupee };
}

function formatINR(value) {
  const num = Number(value || 0);
  const rounded = Math.round(num);
  return `₹ ${rounded.toLocaleString('en-IN')}`;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return '-';
  if (typeof dateStr === 'string') {
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatShortDate(dateStr) {
  if (!dateStr) return '-';
  if (typeof dateStr === 'string') {
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const day = parts[2];
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const year = parts[0];
      return `${day}-${monthNames[monthIdx] || parts[1]}-${year}`;
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

/**
 * 3-Line Page Footer at bottom of every page (Calibri, Dark Coral Tone at y = 776)
 */
function drawPageFooter(doc, settings, fonts) {
  const { fontFooterRegular } = fonts;
  const pageWidth = 595.28;
  const leftMargin = 54;
  const rightMargin = 54;
  const contentWidth = pageWidth - leftMargin - rightMargin;
  const footerLineY = 776;

  // Thin red accent divider line
  doc.strokeColor(settings.footer_accent_color || '#991B1B')
     .lineWidth(0.8)
     .moveTo(leftMargin, footerLineY)
     .lineTo(leftMargin + contentWidth, footerLineY)
     .stroke();

  // Line 1: Company Name (Calibri, size 8.5, red/coral tone)
  doc.font(fontFooterRegular)
     .fontSize(8.5)
     .fillColor('#A83232')
     .text(settings.footer_line_1 || 'Manuscript Technomedia LLP,', leftMargin, footerLineY + 5, {
       width: contentWidth,
       align: 'center'
     });

  // Line 2: Address (Calibri, size 8.5, red/coral tone)
  doc.font(fontFooterRegular)
     .fontSize(8.5)
     .fillColor('#A83232')
     .text(settings.footer_line_2 || 'Reg. New No 40, 22, 3rd Cross Rd, Jaibharath Nagar, Vivekananda Nagar, Maruthi Sevanagar, Bangalore-33, Karnataka, India.', leftMargin, footerLineY + 16, {
       width: contentWidth,
       align: 'center'
     });

  // Line 3: Contact, Website, GST (Calibri, size 8.5, red/coral tone)
  doc.font(fontFooterRegular)
     .fontSize(8.5)
     .fillColor('#A83232')
     .text(settings.footer_line_3 || 'https://mstechnomedia.com | contact@mstechnomedia.com | +91-9686980760 | GST: 29ACBFM2283L1ZV', leftMargin, footerLineY + 27, {
       width: contentWidth,
       align: 'center'
     });
}

/**
 * Prominent Top-Right Company Logo Header at y = 55 matching the original document
 */
function drawTopRightLogo(doc, logoPath, fonts, y = 55) {
  const { fontBold, fontRegular } = fonts;
  const logoRightEdge = 541.28; // 595.28 - 54 (Standard A4 right margin)
  const actualLogoPath = logoPath || resolveOfferLetterLogoPath() || getCompanyLogoPath();

  const iconWidth = 36;
  const iconHeight = 36;
  const gap = 8;
  
  // Calculate text width of Manuscript at size 23.5
  doc.font(fontBold).fontSize(23.5);
  const textWidth = doc.widthOfString('Manuscript');
  
  // Position text block right-aligned against logoRightEdge
  const textStartX = logoRightEdge - textWidth;
  const iconX = textStartX - gap - iconWidth;
  const iconY = y + 2;

  // Draw the official company logo image on the left
  let logoDrawn = false;
  if (actualLogoPath && fs.existsSync(actualLogoPath)) {
    try {
      doc.image(actualLogoPath, iconX, iconY, { width: iconWidth, height: iconHeight, fit: [iconWidth, iconHeight] });
      logoDrawn = true;
    } catch (e) {
      console.warn('Error drawing company logo in PDF:', e.message);
    }
  }

  if (!logoDrawn) {
    // Fallback vector icon if image cannot be loaded
    doc.save();
    doc.translate(iconX, iconY);
    doc.strokeColor('#F43F5E')
       .lineWidth(3.2)
       .lineCap('round')
       .lineJoin('round');
    
    doc.moveTo(11, 8)
       .lineTo(28, 17)
       .bezierCurveTo(33, 19.5, 33, 21.5, 28, 24)
       .lineTo(11, 33)
       .bezierCurveTo(6, 35.5, 5, 33, 5, 27)
       .lineTo(5, 14)
       .bezierCurveTo(5, 8, 6, 5.5, 11, 8)
       .closePath()
       .stroke();
    doc.restore();
  }

  // Text block: "Manuscript" (font size 23.5, bold, deep dark slate #0F172A)
  doc.font(fontBold).fontSize(23.5).fillColor('#0F172A').text('Manuscript', textStartX, y + 2);

  // Text block: "TECHNOMEDIA LLP" starts directly underneath the letter "M" (left-aligned at textStartX)
  doc.font(fontRegular).fontSize(7.5).fillColor('#1F2937').text('TECHNOMEDIA LLP', textStartX, y + 29, {
    characterSpacing: 1.2
  });
}

/**
 * Main PDF Generation function (Strictly 5 Pages, Matching Exact Original Y-Coordinates)
 */
async function generateOfferLetterPDF(offerData, options = {}) {
  const settings = options.settings || await getOfferLetterSettings();
  const logoPath = settings.physical_logo_path || resolveOfferLetterLogoPath(settings.logo_path);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    bufferPages: true,
    autoFirstPage: false
  });

  const fonts = registerOfferFonts(doc);
  const { fontRegular, fontBold, fontRupee } = fonts;
  const leftMargin = 54;
  const contentWidth = 487.28;

  // Sanitizer to eliminate tabs (\t), carriage returns (\r), zero-width characters and unprintable control characters
  const sanitizeText = (str) => {
    if (typeof str !== 'string') return str || '';
    return str
      .replace(/[\r\n\t\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Normalized and sanitized offer values
  const companyName = sanitizeText(offerData.company_name_snapshot || settings.company_name || 'Manuscript TechnoMedia LLP');
  const candidateName = sanitizeText(offerData.employee_name_snapshot || 'Candidate');
  const candidateAddress = (offerData.employee_address_snapshot || '')
    .replace(/[\r\t\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/[ ]+/g, ' ')
    .trim();
  const candidateEmail = sanitizeText(offerData.employee_email_snapshot || '');
  const jobTitle = sanitizeText(offerData.job_title_snapshot || 'Employee');
  const department = sanitizeText(offerData.department_snapshot || 'General');
  const reportingTo = sanitizeText(offerData.reporting_to || 'Dr. Mueen Ahmed KK, [Managing Director]');
  const workLocation = sanitizeText(offerData.work_location || 'Office Premises');
  const employmentType = sanitizeText(offerData.employment_type || 'Full-time');
  const workHours = sanitizeText(offerData.work_hours || '9:30 AM – 6:30 PM, Monday–Saturday');
  const probationPeriod = sanitizeText(offerData.probation_period || "3 months, extendable at the company's discretion.");
  
  const offerDateFormatted = formatShortDate(offerData.offer_date);
  const interviewDateFormatted = formatDateDisplay(offerData.interview_date || offerData.offer_date);
  const joiningDateShort = formatShortDate(offerData.joining_date);
  const acceptanceDateFormatted = formatDateDisplay(offerData.acceptance_deadline_date || offerData.joining_date);

  const monthlySalaryNum = Number(offerData.monthly_salary || 0);
  const variablePercentage = Number(offerData.variable_percentage || 0);
  const annualFixedSalary = monthlySalaryNum * 12;
  const totalCTC = annualFixedSalary;
  const annualLeaves = offerData.annual_paid_leaves !== undefined ? offerData.annual_paid_leaves : 12;

  const signatoryName = sanitizeText(offerData.signatory_name || settings.signatory_name);
  const signatoryDesignation = sanitizeText(offerData.signatory_designation || settings.signatory_designation);
  const signatoryEmail = sanitizeText(offerData.signatory_email || settings.signatory_email);

  // Responsibilities
  let responsibilities = offerData.responsibilities_snapshot || [];
  if (typeof responsibilities === 'string') {
    try {
      responsibilities = JSON.parse(responsibilities);
    } catch (e) {
      responsibilities = [];
    }
  }

  if (Array.isArray(responsibilities)) {
    responsibilities = responsibilities.map((cat) => ({
      category: sanitizeText(cat.category),
      items: Array.isArray(cat.items) ? cat.items.map((item) => sanitizeText(item)) : []
    }));
  }

  // Helper for bullet points
  const renderBullet = (bulletText, indent = 14, spacing = 3.5) => {
    doc.font(fontRegular).fontSize(11).fillColor('#1F2937');
    doc.text('•', leftMargin + indent, curY);
    const textX = leftMargin + indent + 14;
    const textW = contentWidth - indent - 14;
    doc.text(bulletText, textX, curY, { width: textW, lineGap: 2.0 });
    curY = doc.y + spacing;
  };

  // Helper for bold-prefix bullet row
  const renderPrefixBullet = (boldPrefix, normalText, spacing = 5) => {
    const textX = leftMargin + 24;
    const textW = contentWidth - 24;
    const startY = curY;

    doc.font(fontBold).fontSize(11).fillColor('#000000').text('•', leftMargin + 10, startY);
    doc.font(fontBold).text(boldPrefix, textX, startY, {
      width: textW,
      lineGap: 2.2,
      continued: true
    });
    if (normalText.includes('₹')) {
      const parts = normalText.split('₹');
      parts.forEach((p, i) => {
        if (p) {
          doc.font(fontRegular).fillColor('#111827').text(p, { continued: i < parts.length - 1 });
        }
        if (i < parts.length - 1) {
          doc.font(fontRupee).fillColor('#111827').text('₹ ', { continued: true });
        }
      });
    } else {
      doc.font(fontRegular).fillColor('#111827').text(normalText);
    }
    curY = doc.y + spacing;
  };

  // Helper for Annexure A bullets
  const renderAnnexureBullet = (label, valueText, isBold = false) => {
    const startY = curY;
    doc.font(fontRegular).fontSize(11).fillColor('#1F2937');
    doc.text('•', leftMargin + 14, startY);
    const textFont = isBold ? fontBold : fontRegular;
    doc.font(textFont).text(label, leftMargin + 28, startY, { continued: true });
    if (valueText.includes('₹')) {
      const parts = valueText.split('₹');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          doc.font(textFont).text(parts[i], { continued: (i < parts.length - 1) });
        }
        if (i < parts.length - 1) {
          doc.font(fontRupee).text('₹', { continued: (parts[i + 1] ? true : false) });
        }
      }
    } else {
      doc.font(textFont).text(valueText);
    }
    curY = doc.y + 5;
  };

  // Helper to draw horizontal section divider
  const drawSectionDivider = () => {
    doc.strokeColor('#A0AEC0').lineWidth(0.6).moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).stroke();
    curY += 12;
  };

  // =========================================================================
  // PAGE 1: Core Terms & Position Details (Exact Coordinates from Original)
  // =========================================================================
  doc.addPage({ size: 'A4', margin: 0 });
  drawTopRightLogo(doc, logoPath, fonts, 55);

  // Gradient horizontal band beneath logo at y = 120 (Full page width from edge to edge)
  let curY = 120;
  const pageWidth = 595.28;
  const gradientBand = doc.linearGradient(0, curY, pageWidth, curY);
  gradientBand.stop(0, '#D89A95');
  gradientBand.stop(1, '#EEDBD9');
  doc.rect(0, curY, pageWidth, 14).fill(gradientBand);

  // Date on right beneath gradient banner at y = 145
  curY = 145;
  doc.font(fontBold).fontSize(11).fillColor('#000000').text(`Date: ${offerDateFormatted}`, leftMargin, curY, {
    width: contentWidth,
    align: 'right'
  });

  // Company Address Block on Left at y = 175
  curY = 175;
  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text(companyName, leftMargin, curY);
  curY += 15;

  doc.font(fontRegular).fontSize(11).fillColor('#111827');
  const headerAddressLines = (settings.header_address || 'Reg. Office. No. 22, 3rd Cross,\nVivekananda Nagar, Bangalore-33,\nKarnataka, India').split('\n');
  headerAddressLines.forEach((line) => {
    doc.text(line.trim(), leftMargin, curY);
    curY += 14;
  });
  doc.text(`Phone: ${settings.header_phone || '91 9686980760'}`, leftMargin, curY); curY += 14;
  doc.text(`Email: ${settings.header_email || 'connect@mstechnomedia.com'}`, leftMargin, curY); curY += 14;
  doc.text(`Website: ${settings.header_website || 'www.mstechnomedia.com'}`, leftMargin, curY);

  // Title Bar Divider line at y = 280, title at y = 295
  curY = 280;
  doc.strokeColor('#A0AEC0').lineWidth(0.6).moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).stroke();
  curY = 295;

  doc.font(fontBold).fontSize(12).fillColor('#000000').text(`Offer Letter- ${jobTitle}`, leftMargin, curY, {
    width: contentWidth,
    align: 'center'
  });

  // Addressee Block at y = 325
  curY = 325;
  doc.font(fontRegular).fontSize(11).fillColor('#374151').text('To;', leftMargin, curY);
  curY += 15;

  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text(candidateName, leftMargin, curY);
  curY += 15;

  if (candidateAddress) {
    doc.font(fontRegular).fontSize(11).fillColor('#111827');
    doc.text(candidateAddress.trim(), leftMargin, curY, {
      width: 320,
      lineGap: 2.0
    });
    curY = doc.y + 4;
  }

  if (candidateEmail) {
    doc.font(fontRegular).fontSize(11).fillColor('#111827').text(`Email: ${candidateEmail}`, leftMargin, curY);
    curY = doc.y + 14;
  } else {
    curY += 10;
  }

  // Salutation Block (Dynamic Y positioning)
  curY = Math.max(curY, 405);
  const salutation = offerData.salutation || 'Mr.';
  doc.font(fontRegular).fontSize(11).fillColor('#000000').text(`Dear ${salutation} ${candidateName},`, leftMargin, curY);
  curY += 18;

  // Reference Line
  doc.font(fontRegular).fontSize(11).fillColor('#111827').text(`This is with reference to your interview with us on ${interviewDateFormatted}.`, leftMargin, curY);
  curY += 18;

  // Offer paragraph at y = 452
  curY = 452;
  doc.text('We are pleased to offer you the position of ', leftMargin, curY, {
    width: contentWidth,
    lineGap: 2.5,
    continued: true
  });
  doc.font(fontBold).fillColor('#000000').text(jobTitle, { continued: true });
  doc.font(fontRegular).fillColor('#111827').text(' with ', { continued: true });
  doc.font(fontBold).fillColor('#000000').text(companyName, { continued: true });
  doc.font(fontRegular).fillColor('#111827').text('. Your skills and experience will be a valuable addition to our team. Please review the terms of this offer below.');

  // Position Details Box at y = 520 to 695
  curY = 520;
  doc.strokeColor('#A0AEC0').lineWidth(0.6).moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).stroke();
  curY = 535;

  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text('Position Details', leftMargin, curY);
  curY = 555;

  const renderDetailRow = (label, val) => {
    doc.font(fontRegular).fontSize(11).fillColor('#1F2937');
    doc.text('•', leftMargin + 10, curY);
    doc.font(fontBold).fillColor('#000000').text(label, leftMargin + 24, curY, { continued: true });
    doc.font(fontRegular).fillColor('#111827').text(val);
    curY += 16.5;
  };

  renderDetailRow('Job Title: ', jobTitle);
  renderDetailRow('Department/Team: ', department);
  renderDetailRow('Reporting To: ', reportingTo);
  renderDetailRow('Work Location: ', workLocation);
  renderDetailRow('Proposed Start Date: ', joiningDateShort);
  renderDetailRow('Employment Type: ', employmentType);
  renderDetailRow('Work Hours: ', workHours);
  renderDetailRow('Probation Period: ', probationPeriod);

  // Position Details Bottom Divider at y = 695
  curY = 695;
  doc.strokeColor('#A0AEC0').lineWidth(0.6).moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).stroke();

  drawPageFooter(doc, settings, fonts);

  // =========================================================================
  // PAGE 2: Compensation & Responsibilities (Starts directly beneath logo at y = 120)
  // =========================================================================
  doc.addPage({ size: 'A4', margin: 0 });
  drawTopRightLogo(doc, logoPath, fonts, 55);

  // Compensation and Benefits starting cleanly at y = 120
  curY = 120;
  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text('Compensation and Benefits', leftMargin, curY);
  curY += 18;

  renderPrefixBullet('Base Salary: ', `${formatINR(monthlySalaryNum)} per month, payable in accordance with company payroll policies`, 5);
  renderPrefixBullet('Variable Pay/Bonus: ', `${variablePercentage}% of Salary per annum, based on individual and company performance.`, 6);

  // Benefits sub-block: Benefits on its own line, bullet points on next line
  doc.font(fontBold).fontSize(11).fillColor('#000000').text('Benefits:', leftMargin + 10, curY);
  curY += 16;

  doc.font(fontRegular).fontSize(11).fillColor('#111827');
  doc.text(`• Leaves: ${annualLeaves} Paid Leaves annually.`, leftMargin + 24, curY);
  curY += 15;
  doc.text(`• Provident Fund/Gratuity: ${offerData.pf_applicable || 'Not Applicable'}`, leftMargin + 24, curY);
  curY += 15;
  doc.text(`• Other Allowances: ${offerData.other_allowances || 'Not Applicable'}`, leftMargin + 24, curY);
  curY += 24; // 1-line space after Other Allowances

  doc.font(fontRegular).fontSize(11).fillColor('#111827').text('A detailed Compensation Breakup (CTC) will be provided as Annexure A.', leftMargin + 10, curY);
  curY += 26; // 1-line space after 'A detailed Compensation Breakup...' (Arrow 1)

  // Section Divider Line
  doc.strokeColor('#A0AEC0').lineWidth(0.6).moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).stroke();
  curY += 16;

  // Roles and Responsibilities Header
  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text('Roles and Responsibilities:', leftMargin, curY);
  curY += 24; // 1-line space after 'Roles and Responsibilities:' (Arrow 2)

  doc.font(fontRegular).fontSize(11).fillColor('#111827').text('Your responsibilities will include, but are not limited to:', leftMargin, curY);
  curY += 24; // 1-line space after introductory sentence

  // Categories 1 to 3 on Page 2 with uniform, equal inter-category spacing
  const page2Cats = responsibilities.slice(0, 3);
  page2Cats.forEach((cat, idx) => {
    doc.font(fontBold).fontSize(11).fillColor('#000000').text(cat.category || '', leftMargin, curY);
    curY += 22; // 1-line space after category title

    if (Array.isArray(cat.items)) {
      for (const bullet of cat.items) {
        renderBullet(bullet, 12, 2.5);
      }
    }
    // Uniform, equal gap after every category
    curY += 10;
  });

  drawPageFooter(doc, settings, fonts);

  // =========================================================================
  // PAGE 3: Responsibilities (Part 2), Tools & IP, NDA, Background Verification (Starts at y = 120)
  // =========================================================================
  doc.addPage({ size: 'A4', margin: 0 });
  drawTopRightLogo(doc, logoPath, fonts, 55);

  // Categories 4 to 6 on Page 3 (Starts cleanly beneath logo at y = 120)
  curY = 120;
  const page3Cats = responsibilities.slice(3);
  page3Cats.forEach((cat, idx) => {
    doc.font(fontBold).fontSize(11).fillColor('#000000').text(cat.category || '', leftMargin, curY);
    curY += 22; // 1-line space after category title

    if (Array.isArray(cat.items)) {
      for (const bullet of cat.items) {
        renderBullet(bullet, 12, 2.2);
      }
    }
    // Uniform, equal gap after every category
    curY += 10;
  });

  // Tools, Equipment, and IP
  doc.strokeColor('#A0AEC0').lineWidth(0.6).moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).stroke();
  curY += 14;

  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text('Tools, Equipment, and IP', leftMargin, curY);
  curY += 15;

  renderBullet('The company may provide the necessary hardware/software to perform your duties.', 10, 2.2);

  doc.font(fontRegular).fontSize(11).fillColor('#1F2937');
  doc.text('•', leftMargin + 10, curY);
  doc.text('All work product, inventions, and intellectual property created during employment shall be the exclusive property of ', leftMargin + 24, curY, {
    width: contentWidth - 24,
    lineGap: 1.8,
    continued: true
  });
  doc.font(fontBold).fillColor('#000000').text(companyName, { continued: true });
  doc.font(fontRegular).fillColor('#1F2937').text(', as detailed in the Intellectual Property and Confidentiality Agreement.');
  curY = doc.y + 10;

  // Confidentiality and Non-Disclosure
  doc.strokeColor('#A0AEC0').lineWidth(0.6).moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).stroke();
  curY += 14;

  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text('Confidentiality and Non-Disclosure', leftMargin, curY);
  curY += 15;

  doc.font(fontRegular).fontSize(11).fillColor('#1F2937');
  doc.text('You will be required to sign a ', leftMargin, curY, {
    width: contentWidth,
    lineGap: 1.8,
    continued: true
  });
  doc.font(fontBold).fillColor('#000000').text('Confidentiality and Non-Disclosure Agreement (NDA). ', { continued: true });
  doc.font(fontRegular).fillColor('#1F2937').text('You must not disclose or use any proprietary or confidential information belonging to the company or its clients during or after your employment, except as authorized.');
  curY = doc.y + 10;

  // Background Verification and Conditions (First 2 Bullets on Page 3)
  doc.strokeColor('#A0AEC0').lineWidth(0.6).moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).stroke();
  curY += 14;

  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text('Background Verification and Conditions', leftMargin, curY);
  curY += 24; // 1-line space after header

  doc.font(fontRegular).fontSize(11).fillColor('#1F2937').text('This offer is contingent upon:', leftMargin, curY);
  curY += 24; // 1-line space after 'This offer is contingent upon:'

  const bg1Text = 'Successful completion of background verification, including education and employment checks';
  const bg1H = doc.heightOfString(bg1Text, { width: contentWidth - 24, lineGap: 1.8 });
  const bg1Y = curY;
  doc.text('•', leftMargin + 10, bg1Y);
  doc.text('Successful completion of ', leftMargin + 24, bg1Y, { width: contentWidth - 24, lineGap: 1.8, continued: true });
  doc.font(fontBold).fillColor('#000000').text('background verification', { continued: true });
  doc.font(fontRegular).fillColor('#1F2937').text(', including education and employment checks');
  curY = bg1Y + bg1H + 3.5;

  const bg2Y = curY;
  doc.text('•', leftMargin + 10, bg2Y);
  doc.text('Verification of ', leftMargin + 24, bg2Y, { width: contentWidth - 24, lineGap: 1.8, continued: true });
  doc.font(fontBold).fillColor('#000000').text('identity', { continued: true });
  doc.font(fontRegular).fillColor('#1F2937').text(' and ', { continued: true });
  doc.font(fontBold).fillColor('#000000').text('work authorization');

  drawPageFooter(doc, settings, fonts);

  // =========================================================================
  // PAGE 4: Contingency Points (Part 2), Working Policies, Termination, Acceptance & Sign-off (Starts at y = 120)
  // =========================================================================
  doc.addPage({ size: 'A4', margin: 0 });
  drawTopRightLogo(doc, logoPath, fonts, 55);

  // Bullets 3 and 4 of Background Verification on Page 4 (Starts at y = 120)
  curY = 120;
  renderBullet('Acceptance and signature of all applicable agreements (NDA, Agreement, and Company Policies)', 10, 3.5);
  renderBullet('Confirmation that there are no existing restrictions (e.g., non-compete) preventing you from joining', 10, 4);

  curY = doc.y + 6;
  const misrepText = 'Any misrepresentation or failure in verification may result in withdrawal of this offer or termination of employment.';
  doc.font(fontRegular).fontSize(11).fillColor('#1F2937').text(misrepText, leftMargin, curY, { width: contentWidth, lineGap: 1.8 });
  curY = doc.y + 12;

  // Working Policies
  doc.strokeColor('#A0AEC0').lineWidth(0.6).moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).stroke();
  curY += 14;

  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text('Working Policies', leftMargin, curY);
  curY += 15;

  renderPrefixBullet('Leave and Attendance: ', 'As per the company’s leave and attendance policy in force and as updated from time to time', 4.0);
  renderPrefixBullet('Remote/Hybrid Work: ', 'Work is office-based.', 4.0);
  renderPrefixBullet('Code of Conduct: ', 'You are expected to maintain professional conduct and adhere to ethical standards', 10);

  // Termination
  doc.strokeColor('#A0AEC0').lineWidth(0.6).moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).stroke();
  curY += 14;

  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text('Termination', leftMargin, curY);
  curY += 15;

  renderBullet('During probation, either party may terminate employment with 30 days written notice or pay in lieu of notice.', 10, 4.0);
  renderBullet('Post-probation, either party may terminate employment within 30 days written notice or pay in lieu, as per policy.', 10, 4.0);
  renderBullet('The company reserves the right to terminate employment for cause without notice, subject to applicable law and policies.', 10, 10);

  // Acceptance of Offer
  doc.strokeColor('#A0AEC0').lineWidth(0.6).moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).stroke();
  curY += 14;

  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text('Acceptance of Offer', leftMargin, curY);
  curY += 15;

  doc.font(fontRegular).fontSize(11).fillColor('#1F2937');
  doc.text('Please indicate your acceptance by signing and returning this letter along with the attached agreements by ', leftMargin, curY, {
    width: contentWidth,
    lineGap: 1.8,
    continued: true
  });
  doc.font(fontBold).fillColor('#000000').text(acceptanceDateFormatted, { continued: true });
  doc.font(fontRegular).fillColor('#1F2937').text('. This offer will expire if not accepted by the specified date.');
  curY = doc.y + 8;

  doc.text('We are excited at the prospect of you joining ', leftMargin, curY, {
    width: contentWidth,
    lineGap: 1.8,
    continued: true
  });
  doc.font(fontBold).fillColor('#000000').text(companyName, { continued: true });
  doc.font(fontRegular).fillColor('#1F2937').text(` and contributing to our mission. If you have any questions, please contact us at ${settings.header_email || settings.signatory_email}`);
  
  // 6 lines of empty space for company seal and signature
  curY = doc.y + 72;

  // Sign-off Block
  doc.font(fontRegular).fontSize(11).fillColor('#000000').text('Sincerely,', leftMargin, curY); curY += 16;
  doc.font(fontBold).fontSize(11).fillColor('#000000').text(signatoryName, leftMargin, curY); curY += 14;
  doc.font(fontRegular).fontSize(11).fillColor('#222222').text(signatoryDesignation, leftMargin, curY); curY += 14;
  doc.text(companyName, leftMargin, curY); curY += 14;
  doc.text(`Email: ${signatoryEmail}`, leftMargin, curY);

  drawPageFooter(doc, settings, fonts);

  // =========================================================================
  // PAGE 5: Candidate Acceptance & Annexure A (Starts from top at y = 120)
  // =========================================================================
  doc.addPage({ size: 'A4', margin: 0 });
  drawTopRightLogo(doc, logoPath, fonts, 55);

  // Candidate Acceptance Block at y = 120
  curY = 120;
  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text('Candidate Acceptance', leftMargin, curY, { width: contentWidth, align: 'center' });
  curY += 28; // 1-line space after 'Candidate Acceptance'

  doc.font(fontRegular).fontSize(11).fillColor('#1F2937');
  doc.text('I, ', leftMargin, curY, {
    width: contentWidth,
    lineGap: 2.0,
    continued: true
  });
  doc.font(fontBold).fillColor('#000000').text(candidateName, { continued: true });
  doc.font(fontRegular).fillColor('#1F2937').text(', accept the offer of employment outlined in this letter and agree to the terms and conditions, including company policies and applicable agreements.');
  curY = doc.y + 14;

  // Clean signature rows
  doc.font(fontRegular).fontSize(11).fillColor('#000000');
  doc.text('•  Signature: __________________________', leftMargin + 14, curY); curY += 18;
  doc.text('•  Name: ', leftMargin + 14, curY, { continued: true });
  doc.font(fontBold).text(candidateName); curY += 18;
  doc.font(fontRegular).text('•  Date:', leftMargin + 14, curY); curY += 22;

  // Section Divider Line
  doc.strokeColor('#A0AEC0').lineWidth(0.6).moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).stroke();
  curY += 18;

  // Annexure A — Compensation Breakup
  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text('Annexure A — Compensation Breakup (Illustrative)', leftMargin, curY, { width: contentWidth, align: 'center' });
  curY += 28; // 1-line space after 'Annexure A — Compensation Breakup (Illustrative)'

  renderAnnexureBullet('Fixed Gross: ', `${formatINR(monthlySalaryNum)} per month.`);
  renderAnnexureBullet('Variable/Performance Pay: ', `${variablePercentage}% annually`);
  renderAnnexureBullet('Benefits/Allowances: ', `${offerData.other_allowances || 'Not applicable'}`);
  renderAnnexureBullet('Statutory Contributions: ', `[PF/ESI/Gratuity] ${offerData.pf_applicable || 'not applicable'}`);
  renderAnnexureBullet('Total CTC: ', `${formatINR(totalCTC)} per year`, true);
  curY += 10;

  const annexureNote = 'Note: Exact figures and statutory deductions will be calculated as per applicable laws and company policy at the time of joining.';
  doc.font(fontRegular).fontSize(10.5).fillColor('#4B5563').text(annexureNote, leftMargin, curY, { width: contentWidth, lineGap: 2.0 });

  // Draw footer on final page
  drawPageFooter(doc, settings, fonts);

  return doc;
}

module.exports = {
  generateOfferLetterPDF,
  registerOfferFonts,
  formatDateDisplay,
  formatINR
};
