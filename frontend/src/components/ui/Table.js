import React from 'react';

/* ── Admin dark table wrappers ── */
export const AdminTableWrapper = ({ children, className = '' }) => (
  <div className={`bg-[#F8FAFC] border border-white/[0.07] rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.04)] ${className}`}>
    <div className="overflow-x-auto dark-scroll">
      <table className="min-w-full divide-y divide-white/[0.05]">{children}</table>
    </div>
  </div>
);
export const AdminTableHead = ({ children }) => (
  <thead className="bg-[#F1F5F9]/60">{children}</thead>
);
export const AdminTh = ({ children, className = '' }) => (
  <th className={`px-4 py-3 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-widest whitespace-nowrap ${className}`}>{children}</th>
);
export const AdminTableBody = ({ children }) => (
  <tbody className="divide-y divide-white/[0.04]">{children}</tbody>
);
export const AdminTableRow = ({ children, className = '' }) => (
  <tr className={`admin-table-row transition-colors ${className}`}>{children}</tr>
);
export const AdminTd = ({ children, className = '' }) => (
  <td className={`px-4 py-3.5 text-sm text-[#475569] whitespace-nowrap ${className}`}>{children}</td>
);
export const AdminEmptyRow = ({ cols, message = 'No records found', icon }) => (
  <tr>
    <td colSpan={cols} className="px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-3 text-[#475569]">
        {icon && <span className="text-3xl opacity-50">{icon}</span>}
        <p className="text-sm font-medium text-[#64748B]">{message}</p>
      </div>
    </td>
  </tr>
);

/* ── Employee light table wrappers ── */
export const TableWrapper = ({ children, className = '' }) => (
  <div className={`bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden shadow-clay ${className}`}>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-[#E2E8F0]">{children}</table>
    </div>
  </div>
);
export const TableHead = ({ children }) => (
  <thead className="bg-[#F8FAFC]">{children}</thead>
);
export const Th = ({ children, className = '' }) => (
  <th className={`px-4 py-3 text-left text-[10px] font-bold text-[#475569] uppercase tracking-widest whitespace-nowrap ${className}`}>{children}</th>
);
export const TableBody = ({ children }) => (
  <tbody className="divide-y divide-[#E2E8F0] bg-white">{children}</tbody>
);
export const TableRow = ({ children, className = '' }) => (
  <tr className={`emp-table-row ${className}`}>{children}</tr>
);
export const Td = ({ children, className = '' }) => (
  <td className={`px-4 py-3.5 text-sm text-[#475569] whitespace-nowrap ${className}`}>{children}</td>
);
export const EmptyRow = ({ cols, message = 'No records found', icon }) => (
  <tr>
    <td colSpan={cols} className="px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-3 text-[#64748B]">
        {icon && <span className="text-3xl">{icon}</span>}
        <p className="text-sm font-medium">{message}</p>
      </div>
    </td>
  </tr>
);
