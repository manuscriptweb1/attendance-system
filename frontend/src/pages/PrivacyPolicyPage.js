import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import { FiShield, FiLock, FiMapPin, FiDatabase } from 'react-icons/fi';

const Section = ({ icon: Icon, color, title, children }) => (
  <div className="mb-10">
    {Icon && (
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}><Icon size={17} /></div>
        <h2 className="text-lg font-bold text-[#0F172A]">{title}</h2>
      </div>
    )}
    {!Icon && <h2 className="text-lg font-bold text-[#0F172A] mb-4">{title}</h2>}
    {children}
  </div>
);
const Sub = ({ title, children }) => (<div className="mt-5"><h3 className="text-sm font-bold text-[#0F172A] mb-2">{title}</h3>{children}</div>);
const P = ({ children }) => <p className="text-sm text-[#475569] leading-relaxed mb-3">{children}</p>;
const Ul = ({ items }) => <ul className="space-y-1.5 ml-4">{items.map((item,i) => <li key={i} className="flex items-start gap-2 text-sm text-[#475569]"><span className="text-[#2563EB] mt-1 flex-shrink-0">•</span>{item}</li>)}</ul>;

const PrivacyPolicyPage = () => {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'Privacy Policy - AttendNest | Data Protection';
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', 'Read our Privacy Policy to understand how we collect, use, and protect your data in our Attendance Management System.');
  }, []);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#F8FAFC] to-[#EFF6FF]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center mx-auto mb-4"><FiShield size={26} /></div>
          <h1 className="text-4xl font-extrabold text-[#0F172A] mb-3">Privacy Policy</h1>
          <p className="text-[#475569]">Your privacy and data security are our top priorities</p>
          <p className="text-xs text-[#64748B] mt-3">Last Updated: {new Date().toLocaleDateString()}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-8 md:p-10 shadow-clay">
          <Section title="Introduction">
            <P>This Privacy Policy describes how AttendNest ("we," "us," or "our") collects, uses, and protects the personal information of employees and administrators who use our system. By using our system, you agree to the collection and use of information in accordance with this policy.</P>
          </Section>

          <Section icon={FiDatabase} color="bg-[#2563EB]/10 text-[#2563EB]" title="Information We Collect">
            <Sub title="1. Personal Information">
              <P>We collect the following when your organization registers you:</P>
              <Ul items={['Employee ID, name, email address, and phone number','Department and job role information','Login credentials (passwords are encrypted and never stored in plain text)']} />
            </Sub>
            <Sub title="2. Location Data">
              <P>When you mark attendance, we collect GPS location data including latitude/longitude coordinates, GPS accuracy measurements, and timestamp of location capture.</P>
              <div className="mt-3 p-3 bg-[#2563EB]/8 border border-[#2563EB]/15 rounded-xl text-xs text-[#2563EB] font-semibold">⚠ Location data is only collected when you actively mark attendance. We do not track your location continuously.</div>
            </Sub>
            <Sub title="3. Device Information">
              <P>For security purposes, we collect device fingerprint information including:</P>
              <Ul items={['Browser type and version','Operating system','Screen resolution','Device characteristics (unique device identifier)','IP address']} />
            </Sub>
            <Sub title="4. Attendance Records">
              <Ul items={['Check-in and check-out timestamps','Attendance status (Present, Late, Absent, WFH)','Working hours calculations','Attendance history and statistics']} />
            </Sub>
          </Section>

          <Section icon={FiLock} color="bg-purple-50 text-purple-600" title="How We Use Your Information">
            <Ul items={['Attendance Tracking: To record and verify employee attendance','Location Verification: To ensure employees are at the correct work location','Security: To prevent unauthorized access and fraudulent attendance marking','Reporting: To generate attendance reports and analytics for management','Communication: To send notifications, OTPs, and system updates','Compliance: To comply with organizational attendance policies and labor regulations']} />
          </Section>

          <Section icon={FiShield} color="bg-emerald-50 text-emerald-600" title="Data Protection and Security">
            <Ul items={['Encryption: All passwords are hashed using bcrypt encryption','Secure Communication: Data is encrypted using HTTPS','Access Control: Role-based access ensures only authorized personnel can view your information','Audit Logs: All system activities are logged for security monitoring','Rate Limiting: Protection against brute-force attacks and abuse','Device Fingerprinting: Prevents unauthorized device access']} />
          </Section>

          <Section icon={FiMapPin} color="bg-red-50 text-red-500" title="Location Data Usage Policy">
            <Ul items={['Location data is only accessed when you actively click check-in or check-out','We do not track your location continuously or when the app is not in use','Location data is used solely for verifying you are at the correct work location','Your location data is only accessible to authorized administrators within your organization','Location data is retained as part of attendance records for reporting and compliance']} />
          </Section>

          <Section title="Data Sharing and Disclosure">
            <P>We do not sell, trade, or rent your personal information to third parties. Your data may be shared only within your organization (with authorized administrators and HR personnel), if required by law, or to investigate security incidents.</P>
          </Section>

          <Section title="Data Retention">
            <Ul items={['Active employee data is retained while you are employed by the organization','Attendance records are retained according to organizational policies and legal requirements','Audit logs and security records are retained for security monitoring purposes','Upon account deactivation, your data may be archived or deleted according to organizational data retention policies']} />
          </Section>

          <Section title="Your Rights">
            <Ul items={['Access: View your attendance history and profile information through your employee dashboard','Correction: Update your profile information (contact administrators for other changes)','Password Management: Change your password or reset it using the forgot password feature','Data Deletion: Contact your organization\'s administrator to request data deletion (subject to legal retention requirements)']} />
          </Section>

          <Section title="Cookies and Tracking">
            <P>We use session cookies to maintain your login state and improve system functionality. We do not use third-party tracking cookies or analytics that track your behavior across other websites.</P>
          </Section>

          <Section title="Changes to This Policy">
            <P>We may update this Privacy Policy from time to time. We will notify users of any material changes by updating the "Last Updated" date. Continued use of the system after changes constitutes acceptance of the updated policy.</P>
          </Section>

          <div className="mt-8 p-6 bg-[#2563EB]/8 border border-[#2563EB]/15 rounded-2xl">
            <h2 className="text-sm font-bold text-[#0F172A] mb-3">Questions or Concerns?</h2>
            <P>If you have questions about this Privacy Policy or how we handle your data, please contact your Organization's Administrator for data access requests, email us at <span className="font-semibold text-[#2563EB]">privacy@attendancesystem.com</span>, or{' '}<button onClick={() => navigate('/contact')} className="text-[#2563EB] font-semibold hover:text-blue-700">Contact Support</button>.</P>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
export default PrivacyPolicyPage;
