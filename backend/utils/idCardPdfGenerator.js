/**
 * Employee ID card PDF (CR80: 54 × 85.6 mm, portrait).
 * Same design as the on-screen card (frontend/src/utils/idCard.js):
 *   Front – company mark + logo, framed photo (or placeholder figure), name,
 *           designation, employee ID, address, vertical website text
 *   Back  – "Attendance Card" band, attendance QR code + barcode, instructions,
 *           "if found, return to" block
 *
 * Layouts:
 *   'card' – one page per card face (front, back, front, back …) for PVC card printers
 *   'a4'   – 9 fronts per A4 page followed by a page of the matching backs, mirrored
 *            so they line up when printed double-sided (flip on long edge)
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const MM = 72 / 25.4;
const W = 54 * MM;
const H = 85.6 * MM;
const RADIUS = 3 * MM;

const FONT_DIR = path.join(__dirname, '../assets/fonts');
const ASSET_DIR = path.join(__dirname, '../assets/idcard');
const readIf = (p) => (fs.existsSync(p) ? fs.readFileSync(p) : null);
const MARK_PNG = readIf(path.join(ASSET_DIR, 'mark.png'));
const LOGO_PNG = readIf(path.join(ASSET_DIR, 'manuscript-logo.png'));

const COMPANY = 'Manuscript Technomedia LLP';
const RED = '#dc2626';
const DARK = '#111111';
const GREY = '#4b5563';
const LIGHT = '#6b7280';

const pngSize = (buf) => (buf && buf.length > 24 ? { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) } : { w: 1, h: 1 });

/** data:image/jpeg|png;base64,… → Buffer (pdfkit supports JPEG and PNG only) */
const dataUrlToBuffer = (dataUrl) => {
  const m = /^data:image\/(jpeg|jpg|png);base64,(.+)$/i.exec(String(dataUrl || ''));
  return m ? Buffer.from(m[2], 'base64') : null;
};

const registerFonts = (doc) => {
  const reg = path.join(FONT_DIR, 'Arial-Regular.ttf');
  const bold = path.join(FONT_DIR, 'Arial-Bold.ttf');
  doc.registerFont('Card', fs.existsSync(reg) ? reg : 'Helvetica');
  doc.registerFont('CardBold', fs.existsSync(bold) ? bold : 'Helvetica-Bold');
};

/** Centered text in a box; returns the height used */
const centered = (doc, text, x, y, width, { font = 'CardBold', size = 7, color = DARK, spacing = 0, lineGap = 0 } = {}) => {
  doc.font(font).fontSize(size).fillColor(color);
  const opts = { width, align: 'center', characterSpacing: spacing, lineGap };
  const h = doc.heightOfString(text, opts);
  doc.text(text, x, y, opts);
  return h;
};

const cardOutline = (doc, x, y, outline) => {
  if (!outline) return;
  doc.save().lineWidth(0.5).strokeColor('#d1d5db').roundedRect(x, y, W, H, RADIUS).stroke().restore();
};

const drawPlaceholder = (doc, x, y, w, h) => {
  doc.save();
  doc.rect(x, y, w, h).fill('#e5e7eb');
  const cx = x + w / 2;
  doc.circle(cx, y + h * 0.39, w * 0.22).fill('#9ca3af');
  doc.moveTo(x + w * 0.12, y + h)
    .bezierCurveTo(x + w * 0.12, y + h * 0.78, x + w * 0.3, y + h * 0.66, cx, y + h * 0.66)
    .bezierCurveTo(x + w * 0.7, y + h * 0.66, x + w * 0.88, y + h * 0.78, x + w * 0.88, y + h)
    .closePath().fill('#9ca3af');
  doc.font('CardBold').fontSize(5.5).fillColor('#6b7280').text('PHOTO', x, y + h - 9, { width: w, align: 'center' });
  doc.restore();
};

