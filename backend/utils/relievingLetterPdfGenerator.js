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

function registerRelievingFonts(doc) {
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

  return { fontRegular, fontBold, fontItalic };
}

function formatShortDate(dateStr) {
  if (!dateStr) return '-';
  if (typeof dateStr === 'string') {
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const day = parts[2];
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const year = parts[0];
      return `${day}-${monthNames[monthIdx] || parts[1]}-${year}`;
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${day}-${monthNames[d.getMonth()]}-${d.getFullYear()}`;
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
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateWithOrdinal(dateStr) {
  if (!dateStr) return '-';
  const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  let d;
  if (typeof dateStr === 'string') {
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      d = new Date(dateStr);
    }
  } else {
    d = new Date(dateStr);
  }

  if (isNaN(d.getTime())) return String(dateStr);

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const dayOrdinal = getOrdinal(d.getDate());
  const monthStr = monthNames[d.getMonth()];
  const yearStr = d.getFullYear();

  return `${dayOrdinal} ${monthStr} ${yearStr}`;
}

function drawTopRightLogo(doc, logoPath, fonts, y = 50) {
  const { fontBold, fontRegular } = fonts;
  const logoRightEdge = 541.28; // Standard A4 right margin
  const actualLogoPath = logoPath || resolveOfferLetterLogoPath() || getCompanyLogoPath();

  const iconWidth = 36;
  const iconHeight = 36;
  const gap = 8;

  doc.font(fontBold).fontSize(23.5);
  const textWidth = doc.widthOfString('Manuscript');
  const textStartX = logoRightEdge - textWidth;
  const iconX = textStartX - gap - iconWidth;
  const iconY = y + 2;

  let logoDrawn = false;
  if (actualLogoPath && fs.existsSync(actualLogoPath)) {
    try {
      doc.image(actualLogoPath, iconX, iconY, { width: iconWidth, height: iconHeight, fit: [iconWidth, iconHeight] });
      logoDrawn = true;
    } catch (e) {
      console.warn('Error drawing company logo in Relieving PDF:', e.message);
    }
  }

  if (!logoDrawn) {
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

  doc.font(fontBold).fontSize(23.5).fillColor('#0F172A').text('Manuscript', textStartX, y + 2);
  doc.font(fontRegular).fontSize(7.5).fillColor('#1F2937').text('TECHNOMEDIA LLP', textStartX, y + 29, {
    characterSpacing: 1.2
  });
}

function drawFooter(doc, settings) {
  const leftMargin = 54;
  const contentWidth = 487.28;
  const footerLineY = 780;

  doc.strokeColor('#991B1B')
     .lineWidth(1.2)
     .moveTo(leftMargin, footerLineY)
     .lineTo(leftMargin + contentWidth, footerLineY)
     .stroke();

  doc.font('Helvetica')
     .fontSize(8.5)
     .fillColor('#A83232')
     .text(settings.footer_line_1 || 'Manuscript Technomedia LLP,', leftMargin, footerLineY + 6, {
       width: contentWidth,
       align: 'center'
     });

  doc.font('Helvetica')
     .fontSize(8.5)
     .fillColor('#A83232')
     .text(settings.footer_line_2 || 'Reg. New No 40, 22, 3rd Cross Rd, Jaibharath Nagar, Vivekananda Nagar, Maruthi Sevanagar, Bangalore-33, Karnataka, India.', leftMargin, footerLineY + 16, {
       width: contentWidth,
       align: 'center'
     });

  doc.font('Helvetica')
     .fontSize(8.5)
     .fillColor('#A83232')
     .text(settings.footer_line_3 || 'https://mstechnomedia.com | contact@mstechnomedia.com | +91-9686980760 | GST: 29ACBFM2283L1ZV', leftMargin, footerLineY + 27, {
       width: contentWidth,
       align: 'center'
     });
}

/**
 * Generate 1-Page Official Relieving Letter PDF
 */
async function generateRelievingLetterPDF(relData, options = {}) {
  const settings = options.settings || await getOfferLetterSettings();
  const logoPath = settings.physical_logo_path || resolveOfferLetterLogoPath(settings.logo_path);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    bufferPages: true,
    autoFirstPage: false
  });

  const fonts = registerRelievingFonts(doc);
  const { fontRegular, fontBold } = fonts;
  const leftMargin = 54;
  const contentWidth = 487.28;
  const pageWidth = 595.28;

  const sanitizeText = (str) => {
    if (typeof str !== 'string') return str || '';
    return str
      .replace(/[\r\n\t\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const companyName = sanitizeText(relData.company_name_snapshot || settings.company_name || 'Manuscript TechnoMedia LLP');
  const employeeName = sanitizeText(relData.employee_name_snapshot || relData.employee_name || 'Employee Name');
  const employeeEmail = sanitizeText(relData.employee_email_snapshot || relData.employee_email || '');
  const employeeAddress = (relData.employee_address_snapshot || relData.employee_address || '')
    .replace(/[\r\t\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/[ ]+/g, ' ')
    .trim();
  const jobTitle = sanitizeText(relData.job_title_snapshot || relData.job_title || 'Editorial Assistant');

  const issueDateFormatted = formatShortDate(relData.issue_date);
  const resignationDateFormatted = formatDateWithOrdinal(relData.resignation_date || relData.issue_date);
  const joiningDateFormatted = formatDateWithOrdinal(relData.joining_date);
  const relievingDateFormatted = formatDateWithOrdinal(relData.relieving_date);

  const signatoryName = sanitizeText(relData.signatory_name || settings.signatory_name || 'Dr. Mueen Ahmed');
  const signatoryDesignation = sanitizeText(relData.signatory_designation || settings.signatory_designation || 'Authorized Signatory');

  const p1 = sanitizeText(relData.paragraph_1_snapshot || relData.paragraph_1 ||
    `With reference to your resignation letter dated on ${resignationDateFormatted}, we hereby accept your resignation and agree to relieve you from the duties on ${relievingDateFormatted}. We confirm that you have worked in our company from ${joiningDateFormatted} as a ${jobTitle}. During your employment with us we found you to be hardworking, diligent and honest in performing your duties.`);

  const p2 = sanitizeText(relData.paragraph_2_snapshot || relData.paragraph_2 ||
    `The management would like to thank you for your service with ${companyName} and we wish you all the best in your future endeavours.`);

  doc.addPage({ size: 'A4', margin: 0 });

  // Top Right Logo
  drawTopRightLogo(doc, logoPath, fonts, 50);

  // Gradient Band
  let curY = 115;
  const gradientBand = doc.linearGradient(0, curY, pageWidth, curY);
  gradientBand.stop(0, '#D89A95');
  gradientBand.stop(1, '#EEDBD9');
  doc.rect(0, curY, pageWidth, 12).fill(gradientBand);

  // Date on right
  curY = 142;
  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text(`Date: ${issueDateFormatted}`, leftMargin, curY, {
    width: contentWidth,
    align: 'right'
  });

  // Centered Title
  curY = 180;
  doc.font(fontBold).fontSize(12.5).fillColor('#000000').text('RELIEVING LETTER', leftMargin, curY, {
    width: contentWidth,
    align: 'center'
  });

  // Addressee Block (To: Candidate Name, Address, Email)
  curY = 220;
  doc.font(fontRegular).fontSize(12).fillColor('#000000').text('To:', leftMargin, curY);
  curY += 16;
  doc.text(employeeName, leftMargin, curY);
  curY += 15;

  if (employeeAddress) {
    const addressLines = employeeAddress.split('\n');
    addressLines.forEach((line) => {
      doc.text(line.trim(), leftMargin, curY, { width: 360, lineGap: 2 });
      curY = doc.y;
    });
  }

  if (employeeEmail) {
    doc.text(employeeEmail, leftMargin, curY);
    curY = doc.y + 16; // 1 empty line space after employee email
  } else {
    curY = doc.y + 16;
  }

  // Dear [Candidate Name],
  doc.font(fontRegular).fontSize(12).fillColor('#000000').text(`Dear ${employeeName},`, leftMargin, curY);
  curY = doc.y + 16; // 1 empty line space after "Dear {Employee name},"

  // Paragraphs (Bookman Old Style Size 12)
  const paragraphOptions = {
    width: contentWidth,
    align: 'justify',
    lineGap: 3.5
  };

  doc.font(fontRegular).fontSize(12).fillColor('#0F172A');

  doc.text(p1, leftMargin, curY, paragraphOptions);
  curY = doc.y + 16;

  doc.text(p2, leftMargin, curY, paragraphOptions);
  curY = doc.y + 24;

  // Signatory Closing Block with 5 empty lines space for physical signature & company seal
  doc.font(fontRegular).fontSize(12).fillColor('#000000').text('Yours Sincerely,', leftMargin, curY);
  curY = doc.y + 75; // Exactly 5 empty lines space (~75pt) for signature and company seal

  doc.font(fontRegular).fontSize(12).fillColor('#000000').text(signatoryName, leftMargin, curY);
  curY += 15;
  doc.text(signatoryDesignation, leftMargin, curY);
  curY += 15;
  doc.text(companyName, leftMargin, curY);

  // Footer (3 Lines identical to Experience Letter)
  drawFooter(doc, settings);

  return doc;
}

module.exports = {
  generateRelievingLetterPDF
};
