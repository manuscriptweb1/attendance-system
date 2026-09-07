import React, { useState, useEffect, useRef } from 'react';
import {
  FiX,
  FiFileText,
  FiSearch,
  FiCheckCircle,
  FiClock,
  FiLock,
  FiCalendar,
  FiEdit3,
  FiInfo
} from 'react-icons/fi';
import RelievingLetterDocument from './RelievingLetterDocument';

// eslint-disable-next-line no-control-regex
const cleanStr = (s) =>
  (s || '')
    .replace(/[\r\n\t\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatDateWithOrdinal = (dateStr) => {
  if (!dateStr) return '-';
  const getOrdinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  let d;
  if (typeof dateStr === 'string') {
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      d = new Date(dateStr);
    }
  } else {
    d = new Date(dateStr);
  }

  if (isNaN(d.getTime())) return String(dateStr);

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const dayOrdinal = getOrdinal(d.getDate());
  const monthStr = monthNames[d.getMonth()];
  const yearStr = d.getFullYear();

  return `${dayOrdinal} ${monthStr} ${yearStr}`;
};

export default function RelievingLetterFormModal({
  isOpen,
  onClose,
  onSave,
  activeEmployees = [],
  settings = null,
  initialData = null,
  isEditing = false
}) {
  const [activeTab, setActiveTab] = useState('form'); // 'form' | 'preview'
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Searchable Employee Selector state
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const employeeSearchRef = useRef(null);

  const defaultState = {
    employee_id: '',
    employee_name: '',
    employee_email: '',
    employee_address: '',
    job_title: 'Editorial Assistant',
    department: 'IT',
    issue_date: new Date().toISOString().split('T')[0],
    resignation_date: new Date().toISOString().split('T')[0],
    joining_date: '',
    relieving_date: new Date().toISOString().split('T')[0],
    paragraph_1: '',
    paragraph_2: '',
    signatory_name: settings?.signatory_name || 'Dr. Mueen Ahmed',
    signatory_designation: settings?.signatory_designation || 'Authorized Signatory'
  };

  const [formData, setFormData] = useState(defaultState);

  // Initialize data on open
  useEffect(() => {
    if (initialData) {
      setFormData({
        ...defaultState,
        ...initialData,
        issue_date: initialData.issue_date ? initialData.issue_date.split('T')[0] : new Date().toISOString().split('T')[0],
        resignation_date: initialData.resignation_date ? initialData.resignation_date.split('T')[0] : (initialData.issue_date ? initialData.issue_date.split('T')[0] : new Date().toISOString().split('T')[0]),
        joining_date: initialData.joining_date ? initialData.joining_date.split('T')[0] : '',
        relieving_date: initialData.relieving_date ? initialData.relieving_date.split('T')[0] : new Date().toISOString().split('T')[0],
        employee_name: initialData.employee_name_snapshot || initialData.employee_name || '',
        employee_id: initialData.employee_id_snapshot || initialData.employee_id || '',
        employee_email: initialData.employee_email_snapshot || initialData.employee_email || '',
        employee_address: initialData.employee_address_snapshot || initialData.employee_address || '',
        job_title: initialData.job_title_snapshot || initialData.job_title || 'Editorial Assistant',
        department: initialData.department_snapshot || initialData.department || 'General',
        paragraph_1: initialData.paragraph_1_snapshot || initialData.paragraph_1 || '',
        paragraph_2: initialData.paragraph_2_snapshot || initialData.paragraph_2 || '',
        signatory_name: initialData.signatory_name || settings?.signatory_name || 'Dr. Mueen Ahmed',
        signatory_designation: initialData.signatory_designation || settings?.signatory_designation || 'Authorized Signatory'
      });
    } else {
      setFormData({
        ...defaultState,
        signatory_name: settings?.signatory_name || 'Dr. Mueen Ahmed',
        signatory_designation: settings?.signatory_designation || 'Authorized Signatory'
      });
    }
    setActiveTab('form');
    setErrorMsg('');
    setEmployeeSearchQuery('');
    setIsEmployeeDropdownOpen(false);
  }, [isOpen, initialData, settings]);

  // Close employee search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        employeeSearchRef.current &&
        !employeeSearchRef.current.contains(event.target)
      ) {
        setIsEmployeeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  if (!isOpen) return null;

  // Handle employee selection
  const handleEmployeeSelect = (employeeId) => {
    const selectedEmp = activeEmployees.find(
      (e) => e.employee_id === employeeId || String(e.id) === String(employeeId)
    );
    if (!selectedEmp) {
      setFormData((prev) => ({ ...prev, employee_id: '' }));
      return;
    }

    const jobRole = cleanStr(selectedEmp.job_role || selectedEmp.designation || 'Editorial Assistant');
    const joiningDt = selectedEmp.joining_date ? selectedEmp.joining_date.split('T')[0] : '';
    const todayStr = new Date().toISOString().split('T')[0];
    const company = settings?.company_name || 'Manuscript TechnoMedia LLP';

    const resignationDtFormatted = formatDateWithOrdinal(todayStr);
    const joiningDtFormatted = formatDateWithOrdinal(joiningDt);
    const relievingDtFormatted = formatDateWithOrdinal(todayStr);

    const defaultP1 = `With reference to your resignation letter dated on ${resignationDtFormatted}, we hereby accept your resignation and agree to relieve you from the duties on ${relievingDtFormatted}. We confirm that you have worked in our company from ${joiningDtFormatted} as a ${jobRole}. During your employment with us we found you to be hardworking, diligent and honest in performing your duties.`;
    const defaultP2 = `The management would like to thank you for your service with ${company} and we wish you all the best in your future endeavours.`;

    setFormData((prev) => ({
      ...prev,
      employee_id: selectedEmp.employee_id,
      employee_name: cleanStr(selectedEmp.name),
      employee_email: cleanStr(selectedEmp.personal_email || ''),
      employee_address: cleanStr(selectedEmp.permanent_address || selectedEmp.current_address || ''),
      job_title: jobRole,
      department: cleanStr(selectedEmp.department_name || selectedEmp.department || 'General'),
      joining_date: joiningDt,
      resignation_date: todayStr,
      relieving_date: todayStr,
      paragraph_1: defaultP1,
      paragraph_2: defaultP2
    }));

    setErrorMsg('');
  };

  // Form Submit Handler
  const handleSubmit = async (statusToSet = 'Draft') => {
    setErrorMsg('');

    if (!formData.employee_id && !formData.employee_name) {
      setErrorMsg('Please select an employee or enter candidate name.');
      return;
    }

    if (!formData.employee_email || !formData.employee_email.trim()) {
      setErrorMsg('Candidate personal email is required. Please enter employee personal email.');
      return;
    }

    if (!formData.joining_date) {
      setErrorMsg('Joining date is required.');
      return;
    }

    if (!formData.relieving_date) {
      setErrorMsg('Relieving date is required.');
      return;
    }

    setSubmitting(true);
    try {
      await onSave({
        ...formData,
        status: statusToSet
      });
      onClose();
    } catch (err) {
      console.error('Save relieving letter error:', err);
      setErrorMsg(err.message || 'Failed to save relieving letter');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedEmp = activeEmployees.find(
    (e) => e.employee_id === formData.employee_id || String(e.id) === String(formData.employee_id)
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-admin-bg text-admin-text animate-fade-in overflow-hidden w-full h-full">
      {/* Modal Full-Screen Header */}
      <div className="flex items-center justify-between px-6 lg:px-8 py-4 border-b border-admin-border bg-admin-surface flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-purple-500 flex items-center justify-center font-bold text-lg shadow-sm">
            <FiFileText size={22} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-admin-text tracking-tight">
              {isEditing ? 'Edit Relieving Letter' : 'Create New Relieving Letter'}
            </h2>
            <p className="text-xs text-admin-muted mt-0.5">
              Generate official 1-page relieving letter with resignation acceptance, service duration, address & appreciation
            </p>
          </div>
        </div>

        {/* Form vs Live Preview Switcher & Close */}
        <div className="flex items-center gap-3">
          <div className="flex bg-admin-elevated border border-admin-border rounded-xl p-1 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('form')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                activeTab === 'form'
                  ? 'bg-admin-accent text-white shadow-sm'
                  : 'text-admin-secondary hover:text-admin-text'
              }`}
            >
              Edit Form
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-admin-accent text-white shadow-sm'
                  : 'text-admin-secondary hover:text-admin-text'
              }`}
            >
              Live A4 Preview
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-admin-muted hover:text-admin-text hover:bg-admin-elevated transition-colors cursor-pointer"
            title="Close"
          >
            <FiX size={20} />
          </button>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="mx-6 lg:mx-8 mt-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <FiInfo size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Modal Body Container */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 dark-scroll">
        <div className="max-w-5xl mx-auto w-full">
          {activeTab === 'form' ? (
            <div className="space-y-6">
              
              {/* SECTION 1: SEARCH & SELECT EMPLOYEE */}
              <div className="p-5 rounded-2xl bg-admin-surface border border-admin-border space-y-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-purple-500 text-white text-xs font-bold flex items-center justify-center">
                      1
                    </span>
                    <h3 className="text-sm font-bold text-admin-text">
                      Select Active Employee
                    </h3>
                  </div>
                  {formData.employee_id && (
                    <span className="text-[11px] font-semibold text-purple-400 flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 px-2.5 py-0.5 rounded-full">
                      <FiCheckCircle size={13} /> Selected: {formData.employee_id}
                    </span>
                  )}
                </div>

                <div className="space-y-2 relative" ref={employeeSearchRef}>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-admin-secondary">
                      Search Employee <span className="text-rose-500">*</span>
                    </label>
                    {formData.employee_id && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, employee_id: '' }));
                          setEmployeeSearchQuery('');
                          setIsEmployeeDropdownOpen(true);
                        }}
                        className="text-[11px] text-admin-muted hover:text-rose-400 transition-colors flex items-center gap-1 font-semibold cursor-pointer"
                      >
                        <FiX size={12} /> Clear Selection
                      </button>
                    )}
                  </div>

                  {/* Selected Employee Card */}
                  {selectedEmp && !isEmployeeDropdownOpen ? (
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-admin-bg border border-purple-500/30 shadow-sm animate-fade-in">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-500 font-bold text-xs flex items-center justify-center flex-shrink-0">
                          {(selectedEmp.name || 'EM')
                            .split(' ')
                            .map((n) => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-admin-text truncate">
                              {selectedEmp.name}
                            </p>
                            <span className="font-mono text-[10px] text-purple-400 font-bold px-2 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">
                              {selectedEmp.employee_id || selectedEmp.id}
                            </span>
                          </div>
                          <p className="text-[11px] text-admin-secondary mt-0.5 truncate">
                            {selectedEmp.job_role || selectedEmp.designation || 'No Role'} • {selectedEmp.department_name || selectedEmp.department || 'General'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsEmployeeDropdownOpen(true);
                          setEmployeeSearchQuery('');
                        }}
                        className="text-xs text-purple-400 hover:text-purple-300 font-bold px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all flex items-center gap-1.5 flex-shrink-0 cursor-pointer ml-2"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    /* Search Input Box */
                    <div className="relative">
                      <FiSearch
                        size={16}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-admin-muted pointer-events-none"
                      />
                      <input
                        type="text"
                        autoFocus={isEmployeeDropdownOpen}
                        placeholder="Type name, ID (e.g. MTM-01), role, or department..."
                        value={employeeSearchQuery}
                        onFocus={() => setIsEmployeeDropdownOpen(true)}
                        onChange={(e) => {
                          setEmployeeSearchQuery(e.target.value);
                          setIsEmployeeDropdownOpen(true);
                        }}
                        className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text placeholder:text-admin-muted font-medium focus:outline-none focus:border-purple-500 transition-colors"
                      />
                      {employeeSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setEmployeeSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-muted hover:text-admin-text p-1 cursor-pointer"
                        >
                          <FiX size={14} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Dropdown Results */}
                  {isEmployeeDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 z-40 max-h-60 overflow-y-auto rounded-xl bg-admin-surface border border-admin-border shadow-2xl dark-scroll p-1.5 space-y-1">
                      {(() => {
                        const filtered = activeEmployees.filter((emp) => {
                          if (!employeeSearchQuery.trim()) return true;
                          const q = employeeSearchQuery.toLowerCase().trim();
                          const nameMatch = (emp.name || '').toLowerCase().includes(q);
                          const idMatch = (emp.employee_id || String(emp.id) || '').toLowerCase().includes(q);
                          const deptMatch = (emp.department_name || emp.department || '').toLowerCase().includes(q);
                          const roleMatch = (emp.job_role || emp.designation || '').toLowerCase().includes(q);
                          return nameMatch || idMatch || deptMatch || roleMatch;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="p-4 text-center text-xs text-admin-muted">
                              No employees found matching &quot;{employeeSearchQuery}&quot;
                            </div>
                          );
                        }

                        return filtered.map((emp) => {
                          const isSelected = String(emp.employee_id) === String(formData.employee_id);
                          return (
                            <button
                              key={emp.id || emp.employee_id}
                              type="button"
                              onClick={() => {
                                handleEmployeeSelect(emp.employee_id);
                                setIsEmployeeDropdownOpen(false);
                                setEmployeeSearchQuery('');
                              }}
                              className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between group cursor-pointer ${
                                isSelected
                                  ? 'bg-purple-500/20 border border-purple-500/30'
                                  : 'hover:bg-admin-elevated border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-admin-bg border border-admin-border text-admin-text font-bold text-[11px] flex items-center justify-center flex-shrink-0 group-hover:border-purple-500/50">
                                  {(emp.name || 'EM')
                                    .split(' ')
                                    .map((n) => n[0])
                                    .slice(0, 2)
                                    .join('')
                                    .toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-bold text-admin-text truncate group-hover:text-purple-400 transition-colors">
                                      {emp.name}
                                    </p>
                                    <span className="font-mono text-[10px] text-admin-muted font-semibold px-1.5 py-0.5 rounded bg-admin-bg border border-admin-border">
                                      {emp.employee_id || emp.id}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-admin-secondary mt-0.5 truncate">
                                    {emp.job_role || emp.designation || 'No Role'} • {emp.department_name || emp.department || 'General'}
                                  </p>
                                </div>
                              </div>
                              {isSelected && (
                                <span className="text-purple-400 text-xs font-bold flex items-center gap-1 pl-2">
                                  <FiCheckCircle size={14} /> Selected
                                </span>
                              )}
                            </button>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION 2: CANDIDATE DETAILS & ADDRESSEE */}
              <div className="p-5 rounded-2xl bg-admin-surface border border-admin-border space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-admin-border pb-3">
                  <span className="w-6 h-6 rounded-lg bg-admin-accent text-white text-xs font-bold flex items-center justify-center">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-admin-text">
                    Candidate Details & Addressee Block
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Candidate Name */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-admin-secondary mb-1">
                      Candidate Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.employee_name}
                      onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                      required
                      placeholder="Employee Name"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text font-bold focus:outline-none focus:border-admin-accent"
                    />
                  </div>

                  {/* Candidate Personal Email */}
                  <div>
                    <label className="block text-xs font-bold text-admin-secondary mb-1">
                      Candidate Personal Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.employee_email}
                      onChange={(e) => setFormData({ ...formData, employee_email: e.target.value })}
                      required
                      placeholder="candidate.personal@gmail.com"
                      className={`w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border text-admin-text focus:outline-none ${
                        !formData.employee_email ? 'border-amber-500/60 focus:border-amber-500' : 'border-admin-border focus:border-admin-accent'
                      }`}
                    />
                    {!formData.employee_email && (
                      <p className="text-[11px] text-amber-500 font-semibold mt-1 flex items-center gap-1">
                        ⚠️ Personal email is missing from employee profile. Please enter personal email to proceed.
                      </p>
                    )}
                  </div>

                  {/* Job Title / Role */}
                  <div>
                    <label className="block text-xs font-bold text-admin-secondary mb-1">
                      Designation / Role <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.job_title}
                      onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                      required
                      placeholder="e.g. Editorial Assistant"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text font-bold focus:outline-none focus:border-admin-accent"
                    />
                  </div>

                  {/* Department */}
                  <div>
                    <label className="block text-xs font-bold text-admin-secondary mb-1">
                      Department
                    </label>
                    <input
                      type="text"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      placeholder="e.g. Publishing / IT"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>

                  {/* Letter Issue Date */}
                  <div>
                    <label className="block text-xs font-bold text-admin-secondary mb-1">
                      Letter Issue Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.issue_date}
                      onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>

                  {/* Candidate Address (Multiline) */}
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-admin-secondary mb-1">
                      Candidate Address (Shown under &quot;To:&quot; Block)
                    </label>
                    <textarea
                      rows={3}
                      value={formData.employee_address}
                      onChange={(e) => setFormData({ ...formData, employee_address: e.target.value })}
                      placeholder="Flat No, Building, Street, City, State - PIN"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent resize-none leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: RESIGNATION, JOINING & RELIEVING DATES */}
              <div className="p-5 rounded-2xl bg-admin-surface border border-admin-border space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-admin-border pb-3">
                  <span className="w-6 h-6 rounded-lg bg-admin-accent text-white text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <h3 className="text-sm font-bold text-admin-text">
                    Resignation, Joining & Relieving Dates
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Resignation Letter Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-admin-secondary flex items-center justify-between">
                      <span>Resignation Letter Date <span className="text-rose-500">*</span></span>
                    </label>
                    <input
                      type="date"
                      value={formData.resignation_date}
                      onChange={(e) => setFormData({ ...formData, resignation_date: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text font-bold focus:outline-none focus:border-admin-accent"
                    />
                    <p className="text-[10px] text-admin-muted">
                      Date mentioned in employee resignation letter.
                    </p>
                  </div>

                  {/* Joining Date (LOCKED / OFFICIAL RECORD) */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-admin-secondary flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        Joining Date <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] text-amber-500 dark:text-amber-400 font-semibold flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        <FiLock size={10} /> Locked (Official Record)
                      </span>
                    </label>
                    <input
                      type="date"
                      value={formData.joining_date}
                      readOnly
                      disabled
                      className="w-full px-3 py-2 text-xs rounded-xl bg-admin-elevated/80 border border-admin-border text-admin-text font-bold opacity-80 cursor-not-allowed"
                    />
                    <p className="text-[10px] text-admin-muted">
                      Joining date is fixed from official employee record and cannot be edited.
                    </p>
                  </div>

                  {/* Relieving Date */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-admin-secondary flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        Relieving Date <span className="text-rose-500">*</span>
                      </span>
                      <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-semibold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        <FiCalendar size={10} /> Default: Today
                      </span>
                    </label>
                    <input
                      type="date"
                      value={formData.relieving_date}
                      onChange={(e) => setFormData({ ...formData, relieving_date: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text font-bold focus:outline-none focus:border-admin-accent"
                    />
                    <p className="text-[10px] text-admin-muted">
                      Official last working day relieved from duties.
                    </p>
                  </div>
                </div>
              </div>

              {/* SECTION 4: EDITABLE PARAGRAPHS */}
              <div className="p-5 rounded-2xl bg-admin-surface border border-admin-border space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-admin-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-admin-accent text-white text-xs font-bold flex items-center justify-center">
                      4
                    </span>
                    <h3 className="text-sm font-bold text-admin-text">
                      Relieving Letter Paragraphs
                    </h3>
                  </div>
                  <span className="text-[11px] text-admin-muted">
                    Fully editable letter content
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Paragraph 1 */}
                  <div className="p-4 rounded-xl bg-admin-elevated/40 border border-admin-border space-y-2">
                    <label className="text-xs font-bold text-admin-text flex items-center gap-1.5">
                      <FiEdit3 size={14} /> Paragraph 1: Acceptance & Service Confirmation
                    </label>
                    <textarea
                      rows={4}
                      value={formData.paragraph_1}
                      onChange={(e) => setFormData({ ...formData, paragraph_1: e.target.value })}
                      placeholder="With reference to your resignation letter dated on..."
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent leading-relaxed resize-none"
                    />
                  </div>

                  {/* Paragraph 2 */}
                  <div className="p-4 rounded-xl bg-admin-elevated/40 border border-admin-border space-y-2">
                    <label className="text-xs font-bold text-admin-text flex items-center gap-1.5">
                      <FiEdit3 size={14} /> Paragraph 2: Management Appreciation & Future Wishes
                    </label>
                    <textarea
                      rows={2}
                      value={formData.paragraph_2}
                      onChange={(e) => setFormData({ ...formData, paragraph_2: e.target.value })}
                      placeholder="The management would like to thank you for your service..."
                      className="w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent leading-relaxed resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: SIGNATORY DETAILS */}
              <div className="p-5 rounded-2xl bg-admin-surface border border-admin-border space-y-4 shadow-sm">
                <div className="flex items-center gap-2 border-b border-admin-border pb-3">
                  <span className="w-6 h-6 rounded-lg bg-admin-accent text-white text-xs font-bold flex items-center justify-center">
                    5
                  </span>
                  <h3 className="text-sm font-bold text-admin-text">
                    Authorized Signatory Details
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-admin-secondary mb-1">
                      Signatory Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.signatory_name}
                      onChange={(e) => setFormData({ ...formData, signatory_name: e.target.value })}
                      required
                      placeholder="e.g. Dr. Mueen Ahmed"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text font-bold focus:outline-none focus:border-admin-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-admin-secondary mb-1">
                      Signatory Designation
                    </label>
                    <input
                      type="text"
                      value={formData.signatory_designation}
                      onChange={(e) => setFormData({ ...formData, signatory_designation: e.target.value })}
                      placeholder="e.g. Authorized Signatory"
                      className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                    />
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* LIVE A4 PREVIEW TAB */
            <div className="flex justify-center p-4 bg-slate-900/40 rounded-2xl border border-admin-border overflow-x-auto">
              <RelievingLetterDocument data={formData} settings={settings} />
            </div>
          )}
        </div>
      </div>

      {/* Modal Bottom Footer Action Bar */}
      <div className="flex items-center justify-between px-6 lg:px-8 py-4 border-t border-admin-border bg-admin-surface flex-shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors cursor-pointer"
        >
          Cancel
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit('Draft')}
            className="px-4 py-2.5 rounded-xl bg-admin-elevated hover:bg-admin-border border border-admin-border text-admin-text text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
          >
            <FiClock size={14} />
            Save as Draft
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit('Generated')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-extrabold shadow-lg shadow-purple-500/25 hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer"
          >
            <FiCheckCircle size={15} />
            {submitting ? 'Generating...' : 'Generate Final Relieving Letter'}
          </button>
        </div>
      </div>

    </div>
  );
}
