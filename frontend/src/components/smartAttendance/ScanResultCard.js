import React from 'react';
import { FiLogIn, FiLogOut, FiAlertTriangle, FiXCircle, FiUserX } from 'react-icons/fi';

const STYLES = {
  in: { ring: 'border-emerald-500/60 bg-emerald-950/95', icon: FiLogIn, iconColor: 'text-emerald-400', title: 'Checked in' },
  out: { ring: 'border-sky-500/60 bg-sky-950/95', icon: FiLogOut, iconColor: 'text-sky-400', title: 'Checked out' },
  warn: { ring: 'border-amber-500/60 bg-amber-950/95', icon: FiAlertTriangle, iconColor: 'text-amber-400', title: 'Already done' },
  error: { ring: 'border-red-500/60 bg-red-950/95', icon: FiXCircle, iconColor: 'text-red-400', title: 'Not marked' }
};

/**
 * Big, glanceable result of a scan. Used by the HR app and kiosks.
 */
const ScanResultCard = ({ result, photo, onDismiss, onEnrollFace, large = false, showEnrollPrompt = true }) => {
  if (!result) return null;
  const s = STYLES[result.kind] || STYLES.error;
  const Icon = s.icon;
  const noFace = result.employee && result.employee.face_registered === false;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4" onClick={onDismiss} role="presentation">
      <div className={`w-full max-w-md rounded-3xl border-2 ${s.ring} p-6 text-center shadow-2xl backdrop-blur animate-scale-in`} onClick={(e) => e.stopPropagation()} role="alert">
        {photo ? (
          <img src={photo} alt="" className={`mx-auto mb-3 rounded-2xl object-cover ring-4 ring-white/20 ${large ? 'h-36 w-36' : 'h-24 w-24'}`} />
        ) : (
          <Icon className={`mx-auto mb-3 ${s.iconColor}`} size={large ? 72 : 48} />
        )}
        <div className={`font-extrabold uppercase tracking-wider ${s.iconColor} ${large ? 'text-xl' : 'text-xs'}`}>{s.title}</div>
        {result.employee?.name && (
          <div className={`mt-1 font-extrabold text-white ${large ? 'text-4xl' : 'text-2xl'}`}>{result.employee.name}</div>
        )}
        {result.employee?.employee_id && <div className="text-sm text-white/60">{result.employee.employee_id}</div>}
        <p className={`mt-3 font-medium text-white/90 ${large ? 'text-xl' : 'text-sm'}`}>{result.message}</p>

        {showEnrollPrompt && noFace && (result.kind === 'in' || result.kind === 'out') && (
          <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 p-3 text-left">
            <p className="flex items-start gap-2 text-xs font-semibold text-amber-200">
              <FiUserX className="mt-0.5 shrink-0" />
              No face photo is registered for this employee. {onEnrollFace ? 'Scan the photo now so face attendance works next time.' : 'Please contact HR to upload or scan the photo.'}
            </p>
            {onEnrollFace && (
              <button type="button" onClick={() => onEnrollFace(result.employee)} className="mt-2 w-full rounded-xl bg-amber-500 py-2 text-xs font-bold text-black">
                Scan photo now
              </button>
            )}
          </div>
        )}

        {onDismiss && (
          <button type="button" onClick={onDismiss} className="mt-5 w-full rounded-xl bg-white/10 py-3 text-sm font-bold text-white hover:bg-white/20">
            Next scan
          </button>
        )}
      </div>
    </div>
  );
};

export default ScanResultCard;
