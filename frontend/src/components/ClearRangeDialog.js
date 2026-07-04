import React, { useState } from 'react';
import { FiX, FiAlertTriangle } from 'react-icons/fi';

const ClearRangeDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Clear Data",
  message = "Please select a date range to clear data.",
  isLoading = false
}) => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [confirmText, setConfirmText] = useState('');

  // Handle overlay click to close
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isLoading) {
      handleClose();
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setFromDate('');
    setToDate('');
    setConfirmText('');
    onClose();
  };

  const handleConfirm = () => {
    if (!fromDate || !toDate) return;
    if (confirmText !== 'DELETE') return;
    if (new Date(fromDate) > new Date(toDate)) return;
    
    onConfirm({ fromDate, toDate, confirmText });
  };

  const isFormValid = fromDate && toDate && confirmText === 'DELETE' && new Date(fromDate) <= new Date(toDate);

  return (
    <>
      {isOpen && (
        <div className="clear-range-overlay animate-fadeIn" onClick={handleOverlayClick}>
          <div className="clear-range-dialog animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="clear-range-header">
              <div className="clear-range-title-wrap" style={{ color: 'var(--danger-color, #dc2626)' }}>
                <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                  <FiAlertTriangle size={20} />
                </div>
                <h3 className="clear-range-title">{title}</h3>
              </div>
              <button className="clear-range-close" onClick={handleClose} disabled={isLoading}>
                <FiX size={20} />
              </button>
            </div>
            
            <div className="clear-range-body">
              <div className="clear-range-warning">
                {message}
              </div>

              <div className="clear-range-field">
                <label>From Date</label>
                <input
                  type="date"
                  className="clear-range-input"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  disabled={isLoading}
                />
              </div>

              <div className="clear-range-field">
                <label>To Date</label>
                <input
                  type="date"
                  className="clear-range-input"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  disabled={isLoading}
                  min={fromDate}
                />
              </div>

              {fromDate && toDate && new Date(fromDate) > new Date(toDate) && (
                <p style={{ color: '#dc2626', fontSize: '13px', marginTop: '-8px', marginBottom: '16px' }}>
                  From Date cannot be after To Date.
                </p>
              )}

              <div className="clear-range-field" style={{ marginTop: '20px' }}>
                <label>To confirm, type <strong>DELETE</strong> below</label>
                <input
                  type="text"
                  className="clear-range-input"
                  placeholder="DELETE"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  disabled={isLoading}
                  style={{
                    borderColor: confirmText && confirmText !== 'DELETE' ? '#dc2626' : '',
                    backgroundColor: confirmText === 'DELETE' ? 'rgba(34, 197, 94, 0.05)' : ''
                  }}
                />
              </div>
            </div>
            
            <div className="clear-range-footer">
              <button className="clear-range-cancel-btn" onClick={handleClose} disabled={isLoading}>
                Cancel
              </button>
              <button 
                className="clear-range-confirm-btn" 
                onClick={handleConfirm}
                disabled={!isFormValid || isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="admin-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}></div>
                    Clearing...
                  </>
                ) : (
                  'Clear Data'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ClearRangeDialog;

