import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FiActivity, FiCreditCard, FiEdit3, FiMonitor, FiRefreshCw, FiSearch, FiMail, FiPrinter, FiDownload,
  FiCamera, FiUpload, FiTrash2, FiUserX, FiCheckCircle, FiCopy, FiPlus, FiExternalLink, FiSmartphone, FiX, FiImage
} from 'react-icons/fi';
import Sidebar from '../components/Sidebar';
import AdminToast from '../components/AdminToast';
import ConfirmDialog from '../components/ConfirmDialog';
import { Spinner } from '../components/Loader';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import FaceEnrollModal from '../components/smartAttendance/FaceEnrollModal';
import CorrectionPanel, { formatNoteTime } from '../components/smartAttendance/CorrectionPanel';

const PAGE_KEY = 'attendance_scanner';

const TABS = [
  { id: 'live', label: 'Live Scans', Icon: FiActivity },
  { id: 'badges', label: 'QR Badges & Faces', Icon: FiCreditCard },
  { id: 'corrections', label: 'Corrections & Notes', Icon: FiEdit3 },
  { id: 'kiosks', label: 'Kiosks & Settings', Icon: FiMonitor }
];

const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const timeOf = (ts) => {
  if (!ts) return '—';
  const t = String(ts).split('T')[1] || '';
  let [h, m] = t.split(':');
  h = parseInt(h, 10);
  return Number.isNaN(h) ? '—' : `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
};

const errMsg = (e, fallback) => e?.response?.data?.message || e?.userMessage || e?.message || fallback;

const STATUS_STYLE = {
  success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  duplicate: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  rejected: 'bg-red-500/15 text-red-400 border-red-500/30'
};

const Card = ({ children, className = '' }) => (
  <div className={`rounded-2xl border border-admin-border bg-admin-elevated ${className}`}>{children}</div>
);

const Stat = ({ label, value, color = 'text-admin-heading' }) => (
  <Card className="p-4">
    <div className="text-[10px] font-bold uppercase tracking-wider text-admin-muted">{label}</div>
    <div className={`mt-1 text-2xl font-extrabold ${color}`}>{value ?? '—'}</div>
  </Card>
);

/* ─────────────────────────── Live scans ─────────────────────────── */
const LiveTab = () => {
  const [date, setDate] = useState(todayIST());
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [l, s] = await Promise.all([
        api.get('/smart-attendance/logs', { params: { date, status: status || undefined, limit: 500 } }),
        api.get('/smart-attendance/stats', { params: { date } })
      ]);
      setLogs(l.data.logs || []);
      setStats(s.data);
    } catch (_) { /* toast handled globally */ } finally {
      setLoading(false);
    }
  }, [date, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (date !== todayIST()) return undefined;
    const t = setInterval(() => load(true), 20000);
    return () => clearInterval(t);
  }, [date, load]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Check-ins" value={stats?.scans?.check_ins} color="text-emerald-400" />
        <Stat label="Check-outs" value={stats?.scans?.check_outs} color="text-sky-400" />
        <Stat label="Rejected" value={stats?.scans?.rejected} color="text-red-400" />
        <Stat label="Face / Card scans" value={stats ? `${stats.scans.face_scans} / ${stats.scans.card_scans}` : null} />
        <Stat label="Faces registered" value={stats ? `${stats.coverage.faces_registered} / ${stats.coverage.active_employees}` : null} color="text-blue-400" />
        <Stat label="QR badges" value={stats ? `${stats.coverage.badges_generated} / ${stats.coverage.active_employees}` : null} color="text-purple-400" />
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-admin-border p-4 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-bold text-admin-text">Scan log {date === todayIST() && <span className="ml-2 text-[10px] font-semibold text-emerald-400">● live</span>}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto' }} className="admin-input py-2 text-xs" />
            <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 'auto' }} className="admin-select py-2 text-xs text-admin-text">
              <option value="">All results</option>
              <option value="success">Success</option>
              <option value="duplicate">Duplicate / already done</option>
              <option value="rejected">Rejected</option>
            </select>
            <button type="button" onClick={() => load()} className="flex items-center gap-1 rounded-xl border border-admin-border px-3 py-2 text-xs font-bold text-admin-secondary hover:bg-admin-surface"><FiRefreshCw /> Refresh</button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="bg-admin-surface text-[10px] uppercase tracking-wider text-admin-muted">
              <tr>{['Time', 'Employee', 'Result', 'Method', 'Source', 'Message'].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {loading && <tr><td colSpan={6} className="p-8 text-center"><Spinner /></td></tr>}
              {!loading && logs.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-admin-muted">No scans for this date</td></tr>}
              {!loading && logs.map((l) => (
                <tr key={l.id} className="text-admin-secondary hover:bg-admin-surface/60">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-admin-text">{timeOf(l.created_at_ist)}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-admin-text">{l.employee_name || 'Unknown'}</div>
                    <div className="text-[10px] text-admin-muted">{l.employee_id || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[l.status] || STATUS_STYLE.rejected}`}>
                      {l.status === 'success' ? (l.action === 'check_out' ? 'Check-out' : 'Check-in') : l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 uppercase">{l.method}{l.method === 'face' && l.match_distance != null ? <span className="ml-1 normal-case text-admin-muted">({Number(l.match_distance).toFixed(2)})</span> : null}</td>
                  <td className="px-4 py-3">{l.source === 'kiosk' ? `Kiosk: ${l.kiosk_name || '—'}` : `HR: ${l.scanned_by_name || '—'}`}</td>
                  <td className="max-w-[360px] px-4 py-3 text-admin-muted">{l.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

/* ─────────────────────────── Badges & faces ─────────────────────────── */
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const printBadges = (badges, win) => {
  const cards = badges.map((b) => `
    <div class="card">
      <div class="name">${escapeHtml(b.employee.name)}</div>
      <div class="meta">${escapeHtml(b.employee.employee_id)}${b.employee.department_name ? ` · ${escapeHtml(b.employee.department_name)}` : ''}</div>
      <img class="qr" src="${b.qr}" alt="QR" />
      <img class="bar" src="${b.barcode}" alt="Barcode" />
    </div>`).join('');
  const doc = win.document;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Attendance ID badges</title>
    <style>
      @page { margin: 10mm; }
      body { font-family: Arial, Helvetica, sans-serif; margin: 0; }
      .grid { display: flex; flex-wrap: wrap; gap: 6mm; }
      .card { width: 54mm; height: 85.6mm; border: 1px solid #cbd5e1; border-radius: 3mm; box-sizing: border-box; padding: 4mm 3mm;
              display: flex; flex-direction: column; align-items: center; justify-content: space-between; page-break-inside: avoid; }
      .name { font-weight: bold; font-size: 11pt; text-align: center; }
      .meta { font-size: 8pt; color: #475569; text-align: center; }
      .qr { width: 38mm; height: 38mm; }
      .bar { width: 48mm; height: auto; }
    </style></head><body><div class="grid">${cards}</div>
    <script>window.onload = function () { setTimeout(function () { window.print(); }, 300); };</script>
    </body></html>`);
  doc.close();
};

const downloadDataUrl = (dataUrl, filename) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const BadgeModal = ({ employeeId, onClose, canEdit, notify, askConfirm }) => {
  const [badge, setBadge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState('official');
  const [busy, setBusy] = useState('');
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/smart-attendance/badges/${encodeURIComponent(employeeId)}`);
      setBadge(r.data);
    } catch (e) {
      notify(errMsg(e, 'Could not load the QR code'), 'error');
      onCloseRef.current();
    } finally {
      setLoading(false);
    }
  }, [employeeId, notify]);

  useEffect(() => { load(); }, [load]);

  const email = async () => {
    setBusy('email');
    try {
      const r = await api.post(`/smart-attendance/badges/${encodeURIComponent(employeeId)}/email`, { target });
      notify(r.data.message, 'success');
      load();
    } catch (e) {
      notify(errMsg(e, 'Email failed'), 'error');
    } finally {
      setBusy('');
    }
  };

  const regenerate = () => askConfirm({
    title: 'Issue a new QR code?',
    message: 'The current card / QR will stop working immediately. Use this if the card was lost or shared.',
    confirmText: 'Generate new code',
    type: 'warning',
    onConfirm: async () => {
      setBusy('regen');
      try {
        const r = await api.post(`/smart-attendance/badges/${encodeURIComponent(employeeId)}/regenerate`);
        setBadge(r.data);
        notify(r.data.message, 'success');
      } catch (e) {
        notify(errMsg(e, 'Could not regenerate'), 'error');
      } finally {
        setBusy('');
      }
    }
  });

  const print = () => {
    const win = window.open('', '_blank', 'width=480,height=640');
    if (!win) { notify('Allow pop-ups to print the badge', 'error'); return; }
    printBadges([badge], win);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-admin-overlay p-4 backdrop-blur-sm">
      <div className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-2xl border border-admin-border bg-admin-elevated shadow-2xl">
        <div className="flex items-center justify-between border-b border-admin-border bg-admin-surface px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-admin-text"><FiCreditCard className="text-blue-400" /> Attendance QR badge</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-admin-secondary hover:bg-admin-elevated" aria-label="Close"><FiX /></button>
        </div>
        {loading || !badge ? <div className="p-10 text-center"><Spinner /></div> : (
          <div className="space-y-4 p-5">
            <div className="mx-auto w-64 rounded-2xl bg-white p-4 text-center text-slate-900 shadow">
              <div className="text-base font-bold">{badge.employee.name}</div>
              <div className="text-xs text-slate-500">{badge.employee.employee_id}{badge.employee.department_name ? ` · ${badge.employee.department_name}` : ''}</div>
              <img src={badge.qr} alt="QR code" className="mx-auto my-3 h-44 w-44" />
              <img src={badge.barcode} alt="Barcode" className="mx-auto w-full" />
            </div>
            <p className="text-center text-[11px] text-admin-muted">
              Code <span className="font-mono text-admin-secondary">{badge.badge_code}</span>
              {badge.last_emailed_at ? ` · emailed ${badge.email_count}×` : ' · not emailed yet'}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => downloadDataUrl(badge.qr, `${badge.employee.employee_id}-qr.png`)} className="flex flex-col items-center gap-1 rounded-xl border border-admin-border py-2.5 text-[11px] font-bold text-admin-secondary hover:bg-admin-surface"><FiDownload /> QR PNG</button>
              <button type="button" onClick={() => downloadDataUrl(badge.barcode, `${badge.employee.employee_id}-barcode.png`)} className="flex flex-col items-center gap-1 rounded-xl border border-admin-border py-2.5 text-[11px] font-bold text-admin-secondary hover:bg-admin-surface"><FiDownload /> Barcode</button>
              <button type="button" onClick={print} className="flex flex-col items-center gap-1 rounded-xl border border-admin-border py-2.5 text-[11px] font-bold text-admin-secondary hover:bg-admin-surface"><FiPrinter /> Print card</button>
            </div>
            {canEdit && (
              <>
                <div className="flex gap-2">
                  <select value={target} onChange={(e) => setTarget(e.target.value)} className="admin-select flex-1 py-2.5 text-xs text-admin-text">
                    <option value="official">Official email{badge.employee.email ? ` (${badge.employee.email})` : ''}</option>
                    <option value="personal" disabled={!badge.employee.personal_email}>Personal email{badge.employee.personal_email ? ` (${badge.employee.personal_email})` : ' (none)'}</option>
                    <option value="both" disabled={!badge.employee.personal_email}>Both</option>
                  </select>
                  <button type="button" onClick={email} disabled={busy === 'email'} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"><FiMail /> {busy === 'email' ? 'Sending…' : 'Send'}</button>
                </div>
                <button type="button" onClick={regenerate} disabled={busy === 'regen'} className="w-full rounded-xl border border-amber-500/40 py-2.5 text-xs font-bold text-amber-400 hover:bg-amber-500/10 disabled:opacity-50">
                  {busy === 'regen' ? 'Generating…' : 'Lost card? Issue a new QR code'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const PhotoModal = ({ employee, onClose }) => {
  const [photo, setPhoto] = useState(undefined);
  useEffect(() => {
    api.get(`/smart-attendance/faces/${encodeURIComponent(employee.employee_id)}/photo`).then((r) => setPhoto(r.data.photo)).catch(() => setPhoto(null));
  }, [employee]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-admin-overlay p-4 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div className="rounded-2xl border border-admin-border bg-admin-elevated p-5 text-center" onClick={(e) => e.stopPropagation()} role="dialog">
        {photo === undefined ? <Spinner /> : photo ? <img src={photo} alt={employee.name} className="h-56 w-56 rounded-2xl object-cover" /> : <p className="p-6 text-xs text-admin-muted">No photo stored</p>}
        <p className="mt-3 text-sm font-bold text-admin-text">{employee.name}</p>
        <p className="text-xs text-admin-muted">{employee.employee_id}</p>
      </div>
    </div>
  );
};

const BadgesTab = ({ notify, askConfirm }) => {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PAGE_KEY, 'can_edit');
  const canDelete = hasPermission(PAGE_KEY, 'can_delete');
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [badgeFor, setBadgeFor] = useState(null);
  const [enroll, setEnroll] = useState(null);
  const [photoFor, setPhotoFor] = useState(null);
  const [job, setJob] = useState(null);
  const [bulkTarget, setBulkTarget] = useState('official');
  const [printing, setPrinting] = useState(false);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/smart-attendance/employees');
      setEmployees(r.data.employees || []);
    } catch (_) { /* global */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => () => clearInterval(pollRef.current), []);

  const pollJob = useCallback(() => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const r = await api.get('/smart-attendance/badges/email-all/status');
        setJob(r.data.job);
        if (!r.data.job.running) {
          clearInterval(pollRef.current);
          notify(`QR emails finished · sent ${r.data.job.sent}, failed ${r.data.job.failed}`, r.data.job.failed ? 'error' : 'success');
          load();
        }
      } catch (_) { clearInterval(pollRef.current); }
    }, 2500);
  }, [load, notify]);

  useEffect(() => {
    api.get('/smart-attendance/badges/email-all/status').then((r) => { if (r.data.job?.running) { setJob(r.data.job); pollJob(); } }).catch(() => {});
  }, [pollJob]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter((e) => {
      if (filter === 'no_face' && e.face_registered) return false;
      if (filter === 'not_emailed' && e.last_emailed_at) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q) || (e.email || '').toLowerCase().includes(q);
    });
  }, [employees, search, filter]);

  const generateAll = async () => {
    try {
      const r = await api.post('/smart-attendance/badges/generate-all');
      notify(r.data.message, 'success');
      load();
    } catch (e) { notify(errMsg(e, 'Failed'), 'error'); }
  };

  const emailAll = (onlyNotSent) => askConfirm({
    title: onlyNotSent ? 'Email QR to employees not yet sent?' : 'Email QR to all active employees?',
    message: `Each employee receives their personal attendance QR code and barcode at their ${bulkTarget === 'both' ? 'official and personal' : bulkTarget} email address.`,
    confirmText: 'Send emails',
    type: 'info',
    onConfirm: async () => {
      try {
        const r = await api.post('/smart-attendance/badges/email-all', { only_not_sent: onlyNotSent, target: bulkTarget });
        setJob(r.data.job);
        notify(r.data.message, 'success');
        pollJob();
      } catch (e) { notify(errMsg(e, 'Could not start'), 'error'); }
    }
  });

  const printAll = async () => {
    const targets = list.slice(0, 200);
    if (targets.length === 0) return;
    const win = window.open('', '_blank');
    if (!win) { notify('Allow pop-ups to print badges', 'error'); return; }
    win.document.write('<p style="font-family:Arial;padding:20px">Preparing badges…</p>');
    setPrinting(true);
    try {
      const badges = [];
      for (const e of targets) {
        const r = await api.get(`/smart-attendance/badges/${encodeURIComponent(e.employee_id)}`);
        badges.push(r.data);
      }
      printBadges(badges, win);
      load();
    } catch (e) {
      win.close();
      notify(errMsg(e, 'Could not prepare badges'), 'error');
    } finally {
      setPrinting(false);
    }
  };

  const removeFace = (emp) => askConfirm({
    title: 'Remove registered face?',
    message: `${emp.name} will not be able to use face attendance until a new photo is registered.`,
    confirmText: 'Remove',
    type: 'danger',
    onConfirm: async () => {
      try {
        await api.delete(`/smart-attendance/faces/${encodeURIComponent(emp.employee_id)}`);
        notify('Face removed', 'success');
        load();
      } catch (e) { notify(errMsg(e, 'Failed'), 'error'); }
    }
  });

  const noFace = employees.filter((e) => !e.face_registered).length;

  return (
    <div className="space-y-4">
      {noFace > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
          <FiUserX className="mt-0.5 shrink-0" size={16} />
          <span><b>{noFace}</b> employee(s) have no face photo yet. They can still use their QR card. Register a face with the camera or upload a photo, or ask HR to scan it from the HR Scanner app.</span>
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-admin-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, ID or email" className="admin-input admin-input-has-prefix w-full py-2.5 text-xs" />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto' }} className="admin-select py-2.5 text-xs text-admin-text sm:min-w-[220px]">
              <option value="all">All active employees</option>
              <option value="no_face">No face photo</option>
              <option value="not_emailed">QR not emailed yet</option>
            </select>
          </div>
          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 border-t border-admin-border pt-3">
              <button type="button" onClick={generateAll} className="flex items-center gap-1.5 rounded-xl border border-admin-border px-3 py-2 text-xs font-bold text-admin-secondary hover:bg-admin-surface"><FiPlus /> Generate all QR</button>
              <button type="button" onClick={printAll} disabled={printing} className="flex items-center gap-1.5 rounded-xl border border-admin-border px-3 py-2 text-xs font-bold text-admin-secondary hover:bg-admin-surface disabled:opacity-50"><FiPrinter /> {printing ? 'Preparing…' : `Print ${list.length} badge(s)`}</button>
              <select value={bulkTarget} onChange={(e) => setBulkTarget(e.target.value)} style={{ width: 'auto' }} className="admin-select py-2 text-xs text-admin-text" aria-label="Email to">
                <option value="official">Official email</option>
                <option value="personal">Personal email</option>
                <option value="both">Both emails</option>
              </select>
              <button type="button" onClick={() => emailAll(true)} disabled={job?.running} className="flex items-center gap-1.5 rounded-xl border border-blue-500/40 px-3 py-2 text-xs font-bold text-blue-400 hover:bg-blue-500/10 disabled:opacity-50"><FiMail /> Email not-sent</button>
              <button type="button" onClick={() => emailAll(false)} disabled={job?.running} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"><FiMail /> Email QR to all</button>
            </div>
          )}
        </div>
        {job && (job.running || job.finishedAt) && (
          <div className="mt-3 rounded-xl bg-admin-surface p-3 text-xs text-admin-secondary">
            {job.running ? 'Sending QR emails…' : 'Last bulk email:'} <b className="text-admin-text">{job.sent}</b> sent, <b className="text-admin-text">{job.failed}</b> failed of {job.total}
            {job.errors?.length > 0 && !job.running && (
              <details className="mt-1"><summary className="cursor-pointer text-red-400">Show failures</summary>
                <ul className="mt-1 list-disc pl-5">{job.errors.map((er) => <li key={er.employee_id}>{er.name} ({er.employee_id}): {er.error}</li>)}</ul>
              </details>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-admin-surface text-[10px] uppercase tracking-wider text-admin-muted">
              <tr>{['Employee', 'Email', 'QR badge', 'Face photo', 'Today', 'Actions'].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {loading && <tr><td colSpan={6} className="p-8 text-center"><Spinner /></td></tr>}
              {!loading && list.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-admin-muted">No employees</td></tr>}
              {!loading && list.map((e) => (
                <tr key={e.employee_id} className="text-admin-secondary hover:bg-admin-surface/60">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-admin-text">{e.name}</div>
                    <div className="text-[10px] text-admin-muted">{e.employee_id}{e.department_name ? ` · ${e.department_name}` : ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{e.email || '—'}</div>
                    {e.last_emailed_at ? <div className="text-[10px] text-emerald-400">QR emailed ({e.email_count}×)</div> : <div className="text-[10px] text-admin-muted">QR not emailed</div>}
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => setBadgeFor(e.employee_id)} className="flex items-center gap-1.5 rounded-lg border border-admin-border px-2.5 py-1.5 font-bold text-blue-400 hover:bg-admin-surface">
                      <FiCreditCard /> {e.badge_code ? 'View QR' : 'Create QR'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {e.face_registered ? (
                      <button type="button" onClick={() => setPhotoFor(e)} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400"><FiCheckCircle /> Registered ({e.face_source})</button>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-400"><FiUserX /> No photo</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{e.login_label ? `${e.login_label}${e.logout_label ? ` – ${e.logout_label}` : ''}` : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {canEdit && (
                        <>
                          <button type="button" onClick={() => setEnroll({ employee: e, mode: 'camera' })} title="Register face with camera" className="rounded-lg border border-admin-border p-2 text-admin-secondary hover:bg-admin-surface hover:text-blue-400"><FiCamera /></button>
                          <button type="button" onClick={() => setEnroll({ employee: e, mode: 'upload' })} title="Upload face photo" className="rounded-lg border border-admin-border p-2 text-admin-secondary hover:bg-admin-surface hover:text-blue-400"><FiUpload /></button>
                        </>
                      )}
                      {e.face_registered && <button type="button" onClick={() => setPhotoFor(e)} title="View photo" className="rounded-lg border border-admin-border p-2 text-admin-secondary hover:bg-admin-surface"><FiImage /></button>}
                      {canDelete && e.face_registered && <button type="button" onClick={() => removeFace(e)} title="Remove face" className="rounded-lg border border-admin-border p-2 text-admin-secondary hover:bg-red-500/10 hover:text-red-400"><FiTrash2 /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {badgeFor && <BadgeModal employeeId={badgeFor} onClose={() => { setBadgeFor(null); load(); }} canEdit={canEdit} notify={notify} askConfirm={askConfirm} />}
      {photoFor && <PhotoModal employee={photoFor} onClose={() => setPhotoFor(null)} />}
      {enroll && (
        <FaceEnrollModal
          client={api}
          employee={enroll.employee}
          defaultMode={enroll.mode}
          allowUpload
          onClose={() => setEnroll(null)}
          onSaved={() => { notify(`Face registered for ${enroll.employee.name}`, 'success'); load(); }}
        />
      )}
    </div>
  );
};

/* ─────────────────────────── Corrections ─────────────────────────── */
const CorrectionsTab = () => {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PAGE_KEY, 'can_edit');
  const [from, setFrom] = useState(todayIST());
  const [to, setTo] = useState(todayIST());
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/smart-attendance/notes', { params: { from, to } });
      setNotes(r.data.notes || []);
    } catch (_) { /* global */ } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const hhmm = (ts) => (ts ? timeOf(ts) : '—');

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
      {canEdit ? (
        <Card className="p-5">
          <h3 className="mb-1 text-sm font-bold text-admin-text">Correct attendance / add note</h3>
          <p className="mb-4 text-xs text-admin-muted">For days the scanner machine was not working, a card was forgotten, a face was not recognised, etc. The note is saved with your name and the old and new times.</p>
          <CorrectionPanel client={api} onSaved={load} />
        </Card>
      ) : (
        <Card className="p-5 text-xs text-admin-muted">You can view notes. Ask a Super Admin for edit permission on Smart Attendance to make corrections.</Card>
      )}

      <Card>
        <div className="flex flex-col gap-3 border-b border-admin-border p-4 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-bold text-admin-text">Attendance notes & corrections</h3>
          <div className="flex flex-wrap items-center gap-2 text-xs text-admin-muted">
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={{ width: 'auto' }} className="admin-input py-2 text-xs" />
            to
            <input type="date" value={to} min={from} max={todayIST()} onChange={(e) => setTo(e.target.value)} style={{ width: 'auto' }} className="admin-input py-2 text-xs" />
            <button type="button" onClick={load} className="rounded-xl border border-admin-border p-2 text-admin-secondary hover:bg-admin-surface" aria-label="Refresh"><FiRefreshCw /></button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-admin-surface text-[10px] uppercase tracking-wider text-admin-muted">
              <tr>{['Date', 'Employee', 'Type', 'Reason', 'Change', 'By', 'When'].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {loading && <tr><td colSpan={7} className="p-8 text-center"><Spinner /></td></tr>}
              {!loading && notes.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-admin-muted">No notes in this range</td></tr>}
              {!loading && notes.map((n) => (
                <tr key={n.id} className="align-top text-admin-secondary">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-admin-text">{n.attendance_date}</td>
                  <td className="px-4 py-3"><div className="font-semibold text-admin-text">{n.employee_name}</div><div className="text-[10px] text-admin-muted">{n.employee_id}</div></td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${n.change_type === 'correction' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>{n.change_type === 'correction' ? 'Correction' : 'Note'}</span></td>
                  <td className="max-w-[280px] px-4 py-3"><div className="font-semibold text-admin-text">{n.category}</div><div className="text-admin-muted">{n.note}</div></td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {n.change_type === 'correction' ? (
                      <>
                        <div>In {hhmm(n.old_values?.login_time)} → <b className="text-admin-text">{hhmm(n.new_values?.login_time)}</b></div>
                        <div>Out {hhmm(n.old_values?.logout_time)} → <b className="text-admin-text">{hhmm(n.new_values?.logout_time)}</b></div>
                        {n.new_values?.attendance_status && <div className="text-admin-muted">Status: {n.new_values.attendance_status}</div>}
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">{n.created_by_name}<div className="text-[10px] text-admin-muted">{n.created_by_role}</div></td>
                  <td className="whitespace-nowrap px-4 py-3 text-admin-muted">{formatNoteTime(n.created_at_ist)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

/* ─────────────────────────── Kiosks & settings ─────────────────────────── */
const MODE_LABEL = { card: 'ID card / QR', face: 'Face', both: 'Card + Face' };

const KiosksTab = ({ notify, askConfirm }) => {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PAGE_KEY, 'can_edit');
  const canDelete = hasPermission(PAGE_KEY, 'can_delete');
  const [kiosks, setKiosks] = useState([]);
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState({ name: '', mode: 'card' });
  const [newKey, setNewKey] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [k, s] = await Promise.all([api.get('/smart-attendance/kiosks'), api.get('/smart-attendance/settings')]);
      setKiosks(k.data.kiosks || []);
      setSettings(s.data.settings);
    } catch (_) { /* global */ }
  }, []);

  useEffect(() => { load(); }, [load]);

  const origin = window.location.origin;

  const copy = (text) => {
    navigator.clipboard?.writeText(text).then(() => notify('Copied', 'success')).catch(() => notify('Copy failed – select and copy manually', 'error'));
  };

  const create = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { notify('Enter a kiosk name', 'error'); return; }
    try {
      const r = await api.post('/smart-attendance/kiosks', form);
      setNewKey(r.data.kiosk);
      setForm({ name: '', mode: 'card' });
      load();
    } catch (err) { notify(errMsg(err, 'Failed'), 'error'); }
  };

  const update = async (k, patch) => {
    try {
      await api.patch(`/smart-attendance/kiosks/${k.id}`, patch);
      load();
    } catch (err) { notify(errMsg(err, 'Failed'), 'error'); }
  };

  const remove = (k) => askConfirm({
    title: `Delete kiosk "${k.name}"?`,
    message: 'The device will stop working immediately and must be paired again with a new key.',
    confirmText: 'Delete',
    type: 'danger',
    onConfirm: async () => {
      try { await api.delete(`/smart-attendance/kiosks/${k.id}`); load(); } catch (err) { notify(errMsg(err, 'Failed'), 'error'); }
    }
  });

  const saveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const r = await api.put('/smart-attendance/settings', settings);
      setSettings(r.data.settings);
      notify('Scan settings saved', 'success');
    } catch (err) { notify(errMsg(err, 'Failed'), 'error'); } finally { setSaving(false); }
  };

  const label = 'mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-admin-secondary';

  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <div className="space-y-5">
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-admin-text"><FiSmartphone className="text-blue-400" /> App links</h3>
          <div className="space-y-3 text-xs">
            {[
              { title: 'HR Scanner mobile app', url: `${origin}/scanner`, desc: 'Open on the HR phone and sign in with an HR Scanner account, then tap "Add to Home Screen" / "Install". Only HR Scanner accounts can sign in.' },
              { title: 'Entrance kiosk', url: `${origin}/kiosk`, desc: 'Open on the entrance PC / tablet (Chrome recommended, full screen), then paste a kiosk key from below.' }
            ].map((l) => (
              <div key={l.url} className="rounded-xl border border-admin-border bg-admin-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-admin-text">{l.title}</span>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => copy(l.url)} className="rounded-lg p-1.5 text-admin-secondary hover:bg-admin-elevated" aria-label="Copy link"><FiCopy /></button>
                    <a href={l.url} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-admin-secondary hover:bg-admin-elevated" aria-label="Open"><FiExternalLink /></a>
                  </div>
                </div>
                <div className="mt-1 font-mono text-blue-400">{l.url}</div>
                <p className="mt-1 text-admin-muted">{l.desc}</p>
              </div>
            ))}
            <p className="text-admin-muted">Create HR Scanner accounts in <b>Admin Management → Add Admin → HR Scanner</b>.</p>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-admin-text"><FiMonitor className="text-blue-400" /> Kiosk devices</h3>
          {canEdit && (
            <form onSubmit={create} className="mb-4 flex flex-col gap-2 sm:flex-row">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Main entrance – card" className="admin-input flex-1 py-2.5 text-xs" />
              <select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))} style={{ width: 'auto' }} className="admin-select py-2.5 text-xs text-admin-text">
                <option value="card">ID card / QR scanner</option>
                <option value="face">Face scanner</option>
                <option value="both">Card + Face</option>
              </select>
              <button type="submit" className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-500"><FiPlus /> Add kiosk</button>
            </form>
          )}
          {newKey && (
            <div className="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs">
              <div className="font-bold text-emerald-400">Kiosk "{newKey.name}" created. Copy this key now – it will not be shown again:</div>
              <div className="mt-2 flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-black/30 p-2 font-mono text-admin-text">{newKey.kiosk_key}</code>
                <button type="button" onClick={() => copy(newKey.kiosk_key)} className="rounded-lg bg-emerald-600 p-2 text-white" aria-label="Copy key"><FiCopy /></button>
              </div>
              <button type="button" onClick={() => setNewKey(null)} className="mt-2 text-[11px] font-bold text-admin-muted">I have copied it</button>
            </div>
          )}
          <ul className="divide-y divide-admin-border rounded-xl border border-admin-border">
            {kiosks.length === 0 && <li className="p-4 text-center text-xs text-admin-muted">No kiosks yet</li>}
            {kiosks.map((k) => (
              <li key={k.id} className="flex flex-col gap-2 p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-bold text-admin-text">{k.name} <span className="font-mono text-[10px] text-admin-muted">…{k.key_hint}</span></div>
                  <div className="text-admin-muted">{MODE_LABEL[k.mode]} · {k.last_seen_at ? 'seen recently' : 'never connected'} · {k.is_active ? <span className="text-emerald-400">active</span> : <span className="text-red-400">disabled</span>}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {canEdit && (
                    <>
                      <select value={k.mode} onChange={(e) => update(k, { mode: e.target.value })} style={{ width: 'auto' }} className="admin-select py-1.5 text-[11px] text-admin-text" aria-label="Mode">
                        <option value="card">Card</option>
                        <option value="face">Face</option>
                        <option value="both">Both</option>
                      </select>
                      <button type="button" onClick={() => update(k, { is_active: !k.is_active })} className="rounded-lg border border-admin-border px-2.5 py-1.5 font-bold text-admin-secondary hover:bg-admin-surface">{k.is_active ? 'Disable' : 'Enable'}</button>
                    </>
                  )}
                  {canDelete && <button type="button" onClick={() => remove(k)} className="rounded-lg border border-admin-border p-2 text-admin-secondary hover:bg-red-500/10 hover:text-red-400" aria-label="Delete"><FiTrash2 /></button>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-bold text-admin-text">Scan rules</h3>
        {!settings ? <Spinner /> : (
          <form onSubmit={saveSettings} className="space-y-4 text-xs">
            <div>
              <label className={label}>Face match strictness ({Number(settings.faceMatchThreshold).toFixed(2)})</label>
              <input type="range" min="0.35" max="0.6" step="0.01" value={settings.faceMatchThreshold} disabled={!canEdit}
                onChange={(e) => setSettings((s) => ({ ...s, faceMatchThreshold: Number(e.target.value) }))} className="w-full" />
              <div className="flex justify-between text-[10px] text-admin-muted"><span>Stricter (fewer wrong matches)</span><span>Looser (fewer rejections)</span></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Ignore repeat scan (seconds)</label>
                <input type="number" min="0" max="3600" value={settings.duplicateScanCooldownSeconds} disabled={!canEdit}
                  onChange={(e) => setSettings((s) => ({ ...s, duplicateScanCooldownSeconds: e.target.value }))} className="admin-input w-full py-2.5 text-xs" />
              </div>
              <div>
                <label className={label}>Min. minutes before check-out</label>
                <input type="number" min="0" max="600" value={settings.minMinutesBeforeCheckout} disabled={!canEdit}
                  onChange={(e) => setSettings((s) => ({ ...s, minMinutesBeforeCheckout: e.target.value }))} className="admin-input w-full py-2.5 text-xs" />
              </div>
            </div>
            <label className="flex items-start gap-2 text-admin-secondary">
              <input type="checkbox" checked={!!settings.allowEmployeeIdCodes} disabled={!canEdit} onChange={(e) => setSettings((s) => ({ ...s, allowEmployeeIdCodes: e.target.checked }))} className="mt-0.5" />
              <span>Also accept the plain employee ID as a card code (for existing printed ID cards whose barcode is the employee ID). Turn off to accept only the secure QR codes generated here.</span>
            </label>
            <div className="rounded-xl bg-admin-surface p-3 text-admin-muted">
              Late, half-day, holiday and Sunday rules come from the normal attendance <b>Settings</b>, so scanned attendance behaves exactly like the existing system.
            </div>
            {canEdit && <button type="submit" disabled={saving} className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50">{saving ? 'Saving…' : 'Save scan rules'}</button>}
          </form>
        )}
      </Card>
    </div>
  );
};

/* ─────────────────────────── Page ─────────────────────────── */
const AdminSmartAttendance = () => {
  const [tab, setTab] = useState('live');
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const [confirm, setConfirm] = useState({ isOpen: false });

  const notify = useCallback((message, type = 'success') => setToast({ message, type }), []);
  const askConfirm = useCallback((cfg) => setConfirm({ ...cfg, isOpen: true }), []);

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll selection:bg-blue-500/30">
      <Sidebar />
      <div className="relative flex-1 overflow-y-auto pb-24 dark-scroll">
        <div className="mx-auto max-w-[1600px] animate-fadeIn px-5 py-6 pt-16 lg:px-8 lg:py-8 lg:pt-8">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold tracking-tight text-admin-heading lg:text-3xl">Smart Attendance</h1>
            <p className="mt-1.5 text-sm font-medium text-admin-muted">Automatic attendance by ID card QR / barcode or face scan, HR Scanner app, kiosks and corrections.</p>
          </div>

          <div className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-admin-border bg-admin-elevated p-1">
            {TABS.map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => setTab(id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors ${tab === id ? 'bg-blue-600 text-white' : 'text-admin-secondary hover:bg-admin-surface'}`}>
                <Icon /> {label}
              </button>
            ))}
          </div>

          {tab === 'live' && <LiveTab />}
          {tab === 'badges' && <BadgesTab notify={notify} askConfirm={askConfirm} />}
          {tab === 'corrections' && <CorrectionsTab />}
          {tab === 'kiosks' && <KiosksTab notify={notify} askConfirm={askConfirm} />}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirm.isOpen}
        onClose={() => setConfirm((c) => ({ ...c, isOpen: false }))}
        onConfirm={() => confirm.onConfirm?.()}
        title={confirm.title}
        message={confirm.message}
        confirmText={confirm.confirmText}
        type={confirm.type}
      />
      <AdminToast message={toast.message} type={toast.type} onClose={() => setToast({ message: '', type: 'success' })} />
    </div>
  );
};

export default AdminSmartAttendance;
