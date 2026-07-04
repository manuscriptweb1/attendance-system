import React, { useState, useEffect, useMemo } from 'react';
import Sidebar from '../components/Sidebar';
import ConfirmDialog from '../components/ConfirmDialog';
import AlertDialog from '../components/AlertDialog';
import AdminToast from '../components/AdminToast';
import ClearRangeDialog from '../components/ClearRangeDialog';
import { Spinner } from '../components/Loader';
import { FiUmbrella, FiPlus, FiEdit2, FiTrash2, FiCalendar, FiSun, FiMap, FiCheckCircle } from 'react-icons/fi';
import { getAllHolidays, addHoliday, updateHoliday, deleteHoliday, toggleHolidayStatus, clearHolidayRange } from '../services/api';
import { formatDate } from '../utils/formatTime';
import { getErrorMessage } from '../utils/errorHandler';
import { validateDateString } from '../utils/dateValidation';

/* ─── CUSTOM TOGGLE SWITCH ─── */
const ToggleSwitch = ({ checked, onChange }) => (
  <button 
    type="button" onClick={(e) => { e.stopPropagation(); onChange(); }}
    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-300 focus:outline-none ${checked ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : 'bg-admin-elevated border border-admin-border'}`}
  >
    <span className={`inline-block h-3 w-3 transform rounded-full bg-admin-elevated transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
  </button>
);

