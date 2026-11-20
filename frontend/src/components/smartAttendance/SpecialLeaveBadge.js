import React from 'react';
import { FiCoffee } from 'react-icons/fi';

/**
 * "Special leave 11:00 AM – 3:00 PM (240 min)" pill for attendance tables.
 * Reads the summary stored on the attendance row, so it costs no extra request.
 * `light` is for the employee portal (light theme); the admin panel is dark.
 */
const SpecialLeaveBadge = ({ record, light = false, compact = false }) => {
  const summary = record?.special_leave_summary;
  if (!summary) return null;
  const minutes = Number(record.special_leave_minutes || 0);
  const title = `Special leave: ${summary}${minutes > 0 ? ` · ${minutes} min counted as LOP` : ''}`;
  const tone = light
    ? 'bg-violet-50 text-violet-700 border-violet-200'
    : 'bg-violet-500/15 text-violet-300 border-violet-500/30';
  return (
    <span title={title} className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone}`}>
      <FiCoffee size={11} aria-hidden="true" className="shrink-0" />
      {compact ? `Special leave ${minutes} min` : <span className="truncate">Special leave {summary}</span>}
    </span>
  );
};

export default SpecialLeaveBadge;
