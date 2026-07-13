import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiCheckCircle, FiHelpCircle, FiBook, FiSettings,
  FiAlertCircle, FiMapPin, FiLock, FiChevronDown, FiChevronUp,
  FiMessageSquare, FiArrowRight
} from 'react-icons/fi';
import PublicLayout from '../components/PublicLayout';

const GuideContent = ({ guide }) => (
  <div className="space-y-4">
    {guide.contentItems.map((item, i) => {
      if (item.type === 'intro') return <p key={i} className="text-sm text-[#475569] leading-relaxed">{item.text}</p>;
      if (item.type === 'steps') return (
        <ol key={i} className="space-y-2 ml-2">
          {item.items.map((s, j) => (
            <li key={j} className="flex items-start gap-3 text-sm text-[#475569]">
              <span className="w-6 h-6 rounded-full bg-[#2563EB]/10 text-[#2563EB] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{j + 1}</span>
              <span dangerouslySetInnerHTML={{ __html: s }} />
            </li>
          ))}
        </ol>
      );
      if (item.type === 'list') return (
        <div key={i}>
          {item.title && <p className="text-sm font-bold text-[#0F172A] mb-2">{item.title}</p>}
          <ul className="space-y-1.5 ml-2">
            {item.items.map((s, j) => (
              <li key={j} className="flex items-start gap-2 text-sm text-[#475569]">
                <span className="text-[#2563EB] mt-1 flex-shrink-0">•</span>
                <span dangerouslySetInnerHTML={{ __html: s }} />
              </li>
            ))}
          </ul>
        </div>
      );
      if (item.type === 'info') return (
        <div key={i} className={`p-3 rounded-xl border text-sm ${item.variant === 'blue' ? 'bg-[#2563EB]/8 border-[#2563EB]/15 text-[#2563EB]' : item.variant === 'yellow' ? 'bg-amber-50 border-amber-200 text-amber-800' : item.variant === 'green' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569]'}`}>
          {item.title && <p className="font-bold mb-1">{item.title}</p>}
          <p dangerouslySetInnerHTML={{ __html: item.text }} />
        </div>
      );
      if (item.type === 'errors') return (
        <div key={i} className="space-y-3">
          {item.items.map((err, j) => (
            <div key={j} className={`p-3 rounded-xl border-l-4 ${err.color}`}>
              <p className="text-sm font-bold mb-1">{err.title}</p>
              <p className="text-sm opacity-90">{err.text}</p>
            </div>
          ))}
        </div>
      );
      return null;
    })}
  </div>
);

