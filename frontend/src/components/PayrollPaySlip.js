import React, { useState } from 'react';
import { FiX, FiDownload } from 'react-icons/fi';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { formatIndianCurrency as formatCurrency } from '../utils/formatCurrency';

const PayrollPaySlip = ({ data, onClose, logoPath }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!data || !data.employee || !data.payroll) return null;

  const { employee, payroll } = data;
  const companyName = "Manuscript Technomedia LLP";
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthName = monthNames[payroll.month - 1];



  const formatDate = () => {
    const d = new Date();
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const handleDownloadPdf = async () => {
    try {
      setIsDownloading(true);
      const element = document.querySelector(".payslip-download-area");

      if (!element) {
        console.error("Pay slip content not found");
        setIsDownloading(false);
        return;
      }

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 8;
      const usableWidth = pageWidth - margin * 2;
      const usableHeight = pageHeight - margin * 2;

      const imgHeight = (canvas.height * usableWidth) / canvas.width;
      const finalHeight = Math.min(imgHeight, usableHeight);

      pdf.addImage(imgData, "PNG", margin, margin, usableWidth, finalHeight);

      const safeEmployeeCode = employee.employee_code.replace(/\s+/g, "_");
      const fileName = `payslip_${safeEmployeeCode}_${monthName}_${payroll.year}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error("PDF generation failed:", error);
    } finally {
      setIsDownloading(false);
    }
  };
  return (
    <div className="payslip-modal fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center z-[100] overflow-y-auto p-4 sm:p-8">
      {/* Modal Actions */}
      <div className="payslip-modal-actions absolute top-4 right-4 flex gap-3 no-print">
        <button 
          onClick={handleDownloadPdf} 
          disabled={isDownloading}
          className={`${isDownloading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'} text-white px-5 py-2 rounded-xl shadow-lg flex items-center gap-2 font-bold transition-all`}
        >
          <FiDownload size={18} /> {isDownloading ? 'Generating...' : 'Download PDF'}
        </button>
        <button onClick={onClose} className="bg-slate-800 hover:bg-slate-700 text-slate-200 w-10 h-10 rounded-xl shadow-lg flex items-center justify-center transition-all">
          <FiX size={20} />
        </button>
      </div>

      <div className="payslip-print-area w-full flex justify-center my-auto">
        <div className="payslip-a4 w-full max-w-[850px] mx-auto bg-white shadow-2xl rounded-lg text-slate-900">
          <div className="payslip-download-area payslip-card p-8 sm:p-12 border-[1.5px] border-slate-300 rounded-lg bg-white break-inside-avoid">
            
            {/* Company Header */}
            <div className="payslip-company-header">
              <img 
                src={`${window.location.origin}/favicon/web-app-manifest-192x192.png`} 
                alt="Company Logo" 
                crossOrigin="anonymous"
                className="payslip-logo"
              />
              <div className="payslip-company-name">{companyName}</div>
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
        </div>
      </div>
    </div>
  );
};

export default PayrollPaySlip;
