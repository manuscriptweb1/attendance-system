const pool = require('../config/database');
const path = require('path');
const fs = require('fs');

const DEFAULT_COMPANY_NAME = 'Manuscript TechnoMedia LLP';
const DEFAULT_LOGO_WIDTH = 160;
const DEFAULT_LOGO_HEIGHT = 55;
const DEFAULT_HEADER_ADDRESS = 'Reg. Office. No. 22, 3rd Cross,\nVivekananda Nagar, Bangalore-33,\nKarnataka, India';
const DEFAULT_HEADER_PHONE = '91-9686980760';
const DEFAULT_HEADER_EMAIL = 'connect@mstechnomedia.com';
const DEFAULT_HEADER_WEBSITE = 'www.mstechnomedia.com';
const DEFAULT_FOOTER_LINE_1 = 'Manuscript Technomedia LLP,';
const DEFAULT_FOOTER_LINE_2 = 'Reg. New No 40, 22, 3rd Cross Rd, Jaibharath Nagar, Vivekananda Nagar, Maruthi Sevanagar, Bangalore-33, Karnataka, India.';
const DEFAULT_FOOTER_LINE_3 = 'https://mstechnomedia.com | contact@mstechnomedia.com | +91-9686980760 | GST: 29ACBFM2283L1ZV';
const DEFAULT_SIGNATORY_NAME = 'Dr. Mueen Ahmed KK';
const DEFAULT_SIGNATORY_DESIGNATION = 'Designated Partner';
const DEFAULT_SIGNATORY_EMAIL = 'contact@mstechnomedia.com';

let cachedOfferLetterSettings = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

const getDefaultFallbackLogoPath = () => {
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

const resolveOfferLetterLogoPath = (storedPath) => {
  if (!storedPath) return getDefaultFallbackLogoPath();

  const normalizedRel = storedPath.replace(/^\/+/, '');
  const candidatePaths = [
    path.join(__dirname, '..', normalizedRel),
    path.resolve(process.cwd(), normalizedRel),
    path.resolve(process.cwd(), 'backend', normalizedRel),
    storedPath
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  return getDefaultFallbackLogoPath();
};

const getOfferLetterSettings = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedOfferLetterSettings && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedOfferLetterSettings;
  }

  try {
    const result = await pool.query('SELECT * FROM offer_letter_settings WHERE id = 1 LIMIT 1');
    let row = result.rows[0];

    if (!row) {
      const insertRes = await pool.query(`
        INSERT INTO offer_letter_settings (
          id, company_name, logo_path, logo_width, logo_height,
          header_address, header_phone, header_email, header_website,
          footer_line_1, footer_line_2, footer_line_3, footer_accent_color,
          signatory_name, signatory_designation, signatory_email
        )
        VALUES (
          1, $1, NULL, $2, $3,
          $4, $5, $6, $7,
          $8, $9, $10, '#E11D48',
          $11, $12, $13
        )
        RETURNING *
      `, [
        DEFAULT_COMPANY_NAME, DEFAULT_LOGO_WIDTH, DEFAULT_LOGO_HEIGHT,
        DEFAULT_HEADER_ADDRESS, DEFAULT_HEADER_PHONE, DEFAULT_HEADER_EMAIL, DEFAULT_HEADER_WEBSITE,
        DEFAULT_FOOTER_LINE_1, DEFAULT_FOOTER_LINE_2, DEFAULT_FOOTER_LINE_3,
        DEFAULT_SIGNATORY_NAME, DEFAULT_SIGNATORY_DESIGNATION, DEFAULT_SIGNATORY_EMAIL
      ]);
      row = insertRes.rows[0];
    }

    const physicalLogoPath = resolveOfferLetterLogoPath(row.logo_path);
    let logoDataUrl = null;

    if (physicalLogoPath && fs.existsSync(physicalLogoPath)) {
      try {
        const ext = path.extname(physicalLogoPath).toLowerCase().replace('.', '');
        const mimeType = ext === 'svg' ? 'image/svg+xml' : (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : (ext === 'webp' ? 'image/webp' : 'image/png'));
        const fileBuf = fs.readFileSync(physicalLogoPath);
        logoDataUrl = `data:${mimeType};base64,${fileBuf.toString('base64')}`;
      } catch (readErr) {
        console.warn('Could not read offer letter logo as data URL:', readErr.message);
      }
    }

    cachedOfferLetterSettings = {
      id: row.id,
      company_name: row.company_name || DEFAULT_COMPANY_NAME,
      logo_path: row.logo_path || null,
      logo_data_url: logoDataUrl,
      physical_logo_path: physicalLogoPath,
      logo_width: parseInt(row.logo_width, 10) || DEFAULT_LOGO_WIDTH,
      logo_height: parseInt(row.logo_height, 10) || DEFAULT_LOGO_HEIGHT,
      header_address: row.header_address || DEFAULT_HEADER_ADDRESS,
      header_phone: row.header_phone || DEFAULT_HEADER_PHONE,
      header_email: row.header_email || DEFAULT_HEADER_EMAIL,
      header_website: row.header_website || DEFAULT_HEADER_WEBSITE,
      footer_line_1: row.footer_line_1 || DEFAULT_FOOTER_LINE_1,
      footer_line_2: row.footer_line_2 || DEFAULT_FOOTER_LINE_2,
      footer_line_3: row.footer_line_3 || DEFAULT_FOOTER_LINE_3,
      footer_accent_color: row.footer_accent_color || '#E11D48',
      signatory_name: row.signatory_name || DEFAULT_SIGNATORY_NAME,
      signatory_designation: row.signatory_designation || DEFAULT_SIGNATORY_DESIGNATION,
      signatory_email: row.signatory_email || DEFAULT_SIGNATORY_EMAIL,
      signature_path: row.signature_path || null,
      updated_at: row.updated_at
    };
    lastCacheTime = now;
    return cachedOfferLetterSettings;
  } catch (err) {
    console.error('Error loading offer letter settings from DB:', err.message);
    return {
      id: 1,
      company_name: DEFAULT_COMPANY_NAME,
      logo_path: null,
      logo_data_url: null,
      physical_logo_path: getDefaultFallbackLogoPath(),
      logo_width: DEFAULT_LOGO_WIDTH,
      logo_height: DEFAULT_LOGO_HEIGHT,
      header_address: DEFAULT_HEADER_ADDRESS,
      header_phone: DEFAULT_HEADER_PHONE,
      header_email: DEFAULT_HEADER_EMAIL,
      header_website: DEFAULT_HEADER_WEBSITE,
      footer_line_1: DEFAULT_FOOTER_LINE_1,
      footer_line_2: DEFAULT_FOOTER_LINE_2,
      footer_line_3: DEFAULT_FOOTER_LINE_3,
      footer_accent_color: '#E11D48',
      signatory_name: DEFAULT_SIGNATORY_NAME,
      signatory_designation: DEFAULT_SIGNATORY_DESIGNATION,
      signatory_email: DEFAULT_SIGNATORY_EMAIL,
      signature_path: null
    };
  }
};

