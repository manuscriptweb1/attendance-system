/**
 * Employee ID card (CR80, 54 × 85.6 mm, portrait) – front and back.
 * Front: company mark + logo, photo (or placeholder figure), name,
 *        designation, employee ID, address and vertical website text.
 * Back:  attendance QR code + barcode with scan instructions.
 * One builder drives both the on-screen preview and printing.
 */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const asset = (path) => `${window.location.origin}${process.env.PUBLIC_URL || ''}${path}`;

export const ID_CARD_DEFAULTS = {
  website: 'www.mstechnomedia.com',
  address: '22, (New No. 48), 3rd Cross, Vivekananda Nagar, Bengaluru, 560 033, Karnataka, INDIA'
};

/** Grey silhouette shown when no photo has been uploaded or scanned yet */
const PLACEHOLDER_SVG = `
<svg class="idc-placeholder" viewBox="0 0 120 150" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="No photo">
  <rect width="120" height="150" fill="#e5e7eb"/>
  <circle cx="60" cy="58" r="26" fill="#9ca3af"/>
  <path d="M14 150c0-30 20-50 46-50s46 20 46 50z" fill="#9ca3af"/>
  <text x="60" y="140" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="9" font-weight="700" fill="#6b7280">PHOTO</text>
</svg>`;

export const ID_CARD_CSS = `
.idc-card { position: relative; width: 54mm; height: 85.6mm; box-sizing: border-box; background: #ffffff; color: #111111;
  border-radius: 3mm; overflow: hidden; font-family: Arial, Helvetica, sans-serif; border: 0.2mm solid #d1d5db;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; page-break-inside: avoid; break-inside: avoid; }
.idc-card * { box-sizing: border-box; }
.idc-side { position: absolute; left: 1.6mm; top: 0; bottom: 0; display: flex; align-items: center; }
.idc-side span { writing-mode: vertical-rl; transform: rotate(180deg); font-size: 5.2pt; letter-spacing: 0.4pt; color: #4b5563; font-weight: 700; }
.idc-front { display: flex; flex-direction: column; align-items: center; padding: 3.6mm 3mm 2.6mm 5.2mm; height: 100%; }
.idc-brand { display: flex; align-items: center; justify-content: center; gap: 1.4mm; height: 9mm; }
.idc-brand .idc-mark { height: 7.4mm; width: 7.4mm; }
.idc-brand .idc-logo { height: 7.4mm; width: auto; }
.idc-photo { margin-top: 3mm; width: 23mm; height: 28.5mm; padding: 0.8mm; border: 0.35mm solid #9ca3af; background: #ffffff; }
.idc-photo img, .idc-photo svg { display: block; width: 100%; height: 100%; object-fit: cover; }
.idc-name { margin-top: 2.2mm; font-size: 10.5pt; line-height: 1.1; font-weight: 900; text-transform: uppercase; text-align: center; letter-spacing: 0.2pt;
  font-family: 'Arial Black', Arial, Helvetica, sans-serif; max-width: 46mm; }
.idc-role { margin-top: 1.2mm; font-size: 7.4pt; font-weight: 800; text-transform: uppercase; text-align: center; letter-spacing: 0.3pt; max-width: 46mm; }
.idc-id { margin-top: 0.8mm; font-size: 7.4pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3pt; }
.idc-front-barcode { margin-top: 1.6mm; width: 34mm; height: auto; image-rendering: pixelated; }
.idc-address { margin-top: auto; padding-top: 1mm; font-size: 5.1pt; line-height: 1.35; color: #4b5563; font-weight: 700; text-align: center; max-width: 46mm; }
.idc-back { display: flex; flex-direction: column; align-items: center; height: 100%; padding: 0 3.4mm 2.2mm 3.4mm; text-align: center; }
.idc-back-band { width: calc(100% + 6.8mm); background: #dc2626; color: #ffffff; font-size: 7pt; font-weight: 800; letter-spacing: 1.2pt;
  text-transform: uppercase; padding: 1.7mm 0 1.5mm 0; display: flex; align-items: center; justify-content: center; gap: 1.4mm; }
.idc-back-band img { height: 4.2mm; width: 4.2mm; background: #ffffff; border-radius: 1mm; padding: 0.3mm; }
.idc-back-title { margin-top: 2mm; font-size: 7.2pt; font-weight: 800; text-transform: uppercase; }
.idc-back-sub { font-size: 5.6pt; color: #4b5563; margin-top: 0.4mm; }
.idc-qr { margin-top: 1.4mm; width: 30mm; height: 30mm; image-rendering: pixelated; }
.idc-barcode { margin-top: 1.4mm; width: 42mm; height: auto; image-rendering: pixelated; }
.idc-steps { margin-top: 1.4mm; font-size: 5.4pt; line-height: 1.4; color: #374151; }
.idc-steps b { color: #111111; }
.idc-return { margin-top: auto; font-size: 4.7pt; line-height: 1.3; color: #6b7280; border-top: 0.2mm solid #e5e7eb; padding-top: 1.1mm; width: 100%; }
.idc-return b { color: #374151; }
`;

