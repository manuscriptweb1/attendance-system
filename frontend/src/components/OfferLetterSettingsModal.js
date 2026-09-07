import React, { useState, useEffect, useCallback } from 'react';
import {
  FiX, FiUpload, FiTrash2, FiPlus, FiSave, FiCheck,
  FiRefreshCw, FiList, FiInfo, FiFileText,
  FiLayers, FiEye, FiDownload, FiRotateCcw, FiSliders,
  FiUploadCloud
} from 'react-icons/fi';
import {
  getOfferLetterSettings,
  updateOfferLetterSettings,
  resetOfferLetterLogo,
  getRoleTemplates,
  saveRoleTemplate,
  deleteRoleTemplate,
  getBrandingSettings,
  updateBrandingSettings,
  resetBrandingLogo,
  downloadSampleBrandingPdf
} from '../services/api';

const OfferLetterSettingsModal = ({ isOpen, onClose, onSettingsUpdated }) => {
  // Main Active Tab: 'letters' | 'payslips_forms' | 'roles'
  const [activeTab, setActiveTab] = useState('letters');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // ---------------------------------------------------------------------------
  // TAB 1: Official Letters & Letterhead Settings (Offer, Experience, Relieving)
  // ---------------------------------------------------------------------------
  const [letterSettings, setLetterSettings] = useState({
    company_name: 'Manuscript TechnoMedia LLP',
    logo_path: null,
    logo_data_url: null,
    logo_width: 160,
    logo_height: 60,
    header_address: 'Reg. Office. No. 22, 3rd Cross,\nVivekananda Nagar, Bangalore-33,\nKarnataka, India',
    header_phone: '91-9686980760',
    header_email: 'connect@mstechnomedia.com',
    header_website: 'www.mstechnomedia.com',
    footer_line_1: 'Manuscript Technomedia LLP,',
    footer_line_2: 'Reg. New No 40, 22, 3rd Cross Rd, Jaibharath Nagar, Vivekananda Nagar, Maruthi Sevanagar, Bangalore-33, Karnataka, India.',
    footer_line_3: 'https://mstechnomedia.com | contact@mstechnomedia.com | +91-9686980760 | GST: 29ACBFM2283L1ZV',
    footer_accent_color: '#E11D48',
    signatory_name: 'Dr. Mueen Ahmed KK',
    signatory_designation: 'Designated Partner',
    signatory_email: 'contact@mstechnomedia.com'
  });
  const [letterLogoBase64, setLetterLogoBase64] = useState(null);
  const [savingLetters, setSavingLetters] = useState(false);

  // ---------------------------------------------------------------------------
  // TAB 2: Payslips & Employee Details PDF Template Branding & Live Preview
  // ---------------------------------------------------------------------------
  const [brandingData, setBrandingData] = useState({
    company_name: 'Manuscript Technomedia LLP',
    company_name_font_size: 17,
    logo_width: 32,
    logo_height: 32,
    registered_office_address: 'Manuscript Technomedia LLP, Reg. Office. No. 22, 3rd Cross, Vivekananda Nagar, Bangalore-33, Karnataka, India.',
    logo_path: null
  });
  const [brandingLogoBase64, setBrandingLogoBase64] = useState(null);
  const [brandingLogoPreviewUrl, setBrandingLogoPreviewUrl] = useState(`${window.location.origin}/favicon/web-app-manifest-192x192.png`);
  const [loadingBranding, setLoadingBranding] = useState(false);
  const [savingBranding, setSavingBranding] = useState(false);
  const [resettingBrandingLogo, setResettingBrandingLogo] = useState(false);
  const [previewDocType, setPreviewDocType] = useState('payslip'); // 'payslip' | 'employee_details'
  const [downloadingSampleType, setDownloadingSampleType] = useState(null);

  // ---------------------------------------------------------------------------
  // TAB 3: Master Job Role Responsibilities Templates
  // ---------------------------------------------------------------------------
  const [templates, setTemplates] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [newRoleInput, setNewRoleInput] = useState('');
  const [isAddingNewRole, setIsAddingNewRole] = useState(false);
  const [categories, setCategories] = useState([]);
  const [experienceWorkSummary, setExperienceWorkSummary] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Load All Settings
  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [settingsRes, templatesRes, brandingRes] = await Promise.all([
        getOfferLetterSettings(),
        getRoleTemplates(),
        getBrandingSettings().catch(() => ({ data: null }))
      ]);

      // 1. Official Letters Settings
      if (settingsRes.data?.settings) {
        setLetterSettings(settingsRes.data.settings);
      }

      // 2. Job Role Templates
      if (templatesRes.data?.templates) {
        const tmps = templatesRes.data.templates;
        setTemplates(tmps);
        if (tmps.length > 0 && !selectedRole) {
          setSelectedRole(tmps[0].job_role);
          setCategories(Array.isArray(tmps[0].categories) ? tmps[0].categories : []);
          setExperienceWorkSummary(
            tmps[0].experience_work_summary ||
              'During his tenure of work, he participated in executing projects for Manuscript TechnoMedia LLP and executed many publishing projects successfully.'
          );
        }
      }

      // 3. Payslip & Employee Form PDF Branding
      if (brandingRes.data?.success && brandingRes.data?.branding) {
        const b = brandingRes.data.branding;
        setBrandingData({
          company_name: b.company_name || 'Manuscript Technomedia LLP',
          company_name_font_size: Number(b.company_name_font_size) || 17,
          logo_width: Number(b.logo_width) || 32,
          logo_height: Number(b.logo_height) || 32,
          registered_office_address: b.registered_office_address || 'Manuscript Technomedia LLP, Reg. Office. No. 22, 3rd Cross, Vivekananda Nagar, Bangalore-33, Karnataka, India.',
          logo_path: b.logo_path || null
        });

        if (b.logo_data_url) {
          setBrandingLogoPreviewUrl(b.logo_data_url);
        } else if (b.logo_path) {
          const backendBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
          setBrandingLogoPreviewUrl(b.logo_path.startsWith('http') ? b.logo_path : `${backendBase}${b.logo_path}`);
        } else {
          setBrandingLogoPreviewUrl(`${window.location.origin}/favicon/web-app-manifest-192x192.png`);
        }
      }
    } catch (err) {
      console.error('Failed to load branding & document settings:', err);
      setErrorMsg('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, [selectedRole]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  // ---------------------------------------------------------------------------
  // TAB 1 HANDLERS: Official Letters
  // ---------------------------------------------------------------------------
  const handleLetterLogoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please upload a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Logo file size must be less than 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setLetterLogoBase64(reader.result);
      setLetterSettings((prev) => ({ ...prev, logo_data_url: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleResetLetterLogo = async () => {
    try {
      setSavingLetters(true);
      const res = await resetOfferLetterLogo();
      if (res.data?.settings) {
        setLetterSettings(res.data.settings);
        setLetterLogoBase64(null);
        setSuccessMsg('Letter logo reset to default successfully');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      setErrorMsg('Failed to reset letter logo');
    } finally {
      setSavingLetters(false);
    }
  };

  const handleSaveLetters = async (e) => {
    e.preventDefault();
    setSavingLetters(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        ...letterSettings,
        logo_base64: letterLogoBase64
      };
      const res = await updateOfferLetterSettings(payload);
      if (res.data?.settings) {
        setLetterSettings(res.data.settings);
        setLetterLogoBase64(null);
        setSuccessMsg('Official letters branding & dynamic footer saved successfully!');
        if (onSettingsUpdated) onSettingsUpdated(res.data.settings);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Failed to save official letters settings:', err);
      setErrorMsg('Failed to save official letters settings.');
    } finally {
      setSavingLetters(false);
    }
  };

  // ---------------------------------------------------------------------------
  // TAB 2 HANDLERS: Payslips & Employee Profile Forms
  // ---------------------------------------------------------------------------
  const fetchBrandingOnly = async () => {
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
          setBrandingLogoPreviewUrl(b.logo_data_url);
        } else if (b.logo_path) {
          const backendBase = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
          setBrandingLogoPreviewUrl(b.logo_path.startsWith('http') ? b.logo_path : `${backendBase}${b.logo_path}`);
        } else {
          setBrandingLogoPreviewUrl(`${window.location.origin}/favicon/web-app-manifest-192x192.png`);
        }
      }
    } catch (e) {
      console.error('Failed to reload PDF branding settings:', e);
    } finally {
      setLoadingBranding(false);
    }
  };

  const handleBrandingLogoFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, SVG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('Image file size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setBrandingLogoBase64(dataUrl);
      setBrandingLogoPreviewUrl(dataUrl);
      setSuccessMsg('New logo selected. Click "Save PDF Branding Settings" to apply.');
      setTimeout(() => setSuccessMsg(''), 4000);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveBranding = async (e) => {
    e?.preventDefault();
    try {
      setSavingBranding(true);
      setErrorMsg('');
      setSuccessMsg('');

      const payload = {
        company_name: brandingData.company_name,
        company_name_font_size: brandingData.company_name_font_size,
        logo_width: brandingData.logo_width,
        logo_height: brandingData.logo_height,
        registered_office_address: brandingData.registered_office_address,
        logo_base64: brandingLogoBase64 || undefined
      };

      const res = await updateBrandingSettings(payload);
      if (res.data?.success) {
        setSuccessMsg('Payslips & Employee Profile Forms branding saved successfully!');
        setBrandingLogoBase64(null);
        await fetchBrandingOnly();
        setTimeout(() => setSuccessMsg(''), 3000);
      } else {
        setErrorMsg(res.data?.message || 'Failed to save PDF branding settings.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Error updating PDF branding settings.');
    } finally {
      setSavingBranding(false);
    }
  };

  const handleResetBrandingLogo = async () => {
    try {
      setResettingBrandingLogo(true);
      setErrorMsg('');
      const res = await resetBrandingLogo();
      if (res.data?.success) {
        setBrandingLogoBase64(null);
        setBrandingLogoPreviewUrl(`${window.location.origin}/favicon/web-app-manifest-192x192.png`);
        setSuccessMsg('Logo has been reset to system default.');
        await fetchBrandingOnly();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      setErrorMsg('Error resetting logo.');
    } finally {
      setResettingBrandingLogo(false);
    }
  };

  const handleDownloadSamplePdf = async (type) => {
    try {
      setDownloadingSampleType(type);
      const res = await downloadSampleBrandingPdf(type);
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
      alert('Failed to generate sample test PDF. Please check server logs.');
    } finally {
      setDownloadingSampleType(null);
    }
  };

  // ---------------------------------------------------------------------------
  // TAB 3 HANDLERS: Master Role Responsibilities
  // ---------------------------------------------------------------------------
  const handleRoleSelect = (roleName) => {
    setSelectedRole(roleName);
    const tmpl = templates.find((t) => t.job_role === roleName);
    if (tmpl) {
      setCategories(Array.isArray(tmpl.categories) ? tmpl.categories : []);
      setExperienceWorkSummary(
        tmpl.experience_work_summary ||
          'During his tenure of work, he participated in executing projects for Manuscript TechnoMedia LLP and executed many publishing projects successfully.'
      );
    } else {
      setCategories([]);
      setExperienceWorkSummary('');
    }
  };

  const addCategory = () => {
    const nextNum = categories.length + 1;
    setCategories([
      ...categories,
      { category: `${nextNum}. New Section Title`, items: ['First responsibility bullet point.'] }
    ]);
  };

  const updateCategoryTitle = (idx, title) => {
    const updated = [...categories];
    updated[idx].category = title;
    setCategories(updated);
  };

  const removeCategory = (idx) => {
    setCategories(categories.filter((_, i) => i !== idx));
  };

  const addBullet = (catIdx) => {
    const updated = [...categories];
    if (!Array.isArray(updated[catIdx].items)) updated[catIdx].items = [];
    updated[catIdx].items.push('New responsibility item.');
    setCategories(updated);
  };

  const updateBullet = (catIdx, itemIdx, val) => {
    const updated = [...categories];
    updated[catIdx].items[itemIdx] = val;
    setCategories(updated);
  };

  const removeBullet = (catIdx, itemIdx) => {
    const updated = [...categories];
    updated[catIdx].items = updated[catIdx].items.filter((_, i) => i !== itemIdx);
    setCategories(updated);
  };

  const handleSaveTemplate = async () => {
    const roleToSave = isAddingNewRole ? newRoleInput.trim() : selectedRole;
    if (!roleToSave) {
      setErrorMsg('Please specify a job role name');
      return;
    }

    setSavingTemplate(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await saveRoleTemplate({
        job_role: roleToSave,
        categories,
        experience_work_summary: experienceWorkSummary
      });

      if (res.data?.template) {
        setSuccessMsg(`Template for "${roleToSave}" saved successfully!`);
        setIsAddingNewRole(false);
        setNewRoleInput('');
        loadData();
        setSelectedRole(roleToSave);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Failed to save role template:', err);
      setErrorMsg('Failed to save template.');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async () => {
    const tmpl = templates.find((t) => t.job_role === selectedRole);
    if (!tmpl) return;

    if (!window.confirm(`Are you sure you want to delete the template for "${selectedRole}"?`)) {
      return;
    }

    setSavingTemplate(true);
    try {
      await deleteRoleTemplate(tmpl.id);
      setSuccessMsg(`Template for "${selectedRole}" deleted.`);
      loadData();
      setSelectedRole('');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg('Failed to delete template');
    } finally {
      setSavingTemplate(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-admin-bg text-admin-text animate-fade-in overflow-hidden w-full h-full">
      {/* Full-Screen Header */}
      <div className="flex items-center justify-between px-6 lg:px-8 py-4 border-b border-admin-border bg-admin-surface flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-admin-accent/15 text-admin-accent flex items-center justify-center font-bold text-lg shadow-sm">
            ⚙️
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-admin-text tracking-tight">
              Company Branding & Document Templates
            </h2>
            <p className="text-xs text-admin-muted mt-0.5">
              Configure official letterheads, payslips, employee forms, dynamic footers & master templates
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-admin-secondary hover:text-admin-text bg-admin-elevated/60 hover:bg-admin-elevated border border-admin-border transition-colors text-xs font-bold cursor-pointer"
          title="Close Settings"
        >
          <FiX size={18} />
          <span className="hidden sm:inline">Close</span>
        </button>
      </div>

      {/* 3 Meaningful Master Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 px-6 lg:px-8 pt-3 border-b border-admin-border bg-admin-bg flex-shrink-0 overflow-x-auto">
        {/* TAB 1: Official Letters & Letterhead */}
        <button
          onClick={() => setActiveTab('letters')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'letters'
              ? 'border-admin-accent text-admin-accent bg-admin-surface shadow-sm'
              : 'border-transparent text-admin-secondary hover:text-admin-text hover:bg-admin-elevated/40'
          }`}
        >
          <FiFileText size={15} />
          <span>Official Letters & Letterhead</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500 font-normal hidden sm:inline">
            Offer / Experience / Relieving
          </span>
        </button>

        {/* TAB 2: Payslips & Employee Profile Forms */}
        <button
          onClick={() => setActiveTab('payslips_forms')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'payslips_forms'
              ? 'border-admin-accent text-admin-accent bg-admin-surface shadow-sm'
              : 'border-transparent text-admin-secondary hover:text-admin-text hover:bg-admin-elevated/40'
          }`}
        >
          <FiLayers size={15} />
          <span>Payslips & Employee Profile Forms</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500 font-normal hidden sm:inline">
            PDF Live Preview
          </span>
        </button>

        {/* TAB 3: Job Role Responsibilities */}
        <button
          onClick={() => setActiveTab('roles')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'roles'
              ? 'border-admin-accent text-admin-accent bg-admin-surface shadow-sm'
              : 'border-transparent text-admin-secondary hover:text-admin-text hover:bg-admin-elevated/40'
          }`}
        >
          <FiList size={15} />
          <span>Job Role Responsibilities</span>
        </button>
      </div>

      {/* Main Full-Screen Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 dark-scroll">
        <div className="max-w-7xl mx-auto w-full space-y-6">
          {/* Global Feedback Notifications */}
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 animate-fadeIn">
              <FiCheck size={16} />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2 animate-fadeIn">
              <FiInfo size={16} />
              <span className="font-semibold">{errorMsg}</span>
            </div>
          )}

          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-admin-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-admin-muted">Loading branding & document settings...</p>
            </div>
          ) : activeTab === 'letters' ? (
            /* ========================================================================= */
            /* TAB 1: OFFICIAL LETTERS & LETTERHEAD (Offer / Experience / Relieving)      */
            /* ========================================================================= */
            <form id="lettersForm" onSubmit={handleSaveLetters} className="space-y-6">
              
              {/* Official Letters Logo Section */}
              <div className="p-4 rounded-xl bg-admin-elevated/40 border border-admin-border space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-admin-text">Company Letterhead Logo</h3>
                    <p className="text-xs text-admin-muted">
                      Rendered top-right on all official company letters (Offer Letters, Experience & Relieving Certificates).
                    </p>
                  </div>
                  {letterSettings.logo_path && (
                    <button
                      type="button"
                      onClick={handleResetLetterLogo}
                      disabled={savingLetters}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors flex items-center gap-1.5"
                    >
                      <FiRefreshCw size={13} />
                      Reset to Default
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="w-48 h-20 rounded-xl border border-dashed border-admin-border bg-admin-bg flex items-center justify-center p-2 relative overflow-hidden flex-shrink-0">
                    {letterSettings.logo_data_url || letterSettings.logo_path ? (
                      <img
                        src={letterSettings.logo_data_url || letterSettings.logo_path}
                        alt="Letter Logo"
                        className="max-h-full max-w-full object-contain"
                      />
                    ) : (
                      <span className="text-xs text-admin-muted">No custom logo</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-admin-accent/15 text-admin-accent hover:bg-admin-accent/25 border border-admin-accent/30 text-xs font-semibold cursor-pointer transition-colors">
                      <FiUpload size={14} />
                      Upload New Logo Image
                      <input
                        type="file"
                        accept="image/png, image/jpeg, image/webp, image/svg+xml"
                        onChange={handleLetterLogoUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-admin-muted">
                      Recommended: High resolution transparent PNG or WebP. Max 2MB.
                    </p>
                  </div>
                </div>
              </div>

              {/* Company Info & Top-Left Header */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-admin-secondary">Company Legal Name</label>
                  <input
                    type="text"
                    value={letterSettings.company_name}
                    onChange={(e) => setLetterSettings({ ...letterSettings, company_name: e.target.value })}
                    required
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-admin-secondary">
                    Top-Left Header Address (Multi-line)
                  </label>
                  <textarea
                    rows={3}
                    value={letterSettings.header_address}
                    onChange={(e) => setLetterSettings({ ...letterSettings, header_address: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent resize-none font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-admin-secondary">Header Phone</label>
                  <input
                    type="text"
                    value={letterSettings.header_phone}
                    onChange={(e) => setLetterSettings({ ...letterSettings, header_phone: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-admin-secondary">Header Email</label>
                  <input
                    type="email"
                    value={letterSettings.header_email}
                    onChange={(e) => setLetterSettings({ ...letterSettings, header_email: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-admin-secondary">Header Website</label>
                  <input
                    type="text"
                    value={letterSettings.header_website}
                    onChange={(e) => setLetterSettings({ ...letterSettings, header_website: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                  />
                </div>
              </div>

              {/* Dynamic 3-Line Colored Footer */}
              <div className="p-4 rounded-xl bg-admin-elevated/40 border border-admin-border space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-admin-text">Letter Dynamic Multi-Line Footer</h3>
                  <p className="text-xs text-admin-muted">
                    This 3-line footer with accent line renders at the bottom of all generated official letters.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-admin-secondary">
                      Footer Line 1 (Company Name)
                    </label>
                    <input
                      type="text"
                      value={letterSettings.footer_line_1}
                      onChange={(e) => setLetterSettings({ ...letterSettings, footer_line_1: e.target.value })}
                      required
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-admin-secondary">
                      Footer Line 2 (Registered Office Address)
                    </label>
                    <input
                      type="text"
                      value={letterSettings.footer_line_2}
                      onChange={(e) => setLetterSettings({ ...letterSettings, footer_line_2: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-admin-secondary">
                      Footer Line 3 (Website, Email, Phone, GST)
                    </label>
                    <input
                      type="text"
                      value={letterSettings.footer_line_3 || ''}
                      onChange={(e) => setLetterSettings({ ...letterSettings, footer_line_3: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>

                  {/* Live Footer Preview Box */}
                  <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Live Footer Preview</p>
                    <div className="w-full h-0.5 bg-rose-600 my-1 rounded-full" />
                    <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                      {letterSettings.footer_line_1 || 'Manuscript Technomedia LLP'}
                    </p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300">
                      {letterSettings.footer_line_2 || 'Reg. Office Address'}
                    </p>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400">
                      {letterSettings.footer_line_3 || 'https://mstechnomedia.com | contact@mstechnomedia.com'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Signatory Settings */}
              <div className="p-4 rounded-xl bg-admin-elevated/40 border border-admin-border space-y-4">
                <h3 className="text-sm font-bold text-admin-text">Default Authorized Signatory</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-admin-secondary">Signatory Name</label>
                    <input
                      type="text"
                      value={letterSettings.signatory_name}
                      onChange={(e) => setLetterSettings({ ...letterSettings, signatory_name: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-admin-secondary">Designation</label>
                    <input
                      type="text"
                      value={letterSettings.signatory_designation}
                      onChange={(e) => setLetterSettings({ ...letterSettings, signatory_designation: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-admin-secondary">Signatory Email</label>
                    <input
                      type="email"
                      value={letterSettings.signatory_email}
                      onChange={(e) => setLetterSettings({ ...letterSettings, signatory_email: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>
                </div>
              </div>
            </form>
          ) : activeTab === 'payslips_forms' ? (
            /* ========================================================================= */
            /* TAB 2: PAYSLIPS & EMPLOYEE PROFILE FORMS (Controls + Live Preview)       */
            /* ========================================================================= */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Left Column: Form Controls (5 cols) */}
              <div className="lg:col-span-5 p-5 rounded-2xl bg-admin-elevated/40 border border-admin-border space-y-4">
                <div className="flex items-center justify-between border-b border-admin-border pb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-admin-accent flex items-center gap-1.5">
                    <FiSliders size={14} /> PDF Template Branding
                  </h3>
                  <button
                    type="button"
                    onClick={fetchBrandingOnly}
                    disabled={loadingBranding}
                    className="text-admin-muted hover:text-admin-text text-xs flex items-center gap-1 transition-colors"
                    title="Reload PDF settings"
                  >
                    <FiRefreshCw size={12} className={loadingBranding ? 'animate-spin' : ''} /> Reload
                  </button>
                </div>

                <form id="brandingForm" onSubmit={handleSaveBranding} className="space-y-4 text-xs">
                  {/* Company Name */}
                  <div>
                    <label className="block font-semibold text-admin-secondary mb-1">
                      Company / Office Name
                    </label>
                    <input
                      type="text"
                      value={brandingData.company_name}
                      onChange={(e) => setBrandingData((prev) => ({ ...prev, company_name: e.target.value }))}
                      placeholder="e.g. Manuscript Technomedia LLP"
                      className="w-full px-3.5 py-2 bg-admin-bg border border-admin-border rounded-xl text-admin-text font-semibold focus:outline-none focus:border-admin-accent transition-colors"
                      required
                    />
                    <p className="text-[10px] text-admin-muted mt-1">
                      Rendered at top header of Payslips and Employee Details forms.
                    </p>
                  </div>

                  {/* Company Title Font Size */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block font-semibold text-admin-secondary">
                        Company Title Font Size (pt)
                      </label>
                      <span className="px-2 py-0.5 bg-admin-accent/15 text-admin-accent rounded font-mono font-bold text-[11px]">
                        {brandingData.company_name_font_size} pt
                      </span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="26"
                      step="1"
                      value={brandingData.company_name_font_size}
                      onChange={(e) => setBrandingData((prev) => ({ ...prev, company_name_font_size: Number(e.target.value) }))}
                      className="w-full h-1.5 bg-admin-border rounded-lg appearance-none cursor-pointer accent-admin-accent"
                    />
                    <div className="flex justify-between text-[10px] text-admin-muted mt-1">
                      <span>12 pt (Small)</span>
                      <span>17 pt (Default)</span>
                      <span>26 pt (Large)</span>
                    </div>
                  </div>

                  {/* Office Logo Upload & Sizing */}
                  <div className="border border-admin-border rounded-xl p-3.5 bg-admin-bg/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block font-semibold text-admin-secondary">
                        Office Logo Image
                      </label>
                      {brandingData.logo_path && (
                        <button
                          type="button"
                          onClick={handleResetBrandingLogo}
                          disabled={resettingBrandingLogo}
                          className="text-[11px] text-amber-500 hover:text-amber-600 font-bold flex items-center gap-1 transition-colors"
                        >
                          <FiRotateCcw size={11} /> Reset Default
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-xl border border-admin-border bg-white p-1.5 flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                        <img
                          src={brandingLogoPreviewUrl}
                          alt="Logo Preview"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-admin-accent/15 hover:bg-admin-accent/25 text-admin-accent font-bold rounded-xl cursor-pointer transition-colors text-xs border border-admin-accent/30">
                          <FiUploadCloud size={14} /> Choose Logo
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/jpg, image/svg+xml, image/webp"
                            onChange={handleBrandingLogoFileChange}
                            className="hidden"
                          />
                        </label>
                        <p className="text-[10px] text-admin-muted">PNG, JPG, SVG, WebP (Max 5MB)</p>
                      </div>
                    </div>
                  </div>

                  {/* Logo Dimensions Sliders */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-semibold text-admin-secondary text-[11px]">
                          Logo Width (px)
                        </label>
                        <span className="px-1.5 py-0.5 bg-admin-bg border border-admin-border text-admin-accent rounded font-mono font-bold text-[10px]">
                          {brandingData.logo_width}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="16"
                        max="100"
                        step="2"
                        value={brandingData.logo_width}
                        onChange={(e) => setBrandingData((prev) => ({ ...prev, logo_width: Number(e.target.value) }))}
                        className="w-full h-1.5 bg-admin-border rounded-lg appearance-none cursor-pointer accent-admin-accent"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block font-semibold text-admin-secondary text-[11px]">
                          Logo Height (px)
                        </label>
                        <span className="px-1.5 py-0.5 bg-admin-bg border border-admin-border text-admin-accent rounded font-mono font-bold text-[10px]">
                          {brandingData.logo_height}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="16"
                        max="100"
                        step="2"
                        value={brandingData.logo_height}
                        onChange={(e) => setBrandingData((prev) => ({ ...prev, logo_height: Number(e.target.value) }))}
                        className="w-full h-1.5 bg-admin-border rounded-lg appearance-none cursor-pointer accent-admin-accent"
                      />
                    </div>
                  </div>

                  {/* Registered Office Address Text */}
                  <div>
                    <label className="block font-semibold text-admin-secondary mb-1">
                      Registered Office Line (Footer)
                    </label>
                    <textarea
                      rows={2}
                      value={brandingData.registered_office_address}
                      onChange={(e) => setBrandingData((prev) => ({ ...prev, registered_office_address: e.target.value }))}
                      placeholder="Manuscript Technomedia LLP, Reg. Office..."
                      className="w-full px-3.5 py-2 bg-admin-bg border border-admin-border rounded-xl text-admin-text font-semibold text-xs focus:outline-none focus:border-admin-accent transition-colors resize-none"
                      required
                    />
                    <p className="text-[10px] text-admin-muted mt-1">Printed centered at the bottom outside edge of each PDF page.</p>
                  </div>
                </form>
              </div>

              {/* Right Column: Real-time Live Visual Preview (7 cols) */}
              <div className="lg:col-span-7 p-5 rounded-2xl bg-admin-elevated/40 border border-admin-border space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border pb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-admin-accent flex items-center gap-1.5">
                      <FiEye size={14} /> Live Visual Preview
                    </h3>
                    <span className="px-2 py-0.5 bg-admin-accent/15 border border-admin-accent/30 text-admin-accent font-bold rounded text-[10px]">
                      Real-time
                    </span>
                  </div>

                  {/* Switch Document Preview Toggle */}
                  <div className="flex items-center gap-1 bg-admin-bg p-1 rounded-xl border border-admin-border">
                    <button
                      type="button"
                      onClick={() => setPreviewDocType('payslip')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        previewDocType === 'payslip'
                          ? 'bg-admin-accent text-white shadow-sm'
                          : 'text-admin-muted hover:text-admin-text'
                      }`}
                    >
                      Payslip Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewDocType('employee_details')}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${
                        previewDocType === 'employee_details'
                          ? 'bg-admin-accent text-white shadow-sm'
                          : 'text-admin-muted hover:text-admin-text'
                      }`}
                    >
                      Employee Form Preview
                    </button>
                  </div>
                </div>

                {/* Sample PDF Download Actions */}
                <div className="flex flex-wrap items-center gap-2.5 bg-admin-bg/60 p-2.5 rounded-xl border border-admin-border text-xs">
                  <span className="text-[11px] font-bold text-admin-muted flex items-center gap-1">
                    <FiDownload size={12} /> Test Download:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownloadSamplePdf('payslip')}
                    disabled={downloadingSampleType !== null}
                    className="px-2.5 py-1.5 bg-admin-accent hover:opacity-95 text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    {downloadingSampleType === 'payslip' ? (
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiFileText size={12} />
                    )}
                    Sample Payslip PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadSamplePdf('employee_details')}
                    disabled={downloadingSampleType !== null}
                    className="px-2.5 py-1.5 bg-admin-surface hover:bg-admin-elevated text-admin-text text-[11px] font-bold rounded-lg border border-admin-border transition-all flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                  >
                    {downloadingSampleType === 'employee_details' ? (
                      <div className="w-3 h-3 border-2 border-admin-accent border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <FiFileText size={12} />
                    )}
                    Sample Employee Details PDF
                  </button>
                </div>

                {/* Simulated Paper Canvas */}
                <div className="bg-slate-900/40 dark:bg-black/40 p-4 rounded-xl flex justify-center overflow-x-auto border border-admin-border/50">
                  <div className="w-full max-w-[540px] bg-white rounded-lg shadow-2xl p-6 text-slate-900 border border-slate-300 scale-[0.98] transition-all">
                    <div className="border border-slate-300 rounded-md p-4 bg-white space-y-3">
                      
                      {/* Live Header with custom logo size & font size */}
                      <div className="flex items-center justify-center gap-2.5">
                        <img
                          src={brandingLogoPreviewUrl}
                          alt="Logo"
                          style={{
                            width: `${brandingData.logo_width}px`,
                            height: `${brandingData.logo_height}px`,
                            objectFit: 'contain'
                          }}
                        />
                        <div
                          className="font-black text-slate-900 tracking-tight leading-tight"
                          style={{ fontSize: `${brandingData.company_name_font_size}px` }}
                        >
                          {brandingData.company_name || 'Manuscript Technomedia LLP'}
                        </div>
                      </div>

                      {/* Document Title */}
                      <div className="text-center pt-1">
                        <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-900 m-0">
                          {previewDocType === 'payslip' ? 'PAY SLIP' : 'EMPLOYEE DETAILS FORM'}
                        </h4>
                        {previewDocType === 'payslip' && (
                          <p className="text-[9px] font-semibold text-slate-500 mt-0.5">
                            For the month of {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
                          </p>
                        )}
                      </div>

                      {/* Simulated Document Body */}
                      {previewDocType === 'payslip' ? (
                        <div className="space-y-2 text-[10px] border-t border-slate-200 pt-2 font-mono">
                          <div className="grid grid-cols-2 gap-2 pb-1 border-b border-slate-100 font-sans">
                            <div>
                              <span className="text-slate-400 block text-[9px] font-bold uppercase">Employee Details</span>
                              <div className="font-semibold text-slate-800">SAMPLE EMPLOYEE (SAMPLE-01)</div>
                              <div className="text-slate-500 text-[9px]">Senior Developer | Engineering</div>
                            </div>
                            <div className="text-right">
                              <span className="text-slate-400 block text-[9px] font-bold uppercase">Attendance</span>
                              <div className="text-slate-800">Working Days: 30 | Present: 28</div>
                              <div className="text-slate-500 text-[9px]">LOP: 0 | Paid Days: 30</div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 pt-1">
                            <div className="space-y-0.5">
                              <span className="font-sans font-bold text-emerald-700 block text-[9px] uppercase">Earnings</span>
                              <div className="flex justify-between"><span>Basic:</span><span>₹25,000.00</span></div>
                              <div className="flex justify-between"><span>HRA:</span><span>₹10,000.00</span></div>
                              <div className="flex justify-between"><span>Special Allowance:</span><span>₹15,000.00</span></div>
                              <div className="flex justify-between font-bold border-t border-slate-200 pt-0.5"><span>Gross:</span><span>₹50,000.00</span></div>
                            </div>
                            <div className="space-y-0.5">
                              <span className="font-sans font-bold text-amber-700 block text-[9px] uppercase">Deductions</span>
                              <div className="flex justify-between"><span>Professional Tax:</span><span>₹200.00</span></div>
                              <div className="flex justify-between"><span>TDS / Advance:</span><span>₹0.00</span></div>
                              <div className="flex justify-between font-bold border-t border-slate-200 pt-0.5"><span>Total Deductions:</span><span>₹200.00</span></div>
                            </div>
                          </div>

                          <div className="p-1.5 bg-slate-50 border border-slate-200 rounded flex justify-between items-center font-bold text-slate-900 mt-2 font-sans">
                            <span className="text-[10px]">Net Payable:</span>
                            <span className="text-emerald-700 font-mono text-[11px]">₹49,800.00</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2 text-[9px] border-t border-slate-200 pt-2">
                          <div className="p-1.5 bg-slate-50 border border-slate-200 rounded font-bold uppercase tracking-wider text-slate-700">
                            1. Personal & Identity Information
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-slate-700 font-mono text-[9px]">
                            <div>Full Name: <strong>SAMPLE EMPLOYEE</strong></div>
                            <div>Employee Code: <strong>SAMPLE-01</strong></div>
                            <div>Department: <strong>ENGINEERING</strong></div>
                            <div>Designation: <strong>SENIOR DEVELOPER</strong></div>
                            <div>PAN: <strong>ABCDE1234F</strong></div>
                            <div>Aadhaar: <strong>XXXX-XXXX-1234</strong></div>
                          </div>

                          <div className="p-1.5 bg-slate-50 border border-slate-200 rounded font-bold uppercase tracking-wider text-slate-700 mt-2">
                            2. Bank Account Details
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-slate-700 font-mono text-[9px]">
                            <div>Bank: <strong>STATE BANK OF INDIA</strong></div>
                            <div>IFSC: <strong>SBIN0001234</strong></div>
                            <div>Account No: <strong>123456789012</strong></div>
                            <div>Branch: <strong>Main Branch</strong></div>
                          </div>
                        </div>
                      )}

                      {/* Computer Generated Note */}
                      <p className="text-[8px] text-center text-slate-400 italic pt-1 border-t border-slate-100 m-0">
                        Note: This is a computer-generated official document and does not require a signature.
                      </p>
                    </div>

                    {/* Centered Registered Office Footer Line at bottom */}
                    <div className="text-center pt-3 text-[9px] text-slate-500 border-t border-slate-200 mt-2 font-medium leading-tight">
                      {brandingData.registered_office_address || 'Manuscript Technomedia LLP, Reg. Office Address'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ========================================================================= */
            /* TAB 3: JOB ROLE RESPONSIBILITIES MASTER TEMPLATES                          */
            /* ========================================================================= */
            <div className="space-y-5">
              {/* Role Selector & Add New Role Bar */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-admin-elevated/40 border border-admin-border">
                <div className="flex items-center gap-3 flex-1">
                  {!isAddingNewRole ? (
                    <div className="flex items-center gap-2 flex-1 max-w-sm">
                      <label className="text-xs font-bold text-admin-secondary whitespace-nowrap">
                        Select Job Role:
                      </label>
                      <select
                        value={selectedRole}
                        onChange={(e) => handleRoleSelect(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent font-medium"
                      >
                        {templates.map((t) => (
                          <option key={t.id} value={t.job_role}>
                            {t.job_role}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 max-w-md">
                      <label className="text-xs font-bold text-admin-accent whitespace-nowrap">
                        New Role Name:
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Full Stack Developer, Marketing Executive"
                        value={newRoleInput}
                        onChange={(e) => setNewRoleInput(e.target.value)}
                        className="flex-1 px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                      />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!isAddingNewRole ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNewRole(true);
                          setNewRoleInput('');
                          setCategories([
                            { category: '1. Core Responsibilities', items: ['Key responsibility item.'] }
                          ]);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-admin-accent/15 text-admin-accent hover:bg-admin-accent/25 border border-admin-accent/30 text-xs font-semibold transition-colors flex items-center gap-1.5"
                      >
                        <FiPlus size={14} />
                        Add New Role
                      </button>
                      {selectedRole && (
                        <button
                          type="button"
                          onClick={handleDeleteTemplate}
                          disabled={savingTemplate}
                          className="p-2 rounded-xl text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
                          title="Delete Template"
                        >
                          <FiTrash2 size={15} />
                        </button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingNewRole(false);
                        if (templates.length > 0) handleRoleSelect(templates[0].job_role);
                      }}
                      className="px-3 py-1.5 rounded-xl text-admin-muted hover:text-admin-text hover:bg-admin-elevated text-xs font-medium"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Experience Letter Role-Specific Work Summary (Paragraph 2) */}
              <div className="p-4 rounded-xl bg-admin-elevated/40 border border-admin-border space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-admin-accent flex items-center gap-1.5">
                      📜 Experience Letter Work Summary (Paragraph 2)
                    </h4>
                    <p className="text-[11px] text-admin-muted mt-0.5">
                      Auto-populated into the 2nd paragraph of Experience & Relieving Certificates for &quot;{selectedRole || 'this role'}&quot;.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setExperienceWorkSummary(
                        `During his tenure of work, he participated in executing projects for Manuscript TechnoMedia LLP and executed many publishing projects successfully.`
                      )
                    }
                    className="text-[11px] text-admin-secondary hover:text-admin-text font-semibold px-2.5 py-1 rounded-lg bg-admin-bg border border-admin-border hover:bg-admin-elevated transition-colors"
                  >
                    Reset to Default
                  </button>
                </div>

                <textarea
                  rows={3}
                  value={experienceWorkSummary}
                  onChange={(e) => setExperienceWorkSummary(e.target.value)}
                  placeholder="e.g. During his tenure of work, he participated in executing web applications and software systems for Manuscript TechnoMedia LLP and executed many projects successfully."
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent leading-relaxed font-sans"
                />

                <div className="p-2.5 rounded-lg bg-admin-bg/60 border border-admin-border text-[11px] text-admin-secondary flex items-start gap-2">
                  <span className="font-bold text-admin-accent">💡 Tip:</span>
                  <span>
                    When generating an Experience Letter, gender pronouns (he/she, his/her) and company name will automatically format based on candidate selection.
                  </span>
                </div>
              </div>

              {/* Structured Responsibilities Categories */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-admin-secondary">
                    Offer Letter Responsibilities & Bullet Points ({categories.length} Sections)
                  </h4>
                  <button
                    type="button"
                    onClick={addCategory}
                    className="px-3 py-1 text-xs font-semibold rounded-lg bg-admin-elevated hover:bg-admin-border border border-admin-border text-admin-text transition-colors flex items-center gap-1"
                  >
                    <FiPlus size={13} />
                    Add Section
                  </button>
                </div>

                {categories.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl bg-admin-elevated/20 border border-dashed border-admin-border text-admin-muted text-xs">
                    No responsibilities configured for this role. Click "Add Section" to create categories with bullet points.
                  </div>
                ) : (
                  categories.map((cat, catIdx) => (
                    <div
                      key={catIdx}
                      className="p-4 rounded-xl bg-admin-elevated/30 border border-admin-border space-y-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-1">
                          <span className="w-6 h-6 rounded-lg bg-admin-accent/20 text-admin-accent text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {catIdx + 1}
                          </span>
                          <input
                            type="text"
                            value={cat.category}
                            onChange={(e) => updateCategoryTitle(catIdx, e.target.value)}
                            placeholder="Section Title e.g. 1. Quality Control & Validation"
                            className="flex-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCategory(catIdx)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title="Remove Section"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>

                      {/* Bullet Items */}
                      <div className="pl-8 space-y-2">
                        {(cat.items || []).map((item, itemIdx) => (
                          <div key={itemIdx} className="flex items-start gap-2">
                            <span className="text-admin-accent text-xs font-bold pt-1.5">•</span>
                            <textarea
                              rows={2}
                              value={item}
                              onChange={(e) => updateBullet(catIdx, itemIdx, e.target.value)}
                              placeholder="Responsibility description..."
                              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent resize-none"
                            />
                            <button
                              type="button"
                              onClick={() => removeBullet(catIdx, itemIdx)}
                              className="p-1 rounded-md text-admin-muted hover:text-rose-500 transition-colors pt-1.5"
                              title="Delete Bullet"
                            >
                              <FiX size={14} />
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => addBullet(catIdx)}
                          className="text-[11px] font-semibold text-admin-accent hover:underline flex items-center gap-1 pt-1"
                        >
                          <FiPlus size={12} />
                          Add Bullet Point
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Bottom Footer Actions */}
      <div className="flex items-center justify-between px-6 lg:px-8 py-4 border-t border-admin-border bg-admin-surface flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors cursor-pointer"
        >
          Close
        </button>

        {activeTab === 'letters' ? (
          <button
            type="submit"
            form="lettersForm"
            disabled={savingLetters}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-admin-accent to-admin-accent2 text-white text-xs font-bold shadow-lg shadow-admin-accent/25 hover:opacity-95 transition-opacity flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <FiSave size={14} />
            {savingLetters ? 'Saving Letterhead...' : 'Save Official Letters Branding'}
          </button>
        ) : activeTab === 'payslips_forms' ? (
          <button
            type="submit"
            form="brandingForm"
            disabled={savingBranding}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-admin-accent to-admin-accent2 text-white text-xs font-bold shadow-lg shadow-admin-accent/25 hover:opacity-95 transition-opacity flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <FiSave size={14} />
            {savingBranding ? 'Saving PDF Branding...' : 'Save PDF Branding Settings'}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSaveTemplate}
            disabled={savingTemplate}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-admin-accent to-admin-accent2 text-white text-xs font-bold shadow-lg shadow-admin-accent/25 hover:opacity-95 transition-opacity flex items-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <FiSave size={14} />
            {savingTemplate ? 'Saving Template...' : `Save "${isAddingNewRole ? newRoleInput || 'New Role' : selectedRole}" Template`}
          </button>
        )}
      </div>
    </div>
  );
};

export default OfferLetterSettingsModal;