const saveUploadedLogoFile = (base64Data) => {
  if (!base64Data) return null;

  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  let extension = 'png';
  let buffer;

  if (matches && matches.length === 3) {
    const mime = matches[1].toLowerCase();
    if (mime.includes('jpeg') || mime.includes('jpg')) extension = 'jpg';
    else if (mime.includes('png')) extension = 'png';
    else if (mime.includes('webp')) extension = 'webp';
    else if (mime.includes('svg')) extension = 'svg';

    buffer = Buffer.from(matches[2], 'base64');
  } else {
    buffer = Buffer.from(base64Data, 'base64');
  }

  const uploadsDir = path.join(__dirname, '../uploads/offer-letter');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileName = `offer-letter-logo-${Date.now()}.${extension}`;
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/offer-letter/${fileName}`;
};

const updateOfferLetterSettings = async ({
  company_name,
  logo_base64,
  logo_width,
  logo_height,
  header_address,
  header_phone,
  header_email,
  header_website,
  footer_line_1,
  footer_line_2,
  footer_line_3,
  footer_accent_color,
  signatory_name,
  signatory_designation,
  signatory_email
}) => {
  const current = await getOfferLetterSettings(true);
  let newLogoPath = current.logo_path;

  if (logo_base64) {
    const savedPath = saveUploadedLogoFile(logo_base64);
    if (savedPath) {
      newLogoPath = savedPath;
    }
  }

  const result = await pool.query(`
    UPDATE offer_letter_settings
    SET 
      company_name = COALESCE($1, company_name),
      logo_path = $2,
      logo_width = COALESCE($3, logo_width),
      logo_height = COALESCE($4, logo_height),
      header_address = COALESCE($5, header_address),
      header_phone = COALESCE($6, header_phone),
      header_email = COALESCE($7, header_email),
      header_website = COALESCE($8, header_website),
      footer_line_1 = COALESCE($9, footer_line_1),
      footer_line_2 = COALESCE($10, footer_line_2),
      footer_line_3 = COALESCE($11, footer_line_3),
      footer_accent_color = COALESCE($12, footer_accent_color),
      signatory_name = COALESCE($13, signatory_name),
      signatory_designation = COALESCE($14, signatory_designation),
      signatory_email = COALESCE($15, signatory_email),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
    RETURNING *
  `, [
    company_name !== undefined ? company_name : null,
    newLogoPath,
    logo_width !== undefined ? parseInt(logo_width, 10) : null,
    logo_height !== undefined ? parseInt(logo_height, 10) : null,
    header_address !== undefined ? header_address : null,
    header_phone !== undefined ? header_phone : null,
    header_email !== undefined ? header_email : null,
    header_website !== undefined ? header_website : null,
    footer_line_1 !== undefined ? footer_line_1 : null,
    footer_line_2 !== undefined ? footer_line_2 : null,
    footer_line_3 !== undefined ? footer_line_3 : null,
    footer_accent_color !== undefined ? footer_accent_color : null,
    signatory_name !== undefined ? signatory_name : null,
    signatory_designation !== undefined ? signatory_designation : null,
    signatory_email !== undefined ? signatory_email : null
  ]);

  cachedOfferLetterSettings = null;
  return getOfferLetterSettings(true);
};

const resetOfferLetterLogo = async () => {
  const current = await getOfferLetterSettings(true);
  if (current.logo_path) {
    const phys = resolveOfferLetterLogoPath(current.logo_path);
    if (phys && fs.existsSync(phys) && phys.includes('offer-letter-logo-')) {
      try {
        fs.unlinkSync(phys);
      } catch (err) {
        console.warn('Could not delete old offer letter logo file:', err.message);
      }
    }
  }

  await pool.query(`
    UPDATE offer_letter_settings
    SET logo_path = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `);

  cachedOfferLetterSettings = null;
  return getOfferLetterSettings(true);
};

module.exports = {
  getOfferLetterSettings,
  updateOfferLetterSettings,
  resetOfferLetterLogo,
  resolveOfferLetterLogoPath
};
