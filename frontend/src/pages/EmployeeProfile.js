import React from 'react';
import Sidebar from '../components/Sidebar';
import { useAuth } from '../context/AuthContext';
import { FiUser, FiMail, FiPhone, FiBriefcase, FiHash, FiLayers, FiShield, FiCheckCircle } from 'react-icons/fi';

const EmployeeProfile = () => {
  const { user } = useAuth();
  const nameStr  = user?.name || 'U';
  const initials = nameStr.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex h-screen" style={{ background: '#F5F7FB' }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="px-4 py-5 lg:px-8 lg:py-7 max-w-[900px] mx-auto pt-16 lg:pt-7">

          {/* ═══ HEADER ═══ */}
          <div className="mb-6 animate-fadeInUp stagger-1">
            <h1 className="text-2xl font-bold text-[#1E293B]">My Profile</h1>
            <p className="text-sm text-[#64748B] mt-1">View your account information</p>
          </div>

          {/* ═══ PROFILE HEADER CARD ═══ */}
          <div className="clay-card-soft overflow-hidden mb-6 animate-fadeInUp stagger-2">
            {/* Banner */}
            <div className="relative bg-gradient-to-br from-[#4F6CE1] via-[#6366f1] to-[#7B93F5] px-6 py-10 lg:px-8 lg:py-12 overflow-hidden">
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/[0.06] rounded-full -translate-y-16 translate-x-16" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/[0.06] rounded-full translate-y-10 -translate-x-10" />
              <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-white/[0.04] rounded-full" />

              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 relative z-10">
                {/* Avatar */}
                <div className="w-24 h-24 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/30 flex-shrink-0 shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
                  <span className="text-4xl font-extrabold text-white">{initials}</span>
                </div>
                {/* Info */}
                <div className="text-center sm:text-left flex-1">
                  <h2 className="text-2xl lg:text-3xl font-extrabold text-white leading-tight">{nameStr}</h2>
                  <p className="text-blue-200 text-sm mt-1 font-medium">{user?.job_role || 'Employee'}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-3 justify-center sm:justify-start">
                    <span className="text-xs font-mono text-blue-100 bg-white/10 px-3 py-1 rounded-xl border border-[#CBD5E1] backdrop-blur-sm">
                      {user?.employee_id}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-100 bg-emerald-500/20 px-3 py-1 rounded-xl border border-emerald-400/30 backdrop-blur-sm">
                      <FiCheckCircle size={12} />
                      Active
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ═══ INFORMATION SECTION — Two Cards ═══ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

            {/* Personal Information */}
            <div className="clay-card-soft p-6 animate-fadeInUp stagger-3">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <FiUser size={16} className="text-[#4F6CE1]" />
                </div>
                <h3 className="text-sm font-bold text-[#1E293B]">Personal Information</h3>
              </div>

              <div className="space-y-4">
                {[
                  { icon: FiUser,  label: 'Full Name',     value: user?.name },
                  { icon: FiMail,  label: 'Email Address', value: user?.email },
                  { icon: FiPhone, label: 'Mobile Number', value: user?.mobile },
                  { icon: FiUser,  label: 'Birthday',      value: user?.date_of_birth ? new Date(user.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—' },
                ].map(field => (
                  <div key={field.label} className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E7EBF2]/80" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0 border border-[#E7EBF2]/60 shadow-[0_1px_3px_rgba(149,163,187,0.06)]">
                      <field.icon size={15} className="text-[#64748B]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{field.label}</p>
                      <p className="text-sm font-semibold text-[#1E293B] mt-0.5 break-all">{field.value || '—'}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Work Information */}
            <div className="clay-card-soft p-6 animate-fadeInUp stagger-4">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                  <FiBriefcase size={16} className="text-purple-500" />
                </div>
                <h3 className="text-sm font-bold text-[#1E293B]">Work Information</h3>
              </div>

              <div className="space-y-4">
                {[
                  { icon: FiLayers,    label: 'Department',      value: user?.department },
                  { icon: FiBriefcase, label: 'Job Role',        value: user?.job_role },
                  { icon: FiShield,    label: 'Employee Status', value: 'Active', isStatus: true },
                ].map(field => (
                  <div key={field.label} className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E7EBF2]/80" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center flex-shrink-0 border border-[#E7EBF2]/60 shadow-[0_1px_3px_rgba(149,163,187,0.06)]">
                      <field.icon size={15} className="text-[#64748B]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{field.label}</p>
                      {field.isStatus ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full mt-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          Active
                        </span>
                      ) : (
                        <p className="text-sm font-semibold text-[#1E293B] mt-0.5 break-all">{field.value || '—'}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══ ACCOUNT INFORMATION ═══ */}
          <div className="clay-card-soft p-6 animate-fadeInUp stagger-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
                <FiHash size={16} className="text-amber-500" />
              </div>
              <h3 className="text-sm font-bold text-[#1E293B]">Account Information</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Employee ID', value: user?.employee_id },
                { label: 'Username',    value: user?.username },
                { label: 'Account Role', value: 'Employee' },
              ].map(field => (
                <div key={field.label} className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E7EBF2]/80" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.9)' }}>
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider">{field.label}</p>
                  <p className="text-sm font-semibold text-[#1E293B] mt-1">{field.value || '—'}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default EmployeeProfile;
