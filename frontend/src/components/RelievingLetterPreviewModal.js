import React, { useState, useRef } from 'react';
import { FiX, FiDownload, FiPrinter, FiZoomIn, FiZoomOut, FiLoader } from 'react-icons/fi';
import RelievingLetterDocument from './RelievingLetterDocument';
import { exportOfferLetterToPdf } from '../utils/offerLetterPdfExport';

const RelievingLetterPreviewModal = ({
  isOpen,
  onClose,
  letterData,
  settings,
  onDownload,
  onPrint
}) => {
  const [zoom, setZoom] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const containerRef = useRef(null);

  if (!isOpen || !letterData) return null;

  const employeeName = letterData.employee_name || letterData.employee_name_snapshot || 'Candidate';
  const letterNumber = letterData.letter_number || 'REL';
  const safeName = employeeName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeNum = letterNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Relieving_Letter_${safeName}_${safeNum}.pdf`;

  const handleDownloadDirect = async () => {
    try {
      setIsExporting(true);
      const targetContainer = containerRef.current;
      if (targetContainer) {
        await exportOfferLetterToPdf(targetContainer, filename);
      } else if (onDownload) {
        await onDownload();
      }
    } catch (err) {
      console.error('Direct PDF export failed, fallback to backend:', err);
      if (onDownload) {
        await onDownload();
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
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
            <span className="font-mono text-xs font-bold text-purple-400 px-2 py-0.5 rounded-lg bg-purple-500/15 border border-purple-500/30">
              {letterNumber}
            </span>
            <span className="text-xs font-bold text-admin-text">
              {employeeName}
            </span>
            <span className="text-[11px] text-admin-muted hidden sm:inline">
              • Relieving Letter
            </span>
          </div>

          <div className="flex items-center gap-2">
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
              title="Print Relieving Letter"
            >
              <FiPrinter size={14} />
              <span className="hidden sm:inline">Print</span>
            </button>

            {/* Direct A4 PDF Download */}
            <button
              onClick={handleDownloadDirect}
              disabled={isExporting}
              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-all shadow-md shadow-purple-600/20 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
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
            <RelievingLetterDocument data={letterData} settings={settings} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RelievingLetterPreviewModal;
