import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import { FiCheckCircle, FiTarget, FiHeart, FiTrendingUp, FiShield } from 'react-icons/fi';

const values = [
  { icon: FiShield,    color: 'bg-[#2563EB]/10 text-[#2563EB]', title: 'Security First',        desc: 'We prioritize data security with device fingerprinting, OTP authentication, and comprehensive audit trails.' },
  { icon: FiHeart,     color: 'bg-red-50 text-red-500',          title: 'User-Centric Design',   desc: 'Designed for both employees and administrators, providing intuitive interfaces across all devices.' },
  { icon: FiTrendingUp,color: 'bg-emerald-50 text-emerald-600',  title: 'Continuous Innovation', desc: 'We constantly evolve with new features and improvements to meet the needs of modern workplaces.' },
];

const benefits = [
  { title: 'GPS-Based Verification',  desc: 'Ensure employees are at the correct location with GPS-based attendance validation and configurable accuracy thresholds.' },
  { title: 'Work From Home Support',  desc: 'Seamlessly track attendance for remote workers with dedicated WFH attendance rules and flexible validation options.' },
  { title: 'Real-Time Reporting',     desc: 'Generate comprehensive attendance reports with holidays included. Export in PDF and Excel with monthly matrix view.' },
  { title: 'Automated Processes',     desc: 'Automatic late marking, absent record creation, and auto-checkout features reduce administrative overhead.' },
  { title: 'Trusted Device System',   desc: 'Admin approval workflow for employee devices. Block unauthorized devices and approve trusted ones for secure access.' },
  { title: 'Admin Activity Logs',     desc: 'Track all administrator actions including settings changes, approvals, and data modifications with detailed audit trails.' },
  { title: 'Advanced Security',       desc: 'Device management, OTP verification, audit logs, and rate limiting protect against unauthorized access.' },
  { title: 'Holiday Management',      desc: 'Configure government and office holidays with automatic attendance rule adjustments. Holidays appear in all reports.' },
  { title: 'Data Management',         desc: 'Clear old data with GitHub-style confirmation dialogs. Free up storage by clearing audit logs and attendance records.' },
];

const AboutPage = () => {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'About Us - AttendNest | Employee Attendance Management System';
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', 'Learn about AttendNest, the comprehensive Employee Attendance Management System with GPS verification, WFH support, and real-time reporting.');
  }, []);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#F8FAFC] to-[#EFF6FF]">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#0F172A] mb-4">About <span className="text-[#2563EB]">AttendNest</span></h1>
          <p className="text-lg text-[#475569]">Building the future of employee attendance tracking with innovative technology and a security-first approach</p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-extrabold text-[#0F172A] mb-5">Our Mission</h2>
            <p className="text-[#475569] leading-relaxed mb-4">Our mission is to revolutionize employee attendance management by providing organizations with a comprehensive, secure, and user-friendly solution that adapts to modern work environments.</p>
            <p className="text-[#475569] leading-relaxed mb-4">We believe that attendance tracking should be effortless, accurate, and transparent. Our system eliminates manual processes, reduces errors, and provides real-time insights that help organizations make better workforce management decisions.</p>
            <p className="text-[#475569] leading-relaxed">Whether your team works from the office, remotely, or in a hybrid model, our attendance management system ensures accurate tracking while maintaining employee privacy and data security.</p>
          </div>
          <div className="bg-gradient-to-br from-[#2563EB]/8 to-purple-500/8 border border-[#2563EB]/15 rounded-2xl p-10 flex flex-col items-center text-center shadow-clay">
            <div className="w-14 h-14 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center mb-4"><FiTarget size={28} /></div>
            <h3 className="text-xl font-bold text-[#0F172A] mb-3">Our Vision</h3>
            <p className="text-[#475569] leading-relaxed">To become the most trusted attendance management solution globally, empowering organizations to manage their workforce efficiently while fostering transparency and accountability.</p>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-extrabold text-[#0F172A] mb-3">Our Core Values</h2>
            <p className="text-[#475569]">The principles that guide everything we do</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {values.map(({ icon: Icon, color, title, desc }) => (
              <div key={title} className="bg-white border border-[#E2E8F0] rounded-2xl p-7 text-center shadow-clay clay-card-hover hover:-translate-y-1 transition-all duration-200">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 ${color}`}><Icon size={26} /></div>
                <h3 className="text-base font-bold text-[#0F172A] mb-2">{title}</h3>
                <p className="text-sm text-[#475569] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-extrabold text-[#0F172A] mb-10 text-center">Why Choose Our System?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {benefits.map(({ title, desc }) => (
              <div key={title} className="flex items-start gap-4 p-5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl">
                <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0"><FiCheckCircle size={15} /></span>
                <div>
                  <h3 className="text-sm font-bold text-[#0F172A] mb-1">{title}</h3>
                  <p className="text-sm text-[#475569] leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#2563EB] to-[#7C3AED]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-extrabold text-[#0F172A] mb-4">Ready to Transform Your Attendance Management?</h2>
          <p className="text-blue-200 mb-8">Join organizations that trust our system for accurate, secure, and efficient employee attendance tracking</p>
          <button onClick={() => navigate('/employee/login')} className="px-8 py-3.5 bg-white text-[#2563EB] font-bold rounded-2xl hover:bg-blue-50 shadow-[0_8px_24px_rgba(0,0,0,0.2)] hover:-translate-y-0.5 transition-all">Get Started Today</button>
        </div>
      </section>
    </PublicLayout>
  );
};
export default AboutPage;
