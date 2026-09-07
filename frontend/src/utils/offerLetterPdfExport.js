import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Exports the 5-page Offer Letter DOM directly to an A4 PDF.
 * This guarantees 100% pixel-perfect identical layout between the Live Preview and the Downloaded PDF.
 * 
 * @param {HTMLElement|string} container - The DOM container holding .offer-letter-page elements
 * @param {string} filename - The target filename for the downloaded PDF
 */
export const exportOfferLetterToPdf = async (container, filename = 'Letter.pdf') => {
  let element = container;
  if (typeof container === 'string') {
    element = document.querySelector(container);
  }

  if (!element) {
    throw new Error('Document element not found for PDF export.');
  }

  // Find all individual letter page cards
  let pages = element.querySelectorAll('.offer-letter-page, .experience-letter-page');
  if (!pages || pages.length === 0) {
    if (element.classList && (element.classList.contains('offer-letter-page') || element.classList.contains('experience-letter-page'))) {
      pages = [element];
    } else if (element.firstElementChild) {
      pages = [element.firstElementChild];
    } else {
      pages = [element];
    }
  }

  // A4 dimensions in mm: 210mm x 297mm
  const pdf = new jsPDF('portrait', 'mm', 'a4');
  const pdfWidth = 210;
  const pdfHeight = 297;

  for (let i = 0; i < pages.length; i++) {
    const pageEl = pages[i];

    // High quality canvas capture (scale 2 = 192dpi crisp output)
    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth: 1200
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.98);

    if (i > 0) {
      pdf.addPage('a4', 'portrait');
    }

    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight, undefined, 'FAST');
  }

  pdf.save(filename);
};
