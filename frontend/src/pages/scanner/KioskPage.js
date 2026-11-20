import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FiCreditCard, FiUser, FiCamera, FiMaximize, FiSettings, FiWifiOff } from 'react-icons/fi';
import QrScanner from '../../components/smartAttendance/QrScanner';
import FaceScanner from '../../components/smartAttendance/FaceScanner';
import ScanResultCard from '../../components/smartAttendance/ScanResultCard';
import ScanModeBar, { MODE_META } from '../../components/smartAttendance/ScanModeBar';
import { kioskApi, safeStorage, KIOSK_KEY, playTone, toScanResult, SUCCESS_KINDS, hhmmLabel } from '../../services/scannerApi';

/** A manual mode (Check-in / Check-out / Special leave) falls back to Auto after this long without a scan */
const MANUAL_MODE_SECONDS = 30;

/**
 * Entrance kiosk (PC / tablet).
 *  - "card": USB / Bluetooth barcode scanner (acts like a keyboard) and/or webcam QR
 *  - "face": webcam face recognition
 *  - "both": both side by side
 * Paired once with a kiosk key created by an admin in Smart Attendance → Kiosks.
 */

const useClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
};

/**
 * Listens for keyboard-wedge barcode scanners. Scanners "type" very fast and
 * finish with Enter; slow human typing is ignored so nobody can type someone
 * else's ID on an unattended kiosk.
 */
const useBarcodeWedge = (onCode, enabled) => {
  const bufferRef = useRef({ chars: '', first: 0, last: 0 });
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const now = Date.now();
      const buf = bufferRef.current;
      if (now - buf.last > 120) { buf.chars = ''; buf.first = now; }
      buf.last = now;
      if (e.key === 'Enter') {
        const code = buf.chars.trim();
        const avgGap = code.length > 1 ? (now - buf.first) / code.length : Infinity;
        buf.chars = '';
        if (code.length >= 3 && avgGap < 60) {
          e.preventDefault();
          onCodeRef.current(code);
        }
        return;
      }
      if (e.key.length === 1) buf.chars += e.key;
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [enabled]);
};

