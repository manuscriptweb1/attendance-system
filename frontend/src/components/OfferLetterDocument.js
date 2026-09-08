import React from 'react';

export const OfferLetterTopRightLogo = ({ settings }) => {
  const logoSrc = settings?.logo_data_url || (settings?.logo_path 
    ? (settings.logo_path.startsWith('http') ? settings.logo_path : settings.logo_path) 
    : '/favicon/web-app-manifest-192x192.png');

  return (
    <div className="flex items-center justify-end gap-2 pt-2 pb-2 select-none">
      {/* Company Logo Image on Left */}
      <div className="w-10 h-10 flex items-center justify-center flex-shrink-0">
        <img
          src={logoSrc}
          alt="Company Logo"
          className="w-9 h-9 object-contain"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = '/favicon/web-app-manifest-192x192.png';
          }}
        />
      </div>

      {/* Text block on Right */}
      <div className="flex flex-col items-start justify-center leading-tight">
        <span className="font-bold text-[#0F172A] text-[24px] tracking-tight text-left">
          Manuscript
        </span>
        <span className="text-[7.5px] text-[#1F2937] tracking-[0.2em] font-semibold uppercase -mt-0.5 text-left">
          TECHNOMEDIA LLP
        </span>
      </div>
    </div>
  );
};

