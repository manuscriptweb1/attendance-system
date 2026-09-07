import React from 'react';
import { OfferLetterTopRightLogo, OfferLetterPageFooter } from './OfferLetterDocument';

const formatShortDate = (dateStr) => {
  if (!dateStr) return '-';
  if (typeof dateStr === 'string') {
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const day = parts[2];
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const year = parts[0];
      return `${day}-${monthNames[monthIdx] || parts[1]}-${year}`;
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${day}-${monthNames[d.getMonth()]}-${d.getFullYear()}`;
};

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '-';
  if (typeof dateStr === 'string') {
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

// Helper to get pronouns based on salutation
export const getPronouns = (salutation) => {
  const sal = (salutation || 'Mr.').toLowerCase();
  if (sal === 'ms.' || sal === 'ms' || sal === 'mrs.' || sal === 'mrs' || sal === 'miss') {
    return {
      subject: 'she',
      Subject: 'She',
      object: 'her',
      Object: 'Her',
      possession: 'her',
      Possession: 'Her'
    };
  }
  return {
    subject: 'he',
    Subject: 'He',
    object: 'him',
    Object: 'Him',
    possession: 'his',
    Possession: 'His'
  };
};

const ExperienceLetterDocument = ({ data, settings }) => {
  if (!data) return null;

  const companyName = data.company_name || data.company_name_snapshot || settings?.company_name || 'Manuscript TechnoMedia LLP';
  const salutation = data.salutation || 'Mr.';
  const employeeName = data.employee_name || data.employee_name_snapshot || 'Employee Name';
  const jobTitle = data.job_title || data.job_title_snapshot || 'Web Developer';
  
  const issueDateFormatted = formatShortDate(data.issue_date || new Date());
  const joiningDateFormatted = formatDateDisplay(data.joining_date);
  const relievingDateFormatted = formatDateDisplay(data.relieving_date || new Date());
  
  const monthlySalary = Number(data.monthly_salary || 0);
  const salaryInWords = data.salary_in_words || '';

  const signatoryName = data.signatory_name || settings?.signatory_name || 'Dr. Mueen Ahmed KK';
  const signatoryDesignation = data.signatory_designation || settings?.signatory_designation || 'Authorized Signatory';
  const signatoryEmail = data.signatory_email || settings?.signatory_email || 'connect@mstechnomedia.com';

  const pronouns = getPronouns(salutation);

  // Default computed paragraphs if not explicitly given
  const p1 = data.paragraph_1 || data.paragraph_1_snapshot || 
    `This is to certify that ${salutation} ${employeeName}, was employed with our Organization as ${jobTitle} in ${companyName}, Bangalore since ${joiningDateFormatted} to ${relievingDateFormatted}. ${pronouns.Subject} was drawing a salary of Rs. ${monthlySalary}/- (${salaryInWords || 'Amount in words'}). ${pronouns.Subject} was relieved from ${pronouns.possession} service on ${relievingDateFormatted}.`;

  const p2 = data.paragraph_2 || data.paragraph_2_snapshot || 
    `During ${pronouns.possession} tenure of work, ${pronouns.subject} participated in executing projects for ${companyName} and executed many publishing projects successfully.`;

  const p3 = data.paragraph_3 || data.paragraph_3_snapshot || 
    `During ${pronouns.possession} work tenure, ${pronouns.subject} ably handled all the major responsibilities and was found to be hard working and very productive. We have also found ${pronouns.object} highly motivated, duty bound, and highly committed team member with strong conceptual knowledge.`;

  const p4 = data.paragraph_4 || data.paragraph_4_snapshot || 
    `We wish ${pronouns.object} all the best for ${pronouns.possession} future endeavors.`;

  const p5 = data.paragraph_5 || data.paragraph_5_snapshot || 
    `This letter is been issued based on the request made by ${pronouns.object} without any liability to ${companyName}.`;

  const fontFamilyStyle = {
    fontFamily: '"Bookman Old Style", "URW Bookman", "Bookman", serif',
    fontSize: '12pt'
  };

  const justifyStyle = {
    textAlign: 'justify',
    textJustify: 'inter-word',
    fontSize: '12pt'
  };

  return (
    <div
      style={fontFamilyStyle}
      className="experience-letter-page offer-letter-page bg-white text-slate-900 shadow-md border border-slate-200 p-8 sm:p-12 w-full max-w-[760px] min-h-[1050px] flex flex-col justify-between mx-auto select-text font-['Bookman_Old_Style',serif] text-[12pt]"
    >
      <div>
        {/* Company Top Right Logo */}
        <OfferLetterTopRightLogo settings={settings} />

        {/* Horizontal Gradient Band beneath Logo */}
        <div
          className="-mx-8 sm:-mx-12 h-3.5 mt-4 mb-2.5"
          style={{
            background: 'linear-gradient(to right, #D89A95, #EEDBD9)'
          }}
        />

        {/* Date on Right beneath the gradient banner */}
        <div className="flex justify-end pt-1 mb-2">
          <p className="text-[12pt] font-bold text-slate-900">Date: {issueDateFormatted}</p>
        </div>

        {/* Company Header Block on Left */}
        <div className="space-y-0.5 text-[11.5pt] text-slate-800 max-w-[340px] mb-6">
          <p className="font-bold text-[12pt] text-slate-950">{companyName}</p>
          <p className="whitespace-pre-line text-[11.5pt] leading-relaxed text-slate-700">
            {settings?.header_address || 'Reg. Office. No. 22, 3rd Cross,\nVivekananda Nagar, Bangalore-33,\nKarnataka, India'}
          </p>
          <p className="text-[11.5pt] text-slate-700">Phone: {settings?.header_phone || '91-9686980760'}</p>
          <p className="text-[11.5pt] text-slate-700">Email: {settings?.header_email || 'connect@mstechnomedia.com'}</p>
          <p className="text-[11.5pt] text-slate-700">Website: {settings?.header_website || 'www.mstechnomedia.com'}</p>
        </div>

        {/* Title Bar with top divider line */}
        <div className="pt-2.5 border-t border-slate-300 text-center mb-8">
          <h2 className="text-[13pt] font-bold text-slate-950 tracking-wider uppercase">
            TO WHOMSOEVER IT MAY CONCERN
          </h2>
        </div>

        {/* 5 Formatted Letter Paragraphs */}
        <div className="space-y-4 text-[12pt] text-slate-900 leading-relaxed">
          {/* Paragraph 1 */}
          <p style={justifyStyle}>{p1}</p>

          {/* Paragraph 2 (Role Specific) */}
          <p style={justifyStyle}>{p2}</p>

          {/* Paragraph 3 */}
          <p style={justifyStyle}>{p3}</p>

          {/* Paragraph 4 */}
          <p style={justifyStyle}>{p4}</p>

          {/* Paragraph 5 */}
          <p style={justifyStyle}>{p5}</p>
        </div>

        {/* Signatory Closing Block (with extra empty lines space above for signature & seal) */}
        <div className="text-slate-800 text-[12pt] space-y-0.5 pt-20 mb-6">
          <p className="text-slate-800 mb-2">Sincerely,</p>
          <p className="font-bold text-slate-950">{signatoryName}</p>
          <p className="text-slate-700">{signatoryDesignation}</p>
          <p className="text-slate-700">{companyName}</p>
          {signatoryEmail && <p className="text-slate-700">Email: {signatoryEmail}</p>}
        </div>
      </div>

      {/* Shared Official Page Footer with Red Accent Line */}
      <OfferLetterPageFooter settings={settings} />
    </div>
  );
};

export default ExperienceLetterDocument;
