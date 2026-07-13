const crypto = require('crypto');

/**
 * Checks if the request is coming from the Electron Desktop App.
 * @param {Object} req - Express request object
 * @returns {boolean}
 */
const isElectronRequest = (req) => {
  return (
    req.headers['x-desktop-app'] === 'true' &&
    req.headers['x-device-source'] === 'electron-desktop'
  );
};

/**
 * Extracts Electron headers from the request.
 * @param {Object} req - Express request object
 * @returns {Object}
 */
const getElectronHeaders = (req) => {
  return {
    publicKeyBase64: req.headers['x-desktop-public-key'],
    publicKeyHash: req.headers['x-desktop-public-key-hash'],
    signatureBase64: req.headers['x-desktop-signature'],
    timestamp: req.headers['x-desktop-timestamp'],
    hostname: req.headers['x-desktop-hostname'],
    platform: req.headers['x-desktop-platform'],
    appVersion: req.headers['x-electron-app-version'],
  };
};

/**
 * Validates if timestamp is within 5 minutes.
 * @param {string} timestamp
 * @returns {boolean}
 */
const isFreshTimestamp = (timestamp) => {
  if (!timestamp) return false;

  const requestTime = new Date(timestamp).getTime();

  if (!requestTime || Number.isNaN(requestTime)) {
    return false;
  }

  const now = Date.now();
  const FIVE_MINUTES = 5 * 60 * 1000;

  return Math.abs(now - requestTime) <= FIVE_MINUTES;
};

/**
 * Verifies the Electron request signature.
 * Ed25519 must use crypto.verify(null, ...), not createVerify('sha256').
 * @param {Object} req - Express request object
 * @returns {Object}
 */
const verifyElectronSignature = (req) => {
  if (!isElectronRequest(req)) {
    return {
      isElectron: false,
      valid: false,
      reason: 'NOT_ELECTRON_REQUEST',
      message: 'Not an Electron request',
    };
  }

  const headers = getElectronHeaders(req);

  if (
    !headers.publicKeyBase64 ||
    !headers.publicKeyHash ||
    !headers.signatureBase64 ||
    !headers.timestamp
  ) {
    return {
      isElectron: true,
      valid: false,
      reason: 'MISSING_ELECTRON_HEADERS',
      message: 'Missing required Electron security headers',
    };
  }

  if (!isFreshTimestamp(headers.timestamp)) {
    return {
      isElectron: true,
      valid: false,
      reason: 'EXPIRED_ELECTRON_SIGNATURE',
      message: 'Request timestamp is expired or invalid',
    };
  }

  try {
    const publicKey = Buffer.from(headers.publicKeyBase64, 'base64').toString('utf8');

    const calculatedHash = crypto
      .createHash('sha256')
      .update(publicKey, 'utf8')
      .digest('hex');

    if (calculatedHash !== headers.publicKeyHash) {
      return {
        isElectron: true,
        valid: false,
        reason: 'PUBLIC_KEY_HASH_MISMATCH',
        message: 'Public key hash mismatch',
      };
    }

    /**
     * Must match Electron main.js payload exactly:
     *
     * timestamp
     * METHOD
     * URL_PATH_WITH_QUERY
     * publicKeyHash
     */
    const method = req.method.toUpperCase();
    const urlPath = req.originalUrl;
    const payload = `${headers.timestamp}\n${method}\n${urlPath}\n${headers.publicKeyHash}`;

    const isValidSignature = crypto.verify(
      null,
      Buffer.from(payload, 'utf8'),
      publicKey,
      Buffer.from(headers.signatureBase64, 'base64')
    );

    if (!isValidSignature) {
      return {
        isElectron: true,
        valid: false,
        reason: 'INVALID_ELECTRON_SIGNATURE',
        message: 'Invalid signature',
      };
    }

    return {
      isElectron: true,
      valid: true,
      publicKey,
      publicKeyHash: headers.publicKeyHash,
      hostname: headers.hostname || 'Unknown',
      platform: headers.platform || 'Unknown',
      appVersion: headers.appVersion || 'Unknown',
      source: 'electron-desktop',
      verifiedAt: new Date(),
    };
  } catch (error) {
    console.error('Electron verification error:', error);

    return {
      isElectron: true,
      valid: false,
      reason: 'SIGNATURE_VERIFICATION_ERROR',
      message: 'Signature verification error',
    };
  }
};

module.exports = {
  isElectronRequest,
  getElectronHeaders,
  isFreshTimestamp,
  verifyElectronSignature,
};