export const OfferLetterPageFooter = ({ settings }) => {
  return (
    <div
      style={{ fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif' }}
      className="pt-2 border-t border-[#991B1B] text-center text-[10.5px] text-[#A83232] mt-auto select-none"
    >
      <p className="text-[10px] text-[#A83232] mb-0.5 leading-snug">
        {settings?.footer_line_1 || 'Manuscript Technomedia LLP,'}
      </p>
      <p className="text-[10px] text-[#A83232] mb-0.5 leading-snug">
        {settings?.footer_line_2 ||
          'Reg. New No 40, 22, 3rd Cross Rd, Jaibharath Nagar, Vivekananda Nagar, Maruthi Sevanagar, Bangalore-33, Karnataka, India.'}
      </p>
      <p className="text-[10px] text-[#A83232] leading-snug">
        {settings?.footer_line_3 ||
          'https://mstechnomedia.com | contact@mstechnomedia.com | +91-9686980760 | GST: 29ACBFM2283L1ZV'}
      </p>
    </div>
  );
};

const formatINR = (value) => {
  const num = Number(value || 0);
  return `₹ ${Math.round(num).toLocaleString('en-IN')}`;
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

const formatShortDate = (dateStr) => {
  if (!dateStr) return '-';
  if (typeof dateStr === 'string') {
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const day = parts[2];
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const year = parts[0];
      return `${day}-${monthNames[monthIdx] || parts[1]}-${year}`;
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const OfferLetterDocument = ({ data, settings, pageNumber = null, includeSignature = true }) => {
  if (!data) return null;

  const shouldIncludeSignature = data.includeSignature !== undefined ? Boolean(data.includeSignature) : includeSignature;

  const companyName = data.company_name || data.company_name_snapshot || settings?.company_name || 'Manuscript TechnoMedia LLP';
  const salutation = data.salutation || 'Mr.';
  const candidateName = data.employee_name || data.employee_name_snapshot || 'Candidate';
  const candidateAddress = data.employee_address || data.employee_address_snapshot || '';
  const candidateEmail = data.employee_email || data.employee_email_snapshot || '';
  const jobTitle = data.job_title || data.job_title_snapshot || 'Employee';
  const department = data.department || data.department_snapshot || 'General';
  const reportingTo = data.reporting_to || 'Dr. Mueen Ahmed KK, [Managing Director]';
  const workLocation = data.work_location || 'Office Premises';
  const employmentType = data.employment_type || 'Full-time';
  const workHours = data.work_hours || '9:30 AM – 6:30 PM, Monday–Saturday';
  const probationPeriod = data.probation_period || "3 months, extendable at the company's discretion.";

  const offerDateFormatted = formatShortDate(data.offer_date);
  const interviewDateFormatted = formatDateDisplay(data.interview_date || data.offer_date);
  const joiningDateShort = formatShortDate(data.joining_date);
  const acceptanceDateFormatted = formatDateDisplay(data.acceptance_deadline_date || data.joining_date);

  const monthlySalary = Number(data.monthly_salary || 0);
  const variablePercentage = Number(data.variable_percentage || 0);
  const annualFixedSalary = monthlySalary * 12;
  const totalCTC = annualFixedSalary;
  const annualLeaves = data.annual_paid_leaves !== undefined ? data.annual_paid_leaves : 12;

  const signatoryName = data.signatory_name || settings?.signatory_name || 'Dr. Mueen Ahmed KK';
  const signatoryDesignation = data.signatory_designation || settings?.signatory_designation || 'Designated Partner';
  const signatoryEmail = data.signatory_email || settings?.signatory_email || 'contact@mstechnomedia.com';

  let responsibilities = data.responsibilities || data.responsibilities_snapshot || [];
  if (typeof responsibilities === 'string') {
    try {
      responsibilities = JSON.parse(responsibilities);
    } catch (e) {
      responsibilities = [];
    }
  }

  const fontFamilyStyle = {
    fontFamily: '"Bookman Old Style", "URW Bookman", "Bookman", "Palatino", serif'
  };

  const justifyStyle = {
    textAlign: 'justify',
    textJustify: 'inter-word'
  };

  const page1 = (
    <div
      style={fontFamilyStyle}
      className="offer-letter-page bg-white text-slate-900 shadow-md border border-slate-200 p-8 sm:p-12 w-full max-w-[760px] min-h-[1050px] flex flex-col justify-between mx-auto mb-8 select-text"
    >
      <div>
        <OfferLetterTopRightLogo settings={settings} />

        {/* Horizontal Gradient Band beneath Logo (Full bleed from edge to edge) */}
        <div
          className="-mx-8 sm:-mx-12 h-3 mt-4 mb-3"
          style={{
            background: 'linear-gradient(to right, #D89A95, #EEDBD9)'
          }}
        ></div>

        {/* Date on Right beneath the gradient banner */}
        <div className="flex justify-end pt-1 mb-2">
          <p className="text-[12px] font-bold text-slate-900">Date: {offerDateFormatted}</p>
        </div>

        {/* Company Header Block on Left at y = 175 */}
        <div className="space-y-0.5 text-[11.5px] text-slate-800 max-w-[320px] mb-6">
          <p className="font-bold text-[12px] text-slate-950">{companyName}</p>
          <p className="whitespace-pre-line text-[11.5px] leading-relaxed text-slate-700">
            {settings?.header_address || 'Reg. Office. No. 22, 3rd Cross,\nVivekananda Nagar, Bangalore-33,\nKarnataka, India'}
          </p>
          <p className="text-[11.5px] text-slate-700">Phone: {settings?.header_phone || '91 9686980760'}</p>
          <p className="text-[11.5px] text-slate-700">Email: {settings?.header_email || 'connect@mstechnomedia.com'}</p>
          <p className="text-[11.5px] text-slate-700">Website: {settings?.header_website || 'www.mstechnomedia.com'}</p>
        </div>

        {/* Title Bar with top divider line at y = 280 / 295 */}
        <div className="pt-2.5 border-t border-slate-300 text-center mb-5">
          <h2 className="text-[12px] font-bold text-slate-950 tracking-wide">
            Offer Letter- {jobTitle}
          </h2>
        </div>

        {/* Addressee at y = 325 */}
        <div className="text-[11.5px] text-slate-800 space-y-0.5 max-w-[320px] mb-5">
          <p className="text-slate-600 mb-0.5">To;</p>
          <p className="font-bold text-slate-950 text-[12px]">{candidateName}</p>
          {candidateAddress && <p className="whitespace-pre-line text-slate-700 text-[11.5px] leading-snug">{candidateAddress}</p>}
          {candidateEmail && <p className="text-slate-700 text-[11.5px]">Email: {candidateEmail}</p>}
        </div>

        {/* Salutation at y = 405 */}
        <div className="text-[11.5px] text-slate-800 space-y-3.5 leading-relaxed mb-5">
          <p className="font-medium">Dear {salutation} {candidateName},</p>
          <p>This is with reference to your interview with us on {interviewDateFormatted}.</p>
          <p style={justifyStyle}>
            We are pleased to offer you the position of <strong className="text-slate-950">{jobTitle}</strong> with{' '}
            <strong className="text-slate-950">{companyName}</strong>. Your skills and experience will be a valuable addition to our team. Please review the terms of this offer below.
          </p>
        </div>

        {/* Position Details at y = 520 to 695 */}
        <div className="mt-4 pt-2.5 border-t border-slate-300">
          <h3 className="text-[12px] font-bold text-slate-950 tracking-wide mb-2.5">Position Details</h3>
          <ul className="text-[11.5px] text-slate-800 space-y-1.5 pl-3">
            <li>• <strong>Job Title:</strong> {jobTitle}</li>
            <li>• <strong>Department/Team:</strong> {department}</li>
            <li>• <strong>Reporting To:</strong> {reportingTo}</li>
            <li>• <strong>Work Location:</strong> {workLocation}</li>
            <li>• <strong>Proposed Start Date:</strong> {joiningDateShort}</li>
            <li>• <strong>Employment Type:</strong> {employmentType}</li>
            <li>• <strong>Work Hours:</strong> {workHours}</li>
            <li>• <strong>Probation Period:</strong> {probationPeriod}</li>
          </ul>
          <div className="mt-2.5 border-b border-slate-300"></div>
        </div>
      </div>

      <OfferLetterPageFooter settings={settings} />
    </div>
  );

  const page2 = (
    <div
      style={fontFamilyStyle}
      className="offer-letter-page bg-white text-slate-900 shadow-md border border-slate-200 p-8 sm:p-12 w-full max-w-[760px] min-h-[1050px] flex flex-col justify-between mx-auto mb-8 select-text"
    >
      <div>
        <OfferLetterTopRightLogo settings={settings} />

        {/* Compensation & Benefits (Starts from top beneath logo at y = 120) */}
        <div className="pt-3 space-y-2.5 text-[11.5px] text-slate-800 mb-4">
          <h3 className="text-[12px] font-bold text-slate-950 tracking-wide">Compensation and Benefits</h3>
          <ul className="space-y-1 pl-3">
            <li>
              • <strong>Base Salary:</strong> {formatINR(monthlySalary)} per month, payable in accordance with company payroll policies
            </li>
            <li>
              • <strong>Variable Pay/Bonus:</strong> {variablePercentage}% of Salary per annum, based on individual and company performance.
            </li>
          </ul>

          <div className="pl-3 pt-0.5 text-[11.5px] text-slate-800 space-y-1">
            <p className="font-bold text-slate-950">Benefits:</p>
            <p className="pl-3">• Leaves: {annualLeaves} Paid Leaves annually.</p>
            <p className="pl-3">• Provident Fund/Gratuity: {data.pf_applicable || 'Not Applicable'}</p>
            <p className="pl-3">• Other Allowances: {data.other_allowances || 'Not Applicable'}</p>
          </div>

          <p className="pl-3 pt-3 text-slate-800 text-[11.5px] mb-3">
            A detailed Compensation Breakup (CTC) will be provided as Annexure A.
          </p>
        </div>

        {/* Roles and Responsibilities Header */}
        <div className="pt-2.5 border-t border-slate-300">
          <h3 className="text-[12px] font-bold text-slate-950 tracking-wide mb-3">Roles and Responsibilities:</h3>
          <p className="text-[11.5px] text-slate-700 mb-5">Your responsibilities will include, but are not limited to:</p>

          {/* First 3 Categories with uniform, equal inter-category spacing */}
          <div className="space-y-4">
            {responsibilities.slice(0, 3).map((cat, idx) => (
              <div key={idx} className="space-y-2 text-[11.5px]">
                <p className="font-bold text-slate-950 text-[11.5px]">{cat.category}</p>
                <ul className="space-y-0.5 pl-4 text-slate-800 leading-relaxed" style={justifyStyle}>
                  {(cat.items || []).map((b, bIdx) => (
                    <li key={bIdx}>• {b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <OfferLetterPageFooter settings={settings} />
    </div>
  );

  const page3 = (
    <div
      style={fontFamilyStyle}
      className="offer-letter-page bg-white text-slate-900 shadow-md border border-slate-200 p-8 sm:p-12 w-full max-w-[760px] min-h-[1050px] flex flex-col justify-between mx-auto mb-8 select-text"
    >
      <div>
        <OfferLetterTopRightLogo settings={settings} />

        {/* Remaining Categories (4 to 6 Starts from top beneath logo at y = 120) */}
        <div className="pt-3 space-y-4 text-[11.5px] mb-3.5">
          {responsibilities.slice(3).map((cat, idx) => (
            <div key={idx} className="space-y-2 text-[11.5px]">
              <p className="font-bold text-slate-950 text-[11.5px]">{cat.category}</p>
              <ul className="space-y-0.5 pl-4 text-slate-800 leading-relaxed" style={justifyStyle}>
                {(cat.items || []).map((b, bIdx) => (
                  <li key={bIdx}>• {b}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Tools, Equipment, and IP */}
        <div className="pt-2 border-t border-slate-300 text-[11.5px] text-slate-800 mb-3">
          <h3 className="font-bold text-slate-950 tracking-wide text-[12px] mb-1">Tools, Equipment, and IP</h3>
          <ul className="space-y-0.5 pl-3 leading-relaxed" style={justifyStyle}>
            <li>• The company may provide the necessary hardware/software to perform your duties.</li>
            <li>
              • All work product, inventions, and intellectual property created during employment shall be the exclusive property of{' '}
              <strong className="text-slate-950">{companyName}</strong>, as detailed in the Intellectual Property and Confidentiality Agreement.
            </li>
          </ul>
        </div>

        {/* Confidentiality and NDA */}
        <div className="pt-2 border-t border-slate-300 text-[11.5px] text-slate-800 mb-3">
          <h3 className="font-bold text-slate-950 tracking-wide text-[12px] mb-1">Confidentiality and Non-Disclosure</h3>
          <p className="leading-relaxed" style={justifyStyle}>
            You will be required to sign a <strong>Confidentiality and Non-Disclosure Agreement (NDA). </strong>You must not disclose or use any proprietary or confidential information belonging to the company or its clients during or after your employment, except as authorized.
          </p>
        </div>

        {/* Background Verification and Conditions (First 2 bullets on Page 3) */}
        <div className="pt-2 border-t border-slate-300 text-[11.5px] text-slate-800">
          <h3 className="font-bold text-slate-950 tracking-wide text-[12px] mb-3.5">Background Verification and Conditions</h3>
          <p className="mb-3.5">This offer is contingent upon:</p>
          <ul className="space-y-0.5 pl-3 leading-relaxed" style={justifyStyle}>
            <li>• Successful completion of <strong>background verification</strong>, including education and employment checks</li>
            <li>• Verification of <strong>identity</strong> and <strong>work authorization</strong></li>
          </ul>
        </div>
      </div>

      <OfferLetterPageFooter settings={settings} />
    </div>
  );

  const page4 = (
    <div
      style={fontFamilyStyle}
      className="offer-letter-page bg-white text-slate-900 shadow-md border border-slate-200 p-8 sm:p-12 w-full max-w-[760px] min-h-[1050px] flex flex-col justify-between mx-auto mb-8 select-text"
    >
      <div>
        <OfferLetterTopRightLogo settings={settings} />

        <div className="pt-3 space-y-3.5 text-[11.5px] text-slate-800">
          {/* Bullets 3 and 4 of Background Verification on Page 4 (Starts from top at y = 120) */}
          <div className="space-y-1">
            <ul className="space-y-1 pl-3 leading-relaxed" style={justifyStyle}>
              <li>• Acceptance and signature of all applicable agreements (NDA, Agreement, and Company Policies)</li>
              <li>• Confirmation that there are no existing restrictions (e.g., non-compete) preventing you from joining</li>
            </ul>
            <p className="text-slate-700 leading-relaxed pt-1" style={justifyStyle}>
              Any misrepresentation or failure in verification may result in withdrawal of this offer or termination of employment.
            </p>
          </div>

          {/* Working Policies */}
          <div className="pt-2.5 border-t border-slate-300 space-y-1">
            <h3 className="font-bold text-slate-950 tracking-wide text-[12px]">Working Policies</h3>
            <ul className="space-y-0.5 pl-3 leading-relaxed" style={justifyStyle}>
              <li>• <strong>Leave and Attendance:</strong> As per the company’s leave and attendance policy in force and as updated from time to time</li>
              <li>• <strong>Remote/Hybrid Work:</strong> Work is office-based.</li>
              <li>• <strong>Code of Conduct:</strong> You are expected to maintain professional conduct and adhere to ethical standards</li>
            </ul>
          </div>

          {/* Termination */}
          <div className="pt-2.5 border-t border-slate-300 space-y-1">
            <h3 className="font-bold text-slate-950 tracking-wide text-[12px]">Termination</h3>
            <ul className="space-y-0.5 pl-3 leading-relaxed" style={justifyStyle}>
              <li>• During probation, either party may terminate employment with 30 days written notice or pay in lieu of notice.</li>
              <li>• Post-probation, either party may terminate employment within 30 days written notice or pay in lieu, as per policy.</li>
              <li>• The company reserves the right to terminate employment for cause without notice, subject to applicable law and policies.</li>
            </ul>
          </div>

          {/* Acceptance of Offer */}
          <div className="pt-2.5 border-t border-slate-300">
            <h3 className="font-bold text-slate-950 tracking-wide text-[12px] mb-2">Acceptance of Offer</h3>
            <div className="space-y-1.5">
              <p className="leading-relaxed" style={justifyStyle}>
                Please indicate your acceptance by signing and returning this letter along with the attached agreements by{' '}
                <strong>{acceptanceDateFormatted}</strong>. This offer will expire if not accepted by the specified date.
              </p>
              <p className="leading-relaxed" style={justifyStyle}>
                We are excited at the prospect of you joining <strong className="text-slate-950">{companyName}</strong> and contributing to our mission. If you have any questions, please contact us at {settings?.header_email || settings?.signatory_email || 'connect@mstechnomedia.com'}.
              </p>
            </div>
          </div>

          {/* Sign-off Block */}
          <div className="text-slate-800 text-[11.5px] space-y-0.5 pt-3">
            <p className="mb-0.5 font-medium">Sincerely,</p>
            {shouldIncludeSignature ? (
              <div className="py-1">
                <img
                  src="/assets/payslip/mueen-sir-signature.png?v=3"
                  alt="Company Seal and Signature"
                  className="h-[75px] max-w-[210px] object-contain object-left block"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="h-[75px]"></div>
            )}
            <p className="font-bold text-slate-950">{signatoryName}</p>
            <p className="text-slate-700">{signatoryDesignation}</p>
            <p className="text-slate-700">{companyName}</p>
            <p className="text-slate-700">Email: {signatoryEmail}</p>
          </div>
        </div>
      </div>

      <OfferLetterPageFooter settings={settings} />
    </div>
  );

  const page5 = (
    <div
      style={fontFamilyStyle}
      className="offer-letter-page bg-white text-slate-900 shadow-md border border-slate-200 p-8 sm:p-12 w-full max-w-[760px] min-h-[1050px] flex flex-col justify-between mx-auto mb-8 select-text"
    >
      <div>
        <OfferLetterTopRightLogo settings={settings} />

        {/* Candidate Acceptance Block (Starts from top beneath logo at y = 120) */}
        <div className="pt-3 mb-6 text-[11.5px] text-slate-800">
          <h3 className="font-bold text-slate-950 tracking-wide text-[12px] text-center mb-5">
            Candidate Acceptance
          </h3>
          <p className="leading-relaxed mb-3.5 text-center max-w-xl mx-auto" style={justifyStyle}>
            I, <strong className="text-slate-950">{candidateName}</strong>, accept the offer of employment outlined in this letter and agree to the terms and conditions, including company policies and applicable agreements.
          </p>

          <div className="space-y-2 max-w-md mx-auto pt-1 pl-4">
            <p>• Signature: __________________________</p>
            <p>• Name: <strong className="text-slate-950">{candidateName}</strong></p>
            <p>• Date:</p>
          </div>
        </div>

        {/* Annexure A — Compensation Breakup */}
        <div className="pt-3 border-t border-slate-300 text-[11.5px] text-slate-800">
          <h3 className="font-bold text-slate-950 tracking-wide text-[12px] text-center mb-5">
            Annexure A — Compensation Breakup (Illustrative)
          </h3>

          <ul className="space-y-1.5 pl-6 max-w-lg mx-auto">
            <li>• Fixed Gross: {formatINR(monthlySalary)} per month.</li>
            <li>• Variable/Performance Pay: {variablePercentage}% annually</li>
            <li>• Benefits/Allowances: {data.other_allowances || 'Not applicable'}</li>
            <li>• Statutory Contributions: [PF/ESI/Gratuity] {data.pf_applicable || 'not applicable'}</li>
            <li className="font-bold text-slate-950">• Total CTC: {formatINR(totalCTC)} per year</li>
          </ul>

          <p className="text-slate-500 text-[10px] mt-3 text-center max-w-lg mx-auto leading-relaxed">
            Note: Exact figures and statutory deductions will be calculated as per applicable laws and company policy at the time of joining.
          </p>
        </div>
      </div>

      <OfferLetterPageFooter settings={settings} />
    </div>
  );

  const pages = [page1, page2, page3, page4, page5];

  if (pageNumber !== null && pageNumber >= 1 && pageNumber <= 5) {
    return pages[pageNumber - 1];
  }

  return (
    <div className="offer-letter-document space-y-6">
      {pages.map((p, idx) => (
        <React.Fragment key={idx}>{p}</React.Fragment>
      ))}
    </div>
  );
};

export default OfferLetterDocument;
