import React from 'react';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import { FiCheckCircle, FiClock, FiMapPin, FiHome, FiUsers, FiCalendar, FiFileText, FiShield, FiBarChart2, FiLock, FiArrowRight } from 'react-icons/fi';

const features = [
  { icon: FiCheckCircle, color: 'bg-[#2563EB]/10 text-[#2563EB]', title: 'Attendance Tracking',      desc: 'Track employee attendance in real-time with automated check-in and check-out' },
  { icon: FiClock,       color: 'bg-emerald-50 text-emerald-600',  title: 'Check-In & Check-Out',    desc: 'Easy and secure attendance marking with timestamp recording' },
  { icon: FiMapPin,      color: 'bg-red-50 text-red-500',          title: 'GPS Verification',         desc: 'Verify employee location with GPS-based attendance validation' },
  { icon: FiHome,        color: 'bg-purple-50 text-purple-600',    title: 'Work From Home',           desc: 'Support for remote work with WFH attendance tracking' },
  { icon: FiUsers,       color: 'bg-indigo-50 text-indigo-600',    title: 'Employee Management',      desc: 'Complete management with profiles, departments, and roles' },
  { icon: FiCalendar,    color: 'bg-amber-50 text-amber-600',      title: 'Holiday Management',       desc: 'Manage holidays with reports showing holiday information' },
  { icon: FiFileText,    color: 'bg-teal-50 text-teal-600',        title: 'Attendance Reports',       desc: 'Generate reports with holidays included in PDF and Excel' },
  { icon: FiLock,        color: 'bg-pink-50 text-pink-600',        title: 'OTP Verification',         desc: 'Secure password reset and authentication with OTP' },
  { icon: FiShield,      color: 'bg-orange-50 text-orange-600',    title: 'Device Management',        desc: 'Admin approval for trusted devices and security monitoring' },
  { icon: FiBarChart2,   color: 'bg-cyan-50 text-cyan-600',        title: 'Admin Activity Logs',      desc: 'Track all admin actions with comprehensive audit logging' },
];

const benefits = [
  'Real-time attendance tracking and monitoring',
  'GPS and network-based validation',
  'Automated reports with holiday information',
  'Secure authentication with OTP',
  'Trusted device approval system',
  'Work from home support',
  'Admin activity audit logs',
  'Data cleanup and storage management',
  'Mobile responsive design',
];

const screenshots = [
  { icon: FiUsers,     gradient: 'from-blue-400 to-blue-600',   src: '/screenshots/employee-dashboard.png', title: 'Employee Dashboard',  desc: 'Check-in, check-out, and view attendance history' },
  { icon: FiBarChart2, gradient: 'from-purple-400 to-purple-600', src: '/screenshots/admin-dashboard.png',  title: 'Admin Dashboard',     desc: 'Monitor attendance, manage employees, and analytics' },
  { icon: FiFileText,  gradient: 'from-emerald-400 to-emerald-600', src: '/screenshots/attendance-reports.png', title: 'Reports',          desc: 'Generate detailed reports with PDF and Excel export' },
  { icon: FiShield,    gradient: 'from-red-400 to-red-600',     src: '/screenshots/security-logs.png',     title: 'Security Logs',       desc: 'Track device fingerprints, audit logs, and security events' },
];

const LandingPage = () => {
  const navigate = useNavigate();
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#F8FAFC] via-white to-[#EFF6FF] py-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-[#2563EB]/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />
        <div className="max-w-7xl mx-auto text-center relative z-10 pt-4">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-[#0F172A] mb-6 leading-tight">
            Employee Attendance<br /><span className="text-[#2563EB]">Management System</span>
          </h1>
          <p className="text-lg text-[#475569] mb-10 max-w-2xl mx-auto leading-relaxed">
            Manage employee attendance efficiently with secure check-in, GPS tracking, work-from-home support, attendance reports, and employee management.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={() => navigate('/employee/login')}
              className="flex items-center justify-center gap-2 px-8 py-3.5 bg-[#2563EB] text-white font-bold rounded-2xl shadow-[0_8px_24px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 hover:bg-blue-700 transition-all duration-200">
              Login <FiArrowRight size={16} />
            </button>
            <button onClick={() => document.getElementById('features').scrollIntoView({ behavior:'smooth' })}
              className="flex items-center justify-center gap-2 px-8 py-3.5 bg-white text-[#0F172A] font-bold rounded-2xl border border-[#E2E8F0] shadow-clay hover:-translate-y-0.5 transition-all duration-200">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] mb-3">Powerful Features</h2>
            <p className="text-[#475569] text-lg">Everything you need to manage employee attendance effectively</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {features.map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 hover:shadow-clay hover:-translate-y-1 transition-all duration-200 clay-card-hover">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${color}`}><Icon size={18} /></div>
                <h3 className="text-sm font-bold text-[#0F172A] mb-1.5">{title}</h3>
                <p className="text-xs text-[#475569] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] mb-5">About Our System</h2>
            <p className="text-[#475569] leading-relaxed mb-4">Manuscript Attendance is a comprehensive solution designed to streamline employee attendance tracking. Built with modern technology and security best practices, it provides organizations with powerful tools to monitor and manage workforce attendance efficiently.</p>
            <p className="text-[#475569] leading-relaxed mb-4">Supports both office-based and remote work with GPS verification, network validation, and flexible attendance policies. Administrators can manage employees, generate reports, and monitor attendance in real-time.</p>
            <p className="text-[#475569] leading-relaxed">With automatic late marking, holiday management, OTP-based security, and detailed audit logs — ensuring accuracy, security, and compliance.</p>
          </div>
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 shadow-clay">
            <h3 className="text-lg font-bold text-[#0F172A] mb-5">Key Benefits</h3>
            <ul className="space-y-3">
              {benefits.map(b => (
                <li key={b} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0"><FiCheckCircle size={12} /></span>
                  <span className="text-sm text-[#475569]">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] mb-3">System Overview</h2>
            <p className="text-[#475569] text-lg">A glimpse of our powerful attendance management interface</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {screenshots.map(({ icon: Icon, gradient, src, title, desc }) => (
              <div key={title} className="rounded-2xl overflow-hidden border border-[#E2E8F0] shadow-clay clay-card-hover hover:shadow-clay-hover hover:-translate-y-1 transition-all duration-200">
                <img src={src} alt={title} className="w-full h-auto" onError={(e) => { e.target.style.display='none'; e.target.nextElementSibling.style.display='flex'; }} />
                <div className={`bg-gradient-to-br ${gradient} p-8 h-52 flex-col items-center justify-center hidden`}>
                  <Icon size={44} className="text-[#0F172A] mb-3 opacity-90" />
                  <h3 className="text-lg font-bold text-[#0F172A]">{title}</h3>
                  <p className="text-[#0F172A]/80 text-sm text-center mt-1">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#2563EB] to-[#7C3AED]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-blue-200 text-lg mb-8">Start managing your employee attendance efficiently today</p>
          <button onClick={() => navigate('/employee/login')}
            className="px-8 py-3.5 bg-white text-[#2563EB] font-bold rounded-2xl hover:bg-blue-50 shadow-[0_8px_24px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 transition-all duration-200">
            Login Now
          </button>
        </div>
      </section>
    </PublicLayout>
  );
};

export default LandingPage;
