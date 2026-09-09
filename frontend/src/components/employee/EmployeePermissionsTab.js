import React, { useState, useEffect, useCallback } from 'react';
import {
  FiClock,
  FiCalendar,
  FiFileText,
  FiCheckCircle,
  FiRefreshCw
} from 'react-icons/fi';
import { Spinner } from '../Loader';
import { getEmployeePermissionsAndLeaves } from '../../services/api';
import { formatDate } from '../../utils/dateUtils';

const EmployeePermissionsTab = ({ employeeId, employee }) => {
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);
  const [absentRecords, setAbsentRecords] = useState([]);
  const [summary, setSummary] = useState({});

  const effectiveId = employeeId || employee?.id || employee?.employee_id;

  const fetchData = useCallback(async () => {
    if (!effectiveId) return;
    try {
      setLoading(true);
      const res = await getEmployeePermissionsAndLeaves(effectiveId);
      if (res.data?.success) {
        setPermissions(res.data.permissions || []);
        setAbsentRecords(res.data.absentRecords || []);
        setSummary(res.data.summary || {});
      }
    } catch (err) {
      console.error('Error fetching permissions and leaves:', err);
    } finally {
      setLoading(false);
    }
  }, [effectiveId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatMinutes = (totalMinutes) => {
    const mins = Number(totalMinutes || 0);
    if (mins <= 0) return '0 mins';
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0 && m > 0) return `${h} hr ${m} mins`;
    if (h > 0) return `${h} hr${h > 1 ? 's' : ''}`;
    return `${m} mins`;
  };

  return (
    <div className="space-y-6">
      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Permissions */}
        <div className="p-4 rounded-2xl bg-white dark:bg-admin-surface border border-purple-300/80 dark:border-purple-500/30 shadow-clay-admin flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Permission Requests
            </span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              {summary.totalPermissions ?? 0}
            </p>
            <span className="inline-block px-2.5 py-0.5 rounded-md bg-purple-200 text-purple-950 dark:bg-purple-950 dark:text-purple-100 font-black text-xs border border-purple-400 dark:border-purple-600 mt-1 shadow-sm">
              Approved slips
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-100 border border-purple-300/80 dark:bg-purple-500/20 dark:border-purple-500/30 flex items-center justify-center text-purple-800 dark:text-purple-300 shrink-0">
            <FiClock size={20} />
          </div>
        </div>

        {/* Total Permission Duration */}
        <div className="p-4 rounded-2xl bg-white dark:bg-admin-surface border border-blue-300/80 dark:border-blue-500/30 shadow-clay-admin flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Total Permitted Time
            </span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              {formatMinutes(summary.totalPermissionMinutes)}
            </p>
            <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-200 text-blue-950 dark:bg-blue-950 dark:text-blue-100 font-black text-xs border border-blue-400 dark:border-blue-600 mt-1 shadow-sm">
              Cumulative duration
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-100 border border-blue-300/80 dark:bg-blue-500/20 dark:border-blue-500/30 flex items-center justify-center text-blue-800 dark:text-blue-300 shrink-0">
            <FiCalendar size={20} />
          </div>
        </div>

        {/* Total Leaves with Excuses */}
        <div className="p-4 rounded-2xl bg-white dark:bg-admin-surface border border-amber-300/80 dark:border-amber-500/30 shadow-clay-admin flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Absent / Leave Reasons
            </span>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">
              {summary.totalLeavesWithReason ?? 0}
            </p>
            <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-200 text-amber-950 dark:bg-amber-950 dark:text-amber-100 font-black text-xs border border-amber-400 dark:border-amber-600 mt-1 shadow-sm">
              Justified exceptions
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-100 border border-amber-300/80 dark:bg-amber-500/20 dark:border-amber-500/30 flex items-center justify-center text-amber-800 dark:text-amber-300 shrink-0">
            <FiFileText size={20} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 bg-admin-surface border border-admin-border rounded-2xl flex flex-col items-center justify-center">
          <Spinner size="md" />
          <p className="text-xs text-admin-secondary mt-2">Loading permissions and leave records...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left Column: Official Permissions Log */}
          <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 shadow-clay-admin space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-admin-border/60">
              <div className="flex items-center gap-2">
                <FiClock size={16} className="text-purple-700 dark:text-purple-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Permission Slips ({permissions.length})
                </h3>
              </div>
              <button
                onClick={fetchData}
                className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-bg transition-colors cursor-pointer"
                title="Refresh"
              >
                <FiRefreshCw size={13} />
              </button>
            </div>

            {permissions.length === 0 ? (
              <div className="p-8 text-center space-y-1.5">
                <FiClock size={24} className="text-slate-400 dark:text-admin-muted mx-auto" />
                <p className="text-xs font-bold text-slate-800 dark:text-admin-text">No Permission Records</p>
                <p className="text-[11px] text-slate-600 dark:text-admin-secondary">
                  This employee has not taken any official permission time.
                </p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[420px] dark-scroll space-y-3 pr-1">
                {permissions.map((p) => (
                  <div
                    key={p.id}
                    className="p-4 rounded-xl bg-white dark:bg-admin-bg/70 border border-slate-200 dark:border-admin-border/60 hover:border-purple-400 dark:hover:border-purple-500/40 transition-all space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-white text-xs">{formatDate(p.permission_date)}</span>
                        <span className="px-2.5 py-0.5 rounded-md bg-purple-200 text-purple-950 dark:bg-purple-900/80 dark:text-purple-100 font-mono font-black text-xs border border-purple-400 dark:border-purple-500 shadow-sm">
                          {p.duration_minutes} mins
                        </span>
                      </div>
                      <span className="text-xs text-emerald-950 dark:text-emerald-200 font-black flex items-center gap-1.5 bg-emerald-100 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-500/50">
                        <FiCheckCircle size={12} className="text-emerald-700 dark:text-emerald-400" /> Approved
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono">
                      <span className="text-slate-950 dark:text-white font-extrabold">{p.from_time_formatted || p.from_time}</span>
                      <span className="text-slate-600 dark:text-slate-400 font-bold">→</span>
                      <span className="text-slate-950 dark:text-white font-extrabold">{p.to_time_formatted || p.to_time}</span>
                    </div>

                    {p.reason && (
                      <div className="bg-slate-100/90 dark:bg-admin-surface/90 p-2.5 rounded-lg border border-slate-300 dark:border-admin-border/70 text-xs">
                        <span className="font-black text-slate-950 dark:text-white mr-1.5">Reason:</span>
                        <span className="font-bold text-slate-900 dark:text-slate-100">{p.reason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Absence Excuses & Justifications Log */}
          <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 shadow-clay-admin space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-admin-border/60">
              <div className="flex items-center gap-2">
                <FiFileText size={16} className="text-amber-700 dark:text-amber-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Absence Excuses & Notes ({absentRecords.length})
                </h3>
              </div>
              <button
                onClick={fetchData}
                className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-bg transition-colors cursor-pointer"
                title="Refresh"
              >
                <FiRefreshCw size={13} />
              </button>
            </div>

            {absentRecords.length === 0 ? (
              <div className="p-8 text-center space-y-1.5">
                <FiCheckCircle size={24} className="text-emerald-700 dark:text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-slate-800 dark:text-admin-text">No Absence Excuses</p>
                <p className="text-[11px] text-slate-600 dark:text-admin-secondary">
                  No unexcused absences or exception remarks recorded for this employee.
                </p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[420px] dark-scroll space-y-3 pr-1">
                {absentRecords.map((r) => (
                  <div
                    key={r.id}
                    className="p-4 rounded-xl bg-white dark:bg-admin-bg/70 border border-slate-200 dark:border-admin-border/60 hover:border-amber-400 dark:hover:border-amber-500/40 transition-all space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-900 dark:text-white text-xs">{formatDate(r.attendance_date)}</span>
                        <span className="px-2.5 py-0.5 rounded-md bg-red-100 text-red-950 dark:bg-red-950/70 dark:text-red-200 border border-red-300 dark:border-red-500/50 font-black text-[10px]">
                          {r.attendance_status || 'Absent'}
                        </span>
                      </div>
                      {r.updated_at && (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-600 font-mono font-bold text-xs shadow-sm"
                          title="Logged / Updated Date"
                        >
                          <FiCalendar size={12} className="text-slate-600 dark:text-slate-400" />
                          <span>{formatDate(r.updated_at)}</span>
                        </span>
                      )}
                    </div>

                    <div className="bg-amber-50/90 dark:bg-amber-950/40 p-3.5 rounded-xl border-2 border-amber-400/80 dark:border-amber-500/50 leading-relaxed shadow-sm">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <FiFileText size={13} className="text-amber-900 dark:text-amber-300" />
                        <span className="font-black text-amber-950 dark:text-amber-200 text-[11px] uppercase tracking-wider">
                          Submitted Justification:
                        </span>
                      </div>
                      <p className="font-bold text-slate-950 dark:text-amber-50 text-xs pl-3.5 border-l-2 border-amber-500 dark:border-amber-400">
                        {r.absent_reason}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

export default EmployeePermissionsTab;
