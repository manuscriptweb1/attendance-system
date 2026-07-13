const { getSettingsFromDB } = require('../utils/settingsHelper');

/**
 * Extract client IP address from request
 */
const getClientIP = (req) => {
  // Check various headers for the real IP address
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim();
  }

  return (
    req.headers['x-real-ip'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
    'Unknown'
  );
};

/**
 * Normalize IP address (remove IPv6 prefix if present)
 */
const normalizeIP = (ip) => {
  if (!ip) return 'Unknown';

  // Remove IPv6 prefix from IPv4 addresses
  if (ip.startsWith('::ffff:')) {
    return ip.substring(7);
  }

  return ip;
};

/**
 * Check if IP is in allowed list
 */
const isIPAllowed = (clientIP, allowedIPs) => {
  if (!allowedIPs || allowedIPs.length === 0) {
    return false;
  }

  const normalizedClientIP = normalizeIP(clientIP);

  // Check exact matches
  for (const allowedIP of allowedIPs) {
    const normalizedAllowedIP = normalizeIP(allowedIP.trim());

    if (normalizedClientIP === normalizedAllowedIP) {
      return true;
    }

    // Check IP range (simple CIDR notation support - e.g., 192.168.1.0/24)
    if (allowedIP.includes('/')) {
      if (isIPInRange(normalizedClientIP, allowedIP)) {
        return true;
      }
    }
  }

  return false;
};

/**
 * Check if IP is in CIDR range
 */
const isIPInRange = (ip, cidr) => {
  try {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);

    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);

    return (ipNum & mask) === (rangeNum & mask);
  } catch (error) {
    console.error('Error checking IP range:', error);
    return false;
  }
};

/**
 * Convert IP address to number
 */
const ipToNumber = (ip) => {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
};

/**
 * Validate network based on settings
 */
const validateNetwork = async (req) => {
  try {
    const settings = await getSettingsFromDB();
    const clientIP = getClientIP(req);
    const normalizedClientIP = normalizeIP(clientIP);

    console.log('=== NETWORK VALIDATION ===');
    console.log('Client IP (raw):', clientIP);
    console.log('Client IP (normalized):', normalizedClientIP);

    // Get network settings from the correct location
    const officePublicIP = settings.network?.officePublicIP;
    const allowedIPs = settings.network?.allowedIPs || [];

    console.log('Office Public IP (from DB):', officePublicIP);
    console.log('Allowed IPs (from DB):', allowedIPs);

    // If no network validation configured, return invalid
    if (!officePublicIP && (!allowedIPs || allowedIPs.length === 0)) {
      console.log('❌ No office IPs configured in database');
      return {
        valid: false,
        message: 'Network validation not configured. Please contact admin to configure office IP addresses.',
        clientIP: normalizedClientIP
      };
    }

    // Check primary office IP
    if (officePublicIP) {
      const normalizedOfficeIP = normalizeIP(officePublicIP);
      console.log('Checking Primary Office IP:', normalizedOfficeIP);

      if (normalizedClientIP === normalizedOfficeIP) {
        console.log('✅ IP matches primary office IP');
        return {
          valid: true,
          message: 'Connected from office network',
          clientIP: normalizedClientIP
        };
      } else {
        console.log('❌ IP does not match primary office IP');
        console.log('   Expected:', normalizedOfficeIP);
        console.log('   Got:', normalizedClientIP);
      }
    }

    // Check allowed IPs list
    if (allowedIPs && allowedIPs.length > 0) {
      console.log('Checking allowed IPs list...');

      for (const allowedIP of allowedIPs) {
        const normalizedAllowedIP = normalizeIP(allowedIP.trim());
        console.log('  Checking:', normalizedAllowedIP, 'vs', normalizedClientIP);

        if (normalizedClientIP === normalizedAllowedIP) {
          console.log('  ✅ Match found!');
        }
      }

      if (isIPAllowed(clientIP, allowedIPs)) {
        console.log('✅ IP found in allowed list');
        return {
          valid: true,
          message: 'Connected from authorized office network',
          clientIP: normalizedClientIP
        };
      }
    }

    console.log('❌ IP not authorized');
    console.log('=== NETWORK VALIDATION FAILED ===');
    return {
      valid: false,
      message: `Not connected to office network. Your IP: ${normalizedClientIP}${officePublicIP ? '. Expected: ' + normalizeIP(officePublicIP) : ''}`,
      clientIP: normalizedClientIP
    };
  } catch (error) {
    console.error('❌ Network validation error:', error);
    return {
      valid: false,
      message: 'Network validation error. Please try again.',
      clientIP: 'Unknown'
    };
  }
};

module.exports = {
  getClientIP,
  normalizeIP,
  validateNetwork,
  isIPAllowed
};
