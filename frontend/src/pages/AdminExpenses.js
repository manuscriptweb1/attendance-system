import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import AlertDialog from '../components/AlertDialog';
import AdminToast from '../components/AdminToast';
import ConfirmDialog from '../components/ConfirmDialog';
import ClearRangeDialog from '../components/ClearRangeDialog';
import { Spinner } from '../components/Loader';
import api, { clearExpenseRange } from '../services/api';
import { formatDate } from '../utils/formatTime';
import { getErrorMessage } from '../utils/errorHandler';
import { validateMonthYear } from '../utils/dateValidation';
import { formatIndianCurrency } from '../utils/formatCurrency';
import { FiDownload, FiPlus, FiEdit, FiTrash2, FiTrendingUp, FiCreditCard, FiDollarSign, FiArchive, FiX, FiSettings, FiCheckCircle, FiMinusCircle } from 'react-icons/fi';

const getBadgePalette = (str) => {
  if (!str) return { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
  const palettes = [
    { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
    { bg: "#ffedd5", text: "#9a3412", border: "#fdba74" },
    { bg: "#fef3c7", text: "#b45309", border: "#fcd34d" },
    { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
    { bg: "#e0f2fe", text: "#0369a1", border: "#7dd3fc" },
    { bg: "#ede9fe", text: "#6d28d9", border: "#c4b5fd" },
    { bg: "#fae8ff", text: "#a21caf", border: "#f0abfc" },
    { bg: "#ffe4e6", text: "#be123c", border: "#fda4af" },
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palettes[Math.abs(hash) % palettes.length];
};

const expenseTypeColors = {
  "Editorial Expenses": { bg: "#e0f2fe", text: "#0369a1", border: "#7dd3fc" },
  "Freelancer": { bg: "#ede9fe", text: "#6d28d9", border: "#c4b5fd" },
  "Office Staff": { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  "Rent": { bg: "#fef3c7", text: "#b45309", border: "#fcd34d" },
  "Reviewer Expenses": { bg: "#fae8ff", text: "#a21caf", border: "#f0abfc" },
  "Other": { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" }
};

const paymentMethodColors = {
  "Bank": { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  "Petty Cash": { bg: "#fef9c3", text: "#a16207", border: "#fde047" },
  "Cash": { bg: "#dcfce7", text: "#15803d", border: "#86efac" },
  "UPI": { bg: "#f3e8ff", text: "#7e22ce", border: "#d8b4fe" },
  "Other": { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" }
};

const getExpenseTypeBadgeStyle = (typeName) => {
  if (!typeName) return getBadgePalette("Other");
  if (expenseTypeColors[typeName]) return expenseTypeColors[typeName];
  return getBadgePalette(typeName);
};

const getPaymentMethodBadgeStyle = (methodName) => {
  if (!methodName) return getBadgePalette("Other");
  if (paymentMethodColors[methodName]) return paymentMethodColors[methodName];
  return getBadgePalette(methodName);
};

const AdminExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [activeExpenseTypes, setActiveExpenseTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  
  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showManageTypes, setShowManageTypes] = useState(false);
  const [allExpenseTypes, setAllExpenseTypes] = useState([]);
  const [newTypeName, setNewTypeName] = useState('');
  const [inactiveOldType, setInactiveOldType] = useState(null);
  
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ 
    id: '', expense_type_id: '', name: '', notes: '', amount: '', payment_method: 'Bank', payment_status: 'paid' 
  });
  
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [toastConfig, setToastConfig] = useState({ message: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'danger' });
  const [clearDialog, setClearDialog] = useState({ isOpen: false, isLoading: false });

  // Sorting
  const [sortConfig, setSortConfig] = useState({ key: 'expense_date', direction: 'desc' });

  const fetchData = async () => {
    const errorMsg = validateMonthYear(month, year);
    if (errorMsg) {
      setAlertDialog({ isOpen: true, title: 'Error', message: errorMsg, type: 'error' });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [expRes, sumRes, activeTypeRes] = await Promise.all([
        api.get('/expenses', { params: { month, year } }),
        api.get('/expenses/summary', { params: { month, year } }),
        api.get('/expenses/expense-types/active')
      ]);
      
      if (expRes.data.success) setExpenses(expRes.data.expenses);
      if (sumRes.data.success) setSummary(sumRes.data.summary);
      if (activeTypeRes.data.success) setActiveExpenseTypes(activeTypeRes.data.expenseTypes);
    } catch (e) {
      console.error('Expenses fetch failed:', e.response?.status, e.response?.data || e.message);
      if (e.response?.status === 401) {
        setAlertDialog({ isOpen: true, title: 'Session Expired', message: 'Session expired. Please login again.', type: 'error' });
      } else {
        setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [month, year]); // eslint-disable-line

  const fetchAllExpenseTypes = async () => {
    try {
      const res = await api.get('/expenses/expense-types');
      if (res.data.success) setAllExpenseTypes(res.data.expenseTypes);
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
    }
  };

  const openManageTypes = () => {
    fetchAllExpenseTypes();
    setShowManageTypes(true);
  };

  const handleAddType = async (e) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    try {
      const res = await api.post('/expenses/expense-types', { name: newTypeName.trim() });
      if (res.data.success) {
        setToastConfig({ message: 'Expense type added!', type: 'success' });
        setNewTypeName('');
        fetchAllExpenseTypes();
        fetchData(); // update active list in background
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    }
  };

  const handleToggleType = async (type) => {
    try {
      const res = await api.put(`/expenses/expense-types/${type.id}`, { ...type, is_active: !type.is_active });
      if (res.data.success) {
        fetchAllExpenseTypes();
        fetchData(); // update active list
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    }
  };

  const handleDeleteType = async (type) => {
    try {
      const res = await api.delete(`/expenses/expense-types/${type.id}`);
      if (res.data.success) {
        setToastConfig({ message: 'Deleted successfully!', type: 'success' });
        fetchAllExpenseTypes();
        fetchData();
      }
    } catch (error) {
      setAlertDialog({ isOpen: true, title: 'Error', message: error.response?.data?.message || getErrorMessage(error), type: 'error' });
    }
  };

  const handleInputChange = e => setFormData(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    
    if (!formData.expense_type_id) {
      setAlertDialog({ isOpen: true, title: 'Validation Error', message: 'Expense Type is required.', type: 'error' });
      return;
    }
    
    if (inactiveOldType && formData.expense_type_id === inactiveOldType.id) {
      setAlertDialog({ isOpen: true, title: 'Validation Error', message: 'This expense type is inactive. Please select an active expense type.', type: 'error' });
      return;
    }
    
    if (parseFloat(formData.amount) <= 0) {
      setAlertDialog({ isOpen: true, title: 'Validation Error', message: 'Amount must be greater than 0', type: 'error' });
      return;
    }

    try {
      const payload = {
        ...formData,
        payment_method: formData.payment_status === 'paid' ? formData.payment_method : null
      };

      const response = editMode ? await api.put(`/expenses/${formData.id}`, payload) : await api.post('/expenses', payload);
      if (response.data.success) {
        setToastConfig({ message: editMode ? 'Expense updated!' : 'Expense added!', type: 'success' });
        fetchData(); 
        closeModal();
      }
    } catch (error) { 
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' }); 
    }
  };

  const handleEdit = exp => {
    setFormData({ 
      id: exp.id,
      expense_type_id: exp.expense_type_id || '',
      name: exp.name || exp.title || '',
      notes: exp.notes || exp.description || '',
      amount: exp.amount || '',
      payment_method: exp.payment_method || exp.payment_mode || 'Bank',
      payment_status: exp.payment_status || exp.status || 'paid',
      expense_date: exp.expense_date
    });
    
    // Handle old inactive types safely
    const isActive = activeExpenseTypes.some(t => t.id === exp.expense_type_id);
    if (exp.expense_type_id && !isActive) {
      setInactiveOldType({ id: exp.expense_type_id, name: exp.expense_type_name });
    } else {
      setInactiveOldType(null);
    }

    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = exp => setConfirmDialog({
    isOpen: true, title: 'Delete Expense', type: 'danger',
    message: `Are you sure you want to delete "${exp.name || exp.title}"?`,
    onConfirm: async () => {
      try { 
        await api.delete(`/expenses/${exp.id}`);
        setToastConfig({ message: 'Deleted successfully!', type: 'success' }); 
        fetchData(); 
      }
      catch (error) { setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' }); }
    },
  });

  const handleExport = async () => {
    const errorMsg = validateMonthYear(month, year);
    if (errorMsg) {
      setAlertDialog({ isOpen: true, title: 'Error', message: errorMsg, type: 'error' });
      return;
    }

    try {
      const res = await api.get('/expenses/export', { params: { month, year }, responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; 
      link.download = `Expenses_${month}_${year}.xlsx`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(e), type: 'error' });
    }
  };

  const closeModal = () => { 
    setShowModal(false); 
    setEditMode(false); 
    setInactiveOldType(null);
    setFormData({ id: '', expense_type_id: '', name: '', notes: '', amount: '', payment_method: 'Bank', payment_status: 'paid' }); 
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedExpenses = [...expenses].sort((a, b) => {
    let aVal = a[sortConfig.key] || '';
    let bVal = b[sortConfig.key] || '';
    if (sortConfig.key === 'amount') {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    } else if (sortConfig.key === 'expense_date') {
      aVal = new Date(aVal).getTime();
      bVal = new Date(bVal).getTime();
    } else {
      aVal = aVal.toString().toLowerCase();
      bVal = bVal.toString().toLowerCase();
    }
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleClearRange = async (data) => {
    try {
      setClearDialog(prev => ({ ...prev, isLoading: true }));
      const response = await clearExpenseRange(data);
      if (response.data.success) {
        setClearDialog({ isOpen: false, isLoading: false });
        setToastConfig({ message: response.data.message || 'Records cleared successfully.', type: 'success' });
        fetchData();
      } else {
        setClearDialog(prev => ({ ...prev, isLoading: false }));
        setAlertDialog({ isOpen: true, title: 'Error', message: response.data.message || 'Failed to clear expenses', type: 'error' });
      }
    } catch (error) {
      setClearDialog(prev => ({ ...prev, isLoading: false }));
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    }
  };

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8">
          
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6 animate-fadeInUp stagger-1">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-admin-heading tracking-tight">Expense Management</h1>
              <p className="text-sm text-admin-muted mt-1.5 font-medium">Track and manage company expenses.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button onClick={() => setClearDialog({ isOpen: true })} className="flex items-center gap-2 bg-admin-surface border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-500 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
                <FiTrash2 size={16} /> Clear Month
              </button>
              <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#3B82F6] hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-glow-blue-sm">
                <FiPlus size={16} /> Add Expense
              </button>
              <button onClick={openManageTypes} className="flex items-center gap-2 bg-admin-surface border border-admin-border text-admin-text hover:bg-admin-elevated px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
                <FiSettings size={16} /> Manage Types
              </button>
              <button onClick={handleExport} disabled={expenses.length === 0} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_4px_16px_rgba(16,185,129,0.2)] disabled:opacity-50">
                <FiDownload size={16} /> Export
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-admin-surface border border-admin-border rounded-2xl p-5 mb-6 shadow-clay-admin animate-fadeInUp stagger-2">
            <div className="flex flex-col sm:flex-row gap-4">
              <div>
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Month</label>
                <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="admin-select py-2 text-sm text-admin-muted">
                  {[...Array(12).keys()].map(m => (
                    <option key={m+1} value={m+1}>{new Date(0, m).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Year</label>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="admin-select py-2 text-sm text-admin-muted">
                  {[...Array(5).keys()].map(y => {
                    const yearVal = new Date().getFullYear() - 2 + y;
                    return <option key={yearVal} value={yearVal}>{yearVal}</option>
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          {summary && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 animate-fadeInUp stagger-3">
                {[
                  { label: 'Total Expenses', value: summary.totalExpenses, icon: FiTrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
                  { label: 'Unpaid', value: summary.unpaid, icon: FiArchive, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                  { label: 'Total Paid', value: summary.totalPaid, icon: FiDollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                  { label: 'Petty Cash', value: summary.pettyCash, icon: FiCreditCard, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                  { label: 'Bank/UPI', value: summary.bank, icon: FiCreditCard, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' }
                ].map((stat, i) => (
                  <div key={i} className="bg-admin-surface border border-admin-border rounded-2xl p-4 shadow-clay-admin flex flex-col items-center text-center hover:-translate-y-1 transition-transform">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-3 ${stat.bg} ${stat.color}`}>
                      <stat.icon size={18} />
                    </div>
                    <p className="text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-1">{stat.label}</p>
                    <p className={`text-xl font-extrabold ${stat.color}`}>{formatIndianCurrency(stat.value)}</p>
                  </div>
                ))}
              </div>

              {summary.byType && summary.byType.length > 0 && (
                <div className="mb-6 animate-fadeInUp stagger-3">
                  <h3 className="text-sm font-bold text-admin-heading uppercase tracking-wider mb-3">Expense Summary by Type</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {summary.byType.map((type, idx) => (
                      <div key={idx} className="bg-admin-surface border border-admin-border rounded-xl p-3 shadow-sm hover:shadow-md transition-all">
                        <p className="text-xs font-semibold text-admin-secondary truncate mb-1">{type.name}</p>
                        <p className="text-lg font-bold text-admin-text">{formatIndianCurrency(type.amount)}</p>
                        <p className="text-[10px] text-admin-muted mt-1">{type.count} {type.count === 1 ? 'entry' : 'entries'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Table */}
          <div className="bg-admin-surface border border-admin-border rounded-2xl overflow-hidden shadow-clay-admin animate-fadeInUp stagger-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Spinner size={36} color="blue" />
              </div>
            ) : (
              <div className="table-responsive dark-scroll">
                <table className="min-w-full divide-y divide-white/[0.04]">
                  <thead className="bg-admin-bg cursor-pointer select-none">
                    <tr>
                      <th onClick={() => handleSort('expense_type_name')} className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap hover:text-admin-text">Type</th>
                      <th onClick={() => handleSort('name')} className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap hover:text-admin-text">Name</th>
                      <th onClick={() => handleSort('amount')} className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap hover:text-admin-text">Amount</th>
                      <th onClick={() => handleSort('payment_status')} className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap hover:text-admin-text">Status</th>
                      <th onClick={() => handleSort('payment_method')} className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap hover:text-admin-text">Payment Method</th>
                      <th onClick={() => handleSort('expense_date')} className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap hover:text-admin-text">Date</th>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">Notes</th>
                      <th className="px-5 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {sortedExpenses.length > 0 ? sortedExpenses.map(r => (
                      <tr key={r.id} className="admin-table-row hover:bg-admin-elevated/[0.02] transition-colors">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span 
                            className="expense-type-badge"
                            style={{
                              '--badge-bg': getExpenseTypeBadgeStyle(r.expense_type_name).bg,
                              '--badge-text': getExpenseTypeBadgeStyle(r.expense_type_name).text,
                              '--badge-border': getExpenseTypeBadgeStyle(r.expense_type_name).border
                            }}
                          >
                            {r.expense_type_name || 'N/A'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-admin-text whitespace-nowrap">
                          {r.name || r.title || '—'}
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-emerald-400 whitespace-nowrap">{formatIndianCurrency(r.amount)}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {(r.payment_status || r.status) === 'paid' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">Paid</span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400">Unpaid</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span 
                            className="payment-method-badge"
                            style={{
                              '--badge-bg': getPaymentMethodBadgeStyle(r.payment_method || r.payment_mode).bg,
                              '--badge-text': getPaymentMethodBadgeStyle(r.payment_method || r.payment_mode).text,
                              '--badge-border': getPaymentMethodBadgeStyle(r.payment_method || r.payment_mode).border
                            }}
                          >
                            {r.payment_method || r.payment_mode || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold text-admin-secondary whitespace-nowrap">{formatDate(r.expense_date)}</td>
                        <td className="px-5 py-4 text-xs text-admin-muted truncate max-w-xs">{r.notes || r.description || '—'}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleEdit(r)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#60A5FA] hover:bg-blue-500/10 transition-colors"><FiEdit size={14} /></button>
                            <button onClick={() => handleDelete(r)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors"><FiTrash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={8} className="px-5 py-16 text-center text-admin-secondary text-sm">No expenses found for this month.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>

      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(d => ({ ...d, isOpen: false }))} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} />
      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(d => ({ ...d, isOpen: false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
      <ClearRangeDialog 
        isOpen={clearDialog.isOpen} 
        onClose={() => setClearDialog({ isOpen: false })} 
        onConfirm={handleClearRange} 
        title="Clear Expenses Range" 
        message="⚠️ WARNING: This will permanently delete ALL expenses for the selected date range. This action cannot be undone." 
        isLoading={clearDialog.isLoading}
      />

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-2xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border">
              <h2 className="text-base font-bold text-admin-text">{editMode ? 'Edit Expense' : 'Add New Expense'}</h2>
              <button onClick={closeModal} className="text-admin-secondary hover:text-admin-text"><FiX size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Expense Type *</label>
                <select name="expense_type_id" value={formData.expense_type_id} onChange={handleInputChange} required className="admin-select text-admin-muted">
                  <option value="">-- Select Type --</option>
                  {inactiveOldType && formData.expense_type_id === inactiveOldType.id && (
                    <option value={inactiveOldType.id} disabled>
                      {inactiveOldType.name} (Inactive - Please select a new one)
                    </option>
                  )}
                  {activeExpenseTypes
                    .filter(t => t.is_active !== false)
                    .map(t => <option key={t.id} value={t.id}>{t.name}</option>)
                  }
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Name / Description *</label>
                <input type="text" name="name" value={formData.name} onChange={handleInputChange} required className="admin-input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Amount (₹) *</label>
                <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleInputChange} required className="admin-input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Payment Status *</label>
                <select name="payment_status" value={formData.payment_status} onChange={handleInputChange} required className="admin-select text-admin-muted">
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
              
              {formData.payment_status === 'paid' && (
                <div>
                  <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Payment Method *</label>
                  <select name="payment_method" value={formData.payment_method} onChange={handleInputChange} required className="admin-select text-admin-muted">
                    <option value="Bank">Bank</option>
                    <option value="Petty Cash">Petty Cash</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              )}

              {editMode && (
                <div>
                  <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Expense Date *</label>
                  <input type="date" name="expense_date" value={formData.expense_date ? formData.expense_date.split('T')[0] : ''} onChange={handleInputChange} required className="admin-input" />
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-admin-secondary uppercase tracking-wider mb-2">Notes</label>
                <textarea name="notes" value={formData.notes} onChange={handleInputChange} rows="2" className="admin-input" placeholder="Optional details..." />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
                <button type="button" onClick={closeModal} className="admin-btn-neutral rounded-xl px-4 py-2 text-sm font-semibold">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm font-semibold bg-[#3B82F6] hover:bg-blue-500 text-white rounded-xl shadow-glow-blue-sm transition-all duration-200">
                  {editMode ? 'Save Changes' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Types Modal */}
      {showManageTypes && (
        <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin-modal w-full max-w-md animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border">
              <h2 className="text-base font-bold text-admin-text">Manage Expense Types</h2>
              <button onClick={() => setShowManageTypes(false)} className="text-admin-secondary hover:text-admin-text"><FiX size={18} /></button>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleAddType} className="flex gap-2 mb-6">
                <input 
                  type="text" 
                  value={newTypeName} 
                  onChange={e => setNewTypeName(e.target.value)} 
                  placeholder="Enter expense type name" 
                  className="admin-input flex-1"
                />
                <button type="submit" disabled={!newTypeName.trim()} className="bg-[#3B82F6] hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-glow-blue-sm disabled:opacity-50">
                  Add
                </button>
              </form>

              <div className="max-h-64 overflow-y-auto dark-scroll pr-2 space-y-2">
                {allExpenseTypes.length > 0 ? allExpenseTypes.map(type => (
                  <div key={type.id} className="flex items-center justify-between bg-admin-bg border border-admin-border p-3 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-admin-text">{type.name}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${type.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {type.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleToggleType(type)}
                        title={type.is_active ? 'Deactivate' : 'Activate'}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${type.is_active ? 'text-amber-400 hover:bg-amber-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'}`}
                      >
                        {type.is_active ? <FiMinusCircle size={16} /> : <FiCheckCircle size={16} />}
                      </button>
                      <button 
                        onClick={() => handleDeleteType(type)}
                        title="Delete"
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <FiTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                )) : (
                  <p className="text-center text-sm text-admin-secondary py-4">No expense types found.</p>
                )}
              </div>
            </div>
            
            <div className="border-t border-admin-border px-6 py-4 flex justify-end">
              <button onClick={() => setShowManageTypes(false)} className="admin-btn-neutral rounded-xl px-4 py-2 text-sm font-semibold">Done</button>
            </div>
          </div>
        </div>
      )}

      <AdminToast 
        message={toastConfig.message} 
        type={toastConfig.type} 
        onClose={() => setToastConfig({ message: '', type: 'success' })} 
      />
    </div>
  );
};

export default AdminExpenses;
