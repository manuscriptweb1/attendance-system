import React, { useEffect, useState } from 'react';
import { FiUserX, FiCreditCard, FiX, FiDownload } from 'react-icons/fi';
import api from '../../services/api';

/**
 * Employee dashboard helper for Smart Attendance:
 *  - warns when no face photo is registered ("please contact HR")
 *  - lets the employee open / download their own attendance QR code
 * Renders nothing if the Smart Attendance API is unavailable.
 */
const EmployeeSmartAttendanceNotice = () => {
  const [status, setStatus] = useState(null);
  const [badge, setBadge] = useState(null);
  const [open, setOpen] = useState(false);
  const [loadingBadge, setLoadingBadge] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.get('/smart-attendance/me/status')
      .then((r) => { if (!cancelled) setStatus(r.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const openBadge = async () => {
    setOpen(true);
    if (badge) return;
    setLoadingBadge(true);
    try {
      const r = await api.get('/smart-attendance/me/badge');
      setBadge(r.data);
    } catch (_) {
      setOpen(false);
    } finally {
      setLoadingBadge(false);
    }
  };

  if (!status) return null;

  return (
    <>
      <div className={`mb-6 flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${status.face_registered ? 'border-[#E2E8F0] bg-white' : 'border-amber-300 bg-amber-50'}`}>
        {status.face_registered ? (
          <p className="text-sm text-[#475569]">Use your ID card QR or your face at the entrance scanner to mark attendance.</p>
        ) : (
          <p className="flex items-start gap-2 text-sm font-medium text-amber-800">
            <FiUserX className="mt-0.5 shrink-0" />
            Your face photo is not registered for face attendance. Please contact HR to upload or scan your photo.
          </p>
        )}
        <button type="button" onClick={openBadge} className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#4F6CE1] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3f5bd0]">
          <FiCreditCard /> My attendance QR
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)} role="presentation">
          <div className="w-full max-w-xs rounded-3xl bg-white p-5 text-center shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="My attendance QR">
            <div className="mb-2 flex justify-end">
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Close"><FiX /></button>
            </div>
            {loadingBadge || !badge ? (
              <p className="py-10 text-sm text-slate-500">Loading…</p>
            ) : (
              <>
                <div className="text-base font-bold text-slate-900">{badge.employee.name}</div>
                <div className="text-xs text-slate-500">{badge.employee.employee_id}</div>
                <img src={badge.qr} alt="My attendance QR code" className="mx-auto my-3 h-52 w-52" />
                <img src={badge.barcode} alt="My attendance barcode" className="mx-auto w-full" />
                <p className="mt-3 text-[11px] text-slate-500">Show this at the entrance scanner when you arrive and when you leave. Keep it private.</p>
                <a href={badge.qr} download={`${badge.employee.employee_id}-attendance-qr.png`} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
                  <FiDownload /> Download QR
                </a>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default EmployeeSmartAttendanceNotice;
