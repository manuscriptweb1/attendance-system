import React, { useState, useEffect } from 'react';
import { FiX, FiDownload } from 'react-icons/fi';
import { formatIndianCurrency as formatCurrency } from '../utils/formatCurrency';

import { downloadSinglePayslip, getBrandingSettings } from '../services/api';

const PayrollPaySlip = ({ data, onClose, logoPath }) => {
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

  if (!data || !data.employee || !data.payroll) return null;

  const { employee, payroll } = data;
  const companyName = branding?.company_name || "Manuscript Technomedia LLP";
  const backendBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  const logoSrc = branding?.logo_data_url || (branding?.logo_path 
    ? (branding.logo_path.startsWith('http') ? branding.logo_path : `${backendBase}${branding.logo_path}`) 
    : `${window.location.origin}/favicon/web-app-manifest-192x192.png`);
  const logoWidth = branding?.logo_width || 32;
  const logoHeight = branding?.logo_height || 32;
  const companyFontSize = branding?.company_name_font_size ? `${branding.company_name_font_size}px` : '20px';
  const registeredOfficeAddress = branding?.registered_office_address || 'Manuscript Technomedia LLP, Reg. Office. No. 22, 3rd Cross, Vivekananda Nagar, Bangalore-33, Karnataka, India.';
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[payroll.month - 1];

  const formatDate = () => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handleDownloadBackendPdf = async (includeSignature) => {
    try {
      setIsDownloading(true);
      const res = await downloadSinglePayslip(employee.employee_code, payroll.month, payroll.year, includeSignature);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `payslip_${employee.employee_code}_${monthName}_${payroll.year}${includeSignature ? '_signed' : ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("PDF generation failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="payslip-modal fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center z-[100] overflow-y-auto p-4 sm:p-8">
      {/* Modal Actions */}
      <div className="payslip-modal-actions absolute top-4 right-4 flex items-center gap-2.5 no-print">
        <button 
          onClick={() => handleDownloadBackendPdf(true)} 
          disabled={isDownloading}
          className={`${isDownloading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 font-bold text-xs transition-all`}
          title="Download Payslip PDF with Signature"
        >
          <FiDownload size={16} /> Download Signed
        </button>
        <button 
          onClick={() => handleDownloadBackendPdf(false)} 
          disabled={isDownloading}
          className={`${isDownloading ? 'bg-slate-500' : 'bg-slate-700 hover:bg-slate-600'} text-white px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 font-bold text-xs transition-all`}
          title="Download Payslip PDF without Signature"
        >
          <FiDownload size={16} /> Download Unsigned
        </button>
        <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-200 w-9 h-9 rounded-xl shadow-lg flex items-center justify-center transition-all">
          <FiX size={18} />
        </button>
      </div>

      <div className="payslip-print-area w-full flex justify-center my-auto">
        <div className="payslip-a4 w-full max-w-[850px] mx-auto bg-white shadow-2xl rounded-lg text-slate-900">
          <div className="payslip-download-area payslip-card p-8 sm:p-12 border-[1.5px] border-slate-300 rounded-lg bg-white break-inside-avoid">
            
            {/* Company Header */}
            <div className="payslip-company-header flex items-center justify-center gap-3">
              <img 
                src={logoSrc} 
                alt="Company Logo" 
                crossOrigin="anonymous"
                style={{ width: `${logoWidth}px`, height: `${logoHeight}px`, objectFit: 'contain' }}
                className="payslip-logo"
              />
              <div className="payslip-company-name font-black text-slate-900 tracking-tight" style={{ fontSize: companyFontSize }}>
                {companyName}
              </div>
            </div>
            
            {/* Title Area */}
            <div className="payslip-title-section text-center mt-3">
              <h1 className="text-lg font-bold uppercase tracking-widest m-0 leading-none">PAY SLIP</h1>
              <p className="text-sm font-semibold text-slate-600 mt-2">For the month of {monthName} {payroll.year}</p>
            </div>

            <div className="payslip-divider border-t border-slate-300 my-4"></div>

            {/* Employee and Attendance Details (2 cols) */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              
              {/* Employee Details */}
              <div>
                <h3 className="payslip-section-title text-xs font-bold uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">Employee Details</h3>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium w-32">Employee Code</td><td className="py-1.5 font-bold text-right">{employee.employee_code}</td></tr>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium">Name</td><td className="py-1.5 font-bold text-right">{employee.name}</td></tr>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium">Designation</td><td className="py-1.5 font-bold text-right">{employee.designation}</td></tr>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium">Department</td><td className="py-1.5 font-bold text-right">{employee.department}</td></tr>
                  </tbody>
                </table>
              </div>

              {/* Attendance Details */}
              <div>
                <h3 className="payslip-section-title text-xs font-bold uppercase tracking-wider mb-2 border-b border-slate-200 pb-1">Attendance Details</h3>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium w-32">Working Days</td><td className="py-1.5 font-bold text-right">{payroll.work_days}</td></tr>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium">Paid Days</td><td className="py-1.5 font-bold text-right">{payroll.paid_days}</td></tr>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium">Present Days</td><td className="py-1.5 font-bold text-right">{payroll.present_days}</td></tr>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium">Absent Days</td><td className="py-1.5 font-bold text-right">{payroll.absent_days}</td></tr>
                  </tbody>
                </table>
              </div>

            </div>

            {/* Earnings and Deductions (2 cols) */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              
              {/* Earnings */}
              <div>
                <h3 className="payslip-section-title earning text-xs font-bold uppercase tracking-wider mb-2 pb-1">Earnings</h3>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium">Basic Salary</td><td className="py-1.5 font-bold text-right">{formatCurrency(payroll.basic)}</td></tr>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium">HRA</td><td className="py-1.5 font-bold text-right">{formatCurrency(payroll.hra)}</td></tr>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium">Special Allowance</td><td className="py-1.5 font-bold text-right">{formatCurrency(payroll.special_allowance)}</td></tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="py-2 font-bold text-slate-800">Gross Earnings</td>
                      <td className="py-2 font-bold text-right">{formatCurrency(payroll.gross_earnings)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Deductions */}
              <div>
                <h3 className="payslip-section-title deduction text-xs font-bold uppercase tracking-wider mb-2 pb-1">Deductions</h3>
                <table className="w-full text-[13px]">
                  <tbody>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium">Loss of Pay / LOP</td><td className="py-1.5 font-bold text-right">{formatCurrency(payroll.lop_amount)}</td></tr>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium">Professional Tax</td><td className="py-1.5 font-bold text-right">{formatCurrency(payroll.pt)}</td></tr>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium">TDS</td><td className="py-1.5 font-bold text-right">{formatCurrency(payroll.tds)}</td></tr>
                    <tr className="payslip-row border-b border-slate-100"><td className="py-1.5 text-slate-600 font-medium">Staff Advance</td><td className="py-1.5 font-bold text-right">{formatCurrency(payroll.staff_advance)}</td></tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="py-2 font-bold text-slate-800">Total Deductions</td>
                      <td className="py-2 font-bold text-right">{formatCurrency(payroll.total_deductions)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

            </div>

            {/* Net Payable */}
            <div className="border-2 border-blue-300 rounded-lg p-4 flex justify-between items-center mb-6">
              <span className="font-bold text-blue-800 uppercase tracking-widest text-sm">Net Payable</span>
              <span className="text-2xl font-black text-blue-900">{formatCurrency(payroll.net_payable)}</span>
            </div>

            {/* Footer */}
            <div className="payslip-footer-divider border-t border-slate-300 pt-4 mt-2">
              <p className="text-xs text-slate-500 text-center italic mb-1">Note: This is a computer-generated pay slip and does not require a signature.</p>
              <p className="text-[11px] font-semibold text-slate-400 text-center">Generated on: {formatDate()}</p>
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

export default PayrollPaySlip;
