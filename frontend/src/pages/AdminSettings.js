import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import AlertDialog from '../components/AlertDialog';
import AdminToast from '../components/AdminToast';
import { Spinner } from '../components/Loader';
import { getSettings, updateSettings } from '../services/api';
import { FiMapPin, FiClock, FiSave, FiShield, FiInfo, FiSliders, FiCheckCircle, FiCpu } from 'react-icons/fi';

/* ─── CUSTOM TOGGLE SWITCH ─── */
const ToggleSwitch = ({ checked, onChange }) => (
  <button 
    type="button" 
    onClick={onChange} 
    className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-300 focus:outline-none ${checked ? 'bg-emerald-500' : 'bg-admin-elevated border border-admin-border'}`}
  >
    <span className={`inline-block h-4 w-4 transform rounded-full bg-admin-elevated transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
  </button>
);

const SectionCard = ({ icon: Icon, iconBg, iconColor, title, children }) => (
  <div className="bg-admin-surface border border-admin-border rounded-2xl shadow-clay-admin overflow-hidden mb-6 animate-fadeInUp">
    <div className="flex items-center gap-3 px-6 py-5 border-b border-admin-border bg-admin-elevated">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border border-admin-border shadow-sm ${iconBg} ${iconColor}`}>
        <Icon size={18} />
      </div>
      <h2 className="text-sm font-bold text-admin-text tracking-wide">{title}</h2>
    </div>
    <div className="p-6 space-y-6">{children}</div>
  </div>
);

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-[10px] font-bold text-admin-secondary uppercase tracking-wider mb-2">{label}</label>
    {children}
    {hint && <p className="text-xs font-medium text-[#475569] mt-2">{hint}</p>}
  </div>
);

const AdminSettings = () => {
  const [settings, setSettings] = useState({ 
    latitude:'', longitude:'', allowedRadius:'', gpsAccuracyThreshold:100, 
    lateAfterTime:'', officeStartTime:'09:00', officeEndTime:'18:00', autoCheckoutTime:'18:32', halfDayThreshold:4, 
    checkInEnabled:true, checkOutEnabled:true, 
    officePublicIP:'', allowedIPs:'', 
    attendanceValidationMode:'location_or_network', attendanceRateLimit:5, trustedDeviceValidationEnabled:false,
    electronDesktopEnabled:true, electronDesktopValidationMode:'trusted_device_and_network',
    morningShiftStartTime:'09:30', morningLateAfterTime:'09:45', morningShiftEndTime:'13:30',
    lunchStartTime:'13:30', lunchEndTime:'14:00',
    eveningShiftStartTime:'14:00', eveningLateAfterTime:'14:00', eveningShiftEndTime:'17:30',
    admin_assistant_enabled: false
  });
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [alertDialog, setAlertDialog] = useState({ isOpen:false, title:'', message:'', type:'success' });
  const [toastConfig, setToastConfig] = useState({ message: '', type: 'success' });

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try { 
      setLoading(true); 
      const response = await getSettings(); 
      if (response.data.success) { 
        const s = response.data.settings; 
        setSettings({ 
          latitude:s.companyLocation.latitude, 
          longitude:s.companyLocation.longitude, 
          allowedRadius:s.companyLocation.allowedRadius, 
          gpsAccuracyThreshold:s.companyLocation.gpsAccuracyThreshold||100, 
          lateAfterTime:s.workingHours.lateAfterTime, 
          officeStartTime:s.workingHours.officeStartTime||'09:00', 
          officeEndTime:s.workingHours.officeEndTime||'18:00', 
          autoCheckoutTime:s.workingHours.autoCheckoutTime||'18:32', 
          halfDayThreshold:s.workingHours.halfDayThreshold||4, 
          checkInEnabled:s.workingHours.checkInEnabled!==undefined?s.workingHours.checkInEnabled:true, 
          checkOutEnabled:s.workingHours.checkOutEnabled!==undefined?s.workingHours.checkOutEnabled:true, 
          officePublicIP:s.network?.officePublicIP||'', 
          allowedIPs:s.network?.allowedIPs||'', 
          attendanceValidationMode:s.validation?.attendanceValidationMode||'location_or_network', 
          attendanceRateLimit:s.security?.attendanceRateLimit||5, 
          trustedDeviceValidationEnabled:s.trustedDevice?.validationEnabled||false,
          electronDesktopEnabled:s.electronDesktop?.enabled!==undefined?s.electronDesktop.enabled:true,
          electronDesktopValidationMode:s.electronDesktop?.validationMode||'trusted_device_and_network',
          morningShiftStartTime:s.shiftSettings?.morningShiftStartTime||'09:30',
          morningLateAfterTime:s.shiftSettings?.morningLateAfterTime||'09:45',
          morningShiftEndTime:s.shiftSettings?.morningShiftEndTime||'13:30',
          lunchStartTime:s.shiftSettings?.lunchStartTime||'13:30',
          lunchEndTime:s.shiftSettings?.lunchEndTime||'14:00',
          eveningShiftStartTime:s.shiftSettings?.eveningShiftStartTime||'14:00',
          eveningLateAfterTime:s.shiftSettings?.eveningLateAfterTime||'14:00',
          eveningShiftEndTime:s.shiftSettings?.eveningShiftEndTime||'17:30',
          admin_assistant_enabled: s.adminAssistant?.enabled !== undefined ? s.adminAssistant.enabled : false
        }); 
      } 
    }
    catch (error) { console.error(error); setAlertDialog({ isOpen:true, title:'Error', message:'Failed to load settings', type:'error' }); }
    finally { setLoading(false); }
  };

  const handleChange  = e => setSettings({ ...settings, [e.target.name]: e.target.value });
  const handleToggle  = field => setSettings({ ...settings, [field]: !settings[field] });
  
  const handleSubmit  = async e => {
    e.preventDefault(); setSaving(true);
    try { 
      const response = await updateSettings(settings); 
      if (response.data.success) setToastConfig({ message: 'Settings updated successfully', type: 'success' }); 
    }
    catch (error) { setAlertDialog({ isOpen:true, title:'Error', message: error.response?.data?.message || 'Failed to update settings', type:'error' }); }
    finally { setSaving(false); }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) { setAlertDialog({ isOpen:true, title:'Error', message:'Geolocation is not supported by your browser', type:'error' }); return; }
    navigator.geolocation.getCurrentPosition(position => { 
      setSettings({ ...settings, latitude:position.coords.latitude.toFixed(6), longitude:position.coords.longitude.toFixed(6) }); 
      setToastConfig({ message: 'Current location captured successfully!', type: 'success' }); 
    }, () => { 
      setAlertDialog({ isOpen:true, title:'Error', message:'Unable to get your location.', type:'error' }); 
    }, { enableHighAccuracy:true, timeout:10000, maximumAge:0 });
  };

  if (loading) return (
    <div className="flex h-screen bg-admin-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col items-center justify-center gap-4">
        <Spinner size={36} color="blue" />
        <p className="text-sm font-medium text-admin-secondary animate-pulse">Loading settings...</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-admin-bg dark-scroll relative">
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0 dark-scroll pb-24">
        <div className="px-5 py-6 lg:px-8 lg:py-8 max-w-4xl mx-auto pt-16 lg:pt-8">
          
          <div className="mb-8 animate-fadeInUp stagger-1">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-admin-heading tracking-tight">System Configuration</h1>
            <p className="text-sm text-admin-muted mt-1.5 font-medium">Manage office rules, security, and global application settings.</p>
          </div>

          <form id="settings-form" onSubmit={handleSubmit}>
            
            {/* 1. Office Configuration */}
            <div className="stagger-2"><SectionCard icon={FiMapPin} iconBg="bg-indigo-500/10" iconColor="text-indigo-400" title="Office Configuration">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Field label="Latitude" hint="Range: -90 to 90"><input type="number" step="0.000001" name="latitude" value={settings.latitude} onChange={handleChange} className="admin-input py-2.5 text-sm" placeholder="13.0827" required /></Field>
                <Field label="Longitude" hint="Range: -180 to 180"><input type="number" step="0.000001" name="longitude" value={settings.longitude} onChange={handleChange} className="admin-input py-2.5 text-sm" placeholder="80.2707" required /></Field>
                <Field label="Allowed Radius (meters)" hint="Employees must be within this distance to check in"><input type="number" name="allowedRadius" value={settings.allowedRadius} onChange={handleChange} className="admin-input py-2.5 text-sm" placeholder="100" required /></Field>
                <Field label="GPS Accuracy Threshold">
                  <select name="gpsAccuracyThreshold" value={settings.gpsAccuracyThreshold} onChange={handleChange} className="admin-select py-2.5 text-sm" required>
                    <option value="50">50m — Very High Accuracy</option>
                    <option value="100">100m — High Accuracy (Recommended)</option>
                    <option value="200">200m — Medium Accuracy</option>
                    <option value="300">300m — Low Accuracy</option>
                    <option value="500">500m — Very Low Accuracy</option>
                  </select>
                </Field>
              </div>
              <button type="button" onClick={getCurrentLocation} className="flex items-center gap-2 px-4 py-2.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-indigo-500/20 transition-colors">
                <FiMapPin size={14} /> Use My Current Location
              </button>
            </SectionCard></div>

            {/* 2. Working Hours */}
            <div className="stagger-3"><SectionCard icon={FiClock} iconBg="bg-amber-500/10" iconColor="text-amber-400" title="Working Hours">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Field label="Office Start Time"><input type="time" name="officeStartTime" value={settings.officeStartTime} onChange={handleChange} className="admin-input py-2.5 text-sm" required /></Field>
                <Field label="Office End Time"><input type="time" name="officeEndTime" value={settings.officeEndTime} onChange={handleChange} className="admin-input py-2.5 text-sm" required /></Field>
                <Field label="Late After Time" hint="Flagged as late after this"><input type="time" name="lateAfterTime" value={settings.lateAfterTime} onChange={handleChange} className="admin-input py-2.5 text-sm" required /></Field>
                <Field label="Auto Checkout Time" hint="System sweeps at this time"><input type="time" name="autoCheckoutTime" value={settings.autoCheckoutTime} onChange={handleChange} className="admin-input py-2.5 text-sm" required /></Field>
              </div>
            </SectionCard></div>

            {/* 3. Shift Late Calculation Settings */}
            <div className="stagger-3"><SectionCard icon={FiClock} iconBg="bg-rose-500/10" iconColor="text-rose-400" title="Shift Late Calculation Settings">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <Field label="Morning Shift Start Time"><input type="time" name="morningShiftStartTime" value={settings.morningShiftStartTime} onChange={handleChange} className="admin-input py-2.5 text-sm" required /></Field>
                <Field label="Morning Late After Time"><input type="time" name="morningLateAfterTime" value={settings.morningLateAfterTime} onChange={handleChange} className="admin-input py-2.5 text-sm" required /></Field>
                <Field label="Morning Shift End Time"><input type="time" name="morningShiftEndTime" value={settings.morningShiftEndTime} onChange={handleChange} className="admin-input py-2.5 text-sm" required /></Field>
                <Field label="Lunch Start Time"><input type="time" name="lunchStartTime" value={settings.lunchStartTime} onChange={handleChange} className="admin-input py-2.5 text-sm" required /></Field>
                
                <Field label="Lunch End Time"><input type="time" name="lunchEndTime" value={settings.lunchEndTime} onChange={handleChange} className="admin-input py-2.5 text-sm" required /></Field>
                <Field label="Evening Shift Start Time"><input type="time" name="eveningShiftStartTime" value={settings.eveningShiftStartTime} onChange={handleChange} className="admin-input py-2.5 text-sm" required /></Field>
                <Field label="Evening Late After Time"><input type="time" name="eveningLateAfterTime" value={settings.eveningLateAfterTime} onChange={handleChange} className="admin-input py-2.5 text-sm" required /></Field>
                <Field label="Evening Shift End Time"><input type="time" name="eveningShiftEndTime" value={settings.eveningShiftEndTime} onChange={handleChange} className="admin-input py-2.5 text-sm" required /></Field>
              </div>
            </SectionCard></div>

            {/* 4. Attendance Rules */}
            <div className="stagger-4"><SectionCard icon={FiSliders} iconBg="bg-emerald-500/10" iconColor="text-emerald-400" title="Attendance Rules">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <Field label="Half Day Threshold (hours)" hint="Working hours < threshold = Half Day">
                  <input type="number" step="0.5" name="halfDayThreshold" value={settings.halfDayThreshold} onChange={handleChange} className="admin-input py-2.5 text-sm" placeholder="4" required />
                </Field>
                <Field label="Attendance Validation Mode" hint='"Location OR Network" is recommended'>
                  <select name="attendanceValidationMode" value={settings.attendanceValidationMode} onChange={handleChange} className="admin-select py-2.5 text-sm" required>
                    <option value="location_only">Location Only — GPS validation required</option>
                    <option value="network_only">Network Only — Office IP validation required</option>
                    <option value="location_or_network">Location OR Network — Either passes</option>
                    <option value="location_and_network">Location AND Network — Both required</option>
                  </select>
                </Field>
              </div>
              <div className="space-y-1 divide-y divide-white/[0.04] bg-admin-elevated border border-admin-border rounded-2xl">
                {[
                  { field:'checkInEnabled', label:'Enable Global Check-In', desc:'Allow employees to check in to the system' }, 
                  { field:'checkOutEnabled', label:'Enable Global Check-Out', desc:'Allow employees to check out of the system' }, 
                  { field:'trustedDeviceValidationEnabled', label:'Strict Trusted Device Validation', desc:'Skip GPS/IP checks but only allow approved devices to mark attendance' }
                ].map(({ field, label, desc }) => (
                  <div key={field} className="flex items-center justify-between p-4 hover:bg-admin-elevated/[0.02] transition-colors rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-admin-text mb-0.5">{label}</p>
                      <p className="text-xs font-medium text-admin-secondary">{desc}</p>
                    </div>
                    <ToggleSwitch checked={settings[field]} onChange={() => handleToggle(field)} />
                  </div>
                ))}
              </div>
            </SectionCard></div>

            {/* Electron Desktop Configuration */}
            <div className="stagger-5"><SectionCard icon={FiSliders} iconBg="bg-blue-500/10" iconColor="text-blue-400" title="Electron Desktop Attendance Validation">
              <div className="space-y-1 divide-y divide-white/[0.04] bg-admin-elevated border border-admin-border rounded-2xl mb-6">
                <div className="flex items-center justify-between p-4 hover:bg-admin-elevated/[0.02] transition-colors rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-admin-text mb-0.5">Enable Electron Desktop Attendance</p>
                    <p className="text-xs font-medium text-admin-secondary">Allow employees to check in using the desktop app</p>
                  </div>
                  <ToggleSwitch checked={settings.electronDesktopEnabled} onChange={() => handleToggle('electronDesktopEnabled')} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-6">
                <Field label="Electron Desktop Validation Mode" hint="Recommended for office desktop systems: Trusted Device AND Network/IP. Use Location options only if Electron GPS works correctly on that system.">
                  <select name="electronDesktopValidationMode" value={settings.electronDesktopValidationMode} onChange={handleChange} className="admin-select py-2.5 text-sm" required>
                    <option value="trusted_device_only">Trusted Device Only</option>
                    <option value="network_only">Network/IP Only</option>
                    <option value="trusted_device_or_network">Trusted Device OR Network/IP</option>
                    <option value="trusted_device_and_network">Trusted Device AND Network/IP</option>
                    <option value="location_only">Location Only</option>
                    <option value="location_and_trusted_device">Location AND Trusted Device</option>
                    <option value="location_and_network">Location AND Network/IP</option>
                    <option value="location_and_trusted_device_and_network">Location AND Trusted Device AND Network/IP</option>
                  </select>
                </Field>
              </div>
            </SectionCard></div>

            {/* 4. Security */}
            <div className="stagger-6"><SectionCard icon={FiShield} iconBg="bg-purple-500/10" iconColor="text-purple-400" title="Security & Network">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                <Field label="Attendance Rate Limit" hint="Max attendance requests per minute per employee">
                  <input type="number" name="attendanceRateLimit" value={settings.attendanceRateLimit} onChange={handleChange} min="1" max="20" className="admin-input py-2.5 text-sm" required />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Field label="Office Public IP" hint="Primary office public IP address for network validation">
                  <input type="text" name="officePublicIP" value={settings.officePublicIP} onChange={handleChange} className="admin-input py-2.5 text-sm" placeholder="e.g. 122.165.45.100 (optional)" />
                </Field>
                <Field label="Additional Allowed IPs" hint="Multiple IPs separated by commas">
                  <textarea name="allowedIPs" value={settings.allowedIPs} onChange={handleChange} rows="2" className="admin-input py-2.5 text-sm resize-none" placeholder="122.165.45.101, 122.165.45.102 (optional)" />
                </Field>
              </div>
            </SectionCard></div>

            {/* 5. Admin Assistant Bot */}
            <div className="stagger-6"><SectionCard icon={FiCpu} iconBg="bg-blue-500/10" iconColor="text-blue-400" title="Admin Assistant Bot">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-admin-elevated border border-admin-border rounded-xl">
                <div>
                  <h3 className="text-sm font-bold text-admin-text">Enable Admin Assistant Bot</h3>
                  <p className="text-xs text-admin-muted mt-1 font-medium">Enable or disable the floating admin assistant bot in the admin panel.</p>
                </div>
                <ToggleSwitch checked={settings.admin_assistant_enabled} onChange={() => handleToggle('admin_assistant_enabled')} />
              </div>
            </SectionCard></div>

            {/* System Info Box */}
            <div className="flex gap-4 p-5 bg-blue-500/10 border border-blue-500/20 rounded-2xl animate-fadeInUp stagger-6 mb-8">
              <FiInfo size={20} className="text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-xs font-medium text-admin-muted space-y-1.5">
                <p className="font-bold text-blue-300 text-sm mb-2">Important Information</p>
                <p>• All settings changes apply immediately without requiring a server restart.</p>
                <p>• Check-in/Check-out toggles control whether the buttons appear on the employee dashboard.</p>
                <p>• Ensure network validation settings correctly match your office router's public IP address.</p>
              </div>
            </div>

          </form>
        </div>
      </div>
      
      {/* ═══ FIXED SAVE ACTION BAR ═══ */}
      <div className="fixed bottom-0 left-0 lg:left-64 right-0 p-4 bg-admin-bg backdrop-blur-xl border-t border-admin-border z-40 animate-slideUp">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-admin-secondary">
            <FiCheckCircle size={14} className="text-emerald-500" /> All systems operational
          </div>
          <button type="submit" form="settings-form" disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-[0_4px_16px_rgba(59,130,246,0.3)] hover:-translate-y-0.5">
            {saving ? <><Spinner size="sm" color="white" /> Saving Configuration…</> : <><FiSave size={16} /> Save Changes</>}
          </button>
        </div>
      </div>

      <AlertDialog isOpen={alertDialog.isOpen} onClose={() => setAlertDialog({ ...alertDialog, isOpen:false })} title={alertDialog.title} message={alertDialog.message} type={alertDialog.type} />
      <AdminToast 
        message={toastConfig.message} 
        type={toastConfig.type} 
        onClose={() => setToastConfig({ message: '', type: 'success' })} 
      />
    </div>
  );
};

export default AdminSettings;
