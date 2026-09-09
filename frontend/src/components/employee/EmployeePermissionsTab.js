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

const EmployeePermissionsTab = ({ employeeId }) => {
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState([]);
  const [absentRecords, setAbsentRecords] = useState([]);
  const [summary, setSummary] = useState({});

  const fetchData = useCallback(async () => {
    if (!employeeId) return;
    try {
      setLoading(true);
      const res = await getEmployeePermissionsAndLeaves(employeeId);
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
  }, [employeeId]);

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
        <div className="p-4 rounded-2xl bg-admin-surface border border-admin-border shadow-clay-admin flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-admin-secondary">
              Permission Requests
            </span>
            <p className="text-xl font-black text-admin-text mt-0.5">
              {summary.totalPermissions ?? 0}
            </p>
            <span className="text-[11px] text-purple-400 font-medium">Approved slips</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
            <FiClock size={20} />
          </div>
        </div>

        {/* Total Permission Duration */}
        <div className="p-4 rounded-2xl bg-admin-surface border border-admin-border shadow-clay-admin flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-admin-secondary">
              Total Permitted Time
            </span>
            <p className="text-xl font-black text-admin-text mt-0.5">
              {formatMinutes(summary.totalPermissionMinutes)}
            </p>
            <span className="text-[11px] text-blue-400 font-medium">Cumulative duration</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <FiCalendar size={20} />
          </div>
        </div>

        {/* Total Leaves with Excuses */}
        <div className="p-4 rounded-2xl bg-admin-surface border border-admin-border shadow-clay-admin flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-admin-secondary">
              Absent / Leave Reasons
            </span>
            <p className="text-xl font-black text-admin-text mt-0.5">
              {summary.totalLeavesWithReason ?? 0}
            </p>
            <span className="text-[11px] text-amber-400 font-medium">Justified exceptions</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
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
                <FiClock size={16} className="text-purple-400" />
                <h3 className="text-sm font-bold text-admin-text uppercase tracking-wider">
                  Permission Slips ({permissions.length})
                </h3>
              </div>
              <button
                onClick={fetchData}
                className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-bg transition-colors"
                title="Refresh"
              >
                <FiRefreshCw size={13} />
              </button>
            </div>

            {permissions.length === 0 ? (
              <div className="p-8 text-center space-y-1.5">
                <FiClock size={24} className="text-admin-muted mx-auto" />
                <p className="text-xs font-bold text-admin-text">No Permission Records</p>
                <p className="text-[11px] text-admin-secondary">
                  This employee has not taken any official permission time.
                </p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[420px] dark-scroll space-y-2.5 pr-1">
                {permissions.map((p) => (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl bg-admin-bg/70 border border-admin-border/60 hover:border-purple-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-admin-text">{formatDate(p.permission_date)}</span>
                        <span className="px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 font-mono font-bold text-[10px]">
                          {p.duration_minutes} mins
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                        <FiCheckCircle size={10} /> Approved
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono text-admin-secondary">
                      <span className="text-admin-text font-semibold">{p.from_time_formatted || p.from_time}</span>
                      <span>→</span>
                      <span className="text-admin-text font-semibold">{p.to_time_formatted || p.to_time}</span>
                    </div>

                    {p.reason && (
                      <p className="text-[11px] text-admin-secondary bg-admin-surface/60 p-2 rounded-lg border border-admin-border/40">
                        <span className="font-semibold text-admin-text">Reason:</span> {p.reason}
                      </p>
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
                <FiFileText size={16} className="text-amber-400" />
                <h3 className="text-sm font-bold text-admin-text uppercase tracking-wider">
                  Absence Excuses & Notes ({absentRecords.length})
                </h3>
              </div>
              <button
                onClick={fetchData}
                className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-bg transition-colors"
                title="Refresh"
              >
                <FiRefreshCw size={13} />
              </button>
            </div>

            {absentRecords.length === 0 ? (
              <div className="p-8 text-center space-y-1.5">
                <FiCheckCircle size={24} className="text-emerald-400/80 mx-auto" />
                <p className="text-xs font-bold text-admin-text">No Absence Excuses</p>
                <p className="text-[11px] text-admin-secondary">
                  No unexcused absences or exception remarks recorded for this employee.
                </p>
              </div>
            ) : (
              <div className="overflow-y-auto max-h-[420px] dark-scroll space-y-2.5 pr-1">
                {absentRecords.map((r) => (
                  <div
                    key={r.id}
                    className="p-3.5 rounded-xl bg-admin-bg/70 border border-admin-border/60 hover:border-amber-500/30 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-admin-text">{formatDate(r.attendance_date)}</span>
                        <span className="px-2 py-0.5 rounded bg-red-500/15 text-red-400 font-bold text-[10px]">
                          {r.attendance_status || 'Absent'}
                        </span>
                      </div>
                      <span className="text-[10px] text-admin-muted font-mono">
                        {r.updated_at ? formatDate(r.updated_at) : ''}
                      </span>
                    </div>

                    <p className="text-[11px] text-amber-300/90 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 leading-relaxed">
                      <span className="font-bold text-amber-400 block mb-0.5">Submitted Justification:</span>
                      {r.absent_reason}
                    </p>
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