const drawFront = (doc, x, y, card, { outline }) => {
  const emp = card.employee || {};
  doc.save();
  doc.roundedRect(x, y, W, H, RADIUS).clip();
  doc.rect(x, y, W, H).fill('#ffffff');

  // Vertical website on the left edge (reads bottom → top)
  if (card.website) {
    const ox = x + 3.1 * MM;
    const oy = y + H / 2;
    doc.save();
    doc.rotate(-90, { origin: [ox, oy] });
    doc.font('CardBold').fontSize(5.2).fillColor(GREY)
      .text(card.website, ox - H / 2, oy - 2.6, { width: H, align: 'center', characterSpacing: 0.4, lineBreak: false });
    doc.restore();
  }

  const contentX = x + 5.2 * MM;
  const contentW = W - 5.2 * MM - 3 * MM;
  const centerX = contentX + contentW / 2;

  // Brand row: mark + wordmark logo
  const brandH = 7.4 * MM;
  const brandY = y + 4 * MM;
  const markW = MARK_PNG ? brandH * (pngSize(MARK_PNG).w / pngSize(MARK_PNG).h) : 0;
  const logoW = LOGO_PNG ? brandH * (pngSize(LOGO_PNG).w / pngSize(LOGO_PNG).h) : 0;
  const gap = 1.4 * MM;
  const brandW = markW + (markW && logoW ? gap : 0) + logoW;
  let bx = centerX - brandW / 2;
  if (MARK_PNG) { doc.image(MARK_PNG, bx, brandY, { height: brandH }); bx += markW + gap; }
  if (LOGO_PNG) doc.image(LOGO_PNG, bx, brandY, { height: brandH });
  if (!MARK_PNG && !LOGO_PNG) centered(doc, COMPANY, contentX, brandY + 2 * MM, contentW, { size: 8 });

  // Photo frame
  const frameW = 23 * MM;
  const frameH = 28.5 * MM;
  const frameX = centerX - frameW / 2;
  const frameY = y + 15.6 * MM;
  doc.save().lineWidth(1).strokeColor('#9ca3af').rect(frameX, frameY, frameW, frameH).stroke().restore();
  const pad = 0.8 * MM;
  const px = frameX + pad;
  const py = frameY + pad;
  const pw = frameW - pad * 2;
  const ph = frameH - pad * 2;
  let drewPhoto = false;
  if (card.photo) {
    try {
      doc.save();
      doc.rect(px, py, pw, ph).clip();
      doc.image(card.photo, px, py, { cover: [pw, ph], align: 'center', valign: 'center' });
      doc.restore();
      drewPhoto = true;
    } catch (_) {
      doc.restore();
    }
  }
  if (!drewPhoto) drawPlaceholder(doc, px, py, pw, ph);

  // Name, designation, employee ID
  let ty = frameY + frameH + 2.2 * MM;
  ty += centered(doc, String(emp.name || '').toUpperCase(), contentX, ty, contentW, { size: 10.5, spacing: 0.2 }) + 1.2 * MM;
  if (emp.job_role) ty += centered(doc, String(emp.job_role).toUpperCase(), contentX, ty, contentW, { size: 7.4, spacing: 0.3 }) + 0.8 * MM;
  ty += centered(doc, `EMPLOYEE ID: ${String(emp.employee_id || '').toUpperCase()}`, contentX, ty, contentW, { size: 7.4, spacing: 0.3 });

  // Attendance barcode with its number (scannable at the kiosk / HR app)
  if (card.barcodePng) {
    const barW = 34 * MM;
    const bs = pngSize(card.barcodePng);
    doc.image(card.barcodePng, centerX - barW / 2, ty + 1.6 * MM, { width: barW, height: barW * (bs.h / bs.w) });
  }

  // Address at the bottom
  if (card.address) {
    doc.font('CardBold').fontSize(5.1);
    const ah = doc.heightOfString(card.address, { width: contentW, align: 'center', lineGap: 0.6 });
    centered(doc, card.address, contentX, y + H - 2.8 * MM - ah, contentW, { size: 5.1, color: GREY, lineGap: 0.6 });
  }

  doc.restore();
  cardOutline(doc, x, y, outline);
};

