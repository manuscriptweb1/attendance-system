import React, { useState, useEffect } from 'react';
import {
  FiShield, FiRefreshCw, FiFileText, FiClock,
  FiDollarSign, FiCalendar, FiDownload, FiLock,
  FiCpu, FiLayers, FiTrendingUp, FiImage, FiUploadCloud,
  FiRotateCcw, FiCheckCircle, FiSliders, FiEye, FiSettings, FiCheck
} from 'react-icons/fi';
import { Spinner } from '../components/Loader';
import {
  verifyDeveloperPin,
  checkDeveloperSession,
  runDeveloperSimulation,
  exportDeveloperSimulationReport,
  getBrandingSettings,
  updateBrandingSettings,
  resetBrandingLogo,
  downloadSampleBrandingPdf
} from '../services/api';

export default function DeveloperTestingSandbox() {
  // Authentication & Session
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [devToken, setDevToken] = useState(sessionStorage.getItem('devToken') || '');

  // Main Section Toggle: 'simulation' | 'branding'
  const [mainSection, setMainSection] = useState('simulation');

  // PDF Template & Branding Settings State
  const [brandingData, setBrandingData] = useState({
    company_name: 'Manuscript Technomedia LLP',
    company_name_font_size: 17,
    logo_width: 32,
    logo_height: 32,
    registered_office_address: 'Manuscript Technomedia LLP, Reg. Office. No. 22, 3rd Cross, Vivekananda Nagar, Bangalore-33, Karnataka, India.',
    logo_path: null
  });
  const [logoFileBase64, setLogoFileBase64] = useState(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState(`${window.location.origin}/favicon/web-app-manifest-192x192.png`);
  const [loadingBranding, setLoadingBranding] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [resettingLogo, setResettingLogo] = useState(false);
  const [brandingStatusMsg, setBrandingStatusMsg] = useState({ text: '', type: '' });
  const [previewDocType, setPreviewDocType] = useState('payslip');
  const [downloadingSampleType, setDownloadingSampleType] = useState(null);

  // Simulation Controls
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [monthsHorizon, setMonthsHorizon] = useState(6);
  const [activeTab, setActiveTab] = useState('payroll');

  // Attendance Overrides (Simulated only)
  const [overrides, setOverrides] = useState({
    presentDays: '',
    halfDays: '',
    lopDays: '',
    lateDays: '',
    overtimeHours: '',
    staffAdvance: '',
    professional_tax: '',
    tds: ''
  });

  // Selected Loan for Loan & Timeline Views
  const [selectedLoanId, setSelectedLoanId] = useState('');

  // Simulation Results Data
  const [simData, setSimData] = useState(null);
  const [loadingSim, setLoadingSim] = useState(false);
  const [simError, setSimError] = useState('');

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Verify session on mount
  useEffect(() => {
    if (devToken) {
      checkDeveloperSession(devToken)
        .then(res => {
          if (res.data.success && res.data.valid) {
            setIsAuthenticated(true);
          } else {
            handleSessionExpired();
          }
        })
        .catch(() => {
          handleSessionExpired();
        });
    }
  }, [devToken]);

  // Run simulation when authenticated and parameters change
  useEffect(() => {
    if (isAuthenticated) {
      fetchSimulationData();
    }
  }, [isAuthenticated, month, year, employeeFilter, monthsHorizon, selectedLoanId]);

  // Auto-select first loan when simData loads
  useEffect(() => {
    if (simData && simData.availableLoans && simData.availableLoans.length > 0 && !selectedLoanId) {
      setSelectedLoanId(String(simData.availableLoans[0].id));
    }
  }, [simData]);

  const fetchBranding = async () => {
    try {
      setLoadingBranding(true);
      const res = await getBrandingSettings();
      if (res.data?.success && res.data?.branding) {
        const b = res.data.branding;
        setBrandingData({
          company_name: b.company_name || 'Manuscript Technomedia LLP',
          company_name_font_size: Number(b.company_name_font_size) || 17,
          logo_width: Number(b.logo_width) || 32,
          logo_height: Number(b.logo_height) || 32,
          registered_office_address: b.registered_office_address || 'Manuscript Technomedia LLP, Reg. Office. No. 22, 3rd Cross, Vivekananda Nagar, Bangalore-33, Karnataka, India.',
          logo_path: b.logo_path || null
        });

        if (b.logo_data_url) {
          setLogoPreviewUrl(b.logo_data_url);
        } else if (b.logo_path) {
          const backendBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
          setLogoPreviewUrl(b.logo_path.startsWith('http') ? b.logo_path : `${backendBase}${b.logo_path}`);
        } else {
          setLogoPreviewUrl(`${window.location.origin}/favicon/web-app-manifest-192x192.png`);
        }
      }
    } catch (e) {
      console.error('Failed to load branding settings:', e);
    } finally {
      setLoadingBranding(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchBranding();
    }
  }, [isAuthenticated]);

  const handleLogoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setBrandingStatusMsg({ text: 'Please select a valid image file (PNG, JPG, SVG, WebP).', type: 'error' });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setBrandingStatusMsg({ text: 'Image file size must be less than 5MB.', type: 'error' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setLogoFileBase64(dataUrl);
      setLogoPreviewUrl(dataUrl);
      setBrandingStatusMsg({ text: 'Logo image selected. Click "Save PDF Branding Settings" to apply.', type: 'info' });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async (e) => {
    e?.preventDefault();
    try {
      setSavingBranding(true);
      setBrandingStatusMsg({ text: '', type: '' });
      const payload = {
        company_name: brandingData.company_name,
        company_name_font_size: brandingData.company_name_font_size,
        logo_width: brandingData.logo_width,
        logo_height: brandingData.logo_height,
        registered_office_address: brandingData.registered_office_address,
        logo_base64: logoFileBase64 || undefined
      };
      const res = await updateBrandingSettings(payload, devToken);
      if (res.data?.success) {
        setBrandingStatusMsg({ text: 'Company branding & PDF template settings saved successfully!', type: 'success' });
        setLogoFileBase64(null);
        if (res.data?.branding) {
          const b = res.data.branding;
          setBrandingData({
            company_name: b.company_name || 'Manuscript Technomedia LLP',
            company_name_font_size: Number(b.company_name_font_size) || 17,
            logo_width: Number(b.logo_width) || 32,
            logo_height: Number(b.logo_height) || 32,
            registered_office_address: b.registered_office_address || 'Manuscript Technomedia LLP, Reg. Office. No. 22, 3rd Cross, Vivekananda Nagar, Bangalore-33, Karnataka, India.',
            logo_path: b.logo_path || null
          });
          if (b.logo_data_url) {
            setLogoPreviewUrl(b.logo_data_url);
          } else if (b.logo_path) {
            const backendBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
            setLogoPreviewUrl(b.logo_path.startsWith('http') ? b.logo_path : `${backendBase}${b.logo_path}`);
          }
        }
        await fetchBranding();
      } else {
        setBrandingStatusMsg({ text: res.data?.message || 'Failed to save settings.', type: 'error' });
      }
    } catch (err) {
      setBrandingStatusMsg({ text: err.response?.data?.message || 'Error updating branding settings', type: 'error' });
    } finally {
      setSavingBranding(false);
    }
  };

  const handleResetLogo = async () => {
    try {
      setResettingLogo(true);
      setBrandingStatusMsg({ text: '', type: '' });
      const res = await resetBrandingLogo(devToken);
      if (res.data?.success) {
        setLogoFileBase64(null);
        setLogoPreviewUrl(`${window.location.origin}/favicon/web-app-manifest-192x192.png`);
        setBrandingStatusMsg({ text: 'Logo has been reset to system default.', type: 'success' });
        await fetchBranding();
      }
    } catch (err) {
      setBrandingStatusMsg({ text: 'Error resetting logo.', type: 'error' });
    } finally {
      setResettingLogo(false);
    }
  };

  const handleDownloadSamplePdf = async (type) => {
    try {
      setDownloadingSampleType(type);
      const res = await downloadSampleBrandingPdf(type, devToken);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sample_${type === 'employee_details' ? 'employee_details' : 'payslip'}_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to generate and download sample PDF.');
    } finally {
      setDownloadingSampleType(null);
    }
  };

  const handleSessionExpired = () => {
    setIsAuthenticated(false);
    setDevToken('');
    sessionStorage.removeItem('devToken');
  };

  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setPinError('');
    setVerifyingPin(true);

    try {
      const res = await verifyDeveloperPin(pin);
      if (res.data.success && res.data.token) {
        setIsAuthenticated(true);
        setDevToken(res.data.token);
        sessionStorage.setItem('devToken', res.data.token);
        setPin('');
      } else {
        setPinError('Invalid PIN');
      }
    } catch (err) {
      setPinError('Invalid PIN');
    } finally {
      setVerifyingPin(false);
    }
  };

  const fetchSimulationData = async () => {
    if (!devToken) return;
    setLoadingSim(true);
    setSimError('');

    try {
      const payload = {
        month: parseInt(month),
        year: parseInt(year),
        employeeIdFilter: employeeFilter,
        monthsHorizon: parseInt(monthsHorizon),
        selectedLoanId: selectedLoanId ? parseInt(selectedLoanId) : null,
        attendanceOverrides: employeeFilter !== 'all' && employeeFilter ? {
          [employeeFilter]: {
            presentDays: overrides.presentDays !== '' ? parseFloat(overrides.presentDays) : undefined,
            halfDays: overrides.halfDays !== '' ? parseFloat(overrides.halfDays) : undefined,
            lopDays: overrides.lopDays !== '' ? parseFloat(overrides.lopDays) : undefined,
            lateDays: overrides.lateDays !== '' ? parseFloat(overrides.lateDays) : undefined,
            overtimeHours: overrides.overtimeHours !== '' ? parseFloat(overrides.overtimeHours) : undefined,
            staffAdvance: overrides.staffAdvance !== '' ? parseFloat(overrides.staffAdvance) : undefined,
            professional_tax: overrides.professional_tax !== '' ? parseFloat(overrides.professional_tax) : undefined,
            tds: overrides.tds !== '' ? parseFloat(overrides.tds) : undefined
          }
        } : {}
      };

      const res = await runDeveloperSimulation(payload, devToken);
      if (res.data.success) {
        setSimData(res.data);
      } else {
        setSimError(res.data.message || 'Simulation failed');
      }
    } catch (err) {
      if (err.response?.status === 401) {
        handleSessionExpired();
      } else {
        setSimError(err.response?.data?.message || 'Server error running simulation');
      }
    } finally {
      setLoadingSim(false);
    }
  };

  const handleExportJSON = async () => {
    if (!simData || !devToken) return;
    try {
      const res = await exportDeveloperSimulationReport({ simulationData: simData, format: 'json' }, devToken);
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(res.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Developer_Simulation_${month}_${year}_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err) {
      alert('Failed to export simulation report');
    }
  };

  const handleSimulateNextMonth = () => {
    let nextM = month + 1;
    let nextY = year;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    setMonth(nextM);
    setYear(nextY);
  };

  // PIN Authentication Screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/30 text-purple-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <FiShield size={32} />
            </div>
            <h1 className="text-xl font-bold text-white tracking-wide">Developer Testing</h1>
            <p className="text-xs text-slate-400">Enter PIN</p>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-5">
            <div>
              <input
                type="password"
                placeholder="PIN"
                value={pin}
                onChange={(e) => { setPin(e.target.value); setPinError(''); }}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-center text-lg font-mono text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 transition-all"
                required
                autoFocus
              />
            </div>

            {pinError && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold rounded-xl text-center">
                {pinError}
              </div>
            )}

            <button
              type="submit"
              disabled={verifyingPin}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {verifyingPin ? <Spinner size={16} color="white" /> : <FiLock size={16} />} Verify
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      {/* Sticky Developer Banner */}
      <div className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-purple-500/30 px-6 py-3 shadow-lg">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 bg-purple-500/20 border border-purple-500/40 text-purple-300 font-extrabold uppercase rounded-lg tracking-wider flex items-center gap-1.5">
              <FiCpu /> Developer Testing Sandbox
            </span>
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold rounded-md">
              Simulation Mode
            </span>
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 font-bold rounded-md">
              Read Only
            </span>
            <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold rounded-md">
              No Database Changes
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleExportJSON}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-lg border border-slate-700 transition-all flex items-center gap-1.5"
            >
              <FiDownload size={13} /> Export JSON Report
            </button>
            <button
              onClick={handleSessionExpired}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded-lg border border-red-500/30 transition-all"
            >
              Exit Sandbox
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 pt-6 space-y-6">
        {/* Main Section Navigation Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/80 p-2 rounded-2xl border border-slate-800 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMainSection('simulation')}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                mainSection === 'simulation'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FiCpu size={15} /> Payroll & System Simulation
            </button>
            <button
              onClick={() => setMainSection('branding')}
              className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                mainSection === 'branding'
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 font-extrabold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <FiImage size={15} /> PDF Template & Office Branding
            </button>
          </div>
          <div className="text-[11px] text-slate-400 font-medium px-2">
            {mainSection === 'simulation' 
              ? 'Multi-scenario payroll calculation & simulation engine' 
              : 'Configure Office Name, Logo & PDF Header/Footer across all templates'}
          </div>
        </div>

        {/* --- SIMULATION MODE --- */}
        {mainSection === 'simulation' && (
          <>
            {/* Simulation Control Panel */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <FiLayers /> Simulation Parameters
                </h2>
                <button
                  onClick={fetchSimulationData}
                  disabled={loadingSim}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-md shadow-purple-600/20 disabled:opacity-50"
                >
                  {loadingSim ? <Spinner size={14} color="white" /> : <FiRefreshCw size={14} />} Re-Run Simulation
                </button>
              </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            {/* Month Selector */}
            <div>
              <label className="block font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">Payroll Month</label>
              <select
                value={month}
                onChange={(e) => setMonth(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-none focus:border-purple-500"
              >
                {monthNames.map((m, idx) => (
                  <option key={idx + 1} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>

            {/* Year Selector */}
            <div>
              <label className="block font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">Payroll Year</label>
              <select
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-none focus:border-purple-500"
              >
                {[2024, 2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* Employee Filter */}
            <div>
              <label className="block font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">Employee Scope</label>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-none focus:border-purple-500"
              >
                <option value="all">All Active Employees</option>
                {simData && simData.availableEmployees && simData.availableEmployees.map(emp => (
                  <option key={emp.id} value={emp.employeeCode}>{emp.name} ({emp.employeeCode})</option>
                ))}
              </select>
            </div>

            {/* Multi-Month Horizon */}
            <div>
              <label className="block font-bold text-slate-400 uppercase text-[10px] tracking-wider mb-1">Simulation Horizon</label>
              <select
                value={monthsHorizon}
                onChange={(e) => setMonthsHorizon(parseInt(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-none focus:border-purple-500"
              >
                <option value={1}>1 Month Ahead</option>
                <option value={3}>3 Months Ahead</option>
                <option value={6}>6 Months Ahead</option>
                <option value={12}>12 Months Ahead</option>
              </select>
            </div>
          </div>
        </div>

        {/* Summary Metric Cards */}
        {simData && simData.summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Simulated Gross</div>
              <div className="text-lg font-extrabold text-white mt-1 font-mono">
                ₹{simData.summary.totalSimulatedGross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Total Deductions</div>
              <div className="text-lg font-extrabold text-amber-400 mt-1 font-mono">
                ₹{simData.summary.totalSimulatedDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Simulated Net Payable</div>
              <div className="text-lg font-extrabold text-emerald-400 mt-1 font-mono">
                ₹{simData.summary.totalSimulatedNetPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl">
              <div className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">Simulated Loan Deductions</div>
              <div className="text-lg font-extrabold text-purple-400 mt-1 font-mono">
                ₹{simData.summary.totalSimulatedLoanDeductions.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}

        {/* Section Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
          {[
            { key: 'payroll', label: '1. Payroll Simulation', icon: FiDollarSign },
            { key: 'attendance', label: '2. Attendance Simulation', icon: FiCalendar },
            { key: 'loan', label: '3. Employee Loan Simulation', icon: FiTrendingUp },
            { key: 'timeline', label: '4. Loan Timeline', icon: FiClock },
            { key: 'scheduler', label: '5. Scheduler Simulation', icon: FiCpu },
            { key: 'payslip', label: '6. Payslip Comparison', icon: FiFileText },
            { key: 'comparison', label: '7. REAL vs SIMULATION', icon: FiLayers }
          ].map(t => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${
                  active ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab 1: Payroll Simulation */}
        {activeTab === 'payroll' && simData && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Payroll Calculation Simulation</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2 px-3">Employee</th>
                    <th className="py-2 px-3 text-right">Gross Salary (₹)</th>
                    <th className="py-2 px-3 text-right">LOP Amount (₹)</th>
                    <th className="py-2 px-3 text-right">Staff Advance (₹)</th>
                    <th className="py-2 px-3 text-right">PT (₹)</th>
                    <th className="py-2 px-3 text-right">Loan Deduction (₹)</th>
                    <th className="py-2 px-3 text-right">Simulated Net Payable (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {simData.payroll.map((r, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40 font-mono">
                      <td className="py-2.5 px-3 font-sans font-semibold text-white">
                        {r.employeeName} <span className="text-slate-500 font-mono text-[11px]">({r.employeeCode})</span>
                      </td>
                      <td className="py-2.5 px-3 text-right">₹{r.simulated.grossSalary.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-amber-400">₹{r.simulated.lopAmount.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">₹{r.simulated.staffAdvance.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-slate-300">₹{r.simulated.professionalTax.toFixed(2)}</td>
                      <td className="py-2.5 px-3 text-right text-red-400 font-semibold">
                        ₹{r.simulated.loanDeduction.toFixed(2)}
                        <span className="block font-sans text-[9px] text-slate-400">{r.simulated.loanDeductionStatus}</span>
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-400 font-extrabold">₹{r.simulated.netPayable.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Attendance Simulation Overrides */}
        {activeTab === 'attendance' && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Attendance Parameter Simulation Overrides</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                In-Memory Override Only
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Select a single employee above to apply custom attendance parameters for simulation testing without altering actual attendance logs.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-400 mb-1">Present Days</label>
                <input
                  type="number"
                  placeholder="e.g. 28"
                  value={overrides.presentDays}
                  onChange={(e) => setOverrides({ ...overrides, presentDays: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Half Days</label>
                <input
                  type="number"
                  placeholder="e.g. 2"
                  value={overrides.halfDays}
                  onChange={(e) => setOverrides({ ...overrides, halfDays: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">LOP Days</label>
                <input
                  type="number"
                  placeholder="e.g. 1"
                  value={overrides.lopDays}
                  onChange={(e) => setOverrides({ ...overrides, lopDays: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-400 mb-1">Overtime Hours</label>
                <input
                  type="number"
                  placeholder="e.g. 5"
                  value={overrides.overtimeHours}
                  onChange={(e) => setOverrides({ ...overrides, overtimeHours: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={fetchSimulationData}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition-all"
              >
                Apply Overrides to Simulation
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Employee Loan Simulation */}
        {activeTab === 'loan' && simData && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">3. Employee Loan Simulation & Month Stepper</h3>

              {simData.availableLoans && simData.availableLoans.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Select Loan:</span>
                  <select
                    value={selectedLoanId || (simData.availableLoans[0] ? String(simData.availableLoans[0].id) : '')}
                    onChange={(e) => setSelectedLoanId(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    {simData.availableLoans.map(l => (
                      <option key={l.id} value={l.id}>{l.loanCode} - {l.employeeName} (₹{l.totalAmount})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {simData.loanTimeline && simData.loanTimeline.success ? (
              <div className="space-y-5">
                {/* Loan Overview Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl text-xs">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Loan Code</span>
                    <span className="font-mono font-bold text-purple-400">{simData.loanTimeline.loanCode}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Employee</span>
                    <span className="font-semibold text-white">{simData.loanTimeline.employeeName}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Total Loan Amount</span>
                    <span className="font-mono font-bold text-white">₹{simData.loanTimeline.totalLoanAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase">Monthly Scheduled EMI</span>
                    <span className="font-mono font-bold text-emerald-400">₹{simData.loanTimeline.monthlyDeduction.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                {/* Selected Payroll Month Simulated Action Card */}
                <div className="bg-slate-950 border border-purple-500/30 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-300">
                      Simulated Payroll Month: <span className="text-purple-400 font-mono">{monthNames[month - 1]} {year}</span>
                    </span>
                    <button
                      onClick={handleSimulateNextMonth}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs transition-all shadow-md shadow-purple-600/20 flex items-center gap-1.5"
                    >
                      Simulate Next Month ➔
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-400">
                    During {monthNames[month - 1]} {year}, payroll includes the scheduled EMI deduction of ₹{simData.loanTimeline.monthlyDeduction}. Loan balance remains un-reduced until month-end scheduler runs.
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">No active loan selected.</div>
            )}
          </div>
        )}

        {/* Tab 4: Loan Timeline */}
        {activeTab === 'timeline' && simData && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">4. Canonical Loan Repayment Schedule Breakdown</h3>

              {simData.availableLoans && simData.availableLoans.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Select Loan:</span>
                  <select
                    value={selectedLoanId || (simData.availableLoans[0] ? String(simData.availableLoans[0].id) : '')}
                    onChange={(e) => setSelectedLoanId(e.target.value)}
                    className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                  >
                    {simData.availableLoans.map(l => (
                      <option key={l.id} value={l.id}>{l.loanCode} - {l.employeeName} (₹{l.totalAmount})</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {simData.loanTimeline && simData.loanTimeline.success ? (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="py-2 px-3">Instalment #</th>
                        <th className="py-2 px-3">Payroll Period</th>
                        <th className="py-2 px-3 text-right">Loan Deduction (₹)</th>
                        <th className="py-2 px-3 text-right">Total Repaid (₹)</th>
                        <th className="py-2 px-3 text-right">Remaining Balance (₹)</th>
                        <th className="py-2 px-3 text-center">Instalments</th>
                        <th className="py-2 px-3">Simulated Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {simData.loanTimeline.timeline.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 text-slate-500">#{row.step}</td>
                          <td className="py-2 px-3 text-slate-200 font-sans font-semibold">{row.periodLabel}</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-400">₹{row.loanDeduction.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-purple-400">₹{row.totalRepaid.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-amber-400 font-bold">₹{row.remainingBalance.toFixed(2)}</td>
                          <td className="py-2 px-3 text-center text-slate-300">{row.completedInstalments} / {row.totalInstalments}</td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-sans ${
                              row.status === 'Completed' ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500 text-xs">No active loan selected.</div>
            )}
          </div>
        )}

        {/* Tab 5: Scheduler Simulation */}
        {activeTab === 'scheduler' && simData && simData.scheduler && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Month-End Scheduler Simulation Execution Trace</h3>

            <div className="bg-slate-950 border border-slate-800/80 p-4 rounded-xl font-mono text-[11px] text-slate-300 space-y-1 max-h-96 overflow-y-auto">
              {simData.scheduler.logs.map((log, idx) => (
                <div key={idx} className={
                  log.includes('COMPLETE') ? 'text-emerald-400 font-bold' :
                  log.includes('SIMULATED TRANSACTION') ? 'text-purple-300 font-semibold' :
                  log.includes('SKIP') ? 'text-slate-500' : 'text-slate-300'
                }>
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 6: Payslip Simulation */}
        {activeTab === 'payslip' && simData && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">Simulated Payslip View</h3>

            {simData.payroll.slice(0, 2).map((item, idx) => (
              <div key={idx} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <span className="font-bold text-white text-xs">{item.employeeName} ({item.employeeCode})</span>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-bold uppercase">
                    Simulated Payslip {month}/{year}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div>
                    <span className="text-[10px] font-bold text-emerald-400 uppercase block font-sans mb-1">Earnings</span>
                    <div>Basic: ₹{item.simulated.basicSalary}</div>
                    <div>HRA: ₹{item.simulated.hra}</div>
                    <div>Special Allowance: ₹{item.simulated.specialAllowance}</div>
                    <div className="font-bold text-white mt-1 pt-1 border-t border-slate-800">Gross: ₹{item.simulated.grossSalary}</div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-amber-400 uppercase block font-sans mb-1">Deductions</span>
                    <div>LOP: ₹{item.simulated.lopAmount}</div>
                    <div>Advance: ₹{item.simulated.staffAdvance}</div>
                    <div>PT: ₹{item.simulated.professionalTax}</div>
                    <div className="text-red-400 font-semibold">Loan Deduction: ₹{item.simulated.loanDeduction}</div>
                    <div className="font-bold text-amber-400 mt-1 pt-1 border-t border-slate-800">Total Deductions: ₹{item.simulated.totalDeductions}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs font-bold">
                  <span className="text-slate-400">Net Payable:</span>
                  <span className="text-emerald-400 font-mono text-sm">₹{item.simulated.netPayable}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 7: REAL vs SIMULATION Comparison View */}
        {activeTab === 'comparison' && simData && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider">REAL Database vs SIMULATED Comparison</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2 px-3">Employee</th>
                    <th className="py-2 px-3 text-right">REAL Net Payable (₹)</th>
                    <th className="py-2 px-3 text-right">SIMULATED Net Payable (₹)</th>
                    <th className="py-2 px-3 text-right">Difference (₹)</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {simData.payroll.map((r, idx) => {
                    const realNet = r.real ? r.real.netPayable : 0;
                    const simNet = r.simulated.netPayable;
                    const diff = parseFloat((simNet - realNet).toFixed(2));
                    const isNoDiff = Math.abs(diff) < 0.01;

                    return (
                      <tr key={idx} className="hover:bg-slate-800/40 font-mono">
                        <td className="py-2.5 px-3 font-sans font-semibold text-white">
                          {r.employeeName} ({r.employeeCode})
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-300">
                          {r.real ? `₹${realNet.toFixed(2)}` : 'Not Calculated'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-400 font-bold">₹{simNet.toFixed(2)}</td>
                        <td className={`py-2.5 px-3 text-right font-bold ${isNoDiff ? 'text-slate-500' : (diff > 0 ? 'text-emerald-400' : 'text-amber-400')}`}>
                          {isNoDiff ? '₹0.00' : (diff >= 0 ? `+₹${diff.toFixed(2)}` : `-₹${Math.abs(diff).toFixed(2)}`)}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isNoDiff ? 'bg-slate-800 text-slate-400' : 'bg-purple-500/20 text-purple-300'
                          }`}>
                            {isNoDiff ? 'No Difference' : 'Simulation Difference'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </>
    )}

        {/* --- PDF TEMPLATE & OFFICE BRANDING MODE --- */}
        {mainSection === 'branding' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Form Controls (5 cols) */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                  <FiSliders size={16} /> PDF Template Branding
                </h2>
                <button
                  type="button"
                  onClick={fetchBranding}
                  disabled={loadingBranding}
                  className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 transition-colors"
                  title="Reload settings"
                >
                  <FiRefreshCw size={13} className={loadingBranding ? 'animate-spin' : ''} /> Reload
                </button>
              </div>

              {brandingStatusMsg.text && (
                <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                  brandingStatusMsg.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : brandingStatusMsg.type === 'error'
                    ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                    : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                }`}>
                  {brandingStatusMsg.type === 'success' ? <FiCheckCircle size={15} /> : <FiSliders size={15} />}
                  <span>{brandingStatusMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSaveBranding} className="space-y-4 text-xs">
                {/* Company Name */}
                <div>
                  <label className="block font-bold text-slate-300 uppercase text-[10px] tracking-wider mb-1.5">
                    Company / Office Name
                  </label>
                  <input
                    type="text"
                    value={brandingData.company_name}
                    onChange={(e) => setBrandingData(prev => ({ ...prev, company_name: e.target.value }))}
                    placeholder="e.g. Manuscript Technomedia LLP"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold focus:outline-none focus:border-purple-500 transition-colors"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Rendered at top header of Payslips and Employee Details forms.</p>
                </div>

                {/* Company Title Font Size */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block font-bold text-slate-300 uppercase text-[10px] tracking-wider">
                      Company Title Font Size (pt)
                    </label>
                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded font-mono font-bold text-[11px]">
                      {brandingData.company_name_font_size} pt
                    </span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="26"
                    step="1"
                    value={brandingData.company_name_font_size}
                    onChange={(e) => setBrandingData(prev => ({ ...prev, company_name_font_size: Number(e.target.value) }))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>12 pt (Small)</span>
                    <span>17 pt (Default)</span>
                    <span>26 pt (Large)</span>
                  </div>
                </div>

                {/* Logo Upload & Preview */}
                <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-300 uppercase text-[10px] tracking-wider">
                      Office Logo Image
                    </label>
                    {brandingData.logo_path && (
                      <button
                        type="button"
                        onClick={handleResetLogo}
                        disabled={resettingLogo}
                        className="text-[11px] text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 transition-colors"
                      >
                        <FiRotateCcw size={12} /> Reset to Default
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-xl border border-slate-700 bg-white p-2 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                      <img
                        src={logoPreviewUrl}
                        alt="Logo Preview"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <label className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl cursor-pointer transition-colors text-xs border border-slate-700">
                        <FiUploadCloud size={15} /> Choose New Logo Image
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                          onChange={handleLogoFileChange}
                          className="hidden"
                        />
                      </label>
                      <p className="text-[10px] text-slate-500">Supports PNG, JPG, SVG, WebP (Max 5MB)</p>
                    </div>
                  </div>
                </div>

                {/* Logo Dimensions (Width & Height) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block font-bold text-slate-300 uppercase text-[10px] tracking-wider">
                        Logo Width (px)
                      </label>
                      <span className="px-2 py-0.5 bg-slate-800 text-purple-300 rounded font-mono font-bold text-[11px]">
                        {brandingData.logo_width}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="16"
                      max="100"
                      step="2"
                      value={brandingData.logo_width}
                      onChange={(e) => setBrandingData(prev => ({ ...prev, logo_width: Number(e.target.value) }))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1.5">
                      <label className="block font-bold text-slate-300 uppercase text-[10px] tracking-wider">
                        Logo Height (px)
                      </label>
                      <span className="px-2 py-0.5 bg-slate-800 text-purple-300 rounded font-mono font-bold text-[11px]">
                        {brandingData.logo_height}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min="16"
                      max="100"
                      step="2"
                      value={brandingData.logo_height}
                      onChange={(e) => setBrandingData(prev => ({ ...prev, logo_height: Number(e.target.value) }))}
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                    />
                  </div>
                </div>

                {/* Registered Office Address Text */}
                <div>
                  <label className="block font-bold text-slate-300 uppercase text-[10px] tracking-wider mb-1.5">
                    Registered Office Line (Footer)
                  </label>
                  <textarea
                    rows={2}
                    value={brandingData.registered_office_address}
                    onChange={(e) => setBrandingData(prev => ({ ...prev, registered_office_address: e.target.value }))}
                    placeholder="Manuscript Technomedia LLP, Reg. Office. No. 22, 3rd Cross, Vivekananda Nagar, Bangalore-33, Karnataka, India."
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white font-semibold text-xs focus:outline-none focus:border-purple-500 transition-colors"
                    required
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Printed centered at the bottom outside edge of each PDF page.</p>
                </div>

                {/* Save Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={savingBranding}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
                  >
                    {savingBranding ? <Spinner size={16} color="white" /> : <FiCheck size={16} />} Save PDF Branding Settings
                  </button>
                </div>
              </form>
            </div>

            {/* Right Column: Live Interactive A4 Preview Card (7 cols) */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold uppercase tracking-wider text-purple-400 flex items-center gap-2">
                    <FiEye size={16} /> Live Visual Preview
                  </h2>
                  <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-300 font-bold rounded text-[10px]">
                    Real-time
                  </span>
                </div>

                {/* Switch Document Preview */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setPreviewDocType('payslip')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      previewDocType === 'payslip'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Payslip Preview
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDocType('employee_details')}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                      previewDocType === 'employee_details'
                        ? 'bg-purple-600 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Employee Form Preview
                  </button>
                </div>
              </div>

              {/* Sample PDF Download Buttons */}
              <div className="flex flex-wrap items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                  <FiDownload size={13} /> Test Download:
                </span>
                <button
                  type="button"
                  onClick={() => handleDownloadSamplePdf('payslip')}
                  disabled={downloadingSampleType !== null}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {downloadingSampleType === 'payslip' ? <Spinner size={12} color="white" /> : <FiFileText size={13} />}
                  Sample Payslip PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadSamplePdf('employee_details')}
                  disabled={downloadingSampleType !== null}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {downloadingSampleType === 'employee_details' ? <Spinner size={12} color="white" /> : <FiFileText size={13} />}
                  Sample Employee Details PDF
                </button>
              </div>

              {/* Simulated Paper Container */}
              <div className="bg-slate-800/40 p-4 rounded-xl flex justify-center overflow-x-auto">
                <div className="w-full max-w-[620px] bg-white rounded-lg shadow-2xl p-6 sm:p-8 text-slate-900 border border-slate-300 scale-[0.98] transition-all">
                  {/* Inside Main Card Box */}
                  <div className="border border-slate-300 rounded-md p-5 bg-white space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-center gap-2.5">
                      <img
                        src={logoPreviewUrl}
                        alt="Logo"
                        style={{
                          width: `${brandingData.logo_width}px`,
                          height: `${brandingData.logo_height}px`,
                          objectFit: 'contain'
                        }}
                      />
                      <div
                        className="font-black text-slate-900 tracking-tight"
                        style={{ fontSize: `${brandingData.company_name_font_size}px` }}
                      >
                        {brandingData.company_name || 'Manuscript Technomedia LLP'}
                      </div>
                    </div>

                    {/* Document Title */}
                    <div className="text-center">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-900 m-0">
                        {previewDocType === 'payslip' ? 'PAY SLIP' : 'EMPLOYEE DETAILS FORM'}
                      </h3>
                      {previewDocType === 'payslip' && (
                        <p className="text-[10px] font-semibold text-slate-500 mt-1">
                          For the month of {monthNames[month - 1]} {year}
                        </p>
                      )}
                    </div>

                    <div className="border-t border-slate-200 my-2"></div>

                    {/* Mock Content Rows */}
                    {previewDocType === 'payslip' ? (
                      <div className="grid grid-cols-2 gap-4 text-[10px]">
                        <div>
                          <div className="font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-0.5 mb-1.5">Employee Details</div>
                          <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-slate-500">Employee Code</span><span className="font-bold">SAMPLE-01</span></div>
                          <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-slate-500">Name</span><span className="font-bold">Sample Employee</span></div>
                          <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-slate-500">Designation</span><span className="font-bold">Software Engineer</span></div>
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-0.5 mb-1.5">Attendance Details</div>
                          <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-slate-500">Working Days</span><span className="font-bold">30</span></div>
                          <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-slate-500">Paid Days</span><span className="font-bold">30</span></div>
                          <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-slate-500">Present Days</span><span className="font-bold">28</span></div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 text-[10px]">
                        <div>
                          <div className="font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-0.5 mb-1.5">Employment Details</div>
                          <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-slate-500">Employee ID</span><span className="font-bold">SAMPLE-01</span></div>
                          <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-slate-500">Full Name</span><span className="font-bold">Sample Employee</span></div>
                          <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-slate-500">Role</span><span className="font-bold">Senior Developer</span></div>
                        </div>
                        <div>
                          <div className="font-bold text-slate-800 uppercase tracking-wider border-b border-slate-200 pb-0.5 mb-1.5">Contact Details</div>
                          <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-slate-500">Mobile</span><span className="font-bold">+91 9876543210</span></div>
                          <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-slate-500">Email</span><span className="font-bold">sample@company.com</span></div>
                          <div className="flex justify-between py-0.5 border-b border-slate-100"><span className="text-slate-500">City</span><span className="font-bold">Bangalore</span></div>
                        </div>
                      </div>
                    )}

                    {/* Disclaimer Note */}
                    <div className="text-center pt-2 border-t border-slate-200 text-[9px] text-slate-400 italic">
                      Note: This is a computer-generated official document and does not require a signature.
                    </div>
                  </div>

                  {/* Registered Office Line Below Box */}
                  <div className="mt-4 pt-2 border-t border-black text-center">
                    <p className="text-[9px] font-medium text-slate-900 leading-tight">
                      {brandingData.registered_office_address || 'Manuscript Technomedia LLP, Reg. Office. No. 22, 3rd Cross, Vivekananda Nagar, Bangalore-33, Karnataka, India.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
