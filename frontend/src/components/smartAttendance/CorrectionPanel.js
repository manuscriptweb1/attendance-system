import React, { useEffect, useMemo, useState } from 'react';
import { FiEdit3, FiSearch, FiClock, FiFileText, FiCheckCircle, FiCoffee, FiTrash2 } from 'react-icons/fi';

export const NOTE_CATEGORIES = [
  'Machine not working',
  'Forgot ID card',
  'Face not recognised',
  'Network / server issue',
  'Official duty outside office',
  'Wrong scan',
  'Other'
];

const todayIST = () => {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return p; // en-CA → YYYY-MM-DD
};

const hhmm = (ts) => (ts ? String(ts).slice(11, 16) : '');

export const formatNoteTime = (ts) => {
  if (!ts) return '';
  const [d, t] = String(ts).split('T');
  if (!t) return d;
  let [h, m] = t.split(':');
  h = parseInt(h, 10);
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${d} ${h % 12 || 12}:${m} ${suffix}`;
};

const errorText = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * Correct check-in / check-out times or add a note, with a mandatory reason.
 * Used by the HR Scanner app and the admin Smart Attendance page.
 */
const CorrectionPanel = ({ client, initialEmployeeId = '', onSaved }) => {
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [employeeId, setEmployeeId] = useState(initialEmployeeId);
  const [date, setDate] = useState(todayIST());
  const [record, setRecord] = useState(null);
  const [notes, setNotes] = useState([]);
  const [specialLeaves, setSpecialLeaves] = useState([]);
  const [removing, setRemoving] = useState(null); // { id, reason, busy }
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [loginTime, setLoginTime] = useState('');
  const [logoutTime, setLogoutTime] = useState('');
  const [clearLogout, setClearLogout] = useState(false);
  const [category, setCategory] = useState(NOTE_CATEGORIES[0]);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    client.get('/smart-attendance/employees').then((r) => setEmployees(r.data.employees || [])).catch(() => {});
  }, [client]);

  useEffect(() => { if (initialEmployeeId) setEmployeeId(initialEmployeeId); }, [initialEmployeeId]);

  const applyData = (data) => {
    setRecord(data.attendance);
    setNotes(data.notes || []);
    setSpecialLeaves(data.special_leaves || []);
    setLoginTime(hhmm(data.attendance?.login_time));
    setLogoutTime(hhmm(data.attendance?.logout_time));
    setClearLogout(false);
    setRemoving(null);
  };

  const removeSpecialLeave = async () => {
    if (!removing) return;
    if (removing.reason.trim().length < 3) { setError('Write why this special leave is being removed (e.g. "Scanned by mistake").'); return; }
    setError('');
    setSuccess('');
    setRemoving((r) => ({ ...r, busy: true }));
    try {
      const r = await client.post(`/smart-attendance/special-leaves/${removing.id}/cancel`, { note: removing.reason.trim() });
      applyData(r.data);
      setSuccess('Special leave removed. It no longer counts as LOP.');
      onSaved?.(r.data);
    } catch (err) {
      setError(errorText(err, 'Could not remove the special leave'));
      setRemoving((r) => (r ? { ...r, busy: false } : r));
    }
  };

  const loadRecord = async (emp = employeeId, d = date) => {
    if (!emp || !d) { setRecord(null); setNotes([]); setSpecialLeaves([]); return; }
    setLoadingRecord(true);
    setError('');
    try {
      const r = await client.get(`/smart-attendance/attendance/${encodeURIComponent(emp)}`, { params: { date: d } });
      applyData(r.data);
    } catch (err) {
      setError(errorText(err, 'Could not load attendance'));
    } finally {
      setLoadingRecord(false);
    }
  };

  useEffect(() => {
    loadRecord(employeeId, date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, date]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees.slice(0, 50);
    return employees.filter((e) => e.name.toLowerCase().includes(q) || e.employee_id.toLowerCase().includes(q)).slice(0, 50);
  }, [employees, search]);

  const selected = employees.find((e) => e.employee_id === employeeId);
  const originalLogin = hhmm(record?.login_time);
  const originalLogout = hhmm(record?.logout_time);
  const timesChanged = loginTime !== originalLogin || logoutTime !== originalLogout || clearLogout;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!employeeId) { setError('Select an employee'); return; }
    if (note.trim().length < 3) { setError('Please write the reason / note (e.g. "Scanner machine was not working").'); return; }
    if (logoutTime && !loginTime) { setError('Enter the check-in time first'); return; }
    setSaving(true);
    try {
      const payload = {
        employee_id: employeeId,
        attendance_date: date,
        note: note.trim(),
        category
      };
      if (timesChanged) {
        if (loginTime) payload.login_time = loginTime;
        if (logoutTime && !clearLogout) payload.logout_time = logoutTime;
        if (clearLogout || (!logoutTime && originalLogout)) payload.clear_logout = true;
      }
      const r = await client.post('/smart-attendance/corrections', payload);
      setSuccess(r.data.message || 'Saved');
      setNote('');
      applyData(r.data);
      onSaved?.(r.data);
    } catch (err) {
      setError(errorText(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  const label = 'block text-[10px] font-bold uppercase tracking-wider text-admin-secondary mb-1.5';

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className={label}>Employee</label>
        {selected ? (
          <div className="flex items-center justify-between rounded-xl border border-admin-border bg-admin-surface px-3 py-2.5">
            <div>
              <div className="text-sm font-bold text-admin-text">{selected.name}</div>
              <div className="text-xs text-admin-muted">{selected.employee_id}{selected.department_name ? ` · ${selected.department_name}` : ''}</div>
            </div>
            <button type="button" onClick={() => { setEmployeeId(''); setSearch(''); }} className="text-xs font-bold text-blue-400">Change</button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-admin-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or employee ID" className="admin-input admin-input-has-prefix w-full py-2.5 text-sm" />
            </div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-admin-border">
              {filtered.length === 0 && <div className="p-3 text-xs text-admin-muted">No employees found</div>}
              {filtered.map((e) => (
                <button type="button" key={e.employee_id} onClick={() => setEmployeeId(e.employee_id)} className="flex w-full items-center justify-between border-b border-admin-border px-3 py-2 text-left last:border-0 hover:bg-admin-surface">
                  <span className="text-sm text-admin-text">{e.name}</span>
                  <span className="text-xs text-admin-muted">{e.employee_id}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <label className={label}>Date</label>
        <input type="date" value={date} max={todayIST()} onChange={(e) => setDate(e.target.value)} className="admin-input w-full py-2.5 text-sm" />
      </div>

      {employeeId && (
        <div className="rounded-xl border border-admin-border bg-admin-surface p-3 text-xs">
          {loadingRecord ? (
            <span className="text-admin-muted">Loading attendance…</span>
          ) : record ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-admin-secondary">
              <span className="font-bold text-admin-text">Current:</span>
              <span>In <b className="text-admin-text">{record.login_label || '—'}</b></span>
              <span>Out <b className="text-admin-text">{record.logout_label || '—'}</b></span>
              <span>Status <b className="text-admin-text">{record.attendance_status || '—'}</b></span>
              {record.validation_method && <span className="text-admin-muted">via {record.validation_method}</span>}
              {record.special_leave_minutes > 0 && <span>Special leave <b className="text-violet-400">{record.special_leave_minutes} min</b></span>}
            </div>
          ) : (
            <span className="text-admin-muted">No attendance recorded for this date yet. Enter the times below to create it.</span>
          )}
        </div>
      )}

      {employeeId && specialLeaves.length > 0 && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-xs">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-400"><FiCoffee aria-hidden="true" /> Special leave</span>
            {record?.special_leave_minutes > 0 && <span className="font-bold text-admin-text">{record.special_leave_minutes} min · LOP</span>}
          </div>
          <ul className="space-y-1.5">
            {specialLeaves.map((l) => {
              const active = l.status === 'open' || l.status === 'closed';
              return (
                <li key={l.id} className="rounded-lg bg-admin-surface px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={active ? 'text-admin-text' : 'text-admin-muted line-through'}>
                      <b>{l.start_label}</b> – <b>{l.end_label || 'not back yet'}</b>
                      {l.status === 'closed' && <span className="text-admin-muted"> · {l.minutes} min</span>}
                    </span>
                    {active ? (
                      removing?.id !== l.id && (
                        <button type="button" onClick={() => setRemoving({ id: l.id, reason: '', busy: false })} className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold text-red-400 hover:bg-red-500/10">
                          <FiTrash2 aria-hidden="true" /> Remove
                        </button>
                      )
                    ) : (
                      <span className="shrink-0 rounded-full bg-admin-elevated px-2 py-0.5 text-[10px] font-bold text-admin-muted">{l.status === 'converted' ? 'Did not return' : 'Removed'}</span>
                    )}
                  </div>
                  {l.status === 'open' && <p className="mt-0.5 text-[11px] text-violet-400">Out now. The next scan marks them back.</p>}
                  {!active && l.cancel_note && <p className="mt-0.5 text-[11px] text-admin-muted">{l.cancel_note}</p>}
                  {removing?.id === l.id && (
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        autoFocus
                        value={removing.reason}
                        onChange={(e) => setRemoving((r) => ({ ...r, reason: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); removeSpecialLeave(); } }}
                        placeholder="Reason (required), e.g. Scanned by mistake"
                        maxLength={300}
                        className="admin-input min-w-0 flex-1 py-2 text-xs"
                      />
                      <div className="flex gap-2">
                        <button type="button" disabled={removing.busy} onClick={removeSpecialLeave} className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-red-500 disabled:opacity-50">{removing.busy ? 'Removing…' : 'Remove'}</button>
                        <button type="button" onClick={() => setRemoving(null)} className="flex-1 rounded-lg border border-admin-border px-3 py-2 text-[11px] font-bold text-admin-secondary hover:bg-admin-elevated">Keep</button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}><FiClock className="mr-1 inline" />Check-in time</label>
          <input type="time" value={loginTime} onChange={(e) => setLoginTime(e.target.value)} className="admin-input w-full py-2.5 text-sm" />
        </div>
        <div>
          <label className={label}><FiClock className="mr-1 inline" />Check-out time</label>
          <input type="time" value={logoutTime} disabled={clearLogout} onChange={(e) => setLogoutTime(e.target.value)} className="admin-input w-full py-2.5 text-sm disabled:opacity-40" />
        </div>
      </div>
      {originalLogout && (
        <label className="flex items-center gap-2 text-xs text-admin-secondary">
          <input type="checkbox" checked={clearLogout} onChange={(e) => setClearLogout(e.target.checked)} />
          Remove the check-out time (employee has not left yet)
        </label>
      )}
      <p className="text-[11px] text-admin-muted">Leave the times unchanged to only add a note. Late / half-day status is recalculated automatically from office settings.</p>

      <div>
        <label className={label}>Reason category</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="admin-select w-full py-2.5 text-sm text-admin-text">
          {NOTE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>Note / reason (required)</label>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="e.g. Entrance scanner machine was not working from 9:00 to 10:30 AM" className="admin-input w-full resize-none py-2.5 text-sm" />
      </div>

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs font-semibold text-red-400">{error}</p>}
      {success && <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-400"><FiCheckCircle /> {success}</p>}

      <button type="submit" disabled={saving || !employeeId} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50">
        <FiEdit3 /> {saving ? 'Saving…' : timesChanged ? 'Save correction with note' : 'Save note'}
      </button>

      {notes.length > 0 && (
        <div>
          <h4 className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-admin-secondary"><FiFileText /> Notes for this day</h4>
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-xl border border-admin-border bg-admin-surface p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${n.change_type === 'correction' ? 'bg-amber-500/15 text-amber-400' : 'bg-blue-500/15 text-blue-400'}`}>
                    {n.change_type === 'correction' ? 'Correction' : 'Note'} · {n.category}
                  </span>
                  <span className="text-admin-muted">{formatNoteTime(n.created_at_ist)} · {n.created_by_name} ({n.created_by_role})</span>
                </div>
                <p className="mt-1.5 text-admin-text">{n.note}</p>
                {n.change_type === 'correction' && n.new_values && (
                  <p className="mt-1 text-admin-muted">
                    In {hhmm(n.old_values?.login_time) || '—'} → <b className="text-admin-secondary">{hhmm(n.new_values?.login_time) || '—'}</b>,
                    {' '}Out {hhmm(n.old_values?.logout_time) || '—'} → <b className="text-admin-secondary">{hhmm(n.new_values?.logout_time) || '—'}</b>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
};

export default CorrectionPanel;