const drawBack = (doc, x, y, card, { outline }) => {
  const emp = card.employee || {};
  doc.save();
  doc.roundedRect(x, y, W, H, RADIUS).clip();
  doc.rect(x, y, W, H).fill('#ffffff');

  // Red "Attendance Card" band
  const bandH = 7.6 * MM;
  doc.rect(x, y, W, bandH).fill(RED);
  const label = 'ATTENDANCE CARD';
  doc.font('CardBold').fontSize(7);
  const labelW = doc.widthOfString(label, { characterSpacing: 1.2 });
  const iconS = 4.4 * MM;
  const groupW = (MARK_PNG ? iconS + 1.4 * MM : 0) + labelW;
  let gx = x + (W - groupW) / 2;
  if (MARK_PNG) {
    doc.roundedRect(gx, y + (bandH - iconS) / 2, iconS, iconS, 1 * MM).fill('#ffffff');
    doc.image(MARK_PNG, gx + 0.35 * MM, y + (bandH - iconS) / 2 + 0.35 * MM, { fit: [iconS - 0.7 * MM, iconS - 0.7 * MM], align: 'center', valign: 'center' });
    gx += iconS + 1.4 * MM;
  }
  doc.fillColor('#ffffff').text(label, gx, y + (bandH - 7) / 2 + 0.5, { characterSpacing: 1.2, lineBreak: false });

  const innerX = x + 3.4 * MM;
  const innerW = W - 6.8 * MM;
  let ty = y + bandH + 2.2 * MM;
  ty += centered(doc, String(emp.name || '').toUpperCase(), innerX, ty, innerW, { size: 7.2 }) + 0.3 * MM;
  ty += centered(doc, String(emp.employee_id || ''), innerX, ty, innerW, { font: 'Card', size: 5.6, color: GREY });

  // QR + barcode
  const qrS = 30 * MM;
  ty += 1.4 * MM;
  doc.image(card.qrPng, x + (W - qrS) / 2, ty, { width: qrS, height: qrS });
  ty += qrS + 1.4 * MM;
  const barW = 42 * MM;
  const bs = pngSize(card.barcodePng);
  const barH = barW * (bs.h / bs.w);
  doc.image(card.barcodePng, x + (W - barW) / 2, ty, { width: barW, height: barH });
  ty += barH + 1.6 * MM;

  ty += centered(doc, 'Scan at the entrance when you ARRIVE', innerX, ty, innerW, { size: 5.4, color: '#374151' });
  centered(doc, 'and again when you LEAVE.', innerX, ty + 0.3 * MM, innerW, { size: 5.4, color: '#374151' });

  // "If found, return to" block at the bottom
  const lines = [
    `This card is the property of ${COMPANY}.`,
    'If found, please return to:',
    card.address || ''
  ].filter(Boolean).join('\n');
  doc.font('Card').fontSize(4.7);
  const blockH = doc.heightOfString(lines, { width: innerW, align: 'center', lineGap: 0.3 })
    + (card.website ? doc.font('CardBold').heightOfString(card.website, { width: innerW }) : 0);
  const by = y + H - 2.2 * MM - blockH;
  doc.save().lineWidth(0.4).strokeColor('#e5e7eb').moveTo(innerX, by - 1.2 * MM).lineTo(innerX + innerW, by - 1.2 * MM).stroke().restore();
  centered(doc, lines, innerX, by, innerW, { font: 'Card', size: 4.7, color: LIGHT, lineGap: 0.3 });
  if (card.website) {
    doc.font('CardBold').fontSize(4.7).fillColor('#374151')
      .text(card.website, innerX, y + H - 2.2 * MM - doc.heightOfString(card.website, { width: innerW }), { width: innerW, align: 'center' });
  }

  doc.restore();
  cardOutline(doc, x, y, outline);
};

/**
 * @param {Array} cards [{ employee:{name, employee_id, job_role}, photo:Buffer|null, qrPng:Buffer, barcodePng:Buffer, website, address }]
 * @param {{ layout?: 'card'|'a4' }} options
 * @returns {Promise<Buffer>}
 */
const buildIdCardPdf = (cards, { layout = 'card' } = {}) => new Promise((resolve, reject) => {
  try {
    const isA4 = layout === 'a4';
    const doc = new PDFDocument({
      size: isA4 ? 'A4' : [W, H],
      margin: 0,
      autoFirstPage: false,
      info: { Title: 'Employee ID cards', Author: COMPANY }
    });
    registerFonts(doc);
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    if (!isA4) {
      for (const card of cards) {
        doc.addPage({ size: [W, H], margin: 0 });
        drawFront(doc, 0, 0, card, { outline: false });
        doc.addPage({ size: [W, H], margin: 0 });
        drawBack(doc, 0, 0, card, { outline: false });
      }
    } else {
      const pageW = 595.28;
      const cols = 3;
      const rows = 3;
      const gapX = 6 * MM;
      const gapY = 5 * MM;
      const gridW = cols * W + (cols - 1) * gapX;
      const gridH = rows * H + (rows - 1) * gapY;
      const offX = (pageW - gridW) / 2;
      const offY = (841.89 - gridH) / 2;
      const perPage = cols * rows;
      for (let start = 0; start < cards.length; start += perPage) {
        const batch = cards.slice(start, start + perPage);
        doc.addPage({ size: 'A4', margin: 0 });
        batch.forEach((card, i) => {
          const c = i % cols;
          const r = Math.floor(i / cols);
          drawFront(doc, offX + c * (W + gapX), offY + r * (H + gapY), card, { outline: true });
        });
        doc.addPage({ size: 'A4', margin: 0 });
        batch.forEach((card, i) => {
          const c = cols - 1 - (i % cols); // mirrored for long-edge duplex
          const r = Math.floor(i / cols);
          drawBack(doc, offX + c * (W + gapX), offY + r * (H + gapY), card, { outline: true });
        });
      }
    }
    if (cards.length === 0) doc.addPage();
    doc.end();
  } catch (err) {
    reject(err);
  }
});

module.exports = { buildIdCardPdf, dataUrlToBuffer };
