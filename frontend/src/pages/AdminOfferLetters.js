import React, { useState, useEffect, useRef } from 'react';
import Sidebar from '../components/Sidebar';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import { Spinner } from '../components/Loader';
import {
  getOfferLetters,
  createOfferLetter,
  updateOfferLetter,
  generateOfferLetter,
  deleteOfferLetter,
  downloadOfferLetterPdf,
  previewOfferLetterPdf,
  getOfferLetterSettings,
  getRoleTemplates,
  getAllEmployees,
  getExperienceLetters,
  createExperienceLetter,
  updateExperienceLetter,
  generateExperienceLetter,
  deleteExperienceLetter,
  downloadExperienceLetterPdf,
  previewExperienceLetterPdf,
  getRelievingLetters,
  createRelievingLetter,
  updateRelievingLetter,
  generateRelievingLetter,
  deleteRelievingLetter,
  downloadRelievingLetterPdf,
  previewRelievingLetterPdf
} from '../services/api';
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiSearch,
  FiEye,
  FiDownload,
  FiPrinter,
  FiFileText,
  FiSettings,
  FiCheckCircle,
  FiClock,
  FiX,
  FiAward,
  FiCheckSquare
} from 'react-icons/fi';
import OfferLetterSettingsModal from '../components/OfferLetterSettingsModal';
import OfferLetterPreviewModal from '../components/OfferLetterPreviewModal';
import OfferLetterDocument from '../components/OfferLetterDocument';
import ExperienceLetterDocument from '../components/ExperienceLetterDocument';
import RelievingLetterDocument from '../components/RelievingLetterDocument';
import LetterTypeSelectModal from '../components/LetterTypeSelectModal';
import ExperienceLetterFormModal from '../components/ExperienceLetterFormModal';
import ExperienceLetterPreviewModal from '../components/ExperienceLetterPreviewModal';
import RelievingLetterFormModal from '../components/RelievingLetterFormModal';
import RelievingLetterPreviewModal from '../components/RelievingLetterPreviewModal';
import { exportOfferLetterToPdf } from '../utils/offerLetterPdfExport';

