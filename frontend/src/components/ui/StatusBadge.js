import React from 'react';

const COMBINED_CONFIG = {
  'Present':           { base: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/25', dot: 'bg-emerald-500 dark:bg-emerald-400' },
  'Currently Working': { base: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/25', dot: 'bg-emerald-500 dark:bg-emerald-400' },
  'Late':              { base: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-500/25', dot: 'bg-amber-500 dark:bg-amber-400' },
  'Half Day':          { base: 'bg-orange-50 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-200/80 dark:border-orange-500/25', dot: 'bg-orange-500 dark:bg-orange-400' },
  'Absent':            { base: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200/80 dark:border-red-500/25', dot: 'bg-red-500 dark:bg-red-400' },
  'Not Mention':       { base: 'bg-slate-50 dark:bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-500/20', dot: 'bg-slate-400 dark:bg-slate-500' },
  'Work From Home':    { base: 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-200/80 dark:border-blue-500/25', dot: 'bg-blue-500 dark:bg-blue-400' },
  'Government Holiday':{ base: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-200/80 dark:border-purple-500/25', dot: 'bg-purple-500 dark:bg-purple-400' },
  'Office Holiday':    { base: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-200/80 dark:border-purple-500/25', dot: 'bg-purple-500 dark:bg-purple-400' },
  'Holiday':           { base: 'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-200/80 dark:border-purple-500/25', dot: 'bg-purple-500 dark:bg-purple-400' },
  'Sunday':            { base: 'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-200/80 dark:border-teal-500/25', dot: 'bg-teal-500 dark:bg-teal-400' },
  'Weekend':           { base: 'bg-teal-50 dark:bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-200/80 dark:border-teal-500/25', dot: 'bg-teal-500 dark:bg-teal-400' },
  'Upcoming':          { base: 'bg-slate-50 dark:bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-slate-600/20', dot: 'bg-slate-300 dark:bg-slate-600' },
  'Pre-Joining':       { base: 'bg-slate-50 dark:bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-200/60 dark:border-slate-600/20', dot: 'bg-slate-300 dark:bg-slate-600' },
  'Active':            { base: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-500/25', dot: 'bg-emerald-500 dark:bg-emerald-400' },
  'Inactive':          { base: 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-400 border-red-200/80 dark:border-red-500/25', dot: 'bg-red-500 dark:bg-red-400' },
};

const FALLBACK = { base: 'bg-slate-50 dark:bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-500/20', dot: 'bg-slate-400 dark:bg-slate-400' };

/**
 * StatusBadge — premium Claymorphism pill badge with soft background & colored dot.
 * @param {string}  status
 * @param {boolean} showDot   default true
 * @param {string}  size      'sm' | 'md'
 */
const StatusBadge = ({ status, showDot = true, size = 'sm', dark, light }) => {
  const cfg = COMBINED_CONFIG[status] || FALLBACK;

  const sizeCls = size === 'md'
    ? 'px-3 py-1.5 text-xs'
    : 'px-2.5 py-1 text-[11px]';

  // For light theme inner shadow, we could rely on a CSS trick, but we can just use tailwind classes
  const boxShadowClass = "shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-none";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border whitespace-nowrap transition-all duration-200 ${sizeCls} ${cfg.base} ${boxShadowClass}`}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      )}
      {status}
    </span>
  );
};

export default StatusBadge;

