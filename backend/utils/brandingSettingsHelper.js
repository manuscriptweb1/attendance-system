const pool = require('../config/database');
const path = require('path');
const fs = require('fs');

const DEFAULT_COMPANY_NAME = 'Manuscript Technomedia LLP';
const DEFAULT_LOGO_WIDTH = 32;
const DEFAULT_LOGO_HEIGHT = 32;
const DEFAULT_FONT_SIZE = 17.0;
const DEFAULT_ADDRESS = 'Manuscript Technomedia LLP, Reg. Office. No. 22, 3rd Cross, Vivekananda Nagar, Bangalore-33, Karnataka, India.';

let cachedBranding = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

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

const resolvePhysicalLogoPath = (storedPath) => {
  if (!storedPath) return getDefaultFallbackLogoPath();

  // If stored as relative URL like /uploads/branding/logo.png
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

const getBrandingSettings = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && cachedBranding && (now - lastCacheTime < CACHE_TTL_MS)) {
    return cachedBranding;
  }

  try {
    const result = await pool.query('SELECT * FROM pdf_template_settings WHERE id = 1 LIMIT 1');
    let row = result.rows[0];

    if (!row) {
      const insertRes = await pool.query(`
        INSERT INTO pdf_template_settings (id, company_name, logo_path, logo_width, logo_height, company_name_font_size, registered_office_address)
        VALUES (1, $1, NULL, $2, $3, $4, $5)
        RETURNING *
      `, [DEFAULT_COMPANY_NAME, DEFAULT_LOGO_WIDTH, DEFAULT_LOGO_HEIGHT, DEFAULT_FONT_SIZE, DEFAULT_ADDRESS]);
      row = insertRes.rows[0];
    }

    const physicalLogoPath = resolvePhysicalLogoPath(row.logo_path);
    let logoDataUrl = null;

    if (physicalLogoPath && fs.existsSync(physicalLogoPath)) {
      try {
        const ext = path.extname(physicalLogoPath).toLowerCase().replace('.', '');
        const mimeType = ext === 'svg' ? 'image/svg+xml' : (ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : (ext === 'webp' ? 'image/webp' : 'image/png'));
        const fileBuf = fs.readFileSync(physicalLogoPath);
        logoDataUrl = `data:${mimeType};base64,${fileBuf.toString('base64')}`;
      } catch (readErr) {
        console.warn('Could not read logo as data URL:', readErr.message);
      }
    }

    cachedBranding = {
      id: row.id,
      company_name: row.company_name || DEFAULT_COMPANY_NAME,
      logo_path: row.logo_path || null,
      logo_data_url: logoDataUrl,
      physical_logo_path: physicalLogoPath,
      logo_width: parseInt(row.logo_width, 10) || DEFAULT_LOGO_WIDTH,
      logo_height: parseInt(row.logo_height, 10) || DEFAULT_LOGO_HEIGHT,
      company_name_font_size: parseFloat(row.company_name_font_size) || DEFAULT_FONT_SIZE,
      registered_office_address: row.registered_office_address || DEFAULT_ADDRESS,
      updated_at: row.updated_at
    };
    lastCacheTime = now;
    return cachedBranding;
  } catch (err) {
    console.error('Error loading branding settings from DB:', err.message);
    return {
      id: 1,
      company_name: DEFAULT_COMPANY_NAME,
      logo_path: null,
      physical_logo_path: getDefaultFallbackLogoPath(),
      logo_width: DEFAULT_LOGO_WIDTH,
      logo_height: DEFAULT_LOGO_HEIGHT,
      company_name_font_size: DEFAULT_FONT_SIZE,
      registered_office_address: DEFAULT_ADDRESS,
      updated_at: new Date()
    };
  }
};

const saveUploadedLogoFile = (base64Data) => {
  if (!base64Data || typeof base64Data !== 'string') return null;

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
    // Plain base64 string
    buffer = Buffer.from(base64Data, 'base64');
  }

  const uploadsDir = path.join(__dirname, '../uploads/branding');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileName = `company-logo-${Date.now()}.${extension}`;
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, buffer);

  return `/uploads/branding/${fileName}`;
};

const updateBrandingSettings = async ({
  company_name,
  logo_base64,
  logo_width,
  logo_height,
  company_name_font_size,
  registered_office_address
}) => {
  const current = await getBrandingSettings(true);
  let newLogoPath = current.logo_path;

  if (logo_base64) {
    const savedPath = saveUploadedLogoFile(logo_base64);
    if (savedPath) {
      newLogoPath = savedPath;
    }
  }

  const safeCompanyName = (company_name && String(company_name).trim()) ? String(company_name).trim() : DEFAULT_COMPANY_NAME;
  const safeLogoWidth = Math.max(16, Math.min(200, parseInt(logo_width, 10) || DEFAULT_LOGO_WIDTH));
  const safeLogoHeight = Math.max(16, Math.min(200, parseInt(logo_height, 10) || DEFAULT_LOGO_HEIGHT));
  const safeFontSize = Math.max(10, Math.min(30, parseFloat(company_name_font_size) || DEFAULT_FONT_SIZE));
  const safeAddress = (registered_office_address && String(registered_office_address).trim()) ? String(registered_office_address).trim() : DEFAULT_ADDRESS;

  await pool.query(`
    UPDATE pdf_template_settings
    SET company_name = $1,
        logo_path = $2,
        logo_width = $3,
        logo_height = $4,
        company_name_font_size = $5,
        registered_office_address = $6,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `, [safeCompanyName, newLogoPath, safeLogoWidth, safeLogoHeight, safeFontSize, safeAddress]);

  cachedBranding = null;
  return getBrandingSettings(true);
};

const resetBrandingLogo = async () => {
  const current = await getBrandingSettings(true);
  if (current.logo_path) {
    try {
      const physicalPath = resolvePhysicalLogoPath(current.logo_path);
      if (physicalPath && fs.existsSync(physicalPath) && physicalPath.includes('uploads')) {
        fs.unlinkSync(physicalPath);
      }
    } catch (e) {
      console.warn('Could not delete old logo file:', e.message);
    }
  }

  await pool.query(`
    UPDATE pdf_template_settings
    SET logo_path = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `);

  cachedBranding = null;
  return getBrandingSettings(true);
};

const clearBrandingCache = () => {
  cachedBranding = null;
  lastCacheTime = 0;
};

module.exports = {
  DEFAULT_COMPANY_NAME,
  DEFAULT_LOGO_WIDTH,
  DEFAULT_LOGO_HEIGHT,
  DEFAULT_FONT_SIZE,
  DEFAULT_ADDRESS,
  getBrandingSettings,
  updateBrandingSettings,
  resetBrandingLogo,
  clearBrandingCache,
  resolvePhysicalLogoPath,
  getDefaultFallbackLogoPath
};
