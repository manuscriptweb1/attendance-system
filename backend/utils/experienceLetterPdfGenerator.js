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

function registerExperienceFonts(doc) {
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
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
      }
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

function getPronouns(salutation = 'Mr.') {
  const s = String(salutation).trim().toLowerCase();
  if (s === 'ms.' || s === 'ms' || s === 'mrs.' || s === 'mrs') {
    return {
      subject: 'she',
      Subject: 'She',
      object: 'her',
      Object: 'Her',
      possession: 'her',
      Possession: 'Her'
    };
  }
  return {
    subject: 'he',
    Subject: 'He',
    object: 'him',
    Object: 'Him',
    possession: 'his',
    Possession: 'His'
  };
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
      console.warn('Error drawing company logo in Experience PDF:', e.message);
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
 * Generate 1-Page Official Experience Letter PDF
 */
async function generateExperienceLetterPDF(expData, options = {}) {
  const settings = options.settings || await getOfferLetterSettings();
  const logoPath = settings.physical_logo_path || resolveOfferLetterLogoPath(settings.logo_path);

  const doc = new PDFDocument({
    size: 'A4',
    margin: 0,
    bufferPages: true,
    autoFirstPage: false
  });

  const fonts = registerExperienceFonts(doc);
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

  const companyName = sanitizeText(expData.company_name_snapshot || settings.company_name || 'Manuscript TechnoMedia LLP');
  const employeeName = sanitizeText(expData.employee_name_snapshot || expData.employee_name || 'Employee');
  const jobTitle = sanitizeText(expData.job_title_snapshot || expData.job_title || 'Web Developer');
  const salutation = expData.salutation || 'Mr.';
  const pronouns = getPronouns(salutation);

  const issueDateFormatted = formatShortDate(expData.issue_date);
  const joiningDateFormatted = formatDateDisplay(expData.joining_date);
  const relievingDateFormatted = formatDateDisplay(expData.relieving_date);
  const monthlySalary = Number(expData.monthly_salary || 0);
  const salaryInWords = sanitizeText(expData.salary_in_words || '');

  const signatoryName = sanitizeText(expData.signatory_name || settings.signatory_name || 'Dr. Mueen Ahmed KK');
  const signatoryDesignation = sanitizeText(expData.signatory_designation || settings.signatory_designation || 'Authorized Signatory');
  const signatoryEmail = sanitizeText(expData.signatory_email || settings.signatory_email || 'connect@mstechnomedia.com');

  const p1 = sanitizeText(expData.paragraph_1_snapshot || expData.paragraph_1 ||
    `This is to certify that ${salutation} ${employeeName}, was employed with our Organization as ${jobTitle} in ${companyName}, Bangalore since ${joiningDateFormatted} to ${relievingDateFormatted}. ${pronouns.Subject} was drawing a salary of Rs. ${monthlySalary}/- (${salaryInWords || 'Amount in words'}). ${pronouns.Subject} was relieved from ${pronouns.possession} service on ${relievingDateFormatted}.`);

  const p2 = sanitizeText(expData.paragraph_2_snapshot || expData.paragraph_2 ||
    `During ${pronouns.possession} tenure of work, ${pronouns.subject} participated in executing projects for ${companyName} and executed many publishing projects successfully.`);

  const p3 = sanitizeText(expData.paragraph_3_snapshot || expData.paragraph_3 ||
    `During ${pronouns.possession} work tenure, ${pronouns.subject} ably handled all the major responsibilities and was found to be hard working and very productive. We have also found ${pronouns.object} highly motivated, duty bound, and highly committed team member with strong conceptual knowledge.`);

  const p4 = sanitizeText(expData.paragraph_4_snapshot || expData.paragraph_4 ||
    `We wish ${pronouns.object} all the best for ${pronouns.possession} future endeavors.`);

  const p5 = sanitizeText(expData.paragraph_5_snapshot || expData.paragraph_5 ||
    `This letter is been issued based on the request made by ${pronouns.object} without any liability to ${companyName}.`);

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
  curY = 138;
  doc.font(fontBold).fontSize(11.5).fillColor('#000000').text(`Date: ${issueDateFormatted}`, leftMargin, curY, {
    width: contentWidth,
    align: 'right'
  });

  // Company Header Block on Left
  curY = 158;
  doc.font(fontBold).fontSize(12).fillColor('#000000').text(companyName, leftMargin, curY);
  curY += 15;

  doc.font(fontRegular).fontSize(11).fillColor('#1F2937');
  const headerAddressLines = (settings.header_address || 'Reg. Office. No. 22, 3rd Cross,\nVivekananda Nagar, Bangalore-33,\nKarnataka, India').split('\n');
  headerAddressLines.forEach((line) => {
    doc.text(line.trim(), leftMargin, curY);
    curY += 13.5;
  });
  doc.text(`Phone: ${settings.header_phone || '91-9686980760'}`, leftMargin, curY); curY += 13.5;
  doc.text(`Email: ${settings.header_email || 'connect@mstechnomedia.com'}`, leftMargin, curY); curY += 13.5;
  doc.text(`Website: ${settings.header_website || 'www.mstechnomedia.com'}`, leftMargin, curY); curY += 16;

  // Title Bar Divider
  doc.strokeColor('#CBD5E1').lineWidth(0.8).moveTo(leftMargin, curY).lineTo(leftMargin + contentWidth, curY).stroke();
  curY += 12;

  // Centered Title
  doc.font(fontBold).fontSize(12.5).fillColor('#000000').text('TO WHOMSOEVER IT MAY CONCERN', leftMargin, curY, {
    width: contentWidth,
    align: 'center'
  });
  curY += 34;

  // Paragraphs (Bookman Old Style Size 12)
  const paragraphOptions = {
    width: contentWidth,
    align: 'justify',
    lineGap: 3.0
  };

  doc.font(fontRegular).fontSize(12).fillColor('#0F172A');

  doc.text(p1, leftMargin, curY, paragraphOptions);
  curY = doc.y + 11;

  doc.text(p2, leftMargin, curY, paragraphOptions);
  curY = doc.y + 11;

  doc.text(p3, leftMargin, curY, paragraphOptions);
  curY = doc.y + 11;

  doc.text(p4, leftMargin, curY, paragraphOptions);
  curY = doc.y + 11;

  doc.text(p5, leftMargin, curY, paragraphOptions);
  curY = doc.y + 72;

  // Signatory Block (with Sincerely, and no empty gap after Signatory Name)
  doc.font(fontRegular).fontSize(12).fillColor('#0F172A').text('Sincerely,', leftMargin, curY);
  curY += 17;
  doc.font(fontBold).fontSize(12).fillColor('#000000').text(signatoryName, leftMargin, curY);
  curY += 14;
  doc.font(fontRegular).fontSize(11.5).fillColor('#334155').text(signatoryDesignation, leftMargin, curY);
  curY += 14;
  doc.text(companyName, leftMargin, curY);
  if (signatoryEmail) {
    curY += 14;
    doc.text(`Email: ${signatoryEmail}`, leftMargin, curY);
  }

  // Footer
  drawFooter(doc, settings);

  return doc;
}

module.exports = {
  generateExperienceLetterPDF
};