// Glassmorphism Modal
const HolidayModal = ({ show, onClose, onSave, title, formData, handleInput }) => {
  if (!show) return null;
  return (
    <div className="fixed inset-0 bg-admin-overlay backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
      <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-[0_16px_40px_rgba(0,0,0,0.4)] w-full max-w-md animate-scale-in flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-admin-border bg-admin-surface shrink-0">
          <h2 className="text-sm font-bold text-admin-text flex items-center gap-2"><FiUmbrella className="text-blue-400" /> {title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-admin-secondary hover:bg-admin-elevated hover:text-admin-text transition-colors">✕</button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto">
          <div>
            <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Holiday Date</label>
            <input type="date" name="holiday_date" value={formData.holiday_date} onChange={handleInput} required className="admin-input py-2.5 text-xs w-full" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Holiday Type</label>
            <select name="holiday_type" value={formData.holiday_type} onChange={handleInput} className="admin-select py-2.5 text-xs w-full text-admin-text">
              <option value="Government Holiday">🏛️ Government Holiday</option>
              <option value="Office Holiday">🏢 Office Holiday</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Title</label>
            <input type="text" name="holiday_title" value={formData.holiday_title} onChange={handleInput} required placeholder="e.g. Independence Day" className="admin-input py-2.5 text-xs w-full" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">Note (Optional)</label>
            <textarea name="holiday_note" value={formData.holiday_note} onChange={handleInput} rows={2} placeholder="Additional details..." className="admin-input py-2.5 text-xs w-full resize-none" />
          </div>
          <div className="flex items-center justify-between p-3 bg-admin-elevated border border-admin-border rounded-xl">
            <div>
              <p className="text-xs font-bold text-admin-text">Enable Holiday</p>
              <p className="text-[10px] text-admin-muted mt-0.5">Will be active for attendance calculations</p>
            </div>
            <ToggleSwitch checked={formData.is_enabled} onChange={() => handleInput({ target: { name: 'is_enabled', type: 'checkbox', checked: !formData.is_enabled }})} />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-admin-border bg-admin-surface rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-admin-muted border border-admin-border rounded-xl hover:bg-admin-elevated transition-colors">Cancel</button>
          <button onClick={onSave} className="px-6 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-[0_4px_12px_rgba(59,130,246,0.3)] transition-colors">Save</button>
        </div>
      </div>
    </div>
  );
};

const AdminHolidays = () => {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedHoliday, setSelectedHoliday] = useState(null);
  const [formData, setFormData] = useState({ holiday_date:'', holiday_type:'Government Holiday', holiday_title:'', holiday_note:'', is_enabled:true });
  const [confirmDialog, setConfirmDialog] = useState({ isOpen:false, title:'', message:'', onConfirm:null, type:'danger' });
  const [alertDialog, setAlertDialog] = useState({ isOpen:false, title:'', message:'', type:'success' });
  const [toastConfig, setToastConfig] = useState({ message: '', type: 'success' });
  const [clearDialog, setClearDialog] = useState({ isOpen: false, isLoading: false });

  useEffect(() => { fetchHolidays(); }, []);

  const fetchHolidays = async () => {
    setLoading(true);
    try { const r = await getAllHolidays(); if (r.data.success) setHolidays(r.data.holidays || []); }
    catch (e) { setAlertDialog({ isOpen:true, title:'Error', message: getErrorMessage(e), type:'error' }); }
    finally { setLoading(false); }
  };

  const handleInput = e => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setFormData(f => ({ ...f, [e.target.name]: v })); };
  const resetForm = () => setFormData({ holiday_date:'', holiday_type:'Government Holiday', holiday_title:'', holiday_note:'', is_enabled:true });

  const handleAdd = async () => {
    const dateError = validateDateString(formData.holiday_date, { allowFuture: true });
    if (dateError) { setAlertDialog({ isOpen:true, title:'Error', message: dateError, type:'error' }); return; }
    try { const r = await addHoliday(formData); if (r.data.success) { setToastConfig({ message: 'Holiday added!', type: 'success' }); setShowAddModal(false); resetForm(); fetchHolidays(); } }
    catch (e) { setAlertDialog({ isOpen:true, title:'Error', message: getErrorMessage(e), type:'error' }); }
  };
  const handleEdit = async () => {
    const dateError = validateDateString(formData.holiday_date, { allowFuture: true });
    if (dateError) { setAlertDialog({ isOpen:true, title:'Error', message: dateError, type:'error' }); return; }
    try { const r = await updateHoliday(selectedHoliday.id, formData); if (r.data.success) { setToastConfig({ message: 'Holiday updated!', type: 'success' }); setShowEditModal(false); resetForm(); setSelectedHoliday(null); fetchHolidays(); } }
    catch (e) { setAlertDialog({ isOpen:true, title:'Error', message: getErrorMessage(e), type:'error' }); }
  };
  const handleToggle = async holiday => {
    try { const r = await toggleHolidayStatus(holiday.id, !holiday.is_enabled); if (r.data.success) fetchHolidays(); }
    catch (e) { setAlertDialog({ isOpen:true, title:'Error', message: getErrorMessage(e), type:'error' }); }
  };
  const handleDelete = holiday => setConfirmDialog({
    isOpen:true, title:'Delete Holiday', type:'danger',
    message:`Delete "${holiday.holiday_title}"? This cannot be undone.`,
    onConfirm: async () => {
      try { const r = await deleteHoliday(holiday.id); if (r.data.success) { setToastConfig({ message: 'Deleted!', type: 'success' }); fetchHolidays(); } }
      catch (e) { setAlertDialog({ isOpen:true, title:'Error', message: getErrorMessage(e), type:'error' }); }
    },
  });
  const openEdit = holiday => { setSelectedHoliday(holiday); setFormData({ holiday_date: holiday.holiday_date.split('T')[0], holiday_type: holiday.holiday_type, holiday_title: holiday.holiday_title, holiday_note: holiday.holiday_note || '', is_enabled: holiday.is_enabled }); setShowEditModal(true); };

  const handleClearRange = async (data) => {
    try {
      setClearDialog(prev => ({ ...prev, isLoading: true }));
      const response = await clearHolidayRange(data);
      if (response.data.success) {
        setClearDialog({ isOpen: false, isLoading: false });
        setToastConfig({ message: response.data.message || 'Records cleared successfully.', type: 'success' });
        fetchHolidays();
      } else {
        setClearDialog(prev => ({ ...prev, isLoading: false }));
        setAlertDialog({ isOpen: true, title: 'Error', message: response.data.message || 'Failed to clear holidays', type: 'error' });
      }
    } catch (error) {
      setClearDialog(prev => ({ ...prev, isLoading: false }));
      setAlertDialog({ isOpen: true, title: 'Error', message: getErrorMessage(error), type: 'error' });
    }
  };

  /* ─── STATS ─── */
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    
    let upcoming = 0, past = 0, paid = 0, restricted = 0, weekend = 0;
    
    holidays.forEach(h => {
      const d = new Date(h.holiday_date);
      if (d >= today) upcoming++; else past++;
      if (h.holiday_type === 'Government Holiday') paid++; else restricted++;
      if (d.getDay() === 0 || d.getDay() === 6) weekend++;
    });

    return { total: holidays.length, upcoming, past, paid, restricted, weekend };
  }, [holidays]);

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll selection:bg-blue-500/30">
      <Sidebar />
      <div className="flex-1 overflow-y-auto dark-scroll pb-24 relative">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-[1600px] mx-auto pt-16 lg:pt-8 animate-fadeIn">
          
          <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-extrabold text-admin-heading tracking-tight drop-shadow-md">Holiday Management</h1>
              <p className="text-sm text-admin-muted mt-1.5 font-medium">Configure organization-wide holidays and non-working days.</p>
            </div>
            {/* Floating Add Button for Mobile */}
            <div className="fixed bottom-6 right-6 z-40 md:relative md:bottom-0 md:right-0 flex items-center gap-3">
              <button onClick={() => setClearDialog({ isOpen: true })} className="flex items-center gap-2 bg-admin-surface border border-red-500/30 hover:border-red-500 hover:bg-red-500/10 text-red-500 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm">
                <FiTrash2 size={16} />
                <span className="hidden md:inline">Clear Holidays</span>
              </button>
              <button onClick={() => { resetForm(); setShowAddModal(true); }} className="w-14 h-14 md:w-auto md:h-auto flex items-center justify-center md:px-5 md:py-2.5 bg-blue-600 hover:bg-blue-500 text-white md:text-xs md:font-bold rounded-full md:rounded-xl shadow-[0_8px_24px_rgba(59,130,246,0.4)] hover:shadow-[0_12px_28px_rgba(59,130,246,0.5)] transition-all hover:-translate-y-1">
                <FiPlus size={24} className="md:w-4 md:h-4 md:mr-2" />
                <span className="hidden md:inline">Add Holiday</span>
              </button>
            </div>
          </div>

          {/* Stat Cards - CSS Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
            {[
              { label:'Total Holidays',   value:stats.total,     color:'text-blue-400',    icon:FiUmbrella },
              { label:'Upcoming Holidays',value:stats.upcoming,  color:'text-emerald-400', icon:FiSun },
              { label:'Past Holidays',    value:stats.past,      color:'text-purple-400',  icon:FiCalendar },
              { label:'Paid Holidays',    value:stats.paid,      color:'text-amber-400',   icon:FiCheckCircle },
              { label:'Restricted Holidays',value:stats.restricted,color:'text-indigo-400',icon:FiMap },
              { label:'Weekend Holidays', value:stats.weekend,   color:'text-orange-400',  icon:FiUmbrella },
            ].map((s, i) => (
              <div key={i} className={`bg-admin-elevated border border-admin-border rounded-2xl p-4 shadow-clay-admin overflow-hidden relative group hover:-translate-y-1 transition-transform duration-300 flex flex-col justify-between`}>
                <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-full bg-admin-elevated opacity-0 group-hover:opacity-100 transition-opacity`} />
                <div className="flex items-center justify-between mb-2 relative z-10">
                  <s.icon size={14} className={s.color} />
                </div>
                <div className="relative z-10">
                  <p className={`text-2xl font-extrabold ${s.color} drop-shadow-sm`}>{s.value}</p>
                  <p className="text-[10px] font-bold text-admin-secondary uppercase tracking-widest mt-1">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Holiday List */}
          <div className="bg-admin-elevated border border-admin-border rounded-2xl shadow-clay-admin overflow-hidden flex flex-col min-h-[500px]">
            <div className="flex items-center px-6 py-4 border-b border-admin-border bg-admin-surface backdrop-blur-md">
              <h2 className="text-sm font-bold text-admin-text flex items-center gap-2"><FiUmbrella className="text-blue-400" /> Holiday Calendar</h2>
            </div>
            
            <div className="flex-1 table-responsive overflow-y-auto max-h-[600px] dark-scroll relative">
              {loading ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-admin-elevated backdrop-blur-sm z-20">
                  <Spinner size={40} color="blue" />
                  <p className="text-xs font-bold text-blue-400 mt-4 animate-pulse">Syncing Holidays...</p>
                </div>
              ) : holidays.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-20 text-admin-secondary">
                  <div className="w-16 h-16 rounded-2xl bg-admin-elevated/[0.02] flex items-center justify-center mb-4"><FiUmbrella size={32} className="opacity-20" /></div>
                  <p className="text-sm font-bold">No holidays configured</p>
                  <p className="text-xs mt-1">Click the button above to add your first holiday.</p>
                </div>
              ) : (
                <div className="min-w-[800px]">
                  <table className="min-w-full relative">
                    <thead>
                      <tr>
                        {['Date', 'Holiday Title', 'Type', 'Notes', 'Status', 'Actions'].map((h) => (
                          <th key={h} className="px-6 py-4 text-left text-[10px] font-bold text-admin-secondary uppercase tracking-widest whitespace-nowrap bg-admin-bg sticky top-0 backdrop-blur-md z-10">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {holidays.map((h) => (
                        <tr key={h.id} className="group border-b border-admin-border hover:bg-admin-elevated/[0.02] transition-colors">
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className="block text-sm font-bold text-admin-text">{formatDate(h.holiday_date)}</span>
                            <span className="text-[10px] text-admin-secondary font-mono">{new Date(h.holiday_date).toLocaleDateString('en-US', { weekday: 'long' })}</span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className="text-sm font-extrabold text-admin-secondary group-hover:text-blue-400 transition-colors">{h.holiday_title}</span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${h.holiday_type === 'Government Holiday' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                              {h.holiday_type === 'Government Holiday' ? '🏛️ Govt' : '🏢 Office'}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <span className="text-xs text-admin-muted line-clamp-2 max-w-xs">{h.holiday_note || '—'}</span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <ToggleSwitch checked={h.is_enabled} onChange={() => handleToggle(h)} />
                              <span className={`text-[10px] font-bold uppercase tracking-widest ${h.is_enabled ? 'text-emerald-400' : 'text-admin-secondary'}`}>{h.is_enabled ? 'Active' : 'Disabled'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-right">
                            <div className="flex items-center gap-2 opacity-100 transition-opacity">
                              <button onClick={() => openEdit(h)} className="w-8 h-8 rounded-lg bg-admin-surface text-[#60A5FA] border border-admin-border hover:bg-blue-500/20 hover:border-blue-500/30 flex items-center justify-center transition-all shadow-sm"><FiEdit2 size={13} /></button>
                              <button onClick={() => handleDelete(h)} className="w-8 h-8 rounded-lg bg-red-500/5 text-red-500/50 border border-red-500/10 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/10 flex items-center justify-center transition-all shadow-sm"><FiTrash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <HolidayModal key="add" show={showAddModal} onClose={() => setShowAddModal(false)} onSave={handleAdd} title="Add New Holiday" formData={formData} handleInput={handleInput} />
      <HolidayModal key="edit" show={showEditModal} onClose={() => setShowEditModal(false)} onSave={handleEdit} title="Edit Holiday" formData={formData} handleInput={handleInput} />
      
      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(d => ({ ...d, isOpen:false }))} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} confirmText="Delete" />
      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog(d => ({ ...d, isOpen:false }))} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
      
      <ClearRangeDialog 
        isOpen={clearDialog.isOpen} 
        onClose={() => setClearDialog({ isOpen: false })} 
        onConfirm={handleClearRange} 
        title="Clear Holidays Range" 
        message="⚠️ WARNING: This will permanently delete ALL holidays for the selected date range. This action cannot be undone." 
        isLoading={clearDialog.isLoading}
      />

      <AdminToast 
        message={toastConfig.message} 
        type={toastConfig.type} 
        onClose={() => setToastConfig({ message: '', type: 'success' })} 
      />
    </div>
  );
};

export default AdminHolidays;
