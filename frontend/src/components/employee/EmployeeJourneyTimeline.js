import React, { useState } from 'react';
import {
  FiFileText,
  FiUserCheck,
  FiShield,
  FiActivity,
  FiAward,
  FiCheckCircle,
  FiEdit2,
  FiExternalLink,
  FiClock,
  FiX,
  FiSave,
  FiAlertCircle
} from 'react-icons/fi';
import { formatDate } from '../../utils/dateUtils';
import { updateEmployeeMilestones } from '../../services/api';

const EmployeeJourneyTimeline = ({
  employee,
  milestones,
  tenure,
  onRefresh,
  onOpenOfferLetter,
  onOpenExperienceLetter,
  onOpenRelievingLetter
}) => {
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Form state for editing milestone dates
  const [formOfferDate, setFormOfferDate] = useState('');
  const [formJoiningDate, setFormJoiningDate] = useState('');
  const [formResignedDate, setFormResignedDate] = useState('');

  const openEditModal = () => {
    setFormOfferDate(employee?.manual_offer_letter_date ? employee.manual_offer_letter_date.split('T')[0] : (milestones?.offer_letter?.date ? milestones.offer_letter.date.split('T')[0] : ''));
    setFormJoiningDate(employee?.joining_date ? employee.joining_date.split('T')[0] : '');
    setFormResignedDate(employee?.resigned_date ? employee.resigned_date.split('T')[0] : '');
    setSaveError('');
    setShowEditModal(true);
  };

  const handleSaveMilestones = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSaveError('');

      await updateEmployeeMilestones(employee.id, {
        manual_offer_letter_date: formOfferDate || null,
        joining_date: formJoiningDate || null,
        resigned_date: formResignedDate || null
      });

      setShowEditModal(false);
      if (onRefresh) onRefresh();
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save milestone dates');
    } finally {
      setSaving(false);
    }
  };

  const isResigned = milestones?.current_service?.is_resigned;
  const offer = milestones?.offer_letter || {};
  const joining = milestones?.joining || {};
  const probation = milestones?.probation || {};
  const experience = milestones?.experience_letter || {};
  const relieving = milestones?.relieving_letter || {};

  return (
    <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 sm:p-6 shadow-clay-admin transition-all">
      {/* Header with Title, Live Tenure Pill, and Edit Milestone Dates Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-admin-border/60">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-purple-50 dark:bg-gradient-to-br dark:from-purple-500/20 dark:to-blue-500/20 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30">
              <FiActivity size={18} />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-admin-text tracking-tight">
                Career Journey & Milestone Timeline
              </h3>
              <p className="text-xs text-admin-secondary">
                Point-to-point employment tracking from onboarding to current tenure
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Live Tenure Counter Pill */}
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-500/40 text-xs font-bold font-mono shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 shrink-0 shadow-sm shadow-emerald-500/50" />
            <span>Tenure: {tenure?.formatted || 'Calculating...'}</span>
            {tenure?.totalDays ? (
              <span className="text-purple-700 dark:text-purple-300 font-semibold">({tenure.totalDays} days)</span>
            ) : null}
          </div>

          {/* Edit Milestone Dates Button */}
          <button
            onClick={openEditModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-admin-bg hover:bg-admin-elevated border border-admin-border text-admin-text text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
            title="Edit manual dates for Offer Letter, Joining Date, or Exit Date"
          >
            <FiEdit2 size={13} className="text-admin-accent" />
            <span>Edit Dates</span>
          </button>
        </div>
      </div>

      {/* Online Delivery Style Connected Stepper (Horizontal on md+, Stepper Cards on mobile) */}
      <div className="relative">
        {/* Desktop Connecting Line */}
        <div className="hidden md:block absolute top-[28px] left-[5%] right-[5%] h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-emerald-500/60 rounded-full z-0 opacity-40" />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative z-10">
          
          {/* STEP 1: Offer Letter */}
          <div className="flex flex-col items-center text-center p-3.5 rounded-xl bg-admin-bg/60 border border-admin-border/50 hover:border-blue-500/40 transition-all group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-md transition-transform group-hover:scale-105 ${
              offer.date
                ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-blue-500/25'
                : 'bg-admin-surface border border-admin-border text-admin-muted'
            }`}>
              <FiFileText size={22} />
            </div>

            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
              Step 1 • Offer Letter
            </span>

            <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-full">
              {offer.letter_number ? offer.letter_number : (offer.date ? 'Offer Date' : 'Not Mentioned')}
            </p>

            <span className="text-xs font-mono font-bold text-blue-700 dark:text-blue-300 mt-0.5">
              {offer.date ? formatDate(offer.date) : 'Date Not Mentioned'}
            </span>

            {/* Status / Action Pill */}
            <div className="mt-2.5">
              {offer.id ? (
                <button
                  onClick={() => onOpenOfferLetter && onOpenOfferLetter(offer.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-300 text-blue-700 dark:bg-blue-500/20 dark:hover:bg-blue-500/30 dark:border-blue-500/40 dark:text-blue-300 text-[11px] font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
                  title="Click to Preview Offer Letter"
                >
                  <FiExternalLink size={11} />
                  <span>View Letter</span>
                </button>
              ) : offer.date ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200 dark:bg-white/10 dark:text-slate-200 dark:border-white/15 text-[10px] font-bold">
                  <FiCheckCircle size={11} className="text-blue-600 dark:text-blue-400" /> Manual Date
                </span>
              ) : (
                <button
                  onClick={openEditModal}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  + Add Date
                </button>
              )}
            </div>
          </div>

          {/* STEP 2: Joining Date (Day 1) */}
          <div className="flex flex-col items-center text-center p-3.5 rounded-xl bg-admin-bg/60 border border-admin-border/50 hover:border-emerald-500/40 transition-all group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-md transition-transform group-hover:scale-105 ${
              joining.date
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/25'
                : 'bg-admin-surface border border-admin-border text-admin-muted'
            }`}>
              <FiUserCheck size={22} />
            </div>

            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
              Step 2 • Joining Day
            </span>

            <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-full">
              Day 1 Onboarding
            </p>

            <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
              {joining.date ? formatDate(joining.date) : 'Date Not Mentioned'}
            </span>

            <div className="mt-2.5">
              {joining.date ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 text-[10px] font-bold shadow-sm">
                  <FiCheckCircle size={11} className="text-emerald-600 dark:text-emerald-400" /> Official Day 1
                </span>
              ) : (
                <button
                  onClick={openEditModal}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  + Set Joining
                </button>
              )}
            </div>
          </div>

          {/* STEP 3: Probation / Confirmation Milestone */}
          <div className="flex flex-col items-center text-center p-3.5 rounded-xl bg-admin-bg/60 border border-admin-border/50 hover:border-amber-500/40 transition-all group">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-md transition-transform group-hover:scale-105 ${
              probation.is_completed
                ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-amber-500/25'
                : 'bg-admin-surface border border-admin-border text-admin-muted'
            }`}>
              <FiShield size={22} />
            </div>

            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
              Step 3 • Probation
            </span>

            <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-full">
              3-Month Evaluation
            </p>

            <span className="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 mt-0.5">
              {probation.date ? formatDate(probation.date) : 'N/A'}
            </span>

            <div className="mt-2.5">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border shadow-sm ${
                probation.is_completed
                  ? 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                  : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-white/10 dark:text-slate-300 dark:border-white/20'
              }`}>
                {probation.is_completed ? <FiCheckCircle size={11} className="text-amber-600 dark:text-amber-400" /> : <FiClock size={11} />}
                {probation.is_completed ? 'Confirmed' : 'In Progress'}
              </span>
            </div>
          </div>

          {/* STEP 4: Live Service & Current Tenure */}
          <div className={`relative flex flex-col items-center text-center p-3.5 pt-5 rounded-xl border transition-all duration-300 group ${
            isResigned
              ? 'bg-admin-bg/60 border-admin-border/50'
              : 'bg-gradient-to-b from-purple-500/20 via-purple-500/10 to-indigo-500/5 border-2 border-purple-500/80 shadow-xl shadow-purple-500/20 ring-4 ring-purple-500/15'
          }`}>
            {!isResigned && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white text-[9px] font-black uppercase tracking-widest shadow-md shadow-purple-500/30 border border-purple-300/40 whitespace-nowrap flex items-center gap-1.5 z-20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Current Stage</span>
              </div>
            )}

            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-md transition-transform group-hover:scale-105 relative ${
              isResigned
                ? 'bg-admin-surface border border-admin-border text-admin-muted'
                : 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/35 ring-4 ring-purple-500/30'
            }`}>
              <FiActivity size={22} />
              {!isResigned && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-admin-surface shadow-sm" title="Active Status" />
              )}
            </div>

            <span className={`text-[10px] uppercase tracking-wider mb-0.5 ${
              isResigned ? 'font-extrabold text-slate-500 dark:text-slate-400' : 'font-black text-purple-700 dark:text-purple-300'
            }`}>
              Step 4 • Current Tenure
            </span>

            <p className="text-xs font-black text-slate-900 dark:text-white truncate max-w-full">
              {isResigned ? 'Service Concluded' : 'Active Working Status'}
            </p>

            <span className={`text-xs font-mono font-bold mt-1 px-2.5 py-1 rounded-lg border shadow-sm ${
              isResigned
                ? 'text-slate-800 bg-slate-100 border-slate-300 dark:text-slate-300 dark:bg-white/10 dark:border-white/20'
                : 'text-purple-900 bg-purple-100 border-purple-300 dark:text-purple-200 dark:bg-purple-900/50 dark:border-purple-500/50'
            }`}>
              {tenure?.formatted || 'Active'}
            </span>

            <div className="mt-2.5">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border shadow-sm ${
                isResigned
                  ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/25 dark:text-amber-300 dark:border-amber-500/40'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/25 dark:text-emerald-300 dark:border-emerald-500/40'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isResigned ? 'bg-amber-600 dark:bg-amber-400' : 'bg-emerald-600 dark:bg-emerald-400'}`} />
                {isResigned ? 'Resigned' : 'Active Employee'}
              </span>
            </div>
          </div>

          {/* STEP 5: Relieving & Experience Letters (Exit) */}
          <div className={`relative flex flex-col items-center text-center p-3.5 rounded-xl border transition-all group ${
            isResigned
              ? 'bg-gradient-to-b from-amber-500/20 via-amber-500/10 to-orange-500/5 border-2 border-amber-500/80 shadow-xl shadow-amber-500/20 ring-4 ring-amber-500/15 pt-5'
              : 'bg-admin-bg/60 border-admin-border/50 hover:border-emerald-500/40'
          }`}>
            {isResigned && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white text-[9px] font-black uppercase tracking-widest shadow-md shadow-amber-500/30 border border-amber-300/40 whitespace-nowrap flex items-center gap-1.5 z-20">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                <span>Current Stage</span>
              </div>
            )}
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 shadow-md transition-transform group-hover:scale-105 ${
              experience.id || relieving.id
                ? 'bg-gradient-to-br from-emerald-500 to-cyan-600 text-white shadow-emerald-500/25'
                : 'bg-admin-surface border border-admin-border text-admin-muted'
            }`}>
              <FiAward size={22} />
            </div>

            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-0.5">
              Step 5 • Exit & Letters
            </span>

            <p className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-full">
              {experience.letter_number || relieving.letter_number || (isResigned ? 'Resigned' : 'Active Service')}
            </p>

            <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">
              {experience.date
                ? formatDate(experience.date)
                : (relieving.date ? formatDate(relieving.date) : (isResigned ? (employee?.resigned_date ? formatDate(employee.resigned_date) : 'Exit Recorded') : 'In Active Service'))}
            </span>

            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap justify-center">
              {experience.id && (
                <button
                  onClick={() => onOpenExperienceLetter && onOpenExperienceLetter(experience.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 dark:border-emerald-500/40 dark:text-emerald-300 text-[10px] font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
                  title="Preview Experience Letter"
                >
                  <FiExternalLink size={10} /> Exp Letter
                </button>
              )}

              {relieving.id && (
                <button
                  onClick={() => onOpenRelievingLetter && onOpenRelievingLetter(relieving.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 border border-cyan-300 text-cyan-800 dark:bg-cyan-500/20 dark:hover:bg-cyan-500/30 dark:border-cyan-500/40 dark:text-cyan-300 text-[10px] font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
                  title="Preview Relieving Letter"
                >
                  <FiExternalLink size={10} /> Rel Letter
                </button>
              )}

              {!experience.id && !relieving.id && !isResigned && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold">Ongoing</span>
              )}

              {!experience.id && !relieving.id && isResigned && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40 text-[10px] font-bold shadow-sm">
                  Letters Pending
                </span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Edit Milestone Dates Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-md flex flex-col animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border">
              <div>
                <h2 className="text-base font-bold text-admin-text">Edit Career Milestone Dates</h2>
                <p className="text-xs text-admin-secondary mt-0.5">
                  {employee?.employee_id} - {employee?.name}
                </p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-admin-secondary hover:bg-admin-surface transition-colors cursor-pointer"
              >
                <FiX size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMilestones} className="p-6 space-y-4">
              {saveError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
                  <FiAlertCircle size={14} className="shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Offer Letter Date */}
              <div>
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">
                  Offer Letter Date (Historical / Manual)
                </label>
                <input
                  type="date"
                  value={formOfferDate}
                  onChange={(e) => setFormOfferDate(e.target.value)}
                  className="admin-input"
                />
                <p className="text-[11px] text-admin-muted mt-1">
                  For employees who received an offer letter before the automated system.
                </p>
              </div>

              {/* Joining Date */}
              <div>
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">
                  Official Joining Date (Day 1)
                </label>
                <input
                  type="date"
                  value={formJoiningDate}
                  onChange={(e) => setFormJoiningDate(e.target.value)}
                  className="admin-input"
                />
                <p className="text-[11px] text-admin-muted mt-1">
                  Used as the starting date for live tenure calculation.
                </p>
              </div>

              {/* Resigned Date (if applicable) */}
              <div>
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">
                  Resigned / Exit Date
                </label>
                <input
                  type="date"
                  value={formResignedDate}
                  onChange={(e) => setFormResignedDate(e.target.value)}
                  className="admin-input"
                />
                <p className="text-[11px] text-admin-muted mt-1">
                  Leave empty if employee is actively working.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-admin-border/60">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={saving}
                  className="admin-btn-neutral rounded-xl px-4 py-2 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold bg-[#3B82F6] hover:bg-blue-500 text-white rounded-xl shadow-glow-blue-sm transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <FiSave size={14} />
                  <span>{saving ? 'Saving...' : 'Save Milestone Dates'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeJourneyTimeline;
