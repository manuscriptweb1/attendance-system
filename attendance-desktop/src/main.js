const { app, BrowserWindow, session, safeStorage, shell } = require('electron');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
try {
  if (require('electron-squirrel-startup')) {
    app.quit();
  }
} catch (error) {
  // Ignore if electron-squirrel-startup is not installed.
}

// ===============================
// LOCAL TEST URLs
// ===============================
// const FRONTEND_URL = 'http://localhost:3000';
// const BACKEND_URL = 'http://localhost:5000';

// ===============================
// PRODUCTION URLs - use before final build
// ===============================
const FRONTEND_URL = 'https://attendance-system-rho-five.vercel.app';
const BACKEND_URL = 'https://attendance-system-tnbm.onrender.com';

const APP_VERSION = app.getVersion();
const IDENTITY_FILE = 'device_identity.enc';

let desktopIdentity = null;

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
}

// ===============================
// Device Identity
// ===============================

function getIdentityFilePath() {
  const userDataPath = app.getPath('userData');

  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  return path.join(userDataPath, IDENTITY_FILE);
}

function createDesktopIdentity() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  const publicKeyHash = crypto
    .createHash('sha256')
    .update(publicKey, 'utf8')
    .digest('hex');

  return {
    publicKey,
    privateKey,
    publicKeyHash,
    createdAt: new Date().toISOString(),
  };
}

function saveDesktopIdentity(filePath, identity) {
  const dataString = JSON.stringify(identity);

  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(dataString);
    fs.writeFileSync(filePath, encrypted);
  } else {
    const fallback = Buffer.from(dataString, 'utf8').toString('base64');
    fs.writeFileSync(filePath, fallback, 'utf8');
  }
}

function readDesktopIdentity(filePath) {
  const data = fs.readFileSync(filePath);

  if (safeStorage.isEncryptionAvailable()) {
    try {
      const decrypted = safeStorage.decryptString(data);
      return JSON.parse(decrypted);
    } catch (error) {
      const fallback = Buffer.from(data.toString(), 'base64').toString('utf8');
      return JSON.parse(fallback);
    }
  }

  const fallback = Buffer.from(data.toString(), 'base64').toString('utf8');
  return JSON.parse(fallback);
}

function getOrCreateDesktopIdentity() {
  const identityFilePath = getIdentityFilePath();

  if (fs.existsSync(identityFilePath)) {
    try {
      const existingIdentity = readDesktopIdentity(identityFilePath);

      if (
        existingIdentity &&
        existingIdentity.publicKey &&
        existingIdentity.privateKey &&
        existingIdentity.publicKeyHash
      ) {
        desktopIdentity = existingIdentity;
        return desktopIdentity;
      }
    } catch (error) {
      console.error('Failed to read existing desktop identity. Creating new identity.');
    }
  }

  desktopIdentity = createDesktopIdentity();
  saveDesktopIdentity(identityFilePath, desktopIdentity);

  return desktopIdentity;
}

// ===============================
// Request Signing
// ===============================

function getUrlPathWithQuery(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.pathname + parsedUrl.search;
  } catch (error) {
    console.error('Invalid URL while signing request:', url);
    return url;
  }
}

function signRequest(method, url, timestamp) {
  if (!desktopIdentity) {
    desktopIdentity = getOrCreateDesktopIdentity();
  }

  const urlPath = getUrlPathWithQuery(url);

  const payload = `${timestamp}\n${method.toUpperCase()}\n${urlPath}\n${desktopIdentity.publicKeyHash}`;

  // Ed25519 must use crypto.sign(null, ...)
  const signature = crypto.sign(
    null,
    Buffer.from(payload, 'utf8'),
    desktopIdentity.privateKey
  );

  return signature.toString('base64');
}

function setupBackendHeaderInjection() {
  const filter = {
    urls: [`${BACKEND_URL}/*`],
  };

  session.defaultSession.webRequest.onBeforeSendHeaders(
    filter,
    (details, callback) => {
      try {
        if (!desktopIdentity) {
          desktopIdentity = getOrCreateDesktopIdentity();
        }

        const timestamp = new Date().toISOString();
        const signature = signRequest(details.method, details.url, timestamp);

        const base64PublicKey = Buffer.from(
          desktopIdentity.publicKey,
          'utf8'
        ).toString('base64');

        details.requestHeaders['X-Desktop-App'] = 'true';
        details.requestHeaders['X-Device-Source'] = 'electron-desktop';
        details.requestHeaders['X-Desktop-Public-Key'] = base64PublicKey;
        details.requestHeaders['X-Desktop-Public-Key-Hash'] =
          desktopIdentity.publicKeyHash;
        details.requestHeaders['X-Desktop-Signature'] = signature;
        details.requestHeaders['X-Desktop-Timestamp'] = timestamp;
        details.requestHeaders['X-Desktop-Hostname'] = os.hostname();
        details.requestHeaders['X-Desktop-Platform'] = os.platform();
        details.requestHeaders['X-Electron-App-Version'] = APP_VERSION;
      } catch (error) {
        console.error('Failed to attach Electron desktop headers:', error);
      }

      callback({
        requestHeaders: details.requestHeaders,
      });
    }
  );
}

// ===============================
// Location Permission
// ===============================

function setupLocationPermission() {
  const allowedOrigins = [new URL(FRONTEND_URL).origin];

  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      try {
        const currentUrl = webContents.getURL();
        const currentOrigin = new URL(currentUrl).origin;

        if (
          permission === 'geolocation' &&
          allowedOrigins.includes(currentOrigin)
        ) {
          console.log('Geolocation permission allowed for:', currentOrigin);
          return callback(true);
        }

        console.log('Permission blocked:', permission, currentOrigin);
        return callback(false);
      } catch (error) {
        console.error('Permission request error:', error);
        return callback(false);
      }
    }
  );

  session.defaultSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) => {
      try {
        if (permission !== 'geolocation') {
          return false;
        }

        let origin = requestingOrigin;

        if (!origin && webContents) {
          origin = new URL(webContents.getURL()).origin;
        }

        return allowedOrigins.includes(origin);
      } catch (error) {
        console.error('Permission check error:', error);
        return false;
      }
    }
  );
}

// ===============================
// Window Security
// ===============================

function isAllowedNavigation(url) {
  try {
    const parsedUrl = new URL(url);
    const frontendOrigin = new URL(FRONTEND_URL).origin;
    const backendOrigin = new URL(BACKEND_URL).origin;

    return (
      parsedUrl.origin === frontendOrigin ||
      parsedUrl.origin === backendOrigin
    );
  } catch (error) {
    return false;
  }
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'AttendNest - Employee Attendance Management System | GPS Attendance Tracking',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) {
      return { action: 'allow' };
    }

    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (app.isPackaged) {
    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  mainWindow.loadURL(FRONTEND_URL);
}

// ===============================
// App Lifecycle
// ===============================

app.whenReady().then(() => {
  desktopIdentity = getOrCreateDesktopIdentity();

  setupLocationPermission();

  setupBackendHeaderInjection();

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('second-instance', () => {
  const mainWindow = BrowserWindow.getAllWindows()[0];

  if (mainWindow) {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    mainWindow.focus();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});