import axios from 'axios';

/**
 * Separate API clients for the HR Scanner mobile app and entrance kiosks.
 * They keep their own login in localStorage (so the installed phone app stays
 * signed in) and never touch the admin/employee session used by the main site.
 */
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const HR_TOKEN_KEY = 'hr_scanner_token';
export const HR_USER_KEY = 'hr_scanner_user';
export const KIOSK_KEY = 'smart_attendance_kiosk_key';

export const safeStorage = {
  get(key) {
    try { return window.localStorage.getItem(key); } catch (_) { return null; }
  },
  set(key, value) {
    try { window.localStorage.setItem(key, value); } catch (_) { /* private mode */ }
  },
  remove(key) {
    try { window.localStorage.removeItem(key); } catch (_) { /* private mode */ }
  }
};

export const getHrUser = () => {
  try { return JSON.parse(safeStorage.get(HR_USER_KEY) || 'null'); } catch (_) { return null; }
};

export const saveHrSession = (token, user) => {
  safeStorage.set(HR_TOKEN_KEY, token);
  safeStorage.set(HR_USER_KEY, JSON.stringify(user));
};

export const clearHrSession = () => {
  safeStorage.remove(HR_TOKEN_KEY);
  safeStorage.remove(HR_USER_KEY);
};

export const isHrScannerRole = (role) => {
  const r = String(role || '').trim().toLowerCase().replace(/[_-]+/g, ' ');
  return r === 'hr' || r === 'hr scanner';
};

export const hrApi = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });

hrApi.interceptors.request.use((config) => {
  const token = safeStorage.get(HR_TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

hrApi.interceptors.response.use(
  (res) => res,
  (error) => {
    const isLogin = error.config?.url?.includes('/login');
    if (error.response?.status === 401 && !isLogin) {
      clearHrSession();
      window.dispatchEvent(new CustomEvent('hrScannerSessionExpired'));
    }
    return Promise.reject(error);
  }
);

export const kioskApi = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });

kioskApi.interceptors.request.use((config) => {
  const key = safeStorage.get(KIOSK_KEY);
  if (key) config.headers['X-Kiosk-Key'] = key;
  return config;
});

/** Short confirmation tones (no audio files needed) */
let audioCtx = null;
export const playTone = (kind = 'success') => {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    const notes = kind === 'success' ? [880, 1320] : kind === 'warn' ? [660] : [220, 180];
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.0001, audioCtx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + i * 0.15 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + i * 0.15 + 0.14);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + i * 0.15);
      osc.stop(audioCtx.currentTime + i * 0.15 + 0.15);
    });
  } catch (_) { /* audio not available */ }
};

/** Labels for scan log actions */
export const SCAN_ACTION_LABELS = {
  check_in: 'Check-in',
  check_out: 'Check-out',
  leave_start: 'Special leave – out',
  leave_end: 'Special leave – back'
};

const KIND_BY_ACTION = { check_in: 'in', check_out: 'out', leave_start: 'leave', leave_end: 'back' };
export const SUCCESS_KINDS = ['in', 'out', 'leave', 'back'];

/** Current IST time as minutes since midnight */
export const istMinutesNow = () => {
  const [h, m] = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })
    .format(new Date()).split(':').map((n) => parseInt(n, 10));
  return (h % 24) * 60 + m;
};

export const hhmmToMinutes = (v) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(v || ''));
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : 14 * 60;
};

export const hhmmLabel = (v) => {
  const mins = hhmmToMinutes(v);
  const h = Math.floor(mins / 60);
  return `${h % 12 || 12}:${String(mins % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

/** Normalise a scan API response / error into one shape for the UI */
export const toScanResult = (resOrErr) => {
  if (resOrErr?.data?.success) {
    const d = resOrErr.data;
    return {
      kind: KIND_BY_ACTION[d.action] || 'in',
      action: d.action,
      message: d.message,
      employee: d.employee,
      attendance: d.attendance,
      specialLeave: d.special_leave || null
    };
  }
  const data = resOrErr?.response?.data;
  if (data) {
    return {
      kind: data.duplicate ? 'warn' : 'error',
      code: data.code,
      message: data.message || 'Scan failed',
      employee: data.employee || null
    };
  }
  return { kind: 'error', message: 'Cannot reach the server. Check the internet connection.' };
};
