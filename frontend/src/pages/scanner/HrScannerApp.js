import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiCamera, FiUser, FiUsers, FiEdit3, FiClock, FiLogOut, FiRefreshCw, FiSearch, FiDownload, FiType, FiCheckCircle, FiUserX, FiEye, FiEyeOff
} from 'react-icons/fi';
import QrScanner from '../../components/smartAttendance/QrScanner';
import FaceScanner from '../../components/smartAttendance/FaceScanner';
import FaceEnrollModal from '../../components/smartAttendance/FaceEnrollModal';
import CorrectionPanel from '../../components/smartAttendance/CorrectionPanel';
import ScanResultCard from '../../components/smartAttendance/ScanResultCard';
import ScanModeBar, { MODE_META } from '../../components/smartAttendance/ScanModeBar';
import {
  hrApi, getHrUser, saveHrSession, clearHrSession, isHrScannerRole, playTone, toScanResult, safeStorage, HR_TOKEN_KEY,
  SUCCESS_KINDS, SCAN_ACTION_LABELS
} from '../../services/scannerApi';

/* ─── PWA wiring: swap the manifest so "Add to Home Screen" installs the scanner ─── */
const usePwaManifest = () => {
  useEffect(() => {
    const link = document.querySelector('link[rel="manifest"]');
    const previous = link?.getAttribute('href');
    if (link) link.setAttribute('href', '/scanner-manifest.json');
    let theme = document.querySelector('meta[name="theme-color"]');
    const prevTheme = theme?.getAttribute('content');
    if (!theme) {
      theme = document.createElement('meta');
      theme.setAttribute('name', 'theme-color');
      document.head.appendChild(theme);
    }
    theme.setAttribute('content', '#0E1320');
    const prevTitle = document.title;
    document.title = 'HR Scanner';
    if ('serviceWorker' in navigator && window.isSecureContext) {
      navigator.serviceWorker.register('/scanner-sw.js', { scope: '/scanner' }).catch(() => {});
    }
    return () => {
      if (link && previous) link.setAttribute('href', previous);
      if (prevTheme) theme.setAttribute('content', prevTheme);
      document.title = prevTitle;
    };
  }, []);
};