const KioskSetup = ({ onPaired, error }) => {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(error || '');

  const submit = async (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    setMsg('');
    safeStorage.set(KIOSK_KEY, key.trim());
    try {
      const r = await kioskApi.get('/smart-attendance/kiosk/session');
      onPaired(r.data.kiosk, r.data.rules);
    } catch (err) {
      safeStorage.remove(KIOSK_KEY);
      setMsg(err.response?.data?.message || 'Could not verify the kiosk key. Check the internet connection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-admin-bg p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl border border-admin-border bg-admin-elevated p-6">
        <div className="text-center">
          <FiSettings className="mx-auto mb-2 text-blue-400" size={32} />
          <h1 className="text-xl font-extrabold text-admin-heading">Set up attendance kiosk</h1>
          <p className="mt-1 text-xs text-admin-muted">An admin creates the kiosk key in <b>Admin → Smart Attendance → Kiosks</b>. Paste it here once; this device remembers it.</p>
        </div>
        <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="KSK-…" className="admin-input w-full py-3 font-mono text-sm" autoFocus />
        {msg && <p className="rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-400">{msg}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-50">{busy ? 'Checking…' : 'Pair this device'}</button>
      </form>
    </div>
  );
};

const KioskPage = () => {
  const [kiosk, setKiosk] = useState(null);
  const [checking, setChecking] = useState(true);
  const [setupError, setSetupError] = useState('');
  const [result, setResult] = useState(null);
  const [cameraQr, setCameraQr] = useState(() => safeStorage.get('kiosk_camera_qr') === '1');
  const [online, setOnline] = useState(navigator.onLine);
  const [rules, setRules] = useState(null);
  const [scanMode, setScanMode] = useState('auto');
  const [secondsLeft, setSecondsLeft] = useState(null);
  const scanModeRef = useRef('auto');
  scanModeRef.current = scanMode;
  const dismissRef = useRef(null);
  const busyRef = useRef(false);
  const now = useClock();

  // Manual modes are one-shot and time out, so an unattended kiosk never stays in Check-out mode
  useEffect(() => {
    if (scanMode === 'auto') { setSecondsLeft(null); return undefined; }
    setSecondsLeft(MANUAL_MODE_SECONDS);
    const t = setInterval(() => setSecondsLeft((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [scanMode]);
  useEffect(() => { if (secondsLeft === 0) setScanMode('auto'); }, [secondsLeft]);

  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Attendance Kiosk';
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      document.title = prevTitle;
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  useEffect(() => {
    if (!safeStorage.get(KIOSK_KEY)) { setChecking(false); return; }
    kioskApi.get('/smart-attendance/kiosk/session')
      .then((r) => { setKiosk(r.data.kiosk); setRules(r.data.rules || null); })
      .catch((err) => {
        if (err.response?.status === 401) {
          safeStorage.remove(KIOSK_KEY);
          setSetupError(err.response.data?.message || 'Kiosk key is no longer valid.');
        } else {
          setSetupError('Cannot reach the server. It will retry when you pair again.');
        }
      })
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => { safeStorage.set('kiosk_camera_qr', cameraQr ? '1' : '0'); }, [cameraQr]);
  useEffect(() => () => clearTimeout(dismissRef.current), []);

  const show = useCallback((r) => {
    const ok = SUCCESS_KINDS.includes(r.kind);
    setResult(r);
    if (ok) setScanMode('auto');
    playTone(ok ? 'success' : r.kind === 'warn' ? 'warn' : 'error');
    clearTimeout(dismissRef.current);
    dismissRef.current = setTimeout(() => setResult(null), r.kind === 'error' ? 5000 : 4000);
  }, []);

  const scan = useCallback(async (payload) => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const res = await kioskApi.post('/smart-attendance/kiosk/scan', { ...payload, mode: scanModeRef.current });
      show(toScanResult(res));
    } catch (err) {
      if (err.response?.status === 401) {
        safeStorage.remove(KIOSK_KEY);
        setKiosk(null);
        setSetupError(err.response.data?.message || 'Kiosk key is no longer valid.');
        return;
      }
      show(toScanResult(err));
    } finally {
      busyRef.current = false;
    }
  }, [show]);

  const cardEnabled = !!kiosk && (kiosk.mode === 'card' || kiosk.mode === 'both');
  const faceEnabled = !!kiosk && (kiosk.mode === 'face' || kiosk.mode === 'both');

  useBarcodeWedge((code) => scan({ method: /^ATTN:/i.test(code) ? 'qr' : 'barcode', code }), cardEnabled && !result);

  if (checking) return <div className="flex min-h-[100dvh] items-center justify-center bg-admin-bg text-admin-muted">Loading…</div>;
  if (!kiosk) return <KioskSetup onPaired={(k, r) => { setSetupError(''); setKiosk(k); setRules(r || null); }} error={setupError} />;

  const checkoutStartsAt = rules?.checkoutStartsAt || '14:00';
  const frame = scanMode !== 'auto' ? `rounded-3xl ring-4 ring-offset-4 ring-offset-admin-bg ${MODE_META[scanMode].frame}` : '';
  const cardHint = scanMode === 'auto'
    ? `Before ${hhmmLabel(checkoutStartsAt)} = check-in · from ${hhmmLabel(checkoutStartsAt)} = check-out`
    : scanMode === 'special_leave'
      ? 'Special leave: scan when going out, and again when you come back'
      : `${MODE_META[scanMode].label} mode: scan your card now`;

  const timeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' });

  const fullscreen = () => {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
  };

  return (
    <div className="relative flex min-h-[100dvh] flex-col bg-admin-bg text-admin-text">
      <header className="flex items-center justify-between px-6 py-4">
        <div>
          <div className="text-4xl font-extrabold tabular-nums text-admin-heading lg:text-5xl">{timeStr}</div>
          <div className="text-sm text-admin-muted">{dateStr}</div>
        </div>
        <div className="flex items-center gap-3 text-right">
          {!online && <span className="flex items-center gap-1 rounded-full bg-red-500/20 px-3 py-1 text-xs font-bold text-red-300"><FiWifiOff /> Offline</span>}
          <div>
            <div className="text-sm font-bold text-admin-text">{kiosk.name}</div>
            <div className="text-xs text-admin-muted">Attendance kiosk</div>
          </div>
          <button type="button" onClick={fullscreen} className="rounded-xl border border-admin-border p-2 text-admin-secondary" aria-label="Full screen"><FiMaximize /></button>
        </div>
      </header>

      <div className="px-6 pb-5">
        <ScanModeBar
          mode={scanMode}
          onChange={(m) => {
            // Drop focus so a USB scanner's Enter key can never press a mode button
            if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
            setResult(null);
            setScanMode(m);
          }}
          checkoutStartsAt={checkoutStartsAt}
          large
          secondsLeft={secondsLeft}
        />
      </div>

      <main className={`grid flex-1 gap-6 px-6 pb-6 ${cardEnabled && faceEnabled ? 'lg:grid-cols-2' : ''}`}>
        {faceEnabled && (
          <section className={`flex flex-col ${frame}`}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-admin-text"><FiUser className="text-blue-400" /> Look at the camera</h2>
            <FaceScanner onFace={(descriptor) => scan({ method: 'face', descriptor })} paused={!!result} facingMode="user" large className="flex-1" minFaceRatio={0.15} />
          </section>
        )}
        {cardEnabled && (
          <section className={`flex flex-col ${frame}`}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-admin-text"><FiCreditCard className="text-blue-400" /> Scan your ID card</h2>
            {cameraQr ? (
              <QrScanner onScan={(text, format) => scan({ method: /qr/i.test(format) || /^ATTN:/i.test(text) ? 'qr' : 'barcode', code: text })} paused={!!result} facingMode="user" className="flex-1" />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-blue-500/40 bg-blue-500/5 p-10 text-center">
                <FiCreditCard className="mb-4 animate-pulse text-blue-400" size={96} />
                <p className="text-2xl font-bold text-admin-heading">Hold your ID card under the scanner</p>
                <p className="mt-2 text-sm text-admin-muted">{cardHint}</p>
              </div>
            )}
            <button type="button" onClick={() => setCameraQr((v) => !v)} className="mt-3 flex items-center justify-center gap-2 self-center rounded-xl border border-admin-border px-4 py-2 text-xs font-bold text-admin-secondary">
              <FiCamera /> {cameraQr ? 'Use USB barcode scanner instead' : 'No USB scanner? Use the webcam to read QR'}
            </button>
          </section>
        )}
      </main>

      <footer className="px-6 pb-4 text-center text-xs text-admin-muted">
        Face or card not recognised? Please contact HR to upload or scan your photo.
      </footer>

      {result && (
        <div className="fixed inset-0 z-40 bg-black/60">
          <ScanResultCard result={result} large onDismiss={() => setResult(null)} showEnrollPrompt />
        </div>
      )}
    </div>
  );
};

export default KioskPage;
