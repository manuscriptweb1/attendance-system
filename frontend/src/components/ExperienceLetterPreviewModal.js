import React, { useState, useRef } from 'react';
import { FiX, FiDownload, FiPrinter, FiZoomIn, FiZoomOut, FiLoader } from 'react-icons/fi';
import ExperienceLetterDocument from './ExperienceLetterDocument';
import { exportOfferLetterToPdf } from '../utils/offerLetterPdfExport';

const ExperienceLetterPreviewModal = ({
  isOpen,
  onClose,
  letterData,
  settings,
  onDownload,
  onPrint
}) => {
  const [zoom, setZoom] = useState(1);
  const [includeSignature, setIncludeSignature] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef(null);

  if (!isOpen || !letterData) return null;

  const employeeName = letterData.employee_name || letterData.employee_name_snapshot || 'Candidate';
  const letterNumber = letterData.letter_number || 'EXP';
  const safeName = employeeName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeNum = letterNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Experience_Letter_${safeName}_${safeNum}${includeSignature ? '_signed' : ''}.pdf`;

  const handleDownloadDirect = async () => {
    try {
      setIsExporting(true);
      const targetContainer = containerRef.current;
      if (targetContainer) {
        await exportOfferLetterToPdf(targetContainer, filename);
      } else if (onDownload) {
        await onDownload(includeSignature);
      }
    } catch (err) {
      console.error('Direct PDF export failed, fallback to handler:', err);
      if (onDownload) {
        await onDownload(includeSignature);
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint(includeSignature);
    } else {
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm overflow-hidden">
      <div className="relative w-full max-w-5xl h-[94vh] flex flex-col bg-admin-bg border border-admin-border rounded-2xl shadow-2xl overflow-hidden text-admin-text animate-fade-in">
        
        {/* Top Action Bar */}
        <div className="flex flex-wrap items-center justify-between px-6 py-3.5 border-b border-admin-border bg-admin-surface flex-shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-bold text-admin-accent px-2 py-0.5 rounded-lg bg-admin-accent/15 border border-admin-accent/30">
              {letterNumber}
            </span>
            <span className="text-xs font-bold text-admin-text">
              {employeeName}
            </span>
            <span className="text-[11px] text-admin-muted hidden sm:inline">
              • Experience Certificate
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Signature Toggle */}
            <div className="flex items-center bg-admin-bg border border-admin-border rounded-xl p-1 text-xs">
              <button
                type="button"
                onClick={() => setIncludeSignature(true)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  includeSignature ? 'bg-blue-600 text-white shadow-sm' : 'text-admin-secondary hover:text-admin-text'
                }`}
                title="Include Designated Partner Digital Signature & Seal"
              >
                <span>With Signature</span>
              </button>
              <button
                type="button"
                onClick={() => setIncludeSignature(false)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors flex items-center gap-1 ${
                  !includeSignature ? 'bg-slate-700 text-white shadow-sm' : 'text-admin-secondary hover:text-admin-text'
                }`}
                title="Without Signature (Clean for Physical Signing)"
              >
                <span>Without Signature</span>
              </button>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center bg-admin-bg border border-admin-border rounded-xl p-1 gap-1">
              <button
                onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.1).toFixed(1))))}
                className="p-1 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors"
                title="Zoom Out"
              >
                <FiZoomOut size={14} />
              </button>
              <span className="text-[11px] font-mono px-1 text-admin-text font-bold">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(1))))}
                className="p-1 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors"
                title="Zoom In"
              >
                <FiZoomIn size={14} />
              </button>
            </div>

            {/* Print */}
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-xl bg-admin-bg hover:bg-admin-elevated border border-admin-border text-admin-text text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Print Experience Letter"
            >
              <FiPrinter size={14} />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Direct A4 PDF Download */}
            <button
              onClick={handleDownloadDirect}
              disabled={isExporting}
              className="px-3.5 py-1.5 rounded-xl bg-admin-accent hover:opacity-95 text-white text-xs font-bold transition-all shadow-md shadow-admin-accent/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="Download Pixel-Perfect PDF"
            >
              {isExporting ? (
                <>
                  <FiLoader size={14} className="animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <FiDownload size={14} />
                  <span>Download PDF</span>
                </>
              )}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-admin-muted hover:text-admin-text hover:bg-admin-elevated transition-colors ml-1"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable Preview Canvas */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-900/60 dark:bg-black/60 flex justify-center dark-scroll">
          <div
            ref={containerRef}
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease'
            }}
            className="w-full flex justify-center"
          >
            <ExperienceLetterDocument
              data={letterData}
              settings={settings}
              includeSignature={includeSignature}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExperienceLetterPreviewModal;
