import React, { useState, useEffect, useMemo } from 'react';
import {
  FiFileText,
  FiDownload,
  FiEye,
  FiExternalLink,
  FiCheckCircle,
  FiClock,
  FiAward,
  FiUserCheck,
  FiRefreshCw
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import {
  getOfferLetterSettings,
  downloadOfferLetterPdf,
  downloadExperienceLetterPdf,
  downloadRelievingLetterPdf,
  downloadEmployeeDetailsForm
} from '../../services/api';
import OfferLetterPreviewModal from '../OfferLetterPreviewModal';
import ExperienceLetterPreviewModal from '../ExperienceLetterPreviewModal';
import RelievingLetterPreviewModal from '../RelievingLetterPreviewModal';
import EmployeeDetailsFormModal from '../EmployeeDetailsFormModal';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch (e) {
    return String(dateStr);
  }
};

const EmployeeDocumentsTab = ({ employeeId, employee, fullProfileData, onRefreshProfile, highlightDoc, setHighlightDoc }) => {
  const [settings, setSettings] = useState(null);
  const [downloadingDoc, setDownloadingDoc] = useState(null);

  // Modals state
  const [previewOfferData, setPreviewOfferData] = useState(null);
  const [previewExpData, setPreviewExpData] = useState(null);
  const [previewRelData, setPreviewRelData] = useState(null);
  const [showBioDataModal, setShowBioDataModal] = useState(false);

  const getDocType = (val) => (typeof val === 'object' && val?.type ? val.type : (val || 'all'));
  const currentDocType = getDocType(highlightDoc);
  const [activeFilter, setActiveFilter] = useState(currentDocType || 'all');

  // Smooth scroll and focus on highlighted document card
  useEffect(() => {
    const doc = getDocType(highlightDoc);
    setActiveFilter(doc || 'all');
    if (doc && doc !== 'all') {
      const timer = setTimeout(() => {
        const el = document.getElementById(`doc-card-${doc}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [highlightDoc]);

  useEffect(() => {
    getOfferLetterSettings()
      .then((res) => {
        if (res.data?.success && res.data?.settings) {
          setSettings(res.data.settings);
        }
      })
      .catch((err) => console.warn('Failed to load letter settings:', err));
  }, []);

  const offerLetters = useMemo(() => fullProfileData?.letters?.offer_letters || [], [fullProfileData]);
  const experienceLetters = useMemo(() => fullProfileData?.letters?.experience_letters || [], [fullProfileData]);
  const relievingLetters = useMemo(() => fullProfileData?.letters?.relieving_letters || [], [fullProfileData]);

  const latestOffer = offerLetters[0] || null;
  const latestExp = experienceLetters[0] || null;
  const latestRel = relievingLetters[0] || null;

  // Handle Offer Letter Download
  const handleDownloadOffer = async (offer, withSignature = true) => {
    if (!offer) return;
    try {
      setDownloadingDoc(`offer-${offer.id}`);
      const res = await downloadOfferLetterPdf(offer.id, withSignature);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const safeNum = (offer.offer_number || 'OFF').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Offer_Letter_${employee?.name || 'Employee'}_${safeNum}${withSignature ? '_signed' : ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download offer letter:', err);
      alert('Failed to download offer letter PDF.');
    } finally {
      setDownloadingDoc(null);
    }
  };

  // Handle Experience Letter Download
  const handleDownloadExp = async (exp, withSignature = true) => {
    if (!exp) return;
    try {
      setDownloadingDoc(`exp-${exp.id}`);
      const res = await downloadExperienceLetterPdf(exp.id, withSignature);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const safeNum = (exp.letter_number || 'EXP').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Experience_Letter_${employee?.name || 'Employee'}_${safeNum}${withSignature ? '_signed' : ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download experience letter:', err);
      alert('Failed to download experience letter PDF.');
    } finally {
      setDownloadingDoc(null);
    }
  };

  // Handle Relieving Letter Download
  const handleDownloadRel = async (rel, withSignature = true) => {
    if (!rel) return;
    try {
      setDownloadingDoc(`rel-${rel.id}`);
      const res = await downloadRelievingLetterPdf(rel.id, withSignature);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      const safeNum = (rel.letter_number || 'REL').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Relieving_Letter_${employee?.name || 'Employee'}_${safeNum}${withSignature ? '_signed' : ''}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download relieving letter:', err);
      alert('Failed to download relieving letter PDF.');
    } finally {
      setDownloadingDoc(null);
    }
  };

  // Handle Bio-Data Form Download
  const handleDownloadBioData = async () => {
    const empId = employee?.employee_id || employee?.id || employeeId;
    if (!empId) return;
    try {
      setDownloadingDoc('biodata');
      const res = await downloadEmployeeDetailsForm(empId);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `Employee_BioData_${employee?.name || 'Staff'}_${employee?.employee_id || empId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download bio-data form:', err);
      alert('Failed to download employee details form PDF.');
    } finally {
      setDownloadingDoc(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-admin-surface via-admin-surface to-admin-accent/5 border border-admin-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-admin-text flex items-center gap-2">
            <FiFileText className="text-admin-accent" />
            Official Letters & Verification Hub
          </h3>
          <p className="text-xs text-admin-text-muted mt-1 max-w-2xl">
            Central repository for candidate offer letters, employee tenure certificates, relieving documentation, and the full onboarding bio-data dossier.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to={`/admin/offer-letters`}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-admin-accent hover:bg-admin-accent-hover text-white text-xs font-bold transition shadow-sm"
          >
            <FiExternalLink className="w-3.5 h-3.5" />
            <span>Open Official Letters Studio</span>
          </Link>
        </div>
      </div>

      {/* Quick Filter Navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'All Documents (4)' },
          { id: 'biodata', label: 'Employee Bio-Data' },
          { id: 'offer', label: 'Official Offer Letter' },
          { id: 'relieving', label: 'Relieving Letter' },
          { id: 'experience', label: 'Experience Letter' },
        ].map((tab) => {
          const isActive = (activeFilter === tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveFilter(tab.id);
                if (setHighlightDoc) setHighlightDoc({ type: tab.id, ts: Date.now() });
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-admin-accent text-white shadow-md shadow-admin-accent/25 ring-2 ring-admin-accent/40'
                  : 'bg-white dark:bg-admin-surface border border-slate-200 dark:border-admin-border text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-admin-elevated'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Filter Banner */}
      {activeFilter !== 'all' && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/40 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              Showing single card: <strong className="text-blue-700 dark:text-blue-300 capitalize">
                {activeFilter === 'biodata' ? 'Employee Bio-Data Form' : activeFilter === 'offer' ? 'Official Offer Letter' : activeFilter === 'relieving' ? 'Relieving Letter' : 'Experience Letter'}
              </strong>
            </span>
          </div>
          <button
            onClick={() => {
              setActiveFilter('all');
              if (setHighlightDoc) setHighlightDoc({ type: 'all', ts: Date.now() });
            }}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Show All 4 Documents →
          </button>
        </div>
      )}

      {/* 4 Core Documents Grid - Reordered: Bio Data, Offer Letter, Relieving Letter, Experience Letter */}
      <div className={activeFilter === 'all' ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "grid grid-cols-1 max-w-2xl mx-auto gap-6"}>
        
        {/* Document 1: Employee Master Bio-Data Form */}
        {(activeFilter === 'all' || activeFilter === 'biodata') && (
        <div 
          id="doc-card-biodata"
          className={`p-6 rounded-2xl bg-white dark:bg-admin-surface border shadow-sm flex flex-col justify-between transition-all duration-500 ${
            currentDocType === 'biodata' || activeFilter === 'biodata'
              ? 'ring-4 ring-indigo-500/60 border-indigo-500 shadow-2xl scale-[1.01]'
              : 'border-slate-200 dark:border-admin-border hover:border-admin-accent/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-admin-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 border border-indigo-300 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20 flex items-center justify-center font-bold">
                  <FiFileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">Employee Bio-Data Form</h4>
                  <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">Master Personnel Record Dossier</span>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/40 flex items-center gap-1">
                <FiCheckCircle className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                Verified
              </span>
            </div>

            {/* Document Details */}
            <div className="space-y-2.5 text-xs mb-6">
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-admin-border/50">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Employee Code</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{employee?.employee_id || '—'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-admin-border/50">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Department & Role</span>
                <span className="font-bold text-slate-900 dark:text-white">{employee?.job_role} ({employee?.department_name})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 dark:border-admin-border/50">
                <span className="text-slate-700 dark:text-slate-300 font-medium">Identity Records</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {[
                    employee?.pan_card_number && 'PAN',
                    employee?.aadhar_card_number && 'Aadhar',
                    employee?.account_number && 'Bank A/C'
                  ].filter(Boolean).join(', ') || 'Standard Docs'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-admin-border flex items-center justify-between gap-2">
            <button
              onClick={() => setShowBioDataModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-admin-bg dark:hover:bg-admin-surface text-slate-900 dark:text-admin-text text-xs font-bold transition border border-slate-300 dark:border-admin-border cursor-pointer"
            >
              <FiEye className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
              <span>Preview Form</span>
            </button>
            <button
              onClick={handleDownloadBioData}
              disabled={downloadingDoc === 'biodata'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-admin-accent hover:bg-admin-accent-hover text-white text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {downloadingDoc === 'biodata' ? (
                <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FiDownload className="w-3.5 h-3.5" />
              )}
              <span>Download PDF</span>
            </button>
          </div>
        </div>
        )}

        {/* Document 2: Official Offer Letter */}
        {(activeFilter === 'all' || activeFilter === 'offer') && (
        <div 
          id="doc-card-offer"
          className={`p-6 rounded-2xl bg-white dark:bg-admin-surface border shadow-sm flex flex-col justify-between transition-all duration-500 ${
            currentDocType === 'offer' || activeFilter === 'offer'
              ? 'ring-4 ring-blue-500/60 border-blue-500 shadow-2xl scale-[1.01]'
              : 'border-slate-200 dark:border-admin-border hover:border-admin-accent/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-admin-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 border border-blue-300 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20 flex items-center justify-center font-bold">
                  <FiFileText className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">Official Offer Letter</h4>
                  <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">Onboarding & Compensation Agreement</span>
                </div>
              </div>

              {latestOffer ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/40 flex items-center gap-1">
                  <FiCheckCircle className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                  {latestOffer.status || 'Generated'}
                </span>
              ) : fullProfileData?.milestones?.offer_letter?.is_manual ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-950 dark:bg-amber-950/60 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40">
                  Manual Record
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  Not Generated
                </span>
              )}
            </div>

            {/* Document Details */}
            {latestOffer ? (
              <div className="space-y-2.5 text-xs mb-6">
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Offer Reference</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{latestOffer.offer_number || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Issue Date</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatDate(latestOffer.offer_date)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Joining Date Mentioned</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatDate(latestOffer.joining_date)}</span>
                </div>
                {latestOffer.monthly_salary && (
                  <div className="flex justify-between py-1 border-b border-slate-200 dark:border-admin-border/50">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">Offered Monthly CTC</span>
                    <span className="font-black text-emerald-800 dark:text-emerald-300">₹ {Number(latestOffer.monthly_salary).toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-700 dark:text-slate-300 text-xs mb-4">
                <FiClock className="w-8 h-8 mx-auto mb-2 text-slate-400 dark:text-admin-muted/40" />
                <p className="font-bold text-slate-800 dark:text-white">
                  {fullProfileData?.milestones?.offer_letter?.is_manual
                    ? `Milestone recorded manually: ${formatDate(fullProfileData?.milestones?.offer_letter?.date)}`
                    : 'No system offer letter document generated yet.'}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-medium">
                  Generate the formal offer letter package from Official Letters.
                </p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-admin-border flex items-center justify-between gap-2">
            {latestOffer ? (
              <>
                <button
                  onClick={() => setPreviewOfferData(latestOffer)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-admin-bg dark:hover:bg-admin-surface text-slate-900 dark:text-admin-text text-xs font-bold transition border border-slate-300 dark:border-admin-border cursor-pointer"
                >
                  <FiEye className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => handleDownloadOffer(latestOffer, true)}
                  disabled={downloadingDoc === `offer-${latestOffer.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-admin-accent hover:bg-admin-accent-hover text-white text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {downloadingDoc === `offer-${latestOffer.id}` ? (
                    <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FiDownload className="w-3.5 h-3.5" />
                  )}
                  <span>Download Signed PDF</span>
                </button>
              </>
            ) : (
              <Link
                to={`/admin/offer-letters`}
                className="w-full text-center py-2 rounded-xl bg-blue-100 hover:bg-admin-accent text-blue-900 hover:text-white border border-blue-300 dark:bg-admin-accent/10 dark:text-admin-accent dark:border-admin-accent/30 text-xs font-bold transition"
              >
                + Create Offer Letter
              </Link>
            )}
          </div>
        </div>
        )}

        {/* Document 3: Relieving Letter */}
        {(activeFilter === 'all' || activeFilter === 'relieving') && (
        <div 
          id="doc-card-relieving"
          className={`p-6 rounded-2xl bg-white dark:bg-admin-surface border shadow-sm flex flex-col justify-between transition-all duration-500 ${
            currentDocType === 'relieving' || activeFilter === 'relieving'
              ? 'ring-4 ring-amber-500/60 border-amber-500 shadow-2xl scale-[1.01]'
              : 'border-slate-200 dark:border-admin-border hover:border-admin-accent/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-admin-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20 flex items-center justify-center font-bold">
                  <FiUserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">Relieving Letter</h4>
                  <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">Official Exit & Separation Release</span>
                </div>
              </div>

              {latestRel ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/40 flex items-center gap-1">
                  <FiCheckCircle className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                  {latestRel.status || 'Generated'}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  Not Issued
                </span>
              )}
            </div>

            {/* Document Details */}
            {latestRel ? (
              <div className="space-y-2.5 text-xs mb-6">
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Letter Reference</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{latestRel.letter_number || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Date of Relieving</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatDate(latestRel.relieving_date)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Notice Period Served</span>
                  <span className="font-bold text-slate-900 dark:text-white">{latestRel.notice_period || 'Standard'}</span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-700 dark:text-slate-300 text-xs mb-4">
                <FiClock className="w-8 h-8 mx-auto mb-2 text-slate-400 dark:text-admin-muted/40" />
                <p className="font-bold text-slate-800 dark:text-white">No relieving letter issued.</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-medium">
                  Generated when employee resigns and successfully completes handover.
                </p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-admin-border flex items-center justify-between gap-2">
            {latestRel ? (
              <>
                <button
                  onClick={() => setPreviewRelData(latestRel)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-admin-bg dark:hover:bg-admin-surface text-slate-900 dark:text-admin-text text-xs font-bold transition border border-slate-300 dark:border-admin-border cursor-pointer"
                >
                  <FiEye className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => handleDownloadRel(latestRel, true)}
                  disabled={downloadingDoc === `rel-${latestRel.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-admin-accent hover:bg-admin-accent-hover text-white text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {downloadingDoc === `rel-${latestRel.id}` ? (
                    <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FiDownload className="w-3.5 h-3.5" />
                  )}
                  <span>Download Signed PDF</span>
                </button>
              </>
            ) : (
              <Link
                to={`/admin/offer-letters`}
                className="w-full text-center py-2 rounded-xl bg-slate-100 hover:bg-admin-accent text-slate-800 hover:text-white border border-slate-300 dark:bg-admin-surface dark:hover:bg-admin-accent dark:border-admin-border text-xs font-bold transition"
              >
                + Issue Relieving Letter
              </Link>
            )}
          </div>
        </div>
        )}

        {/* Document 4: Experience Letter */}
        {(activeFilter === 'all' || activeFilter === 'experience') && (
        <div 
          id="doc-card-experience"
          className={`p-6 rounded-2xl bg-white dark:bg-admin-surface border shadow-sm flex flex-col justify-between transition-all duration-500 ${
            currentDocType === 'experience' || activeFilter === 'experience'
              ? 'ring-4 ring-emerald-500/60 border-emerald-500 shadow-2xl scale-[1.01]'
              : 'border-slate-200 dark:border-admin-border hover:border-admin-accent/40'
          }`}
        >
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-admin-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 flex items-center justify-center font-bold">
                  <FiAward className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white">Experience Letter</h4>
                  <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium">Tenure & Conduct Certificate</span>
                </div>
              </div>

              {latestExp ? (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-950 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/40 flex items-center gap-1">
                  <FiCheckCircle className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                  {latestExp.status || 'Generated'}
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  Not Issued
                </span>
              )}
            </div>

            {/* Document Details */}
            {latestExp ? (
              <div className="space-y-2.5 text-xs mb-6">
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Certificate Number</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{latestExp.letter_number || '—'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Date of Issue</span>
                  <span className="font-bold text-slate-900 dark:text-white">{formatDate(latestExp.issue_date)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-admin-border/50">
                  <span className="text-slate-700 dark:text-slate-300 font-medium">Service Period</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {formatDate(latestExp.joining_date)} → {formatDate(latestExp.relieving_date)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-700 dark:text-slate-300 text-xs mb-4">
                <FiClock className="w-8 h-8 mx-auto mb-2 text-slate-400 dark:text-admin-muted/40" />
                <p className="font-bold text-slate-800 dark:text-white">No experience certificate issued yet.</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1 font-medium">
                  Issued upon completion of service or post-relieving clearance.
                </p>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-admin-border flex items-center justify-between gap-2">
            {latestExp ? (
              <>
                <button
                  onClick={() => setPreviewExpData(latestExp)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-admin-bg dark:hover:bg-admin-surface text-slate-900 dark:text-admin-text text-xs font-bold transition border border-slate-300 dark:border-admin-border cursor-pointer"
                >
                  <FiEye className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" />
                  <span>Preview</span>
                </button>
                <button
                  onClick={() => handleDownloadExp(latestExp, true)}
                  disabled={downloadingDoc === `exp-${latestExp.id}`}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-admin-accent hover:bg-admin-accent-hover text-white text-xs font-bold transition shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {downloadingDoc === `exp-${latestExp.id}` ? (
                    <FiRefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FiDownload className="w-3.5 h-3.5" />
                  )}
                  <span>Download Signed PDF</span>
                </button>
              </>
            ) : (
              <Link
                to={`/admin/offer-letters`}
                className="w-full text-center py-2 rounded-xl bg-slate-100 hover:bg-admin-accent text-slate-800 hover:text-white border border-slate-300 dark:bg-admin-surface dark:hover:bg-admin-accent dark:border-admin-border text-xs font-bold transition"
              >
                + Issue Experience Letter
              </Link>
            )}
          </div>
        </div>
        )}

      </div>

      {/* Complete Official Letters History Table (if employee has multiple versions) */}
      {(offerLetters.length > 1 || experienceLetters.length > 1 || relievingLetters.length > 1) && (
        <div className="p-6 rounded-2xl bg-admin-surface border border-admin-border shadow-sm">
          <h4 className="text-sm font-bold text-admin-text mb-3">All Archived Letters & Amendments</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-admin-border text-admin-text-muted uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Ref Number</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-border/50">
                {offerLetters.map(o => (
                  <tr key={`off-${o.id}`} className="hover:bg-admin-surface-hover/50">
                    <td className="py-2.5 px-3 font-semibold text-blue-400">Offer Letter</td>
                    <td className="py-2.5 px-3 font-mono">{o.offer_number}</td>
                    <td className="py-2.5 px-3">{formatDate(o.offer_date)}</td>
                    <td className="py-2.5 px-3">{o.status}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDownloadOffer(o, true)}
                        className="text-admin-accent hover:underline font-bold"
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
                {relievingLetters.map(r => (
                  <tr key={`rel-${r.id}`} className="hover:bg-admin-surface-hover/50">
                    <td className="py-2.5 px-3 font-semibold text-amber-400">Relieving Letter</td>
                    <td className="py-2.5 px-3 font-mono">{r.letter_number}</td>
                    <td className="py-2.5 px-3">{formatDate(r.issue_date)}</td>
                    <td className="py-2.5 px-3">{r.status}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDownloadRel(r, true)}
                        className="text-admin-accent hover:underline font-bold"
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
                {experienceLetters.map(e => (
                  <tr key={`exp-${e.id}`} className="hover:bg-admin-surface-hover/50">
                    <td className="py-2.5 px-3 font-semibold text-emerald-400">Experience Letter</td>
                    <td className="py-2.5 px-3 font-mono">{e.letter_number}</td>
                    <td className="py-2.5 px-3">{formatDate(e.issue_date)}</td>
                    <td className="py-2.5 px-3">{e.status}</td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleDownloadExp(e, true)}
                        className="text-admin-accent hover:underline font-bold"
                      >
                        Download PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Offer Letter Preview Modal */}
      {previewOfferData && (
        <OfferLetterPreviewModal
          isOpen={true}
          onClose={() => setPreviewOfferData(null)}
          offerData={previewOfferData}
          settings={settings}
          onDownload={(signed) => handleDownloadOffer(previewOfferData, signed)}
          onPrint={() => window.print()}
        />
      )}

      {/* Experience Letter Preview Modal */}
      {previewExpData && (
        <ExperienceLetterPreviewModal
          isOpen={true}
          onClose={() => setPreviewExpData(null)}
          letterData={previewExpData}
          settings={settings}
          onDownload={(signed) => handleDownloadExp(previewExpData, signed)}
          onPrint={() => window.print()}
        />
      )}

      {/* Relieving Letter Preview Modal */}
      {previewRelData && (
        <RelievingLetterPreviewModal
          isOpen={true}
          onClose={() => setPreviewRelData(null)}
          letterData={previewRelData}
          settings={settings}
          onDownload={(signed) => handleDownloadRel(previewRelData, signed)}
          onPrint={() => window.print()}
        />
      )}

      {/* Employee Bio-Data Form Modal */}
      {showBioDataModal && (
        <EmployeeDetailsFormModal
          employee={employee}
          onClose={() => setShowBioDataModal(false)}
        />
      )}
    </div>
  );
};

export default EmployeeDocumentsTab;
