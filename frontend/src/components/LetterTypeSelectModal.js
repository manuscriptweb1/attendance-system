import React from 'react';
import { FiX, FiFileText, FiAward, FiCheckSquare, FiArrowRight } from 'react-icons/fi';

const LetterTypeSelectModal = ({ isOpen, onClose, onSelectType }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-admin-surface border border-admin-border rounded-2xl shadow-2xl p-6 text-admin-text space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-admin-border pb-4">
          <div>
            <h3 className="text-base font-bold text-admin-text">Select Document Type</h3>
            <p className="text-xs text-admin-muted mt-0.5">
              Choose the official company letter you wish to generate
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-admin-muted hover:text-admin-text hover:bg-admin-elevated transition-colors"
          >
            <FiX size={18} />
          </button>
        </div>

        {/* 3 Letter Choices Cards */}
        <div className="grid grid-cols-1 gap-3.5">
          
          {/* OPTION 1: OFFER LETTER */}
          <button
            type="button"
            onClick={() => onSelectType('offer')}
            className="w-full text-left p-4 rounded-xl bg-admin-bg hover:bg-admin-elevated/80 border border-admin-border hover:border-blue-500/40 transition-all group flex items-start justify-between cursor-pointer shadow-sm hover:shadow-md"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 font-bold group-hover:scale-105 transition-transform">
                <FiFileText size={22} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-admin-text group-hover:text-blue-500 transition-colors">
                    Offer Letter
                  </h4>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    5 Pages
                  </span>
                </div>
                <p className="text-xs text-admin-secondary leading-relaxed">
                  Official employment offer letter with detailed job terms, master role responsibilities, probation policy, and Annexure A compensation breakup.
                </p>
              </div>
            </div>
            <div className="p-2 text-admin-muted group-hover:text-blue-500 transition-colors">
              <FiArrowRight size={18} />
            </div>
          </button>

          {/* OPTION 2: RELIEVING LETTER */}
          <button
            type="button"
            onClick={() => onSelectType('relieving')}
            className="w-full text-left p-4 rounded-xl bg-admin-bg hover:bg-admin-elevated/80 border border-admin-border hover:border-purple-500/40 transition-all group flex items-start justify-between cursor-pointer shadow-sm hover:shadow-md"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 font-bold group-hover:scale-105 transition-transform">
                <FiCheckSquare size={22} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-admin-text group-hover:text-purple-500 transition-colors">
                    Relieving Letter
                  </h4>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500 border border-purple-500/20">
                    1 Page Letter
                  </span>
                </div>
                <p className="text-xs text-admin-secondary leading-relaxed">
                  Official single-page relieving letter with resignation acceptance, service duration, addressee block, management appreciation, and official sign-off.
                </p>
              </div>
            </div>
            <div className="p-2 text-admin-muted group-hover:text-purple-500 transition-colors">
              <FiArrowRight size={18} />
            </div>
          </button>

          {/* OPTION 3: EXPERIENCE LETTER */}
          <button
            type="button"
            onClick={() => onSelectType('experience')}
            className="w-full text-left p-4 rounded-xl bg-admin-bg hover:bg-admin-elevated/80 border border-admin-border hover:border-emerald-500/40 transition-all group flex items-start justify-between cursor-pointer shadow-sm hover:shadow-md"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold group-hover:scale-105 transition-transform">
                <FiAward size={22} />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-admin-text group-hover:text-emerald-500 transition-colors">
                    Experience Letter
                  </h4>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    1 Page Certificate
                  </span>
                </div>
                <p className="text-xs text-admin-secondary leading-relaxed">
                  Official experience & relieving certificate with tenure dates, monthly salary in words, role-specific project execution summary, and conduct appraisal.
                </p>
              </div>
            </div>
            <div className="p-2 text-admin-muted group-hover:text-emerald-500 transition-colors">
              <FiArrowRight size={18} />
            </div>
          </button>

        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-admin-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-admin-secondary hover:text-admin-text hover:bg-admin-elevated rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>

      </div>
    </div>
  );
};

export default LetterTypeSelectModal;
