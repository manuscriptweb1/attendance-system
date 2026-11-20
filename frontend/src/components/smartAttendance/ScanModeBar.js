import React, { useEffect, useState } from 'react';
import { FiZap, FiLogIn, FiLogOut, FiCoffee, FiX } from 'react-icons/fi';
import { istMinutesNow, hhmmToMinutes, hhmmLabel } from '../../services/scannerApi';

/**
 * Scan mode selector shared by the HR Scanner app and entrance kiosks.
 *  Auto (default): check-in, and check-out from the configured time (2 PM)
 *  Check-in / Check-out: force the next scan (e.g. leaving early)
 *  Special leave: 1st scan = going out, 2nd scan = back (time away is LOP)
 * Manual modes are one-shot: the parent switches back to Auto after a successful scan.
 */
export const MODE_META = {
  auto: {
    label: 'Auto',
    Icon: FiZap,
    active: 'bg-blue-600 text-white shadow-lg shadow-blue-900/40',
    frame: 'ring-blue-500/40',
    strip: 'border-blue-500/30 bg-blue-500/10 text-blue-300'
  },
  check_in: {
    label: 'Check-in',
    Icon: FiLogIn,
    active: 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40',
    frame: 'ring-emerald-500/80',
    strip: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
  },
  check_out: {
    label: 'Check-out',
    Icon: FiLogOut,
    active: 'bg-sky-600 text-white shadow-lg shadow-sky-900/40',
    frame: 'ring-sky-500/80',
    strip: 'border-sky-500/40 bg-sky-500/10 text-sky-300'
  },
  special_leave: {
    label: 'Special leave',
    Icon: FiCoffee,
    active: 'bg-violet-600 text-white shadow-lg shadow-violet-900/40',
    frame: 'ring-violet-500/80',
    strip: 'border-violet-500/40 bg-violet-500/10 text-violet-300'
  }
};

/** What Auto mode does right now: 'check_in' before the switch time, 'check_out' after */
export const useAutoPhase = (checkoutStartsAt) => {
  const [now, setNow] = useState(istMinutesNow);
  useEffect(() => {
    const t = setInterval(() => setNow(istMinutesNow()), 30000);
    return () => clearInterval(t);
  }, []);
  return now >= hhmmToMinutes(checkoutStartsAt) ? 'check_out' : 'check_in';
};

const ScanModeBar = ({ mode, onChange, checkoutStartsAt = '14:00', large = false, secondsLeft = null }) => {
  const phase = useAutoPhase(checkoutStartsAt);
  const switchLabel = hhmmLabel(checkoutStartsAt);
  const meta = MODE_META[mode] || MODE_META.auto;

  const hint = {
    auto: phase === 'check_in'
      ? <>Scans <b>check in</b> now. Check-out starts at <b>{switchLabel}</b>.</>
      : <>Scans <b>check out</b> now. Not checked in yet = check-in.</>,
    check_in: <>Next scan <b>checks in</b> only.</>,
    check_out: <>Next scan <b>checks out</b>, for leaving early.</>,
    special_leave: <>1st scan = <b>going out</b>, 2nd scan = <b>back</b>. Time away is LOP.</>
  }[mode];

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Scan mode" className="grid grid-cols-4 gap-1 rounded-2xl border border-admin-border bg-admin-surface p-1">
        {Object.entries(MODE_META).map(([id, m]) => {
          const selected = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(id)}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 font-bold transition-colors duration-150 ${large ? 'py-4 text-sm lg:text-base' : 'py-2.5 text-[11px]'} ${selected ? m.active : 'text-admin-secondary hover:bg-admin-elevated hover:text-admin-text'}`}
            >
              <m.Icon size={large ? 26 : 18} aria-hidden="true" />
              <span className="truncate leading-tight">{m.label}</span>
            </button>
          );
        })}
      </div>

      <div className={`flex items-center gap-2 rounded-xl border px-3 ${large ? 'py-3 text-sm' : 'py-2 text-[11px]'} ${meta.strip}`} aria-live="polite">
        {mode === 'auto' && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${phase === 'check_in' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-sky-500/20 text-sky-300'}`}>
            Now: {phase === 'check_in' ? 'Check-in' : 'Check-out'}
          </span>
        )}
        <span className="min-w-0 flex-1">
          {hint}
          {mode !== 'auto' && (
            <span className="opacity-75"> Back to Auto after one scan{secondsLeft != null ? ` or in ${secondsLeft}s` : ''}.</span>
          )}
        </span>
        {mode !== 'auto' && (
          <button type="button" onClick={() => onChange('auto')} className="flex shrink-0 items-center gap-1 rounded-lg bg-black/20 px-2 py-1 text-[11px] font-bold hover:bg-black/30" aria-label="Cancel and go back to Auto">
            <FiX aria-hidden="true" /> Cancel
          </button>
        )}
      </div>
    </div>
  );
};

export default ScanModeBar;