const useInstallPrompt = () => {
  const [promptEvent, setPromptEvent] = useState(null);
  useEffect(() => {
    const handler = (e) => { e.preventDefault(); setPromptEvent(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  const install = async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice.catch(() => {});
    setPromptEvent(null);
  };
  return { canInstall: !!promptEvent, install };
};

/* ─── Login ─── */
const HrLogin = ({ onLoggedIn }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!username || !password) { setError('Enter username and password'); return; }
    setBusy(true);
    try {
      const res = await hrApi.post('/auth/admin/login', {
        username: username.trim(),
        password,
        browser_info: navigator.userAgent,
        device_info: 'HR Scanner App'
      });
      const user = res.data.user;
      if (!isHrScannerRole(user?.role)) {
        setError('This app is only for HR Scanner accounts. Admins please use the admin panel.');
        return;
      }
      saveHrSession(res.data.token, user);
      onLoggedIn(user);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-admin-bg px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-5 rounded-3xl border border-admin-border bg-admin-elevated p-6 shadow-2xl">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/20 text-blue-400"><FiCamera size={26} /></div>
          <h1 className="text-xl font-extrabold text-admin-heading">HR Scanner</h1>
          <p className="mt-1 text-xs text-admin-muted">Scan employee ID cards or faces to mark attendance</p>
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-admin-secondary">Username or email</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" className="admin-input w-full py-3 text-sm" />
        </div>
        <div>
          <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-admin-secondary">Password</label>
          <div className="relative">
            <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="admin-input w-full py-3 pr-10 text-sm" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-muted" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <FiEyeOff /> : <FiEye />}
            </button>
          </div>
        </div>
        {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-400">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-[11px] text-admin-muted">HR Scanner accounts are created by the Super Admin in Admin Management.</p>
      </form>
    </div>
  );
};

/* ─── Scan tab ─── */
const ScanTab = ({ onEnrollFace, onScanned, checkoutStartsAt }) => {
  const [mode, setMode] = useState(() => safeStorage.get('hr_scanner_mode') || 'card');
  // auto | check_in | check_out | special_leave (manual modes apply to one scan only)
  const [scanMode, setScanMode] = useState('auto');
  const [faceFacing, setFaceFacing] = useState('environment');
  const [result, setResult] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const dismissTimer = useRef(null);

  useEffect(() => { safeStorage.set('hr_scanner_mode', mode); }, [mode]);
  useEffect(() => () => clearTimeout(dismissTimer.current), []);

  const showResult = useCallback(async (r) => {
    const ok = SUCCESS_KINDS.includes(r.kind);
    setResult(r);
    setPhoto(null);
    if (ok) setScanMode('auto');
    playTone(ok ? 'success' : r.kind === 'warn' ? 'warn' : 'error');
    if (navigator.vibrate) navigator.vibrate(r.kind === 'error' ? [80, 60, 80] : 120);
    onScanned?.();
    // Show the registered photo so HR can confirm the card holder is the right person
    if (r.employee?.employee_id && r.employee.face_registered !== false) {
      hrApi.get(`/smart-attendance/faces/${encodeURIComponent(r.employee.employee_id)}/photo`)
        .then((res) => setPhoto(res.data.photo || null)).catch(() => {});
    }
    clearTimeout(dismissTimer.current);
    const needsAction = r.employee && r.employee.face_registered === false && ok;
    if (!needsAction) dismissTimer.current = setTimeout(() => setResult(null), r.kind === 'error' ? 5000 : 3500);
  }, [onScanned]);

  const submitCode = useCallback(async (text, format = '') => {
    const method = /qr/i.test(format) || /^ATTN:/i.test(text) ? 'qr' : 'barcode';
    try {
      const res = await hrApi.post('/smart-attendance/hr/scan', { method, code: text, mode: scanMode });
      await showResult(toScanResult(res));
    } catch (err) {
      await showResult(toScanResult(err));
    }
  }, [showResult, scanMode]);

  const submitFace = useCallback(async (descriptor) => {
    try {
      const res = await hrApi.post('/smart-attendance/hr/scan', { method: 'face', descriptor, mode: scanMode });
      await showResult(toScanResult(res));
    } catch (err) {
      await showResult(toScanResult(err));
    }
  }, [showResult, scanMode]);

  const submitManual = async (e) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    await submitCode(manualCode.trim(), 'manual');
    setManualCode('');
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-2xl bg-admin-surface p-1">
        {[{ id: 'card', label: 'ID Card / QR', Icon: FiCamera }, { id: 'face', label: 'Face', Icon: FiUser }].map(({ id, label, Icon }) => (
          <button key={id} type="button" onClick={() => { setResult(null); setMode(id); }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold ${mode === id ? 'bg-blue-600 text-white' : 'text-admin-secondary'}`}>
            <Icon /> {label}
          </button>
        ))}
      </div>

      <ScanModeBar mode={scanMode} onChange={(m) => { setResult(null); setScanMode(m); }} checkoutStartsAt={checkoutStartsAt} />

      <div className={`relative rounded-3xl transition-shadow ${scanMode !== 'auto' ? `ring-4 ring-offset-2 ring-offset-admin-bg ${MODE_META[scanMode].frame}` : ''}`}>
        {scanMode !== 'auto' && !result && (
          <div className={`pointer-events-none absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${MODE_META[scanMode].active}`}>
            {React.createElement(MODE_META[scanMode].Icon, { 'aria-hidden': true })} {MODE_META[scanMode].label} scan
          </div>
        )}
        {mode === 'card' ? (
          <QrScanner onScan={submitCode} paused={!!result} facingMode="environment" className="aspect-square" />
        ) : (
          <FaceScanner key={faceFacing} onFace={submitFace} paused={!!result} facingMode={faceFacing} />
        )}
        <ScanResultCard result={result} photo={photo} onDismiss={() => setResult(null)} onEnrollFace={(emp) => { setResult(null); onEnrollFace(emp); }} />
      </div>

      <div className="flex gap-2">
        {mode === 'face' && (
          <button type="button" onClick={() => setFaceFacing((f) => (f === 'user' ? 'environment' : 'user'))}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-admin-border py-2.5 text-xs font-bold text-admin-secondary">
            <FiRefreshCw /> {faceFacing === 'user' ? 'Use back camera' : 'Use front camera'}
          </button>
        )}
        <button type="button" onClick={() => setManualOpen((o) => !o)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-admin-border py-2.5 text-xs font-bold text-admin-secondary">
          <FiType /> Type ID / code
        </button>
      </div>

      {manualOpen && (
        <form onSubmit={submitManual} className="flex gap-2">
          <input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Employee ID or card code" autoCapitalize="characters" className="admin-input flex-1 py-2.5 text-sm" />
          <button type="submit" className="rounded-xl bg-blue-600 px-4 text-sm font-bold text-white">Mark</button>
        </form>
      )}
    </div>
  );
};

/* ─── Faces tab ─── */
const FacesTab = ({ onEnrollFace, refreshKey }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('missing');

  useEffect(() => {
    setLoading(true);
    hrApi.get('/smart-attendance/employees').then((r) => setEmployees(r.data.employees || [])).catch(() => {}).finally(() => setLoading(false));
  }, [refreshKey]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees
      .filter((e) => (filter === 'missing' ? !e.face_registered : filter === 'done' ? e.face_registered : true))
      .filter((e) => !q || e.name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q));
  }, [employees, search, filter]);

  const missing = employees.filter((e) => !e.face_registered).length;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-admin-border bg-admin-surface p-3 text-xs text-admin-secondary">
        <b className="text-admin-text">{employees.length - missing}</b> of <b className="text-admin-text">{employees.length}</b> employees have a face photo.
        {missing > 0 && <span className="text-amber-400"> {missing} still need one.</span>}
      </div>
      <div className="relative">
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-admin-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or ID" className="admin-input admin-input-has-prefix w-full py-2.5 text-sm" />
      </div>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-admin-surface p-1 text-xs font-bold">
        {[['missing', 'No photo'], ['done', 'Registered'], ['all', 'All']].map(([id, label]) => (
          <button key={id} type="button" onClick={() => setFilter(id)} className={`rounded-lg py-2 ${filter === id ? 'bg-blue-600 text-white' : 'text-admin-secondary'}`}>{label}</button>
        ))}
      </div>
      {loading ? <p className="py-6 text-center text-xs text-admin-muted">Loading…</p> : (
        <ul className="divide-y divide-admin-border overflow-hidden rounded-2xl border border-admin-border">
          {list.length === 0 && <li className="p-4 text-center text-xs text-admin-muted">Nothing to show</li>}
          {list.map((e) => (
            <li key={e.employee_id} className="flex items-center justify-between gap-3 bg-admin-elevated px-3 py-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-bold text-admin-text">{e.name}</div>
                <div className="text-xs text-admin-muted">{e.employee_id}{e.department_name ? ` · ${e.department_name}` : ''}</div>
                {e.face_registered ? (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400"><FiCheckCircle /> Face registered</span>
                ) : (
                  <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-amber-400"><FiUserX /> No photo – please scan</span>
                )}
              </div>
              <button type="button" onClick={() => onEnrollFace(e)} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-bold ${e.face_registered ? 'border border-admin-border text-admin-secondary' : 'bg-blue-600 text-white'}`}>
                {e.face_registered ? 'Re-scan' : 'Scan photo'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ─── History tab ─── */
const STATUS_STYLE = {
  success: 'bg-emerald-500/15 text-emerald-400',
  duplicate: 'bg-amber-500/15 text-amber-400',
  rejected: 'bg-red-500/15 text-red-400'
};

const timeOf = (ts) => {
  if (!ts) return '';
  const t = String(ts).split('T')[1] || '';
  let [h, m] = t.split(':');
  h = parseInt(h, 10);
  return Number.isNaN(h) ? '' : `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
};

const HistoryTab = ({ refreshKey }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    hrApi.get('/smart-attendance/logs', { params: { mine: 'true', limit: 200 } })
      .then((r) => setLogs(r.data.logs || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-admin-secondary">My scans today</h3>
        <button type="button" onClick={load} className="flex items-center gap-1 text-xs font-bold text-blue-400"><FiRefreshCw /> Refresh</button>
      </div>
      {loading ? <p className="py-6 text-center text-xs text-admin-muted">Loading…</p> : (
        <ul className="space-y-2">
          {logs.length === 0 && <li className="rounded-2xl border border-admin-border p-4 text-center text-xs text-admin-muted">No scans yet today</li>}
          {logs.map((l) => (
            <li key={l.id} className="rounded-2xl border border-admin-border bg-admin-elevated p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-bold text-admin-text">{l.employee_name || 'Unknown'}</span>
                <span className="shrink-0 text-xs text-admin-muted">{timeOf(l.created_at_ist)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold">
                <span className={`rounded-full px-2 py-0.5 ${STATUS_STYLE[l.status] || STATUS_STYLE.rejected}`}>
                  {l.status === 'success' ? (SCAN_ACTION_LABELS[l.action] || 'Check-in') : l.status}
                </span>
                <span className="rounded-full bg-admin-surface px-2 py-0.5 uppercase text-admin-secondary">{l.method}</span>
              </div>
              {l.status !== 'success' && <p className="mt-1 text-xs text-admin-muted">{l.message}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ─── App shell ─── */
const TABS = [
  { id: 'scan', label: 'Scan', Icon: FiCamera },
  { id: 'faces', label: 'Faces', Icon: FiUsers },
  { id: 'correct', label: 'Correct', Icon: FiEdit3 },
  { id: 'history', label: 'History', Icon: FiClock }
];

const HrScannerApp = () => {
  usePwaManifest();
  const { canInstall, install } = useInstallPrompt();
  const [user, setUser] = useState(() => (safeStorage.get(HR_TOKEN_KEY) ? getHrUser() : null));
  const [tab, setTab] = useState('scan');
  const [enrollEmployee, setEnrollEmployee] = useState(null);
  const [stats, setStats] = useState(null);
  const [rules, setRules] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sessionError, setSessionError] = useState('');

  useEffect(() => {
    const handler = () => { setUser(null); setSessionError('Your session expired. Please sign in again.'); };
    window.addEventListener('hrScannerSessionExpired', handler);
    return () => window.removeEventListener('hrScannerSessionExpired', handler);
  }, []);

  const loadSession = useCallback(() => {
    hrApi.get('/smart-attendance/hr/session')
      .then((r) => { setStats(r.data.stats); if (r.data.rules) setRules(r.data.rules); })
      .catch((err) => {
        if (err.response?.status === 403) {
          clearHrSession();
          setUser(null);
          setSessionError(err.response?.data?.message || 'Access denied');
        }
      });
  }, []);

  useEffect(() => { if (user) loadSession(); }, [user, loadSession, refreshKey]);

  const logout = () => {
    clearHrSession();
    setUser(null);
  };

  if (!user) {
    return (
      <div className="admin-theme-dark">
        {sessionError && <div className="fixed inset-x-0 top-0 z-50 bg-amber-500 p-2 text-center text-xs font-bold text-black">{sessionError}</div>}
        <HrLogin onLoggedIn={(u) => { setSessionError(''); setUser(u); }} />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-admin-bg text-admin-text">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-admin-border bg-admin-elevated/95 px-4 py-3 backdrop-blur" style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}>
        <div>
          <div className="text-sm font-extrabold text-admin-heading">HR Scanner</div>
          <div className="text-[11px] text-admin-muted">
            {user.username}
            {stats && <> · In {stats.check_ins} · Out {stats.check_outs}{Number(stats.special_leaves) > 0 && <> · Leave {stats.special_leaves}</>}</>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canInstall && (
            <button type="button" onClick={install} className="flex items-center gap-1 rounded-xl bg-blue-600/20 px-3 py-2 text-xs font-bold text-blue-300"><FiDownload /> Install</button>
          )}
          <button type="button" onClick={logout} className="rounded-xl border border-admin-border p-2 text-admin-secondary" aria-label="Sign out"><FiLogOut /></button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-28 pt-4">
        {tab === 'scan' && <ScanTab onEnrollFace={setEnrollEmployee} onScanned={() => setRefreshKey((k) => k + 1)} checkoutStartsAt={rules?.checkoutStartsAt} />}
        {tab === 'faces' && <FacesTab onEnrollFace={setEnrollEmployee} refreshKey={refreshKey} />}
        {tab === 'correct' && (
          <div className="rounded-3xl border border-admin-border bg-admin-elevated p-4">
            <h2 className="mb-1 text-sm font-bold text-admin-text">Correct attendance</h2>
            <p className="mb-4 text-xs text-admin-muted">Fix a missed or wrong scan. A reason note is always required and is saved with your name.</p>
            <CorrectionPanel client={hrApi} />
          </div>
        )}
        {tab === 'history' && <HistoryTab refreshKey={refreshKey} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-admin-border bg-admin-elevated/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto grid max-w-xl grid-cols-4">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`flex flex-col items-center gap-1 py-3 text-[11px] font-bold ${tab === id ? 'text-blue-400' : 'text-admin-muted'}`}>
              <Icon size={20} /> {label}
            </button>
          ))}
        </div>
      </nav>

      {enrollEmployee && (
        <FaceEnrollModal
          client={hrApi}
          employee={enrollEmployee}
          allowUpload={false}
          onClose={() => setEnrollEmployee(null)}
          onSaved={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
};

export default HrScannerApp;
