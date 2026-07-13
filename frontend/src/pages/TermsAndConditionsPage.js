import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PublicLayout from '../components/PublicLayout';
import { FiFileText, FiAlertCircle } from 'react-icons/fi';

const P = ({ children }) => <p className="text-sm text-[#475569] leading-relaxed mb-3">{children}</p>;
const Ul = ({ items }) => <ul className="space-y-1.5 ml-4 mb-3">{items.map((item,i) => <li key={i} className="flex items-start gap-2 text-sm text-[#475569]"><span className="text-[#2563EB] mt-1 flex-shrink-0">•</span><span>{item}</span></li>)}</ul>;
const Section = ({ num, title, children }) => (
  <div className="mb-10">
    <h2 className="text-base font-bold text-[#0F172A] mb-3">{num}. {title}</h2>
    {children}
  </div>
);
const Sub = ({ title, children }) => <div className="mt-4 mb-2"><h3 className="text-sm font-bold text-[#475569] mb-2">{title}</h3>{children}</div>;

const TermsAndConditionsPage = () => {
  const navigate = useNavigate();
  useEffect(() => {
    document.title = 'Terms and Conditions - AttendNest | Usage Terms';
    const m = document.querySelector('meta[name="description"]');
    if (m) m.setAttribute('content', 'Read our Terms and Conditions for using AttendNest. Understand user responsibilities, system usage guidelines, and acceptable use policies.');
  }, []);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-[#F8FAFC] to-[#EFF6FF]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#2563EB]/10 text-[#2563EB] flex items-center justify-center mx-auto mb-4"><FiFileText size={26} /></div>
          <h1 className="text-4xl font-extrabold text-[#0F172A] mb-3">Terms and Conditions</h1>
          <p className="text-[#475569]">Please read these terms carefully before using our system</p>
          <p className="text-xs text-[#64748B] mt-3">Last Updated: {new Date().toLocaleDateString()}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-14 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl p-8 md:p-10 shadow-clay">
          <Section num="1" title="Acceptance of Terms">
            <P>By accessing and using the AttendNest System ("the System"), you accept and agree to be bound by these Terms and Conditions. If you do not agree to these terms, you must not use the System.</P>
            <P>These terms apply to all users of the System, including employees and administrators, and govern your access to and use of the System.</P>
          </Section>

          <Section num="2" title="User Accounts and Responsibilities">
            <Sub title="2.1 Account Creation">
              <P>User accounts are created by your organization's administrators. You are responsible for:</P>
              <Ul items={['Maintaining the confidentiality of your login credentials','All activities that occur under your account','Notifying your administrator immediately of any unauthorized access','Creating a strong, secure password and changing it regularly']} />
            </Sub>
            <Sub title="2.2 Account Security — You must NOT:">
              <Ul items={['Share your login credentials with anyone','Allow others to mark attendance on your behalf','Use another person\'s account','Attempt to access accounts you are not authorized to use']} />
            </Sub>
          </Section>

          <Section num="3" title="Acceptable Use Policy">
            <Sub title="3.1 Permitted Use">
              <Ul items={['Mark your attendance accurately and honestly','Check in only when physically present at the authorized location (or as per WFH policies)','Provide accurate location data when required','Use the System in accordance with your organization\'s attendance policies','Comply with all applicable laws and regulations']} />
            </Sub>
            <Sub title="3.2 Prohibited Activities — You must NOT:">
              <Ul items={['Attempt to mark fraudulent or false attendance','Use location spoofing, VPNs, or other tools to manipulate your location data','Attempt to bypass security measures or validation checks','Use automated scripts, bots, or tools to interact with the System','Attempt to hack, reverse engineer, or exploit the System','Disrupt or interfere with the System\'s operation','Access or attempt to access data you are not authorized to view','Transmit viruses, malware, or malicious code']} />
            </Sub>
          </Section>

          <Section num="4" title="Attendance Marking Rules">
            <Sub title="4.1 Check-In Requirements">
              <Ul items={['You must be physically present at the authorized work location (unless WFH is approved)','You must allow location permissions for GPS verification','Your device must meet GPS accuracy requirements','You may be required to be on the office network (depending on configuration)']} />
            </Sub>
            <Sub title="4.2 Late Arrival">
              <P>Late arrivals are automatically marked based on configured grace periods. Repeated late arrivals may be subject to your organization's disciplinary policies.</P>
            </Sub>
            <Sub title="4.3 Absences">
              <P>If you do not mark attendance on a working day, the System will automatically mark you as absent. Absences are subject to your organization's leave and attendance policies.</P>
            </Sub>
          </Section>

          <Section num="5" title="Location Data and Privacy">
            <P>By using the System, you:</P>
            <Ul items={['Consent to the collection of your GPS location data when marking attendance','Understand that location data is used solely for attendance verification','Acknowledge that location data may be accessed by authorized administrators','Agree to the terms outlined in our Privacy Policy']} />
            <P>For more information on how we handle your data, please review our <button onClick={() => navigate('/privacy-policy')} className="text-[#2563EB] font-semibold hover:text-blue-700">Privacy Policy</button>.</P>
          </Section>

          <Section num="6" title="Device Security and Fingerprinting">
            <P>The System uses device fingerprinting for security purposes. You acknowledge that:</P>
            <Ul items={['Your device will be identified using browser and system characteristics','Administrators may monitor device changes and suspicious activities','Using multiple devices or unrecognized devices may trigger security alerts','Attempting to manipulate device fingerprints is prohibited']} />
          </Section>

          <Section num="7" title="Data Accuracy and Disputes">
            <P>If you notice discrepancies in your attendance records, contact your administrator or HR department immediately, provide necessary documentation, and follow your organization's attendance dispute resolution process.</P>
            <P>The System records are considered official attendance records unless proven otherwise through your organization's dispute resolution process.</P>
          </Section>

          <Section num="8" title="System Availability and Maintenance">
            <Ul items={['We do not guarantee 100% uptime or availability','The System may be temporarily unavailable for maintenance or updates','We are not liable for any inability to mark attendance due to system downtime','Contact your administrator if the System is unavailable when you need to mark attendance']} />
          </Section>

          <Section num="9" title="Intellectual Property">
            <P>The System, including all software, designs, text, graphics, and other content, is owned by us or our licensors and is protected by intellectual property laws. You may not copy, modify, reverse engineer, or use the System's name, logo, or branding without permission.</P>
          </Section>

          <Section num="10" title="Limitation of Liability">
            <Ul items={['The System is provided "as is" without warranties of any kind','We are not liable for any indirect, incidental, or consequential damages','We are not responsible for decisions made by your organization based on attendance data','You use the System at your own risk']} />
          </Section>

          <Section num="11" title="Account Termination">
            <P>Your organization's administrators may suspend or terminate your account if you violate these Terms, engage in fraudulent activities, your employment ends, or for any other reason at their discretion.</P>
          </Section>

          <Section num="12" title="Changes to Terms">
            <P>We reserve the right to modify these Terms and Conditions at any time. We will notify users of material changes by updating the "Last Updated" date. Continued use of the System after changes constitutes acceptance of the updated terms.</P>
          </Section>

          <Section num="13" title="Governing Law">
            <P>These Terms and Conditions are governed by applicable laws in your jurisdiction. Any disputes should be resolved through your organization's internal dispute resolution process.</P>
          </Section>

          {/* Warning */}
          <div className="p-5 bg-amber-50 border border-amber-200 rounded-2xl mb-8 flex items-start gap-3">
            <FiAlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-amber-900 mb-1">Important Notice</p>
              <p className="text-sm text-amber-800">Violation of these Terms and Conditions, particularly fraudulent attendance marking or security breaches, may result in disciplinary action by your organization, including termination of employment. All activities are logged and monitored.</p>
            </div>
          </div>

          {/* Contact */}
          <div className="p-6 bg-[#2563EB]/8 border border-[#2563EB]/15 rounded-2xl">
            <h2 className="text-sm font-bold text-[#0F172A] mb-3">Questions About These Terms?</h2>
            <P>Contact your Organization's Administrator for account or policy questions, email <span className="font-semibold text-[#2563EB]">legal@attendancesystem.com</span>, or <button onClick={() => navigate('/contact')} className="text-[#2563EB] font-semibold hover:text-blue-700">Contact Support</button>.</P>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
export default TermsAndConditionsPage;
