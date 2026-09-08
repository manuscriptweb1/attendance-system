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

const formatDateWithOrdinal = (dateStr) => {
  if (!dateStr) return '-';
  const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  let d;
  if (typeof dateStr === 'string') {
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      d = new Date(dateStr);
    }
  } else {
    d = new Date(dateStr);
  }

  if (isNaN(d.getTime())) return String(dateStr);

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const dayOrdinal = getOrdinal(d.getDate());
  const monthStr = monthNames[d.getMonth()];
  const yearStr = d.getFullYear();

  return `${dayOrdinal} ${monthStr} ${yearStr}`;
};

const RelievingLetterDocument = ({ data, settings, includeSignature = true }) => {
  if (!data) return null;

  const shouldIncludeSignature = data.includeSignature !== undefined ? Boolean(data.includeSignature) : includeSignature;

  const companyName = data.company_name || data.company_name_snapshot || settings?.company_name || 'Manuscript TechnoMedia LLP';
  const employeeName = data.employee_name || data.employee_name_snapshot || 'Employee Name';
  const employeeEmail = data.employee_email || data.employee_email_snapshot || '';
  const employeeAddress = data.employee_address || data.employee_address_snapshot || '';
  const jobTitle = data.job_title || data.job_title_snapshot || 'Editorial Assistant';
  
  const issueDateFormatted = formatShortDate(data.issue_date || new Date());
  const resignationDateFormatted = formatDateWithOrdinal(data.resignation_date || data.issue_date || new Date());
  const joiningDateFormatted = formatDateWithOrdinal(data.joining_date);
  const relievingDateFormatted = formatDateWithOrdinal(data.relieving_date || new Date());

  const signatoryName = data.signatory_name || settings?.signatory_name || 'Dr. Mueen Ahmed';
  const signatoryDesignation = data.signatory_designation || settings?.signatory_designation || 'Authorized Signatory';

  // Paragraphs
  const p1 = data.paragraph_1 || data.paragraph_1_snapshot ||
    `With reference to your resignation letter dated on ${resignationDateFormatted}, we hereby accept your resignation and agree to relieve you from the duties on ${relievingDateFormatted}. We confirm that you have worked in our company from ${joiningDateFormatted} as a ${jobTitle}. During your employment with us we found you to be hardworking, diligent and honest in performing your duties.`;

  const p2 = data.paragraph_2 || data.paragraph_2_snapshot ||
    `The management would like to thank you for your service with ${companyName} and we wish you all the best in your future endeavours.`;

  const fontFamilyStyle = {
    fontFamily: '"Bookman Old Style", "URW Bookman", "Bookman", serif',
    fontSize: '12pt'
  };

  const justifyStyle = {
    textAlign: 'justify',
    textJustify: 'inter-word',
    fontSize: '12pt',
    lineHeight: '1.65'
  };

  return (
    <div
      style={fontFamilyStyle}
      className="relieving-letter-page offer-letter-page bg-white text-slate-900 shadow-md border border-slate-200 p-8 sm:p-12 w-full max-w-[760px] min-h-[1050px] flex flex-col justify-between mx-auto select-text font-['Bookman_Old_Style',serif] text-[12pt]"
    >
      <div>
        {/* Company Top Right Logo */}
        <OfferLetterTopRightLogo settings={settings} />

        {/* Horizontal Gradient Band beneath Logo (Full bleed from edge to edge) */}
        <div
          className="-mx-8 sm:-mx-12 h-3 mt-4 mb-3"
          style={{
            background: 'linear-gradient(to right, #D89A95, #EEDBD9)'
          }}
        />

        {/* Date on Right beneath the gradient banner */}
        <div className="flex justify-end pt-1 mb-6">
          <p className="text-[12pt] font-bold text-slate-900">Date: {issueDateFormatted}</p>
        </div>

        {/* Centered Title */}
        <div className="text-center mb-7">
          <h2 className="text-[13pt] font-bold text-slate-950 tracking-wider uppercase">
            RELIEVING LETTER
          </h2>
        </div>

        {/* Addressee Block (To: Candidate Name, Address, Email) */}
        <div className="space-y-0.5 text-[12pt] text-slate-900 mb-4">
          <p className="font-bold text-slate-950">To:</p>
          <p className="font-semibold text-slate-900">{employeeName}</p>
          {employeeAddress && (
            <p className="whitespace-pre-line text-slate-800 leading-relaxed max-w-[420px]">
              {employeeAddress}
            </p>
          )}
          {employeeEmail && (
            <p className="text-slate-800">{employeeEmail}</p>
          )}
        </div>

        {/* Salutation (with 1 empty line space before Paragraph 1) */}
        <div className="mb-4">
          <p className="text-[12pt] text-slate-950 font-normal">Dear {employeeName},</p>
        </div>

        {/* Relieving Paragraphs */}
        <div className="space-y-4 text-[12pt] text-slate-900 leading-relaxed">
          <p style={justifyStyle}>{p1}</p>
          <p style={justifyStyle}>{p2}</p>
        </div>

        {/* Signatory Closing Block */}
        <div className="text-slate-900 text-[12pt] space-y-0.5 pt-4 mb-6">
          <p className="text-slate-900 mb-1">Yours Sincerely,</p>
          {shouldIncludeSignature ? (
            <div className="py-2">
              <img
                src="/assets/payslip/mueen-sir-signature.png?v=3"
                alt="Designated Partner Signature & Company Seal"
                className="h-[80px] max-w-[220px] object-contain object-left block"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="h-[80px]"></div>
          )}
          <p className="font-bold text-slate-950">{signatoryName}</p>
          <p className="text-slate-800">{signatoryDesignation}</p>
          <p className="text-slate-800">{companyName}</p>
        </div>
      </div>

      {/* Shared Official Page Footer with Red Accent Line */}
      <OfferLetterPageFooter settings={settings} />
    </div>
  );
};

export default RelievingLetterDocument;
