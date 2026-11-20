import React from 'react';
import { FiLogIn, FiLogOut, FiAlertTriangle, FiXCircle, FiUserX, FiCoffee, FiCornerDownLeft } from 'react-icons/fi';
import { SUCCESS_KINDS } from '../../services/scannerApi';

const STYLES = {
  in: { ring: 'border-emerald-500/60 bg-emerald-950/95', icon: FiLogIn, iconColor: 'text-emerald-400', title: 'Checked in' },
  out: { ring: 'border-sky-500/60 bg-sky-950/95', icon: FiLogOut, iconColor: 'text-sky-400', title: 'Checked out' },
  leave: { ring: 'border-violet-500/60 bg-violet-950/95', icon: FiCoffee, iconColor: 'text-violet-300', title: 'Special leave started' },
  back: { ring: 'border-teal-500/60 bg-teal-950/95', icon: FiCornerDownLeft, iconColor: 'text-teal-300', title: 'Back from special leave' },
  warn: { ring: 'border-amber-500/60 bg-amber-950/95', icon: FiAlertTriangle, iconColor: 'text-amber-400', title: 'Already done' },
  error: { ring: 'border-red-500/60 bg-red-950/95', icon: FiXCircle, iconColor: 'text-red-400', title: 'Not marked' }
};

/** More specific titles for common "nothing changed" answers */
const CODE_TITLES = {
  ALREADY_CHECKED_IN: 'Already checked in',
  ALREADY_COMPLETED: 'Already checked out',
  NOT_CHECKED_IN: 'Not checked in yet',
  TOO_SOON: 'Too soon to check out'
};

/**
 * Big, glanceable result of a scan. Used by the HR app and kiosks.
 */
const ScanResultCard = ({ result, photo, onDismiss, onEnrollFace, large = false, showEnrollPrompt = true }) => {
  if (!result) return null;
  const s = STYLES[result.kind] || STYLES.error;
  const Icon = s.icon;
  const title = CODE_TITLES[result.code] || s.title;
  const leave = result.specialLeave;
  const noFace = result.employee && result.employee.face_registered === false;

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-4" onClick={onDismiss} role="presentation">
      <div className={`w-full max-w-md rounded-3xl border-2 ${s.ring} p-6 text-center shadow-2xl backdrop-blur animate-scale-in`} onClick={(e) => e.stopPropagation()} role="alert">
        {photo ? (
          <img src={photo} alt="" className={`mx-auto mb-3 rounded-2xl object-cover ring-4 ring-white/20 ${large ? 'h-36 w-36' : 'h-24 w-24'}`} />
        ) : (
          <Icon className={`mx-auto mb-3 ${s.iconColor}`} size={large ? 72 : 48} />
        )}
        <div className={`font-extrabold uppercase tracking-wider ${s.iconColor} ${large ? 'text-xl' : 'text-xs'}`}>{title}</div>
        {result.employee?.name && (
          <div className={`mt-1 font-extrabold text-white ${large ? 'text-4xl' : 'text-2xl'}`}>{result.employee.name}</div>
        )}
        {result.employee?.employee_id && <div className="text-sm text-white/60">{result.employee.employee_id}</div>}
        {/* The Out / Back / LOP grid already says it all when someone comes back */}
        {!(result.kind === 'back' && leave?.end_label) && (
          <p className={`mt-3 font-medium text-white/90 ${large ? 'text-xl' : 'text-sm'}`}>{result.message}</p>
        )}

        {leave && leave.end_label && (
          <div className={`mt-4 grid grid-cols-3 divide-x divide-white/10 rounded-2xl bg-white/5 text-white ${large ? 'py-4' : 'py-3'}`} aria-label={result.message}>
            {[['Out', leave.start_label], ['Back', leave.end_label], ['LOP', `${leave.minutes} min`]].map(([k, v]) => (
              <div key={k} className="min-w-0 px-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-white/50">{k}</div>
                <div className={`whitespace-nowrap font-extrabold tabular-nums ${large ? 'text-2xl' : 'text-[15px]'}`}>{v}</div>
              </div>
            ))}
          </div>
        )}

        {showEnrollPrompt && noFace && SUCCESS_KINDS.includes(result.kind) && (
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
