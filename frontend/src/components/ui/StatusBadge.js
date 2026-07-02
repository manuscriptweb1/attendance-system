import React from 'react';

const STATUS_CONFIG = {
  'Present':           { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200/80', dot: 'bg-emerald-500' },
  'Currently Working': { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200/80', dot: 'bg-emerald-500' },
  'Late':              { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200/80',   dot: 'bg-amber-500'   },
  'Half Day':          { bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-200/80',  dot: 'bg-orange-500'  },
  'Absent':            { bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200/80',     dot: 'bg-red-500'     },
  'Not Mention':       { bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-200/80',   dot: 'bg-slate-400'   },
  'Work From Home':    { bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200/80',    dot: 'bg-blue-500'    },
  'Government Holiday':{ bg: 'bg-purple-50',   text: 'text-purple-700',  border: 'border-purple-200/80',  dot: 'bg-purple-500'  },
  'Office Holiday':    { bg: 'bg-violet-50',   text: 'text-violet-700',  border: 'border-violet-200/80',  dot: 'bg-violet-500'  },
  'Sunday':            { bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-200/80',   dot: 'bg-slate-400'   },
  'Active':            { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200/80', dot: 'bg-emerald-500' },
  'Inactive':          { bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200/80',     dot: 'bg-red-500'     },
};

const DARK_CONFIG = {
  'Present':           { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
  'Currently Working': { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
  'Late':              { bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/25',   dot: 'bg-amber-400'   },
  'Half Day':          { bg: 'bg-orange-500/15',  text: 'text-orange-400',  border: 'border-orange-500/25',  dot: 'bg-orange-400'  },
  'Absent':            { bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/25',     dot: 'bg-red-400'     },
  'Not Mention':       { bg: 'bg-slate-500/15',   text: 'text-slate-400',   border: 'border-slate-500/20',   dot: 'bg-slate-500'   },
  'Work From Home':    { bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/25',    dot: 'bg-blue-400'    },
  'Government Holiday':{ bg: 'bg-purple-500/15',  text: 'text-purple-400',  border: 'border-purple-500/25',  dot: 'bg-purple-400'  },
  'Office Holiday':    { bg: 'bg-violet-500/15',  text: 'text-violet-400',  border: 'border-violet-500/25',  dot: 'bg-violet-400'  },
  'Sunday':            { bg: 'bg-slate-500/15',   text: 'text-slate-400',   border: 'border-slate-500/20',   dot: 'bg-slate-500'   },
  'Active':            { bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/25', dot: 'bg-emerald-400' },
  'Inactive':          { bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/25',     dot: 'bg-red-400'     },
};

const FALLBACK_LIGHT = { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200/80', dot: 'bg-slate-400' };
const FALLBACK_DARK  = { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/20', dot: 'bg-slate-400' };

/**
 * StatusBadge — premium Claymorphism pill badge with soft background & colored dot.
 * @param {string}  status
 * @param {boolean} showDot   default true
 * @param {string}  size      'sm' | 'md'
 * @param {boolean} dark      force dark variant (admin context)
 * @param {boolean} light     force light variant (employee context)
 */
const StatusBadge = ({ status, showDot = true, size = 'sm', dark = false, light = false }) => {
  const useDark = dark && !light;
  const cfg = useDark
    ? (DARK_CONFIG[status] || FALLBACK_DARK)
    : (STATUS_CONFIG[status] || FALLBACK_LIGHT);

  const sizeCls = size === 'md'
    ? 'px-3 py-1.5 text-xs'
    : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold rounded-full border whitespace-nowrap transition-all duration-200 ${sizeCls} ${cfg.bg} ${cfg.text} ${cfg.border}`}
      style={!useDark ? { boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' } : undefined}
    >
      {showDot && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
      )}
      {status}
    </span>
  );
};

export default StatusBadge;

