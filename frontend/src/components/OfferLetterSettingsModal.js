import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiUpload, FiTrash2, FiPlus, FiSave, FiCheck, FiRefreshCw, FiImage, FiList, FiInfo } from 'react-icons/fi';
import {
  getOfferLetterSettings,
  updateOfferLetterSettings,
  resetOfferLetterLogo,
  getRoleTemplates,
  saveRoleTemplate,
  deleteRoleTemplate
} from '../services/api';

const OfferLetterSettingsModal = ({ isOpen, onClose, onSettingsUpdated }) => {
  const [activeTab, setActiveTab] = useState('branding'); // 'branding' | 'templates'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Tab 1: Branding & Footer Form
  const [settings, setSettings] = useState({
    company_name: 'Manuscript TechnoMedia LLP',
    logo_path: null,
    logo_data_url: null,
    logo_width: 160,
    logo_height: 60,
    header_address: 'Reg. Office. No. 22, 3rd Cross,\nVivekananda Nagar, Bangalore-33,\nKarnataka, India',
    header_phone: '91-9686980760',
    header_email: 'connect@mstechnomedia.com',
    footer_line_1: 'Manuscript Technomedia LLP,',
    footer_line_2: 'Reg. New No 40, 22, 3rd Cross Rd, Jaibharath Nagar, Vivekananda Nagar, Maruthi Sevanagar, Bangalore-33, Karnataka, India.',
    footer_line_3: 'https://mstechnomedia.com | contact@mstechnomedia.com | +91-9686980760 | GST: 29ACBFM2283L1ZV',
    footer_accent_color: '#E11D48',
    signatory_name: 'Dr. Mueen Ahmed KK',
    signatory_designation: 'Designated Partner',
    signatory_email: 'contact@mstechnomedia.com'
  });
  const [logoBase64, setLogoBase64] = useState(null);

  // Tab 2: Role Templates
  const [templates, setTemplates] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [newRoleInput, setNewRoleInput] = useState('');
  const [isAddingNewRole, setIsAddingNewRole] = useState(false);
  const [categories, setCategories] = useState([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [settingsRes, templatesRes] = await Promise.all([
        getOfferLetterSettings(),
        getRoleTemplates()
      ]);

      if (settingsRes.data?.settings) {
        setSettings(settingsRes.data.settings);
      }

      if (templatesRes.data?.templates) {
        const tmps = templatesRes.data.templates;
        setTemplates(tmps);
        if (tmps.length > 0 && !selectedRole) {
          setSelectedRole(tmps[0].job_role);
          setCategories(Array.isArray(tmps[0].categories) ? tmps[0].categories : []);
        }
      }
    } catch (err) {
      console.error('Failed to load offer letter settings:', err);
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

  const handleRoleSelect = (roleName) => {
    setSelectedRole(roleName);
    const tmpl = templates.find((t) => t.job_role === roleName);
    if (tmpl) {
      setCategories(Array.isArray(tmpl.categories) ? tmpl.categories : []);
    } else {
      setCategories([]);
    }
  };

  const handleLogoUpload = (e) => {
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
      setLogoBase64(reader.result);
      setSettings((prev) => ({ ...prev, logo_data_url: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = async () => {
    try {
      setSaving(true);
      const res = await resetOfferLetterLogo();
      if (res.data?.settings) {
        setSettings(res.data.settings);
        setLogoBase64(null);
        setSuccessMsg('Logo reset to default successfully');
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      setErrorMsg('Failed to reset logo');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranding = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const payload = {
        ...settings,
        logo_base64: logoBase64
      };
      const res = await updateOfferLetterSettings(payload);
      if (res.data?.settings) {
        setSettings(res.data.settings);
        setLogoBase64(null);
        setSuccessMsg('Offer letter branding & footer settings saved successfully!');
        if (onSettingsUpdated) onSettingsUpdated(res.data.settings);
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Failed to save offer letter settings:', err);
      setErrorMsg('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Category & Bullet operations for Tab 2
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

    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const res = await saveRoleTemplate({
        job_role: roleToSave,
        categories
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
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async () => {
    const tmpl = templates.find((t) => t.job_role === selectedRole);
    if (!tmpl) return;

    if (!window.confirm(`Are you sure you want to delete the template for "${selectedRole}"?`)) {
      return;
    }

    setSaving(true);
    try {
      await deleteRoleTemplate(tmpl.id);
      setSuccessMsg(`Template for "${selectedRole}" deleted.`);
      loadData();
      setSelectedRole('');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setErrorMsg('Failed to delete template');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col bg-admin-surface border border-admin-border rounded-2xl shadow-2xl overflow-hidden text-admin-text animate-fade-in my-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-admin-border bg-admin-bg flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-admin-accent/15 text-admin-accent flex items-center justify-center font-bold">
              ⚙️
            </div>
            <div>
              <h2 className="text-base font-bold text-admin-text">Offer Letter Settings & Master Templates</h2>
              <p className="text-xs text-admin-muted">
                Dedicated branding, dynamic footer lines & job responsibilities
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-admin-muted hover:text-admin-text hover:bg-admin-elevated transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-admin-border bg-admin-bg/60 flex-shrink-0">
          <button
            onClick={() => setActiveTab('branding')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'branding'
                ? 'border-admin-accent text-admin-accent bg-admin-surface'
                : 'border-transparent text-admin-secondary hover:text-admin-text hover:bg-admin-elevated/40'
            }`}
          >
            <FiImage size={15} />
            Branding, Header & Footer
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition-all border-b-2 ${
              activeTab === 'templates'
                ? 'border-admin-accent text-admin-accent bg-admin-surface'
                : 'border-transparent text-admin-secondary hover:text-admin-text hover:bg-admin-elevated/40'
            }`}
          >
            <FiList size={15} />
            Job Role Responsibilities
          </button>
        </div>

        {/* Notifications */}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <FiCheck size={16} />
            {successMsg}
          </div>
        )}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <FiInfo size={16} />
            {errorMsg}
          </div>
        )}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 dark-scroll">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-3 border-admin-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-admin-muted">Loading settings...</p>
            </div>
          ) : activeTab === 'branding' ? (
            /* TAB 1: BRANDING & FOOTER FORM */
            <form id="brandingForm" onSubmit={handleSaveBranding} className="space-y-6">
              {/* Logo Section */}
              <div className="p-4 rounded-xl bg-admin-elevated/40 border border-admin-border space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-admin-text">Offer Letter Company Logo</h3>
                    <p className="text-xs text-admin-muted">
                      Configured logo appears top-right on all pages of generated offer letters.
                    </p>
                  </div>
                  {settings.logo_path && (
                    <button
                      type="button"
                      onClick={handleResetLogo}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors flex items-center gap-1.5"
                    >
                      <FiRefreshCw size={13} />
                      Reset to Default
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-5">
                  <div className="w-48 h-20 rounded-xl border border-dashed border-admin-border bg-admin-bg flex items-center justify-center p-2 relative overflow-hidden flex-shrink-0">
                    {settings.logo_data_url || settings.logo_path ? (
                      <img
                        src={settings.logo_data_url || settings.logo_path}
                        alt="Offer Letter Logo"
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
                        onChange={handleLogoUpload}
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
                  <label className="text-xs font-semibold text-admin-secondary">Company Name</label>
                  <input
                    type="text"
                    value={settings.company_name}
                    onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
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
                    value={settings.header_address}
                    onChange={(e) => setSettings({ ...settings, header_address: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent resize-none font-mono text-[11px]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-admin-secondary">Header Phone</label>
                  <input
                    type="text"
                    value={settings.header_phone}
                    onChange={(e) => setSettings({ ...settings, header_phone: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-admin-secondary">Header Email</label>
                  <input
                    type="email"
                    value={settings.header_email}
                    onChange={(e) => setSettings({ ...settings, header_email: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                  />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-semibold text-admin-secondary">Header Website</label>
                  <input
                    type="text"
                    value={settings.header_website}
                    onChange={(e) => setSettings({ ...settings, header_website: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                  />
                </div>
              </div>

              {/* Dynamic Footer Section */}
              <div className="p-4 rounded-xl bg-admin-elevated/40 border border-admin-border space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-admin-text">Offer Letter Dynamic Footer</h3>
                  <p className="text-xs text-admin-muted">
                    This 3-line footer with accent line renders at the bottom of all offer letter pages.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-admin-secondary">
                      Footer Line 1 (Company Name)
                    </label>
                    <input
                      type="text"
                      value={settings.footer_line_1}
                      onChange={(e) => setSettings({ ...settings, footer_line_1: e.target.value })}
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
                      value={settings.footer_line_2}
                      onChange={(e) => setSettings({ ...settings, footer_line_2: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-admin-secondary">
                      Footer Line 3 (Website, Email, Phone, GST)
                    </label>
                    <input
                      type="text"
                      value={settings.footer_line_3 || ''}
                      onChange={(e) => setSettings({ ...settings, footer_line_3: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>

                  {/* Live Footer Preview Box */}
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-1">
                    <p className="text-[10px] uppercase font-bold text-slate-400">Live Footer Preview</p>
                    <div className="w-full h-0.5 bg-rose-600 my-1 rounded-full" />
                    <p className="text-[11px] font-bold text-slate-900 dark:text-slate-100">
                      {settings.footer_line_1 || 'Manuscript Technomedia LLP'}
                    </p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300">
                      {settings.footer_line_2 || 'Reg. Office Address'}
                    </p>
                    <p className="text-[10px] text-blue-600 dark:text-blue-400">
                      {settings.footer_line_3 || 'https://mstechnomedia.com | contact@mstechnomedia.com'}
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
                      value={settings.signatory_name}
                      onChange={(e) => setSettings({ ...settings, signatory_name: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-admin-secondary">Designation</label>
                    <input
                      type="text"
                      value={settings.signatory_designation}
                      onChange={(e) => setSettings({ ...settings, signatory_designation: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-admin-secondary">Signatory Email</label>
                    <input
                      type="email"
                      value={settings.signatory_email}
                      onChange={(e) => setSettings({ ...settings, signatory_email: e.target.value })}
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>
                </div>
              </div>
            </form>
          ) : (
            /* TAB 2: ROLE RESPONSIBILITIES TEMPLATES */
            <div className="space-y-5">
              {/* Role Selection & Add New Bar */}
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
                        placeholder="e.g. PHP Developer, Marketing Executive"
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
                          disabled={saving}
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

              {/* Structured Responsibilities Categories */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-admin-secondary">
                    Responsibility Sections & Bullet Points ({categories.length} Sections)
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

        {/* Footer Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-admin-border bg-admin-bg flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors"
          >
            Close
          </button>

          {activeTab === 'branding' ? (
            <button
              type="submit"
              form="brandingForm"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-admin-accent to-admin-accent2 text-white text-xs font-bold shadow-lg shadow-admin-accent/25 hover:opacity-95 transition-opacity flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <FiSave size={14} />
              {saving ? 'Saving Branding...' : 'Save Branding & Footer'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-admin-accent to-admin-accent2 text-white text-xs font-bold shadow-lg shadow-admin-accent/25 hover:opacity-95 transition-opacity flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <FiSave size={14} />
              {saving ? 'Saving Template...' : `Save "${isAddingNewRole ? newRoleInput || 'New Role' : selectedRole}" Template`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OfferLetterSettingsModal;
