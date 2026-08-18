import React, { useState, useEffect } from 'react';
import { FiX, FiDownload } from 'react-icons/fi';
import { formatIndianCurrency as formatCurrency } from '../utils/formatCurrency';
import { downloadEmployeeDetailsForm, getBrandingSettings } from '../services/api';

const EmployeeDetailsFormModal = ({ employee, onClose }) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    getBrandingSettings()
      .then(res => {
        if (res.data?.success && res.data?.branding) {
          setBranding(res.data.branding);
        }
      })
      .catch(() => {});
  }, []);

  if (!employee) return null;

  const companyName = branding?.company_name || "Manuscript Technomedia LLP";
  const backendBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  const logoSrc = branding?.logo_data_url || (branding?.logo_path 
    ? (branding.logo_path.startsWith('http') ? branding.logo_path : `${backendBase}${branding.logo_path}`) 
    : `${window.location.origin}/favicon/web-app-manifest-192x192.png`);
  const logoWidth = branding?.logo_width || 32;
  const logoHeight = branding?.logo_height || 32;
  const companyFontSize = branding?.company_name_font_size ? `${branding.company_name_font_size}px` : '20px';
  const registeredOfficeAddress = branding?.registered_office_address || 'Manuscript Technomedia LLP, Reg. Office. No. 22, 3rd Cross, Vivekananda Nagar, Bangalore-33, Karnataka, India.';

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
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

  const maskAadharLast4 = (val) => {
    if (!val) return '—';
    const clean = String(val).replace(/\s/g, '');
    if (clean.length >= 4) {
      return `XXXX XXXX ${clean.slice(-4)}`;
    }
    return String(val);
  };

  const getTodayFormatted = () => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      const empId = employee.employee_id || employee.id;
      const res = await downloadEmployeeDetailsForm(empId);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `employee_details_${employee.employee_id || 'record'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Employee details PDF download failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  const formatMoneyVal = (val) => {
    if (val === undefined || val === null || val === '') return '—';
    const num = Number(val);
    if (!Number.isFinite(num)) return '—';
    return formatCurrency(num);
  };

  const monthlySalary = employee.monthly_salary ?? employee.base_salary ?? 0;
  const basicSalary = employee.basic_salary ?? 0;
  const hra = employee.hra ?? 0;
  const specialAllowance = employee.special_allowance ?? 0;
  const pt = employee.professional_tax ?? 0;
  const tds = employee.tds ?? 0;
  const staffAdvance = employee.staff_advance ?? 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center z-[100] overflow-y-auto p-4 sm:p-8">
      {/* Modal Actions */}
      <div className="fixed top-4 right-4 flex items-center gap-2.5 z-[110] no-print">
        <button 
          onClick={handleDownloadPdf} 
          disabled={isDownloading}
          className={`${isDownloading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 font-bold text-xs transition-all`}
          title="Download Employee Details PDF"
        >
          <FiDownload size={16} /> {isDownloading ? 'Downloading...' : 'Download Form PDF'}
        </button>
        <button 
          onClick={onClose} 
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-all"
        >
          <FiX size={18} />
        </button>
      </div>

      <div className="w-full flex justify-center my-auto py-8">
        <div className="w-full max-w-[850px] mx-auto bg-white shadow-2xl rounded-lg text-slate-900 overflow-hidden">
          <div className="p-8 sm:p-12 border-[1.5px] border-slate-300 rounded-lg bg-white">
            
            {/* Company Header */}
            <div className="flex items-center justify-center gap-3">
              <img 
                src={logoSrc} 
                alt="Company Logo" 
                crossOrigin="anonymous"
                style={{ width: `${logoWidth}px`, height: `${logoHeight}px`, objectFit: 'contain' }}
                className="object-contain"
              />
              <div className="font-extrabold text-slate-900 tracking-tight" style={{ fontSize: companyFontSize }}>
                {companyName}
              </div>
            </div>
            
            {/* Title Area */}
            <div className="text-center mt-3">
              <h1 className="text-base font-bold uppercase tracking-widest m-0 leading-none text-slate-900">EMPLOYEE DETAILS FORM</h1>
            </div>

            <div className="border-t border-slate-300 my-4"></div>

            {/* Employment Details & Personal/Contact Details (2 cols) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
              
              {/* Employment Details */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-200 pb-1">
                  Employment Details
                </h3>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium w-32">Employee ID</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{employee.employee_id || '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">Full Name</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{employee.name || '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">Designation / Role</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{employee.job_role || '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">Department</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{employee.department_name || employee.department || '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">Joining Date</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{formatDate(employee.joining_date)}</td>
                    </tr>
                    {employee.resigned_date && (
                      <tr className="border-b border-slate-100">
                        <td className="py-1.5 text-amber-600 font-medium">Resigned Date</td>
                        <td className="py-1.5 font-bold text-right text-amber-700">{formatDate(employee.resigned_date)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Personal & Contact Details */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-200 pb-1">
                  Personal & Contact Details
                </h3>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium w-36">Date of Birth</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{formatDate(employee.date_of_birth)}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">Mobile Number</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{employee.mobile || '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">Alternate Phone</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{employee.alternate_phone_number || '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">Email Address</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{employee.personal_email || '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium align-top">Permanent Address</td>
                      <td className="py-1.5 font-semibold text-right text-slate-900 text-xs max-w-[200px] break-words">{employee.permanent_address || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            {/* Bank Account & Identity Details (2 cols) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
              
              {/* Bank Account Details */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-200 pb-1">
                  Bank Account Details
                </h3>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium w-32">Bank Name</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{employee.bank_name || '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">Account Holder</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{employee.account_holder_name || '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">Account Number</td>
                      <td className="py-1.5 font-bold font-mono text-right text-slate-900">{employee.account_number || '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">IFSC Code</td>
                      <td className="py-1.5 font-bold font-mono text-right text-slate-900">{employee.ifsc_code || '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium align-top">Bank Address</td>
                      <td className="py-1.5 font-semibold text-right text-slate-900 text-xs max-w-[200px] break-words">{employee.bank_address || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Identity & Statutory Details */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-200 pb-1">
                  Identity Details
                </h3>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium w-36">PAN Card Number</td>
                      <td className="py-1.5 font-bold font-mono text-right text-slate-900">{employee.pan_card_number || '—'}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">Aadhaar Number</td>
                      <td className="py-1.5 font-bold font-mono text-right text-slate-900">{employee.aadhar_card_number || '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            {/* Salary & Compensation Structure (2 cols) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-5">
              
              {/* Salary & Allowances */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-200 pb-1">
                  Salary & Allowances
                </h3>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium w-36">Basic Salary</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{formatMoneyVal(basicSalary)}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">HRA</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{formatMoneyVal(hra)}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">Special Allowance</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{formatMoneyVal(specialAllowance)}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 font-bold text-slate-800">Monthly Gross Salary</td>
                      <td className="py-1.5 font-black text-right text-slate-900">{formatMoneyVal(monthlySalary)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Statutory & Deductions */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2 border-b border-slate-200 pb-1">
                  Statutory & Deductions
                </h3>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium w-36">Professional Tax (PT)</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{formatMoneyVal(pt)}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">TDS</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{formatMoneyVal(tds)}</td>
                    </tr>
                    <tr className="border-b border-slate-100">
                      <td className="py-1.5 text-slate-600 font-medium">Staff Advance</td>
                      <td className="py-1.5 font-bold text-right text-slate-900">{formatMoneyVal(staffAdvance)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            {/* Footer - Seal & Signature with Generated Date */}
            <div className="border-t border-slate-300 pt-4 mt-2 flex flex-col sm:flex-row items-end justify-between gap-4">
              <div className="pb-1 text-left w-full sm:w-auto">
                <p className="text-[12px] font-bold text-slate-600">
                  Generated on: {getTodayFormatted()}
                </p>
              </div>

              <div className="flex flex-col items-center text-center">
                <img 
                  src={`${backendBase}/assets/payslip/company-seal-signature.png`}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/assets/payslip/company-seal-signature.png';
                  }}
                  alt="Company Seal & Signature" 
                  className="w-32 h-auto object-contain mb-1.5"
                />
                <p className="text-[12px] font-bold text-slate-900 leading-tight">
                  Authorized Signatory
                </p>
                <p className="text-[11px] font-normal text-slate-600 leading-tight">
                  {companyName}
                </p>
              </div>
            </div>

          </div>

          {/* Registered Office Line (outside card) */}
          <div className="px-8 py-4 bg-white">
            <div className="border-t border-black/80 pt-2 text-center">
              <p className="text-[11px] font-medium text-slate-900">
                {registeredOfficeAddress}
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default EmployeeDetailsFormModal;
