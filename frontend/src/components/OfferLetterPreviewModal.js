import React, { useState, useRef } from 'react';
import { FiX, FiDownload, FiPrinter, FiZoomIn, FiZoomOut, FiLoader } from 'react-icons/fi';
import OfferLetterDocument from './OfferLetterDocument';
import { exportOfferLetterToPdf } from '../utils/offerLetterPdfExport';

const OfferLetterPreviewModal = ({
  isOpen,
  onClose,
  offerData,
  settings,
  onDownload,
  onPrint
}) => {
  const [activePage, setActivePage] = useState(null); // null = All Pages, 1-5 = single page
  const [zoom, setZoom] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const allPagesContainerRef = useRef(null);

  if (!isOpen || !offerData) return null;

  const candidateName = offerData.employee_name || offerData.employee_name_snapshot || 'Candidate';
  const offerNumber = offerData.offer_number || 'OFF';
  const safeName = candidateName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeOfferNum = offerNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Offer_Letter_${safeName}_${safeOfferNum}.pdf`;

  const handleDownloadDirect = async () => {
    try {
      setIsExporting(true);
      // Export from the hidden full 5-page container to ensure all 5 pages are exported even if user selected P1/P2/etc.
      const targetContainer = allPagesContainerRef.current;
      if (targetContainer) {
        await exportOfferLetterToPdf(targetContainer, filename);
      } else if (onDownload) {
        await onDownload();
      }
    } catch (err) {
      console.error('Direct PDF export failed, falling back to server download:', err);
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
        <div className="flex flex-wrap items-center justify-between px-6 py-3 border-b border-admin-border bg-admin-surface flex-shrink-0 gap-3">
          <div className="flex items-center gap-3">
            <span className="w-8 h-8 rounded-xl bg-admin-accent/20 text-admin-accent flex items-center justify-center font-bold text-sm">
              📄
            </span>
            <div>
              <h3 className="text-sm font-bold text-admin-text">
                Offer Letter Preview — {candidateName}
              </h3>
              <p className="text-xs text-admin-muted">
                {offerNumber} • {offerData.job_title || offerData.job_title_snapshot || 'Role'}
              </p>
            </div>
          </div>

          {/* Page Filter & Zoom Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-admin-elevated border border-admin-border rounded-xl p-1 text-xs">
              <button
                onClick={() => setActivePage(null)}
                className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                  activePage === null ? 'bg-admin-accent text-white' : 'text-admin-secondary hover:text-admin-text'
                }`}
              >
                All Pages
              </button>
              {[1, 2, 3, 4, 5].map((pg) => (
                <button
                  key={pg}
                  onClick={() => setActivePage(pg)}
                  className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                    activePage === pg ? 'bg-admin-accent text-white' : 'text-admin-secondary hover:text-admin-text'
                  }`}
                >
                  P{pg}
                </button>
              ))}
            </div>

            <div className="hidden sm:flex items-center bg-admin-elevated border border-admin-border rounded-xl p-1 text-xs">
              <button
                onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
                className="p-1 rounded-lg text-admin-secondary hover:text-admin-text"
                title="Zoom Out"
              >
                <FiZoomOut size={14} />
              </button>
              <span className="px-2 font-mono text-[11px] text-admin-muted">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))}
                className="p-1 rounded-lg text-admin-secondary hover:text-admin-text"
                title="Zoom In"
              >
                <FiZoomIn size={14} />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadDirect}
              disabled={isExporting}
              className="px-3.5 py-1.5 rounded-xl bg-admin-elevated hover:bg-admin-border border border-admin-border text-admin-text text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Download exact preview as A4 PDF"
            >
              {isExporting ? <FiLoader className="animate-spin" size={14} /> : <FiDownload size={14} />}
              <span className="hidden sm:inline">{isExporting ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-xl bg-admin-accent text-white text-xs font-semibold flex items-center gap-1.5 hover:opacity-95 shadow-md shadow-admin-accent/20 transition-opacity"
            >
              <FiPrinter size={14} />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-admin-muted hover:text-admin-text hover:bg-admin-elevated transition-colors ml-1"
            >
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Document Scroll Viewport */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-900/60 dark:bg-black/60 flex justify-center dark-scroll">
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top center',
              transition: 'transform 0.15s ease-out'
            }}
            className="w-full max-w-[760px]"
          >
            <OfferLetterDocument
              data={offerData}
              settings={settings}
              pageNumber={activePage}
            />
          </div>
        </div>

        {/* Hidden full 5-page container for 100% exact PDF generation */}
        <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '760px', zIndex: -100 }}>
          <div ref={allPagesContainerRef}>
            <OfferLetterDocument
              data={offerData}
              settings={settings}
              pageNumber={null}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default OfferLetterPreviewModal;