const SupportPage = () => {
  const navigate = useNavigate();
  const [openGuide, setOpenGuide] = useState(null);

  useEffect(() => {
    document.title = 'Support & Help Center - AttendNest | Documentation';
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', 'Get help with AttendNest. Find troubleshooting guides, how-to documentation, and step-by-step instructions for employees and administrators.');
  }, []);

  const toggleGuide = (index) => setOpenGuide(openGuide === index ? null : index);

  const guides = [
    {
      iconColor: 'bg-emerald-50 text-emerald-600',
      Icon: FiCheckCircle,
      category: 'Getting Started',
      title: 'How to Mark Attendance',
      contentItems: [
        { type: 'steps', items: [
          '<strong class="text-[#0F172A]">Login:</strong> Go to the employee login page and enter your Employee ID and password.',
          '<strong class="text-[#0F172A]">Allow Location Permissions:</strong> When prompted, click "Allow" to grant location access — required for GPS verification.',
          '<strong class="text-[#0F172A]">Check GPS Accuracy:</strong> The system shows your current GPS accuracy. Wait for it to be within acceptable limits (usually 50–300 meters).',
          '<strong class="text-[#0F172A]">Check In:</strong> Once at the office with good GPS accuracy, click the "Check In" button.',
          '<strong class="text-[#0F172A]">Wait for Confirmation:</strong> The system verifies your location and device, then confirms with a success message.',
          '<strong class="text-[#0F172A]">Check Out:</strong> When leaving, click "Check Out" to complete your attendance for the day.',
        ]},
        { type: 'info', variant: 'blue', title: 'Tip', text: 'Make sure you\'re on a stable internet connection and have good GPS signal (near windows or outdoors) for best results.' },
      ]
    },
    {
      iconColor: 'bg-blue-50 text-[#2563EB]',
      Icon: FiMapPin,
      category: 'Troubleshooting',
      title: 'Troubleshooting GPS Issues',
      contentItems: [
        { type: 'errors', items: [
          { color: 'border-amber-400 bg-amber-50 text-amber-900', title: '⚠ GPS accuracy too low', text: 'Move near a window or go outdoors. Wait a few moments for GPS to stabilize. Ensure location services are enabled in your device settings and try refreshing the page.' },
          { color: 'border-red-400 bg-red-50 text-red-900', title: '📍 Location too far from office', text: 'Ensure you are physically at the office location. If GPS is inaccurate, improve signal quality. If you\'re at the office but still see this error, contact your administrator.' },
          { color: 'border-emerald-400 bg-emerald-50 text-emerald-900', title: '🔒 Location permission denied', text: 'Click the location icon in your browser\'s address bar, change from "Block" to "Allow", then refresh the page and try again.' },
        ]}
      ]
    },
    {
      iconColor: 'bg-purple-50 text-purple-600',
      Icon: FiLock,
      category: 'Account Management',
      title: 'Password Reset Guide',
      contentItems: [
        { type: 'steps', items: [
          'Go to the employee login page and click "Forgot Password"',
          'Enter your Employee ID and registered email address',
          'Click "Send OTP" to receive a one-time password via email',
          'Check your email inbox (and spam folder) for the OTP',
          'Enter the 6-digit OTP in the verification field',
          'Create a new strong password (minimum 8 characters)',
          'Confirm your new password and click "Reset Password"',
        ]},
        { type: 'list', title: 'Password Requirements:', items: ['Minimum 8 characters long', 'Mix of letters, numbers, and symbols', 'Don\'t reuse old passwords', 'Never share your password with anyone'] },
        { type: 'info', variant: 'yellow', title: 'OTP not received?', text: 'Check your spam folder, verify your email is correct, and wait a few minutes. OTPs are valid for 10 minutes.' },
      ]
    },
    {
      iconColor: 'bg-red-50 text-red-500',
      Icon: FiAlertCircle,
      category: 'Troubleshooting',
      title: 'Common Error Messages',
      contentItems: [
        { type: 'errors', items: [
          { color: 'border-red-400 bg-red-50 text-red-900', title: '❌ "Already checked in today"', text: 'You\'ve already marked check-in for today. You can only check in once per day.' },
          { color: 'border-amber-400 bg-amber-50 text-amber-900', title: '⏱ "Too early to check in"', text: 'You\'re trying to check in before the allowed time window. Wait until the configured check-in time.' },
          { color: 'border-blue-400 bg-blue-50 text-blue-900', title: '📍 "GPS accuracy too low"', text: 'Your device\'s GPS accuracy doesn\'t meet requirements. Move to a location with better GPS signal.' },
          { color: 'border-indigo-400 bg-indigo-50 text-indigo-900', title: '📡 "Network validation failed"', text: 'You\'re not on the office network. Connect to the office Wi-Fi or check with your administrator.' },
          { color: 'border-purple-400 bg-purple-50 text-purple-900', title: '🔒 "Device not recognized"', text: 'This is a new or unrecognized device. The system will register it. Contact your admin if you see this repeatedly.' },
        ]}
      ]
    },
    {
      iconColor: 'bg-indigo-50 text-indigo-600',
      Icon: FiSettings,
      category: 'Features',
      title: 'Work From Home (WFH) Attendance',
      contentItems: [
        { type: 'intro', text: 'If your organization has enabled Work From Home attendance tracking:' },
        { type: 'steps', items: [
          'Login to your employee dashboard',
          'Look for the "Mark WFH Attendance" button or option',
          'Click the WFH attendance button',
          'The system may have relaxed location requirements for WFH',
          'Confirm your WFH attendance',
        ]},
        { type: 'list', title: 'WFH vs Office Attendance:', items: ['WFH attendance may have different validation rules', 'GPS requirements may be more flexible', 'Network validation may not be required', 'WFH days are tracked separately in reports'] },
        { type: 'info', variant: 'yellow', title: 'Note', text: 'WFH attendance policies vary by organization. Check with your administrator for specific WFH rules and requirements.' },
      ]
    },
    {
      iconColor: 'bg-teal-50 text-teal-600',
      Icon: FiBook,
      category: 'Features',
      title: 'Viewing Attendance History',
      contentItems: [
        { type: 'steps', items: [
          'Login to your employee dashboard',
          'Click "Attendance" or "Attendance History" in the navigation menu',
          'You\'ll see a table with your complete attendance history',
          'Use filters to view specific months or attendance statuses',
          'Check your attendance statistics and summaries',
        ]},
        { type: 'list', title: 'Attendance Status Types:', items: [
          '<strong class="text-[#0F172A]">Present:</strong> You checked in on time',
          '<strong class="text-[#0F172A]">Late:</strong> You checked in after the grace period',
          '<strong class="text-[#0F172A]">Absent:</strong> No attendance was marked',
          '<strong class="text-[#0F172A]">WFH:</strong> Work from home attendance',
          '<strong class="text-[#0F172A]">Holiday:</strong> Government or office holiday',
        ]},
        { type: 'info', variant: 'green', title: 'Need a Report?', text: 'Contact your administrator to generate detailed attendance reports for official or HR purposes.' },
      ]
    },
  ];

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#F8FAFC] to-[#EFF6FF]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center mx-auto mb-4"><FiHelpCircle size={26} /></div>
          <h1 className="text-4xl font-extrabold text-[#0F172A] mb-3">Support & Help Center</h1>
          <p className="text-[#475569] max-w-xl mx-auto">Find answers, troubleshooting guides, and step-by-step documentation for using AttendNest.</p>
        </div>
      </section>

      {/* Quick Access */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-white border-b border-[#E2E8F0]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-bold text-[#0F172A] mb-6 text-center">Quick Access</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { Icon: FiHelpCircle, color: 'bg-[#2563EB]/10 text-[#2563EB]', title: 'FAQ', desc: 'Frequently asked questions and quick answers', route: '/faq' },
              { Icon: FiMessageSquare, color: 'bg-emerald-50 text-emerald-600', title: 'Contact Support', desc: 'Get direct help from our support team', route: '/contact' },
              { Icon: FiLock, color: 'bg-purple-50 text-purple-600', title: 'Employee Login', desc: 'Access your employee dashboard', route: '/employee/login' },
            ].map(({ Icon, color, title, desc, route }) => (
              <button key={route} onClick={() => navigate(route)}
                className="bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-5 text-left clay-card-hover shadow-clay flex flex-col gap-3 group">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}><Icon size={18} /></div>
                <div>
                  <p className="text-sm font-bold text-[#0F172A] mb-1">{title}</p>
                  <p className="text-xs text-[#475569]">{desc}</p>
                </div>
                <FiArrowRight size={14} className="text-[#64748B] group-hover:text-[#2563EB] transition-colors self-end" />
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Guides */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-extrabold text-[#0F172A] mb-2 text-center">Documentation & Guides</h2>
          <p className="text-sm text-[#475569] text-center mb-8">Click any guide below to expand step-by-step instructions</p>
          <div className="space-y-3">
            {guides.map((guide, index) => (
              <div key={index} className={`bg-white rounded-2xl border overflow-hidden shadow-clay transition-all duration-200 ${openGuide === index ? 'border-[#2563EB]/30' : 'border-[#E2E8F0]'}`}>
                <button onClick={() => toggleGuide(index)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between hover:bg-[#F8FAFC] transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${guide.iconColor}`}>
                      <guide.Icon size={18} />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-0.5">{guide.category}</p>
                      <h3 className="text-sm font-bold text-[#0F172A]">{guide.title}</h3>
                    </div>
                  </div>
                  {openGuide === index
                    ? <FiChevronUp size={18} className="text-[#2563EB] flex-shrink-0" />
                    : <FiChevronDown size={18} className="text-[#64748B] flex-shrink-0" />}
                </button>
                {openGuide === index && (
                  <div className="px-6 pb-6 border-t border-[#E2E8F0]">
                    <div className="pt-5"><GuideContent guide={guide} /></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#2563EB] to-[#7C3AED]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-extrabold text-[#0F172A] mb-3">Still Need Help?</h2>
          <p className="text-blue-100 mb-8 text-sm">Can't find what you're looking for? Our support team is ready to assist you.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <button onClick={() => navigate('/contact')}
              className="px-7 py-3 bg-white text-[#2563EB] text-sm font-bold rounded-xl shadow-clay hover:-translate-y-0.5 transition-transform">
              Contact Support
            </button>
            <button onClick={() => navigate('/faq')}
              className="px-7 py-3 bg-white/10 border border-white/30 text-[#0F172A] text-sm font-bold rounded-xl hover:bg-white/20 transition-colors">
              View FAQ
            </button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};

export default SupportPage;