const formatINR = (value) => {
  const num = Number(value || 0);
  return `₹ ${Math.round(num).toLocaleString('en-IN')}`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  if (typeof dateStr === 'string') {
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
        const d = new Date(year, month, day);
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      }
    }
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const AdminOfferLetters = () => {
  // Active Main Tab: 'offer' | 'experience' | 'relieving'
  const [activeMainTab, setActiveMainTab] = useState('offer');

  // Offer Letters State
  const [offerLetters, setOfferLetters] = useState([]);
  const [selectedOfferIds, setSelectedOfferIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  // Experience Letters State
  const [experienceLetters, setExperienceLetters] = useState([]);
  const [selectedExpIds, setSelectedExpIds] = useState([]);
  const [searchTermExp, setSearchTermExp] = useState('');
  const [statusFilterExp, setStatusFilterExp] = useState('All');

  // Relieving Letters State
  const [relievingLetters, setRelievingLetters] = useState([]);
  const [selectedRelIds, setSelectedRelIds] = useState([]);
  const [searchTermRel, setSearchTermRel] = useState('');
  const [statusFilterRel, setStatusFilterRel] = useState('All');

  // Shared Data
  const [activeEmployees, setActiveEmployees] = useState([]);
  const [roleTemplates, setRoleTemplates] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showLetterTypeModal, setShowLetterTypeModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewOfferData, setPreviewOfferData] = useState(null);

  // Experience Letter Modals State
  const [showExpFormModal, setShowExpFormModal] = useState(false);
  const [showExpPreviewModal, setShowExpPreviewModal] = useState(false);
  const [previewExpData, setPreviewExpData] = useState(null);
  const [isEditingExp, setIsEditingExp] = useState(false);
  const [editingExpId, setEditingExpId] = useState(null);
  const [initialExpFormData, setInitialExpFormData] = useState(null);

  // Relieving Letter Modals State
  const [showRelFormModal, setShowRelFormModal] = useState(false);
  const [showRelPreviewModal, setShowRelPreviewModal] = useState(false);
  const [previewRelData, setPreviewRelData] = useState(null);
  const [isEditingRel, setIsEditingRel] = useState(false);
  const [editingRelId, setEditingRelId] = useState(null);
  const [initialRelFormData, setInitialRelFormData] = useState(null);

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'danger'
  });
  const [alertDialog, setAlertDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'success'
  });

  // Offer Form State
  const [isEditing, setIsEditing] = useState(false);
  const [editingOfferId, setEditingOfferId] = useState(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState('form'); // 'form' | 'preview'
  const [exportOfferData, setExportOfferData] = useState(null);
  const [exportExpData, setExportExpData] = useState(null);
  const [exportRelData, setExportRelData] = useState(null);
  const [downloadChoiceModal, setDownloadChoiceModal] = useState({
    isOpen: false,
    type: null, // 'offer' | 'experience' | 'relieving'
    row: null
  });
  const [letterDownloadLoading, setLetterDownloadLoading] = useState(null);
  const rowExportRef = useRef(null);
  const rowExpExportRef = useRef(null);
  const rowRelExportRef = useRef(null);

  const initialFormState = {
    employee_id: '',
    salutation: '',
    employee_name: '',
    employee_email: '',
    employee_phone: '',
    employee_address: '',
    job_title: 'Web Developer',
    department: 'IT',
    reporting_to: 'Dr. Mueen Ahmed KK, [Managing Director]',
    work_location: 'Office Premises',
    employment_type: 'Full-time',
    work_hours: '9:30 AM – 6:30 PM, Monday–Saturday',
    probation_period: "3 months, extendable at the company's discretion.",
    offer_date: new Date().toISOString().split('T')[0],
    interview_date: new Date().toISOString().split('T')[0],
    joining_date: '',
    acceptance_deadline_date: '',
    monthly_salary: '',
    variable_percentage: 5,
    annual_paid_leaves: 12,
    pf_applicable: 'Not Applicable',
    esi_applicable: 'Not Applicable',
    gratuity_applicable: 'Not Applicable',
    other_allowances: 'Not Applicable',
    responsibilities: [],
    signatory_name: 'Dr. Mueen Ahmed KK',
    signatory_designation: 'Designated Partner',
    signatory_email: 'contact@mstechnomedia.com'
  };

  const [formData, setFormData] = useState(initialFormState);
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState('');
  const [isEmployeeDropdownOpen, setIsEmployeeDropdownOpen] = useState(false);
  const employeeSearchRef = useRef(null);

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

  // Load Initial Data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [offersRes, expRes, relRes, employeesRes, templatesRes, settingsRes] = await Promise.all([
        getOfferLetters(),
        getExperienceLetters(),
        getRelievingLetters(),
        getAllEmployees(),
        getRoleTemplates(),
        getOfferLetterSettings()
      ]);

      if (offersRes.data?.offerLetters) {
        setOfferLetters(offersRes.data.offerLetters);
      }

      if (expRes.data?.experienceLetters) {
        setExperienceLetters(expRes.data.experienceLetters);
      } else if (expRes.data?.letters) {
        setExperienceLetters(expRes.data.letters);
      }

      if (relRes.data?.relievingLetters) {
        setRelievingLetters(relRes.data.relievingLetters);
      } else if (relRes.data?.letters) {
        setRelievingLetters(relRes.data.letters);
      }

      if (employeesRes.data?.employees) {
        // Filter active employees only
        const active = employeesRes.data.employees.filter(
          (e) => String(e.status).toLowerCase() === 'active'
        );
        setActiveEmployees(active);
      }

      if (templatesRes.data?.templates) {
        setRoleTemplates(templatesRes.data.templates);
      }

      if (settingsRes.data?.settings) {
        setSettings(settingsRes.data.settings);
      }
    } catch (err) {
      console.error('Failed to load letter data:', err);
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to load official letter records.',
        type: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  // Filtered Offer Letters
  const filteredOffers = offerLetters.filter((o) => {
    const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
    const q = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !q ||
      o.offer_number?.toLowerCase().includes(q) ||
      o.employee_name_snapshot?.toLowerCase().includes(q) ||
      o.employee_id_snapshot?.toLowerCase().includes(q) ||
      o.job_title_snapshot?.toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  // Filtered Experience Letters
  const filteredExperiences = experienceLetters.filter((exp) => {
    const matchesStatus = statusFilterExp === 'All' || exp.status === statusFilterExp;
    const q = searchTermExp.toLowerCase().trim();
    const matchesSearch =
      !q ||
      exp.letter_number?.toLowerCase().includes(q) ||
      exp.employee_name_snapshot?.toLowerCase().includes(q) ||
      exp.employee_id_snapshot?.toLowerCase().includes(q) ||
      exp.job_title_snapshot?.toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  // Filtered Relieving Letters
  const filteredRelievings = relievingLetters.filter((rel) => {
    const matchesStatus = statusFilterRel === 'All' || rel.status === statusFilterRel;
    const q = searchTermRel.toLowerCase().trim();
    const matchesSearch =
      !q ||
      rel.letter_number?.toLowerCase().includes(q) ||
      rel.employee_name_snapshot?.toLowerCase().includes(q) ||
      rel.employee_id_snapshot?.toLowerCase().includes(q) ||
      rel.job_title_snapshot?.toLowerCase().includes(q);

    return matchesStatus && matchesSearch;
  });

  // Calculate Metrics
  const totalOffersCount = offerLetters.length;
  const generatedOffersCount = offerLetters.filter((o) => o.status === 'Generated').length;
  const draftOffersCount = offerLetters.filter((o) => o.status === 'Draft').length;

  const totalExpCount = experienceLetters.length;
  const generatedExpCount = experienceLetters.filter((e) => e.status === 'Generated').length;
  const draftExpCount = experienceLetters.filter((e) => e.status === 'Draft').length;

  const totalRelCount = relievingLetters.length;
  const generatedRelCount = relievingLetters.filter((r) => r.status === 'Generated').length;
  const draftRelCount = relievingLetters.filter((r) => r.status === 'Draft').length;

  const cleanStr = (s) =>
    (s || '')
      // eslint-disable-next-line no-control-regex
      .replace(/[\r\n\t\x00-\x1F\x7F-\x9F\u200B-\u200D\uFEFF]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const getTemplateForRole = (roleName) => {
    const cleanR = cleanStr(roleName).toLowerCase();
    if (!cleanR) return null;

    let tmpl = roleTemplates.find(
      (t) => cleanStr(t.job_role).toLowerCase() === cleanR
    );
    if (tmpl) return tmpl;

    tmpl = roleTemplates.find(
      (t) =>
        cleanStr(t.job_role).toLowerCase().replace(/\s+/g, '') ===
        cleanR.replace(/\s+/g, '')
    );
    if (tmpl) return tmpl;

    tmpl = roleTemplates.find((t) => {
      const tClean = cleanStr(t.job_role).toLowerCase();
      return cleanR.includes(tClean) || tClean.includes(cleanR);
    });

    return tmpl || null;
  };

  // Handle Employee Selection and Auto-fill for Offer Letter
  const handleEmployeeChange = (employeeId) => {
    const selectedEmp = activeEmployees.find((e) => e.employee_id === employeeId);
    if (!selectedEmp) {
      setFormData((prev) => ({ ...prev, employee_id: '' }));
      return;
    }

    const jobRole = cleanStr(selectedEmp.job_role || 'Web Developer');
    const tmpl = getTemplateForRole(jobRole);

    let defaultCategories = [];
    if (tmpl && Array.isArray(tmpl.categories) && tmpl.categories.length > 0) {
      defaultCategories = JSON.parse(JSON.stringify(tmpl.categories));
    } else {
      defaultCategories = [
        {
          category: '1. Core Responsibilities',
          items: [
            'Perform designated duties with high professional quality and accuracy.',
            'Collaborate with team members to meet project deadlines.',
            'Adhere to company guidelines, processes, and standard operating procedures.'
          ]
        }
      ];
    }

    const salaryVal = selectedEmp.monthly_salary || selectedEmp.base_salary || '';

    setFormData((prev) => ({
      ...prev,
      employee_id: selectedEmp.employee_id,
      employee_name: cleanStr(selectedEmp.name),
      employee_email: cleanStr(selectedEmp.personal_email || selectedEmp.email || ''),
      employee_phone: cleanStr(selectedEmp.mobile || ''),
      employee_address: cleanStr(selectedEmp.permanent_address || ''),
      job_title: jobRole,
      department: cleanStr(selectedEmp.department_name || 'General'),
      monthly_salary: salaryVal ? String(salaryVal) : prev.monthly_salary,
      responsibilities: defaultCategories,
      signatory_name: settings?.signatory_name || prev.signatory_name,
      signatory_designation: settings?.signatory_designation || prev.signatory_designation,
      signatory_email: settings?.signatory_email || prev.signatory_email
    }));
  };

  // Main Add / Create Letter Flow
  const handleCreateLetterClick = () => {
    setShowLetterTypeModal(true);
  };

  const handleSelectLetterType = (type) => {
    setShowLetterTypeModal(false);
    if (type === 'offer') {
      setActiveMainTab('offer');
      handleOpenCreateModal();
    } else if (type === 'experience') {
      setActiveMainTab('experience');
      handleOpenCreateExpModal();
    } else if (type === 'relieving') {
      setActiveMainTab('relieving');
      handleOpenCreateRelModal();
    }
  };

  // Open Offer Letter Create Modal
  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setEditingOfferId(null);
    setEmployeeSearchQuery('');
    setIsEmployeeDropdownOpen(false);
    setFormData({
      ...initialFormState,
      salutation: '',
      signatory_name: settings?.signatory_name || 'Dr. Mueen Ahmed KK',
      signatory_designation: settings?.signatory_designation || 'Designated Partner',
      signatory_email: settings?.signatory_email || 'contact@mstechnomedia.com'
    });
    setActiveFormTab('form');
    setShowFormModal(true);
  };

  // Open Offer Letter Edit Modal
  const handleOpenEditModal = (offer) => {
    setIsEditing(true);
    setEditingOfferId(offer.id);
    setEmployeeSearchQuery('');
    setIsEmployeeDropdownOpen(false);

    let resps = offer.responsibilities_snapshot || [];
    if (typeof resps === 'string') {
      try {
        resps = JSON.parse(resps);
      } catch (e) {
        resps = [];
      }
    }

    setFormData({
      employee_id: offer.employee_id || '',
      salutation: offer.salutation || 'Mr.',
      employee_name: offer.employee_name_snapshot || '',
      employee_email: offer.employee_email_snapshot || '',
      employee_phone: offer.employee_phone_snapshot || '',
      employee_address: offer.employee_address_snapshot || '',
      job_title: offer.job_title_snapshot || '',
      department: offer.department_snapshot || '',
      reporting_to: offer.reporting_to || 'Dr. Mueen Ahmed KK, [Managing Director]',
      work_location: offer.work_location || 'Office Premises',
      employment_type: offer.employment_type || 'Full-time',
      work_hours: offer.work_hours || '9:30 AM – 6:30 PM, Monday–Saturday',
      probation_period: offer.probation_period || "3 months, extendable at the company's discretion.",
      offer_date: offer.offer_date ? offer.offer_date.split('T')[0] : new Date().toISOString().split('T')[0],
      interview_date: offer.interview_date ? offer.interview_date.split('T')[0] : '',
      joining_date: offer.joining_date ? offer.joining_date.split('T')[0] : '',
      acceptance_deadline_date: offer.acceptance_deadline_date ? offer.acceptance_deadline_date.split('T')[0] : '',
      monthly_salary: offer.monthly_salary || 0,
      variable_percentage: offer.variable_percentage || 5,
      annual_paid_leaves: offer.annual_paid_leaves !== undefined ? offer.annual_paid_leaves : 12,
      pf_applicable: offer.pf_applicable || 'Not Applicable',
      esi_applicable: offer.esi_applicable || 'Not Applicable',
      gratuity_applicable: offer.gratuity_applicable || 'Not Applicable',
      other_allowances: offer.other_allowances || 'Not Applicable',
      responsibilities: resps,
      signatory_name: offer.signatory_name || settings?.signatory_name || '',
      signatory_designation: offer.signatory_designation || settings?.signatory_designation || '',
      signatory_email: offer.signatory_email || settings?.signatory_email || ''
    });

    setActiveFormTab('form');
    setShowFormModal(true);
  };

  // Open Experience Letter Create Modal
  const handleOpenCreateExpModal = () => {
    setIsEditingExp(false);
    setEditingExpId(null);
    setInitialExpFormData(null);
    setShowExpFormModal(true);
  };

  // Open Experience Letter Edit Modal
  const handleOpenEditExpModal = (exp) => {
    setIsEditingExp(true);
    setEditingExpId(exp.id);
    setInitialExpFormData(exp);
    setShowExpFormModal(true);
  };

  // Open Relieving Letter Create Modal
  const handleOpenCreateRelModal = () => {
    setIsEditingRel(false);
    setEditingRelId(null);
    setInitialRelFormData(null);
    setShowRelFormModal(true);
  };

  // Open Relieving Letter Edit Modal
  const handleOpenEditRelModal = (rel) => {
    setIsEditingRel(true);
    setEditingRelId(rel.id);
    setInitialRelFormData(rel);
    setShowRelFormModal(true);
  };

  // Form Responsibility category and bullet edits
  const handleAddResponsibilityCategory = () => {
    const nextNum = (formData.responsibilities || []).length + 1;
    setFormData((prev) => ({
      ...prev,
      responsibilities: [
        ...(prev.responsibilities || []),
        { category: `${nextNum}. New Section Title`, items: ['New responsibility item.'] }
      ]
    }));
  };

  const handleUpdateResponsibilityCategory = (catIdx, title) => {
    const updated = [...(formData.responsibilities || [])];
    updated[catIdx].category = title;
    setFormData((prev) => ({ ...prev, responsibilities: updated }));
  };

  const handleRemoveResponsibilityCategory = (catIdx) => {
    const updated = (formData.responsibilities || []).filter((_, i) => i !== catIdx);
    setFormData((prev) => ({ ...prev, responsibilities: updated }));
  };

  const handleAddBulletToCategory = (catIdx) => {
    const updated = [...(formData.responsibilities || [])];
    if (!Array.isArray(updated[catIdx].items)) updated[catIdx].items = [];
    updated[catIdx].items.push('New responsibility item.');
    setFormData((prev) => ({ ...prev, responsibilities: updated }));
  };

  const handleUpdateBullet = (catIdx, bIdx, val) => {
    const updated = [...(formData.responsibilities || [])];
    updated[catIdx].items[bIdx] = val;
    setFormData((prev) => ({ ...prev, responsibilities: updated }));
  };

  const handleRemoveBullet = (catIdx, bIdx) => {
    const updated = [...(formData.responsibilities || [])];
    updated[catIdx].items = updated[catIdx].items.filter((_, i) => i !== bIdx);
    setFormData((prev) => ({ ...prev, responsibilities: updated }));
  };

  // Submit Offer Letter Form (Draft vs Generated)
  const handleSubmitOffer = async (targetStatus = 'Draft') => {
    if (!formData.employee_id) {
      setAlertDialog({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please select an Active Employee.',
        type: 'danger'
      });
      return;
    }

    if (!formData.salutation) {
      setAlertDialog({
        isOpen: true,
        title: 'Validation Error',
        message: 'Please select a Title / Salutation (Mr., Ms., or Mrs.).',
        type: 'danger'
      });
      return;
    }

    if (!formData.joining_date) {
      setAlertDialog({
        isOpen: true,
        title: 'Validation Error',
        message: 'Proposed Joining Date is required.',
        type: 'danger'
      });
      return;
    }

    setFormSubmitting(true);
    try {
      const payload = {
        ...formData,
        status: targetStatus
      };

      if (isEditing && editingOfferId) {
        await updateOfferLetter(editingOfferId, payload);
      } else {
        await createOfferLetter(payload);
      }

      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message:
          targetStatus === 'Generated'
            ? 'Offer Letter generated successfully!'
            : 'Offer Letter draft saved successfully!',
        type: 'success'
      });

      setShowFormModal(false);
      loadAllData();
    } catch (err) {
      console.error('Submit offer error:', err);
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: err.userMessage || 'Failed to save offer letter. Please check input values.',
        type: 'danger'
      });
    } finally {
      setFormSubmitting(false);
    }
  };

  // Direct Status Transition to Generated for Offer Letter
  const handleMarkAsGenerated = async (offer) => {
    try {
      await generateOfferLetter(offer.id);
      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message: `Offer Letter ${offer.offer_number} finalized and generated!`,
        type: 'success'
      });
      loadAllData();
    } catch (err) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to generate offer letter.',
        type: 'danger'
      });
    }
  };

  // Delete Offer Letter (Single)
  const handleDeleteOffer = (offer) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Offer Letter',
      message: `Are you sure you want to delete ${offer.offer_number} for ${offer.employee_name_snapshot}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteOfferLetter(offer.id);
          setSelectedOfferIds((prev) => prev.filter((id) => id !== offer.id));
          setAlertDialog({
            isOpen: true,
            title: 'Deleted',
            message: 'Offer letter deleted successfully.',
            type: 'success'
          });
          loadAllData();
        } catch (err) {
          setAlertDialog({
            isOpen: true,
            title: 'Error',
            message: 'Failed to delete offer letter.',
            type: 'danger'
          });
        }
      },
      type: 'danger'
    });
  };

  // Delete Selected Offer Letters (Bulk)
  const handleDeleteSelectedOffers = () => {
    if (selectedOfferIds.length === 0) return;

    const count = selectedOfferIds.length;
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${count} Selected Offer Letter${count > 1 ? 's' : ''}`,
      message: `Are you sure you want to delete ${count} selected offer letter${count > 1 ? 's' : ''}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await Promise.all(selectedOfferIds.map((id) => deleteOfferLetter(id)));
          setSelectedOfferIds([]);
          setAlertDialog({
            isOpen: true,
            title: 'Deleted',
            message: `Successfully deleted ${count} offer letter${count > 1 ? 's' : ''}.`,
            type: 'success'
          });
          loadAllData();
        } catch (err) {
          setAlertDialog({
            isOpen: true,
            title: 'Error',
            message: 'Failed to delete selected offer letters.',
            type: 'danger'
          });
        }
      },
      type: 'danger'
    });
  };

  // Checkbox Selection Helpers for Offer Letters
  const isAllSelected =
    filteredOffers.length > 0 &&
    filteredOffers.every((o) => selectedOfferIds.includes(o.id));

  const handleToggleSelectOffer = (id) => {
    setSelectedOfferIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedOfferIds([]);
    } else {
      setSelectedOfferIds(filteredOffers.map((o) => o.id));
    }
  };

  // --- EXPERIENCE LETTER HANDLERS ---
  const handleSaveExperienceLetter = async (payload) => {
    try {
      if (isEditingExp && editingExpId) {
        await updateExperienceLetter(editingExpId, payload);
        setAlertDialog({
          isOpen: true,
          title: 'Success',
          message:
            payload.status === 'Generated'
              ? 'Experience Letter updated and generated successfully!'
              : 'Experience Letter draft updated successfully!',
          type: 'success'
        });
      } else {
        await createExperienceLetter(payload);
        setAlertDialog({
          isOpen: true,
          title: 'Success',
          message:
            payload.status === 'Generated'
              ? 'Experience Letter generated successfully!'
              : 'Experience Letter draft saved successfully!',
          type: 'success'
        });
      }
      setShowExpFormModal(false);
      loadAllData();
    } catch (err) {
      console.error('Save experience letter error:', err);
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: err.response?.data?.message || err.message || 'Failed to save experience letter.',
        type: 'danger'
      });
      throw err;
    }
  };

  const handleMarkExpAsGenerated = async (exp) => {
    try {
      await generateExperienceLetter(exp.id);
      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message: `Experience Letter ${exp.letter_number} finalized and generated!`,
        type: 'success'
      });
      loadAllData();
    } catch (err) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to generate experience letter.',
        type: 'danger'
      });
    }
  };

  const handleDeleteExperience = (exp) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Experience Letter',
      message: `Are you sure you want to delete ${exp.letter_number} for ${exp.employee_name_snapshot}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteExperienceLetter(exp.id);
          setSelectedExpIds((prev) => prev.filter((id) => id !== exp.id));
          setAlertDialog({
            isOpen: true,
            title: 'Deleted',
            message: 'Experience letter deleted successfully.',
            type: 'success'
          });
          loadAllData();
        } catch (err) {
          setAlertDialog({
            isOpen: true,
            title: 'Error',
            message: 'Failed to delete experience letter.',
            type: 'danger'
          });
        }
      },
      type: 'danger'
    });
  };

  const handleDeleteSelectedExperiences = () => {
    if (selectedExpIds.length === 0) return;

    const count = selectedExpIds.length;
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${count} Selected Experience Letter${count > 1 ? 's' : ''}`,
      message: `Are you sure you want to delete ${count} selected experience letter${count > 1 ? 's' : ''}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await Promise.all(selectedExpIds.map((id) => deleteExperienceLetter(id)));
          setSelectedExpIds([]);
          setAlertDialog({
            isOpen: true,
            title: 'Deleted',
            message: `Successfully deleted ${count} experience letter${count > 1 ? 's' : ''}.`,
            type: 'success'
          });
          loadAllData();
        } catch (err) {
          setAlertDialog({
            isOpen: true,
            title: 'Error',
            message: 'Failed to delete selected experience letters.',
            type: 'danger'
          });
        }
      },
      type: 'danger'
    });
  };

  const isAllExpSelected =
    filteredExperiences.length > 0 &&
    filteredExperiences.every((e) => selectedExpIds.includes(e.id));

  const handleToggleSelectExp = (id) => {
    setSelectedExpIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllExp = () => {
    if (isAllExpSelected) {
      setSelectedExpIds([]);
    } else {
      setSelectedExpIds(filteredExperiences.map((e) => e.id));
    }
  };

  // --- RELIEVING LETTER HANDLERS ---
  const handleSaveRelievingLetter = async (payload) => {
    try {
      if (isEditingRel && editingRelId) {
        await updateRelievingLetter(editingRelId, payload);
        setAlertDialog({
          isOpen: true,
          title: 'Success',
          message:
            payload.status === 'Generated'
              ? 'Relieving Letter updated and generated successfully!'
              : 'Relieving Letter draft updated successfully!',
          type: 'success'
        });
      } else {
        await createRelievingLetter(payload);
        setAlertDialog({
          isOpen: true,
          title: 'Success',
          message:
            payload.status === 'Generated'
              ? 'Relieving Letter generated successfully!'
              : 'Relieving Letter draft saved successfully!',
          type: 'success'
        });
      }
      setShowRelFormModal(false);
      loadAllData();
    } catch (err) {
      console.error('Save relieving letter error:', err);
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: err.response?.data?.message || err.message || 'Failed to save relieving letter.',
        type: 'danger'
      });
      throw err;
    }
  };

  const handleMarkRelAsGenerated = async (rel) => {
    try {
      await generateRelievingLetter(rel.id);
      setAlertDialog({
        isOpen: true,
        title: 'Success',
        message: `Relieving Letter ${rel.letter_number} finalized and generated!`,
        type: 'success'
      });
      loadAllData();
    } catch (err) {
      setAlertDialog({
        isOpen: true,
        title: 'Error',
        message: 'Failed to generate relieving letter.',
        type: 'danger'
      });
    }
  };

  const handleDeleteRelieving = (rel) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Relieving Letter',
      message: `Are you sure you want to delete ${rel.letter_number} for ${rel.employee_name_snapshot}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await deleteRelievingLetter(rel.id);
          setSelectedRelIds((prev) => prev.filter((id) => id !== rel.id));
          setAlertDialog({
            isOpen: true,
            title: 'Deleted',
            message: 'Relieving letter deleted successfully.',
            type: 'success'
          });
          loadAllData();
        } catch (err) {
          setAlertDialog({
            isOpen: true,
            title: 'Error',
            message: 'Failed to delete relieving letter.',
            type: 'danger'
          });
        }
      },
      type: 'danger'
    });
  };

  const handleDeleteSelectedRelievings = () => {
    if (selectedRelIds.length === 0) return;

    const count = selectedRelIds.length;
    setConfirmDialog({
      isOpen: true,
      title: `Delete ${count} Selected Relieving Letter${count > 1 ? 's' : ''}`,
      message: `Are you sure you want to delete ${count} selected relieving letter${count > 1 ? 's' : ''}? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await Promise.all(selectedRelIds.map((id) => deleteRelievingLetter(id)));
          setSelectedRelIds([]);
          setAlertDialog({
            isOpen: true,
            title: 'Deleted',
            message: `Successfully deleted ${count} relieving letter${count > 1 ? 's' : ''}.`,
            type: 'success'
          });
          loadAllData();
        } catch (err) {
          setAlertDialog({
            isOpen: true,
            title: 'Error',
            message: 'Failed to delete selected relieving letters.',
            type: 'danger'
          });
        }
      },
      type: 'danger'
    });
  };

  const isAllRelSelected =
    filteredRelievings.length > 0 &&
    filteredRelievings.every((r) => selectedRelIds.includes(r.id));

  const handleToggleSelectRel = (id) => {
    setSelectedRelIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAllRel = () => {
    if (isAllRelSelected) {
      setSelectedRelIds([]);
    } else {
      setSelectedRelIds(filteredRelievings.map((r) => r.id));
    }
  };

  // Open Download Option Modal
  const handleOpenDownloadChoiceModal = (type, row) => {
    setDownloadChoiceModal({
      isOpen: true,
      type,
      row
    });
  };

  // Execute Download from Modal
  const handleExecuteLetterDownload = async (includeSignature) => {
    const { type, row } = downloadChoiceModal;
    if (!row) return;

    const rowId = row.id;
    const loadingKey = `${rowId}-${includeSignature ? 'with-signature' : 'without-signature'}`;
    setLetterDownloadLoading(loadingKey);

    try {
      if (type === 'offer') {
        await handleDownloadPDF(row, includeSignature);
      } else if (type === 'experience') {
        await handleDownloadExpPDF(row, includeSignature);
      } else if (type === 'relieving') {
        await handleDownloadRelPDF(row, includeSignature);
      }
      setDownloadChoiceModal({ isOpen: false, type: null, row: null });
    } catch (err) {
      console.error('Execute letter download error:', err);
    } finally {
      setLetterDownloadLoading(null);
    }
  };

  // Download PDF for Offer Letter
  const handleDownloadPDF = async (offer, includeSignature = true) => {
    const safeName = (offer.employee_name_snapshot || offer.employee_name || 'Candidate').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeOfferNum = (offer.offer_number || 'OFF').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Offer_Letter_${safeName}_${safeOfferNum}${includeSignature ? '_signed' : ''}.pdf`;

    try {
      setExportOfferData({ ...offer, includeSignature });
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (rowExportRef.current) {
        await exportOfferLetterToPdf(rowExportRef.current, filename);
        setExportOfferData(null);
        return;
      }
    } catch (exportErr) {
      console.warn('Direct PDF export error, fallback to server download:', exportErr);
    }

    try {
      const response = await downloadOfferLetterPdf(offer.id, includeSignature);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      setAlertDialog({
        isOpen: true,
        title: 'Download Failed',
        message: 'Failed to download Offer Letter PDF.',
        type: 'danger'
      });
    } finally {
      setExportOfferData(null);
    }
  };

  // Download PDF for Experience Letter
  const handleDownloadExpPDF = async (exp, includeSignature = true) => {
    const safeName = (exp.employee_name_snapshot || exp.employee_name || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeExpNum = (exp.letter_number || 'EXP').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Experience_Letter_${safeName}_${safeExpNum}${includeSignature ? '_signed' : ''}.pdf`;

    try {
      setExportExpData({ ...exp, includeSignature });
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (rowExpExportRef.current) {
        await exportOfferLetterToPdf(rowExpExportRef.current, filename);
        setExportExpData(null);
        return;
      }
    } catch (exportErr) {
      console.warn('Direct PDF export error for experience letter, fallback to server download:', exportErr);
    }

    try {
      const response = await downloadExperienceLetterPdf(exp.id, includeSignature);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download experience letter error:', err);
      setAlertDialog({
        isOpen: true,
        title: 'Download Failed',
        message: 'Failed to export Experience Letter PDF.',
        type: 'danger'
      });
    } finally {
      setExportExpData(null);
    }
  };

  // Download PDF for Relieving Letter
  const handleDownloadRelPDF = async (rel, includeSignature = true) => {
    const safeName = (rel.employee_name_snapshot || rel.employee_name || 'Employee').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeRelNum = (rel.letter_number || 'REL').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `Relieving_Letter_${safeName}_${safeRelNum}${includeSignature ? '_signed' : ''}.pdf`;

    try {
      setExportRelData({ ...rel, includeSignature });
      await new Promise((resolve) => setTimeout(resolve, 300));
      if (rowRelExportRef.current) {
        await exportOfferLetterToPdf(rowRelExportRef.current, filename);
        setExportRelData(null);
        return;
      }
    } catch (exportErr) {
      console.warn('Direct PDF export error for relieving letter, fallback to server download:', exportErr);
    }

    try {
      const response = await downloadRelievingLetterPdf(rel.id, includeSignature);
      const url = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download relieving letter error:', err);
      setAlertDialog({
        isOpen: true,
        title: 'Download Failed',
        message: 'Failed to export Relieving Letter PDF.',
        type: 'danger'
      });
    } finally {
      setExportRelData(null);
    }
  };

  // Print PDF for Offer Letter
  const handlePrintOffer = async (offer, includeSignature = true) => {
    try {
      const response = await previewOfferLetterPdf(offer.id, includeSignature);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.focus();
        printWindow.print();
      }
    } catch (err) {
      console.error('Print error:', err);
      setAlertDialog({
        isOpen: true,
        title: 'Print Failed',
        message: 'Failed to open print dialog.',
        type: 'danger'
      });
    }
  };

  // Print for Experience Letter
  const handlePrintExp = async (exp, includeSignature = true) => {
    try {
      const response = await previewExperienceLetterPdf(exp.id, includeSignature);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.focus();
        printWindow.print();
      }
    } catch (err) {
      console.warn('Fallback opening preview modal for print:', err);
      setPreviewExpData(exp);
      setShowExpPreviewModal(true);
    }
  };

  // Print for Relieving Letter
  const handlePrintRel = async (rel, includeSignature = true) => {
    try {
      const response = await previewRelievingLetterPdf(rel.id, includeSignature);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url);
      if (printWindow) {
        printWindow.focus();
        printWindow.print();
      }
    } catch (err) {
      console.warn('Fallback opening preview modal for print:', err);
      setPreviewRelData(rel);
      setShowRelPreviewModal(true);
    }
  };

  // Open Preview Modal
  const handleOpenPreview = (offer) => {
    setPreviewOfferData(offer);
    setShowPreviewModal(true);
  };

  const handleOpenExpPreview = (exp) => {
    setPreviewExpData(exp);
    setShowExpPreviewModal(true);
  };

  const handleOpenRelPreview = (rel) => {
    setPreviewRelData(rel);
    setShowRelPreviewModal(true);
  };

  return (
    <div className="flex h-screen bg-admin-bg font-sans overflow-hidden">
      <Sidebar />

      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto dark-scroll">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-admin-accent/15 text-admin-accent font-bold">
                  {activeMainTab === 'offer' ? (
                    <FiFileText size={20} />
                  ) : activeMainTab === 'experience' ? (
                    <FiAward size={20} />
                  ) : (
                    <FiCheckSquare size={20} />
                  )}
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-admin-text tracking-tight">
                  Letters & Certificates
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-admin-secondary mt-1">
                Official Letter Generation, Settings, and Historical Snapshots
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="px-3.5 py-2.5 rounded-xl bg-admin-surface hover:bg-admin-elevated border border-admin-border text-admin-text text-xs font-bold transition-all flex items-center gap-2 shadow-sm cursor-pointer"
                title="Letter Settings, Company Branding & Role Templates"
              >
                <FiSettings size={15} className="text-admin-accent" />
                <span>Letter Settings</span>
              </button>

              <button
                onClick={handleCreateLetterClick}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-admin-accent to-admin-accent2 text-white text-xs font-extrabold transition-all shadow-lg shadow-admin-accent/25 hover:opacity-95 flex items-center gap-2 cursor-pointer"
              >
                <FiPlus size={16} />
                <span>Create Letter</span>
              </button>
            </div>
          </div>

          {/* TAB SWITCHER: OFFER LETTERS vs EXPERIENCE LETTERS vs RELIEVING LETTERS */}
          <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-admin-surface border border-admin-border shadow-sm w-fit">
            <button
              onClick={() => setActiveMainTab('offer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMainTab === 'offer'
                  ? 'bg-admin-accent text-white shadow-md shadow-admin-accent/20'
                  : 'text-admin-secondary hover:text-admin-text hover:bg-admin-elevated/60'
              }`}
            >
              <FiFileText size={15} />
              <span>Offer Letters</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeMainTab === 'offer'
                    ? 'bg-white/20 text-white'
                    : 'bg-admin-bg text-admin-muted'
                }`}
              >
                {totalOffersCount}
              </span>
            </button>

            <button
              onClick={() => setActiveMainTab('experience')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMainTab === 'experience'
                  ? 'bg-admin-accent text-white shadow-md shadow-admin-accent/20'
                  : 'text-admin-secondary hover:text-admin-text hover:bg-admin-elevated/60'
              }`}
            >
              <FiAward size={15} />
              <span>Experience Letters</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeMainTab === 'experience'
                    ? 'bg-white/20 text-white'
                    : 'bg-admin-bg text-admin-muted'
                }`}
              >
                {totalExpCount}
              </span>
            </button>

            <button
              onClick={() => setActiveMainTab('relieving')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeMainTab === 'relieving'
                  ? 'bg-admin-accent text-white shadow-md shadow-admin-accent/20'
                  : 'text-admin-secondary hover:text-admin-text hover:bg-admin-elevated/60'
              }`}
            >
              <FiCheckSquare size={15} />
              <span>Relieving Letters</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                  activeMainTab === 'relieving'
                    ? 'bg-white/20 text-white'
                    : 'bg-admin-bg text-admin-muted'
                }`}
              >
                {totalRelCount}
              </span>
            </button>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-admin-surface border border-admin-border shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 font-bold">
                {activeMainTab === 'offer' ? (
                  <FiFileText size={22} />
                ) : activeMainTab === 'experience' ? (
                  <FiAward size={22} />
                ) : (
                  <FiCheckSquare size={22} />
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-admin-muted uppercase tracking-wider">
                  {activeMainTab === 'offer'
                    ? 'Total Offers'
                    : activeMainTab === 'experience'
                    ? 'Total Experience Letters'
                    : 'Total Relieving Letters'}
                </p>
                <p className="text-2xl font-black text-admin-text mt-0.5">
                  {activeMainTab === 'offer'
                    ? totalOffersCount
                    : activeMainTab === 'experience'
                    ? totalExpCount
                    : totalRelCount}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-admin-surface border border-admin-border shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold">
                <FiCheckCircle size={22} />
              </div>
              <div>
                <p className="text-xs font-semibold text-admin-muted uppercase tracking-wider">Generated</p>
                <p className="text-2xl font-black text-admin-text mt-0.5">
                  {activeMainTab === 'offer'
                    ? generatedOffersCount
                    : activeMainTab === 'experience'
                    ? generatedExpCount
                    : generatedRelCount}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-admin-surface border border-admin-border shadow-sm flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 font-bold">
                <FiClock size={22} />
              </div>
              <div>
                <p className="text-xs font-semibold text-admin-muted uppercase tracking-wider">Drafts</p>
                <p className="text-2xl font-black text-admin-text mt-0.5">
                  {activeMainTab === 'offer'
                    ? draftOffersCount
                    : activeMainTab === 'experience'
                    ? draftExpCount
                    : draftRelCount}
                </p>
              </div>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="p-4 rounded-2xl bg-admin-surface border border-admin-border shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-admin-muted" size={15} />
              <input
                type="text"
                placeholder={
                  activeMainTab === 'offer'
                    ? 'Search offer letters by candidate name, code, offer # or job title...'
                    : activeMainTab === 'experience'
                    ? 'Search experience letters by employee name, ID, letter # or role...'
                    : 'Search relieving letters by employee name, ID, letter # or role...'
                }
                value={
                  activeMainTab === 'offer'
                    ? searchTerm
                    : activeMainTab === 'experience'
                    ? searchTermExp
                    : searchTermRel
                }
                onChange={(e) => {
                  if (activeMainTab === 'offer') setSearchTerm(e.target.value);
                  else if (activeMainTab === 'experience') setSearchTermExp(e.target.value);
                  else setSearchTermRel(e.target.value);
                }}
                className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text placeholder:text-admin-muted focus:outline-none focus:border-admin-accent transition-colors"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-admin-muted whitespace-nowrap">Status:</span>
              <div className="flex bg-admin-bg border border-admin-border rounded-xl p-1 text-xs">
                {['All', 'Generated', 'Draft'].map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      if (activeMainTab === 'offer') setStatusFilter(st);
                      else if (activeMainTab === 'experience') setStatusFilterExp(st);
                      else setStatusFilterRel(st);
                    }}
                    className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                      (activeMainTab === 'offer'
                        ? statusFilter
                        : activeMainTab === 'experience'
                        ? statusFilterExp
                        : statusFilterRel) === st
                        ? 'bg-admin-accent text-white'
                        : 'text-admin-secondary hover:text-admin-text'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* TAB 1: OFFER LETTERS VIEW */}
          {activeMainTab === 'offer' && (
            <>
              {/* Active Selection Banner for Offer Letters */}
              {selectedOfferIds.length > 0 && (
                <div className="p-3 px-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between animate-fade-in shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <p className="text-xs font-bold text-rose-500 dark:text-rose-400">
                      {selectedOfferIds.length} offer letter{selectedOfferIds.length > 1 ? 's' : ''} selected
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedOfferIds([])}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-admin-bg border border-admin-border text-admin-secondary hover:text-admin-text transition-colors"
                    >
                      Clear Selection
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedOffers}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all"
                    >
                      <FiTrash2 size={13} />
                      Delete Selected ({selectedOfferIds.length})
                    </button>
                  </div>
                </div>
              )}

              {/* Offer Letters Table */}
              <div className="bg-admin-surface border border-admin-border rounded-2xl shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-16 flex flex-col items-center justify-center gap-3">
                    <Spinner />
                    <p className="text-xs font-medium text-admin-muted">Loading offer letters...</p>
                  </div>
                ) : filteredOffers.length === 0 ? (
                  <div className="p-16 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-admin-elevated text-admin-muted mx-auto flex items-center justify-center">
                      <FiFileText size={26} />
                    </div>
                    <p className="text-sm font-bold text-admin-text">No Offer Letters Found</p>
                    <p className="text-xs text-admin-muted max-w-sm mx-auto">
                      {searchTerm || statusFilter !== 'All'
                        ? 'No records match your filters. Try clearing the search query.'
                        : 'Get started by creating the first offer letter for an active employee.'}
                    </p>
                    {!searchTerm && statusFilter === 'All' && (
                      <button
                        onClick={handleOpenCreateModal}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-admin-accent text-white text-xs font-bold hover:opacity-90 shadow-md transition-all mt-2"
                      >
                        <FiPlus size={14} />
                        Create First Offer Letter
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-admin-border bg-admin-bg/60 text-[11px] font-extrabold uppercase tracking-wider text-admin-secondary">
                          <th className="py-3 px-4 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={isAllSelected}
                              onChange={handleToggleSelectAll}
                              className="w-4 h-4 rounded text-admin-accent focus:ring-admin-accent cursor-pointer accent-admin-accent"
                              title="Select / Deselect All"
                            />
                          </th>
                          <th className="py-3 px-4">Offer #</th>
                          <th className="py-3 px-4">Candidate / Employee</th>
                          <th className="py-3 px-4">Position & Dept</th>
                          <th className="py-3 px-4">Offer Date</th>
                          <th className="py-3 px-4">Joining Date</th>
                          <th className="py-3 px-4">Monthly Salary</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-admin-border text-xs">
                        {filteredOffers.map((offer) => {
                          const isGen = offer.status === 'Generated';
                          const isSelected = selectedOfferIds.includes(offer.id);
                          return (
                            <tr
                              key={offer.id}
                              className={`transition-colors group ${
                                isSelected
                                  ? 'bg-rose-500/10 dark:bg-rose-500/15'
                                  : 'hover:bg-admin-elevated/40'
                              }`}
                            >
                              {/* Row Checkbox */}
                              <td className="py-3.5 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectOffer(offer.id)}
                                  className="w-4 h-4 rounded text-admin-accent focus:ring-admin-accent cursor-pointer accent-admin-accent"
                                />
                              </td>

                              {/* Offer Number */}
                              <td className="py-3.5 px-4 font-mono font-bold text-admin-accent">
                                {offer.offer_number}
                              </td>

                              {/* Candidate Name & Code */}
                              <td className="py-3.5 px-4">
                                <div>
                                  <p className="font-bold text-admin-text leading-tight">
                                    {offer.employee_name_snapshot}
                                  </p>
                                  <p className="text-[11px] text-admin-muted font-mono mt-0.5">
                                    {offer.employee_id_snapshot}
                                  </p>
                                </div>
                              </td>

                              {/* Job Title & Department */}
                              <td className="py-3.5 px-4">
                                <div>
                                  <p className="font-semibold text-admin-text leading-tight">
                                    {offer.job_title_snapshot}
                                  </p>
                                  <p className="text-[11px] text-admin-muted mt-0.5">
                                    {offer.department_snapshot || 'General'}
                                  </p>
                                </div>
                              </td>

                              {/* Offer Date */}
                              <td className="py-3.5 px-4 text-admin-secondary whitespace-nowrap">
                                {formatDate(offer.offer_date)}
                              </td>

                              {/* Joining Date */}
                              <td className="py-3.5 px-4 font-medium text-admin-text whitespace-nowrap">
                                {formatDate(offer.joining_date)}
                              </td>

                              {/* Salary */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="font-bold text-admin-text">
                                  {formatINR(offer.monthly_salary)}
                                </span>
                                <span className="text-[10px] text-admin-muted ml-1">/ mo</span>
                              </td>

                              {/* Status Badge */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                    isGen
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isGen ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}
                                  />
                                  {offer.status}
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Preview */}
                                  <button
                                    onClick={() => handleOpenPreview(offer)}
                                    className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors"
                                    title="Interactive Preview"
                                  >
                                    <FiEye size={15} />
                                  </button>

                                  {/* Download PDF */}
                                  <button
                                    onClick={() => handleOpenDownloadChoiceModal('offer', offer)}
                                    className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors"
                                    title="Download PDF"
                                  >
                                    <FiDownload size={15} />
                                  </button>

                                  {/* Print */}
                                  <button
                                    onClick={() => handlePrintOffer(offer)}
                                    className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors"
                                    title="Print Offer Letter"
                                  >
                                    <FiPrinter size={15} />
                                  </button>

                                  {/* Edit (if Draft) */}
                                  <button
                                    onClick={() => handleOpenEditModal(offer)}
                                    className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-accent hover:bg-admin-accent/10 transition-colors"
                                    title={isGen ? 'View / Edit Offer Details' : 'Edit Draft'}
                                  >
                                    <FiEdit size={15} />
                                  </button>

                                  {/* Quick Finalize / Generate if Draft */}
                                  {!isGen && (
                                    <button
                                      onClick={() => handleMarkAsGenerated(offer)}
                                      className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                                      title="Mark as Generated"
                                    >
                                      <FiCheckCircle size={15} />
                                    </button>
                                  )}

                                  {/* Delete (Only visible if this offer letter is selected by checkbox) */}
                                  {isSelected && (
                                    <button
                                      onClick={() => handleDeleteOffer(offer)}
                                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors animate-fade-in"
                                      title="Delete Selected Offer"
                                    >
                                      <FiTrash2 size={15} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 2: EXPERIENCE LETTERS VIEW */}
          {activeMainTab === 'experience' && (
            <>
              {/* Active Selection Banner for Experience Letters */}
              {selectedExpIds.length > 0 && (
                <div className="p-3 px-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between animate-fade-in shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <p className="text-xs font-bold text-rose-500 dark:text-rose-400">
                      {selectedExpIds.length} experience letter{selectedExpIds.length > 1 ? 's' : ''} selected
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedExpIds([])}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-admin-bg border border-admin-border text-admin-secondary hover:text-admin-text transition-colors"
                    >
                      Clear Selection
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedExperiences}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all"
                    >
                      <FiTrash2 size={13} />
                      Delete Selected ({selectedExpIds.length})
                    </button>
                  </div>
                </div>
              )}

              {/* Experience Letters Table */}
              <div className="bg-admin-surface border border-admin-border rounded-2xl shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-16 flex flex-col items-center justify-center gap-3">
                    <Spinner />
                    <p className="text-xs font-medium text-admin-muted">Loading experience letters...</p>
                  </div>
                ) : filteredExperiences.length === 0 ? (
                  <div className="p-16 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-admin-elevated text-admin-muted mx-auto flex items-center justify-center">
                      <FiAward size={26} />
                    </div>
                    <p className="text-sm font-bold text-admin-text">No Experience Letters Found</p>
                    <p className="text-xs text-admin-muted max-w-sm mx-auto">
                      {searchTermExp || statusFilterExp !== 'All'
                        ? 'No records match your filters. Try clearing the search query.'
                        : 'Generate official experience certificates for employees with auto-filled salary in words and role work summary.'}
                    </p>
                    {!searchTermExp && statusFilterExp === 'All' && (
                      <button
                        onClick={handleOpenCreateExpModal}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-admin-accent text-white text-xs font-bold hover:opacity-90 shadow-md transition-all mt-2 cursor-pointer"
                      >
                        <FiPlus size={14} />
                        Create First Experience Letter
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-admin-border bg-admin-bg/60 text-[11px] font-extrabold uppercase tracking-wider text-admin-secondary">
                          <th className="py-3 px-4 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={isAllExpSelected}
                              onChange={handleToggleSelectAllExp}
                              className="w-4 h-4 rounded text-admin-accent focus:ring-admin-accent cursor-pointer accent-admin-accent"
                              title="Select / Deselect All"
                            />
                          </th>
                          <th className="py-3 px-4">Letter #</th>
                          <th className="py-3 px-4">Employee</th>
                          <th className="py-3 px-4">Position & Dept</th>
                          <th className="py-3 px-4">Issue Date</th>
                          <th className="py-3 px-4">Tenure (Joining ➔ Relieving)</th>
                          <th className="py-3 px-4">Monthly Salary</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-admin-border text-xs">
                        {filteredExperiences.map((exp) => {
                          const isGen = exp.status === 'Generated';
                          const isSelected = selectedExpIds.includes(exp.id);
                          return (
                            <tr
                              key={exp.id}
                              className={`transition-colors group ${
                                isSelected
                                  ? 'bg-rose-500/10 dark:bg-rose-500/15'
                                  : 'hover:bg-admin-elevated/40'
                              }`}
                            >
                              {/* Row Checkbox */}
                              <td className="py-3.5 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectExp(exp.id)}
                                  className="w-4 h-4 rounded text-admin-accent focus:ring-admin-accent cursor-pointer accent-admin-accent"
                                />
                              </td>

                              {/* Letter Number */}
                              <td className="py-3.5 px-4 font-mono font-bold text-admin-accent">
                                {exp.letter_number}
                              </td>

                              {/* Employee Name & Code */}
                              <td className="py-3.5 px-4">
                                <div>
                                  <p className="font-bold text-admin-text leading-tight">
                                    {exp.employee_name_snapshot}
                                  </p>
                                  <p className="text-[11px] text-admin-muted font-mono mt-0.5">
                                    {exp.employee_id_snapshot}
                                  </p>
                                </div>
                              </td>

                              {/* Job Title & Department */}
                              <td className="py-3.5 px-4">
                                <div>
                                  <p className="font-semibold text-admin-text leading-tight">
                                    {exp.job_title_snapshot}
                                  </p>
                                  <p className="text-[11px] text-admin-muted mt-0.5">
                                    {exp.department_snapshot || 'General'}
                                  </p>
                                </div>
                              </td>

                              {/* Issue Date */}
                              <td className="py-3.5 px-4 text-admin-secondary whitespace-nowrap">
                                {formatDate(exp.issue_date)}
                              </td>

                              {/* Tenure */}
                              <td className="py-3.5 px-4 font-medium text-admin-text whitespace-nowrap">
                                <div className="text-[11px]">
                                  <span>{formatDate(exp.joining_date)}</span>
                                  <span className="text-admin-muted mx-1">➔</span>
                                  <span className="font-bold text-admin-accent">{formatDate(exp.relieving_date)}</span>
                                </div>
                              </td>

                              {/* Salary */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span className="font-bold text-admin-text">
                                  {formatINR(exp.monthly_salary)}
                                </span>
                                <span className="text-[10px] text-admin-muted ml-1">/ mo</span>
                              </td>

                              {/* Status Badge */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                    isGen
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isGen ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}
                                  />
                                  {exp.status}
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Preview */}
                                  <button
                                    onClick={() => handleOpenExpPreview(exp)}
                                    className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors"
                                    title="Interactive Preview"
                                  >
                                    <FiEye size={15} />
                                  </button>

                                  {/* Download PDF */}
                                  <button
                                    onClick={() => handleOpenDownloadChoiceModal('experience', exp)}
                                    className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors"
                                    title="Download PDF"
                                  >
                                    <FiDownload size={15} />
                                  </button>

                                  {/* Print */}
                                  <button
                                    onClick={() => handlePrintExp(exp)}
                                    className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors"
                                    title="Print Experience Letter"
                                  >
                                    <FiPrinter size={15} />
                                  </button>

                                  {/* Edit (if Draft) */}
                                  <button
                                    onClick={() => handleOpenEditExpModal(exp)}
                                    className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-accent hover:bg-admin-accent/10 transition-colors"
                                    title={isGen ? 'View / Edit Experience Details' : 'Edit Draft'}
                                  >
                                    <FiEdit size={15} />
                                  </button>

                                  {/* Quick Finalize / Generate if Draft */}
                                  {!isGen && (
                                    <button
                                      onClick={() => handleMarkExpAsGenerated(exp)}
                                      className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                                      title="Mark as Generated"
                                    >
                                      <FiCheckCircle size={15} />
                                    </button>
                                  )}

                                  {/* Delete (Only visible if this letter is selected by checkbox) */}
                                  {isSelected && (
                                    <button
                                      onClick={() => handleDeleteExperience(exp)}
                                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors animate-fade-in"
                                      title="Delete Selected Experience Letter"
                                    >
                                      <FiTrash2 size={15} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* TAB 3: RELIEVING LETTERS VIEW */}
          {activeMainTab === 'relieving' && (
            <>
              {/* Active Selection Banner for Relieving Letters */}
              {selectedRelIds.length > 0 && (
                <div className="p-3 px-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between animate-fade-in shadow-sm">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <p className="text-xs font-bold text-rose-500 dark:text-rose-400">
                      {selectedRelIds.length} relieving letter{selectedRelIds.length > 1 ? 's' : ''} selected
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedRelIds([])}
                      className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-admin-bg border border-admin-border text-admin-secondary hover:text-admin-text transition-colors"
                    >
                      Clear Selection
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteSelectedRelievings}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/20 transition-all"
                    >
                      <FiTrash2 size={13} />
                      Delete Selected ({selectedRelIds.length})
                    </button>
                  </div>
                </div>
              )}

              {/* Relieving Letters Table */}
              <div className="bg-admin-surface border border-admin-border rounded-2xl shadow-sm overflow-hidden">
                {loading ? (
                  <div className="p-16 flex flex-col items-center justify-center gap-3">
                    <Spinner />
                    <p className="text-xs font-medium text-admin-muted">Loading relieving letters...</p>
                  </div>
                ) : filteredRelievings.length === 0 ? (
                  <div className="p-16 text-center space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-admin-elevated text-admin-muted mx-auto flex items-center justify-center">
                      <FiCheckSquare size={26} />
                    </div>
                    <p className="text-sm font-bold text-admin-text">No Relieving Letters Found</p>
                    <p className="text-xs text-admin-muted max-w-sm mx-auto">
                      {searchTermRel || statusFilterRel !== 'All'
                        ? 'No records match your filters. Try clearing the search query.'
                        : 'Generate official 1-page relieving certificates for employees with auto-populated tenure and resignation acceptance.'}
                    </p>
                    {!searchTermRel && statusFilterRel === 'All' && (
                      <button
                        onClick={handleOpenCreateRelModal}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-admin-accent text-white text-xs font-bold hover:opacity-90 shadow-md transition-all mt-2 cursor-pointer"
                      >
                        <FiPlus size={14} />
                        Create First Relieving Letter
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-admin-border bg-admin-bg/60 text-[11px] font-extrabold uppercase tracking-wider text-admin-secondary">
                          <th className="py-3 px-4 w-10 text-center">
                            <input
                              type="checkbox"
                              checked={isAllRelSelected}
                              onChange={handleToggleSelectAllRel}
                              className="w-4 h-4 rounded text-admin-accent focus:ring-admin-accent cursor-pointer accent-admin-accent"
                              title="Select / Deselect All"
                            />
                          </th>
                          <th className="py-3 px-4">Letter #</th>
                          <th className="py-3 px-4">Employee</th>
                          <th className="py-3 px-4">Position & Dept</th>
                          <th className="py-3 px-4">Issue Date</th>
                          <th className="py-3 px-4">Resignation Date</th>
                          <th className="py-3 px-4">Relieving Date</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-admin-border text-xs">
                        {filteredRelievings.map((rel) => {
                          const isGen = rel.status === 'Generated';
                          const isSelected = selectedRelIds.includes(rel.id);
                          return (
                            <tr
                              key={rel.id}
                              className={`transition-colors group ${
                                isSelected
                                  ? 'bg-rose-500/10 dark:bg-rose-500/15'
                                  : 'hover:bg-admin-elevated/40'
                              }`}
                            >
                              {/* Row Checkbox */}
                              <td className="py-3.5 px-4 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleSelectRel(rel.id)}
                                  className="w-4 h-4 rounded text-admin-accent focus:ring-admin-accent cursor-pointer accent-admin-accent"
                                />
                              </td>

                              {/* Letter Number */}
                              <td className="py-3.5 px-4 font-mono font-bold text-purple-400">
                                {rel.letter_number}
                              </td>

                              {/* Employee Name & Code */}
                              <td className="py-3.5 px-4">
                                <div>
                                  <p className="font-bold text-admin-text leading-tight">
                                    {rel.employee_name_snapshot}
                                  </p>
                                  <p className="text-[11px] text-admin-muted font-mono mt-0.5">
                                    {rel.employee_id_snapshot}
                                  </p>
                                </div>
                              </td>

                              {/* Job Title & Department */}
                              <td className="py-3.5 px-4">
                                <div>
                                  <p className="font-semibold text-admin-text leading-tight">
                                    {rel.job_title_snapshot}
                                  </p>
                                  <p className="text-[11px] text-admin-muted mt-0.5">
                                    {rel.department_snapshot || 'General'}
                                  </p>
                                </div>
                              </td>

                              {/* Issue Date */}
                              <td className="py-3.5 px-4 text-admin-secondary whitespace-nowrap">
                                {formatDate(rel.issue_date)}
                              </td>

                              {/* Resignation Date */}
                              <td className="py-3.5 px-4 text-admin-secondary whitespace-nowrap">
                                {formatDate(rel.resignation_date)}
                              </td>

                              {/* Relieving Date */}
                              <td className="py-3.5 px-4 font-bold text-admin-accent whitespace-nowrap">
                                {formatDate(rel.relieving_date)}
                              </td>

                              {/* Status Badge */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                    isGen
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isGen ? 'bg-emerald-500' : 'bg-amber-500'
                                    }`}
                                  />
                                  {rel.status}
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Preview */}
                                  <button
                                    onClick={() => handleOpenRelPreview(rel)}
                                    className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors"
                                    title="Interactive Preview"
                                  >
                                    <FiEye size={15} />
                                  </button>

                                  {/* Download PDF */}
                                  <button
                                    onClick={() => handleOpenDownloadChoiceModal('relieving', rel)}
                                    className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors"
                                    title="Download PDF"
                                  >
                                    <FiDownload size={15} />
                                  </button>

                                  {/* Print */}
                                  <button
                                    onClick={() => handlePrintRel(rel)}
                                    className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors"
                                    title="Print Relieving Letter"
                                  >
                                    <FiPrinter size={15} />
                                  </button>

                                  {/* Edit (if Draft) */}
                                  <button
                                    onClick={() => handleOpenEditRelModal(rel)}
                                    className="p-1.5 rounded-lg text-admin-secondary hover:text-admin-accent hover:bg-admin-accent/10 transition-colors"
                                    title={isGen ? 'View / Edit Relieving Details' : 'Edit Draft'}
                                  >
                                    <FiEdit size={15} />
                                  </button>

                                  {/* Quick Finalize / Generate if Draft */}
                                  {!isGen && (
                                    <button
                                      onClick={() => handleMarkRelAsGenerated(rel)}
                                      className="p-1.5 rounded-lg text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                                      title="Mark as Generated"
                                    >
                                      <FiCheckCircle size={15} />
                                    </button>
                                  )}

                                  {/* Delete (Only visible if this letter is selected by checkbox) */}
                                  {isSelected && (
                                    <button
                                      onClick={() => handleDeleteRelieving(rel)}
                                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors animate-fade-in"
                                      title="Delete Selected Relieving Letter"
                                    >
                                      <FiTrash2 size={15} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>

      {/* CREATE / EDIT OFFER MODAL */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/75 backdrop-blur-sm overflow-hidden">
          <div className="relative w-full max-w-5xl h-[95vh] flex flex-col bg-admin-surface border border-admin-border rounded-2xl shadow-2xl overflow-hidden text-admin-text animate-fade-in my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-admin-border bg-admin-bg flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-admin-accent/15 text-admin-accent flex items-center justify-center font-bold">
                  <FiFileText size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-admin-text">
                    {isEditing ? 'Edit Offer Letter' : 'Create New Offer Letter'}
                  </h2>
                  <p className="text-xs text-admin-muted">
                    Auto-populates active employee details with smart defaults and live 5-page preview
                  </p>
                </div>
              </div>

              {/* Form vs Live Preview Switcher */}
              <div className="flex items-center gap-3">
                <div className="flex bg-admin-elevated border border-admin-border rounded-xl p-1 text-xs">
                  <button
                    onClick={() => setActiveFormTab('form')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                      activeFormTab === 'form'
                        ? 'bg-admin-accent text-white'
                        : 'text-admin-secondary hover:text-admin-text'
                    }`}
                  >
                    Edit Form
                  </button>
                  <button
                    onClick={() => setActiveFormTab('preview')}
                    className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                      activeFormTab === 'preview'
                        ? 'bg-admin-accent text-white'
                        : 'text-admin-secondary hover:text-admin-text'
                    }`}
                  >
                    Live Preview
                  </button>
                </div>

                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-2 rounded-xl text-admin-muted hover:text-admin-text hover:bg-admin-elevated transition-colors"
                >
                  <FiX size={20} />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 dark-scroll">
              {activeFormTab === 'form' ? (
                <div className="space-y-6 max-w-4xl mx-auto">
                  {/* SECTION 1: ACTIVE EMPLOYEE SELECTION */}
                  <div className="p-5 rounded-2xl bg-admin-elevated/40 border border-admin-border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-admin-accent text-white text-xs font-bold flex items-center justify-center">
                          1
                        </span>
                        <h3 className="text-sm font-bold text-admin-text">
                          Select Active Employee
                        </h3>
                      </div>
                      {formData.employee_id && (
                        <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                          <FiCheckCircle size={13} /> Selected: {formData.employee_id}
                        </span>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* Search & Select Input with Combobox */}
                      <div className="space-y-1.5 relative" ref={employeeSearchRef}>
                        <label className="text-xs font-bold text-admin-secondary flex items-center justify-between">
                          <span>Search Employee <span className="text-rose-500">*</span></span>
                          {formData.employee_id && (
                            <button
                              type="button"
                              onClick={() => {
                                handleEmployeeChange('');
                                setEmployeeSearchQuery('');
                              }}
                              className="text-[11px] text-admin-muted hover:text-rose-400 transition-colors flex items-center gap-1"
                            >
                              <FiX size={12} /> Clear Selection
                            </button>
                          )}
                        </label>

                        {/* If an employee is selected, show nice employee card */}
                        {(() => {
                          const selectedEmp = activeEmployees.find(
                            (e) => e.employee_id === formData.employee_id
                          );
                          if (selectedEmp && !isEmployeeDropdownOpen) {
                            return (
                              <div className="flex items-center justify-between p-3 rounded-xl bg-admin-bg border border-admin-accent/30 shadow-sm">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl bg-admin-accent/15 border border-admin-accent/30 text-admin-accent font-bold text-xs flex items-center justify-center flex-shrink-0">
                                    {(selectedEmp.name || 'EM')
                                      .split(' ')
                                      .map((n) => n[0])
                                      .slice(0, 2)
                                      .join('')
                                      .toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-bold text-admin-text">
                                        {selectedEmp.name}
                                      </p>
                                      <span className="font-mono text-[10px] text-slate-400 font-semibold px-1.5 py-0.5 rounded bg-white/5 border border-admin-border">
                                        {selectedEmp.employee_id}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-admin-secondary mt-0.5">
                                      {selectedEmp.job_role || 'No Role'} • {selectedEmp.department_name || 'General'}
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsEmployeeDropdownOpen(true);
                                    setEmployeeSearchQuery('');
                                  }}
                                  className="text-xs text-admin-accent hover:text-admin-accent2 font-semibold px-3 py-1.5 rounded-lg bg-admin-accent/10 border border-admin-accent/20 hover:bg-admin-accent/20 transition-all"
                                >
                                  Change
                                </button>
                              </div>
                            );
                          }

                          return null;
                        })()}

                        {/* Search Input Box */}
                        {(!formData.employee_id || isEmployeeDropdownOpen) && (
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
                              className="w-full pl-10 pr-10 py-2.5 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text placeholder-admin-muted font-medium focus:outline-none focus:border-admin-accent"
                            />
                            {employeeSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setEmployeeSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-admin-muted hover:text-admin-text"
                              >
                                <FiX size={14} />
                              </button>
                            )}
                          </div>
                        )}

                        {/* Search Results Dropdown List */}
                        {isEmployeeDropdownOpen && (
                          <div className="absolute top-full left-0 right-0 mt-1.5 z-30 max-h-60 overflow-y-auto rounded-xl bg-admin-elevated border border-admin-border shadow-clay-admin-modal dark-scroll">
                            {(() => {
                              const filtered = activeEmployees.filter((emp) => {
                                if (!employeeSearchQuery.trim()) return true;
                                const q = employeeSearchQuery.toLowerCase();
                                const nameMatch = (emp.name || '').toLowerCase().includes(q);
                                const idMatch = (emp.employee_id || '').toLowerCase().includes(q);
                                const roleMatch = (emp.job_role || '').toLowerCase().includes(q);
                                const deptMatch = (emp.department_name || '').toLowerCase().includes(q);
                                return nameMatch || idMatch || roleMatch || deptMatch;
                              });

                              if (filtered.length === 0) {
                                return (
                                  <div className="p-4 text-center text-xs text-admin-muted">
                                    No active employees found matching &quot;{employeeSearchQuery}&quot;
                                  </div>
                                );
                              }

                              return (
                                <div className="p-1.5 space-y-1">
                                  {filtered.map((emp) => {
                                    const isSelected = emp.employee_id === formData.employee_id;
                                    return (
                                      <button
                                        key={emp.id || emp.employee_id}
                                        type="button"
                                        onClick={() => {
                                          handleEmployeeChange(emp.employee_id);
                                          setIsEmployeeDropdownOpen(false);
                                          setEmployeeSearchQuery('');
                                        }}
                                        className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between group ${
                                          isSelected
                                            ? 'bg-admin-accent/20 border border-admin-accent/30'
                                            : 'hover:bg-white/5 border border-transparent'
                                        }`}
                                      >
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-8 h-8 rounded-lg bg-admin-bg border border-admin-border text-admin-text font-bold text-[11px] flex items-center justify-center flex-shrink-0 group-hover:border-admin-accent/50">
                                            {(emp.name || 'EM')
                                              .split(' ')
                                              .map((n) => n[0])
                                              .slice(0, 2)
                                              .join('')
                                              .toUpperCase()}
                                          </div>
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <span className="text-xs font-bold text-admin-text group-hover:text-admin-accent transition-colors">
                                                {emp.name}
                                              </span>
                                              <span className="font-mono text-[10px] text-slate-400 font-semibold px-1.5 py-0.5 rounded bg-white/5 border border-admin-border">
                                                {emp.employee_id}
                                              </span>
                                            </div>
                                            <span className="text-[10px] text-admin-secondary block mt-0.5">
                                              {emp.job_role || 'No Role'} • {emp.department_name || 'No Department'}
                                            </span>
                                          </div>
                                        </div>

                                        {isSelected && (
                                          <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                                            <FiCheckCircle size={14} /> Selected
                                          </span>
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Auto-populated details preview */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {/* Title / Salutation Dropdown */}
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-admin-secondary flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              Title / Salutation <span className="text-rose-500">*</span>
                            </span>
                            {formData.salutation && (
                              <span className="text-[10px] text-emerald-400 font-semibold">
                                (Dear {formData.salutation} {formData.employee_name || 'Candidate'})
                              </span>
                            )}
                          </label>
                          <select
                            value={formData.salutation}
                            onChange={(e) => setFormData({ ...formData, salutation: e.target.value })}
                            className={`w-full px-3.5 py-2 text-xs rounded-xl bg-admin-bg border font-semibold focus:outline-none transition-all cursor-pointer ${
                              !formData.salutation
                                ? 'border-amber-500/50 text-amber-300 focus:border-amber-500'
                                : 'border-admin-border text-admin-text focus:border-admin-accent'
                            }`}
                          >
                            <option value="" className="bg-admin-elevated text-slate-400">
                              -- Choose Title (Mr. / Ms.) * --
                            </option>
                            <option value="Mr." className="bg-admin-elevated text-admin-text font-semibold">
                              Mr.
                            </option>
                            <option value="Ms." className="bg-admin-elevated text-admin-text font-semibold">
                              Ms.
                            </option>
                            <option value="Mrs." className="bg-admin-elevated text-admin-text font-semibold">
                              Mrs.
                            </option>
                          </select>
                          {!formData.salutation && (
                            <p className="text-[10px] text-amber-400 font-medium">
                              * Mandatory: Select <strong>Mr.</strong> or <strong>Ms.</strong>
                            </p>
                          )}
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-admin-muted">Candidate Name</label>
                          <input
                            type="text"
                            value={formData.employee_name}
                            onChange={(e) => setFormData({ ...formData, employee_name: e.target.value })}
                            placeholder="Employee full name"
                            className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-admin-muted">Candidate Email</label>
                          <input
                            type="email"
                            value={formData.employee_email}
                            onChange={(e) => setFormData({ ...formData, employee_email: e.target.value })}
                            placeholder="Employee email address"
                            className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-admin-muted">Candidate Phone</label>
                          <input
                            type="text"
                            value={formData.employee_phone}
                            onChange={(e) => setFormData({ ...formData, employee_phone: e.target.value })}
                            placeholder="Mobile phone number"
                            className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                          />
                        </div>

                        <div className="space-y-1 md:col-span-2">
                          <label className="text-xs font-medium text-admin-muted">
                            Permanent Address
                          </label>
                          <textarea
                            rows={2}
                            value={formData.employee_address}
                            onChange={(e) => setFormData({ ...formData, employee_address: e.target.value })}
                            placeholder="Employee residential address..."
                            className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent font-sans resize-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: POSITION & DATES */}
                  <div className="p-5 rounded-2xl bg-admin-elevated/40 border border-admin-border space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-admin-accent text-white text-xs font-bold flex items-center justify-center">
                        2
                      </span>
                      <h3 className="text-sm font-bold text-admin-text">
                        Position Details & Key Dates
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-admin-secondary">Job Title</label>
                        <input
                          type="text"
                          value={formData.job_title}
                          onChange={(e) => setFormData({ ...formData, job_title: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent font-semibold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-admin-secondary">Department</label>
                        <input
                          type="text"
                          value={formData.department}
                          onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-admin-secondary">Reporting To</label>
                        <input
                          type="text"
                          value={formData.reporting_to}
                          onChange={(e) => setFormData({ ...formData, reporting_to: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-admin-secondary">Offer Date</label>
                        <input
                          type="date"
                          value={formData.offer_date}
                          onChange={(e) => setFormData({ ...formData, offer_date: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-admin-accent">
                          Proposed Joining Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={formData.joining_date}
                          onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
                          required
                          className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-accent text-admin-text focus:outline-none font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-admin-secondary">Interview Date</label>
                        <input
                          type="date"
                          value={formData.interview_date}
                          onChange={(e) => setFormData({ ...formData, interview_date: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-admin-secondary">Work Location</label>
                        <input
                          type="text"
                          value={formData.work_location}
                          onChange={(e) => setFormData({ ...formData, work_location: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-admin-secondary">Employment Type</label>
                        <input
                          type="text"
                          value={formData.employment_type}
                          onChange={(e) => setFormData({ ...formData, employment_type: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-admin-secondary">Work Hours</label>
                        <input
                          type="text"
                          value={formData.work_hours}
                          onChange={(e) => setFormData({ ...formData, work_hours: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                        />
                      </div>

                      <div className="space-y-1 sm:col-span-2 md:col-span-3">
                        <label className="text-xs font-semibold text-admin-secondary">Probation Period</label>
                        <input
                          type="text"
                          value={formData.probation_period}
                          onChange={(e) => setFormData({ ...formData, probation_period: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: COMPENSATION & BENEFITS */}
                  <div className="p-5 rounded-2xl bg-admin-elevated/40 border border-admin-border space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-admin-accent text-white text-xs font-bold flex items-center justify-center">
                        3
                      </span>
                      <h3 className="text-sm font-bold text-admin-text">
                        Salary, Compensation & Leaves
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-admin-secondary">
                          Monthly Salary (₹)
                        </label>
                        <input
                          type="number"
                          value={formData.monthly_salary}
                          onChange={(e) => setFormData({ ...formData, monthly_salary: e.target.value })}
                          placeholder="e.g. 25000"
                          className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent font-bold"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-admin-secondary">
                          Variable Pay / Bonus (%)
                        </label>
                        <input
                          type="number"
                          value={formData.variable_percentage}
                          onChange={(e) => setFormData({ ...formData, variable_percentage: e.target.value })}
                          placeholder="e.g. 5"
                          className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-admin-secondary">
                          Annual Paid Leaves
                        </label>
                        <input
                          type="number"
                          value={formData.annual_paid_leaves}
                          onChange={(e) => setFormData({ ...formData, annual_paid_leaves: e.target.value })}
                          className="w-full px-3 py-2 text-xs rounded-xl bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent font-semibold"
                        />
                      </div>

                      {/* Auto Calculated Annual Salary / CTC Box */}
                      <div className="p-3 rounded-xl bg-admin-surface border border-admin-border space-y-1 text-xs">
                        <p className="text-[11px] text-admin-muted font-medium">Annual Salary (CTC)</p>
                        <p className="text-sm font-black text-admin-accent">
                          {formatINR(Number(formData.monthly_salary || 0) * 12)}
                        </p>
                        <p className="text-[10px] text-admin-muted">
                          (Monthly: {formatINR(Number(formData.monthly_salary || 0))} × 12)
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: ROLES & RESPONSIBILITIES (BULLETS) */}
                  <div className="p-5 rounded-2xl bg-admin-elevated/40 border border-admin-border space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-admin-accent text-white text-xs font-bold flex items-center justify-center">
                          4
                        </span>
                        <h3 className="text-sm font-bold text-admin-text">
                          Roles & Responsibilities for this Offer
                        </h3>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (!e.target.value) return;
                            const tmpl = roleTemplates.find((t) => t.job_role === e.target.value);
                            if (tmpl && Array.isArray(tmpl.categories)) {
                              setFormData((prev) => ({
                                ...prev,
                                responsibilities: JSON.parse(JSON.stringify(tmpl.categories))
                              }));
                            }
                            e.target.value = '';
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-admin-bg border border-admin-border text-xs text-admin-text font-medium focus:outline-none focus:border-admin-accent cursor-pointer"
                        >
                          <option value="" className="bg-admin-elevated text-slate-400">
                            -- Load Standard Template --
                          </option>
                          {roleTemplates.map((t) => (
                            <option key={t.id || t.job_role} value={t.job_role} className="bg-admin-elevated text-admin-text">
                              {t.job_role} ({t.categories?.length || 0} categories)
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          onClick={handleAddResponsibilityCategory}
                          className="px-3 py-1.5 rounded-xl bg-admin-surface hover:bg-admin-elevated border border-admin-border text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          <FiPlus size={13} />
                          Add Category
                        </button>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {(formData.responsibilities || []).map((cat, catIdx) => (
                        <div
                          key={catIdx}
                          className="p-3.5 rounded-xl bg-admin-surface border border-admin-border space-y-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <input
                              type="text"
                              value={cat.category}
                              onChange={(e) => handleUpdateResponsibilityCategory(catIdx, e.target.value)}
                              className="flex-1 px-3 py-1.5 text-xs font-bold rounded-lg bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveResponsibilityCategory(catIdx)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                            >
                              <FiTrash2 size={14} />
                            </button>
                          </div>

                          <div className="pl-4 space-y-2">
                            {(cat.items || []).map((b, bIdx) => (
                              <div key={bIdx} className="flex items-start gap-2">
                                <span className="text-admin-accent text-xs pt-1.5">•</span>
                                <textarea
                                  rows={2}
                                  value={b}
                                  onChange={(e) => handleUpdateBullet(catIdx, bIdx, e.target.value)}
                                  className="flex-1 px-3 py-1 text-xs rounded-lg bg-admin-bg border border-admin-border text-admin-text focus:outline-none focus:border-admin-accent resize-none font-sans"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBullet(catIdx, bIdx)}
                                  className="p-1 text-admin-muted hover:text-rose-500 pt-1.5"
                                >
                                  <FiX size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleAddBulletToCategory(catIdx)}
                              className="text-[11px] font-semibold text-admin-accent hover:underline flex items-center gap-1"
                            >
                              <FiPlus size={12} />
                              Add Bullet
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* LIVE DOCUMENT PREVIEW TAB */
                <div className="bg-slate-900/60 p-4 sm:p-8 rounded-2xl flex justify-center">
                  <div className="w-full max-w-[760px]">
                    <OfferLetterDocument data={formData} settings={settings} />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Action Bar */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-admin-border bg-admin-bg flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-admin-secondary hover:text-admin-text hover:bg-admin-elevated transition-colors"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={formSubmitting}
                  onClick={() => handleSubmitOffer('Draft')}
                  className="px-4 py-2.5 rounded-xl bg-admin-elevated hover:bg-admin-border border border-admin-border text-admin-text text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <FiClock size={14} />
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={formSubmitting}
                  onClick={() => handleSubmitOffer('Generated')}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-admin-accent to-admin-accent2 text-white text-xs font-extrabold shadow-lg shadow-admin-accent/25 hover:opacity-95 transition-opacity disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  <FiCheckCircle size={15} />
                  {formSubmitting ? 'Generating...' : 'Generate Final PDF'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LETTER TYPE SELECTION MODAL (OFFER VS EXPERIENCE) */}
      <LetterTypeSelectModal
        isOpen={showLetterTypeModal}
        onClose={() => setShowLetterTypeModal(false)}
        onSelectType={handleSelectLetterType}
      />

      {/* EXPERIENCE LETTER CREATE / EDIT FORM MODAL */}
      <ExperienceLetterFormModal
        isOpen={showExpFormModal}
        onClose={() => setShowExpFormModal(false)}
        initialData={initialExpFormData}
        isEditing={isEditingExp}
        editingId={editingExpId}
        activeEmployees={activeEmployees}
        roleTemplates={roleTemplates}
        settings={settings}
        onSave={handleSaveExperienceLetter}
      />

      {/* EXPERIENCE LETTER PREVIEW MODAL */}
      <ExperienceLetterPreviewModal
        isOpen={showExpPreviewModal}
        onClose={() => setShowExpPreviewModal(false)}
        letterData={previewExpData}
        experienceData={previewExpData}
        settings={settings}
        onDownload={(sig) => previewExpData && handleDownloadExpPDF(previewExpData, sig)}
        onPrint={(sig) => previewExpData && handlePrintExp(previewExpData, sig)}
      />

      {/* RELIEVING LETTER CREATE / EDIT FORM MODAL */}
      <RelievingLetterFormModal
        isOpen={showRelFormModal}
        onClose={() => setShowRelFormModal(false)}
        initialData={initialRelFormData}
        isEditing={isEditingRel}
        editingId={editingRelId}
        activeEmployees={activeEmployees}
        settings={settings}
        onSave={handleSaveRelievingLetter}
      />

      {/* RELIEVING LETTER PREVIEW MODAL */}
      <RelievingLetterPreviewModal
        isOpen={showRelPreviewModal}
        onClose={() => setShowRelPreviewModal(false)}
        letterData={previewRelData}
        settings={settings}
        onDownload={(sig) => previewRelData && handleDownloadRelPDF(previewRelData, sig)}
        onPrint={(sig) => previewRelData && handlePrintRel(previewRelData, sig)}
      />

      {/* SETTINGS MODAL */}
      <OfferLetterSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onSettingsUpdated={(newSettings) => {
          setSettings(newSettings);
          loadAllData();
        }}
      />

      {/* INTERACTIVE PREVIEW MODAL FOR OFFER LETTERS */}
      <OfferLetterPreviewModal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        offerData={previewOfferData}
        settings={settings}
        onDownload={(sig) => previewOfferData && handleDownloadPDF(previewOfferData, sig)}
        onPrint={(sig) => previewOfferData && handlePrintOffer(previewOfferData, sig)}
      />

      {/* SINGLE LETTER DOWNLOAD CHOICE MODAL (WITH VS WITHOUT SIGNATURE) */}
      {downloadChoiceModal.isOpen && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl p-6 shadow-clay-admin-modal w-full max-w-md animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0">
                <FiFileText size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-admin-heading">
                  Download {downloadChoiceModal.type === 'offer' ? 'Offer Letter' : downloadChoiceModal.type === 'experience' ? 'Experience Letter' : 'Relieving Letter'}
                </h3>
                <p className="text-xs text-admin-muted">
                  {downloadChoiceModal.row?.employee_name_snapshot || downloadChoiceModal.row?.employee_name} ({downloadChoiceModal.row?.offer_number || downloadChoiceModal.row?.letter_number || downloadChoiceModal.row?.employee_id_snapshot || ''})
                </p>
              </div>
            </div>
            <p className="text-sm text-admin-secondary mb-4 leading-relaxed">
              Choose your PDF download option:
            </p>
            <div className="flex flex-col gap-2.5 mb-2">
              <button
                onClick={() => handleExecuteLetterDownload(true)}
                disabled={!!letterDownloadLoading}
                className="w-full px-4 py-3 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md flex items-center justify-between disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FiCheckCircle size={16} />
                  <span>Download With Signature</span>
                </div>
                {letterDownloadLoading === `${downloadChoiceModal.row?.id}-with-signature` ? (
                  <span className="animate-spin text-xs">⏳</span>
                ) : (
                  <FiDownload size={15} />
                )}
              </button>

              <button
                onClick={() => handleExecuteLetterDownload(false)}
                disabled={!!letterDownloadLoading}
                className="w-full px-4 py-3 text-xs font-bold rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition-all flex items-center justify-between disabled:opacity-50 cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <FiFileText size={16} />
                  <span>Download Without Signature</span>
                </div>
                {letterDownloadLoading === `${downloadChoiceModal.row?.id}-without-signature` ? (
                  <span className="animate-spin text-xs">⏳</span>
                ) : (
                  <FiDownload size={15} />
                )}
              </button>

              <button
                onClick={() => {
                  const row = downloadChoiceModal.row;
                  const type = downloadChoiceModal.type;
                  setDownloadChoiceModal({ isOpen: false, type: null, row: null });
                  if (type === 'offer') handleOpenPreview(row);
                  else if (type === 'experience') handleOpenExpPreview(row);
                  else handleOpenRelPreview(row);
                }}
                disabled={!!letterDownloadLoading}
                className="w-full px-4 py-2.5 text-xs font-semibold rounded-xl border border-admin-border text-admin-secondary hover:bg-admin-border/30 transition-all text-center mt-1 cursor-pointer"
              >
                View Live Preview
              </button>
            </div>
            <div className="flex justify-end mt-4 pt-3 border-t border-admin-border/40">
              <button
                onClick={() => setDownloadChoiceModal({ isOpen: false, type: null, row: null })}
                disabled={!!letterDownloadLoading}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-admin-border text-admin-secondary hover:bg-admin-border/30 transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DIALOG */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        type={confirmDialog.type}
      />

      {/* ALERT DIALOG */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        title={alertDialog.title}
        message={alertDialog.message}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        type={alertDialog.type}
      />

      {/* Hidden Container for 100% Identical Direct A4 PDF Export from Table (Offer Letter) */}
      {exportOfferData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '760px', opacity: 0, pointerEvents: 'none', zIndex: -9999 }}>
          <div ref={rowExportRef}>
            <OfferLetterDocument
              data={exportOfferData}
              settings={settings}
              pageNumber={null}
              includeSignature={exportOfferData.includeSignature !== false}
            />
          </div>
        </div>
      )}

      {/* Hidden Container for 100% Identical Direct A4 PDF Export from Table (Experience Letter) */}
      {exportExpData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '760px', opacity: 0, pointerEvents: 'none', zIndex: -9999 }}>
          <div ref={rowExpExportRef}>
            <ExperienceLetterDocument
              data={exportExpData}
              settings={settings}
              includeSignature={exportExpData.includeSignature !== false}
            />
          </div>
        </div>
      )}

      {/* Hidden Container for 100% Identical Direct A4 PDF Export from Table (Relieving Letter) */}
      {exportRelData && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '760px', opacity: 0, pointerEvents: 'none', zIndex: -9999 }}>
          <div ref={rowRelExportRef}>
            <RelievingLetterDocument
              data={exportRelData}
              settings={settings}
              includeSignature={exportRelData.includeSignature !== false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOfferLetters;