export const idCardFrontHtml = (badge) => {
  const emp = badge.employee || {};
  const card = { ...ID_CARD_DEFAULTS, ...(badge.card || {}) };
  const photo = badge.photo
    ? `<img src="${esc(badge.photo)}" alt="${esc(emp.name)}" />`
    : PLACEHOLDER_SVG;
  return `
  <div class="idc-card">
    ${card.website ? `<div class="idc-side"><span>${esc(card.website)}</span></div>` : ''}
    <div class="idc-front">
      <div class="idc-brand">
        <img class="idc-mark" src="${asset('/assets/idcard/mark.svg')}" alt="" />
        <img class="idc-logo" src="${asset('/assets/idcard/manuscript-logo.png')}" alt="Manuscript Technomedia" />
      </div>
      <div class="idc-photo">${photo}</div>
      <div class="idc-name">${esc(emp.name)}</div>
      ${emp.job_role ? `<div class="idc-role">${esc(emp.job_role)}</div>` : ''}
      <div class="idc-id">Employee ID: ${esc(emp.employee_id)}</div>
      ${badge.barcode ? `<img class="idc-front-barcode" src="${badge.barcode}" alt="Attendance barcode" />` : ''}
      ${card.address ? `<div class="idc-address">${esc(card.address)}</div>` : ''}
    </div>
  </div>`;
};

export const idCardBackHtml = (badge) => {
  const emp = badge.employee || {};
  const card = { ...ID_CARD_DEFAULTS, ...(badge.card || {}) };
  return `
  <div class="idc-card">
    <div class="idc-back">
      <div class="idc-back-band"><img src="${asset('/assets/idcard/mark.svg')}" alt="" /> Attendance Card</div>
      <div class="idc-back-title">${esc(emp.name)}</div>
      <div class="idc-back-sub">${esc(emp.employee_id)}</div>
      <img class="idc-qr" src="${badge.qr}" alt="Attendance QR code" />
      <img class="idc-barcode" src="${badge.barcode}" alt="Attendance barcode" />
      <div class="idc-steps">
        Scan at the entrance when you <b>arrive</b><br/>and again when you <b>leave</b>.
      </div>
      <div class="idc-return">
        This card is the property of <b>Manuscript Technomedia LLP</b>.<br/>
        If found, please return to:<br/>${esc(card.address)}${card.website ? `<br/><b>${esc(card.website)}</b>` : ''}
      </div>
    </div>
  </div>`;
};

/**
 * Print ID cards into a window opened by the caller (keeps the popup user-initiated).
 * Each employee gets the front and back next to each other; cut, then fold or
 * laminate back-to-back. A duplex PVC card printer can use the card size directly.
 */
export const printIdCards = (badges, win) => {
  const pairs = badges.map((b) => `
    <div class="pair">
      <div><div class="lbl">Front</div>${idCardFrontHtml(b)}</div>
      <div><div class="lbl">Back</div>${idCardBackHtml(b)}</div>
    </div>`).join('');
  const doc = win.document;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Employee ID cards</title>
    <style>
      @page { size: A4; margin: 8mm; }
      body { margin: 0; font-family: Arial, Helvetica, sans-serif; background: #ffffff; }
      .sheet { display: flex; flex-wrap: wrap; gap: 6mm 10mm; }
      .pair { display: flex; gap: 3mm; break-inside: avoid; page-break-inside: avoid; }
      .lbl { font-size: 7pt; color: #9ca3af; margin: 0 0 1mm 1mm; }
      @media print { .lbl { display: none; } }
      ${ID_CARD_CSS}
    </style></head><body><div class="sheet">${pairs}</div>
    <script>
      window.onload = function () { setTimeout(function () { window.focus(); window.print(); }, 400); };
    </script>
    </body></html>`);
  doc.close();
};
