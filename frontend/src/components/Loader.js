import React from 'react';
import { useAuth } from '../context/AuthContext';

/* Full-page loading */
const Loader = () => (
  <div className="flex items-center justify-center min-h-screen bg-[#F8FAFC]">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-[3px] border-[#E2E8F0] border-t-[#2563EB] rounded-full animate-spin" />
      <p className="text-sm text-[#475569] font-medium">Loading…</p>
    </div>
  </div>
);

/* Inline spinner */
export const Spinner = ({ size = 'md', color = 'auto', className = '' }) => {
  const auth = useAuth();
  const isAdmin = auth?.isAdmin || false;
  const px = typeof size === 'number' ? size : ({ sm: 16, md: 20, lg: 40 }[size] ?? 20);
  let trackCls;
  if (color === 'white') trackCls = 'border-white/30 border-t-white';
  else if (color === 'blue') trackCls = 'border-blue-200 border-t-blue-500';
  else if (isAdmin) trackCls = 'border-[#E2E8F0] border-t-[#60A5FA]';
  else trackCls = 'border-[#E2E8F0] border-t-[#2563EB]';

  return (
    <div className={`rounded-full border-2 animate-spin flex-shrink-0 ${trackCls} ${className}`}
      style={{ width: px, height: px }} />
  );
};

/* Page skeleton admin */
export const AdminPageSkeleton = () => (
  <div className="flex-1 p-6 lg:p-8 space-y-6 bg-[#F1F5F9] min-h-screen">
    <div className="h-7 w-40 bg-[#1C2540] rounded-xl animate-pulse" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-[#1C2540] border border-[#E2E8F0] rounded-2xl p-5 flex items-center gap-4 animate-pulse">
          <div className="w-12 h-12 rounded-xl bg-white/5 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 bg-white/5 rounded" />
            <div className="h-7 w-14 bg-white/5 rounded" />
          </div>
        </div>
      ))}
    </div>
    <div className="bg-[#1C2540] border border-[#E2E8F0] rounded-2xl p-5 space-y-3 animate-pulse">
      <div className="h-5 w-36 bg-white/5 rounded" />
      {[...Array(5)].map((_, i) => <div key={i} className="h-10 w-full bg-white/[0.03] rounded-xl" />)}
    </div>
  </div>
);

/* Page skeleton employee */
export const PageSkeleton = () => (
  <div className="flex-1 p-6 lg:p-8 space-y-6 animate-pulse">
    <div className="h-8 w-48 bg-[#E2E8F0] rounded-xl" />
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white border border-[#E2E8F0] rounded-2xl p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#F1F5F9] flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-20 bg-[#F1F5F9] rounded" />
            <div className="h-6 w-12 bg-[#F1F5F9] rounded" />
          </div>
        </div>
      ))}
    </div>
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 space-y-3">
      <div className="h-5 w-36 bg-[#F1F5F9] rounded" />
      {[...Array(5)].map((_, i) => <div key={i} className="h-10 w-full bg-[#F8FAFC] rounded-xl" />)}
    </div>
  </div>
);

/* Table skeleton admin */
export const AdminTableSkeleton = ({ rows = 5, cols = 5 }) => (
  <>
    {[...Array(rows)].map((_, i) => (
      <tr key={i} className="border-b border-white/[0.04]">
        {[...Array(cols)].map((_, j) => (
          <td key={j} className="px-4 py-3.5">
            <div className="h-4 skeleton-shimmer-dark rounded" style={{ width: `${55 + Math.random() * 35}%` }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

/* Table skeleton employee */
export const TableSkeleton = ({ rows = 5, cols = 5 }) => (
  <>
    {[...Array(rows)].map((_, i) => (
      <tr key={i} className="border-b border-[#E2E8F0]">
        {[...Array(cols)].map((_, j) => (
          <td key={j} className="px-4 py-3.5">
            <div className="h-4 skeleton-shimmer rounded" style={{ width: `${55 + Math.random() * 35}%` }} />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export default Loader;
