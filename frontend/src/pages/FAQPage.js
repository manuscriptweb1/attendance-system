import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';

const faqs = [
  { category: 'General', questions: [
    { q: 'What is the Attendance Management System?', a: 'Our Attendance Management System is a comprehensive solution for tracking employee attendance with GPS verification, automated check-in/check-out, real-time reporting, and advanced security features. It supports both office-based and remote work scenarios.' },
    { q: 'Who can use this system?', a: 'The system is designed for organizations of all sizes. It has two user roles: Administrators who manage employees, configure settings, and generate reports; and Employees who mark their attendance and view their attendance history.' },
    { q: 'Is the system mobile-friendly?', a: 'Yes! The system is fully responsive and works seamlessly on smartphones, tablets, and desktop computers. Employees can mark attendance from any device with internet access.' },
  ]},
  { category: 'Attendance Process', questions: [
    { q: 'How do I mark my attendance?', a: 'Simply log in to your employee account, allow location permissions when prompted, and tap the "Check In" button. The system will verify your location and device, then record your attendance with a timestamp. When leaving, tap "Check Out" to complete your attendance for the day.' },
    { q: 'What happens if I forget to check out?', a: 'The system has an automatic checkout feature that runs at the end of the day. If you forget to check out manually, the system will automatically mark your checkout at the configured time (typically at midnight or end of business hours).' },
    { q: 'What if I arrive late to the office?', a: 'You can still check in after office hours start. The system will automatically mark you as "Late" based on the configured grace period. Your attendance will be recorded with the actual check-in time.' },
  ]},
  { category: 'GPS & Location', questions: [
    { q: 'Why does the system need my location?', a: 'GPS location verification ensures that employees are checking in from the correct office location. This prevents proxy attendance and ensures accuracy. The system only accesses your location when you mark attendance, not continuously.' },
    { q: 'What if my GPS accuracy is low?', a: 'The system has configurable GPS accuracy thresholds. If your GPS accuracy is too low, you may need to move to a location with better GPS signal, such as near a window or outdoors. The required accuracy is typically set between 50-300 meters.' },
    { q: 'Can I mark attendance without GPS?', a: 'GPS verification can be configured by administrators. Some organizations may allow attendance marking based on network validation (office IP address) instead of GPS, or may have less strict requirements for WFH employees.' },
  ]},
  { category: 'Work From Home', questions: [
    { q: 'Can I mark attendance while working from home?', a: 'Yes! The system supports work-from-home attendance. Administrators can configure separate validation rules for WFH attendance, which may have more flexible location requirements than office attendance.' },
    { q: 'How does WFH attendance differ from office attendance?', a: 'WFH attendance may have different validation rules, such as relaxed GPS requirements or network-based validation. The system tracks WFH days separately for reporting purposes.' },
  ]},
  { category: 'Security & Privacy', questions: [
    { q: 'Is my location data secure?', a: 'Yes. Your location data is encrypted and stored securely. It is only used for attendance verification and is only accessible to authorized administrators. The system does not track your location continuously — only when you mark attendance.' },
    { q: 'What is device fingerprinting?', a: 'Device fingerprinting creates a unique identifier for your device based on browser and system characteristics. This helps prevent unauthorized access and ensures that attendance is marked from recognized devices.' },
    { q: 'How does OTP authentication work?', a: 'For password reset and sensitive operations, the system sends a one-time password (OTP) to your registered email address. Enter this OTP to verify your identity and complete the operation. OTPs are valid for a limited time (typically 5 minutes).' },
  ]},
  { category: 'Password & Account', questions: [
    { q: 'How do I reset my password?', a: "Click \"Forgot Password\" on the login page and enter your registered email address. You'll receive an OTP via email. Enter the OTP, then create a new password. Make sure to use a strong password with at least 8 characters." },
    { q: "What if I don't receive the OTP email?", a: "Check your spam/junk folder first. If you still don't see it, ensure you entered the correct email address. OTP emails are typically delivered within 1-2 minutes. If issues persist, contact your administrator." },
    { q: 'Can I change my password?', a: 'Yes. After logging in, go to the "Change Password" section in the menu. You\'ll need to verify your current password first, then an OTP will be sent to your email to confirm the change.' },
  ]},
  { category: 'Troubleshooting', questions: [
    { q: "Why can't I check in?", a: 'Common reasons: 1) You\'re not at the office location (GPS verification failed), 2) Your GPS accuracy is too low, 3) You\'re not connected to the office network (if required), 4) Today is a holiday, or 5) You\'ve already checked in. Check the error message for specific details.' },
    { q: 'The system says "Location too far from office". What should I do?', a: "This means your GPS location is outside the allowed radius from the office. Ensure you're physically at the office. If you are at the office but getting this error, try moving near a window or outdoors for better GPS signal." },
    { q: 'What if the system is not working properly?', a: 'First, try refreshing your browser or clearing cache. Ensure you have a stable internet connection and location permissions are granted. If the problem persists, contact your system administrator or IT support team.' },
  ]},
];

const FAQPage = () => {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    document.title = 'FAQ - AttendNest | Frequently Asked Questions';
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', 'Find answers to frequently asked questions about AttendNest — GPS tracking, check-in process, password reset, security features, and troubleshooting.');
  }, []);

  const toggle = (catI, qI) => { const k = `${catI}-${qI}`; setOpenIndex(openIndex === k ? null : k); };

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#F8FAFC] to-[#EFF6FF]">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-[#0F172A] mb-4">Frequently Asked <span className="text-[#2563EB]">Questions</span></h1>
          <p className="text-lg text-[#475569]">Find answers to common questions about our Attendance Management System</p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto space-y-10">
          {faqs.map((cat, ci) => (
            <div key={ci}>
              <h2 className="text-sm font-bold text-[#64748B] uppercase tracking-widest mb-4">{cat.category}</h2>
              <div className="space-y-2">
                {cat.questions.map((faq, qi) => {
                  const key = `${ci}-${qi}`;
                  const isOpen = openIndex === key;
                  return (
                    <div key={qi} className={`bg-[#F8FAFC] border rounded-2xl overflow-hidden transition-all duration-200 ${isOpen ? 'border-[#2563EB]/30 shadow-clay' : 'border-[#E2E8F0]'}`}>
                      <button onClick={() => toggle(ci, qi)} className="w-full px-5 py-4 text-left flex justify-between items-center gap-4">
                        <span className={`text-sm font-semibold ${isOpen ? 'text-[#2563EB]' : 'text-[#0F172A]'}`}>{faq.q}</span>
                        <span className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${isOpen ? 'bg-[#2563EB]/10 text-[#2563EB]' : 'bg-[#E2E8F0] text-[#64748B]'}`}>
                          {isOpen ? <FiChevronUp size={14} /> : <FiChevronDown size={14} />}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-5">
                          <div className="h-px bg-[#E2E8F0] mb-4" />
                          <p className="text-sm text-[#475569] leading-relaxed">{faq.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#F8FAFC]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl font-extrabold text-[#0F172A] mb-3">Still Have Questions?</h2>
          <p className="text-[#475569] mb-6">Can't find the answer you're looking for? Contact our support team.</p>
          <button onClick={() => navigate('/contact')} className="px-8 py-3.5 bg-[#2563EB] text-[#0F172A] font-bold rounded-2xl hover:bg-blue-700 shadow-[0_4px_16px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 transition-all">Contact Support</button>
        </div>
      </section>
    </PublicLayout>
  );
};
export default FAQPage;
