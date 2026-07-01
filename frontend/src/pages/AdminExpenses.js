import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import AlertDialog from '../components/AlertDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { Spinner } from '../components/Loader';
import api from '../services/api';
import { formatDate } from '../utils/formatTime';
import { FiDownload, FiPlus, FiEdit, FiTrash2, FiTrendingUp, FiCreditCard, FiDollarSign, FiArchive, FiX } from 'react-icons/fi';

const AdminExpenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ id: '', expense_type_id: '', title: '', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], payment_mode: 'bank', status: 'paid', paid_to: '' });
  
  const [alertDialog, setAlertDialog] = useState({ isOpen: false, title: '', message: '', type: 'success' });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'danger' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [expRes, sumRes, typeRes] = await Promise.all([
        api.get('/expenses', { params: { month, year } }),
        api.get('/expenses/summary', { params: { month, year } }),
        api.get('/expenses/expense-types')
      ]);
      
      if (expRes.data.success) setExpenses(expRes.data.expenses);
      if (sumRes.data.success) setSummary(sumRes.data.summary);
      if (typeRes.data.success) setExpenseTypes(typeRes.data.expenseTypes);
    } catch (e) {
      console.error('Expenses fetch failed:', e.response?.status, e.response?.data || e.message);
      if (e.response?.status === 401) {
        setAlertDialog({ isOpen: true, title: 'Session Expired', message: 'Session expired. Please login again.', type: 'error' });
      } else {
        setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to fetch expenses', type: 'error' });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [month, year]); // eslint-disable-line

  const handleInputChange = e => setFormData(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    try {
      const response = editMode ? await api.put(`/expenses/${formData.id}`, formData) : await api.post('/expenses', formData);
      if (response.data.success) {
        setAlertDialog({ isOpen: true, title: 'Success', message: editMode ? 'Expense updated!' : 'Expense added!', type: 'success' });
        fetchData(); closeModal();
      }
    } catch (error) { 
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Operation failed.', type: 'error' }); 
    }
  };

  const handleEdit = exp => {
    setFormData({ 
      ...exp, 
      expense_date: new Date(exp.expense_date).toISOString().split('T')[0],
      expense_type_id: exp.expense_type_id || '' 
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleDelete = exp => setConfirmDialog({
    isOpen: true, title: 'Delete Expense', type: 'danger',
    message: `Are you sure you want to delete "${exp.title}"?`,
    onConfirm: async () => {
      try { 
        await api.delete(`/expenses/${exp.id}`);
        setAlertDialog({ isOpen: true, title: 'Success', message: 'Deleted successfully!', type: 'success' }); 
        fetchData(); 
      }
      catch (error) { setAlertDialog({ isOpen: true, title: 'Error', message: 'Delete failed.', type: 'error' }); }
    },
  });

  const handleExport = async () => {
    try {
      const res = await api.get('/expenses/export', { params: { month, year }, responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a'); link.href = url; 
      link.download = `Expenses_${month}_${year}.xlsx`;
      document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
    } catch (e) {
      setAlertDialog({ isOpen: true, title: 'Error', message: 'Failed to export expenses', type: 'error' });
    }
  };

  const closeModal = () => { 
    setShowModal(false); 
    setEditMode(false); 
    setFormData({ id: '', expense_type_id: '', title: '', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0], payment_mode: 'bank', status: 'paid', paid_to: '' }); 
  };

  return (
    <div className="flex h-screen bg-[#0E1320] dark-scroll">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8">
          
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 mb-6 animate-fadeInUp stagger-1">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">Expense Management</h1>
              <p className="text-sm text-[#94A3B8] mt-1.5 font-medium">Track and manage company expenses.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#3B82F6] hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-glow-blue-sm">
                <FiPlus size={16} /> Add Expense
              </button>
              <button onClick={handleExport} disabled={expenses.length === 0} className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-[0_4px_16px_rgba(16,185,129,0.2)] disabled:opacity-50">
                <FiDownload size={16} /> Export
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-5 mb-6 shadow-clay-admin animate-fadeInUp stagger-2">
            <div className="flex flex-col sm:flex-row gap-4">
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Month</label>
                <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="admin-select py-2 text-sm text-[#94A3B8]">
                  {[...Array(12).keys()].map(m => (
                    <option key={m+1} value={m+1}>{new Date(0, m).toLocaleString('default', { month: 'long' })}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-2">Year</label>
                <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="admin-select py-2 text-sm text-[#94A3B8]">
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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6 animate-fadeInUp stagger-3">
              {[
                { label: 'Total Expenses', value: summary.totalExpenses, icon: FiTrendingUp, color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/20' },
                { label: 'Unpaid', value: summary.unpaid, icon: FiArchive, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
                { label: 'Total Paid', value: summary.totalPaid, icon: FiDollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                { label: 'Petty Cash', value: summary.pettyCash, icon: FiCreditCard, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                { label: 'Bank/UPI', value: summary.bank, icon: FiCreditCard, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20' }
              ].map((stat, i) => (
                <div key={i} className="bg-[#161D2E] border border-white/[0.06] rounded-2xl p-4 shadow-clay-admin flex flex-col items-center text-center">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center border mb-3 ${stat.bg} ${stat.color}`}>
                    <stat.icon size={18} />
                  </div>
                  <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-wider mb-1">{stat.label}</p>
                  <p className={`text-xl font-extrabold ${stat.color}`}>₹{parseFloat(stat.value).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          <div className="bg-[#161D2E] border border-white/[0.06] rounded-2xl overflow-hidden shadow-clay-admin animate-fadeInUp stagger-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24">
                <Spinner size={36} color="blue" />
              </div>
            ) : (
              <div className="overflow-x-auto dark-scroll">
                <table className="min-w-full divide-y divide-white/[0.04]">
                  <thead className="bg-[#0E1320]/80">
                    <tr>{['Date','Title','Type','Paid To','Amount','Mode','Status','Actions'].map(h => (
                      <th key={h} className="px-5 py-4 text-left text-[10px] font-bold text-[#64748B] uppercase tracking-widest whitespace-nowrap">{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {expenses.length > 0 ? expenses.map(r => (
                      <tr key={r.id} className="admin-table-row hover:bg-[#0B1120]/[0.02] transition-colors">
                        <td className="px-5 py-4 text-xs font-semibold text-[#CBD5E1] whitespace-nowrap">{formatDate(r.expense_date)}</td>
                        <td className="px-5 py-4 text-sm font-bold text-white whitespace-nowrap">
                          {r.title}
                          <p className="text-[10px] text-[#64748B] font-normal">{r.description}</p>
                        </td>
                        <td className="px-5 py-4 text-xs text-[#94A3B8] whitespace-nowrap">{r.expense_type_name || 'N/A'}</td>
                        <td className="px-5 py-4 text-xs text-[#CBD5E1] whitespace-nowrap">{r.paid_to || '—'}</td>
                        <td className="px-5 py-4 text-sm font-bold text-white whitespace-nowrap">₹{parseFloat(r.amount).toLocaleString()}</td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <span className="text-xs text-[#94A3B8] capitalize">{r.payment_mode.replace('_', ' ')}</span>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          {r.status === 'paid' ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">Paid</span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-400">Unpaid</span>
                          )}
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleEdit(r)} className="w-8 h-8 rounded-lg flex items-center justify-center text-[#60A5FA] hover:bg-blue-500/10 transition-colors"><FiEdit size={14} /></button>
                            <button onClick={() => handleDelete(r)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-500/10 transition-colors"><FiTrash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr><td colSpan={8} className="px-5 py-16 text-center text-[#64748B] text-sm">No expenses found for this month.</td></tr>
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

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1C2540] border border-white/10 rounded-2xl shadow-clay-admin-modal w-full max-w-2xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <h2 className="text-base font-bold text-white">{editMode ? 'Edit Expense' : 'Add New Expense'}</h2>
              <button onClick={closeModal} className="text-[#64748B] hover:text-white"><FiX size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Title</label>
                <input type="text" name="title" value={formData.title} onChange={handleInputChange} required className="admin-input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Amount</label>
                <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleInputChange} required className="admin-input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Date</label>
                <input type="date" name="expense_date" value={formData.expense_date} onChange={handleInputChange} required className="admin-input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Category / Type</label>
                <select name="expense_type_id" value={formData.expense_type_id} onChange={handleInputChange} className="admin-select text-[#94A3B8]">
                  <option value="">None</option>
                  {expenseTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Paid To</label>
                <input type="text" name="paid_to" value={formData.paid_to} onChange={handleInputChange} className="admin-input" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Payment Mode</label>
                <select name="payment_mode" value={formData.payment_mode} onChange={handleInputChange} required className="admin-select text-[#94A3B8]">
                  <option value="bank">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="petty_cash">Petty Cash</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Status</label>
                <select name="status" value={formData.status} onChange={handleInputChange} required className="admin-select text-[#94A3B8]">
                  <option value="paid">Paid</option>
                  <option value="unpaid">Unpaid</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">Description</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows="2" className="admin-input" />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3 mt-2">
                <button type="button" onClick={closeModal} className="px-4 py-2 text-sm font-semibold text-slate-300 border border-white/10 rounded-xl hover:bg-white/5 transition-colors">Cancel</button>
                <button type="submit" className="px-5 py-2 text-sm font-semibold bg-[#3B82F6] hover:bg-blue-500 text-white rounded-xl shadow-glow-blue-sm transition-all duration-200">
                  {editMode ? 'Save Changes' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminExpenses;
