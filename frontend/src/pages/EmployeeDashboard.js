import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import Sidebar from '../components/Sidebar';
import ConfirmDialog from '../components/ConfirmDialog';
import LocationDialog from '../components/LocationDialog';
import AlertDialog from '../components/AlertDialog';
import StatusBadge from '../components/ui/StatusBadge';
import MotivationPopup from '../components/MotivationPopup';
import { Spinner } from '../components/Loader';
import { getTodayAttendance, checkIn, checkOut, getWFHStatus, getSettings, getEmployeeMonthlyAttendance } from '../services/api';
import { getDailyMotivation, getEventMotivation, CATEGORIES } from '../utils/motivationUtil';
import { mapErrorToDialogConfig } from '../utils/errorMapper';
import { getCurrentLocation, getDeviceInfo, getDeviceFingerprintData, getIPAddress } from '../utils/location';
import { formatTime, formatWorkingHours, format24To12Hour, formatDate } from '../utils/formatTime';
import {
  FiLogIn, FiLogOut, FiClock, FiCheckCircle, FiAlertCircle, FiInfo,
  FiCalendar, FiTrendingUp, FiSun, FiMoon, FiSunrise, FiActivity,
  FiBriefcase, FiHome, FiTarget, FiZap, FiBell, FiBarChart2, FiAward
} from 'react-icons/fi';

/* ─── Constants ─── */
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ─── Helpers ─── */
const formatLiveTimer = (totalSeconds) => {
  if (totalSeconds <= 0) return '00:00:00';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const toLocalDateStr = (d) => {
  const dt = new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

/* ════════════════════════════════════════════════════════════════ */

const EmployeeDashboard = () => {
  /* ─── Existing State (unchanged) ─── */
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading]               = useState(true);
  const [isCheckingIn, setIsCheckingIn]     = useState(false);
  const [checkInMessage, setCheckInMessage] = useState('');
  const [isCheckingOut, setIsCheckingOut]   = useState(false);
  const [checkOutMessage, setCheckOutMessage] = useState('');
  const [wfhEnabled, setWfhEnabled]         = useState(false);
  const [checkInEnabled, setCheckInEnabled] = useState(true);
  const [checkOutEnabled, setCheckOutEnabled] = useState(true);
  const [settings, setSettings]             = useState(null);

  const [confirmDialog, setConfirmDialog]   = useState({ isOpen:false, title:'', message:'', onConfirm:null, type:'info' });
  const [locationDialog, setLocationDialog] = useState({ isOpen:false, title:'', message:'', type:'permission', onAllow:null });
  const [alertDialog, setAlertDialog]       = useState({ isOpen:false, title:'', message:'', type:'success' });

  /* ─── New State ─── */
  const [monthlyAttendance, setMonthlyAttendance] = useState([]);
  const [monthlyHolidays, setMonthlyHolidays]     = useState([]);
  const [dashboardStats, setDashboardStats]       = useState(null);
  const [currentTime, setCurrentTime]             = useState(new Date());
  const [liveSeconds, setLiveSeconds]             = useState(0);
  
  const [motivationPopup, setMotivationPopup]     = useState({ isOpen: false, message: null });
  const [dailyMotivation, setDailyMotivation]     = useState({ text: 'Have a great day!', icon: '🌟' });

  const { user } = useAuth();

  /* ─── Live Clock ─── */
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* ─── Data Fetch (MODIFIED — added monthly attendance call) ─── */
  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  const fetchData = async () => {
    try {
      const now = new Date();
      const [attendanceRes, wfhRes, settingsRes, monthlyRes] = await Promise.all([
        getTodayAttendance(),
        getWFHStatus(),
        getSettings(),
        getEmployeeMonthlyAttendance(now.getMonth() + 1, now.getFullYear()),
      ]);
      if (attendanceRes.data.success) {
        const attendance = attendanceRes.data.attendance;
        setTodayAttendance(attendance);
        
        // Attendance Session Recovery: 
        // If the user cleared local storage but has an active session on the same device, restore it.
        if (attendance && attendance.session_id && !localStorage.getItem('attendance_session_id')) {
          localStorage.setItem('attendance_session_id', attendance.session_id);
        }
      }
      if (wfhRes.data.success) setWfhEnabled(wfhRes.data.wfh_enabled);
      if (settingsRes.data.success) {
        setSettings(settingsRes.data.settings);
        setCheckInEnabled(settingsRes.data.settings.workingHours.checkInEnabled !== undefined ? settingsRes.data.settings.workingHours.checkInEnabled : true);
        setCheckOutEnabled(settingsRes.data.settings.workingHours.checkOutEnabled !== undefined ? settingsRes.data.settings.workingHours.checkOutEnabled : true);
      } else { setAlertDialog({ isOpen:true, title:'Error', message:'Failed to load settings. Please refresh.', type:'error' }); }
      if (monthlyRes.data.success) {
        setMonthlyAttendance(monthlyRes.data.attendance || []);
        setMonthlyHolidays(monthlyRes.data.holidays || []);
        if (monthlyRes.data.dashboardStats) {
          setDashboardStats(monthlyRes.data.dashboardStats);
        }

        // Dynamic Motivation Setup
        const holidays = monthlyRes.data.holidays || [];
        const attendanceList = monthlyRes.data.attendance || [];
        const todayStr = toLocalDateStr(new Date());
        
        const isGovtHoliday = holidays.some(h => h.type === 'Government' && h.date === todayStr);
        const isOfficeHoliday = holidays.some(h => h.type === 'Office' && h.date === todayStr);
        
        // Auto-checkout check for yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = toLocalDateStr(yesterday);
        const yesterdayAtt = attendanceList.find(a => toLocalDateStr(a.attendance_date) === yesterdayStr);
        
        // Assume auto-checkout if there was a login but no logout, or if status says auto checkout
        const hasAutoCheckout = yesterdayAtt && yesterdayAtt.login_time && (!yesterdayAtt.logout_time || yesterdayAtt.attendance_status === 'Auto Checkout');
        
        // Birthday check
        let isBirthday = false;
        if (user?.date_of_birth) {
          const dob = new Date(user.date_of_birth);
          const today = new Date();
          if (dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate()) {
            isBirthday = true;
          }
        } 

        const msg = getDailyMotivation(new Date().getDay(), isGovtHoliday, isOfficeHoliday, isBirthday, hasAutoCheckout);
        setDailyMotivation({ ...msg, isBirthday });

        // Trigger Birthday Popup only once per session
        if (isBirthday && !sessionStorage.getItem('birthday_popup_shown')) {
          setTimeout(() => {
            setMotivationPopup({ isOpen: true, message: msg });
            sessionStorage.setItem('birthday_popup_shown', 'true');
          }, 1500);
        }
      }
    } catch (e) {
      console.error(e);
      setAlertDialog({ isOpen:true, title:'Error', message:'Failed to load data. Please refresh.', type:'error' });
    } finally { setLoading(false); }
  };

  /* ════════════════════════════════════════════════════════════════
     ▐  EXISTING HANDLERS — COMPLETELY UNCHANGED
     ════════════════════════════════════════════════════════════════ */

  const handleCheckIn = () => {
    if (!navigator.onLine) {
      window.dispatchEvent(new CustomEvent('showGlobalError', { detail: mapErrorToDialogConfig({ code: 'ERR_NETWORK', message: 'Network Error' }) }));
      return;
    }
    if (!settings) { setAlertDialog({ isOpen:true, title:'Error', message:'Settings not loaded. Please refresh.', type:'error' }); return; }
    setConfirmDialog({
      isOpen:true, title:'Check In', type:'info',
      message: wfhEnabled ? 'Are you sure you want to check in? Your current location will be recorded.' : `Are you sure you want to check in? You must be within ${settings.companyLocation.allowedRadius} meters of the office.`,
      onConfirm: async () => {
        setIsCheckingIn(true);
        try {
          const isElectron = window.attendanceDesktop?.isDesktopApp === true;
          const electronMode = settings.electronDesktop?.validationMode || 'trusted_device_and_network';
          const locationNotRequired = isElectron && ['trusted_device_only', 'network_only', 'trusted_device_or_network', 'trusted_device_and_network'].includes(electronMode);

          const performCheckIn = async (location = null) => {
            try {
              setCheckInMessage('Collecting device information...');
              const deviceInfo = getDeviceInfo(); const fingerprintData = getDeviceFingerprintData(); const ipAddress = await getIPAddress();
              setCheckInMessage('Marking attendance...');
              const data = { 
                latitude: location?.latitude, 
                longitude: location?.longitude, 
                accuracy: location?.accuracy, 
                address: location ? 'Location captured' : 'Location skipped by desktop policy', 
                device_info: deviceInfo.device_info, 
                browser_info: deviceInfo.browser_info, 
                screenResolution: fingerprintData.screenResolution, 
                timezone: fingerprintData.timezone, 
                ip_address: ipAddress,
                isElectronDesktop: isElectron,
                locationSkippedReason: locationNotRequired ? 'electron-desktop-validation-mode' : undefined,
                electronValidationMode: isElectron ? electronMode : undefined
              };
              const response = await checkIn(data);
              if (response.data.success) { 
                if (response.data.sessionId) {
                  localStorage.setItem('attendance_session_id', response.data.sessionId);
                }
                setCheckInMessage(''); 
                const status = response.data.attendance?.attendance_status;
                let category = CATEGORIES.CHECK_IN_NORMAL;
                if (status === 'Late') category = CATEGORIES.CHECK_IN_LATE;
                else if (status === 'Half Day') category = CATEGORIES.HALF_DAY;
                
                const msg = getEventMotivation(category);
                
                setAlertDialog({ 
                  isOpen: true, 
                  title: '✅ Check-in Successful', 
                  message: 'Your attendance has been recorded successfully!', 
                  type: 'success',
                  onCloseCallback: () => {
                    setTimeout(() => setMotivationPopup({ isOpen: true, message: msg }), 400); // Wait for alert to fade out
                  }
                }); 
                
                await fetchData(); 
              }
              else { setCheckInMessage(''); setAlertDialog({ isOpen:true, title:'❌ Check-in Failed', message:response.data.message || 'Check-in failed. Please try again.', type:'error' }); }
            } catch (error) {
              setCheckInMessage('');
              if (!error.isGlobalError) {
                const config = mapErrorToDialogConfig(error);
                window.dispatchEvent(new CustomEvent('showGlobalError', { detail: config }));
              }
            } finally { setIsCheckingIn(false); setCheckInMessage(''); }
          };

          if (locationNotRequired) {
            await performCheckIn(null);
          } else {
            setCheckInMessage('Requesting location permission...');
            setLocationDialog({ isOpen:true, title:settings.messages.locationPermissionTitle, message:settings.messages.locationPermissionMessage, type:'permission',
              onAllow: async () => {
                try {
                  setCheckInMessage('Getting your location...');
                  const location = await getCurrentLocation();
                  await performCheckIn(location);
                } catch (error) {
                  setIsCheckingIn(false); setCheckInMessage('');
                  if (isElectron && (error.type === 'denied' || error.type === 'unavailable' || error.type === 'timeout')) {
                    window.dispatchEvent(new CustomEvent('showGlobalError', { detail: mapErrorToDialogConfig({ response: { data: { errorCode: 'DESKTOP_GPS_NOT_AVAILABLE' } } }) }));
                  } else {
                    window.dispatchEvent(new CustomEvent('showGlobalError', { detail: mapErrorToDialogConfig(error) }));
                  }
                }
              },
            });
          }
        } catch (e) { setIsCheckingIn(false); setCheckInMessage(''); }
      },
    });
  };

  const handleCheckOut = () => {
    if (!navigator.onLine) {
      window.dispatchEvent(new CustomEvent('showGlobalError', { detail: mapErrorToDialogConfig({ code: 'ERR_NETWORK', message: 'Network Error' }) }));
      return;
    }
    if (!settings) { setAlertDialog({ isOpen:true, title:'Error', message:'Settings not loaded. Please refresh.', type:'error' }); return; }
    setConfirmDialog({
      isOpen:true, title:'Check Out', type:'warning',
      message:'Are you sure you want to check out? Your working hours will be calculated and recorded.',
      onConfirm: async () => {
        setIsCheckingOut(true);
        try {
          const isElectron = window.attendanceDesktop?.isDesktopApp === true;
          const electronMode = settings.electronDesktop?.validationMode || 'trusted_device_and_network';
          const locationNotRequired = isElectron && ['trusted_device_only', 'network_only', 'trusted_device_or_network', 'trusted_device_and_network'].includes(electronMode);

          const performCheckOut = async (location = null) => {
            try {
              setCheckOutMessage('Collecting device information...');
              const deviceInfo = getDeviceInfo();
              const fingerprintData = getDeviceFingerprintData();
              setCheckOutMessage('Processing check-out...');
              const data = {
                latitude: location?.latitude,
                longitude: location?.longitude,
                address: location ? 'Location captured' : 'Location skipped by desktop policy',
                device_info: deviceInfo.device_info,
                browser_info: deviceInfo.browser_info,
                screenResolution: fingerprintData.screenResolution,
                timezone: fingerprintData.timezone,
                sessionId: localStorage.getItem('attendance_session_id'),
                isElectronDesktop: isElectron,
                locationSkippedReason: locationNotRequired ? 'electron-desktop-validation-mode' : undefined,
                electronValidationMode: isElectron ? electronMode : undefined
              };
              const response = await checkOut(data);
              
              if (response.data.success) {
                setCheckOutMessage('');
                // Trigger Popup Motivation AFTER the success alert is closed
                const workingHours = parseFloat(response.data.attendance?.total_working_hours || 0);
                const isEarly = workingHours < (settings.workingHours.halfDayThreshold || 4);
                
                const msg = getEventMotivation(isEarly ? CATEGORIES.CHECK_OUT_EARLY : CATEGORIES.CHECK_OUT_NORMAL);
                
                setAlertDialog({ 
                  isOpen: true, 
                  title: 'Check-out Successful', 
                  message: 'Your check-out has been recorded successfully!\n\nWorking hours: ' + formatWorkingHours(parseFloat(response.data.attendance.total_working_hours)), 
                  type: 'success',
                  onCloseCallback: () => {
                    setTimeout(() => setMotivationPopup({ isOpen: true, message: msg }), 400); // Wait for alert to fade out
                  }
                });

                fetchData();
              } else {
                setCheckOutMessage(''); 
                setAlertDialog({ isOpen:true, title:'❌ Check-out Failed', message:response.data.message || 'Check-out failed. Please try again.', type:'error' });
              }
            } catch (error) {
              setCheckOutMessage('');
              if (!error.isGlobalError) {
                const config = mapErrorToDialogConfig(error);
                window.dispatchEvent(new CustomEvent('showGlobalError', { detail: config }));
              }
            } finally { setIsCheckingOut(false); setCheckOutMessage(''); }
          };

          if (locationNotRequired) {
            await performCheckOut(null);
          } else {
            setLocationDialog({ isOpen:true, title:settings.messages.locationPermissionTitle, message:settings.messages.locationPermissionMessage, type:'permission',
              onAllow: async () => {
                try {
                  setCheckOutMessage('Getting your location...');
                  const location = await getCurrentLocation();
                  await performCheckOut(location);
                } catch (error) {
                  setIsCheckingOut(false); setCheckOutMessage('');
                  if (isElectron && (error.type === 'denied' || error.type === 'unavailable' || error.type === 'timeout')) {
                    window.dispatchEvent(new CustomEvent('showGlobalError', { detail: mapErrorToDialogConfig({ response: { data: { errorCode: 'DESKTOP_GPS_NOT_AVAILABLE' } } }) }));
                  } else {
                    window.dispatchEvent(new CustomEvent('showGlobalError', { detail: mapErrorToDialogConfig(error) }));
                  }
                }
              },
            });
          }
        } catch (e) { setIsCheckingOut(false); setCheckOutMessage(''); }
      },
    });
  };

  /* ════════════════════════════════════════════════════════════════
     ▐  END EXISTING HANDLERS
     ════════════════════════════════════════════════════════════════ */

  /* ─── Live Working Timer ─── */
  useEffect(() => {
    if (todayAttendance?.login_time && !todayAttendance?.logout_time) {
      const loginTime = new Date(todayAttendance.login_time);
      const update = () => setLiveSeconds(Math.max(0, Math.floor((Date.now() - loginTime.getTime()) / 1000)));
      update();
      const timer = setInterval(update, 1000);
      return () => clearInterval(timer);
    } else if (todayAttendance?.login_time && todayAttendance?.logout_time) {
      const loginTime = new Date(todayAttendance.login_time);
      const logoutTime = new Date(todayAttendance.logout_time);
      setLiveSeconds(Math.max(0, Math.floor((logoutTime.getTime() - loginTime.getTime()) / 1000)));
    } else {
      setLiveSeconds(0);
    }
  }, [todayAttendance]);

  /* ─── Derived Values ─── */
  const hasCheckedIn  = !!todayAttendance?.login_time;
  const hasCheckedOut = !!todayAttendance?.logout_time;
  const nameStr  = user?.name || user?.username || 'Employee';
  const initials = nameStr.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  // Greeting
  const hour = currentTime.getHours();
  const greeting     = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
  const greetingEmoji = hour < 12 ? '👋' : hour < 17 ? '☀️' : '🌙';
  const GreetingIcon  = hour < 12 ? FiSunrise : hour < 17 ? FiSun : FiMoon;

  // Current month
  const currentMonthName = MONTH_NAMES[currentTime.getMonth()];

  /* ─── Stats (computed from monthly attendance) ─── */
  const stats = useMemo(() => {
    if (dashboardStats) {
      return {
        presentDays: dashboardStats.presentDays,
        lateDays: dashboardStats.lateDays,
        wfhDays: dashboardStats.wfhDays,
        percentage: dashboardStats.attendanceRate
      };
    }
    return { presentDays: 0, lateDays: 0, wfhDays: 0, percentage: 0 };
  }, [dashboardStats]);

  /* ─── Weekly Chart Data ─── */
  const weekData = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateStr = toLocalDateStr(d);
      const record = monthlyAttendance.find(r => toLocalDateStr(r.attendance_date) === dateStr);

      return {
        day,
        hours: record?.total_working_hours ? parseFloat(record.total_working_hours) : 0,
        hasLogin: !!record?.login_time,
        status: record?.attendance_status,
        isToday: d.toDateString() === today.toDateString(),
        isFuture: d.setHours(0,0,0,0) > today.setHours(0,0,0,0),
      };
    });
  }, [monthlyAttendance]);

  const maxBarHours = Math.max(8, ...weekData.map(d => d.hours));

  /* ─── Upcoming Holidays ─── */
  const upcomingHolidays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return monthlyHolidays
      .filter(h => {
        const hd = new Date(h.holiday_date);
        hd.setHours(0, 0, 0, 0);
        return hd >= today;
      })
      .sort((a, b) => new Date(a.holiday_date) - new Date(b.holiday_date));
  }, [monthlyHolidays]);

  /* ─── Recent Attendance (last 7 records with login) ─── */
  const recentAttendance = useMemo(() => {
    return monthlyAttendance.filter(r => r.login_time).slice(0, 7);
  }, [monthlyAttendance]);

  /* ─── Removed old static motivation message logic ─── */

  /* ─── Today's Timeline ─── */
  const timeline = useMemo(() => {
    const steps = [
      {
        title: 'Check In',
        subtitle: hasCheckedIn ? `Checked in at ${formatTime(todayAttendance?.login_time)}` : 'Awaiting check-in',
        icon: FiLogIn,
        completed: hasCheckedIn,
        active: !hasCheckedIn,
      },
      {
        title: 'Working',
        subtitle: hasCheckedIn && !hasCheckedOut ? 'Currently working...' : hasCheckedOut ? 'Shift completed' : 'Pending',
        icon: FiBriefcase,
        completed: hasCheckedOut,
        active: hasCheckedIn && !hasCheckedOut,
      },
      {
        title: 'Expected Checkout',
        subtitle: settings?.workingHours?.officeEndTime ? format24To12Hour(settings.workingHours.officeEndTime) : '—',
        icon: FiClock,
        completed: hasCheckedOut,
        active: false,
      },
      {
        title: 'Check Out',
        subtitle: hasCheckedOut
          ? `Checked out at ${formatTime(todayAttendance?.logout_time)}${todayAttendance?.is_auto_checkout ? ' (Auto)' : ''}`
          : 'Pending',
        icon: FiLogOut,
        completed: hasCheckedOut,
        active: false,
      },
    ];
    return steps;
  }, [hasCheckedIn, hasCheckedOut, todayAttendance, settings]);

  /* ─── Progress Ring geometry ─── */
  const ringRadius = 52;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - stats.percentage / 100);

  /* ════════════════════════════════════════════════════════════════
     ▐  RENDER
     ════════════════════════════════════════════════════════════════ */

  if (loading) {
    return (
      <div className="flex h-screen" style={{ background: '#F5F7FB' }}>
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Spinner size="lg" />
            <p className="text-sm text-[#64748B] mt-4">Loading your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen" style={{ background: '#F5F7FB' }}>
      <Sidebar />
      <div className="flex-1 overflow-y-auto min-w-0">
        <div className="px-4 py-5 lg:px-8 lg:py-7 max-w-[1400px] mx-auto">

          {/* ═══════════════════════════════════════════════════════
              SECTION 1: TOP HEADER
              ═══════════════════════════════════════════════════════ */}
          <header className="clay-header-card px-5 py-5 lg:px-7 lg:py-6 mb-6 animate-fadeInUp stagger-1 pt-16 lg:pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              {/* Greeting */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#4F6CE1] to-[#7B93F5] flex items-center justify-center text-white shadow-[0_4px_14px_rgba(79,108,225,0.3)] flex-shrink-0">
                  <GreetingIcon size={22} />
                </div>
                <div>
                  <h1 className="text-xl lg:text-2xl font-bold text-[#1E293B]">
                    {greeting}, {nameStr.split(' ')[0]}! <span className="inline-block">{greetingEmoji}</span>
                  </h1>
                  <p className="text-sm text-[#64748B] mt-0.5">
                    {currentTime.toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
                  </p>
                </div>
              </div>

              {/* Right side: Clock + Notification + Avatar */}
              <div className="flex items-center gap-3">
                {/* Live Clock */}
                <div className="flex items-center gap-2 bg-white/70 border border-[#E7EBF2]/80 rounded-2xl px-4 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_4px_rgba(149,163,187,0.06)]">
                  <div className="clay-live-dot" />
                  <span className="text-lg font-bold font-mono text-[#1E293B] tracking-wider">
                    {currentTime.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                  </span>
                </div>

                {/* Notification */}
                <button className="w-10 h-10 rounded-2xl bg-white/70 border border-[#E7EBF2]/80 flex items-center justify-center text-[#64748B] hover:text-[#4F6CE1] hover:bg-[#f0f4ff] transition-all shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
                  <FiBell size={18} />
                </button>

                {/* Avatar */}
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#4F6CE1] to-[#7B93F5] flex items-center justify-center text-white text-sm font-bold shadow-[0_3px_10px_rgba(79,108,225,0.25)]">
                  {initials}
                </div>
              </div>
            </div>
          </header>

          {/* ═══════════════════════════════════════════════════════
              WFH BANNER
              ═══════════════════════════════════════════════════════ */}
          {wfhEnabled && (
            <div className="clay-wfh-banner flex items-center gap-3 px-5 py-3.5 mb-6 animate-fadeInUp stagger-2">
              <div className="w-8 h-8 rounded-xl bg-[#4F6CE1]/10 flex items-center justify-center flex-shrink-0">
                <FiHome size={16} className="text-[#4F6CE1]" />
              </div>
              <span className="text-sm font-semibold text-[#4F6CE1]">Work From Home is enabled for your account</span>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════
              SECTION 2: STAT CARDS
              ═══════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Present Days */}
            <div className="clay-stat-card p-5 animate-fadeInUp stagger-2">
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-50 flex items-center justify-center">
                  <FiCheckCircle size={20} className="text-emerald-500" />
                </div>
                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">This Month</span>
              </div>
              <p className="text-3xl font-bold text-[#1E293B] animate-countUp">{stats.presentDays}</p>
              <p className="text-xs text-[#64748B] mt-1 font-medium">Present Days</p>
            </div>

            {/* Late Days */}
            <div className="clay-stat-card p-5 animate-fadeInUp stagger-3">
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <FiAlertCircle size={20} className="text-amber-500" />
                </div>
                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">This Month</span>
              </div>
              <p className="text-3xl font-bold text-[#1E293B] animate-countUp">{stats.lateDays}</p>
              <p className="text-xs text-[#64748B] mt-1 font-medium">Late Days</p>
            </div>

            {/* Attendance % */}
            <div className="clay-stat-card p-5 animate-fadeInUp stagger-4">
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-50 flex items-center justify-center">
                  <FiTrendingUp size={20} className="text-[#4F6CE1]" />
                </div>
                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">This Month</span>
              </div>
              <p className="text-3xl font-bold text-[#1E293B] animate-countUp">{stats.percentage}<span className="text-lg text-[#64748B] ml-0.5">%</span></p>
              <p className="text-xs text-[#64748B] mt-1 font-medium">Attendance Rate</p>
            </div>

            {/* WFH Days */}
            <div className="clay-stat-card p-5 animate-fadeInUp stagger-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-11 h-11 rounded-2xl bg-purple-50 flex items-center justify-center">
                  <FiHome size={20} className="text-purple-500" />
                </div>
                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">This Month</span>
              </div>
              <p className="text-3xl font-bold text-[#1E293B] animate-countUp">{stats.wfhDays}</p>
              <p className="text-xs text-[#64748B] mt-1 font-medium">WFH Days</p>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 3: CHECK IN / CHECK OUT
              ═══════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 animate-fadeInUp stagger-5">
            {/* Check In */}
            <button
              onClick={handleCheckIn}
              disabled={isCheckingIn || hasCheckedIn || !checkInEnabled}
              className={`clay-action-card clay-checkin relative p-6 flex flex-col items-center gap-4 ${hasCheckedIn || !checkInEnabled ? 'bg-[#F8FAFC] !border-[#E7EBF2]' : ''}`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                hasCheckedIn || !checkInEnabled
                  ? 'bg-[#F1F5F9]'
                  : 'bg-gradient-to-br from-emerald-50 to-emerald-100'
              }`}>
                {isCheckingIn && checkInMessage
                  ? <Spinner size="lg" />
                  : <FiLogIn size={28} className={hasCheckedIn || !checkInEnabled ? 'text-[#64748B]' : 'text-emerald-600'} />
                }
              </div>
              <div className="text-center">
                <p className={`text-base font-bold ${hasCheckedIn || !checkInEnabled ? 'text-[#64748B]' : 'text-[#1E293B]'}`}>
                  {!checkInEnabled ? 'Check-In Disabled' : hasCheckedIn ? 'Checked In' : 'Check In'}
                </p>
                <p className={`text-xs mt-1 ${hasCheckedIn || !checkInEnabled ? 'text-[#64748B]' : 'text-[#64748B]'}`}>
                  {isCheckingIn && checkInMessage ? checkInMessage : !checkInEnabled ? 'Contact admin to enable' : hasCheckedIn ? `at ${formatTime(todayAttendance?.login_time)}` : 'Tap to mark attendance'}
                </p>
              </div>
              {hasCheckedIn && (
                <div className="absolute top-4 right-4 w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <FiCheckCircle size={16} className="text-emerald-500" />
                </div>
              )}
            </button>

            {/* Check Out */}
            <button
              onClick={handleCheckOut}
              disabled={isCheckingOut || !hasCheckedIn || hasCheckedOut || !checkOutEnabled}
              className={`clay-action-card clay-checkout relative p-6 flex flex-col items-center gap-4 ${!hasCheckedIn || hasCheckedOut || !checkOutEnabled ? 'bg-[#F8FAFC] !border-[#E7EBF2]' : ''}`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                !hasCheckedIn || hasCheckedOut || !checkOutEnabled
                  ? 'bg-[#F1F5F9]'
                  : 'bg-gradient-to-br from-red-50 to-red-100'
              }`}>
                {isCheckingOut && checkOutMessage
                  ? <Spinner size="lg" />
                  : <FiLogOut size={28} className={!hasCheckedIn || hasCheckedOut || !checkOutEnabled ? 'text-[#64748B]' : 'text-red-500'} />
                }
              </div>
              <div className="text-center">
                <p className={`text-base font-bold ${!hasCheckedIn || hasCheckedOut || !checkOutEnabled ? 'text-[#64748B]' : 'text-[#1E293B]'}`}>
                  {!checkOutEnabled ? 'Check-Out Disabled' : hasCheckedOut ? 'Checked Out' : 'Check Out'}
                </p>
                <p className={`text-xs mt-1 ${!hasCheckedIn || hasCheckedOut || !checkOutEnabled ? 'text-[#64748B]' : 'text-[#64748B]'}`}>
                  {isCheckingOut && checkOutMessage ? checkOutMessage : !checkOutEnabled ? 'Contact admin to enable' : hasCheckedOut ? `at ${formatTime(todayAttendance?.logout_time)}` : 'Tap to end your shift'}
                </p>
              </div>
              {hasCheckedOut && (
                <div className="absolute top-4 right-4 w-7 h-7 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <FiCheckCircle size={16} className="text-emerald-500" />
                </div>
              )}
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 4: PROGRESS RING + WORKING HOURS + MOTIVATIONAL
              ═══════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">

            {/* Attendance Progress Ring */}
            <div className="clay-card-soft p-6 flex flex-col items-center justify-center animate-fadeInUp stagger-6">
              <h3 className="text-xs font-bold text-[#64748B] uppercase tracking-wider mb-4">Attendance Progress</h3>
              <div className="relative">
                <svg width="140" height="140" viewBox="0 0 140 140">
                  <defs>
                    <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4F6CE1" />
                      <stop offset="100%" stopColor="#7B93F5" />
                    </linearGradient>
                  </defs>
                  <circle cx="70" cy="70" r={ringRadius} className="clay-progress-track" />
                  <circle
                    cx="70" cy="70" r={ringRadius}
                    className="clay-progress-bar"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringOffset}
                    transform="rotate(-90 70 70)"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-bold text-[#1E293B]">{stats.percentage}%</span>
                  <span className="text-[10px] text-[#64748B] font-medium mt-0.5">{currentMonthName}</span>
                </div>
              </div>
              <p className="text-xs text-[#64748B] mt-4 text-center">
                {stats.percentage >= 90 ? 'Outstanding! Keep it up! 🏆' : stats.percentage >= 75 ? 'Great job! Almost perfect! 🎉' : stats.percentage >= 50 ? 'Good progress! Stay consistent! 💪' : 'Let\'s improve this month! 📈'}
              </p>
            </div>

            {/* Working Hours Card (Live Timer) */}
            <div className="clay-card-soft p-6 animate-fadeInUp stagger-7">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <FiClock size={16} className="text-[#4F6CE1]" />
                </div>
                <h3 className="text-sm font-bold text-[#1E293B]">Working Hours</h3>
              </div>

              {/* Live Timer */}
              <div className="text-center mb-5 py-4 rounded-2xl bg-gradient-to-br from-[#f8faff] to-[#f1f5f9] border border-[#E7EBF2]/60">
                <p className="text-4xl font-bold font-mono text-[#1E293B] tracking-wider">
                  {formatLiveTimer(liveSeconds)}
                </p>
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  {hasCheckedIn && !hasCheckedOut && <div className="clay-live-dot" />}
                  <span className="text-xs text-[#64748B] font-medium">
                    {hasCheckedIn && !hasCheckedOut ? 'Currently Working' : hasCheckedOut ? 'Shift Completed' : 'Not Started'}
                  </span>
                </div>
              </div>

              {/* Info rows */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#64748B] flex items-center gap-2">
                    <FiTarget size={13} /> Expected Checkout
                  </span>
                  <span className="font-semibold text-[#1E293B]">
                    {settings?.workingHours?.officeEndTime ? format24To12Hour(settings.workingHours.officeEndTime) : '—'}
                  </span>
                </div>
                <div className="h-px bg-[#E7EBF2]/80" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#64748B] flex items-center gap-2">
                    <FiActivity size={13} /> Shift Time
                  </span>
                  <span className="font-semibold text-[#1E293B]">
                    {settings?.workingHours?.officeStartTime && settings?.workingHours?.officeEndTime
                      ? `${format24To12Hour(settings.workingHours.officeStartTime)} – ${format24To12Hour(settings.workingHours.officeEndTime)}`
                      : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Motivational / Birthday Card */}
            {dailyMotivation.isBirthday ? (
              <div className="birthday-card p-6 flex flex-col items-center justify-center text-center animate-fadeInUp stagger-8 relative overflow-hidden">
                <div className="confetti-container absolute inset-0 pointer-events-none"></div>
                <div className="w-16 h-16 bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center mb-3 shadow-[0_4px_12px_rgba(255,255,255,0.3)] z-10">
                  <span className="text-3xl relative animate-float">🎉</span>
                </div>
                <h3 className="text-lg font-extrabold text-white mb-2 z-10 text-shadow-sm">Happy Birthday, {user?.name.split(' ')[0]}!</h3>
                <p className="text-xs font-semibold text-white/90 z-10 mb-1 leading-relaxed px-2">Wishing you happiness, success, and a wonderful year ahead.</p>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest z-10 mt-2">Have a fantastic day!</p>
              </div>
            ) : (
              <div className="clay-motivational p-6 flex flex-col items-center justify-center text-center animate-fadeInUp stagger-8">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 shadow-inner">
                  <span className="text-3xl">{dailyMotivation.icon}</span>
                </div>
                <p className="text-base font-bold text-[#1E293B] mb-2">{dailyMotivation.text}</p>
                <p className="text-xs text-[#64748B]">Daily Motivation</p>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 5: WEEKLY CHART + TIMELINE
              ═══════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

            {/* Weekly Attendance Chart */}
            <div className="clay-card-soft p-6 animate-fadeInUp stagger-7">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FiBarChart2 size={16} className="text-[#4F6CE1]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#1E293B]">Weekly Overview</h3>
                </div>
                <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">This Week</span>
              </div>

              <div className="flex items-end justify-between gap-2 h-36 px-1">
                {weekData.map((d, i) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-2 group">
                    {/* Hours label on hover */}
                    <span className={`text-[10px] font-semibold transition-opacity ${d.hours > 0 ? 'text-[#4F6CE1]' : 'text-[#475569]'} ${d.hours > 0 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      {d.hours > 0 ? `${d.hours.toFixed(1)}h` : '–'}
                    </span>
                    {/* Bar */}
                    <div
                      className={`clay-bar w-full origin-bottom ${
                        d.isFuture
                          ? 'bg-[#F1F5F9]'
                          : d.hours > 0
                            ? d.status === 'Late' ? 'bg-gradient-to-t from-amber-400 to-amber-300' : 'bg-gradient-to-t from-[#4F6CE1] to-[#7B93F5]'
                            : 'bg-[#E8ECF4]'
                      }`}
                      style={{
                        height: d.isFuture ? '8px' : d.hours > 0 ? `${Math.max(12, (d.hours / maxBarHours) * 100)}%` : '8px',
                        animationDelay: `${i * 0.08}s`,
                      }}
                    />
                    {/* Day label */}
                    <span className={`text-[10px] font-semibold ${d.isToday ? 'text-[#4F6CE1]' : 'text-[#64748B]'}`}>
                      {d.day}
                    </span>
                    {d.isToday && <div className="w-1 h-1 rounded-full bg-[#4F6CE1] -mt-1" />}
                  </div>
                ))}
              </div>
            </div>

            {/* Today's Timeline */}
            <div className="clay-card-soft p-6 animate-fadeInUp stagger-8">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <FiActivity size={16} className="text-[#4F6CE1]" />
                </div>
                <h3 className="text-sm font-bold text-[#1E293B]">Today's Timeline</h3>
              </div>

              <div className="space-y-0">
                {timeline.map((step, i) => (
                  <div key={i} className="flex gap-4">
                    {/* Dot + Line */}
                    <div className="flex flex-col items-center">
                      <div className={`clay-timeline-dot ${step.completed ? 'completed' : step.active ? 'active' : 'pending'}`}>
                        <step.icon size={15} />
                      </div>
                      {i < timeline.length - 1 && (
                        <div className={`clay-timeline-line ${step.completed ? 'bg-emerald-300' : 'bg-[#E7EBF2]'}`} />
                      )}
                    </div>
                    {/* Content */}
                    <div className={`pb-4 ${i === timeline.length - 1 ? '' : ''}`}>
                      <p className={`text-sm font-semibold ${step.completed ? 'text-emerald-700' : step.active ? 'text-[#4F6CE1]' : 'text-[#64748B]'}`}>
                        {step.title}
                      </p>
                      <p className="text-xs text-[#64748B] mt-0.5">{step.subtitle}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 6: RECENT ATTENDANCE
              ═══════════════════════════════════════════════════════ */}
          <div className="clay-card-soft overflow-hidden mb-6 animate-fadeInUp stagger-8">
            <div className="px-6 py-4 border-b border-[#E7EBF2]/80 flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                <FiCalendar size={16} className="text-[#4F6CE1]" />
              </div>
              <h3 className="text-sm font-bold text-[#1E293B]">Recent Attendance</h3>
            </div>

            {recentAttendance.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full clay-table">
                  <thead>
                    <tr className="border-b border-[#E7EBF2]">
                      <th>Date</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Working Hours</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentAttendance.map(record => (
                      <tr key={record.id}>
                        <td className="font-medium text-[#1E293B]">{formatDate(record.attendance_date)}</td>
                        <td className="text-[#64748B]">{formatTime(record.login_time)}</td>
                        <td className="text-[#64748B]">
                          {formatTime(record.logout_time)}
                          {record.is_auto_checkout && record.logout_time && (
                            <span className="block text-[10px] text-amber-500 font-medium">(Auto checkout)</span>
                          )}
                        </td>
                        <td className="text-[#64748B]">
                          {record.total_working_hours ? formatWorkingHours(parseFloat(record.total_working_hours)) : '—'}
                        </td>
                        <td>
                          <StatusBadge status={record.attendance_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="px-6 py-12 text-center">
                <FiCalendar size={28} className="mx-auto mb-2 text-[#475569]" />
                <p className="text-sm font-semibold text-[#64748B]">No attendance records yet</p>
                <p className="text-xs text-[#64748B] mt-1">Check in to start tracking</p>
              </div>
            )}
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 7: TODAY'S SUMMARY + UPCOMING HOLIDAYS
              ═══════════════════════════════════════════════════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

            {/* Today's Summary */}
            <div className="clay-card-soft overflow-hidden animate-fadeInUp stagger-9">
              <div className="px-6 py-4 border-b border-[#E7EBF2]/80 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <FiClock size={16} className="text-[#4F6CE1]" />
                </div>
                <h3 className="text-sm font-bold text-[#1E293B]">Today's Summary</h3>
              </div>
              {todayAttendance ? (
                <div className="grid grid-cols-2 divide-x divide-[#E7EBF2]/60">
                  {[
                    { label: 'Login Time', value: formatTime(todayAttendance.login_time) || '—', sub: null },
                    { label: 'Logout Time', value: formatTime(todayAttendance.logout_time) || '—', sub: todayAttendance.is_auto_checkout && todayAttendance.logout_time ? 'Auto checkout' : null },
                    { label: 'Working Hours', value: formatWorkingHours(parseFloat(todayAttendance.total_working_hours)), sub: null },
                    { label: 'Status', value: null, badge: true },
                  ].map(({ label, value, sub, badge }) => (
                    <div key={label} className="px-5 py-4">
                      <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider mb-1.5">{label}</p>
                      {badge
                        ? <div className="mt-1"><StatusBadge status={todayAttendance.attendance_status} size="md" /></div>
                        : <>
                            <p className="text-lg font-bold text-[#1E293B]">{value}</p>
                            {sub && <p className="text-[10px] text-amber-500 mt-0.5 font-medium">{sub}</p>}
                          </>
                      }
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-10 text-center">
                  <FiAlertCircle size={28} className="mx-auto mb-2 text-[#475569]" />
                  <p className="text-sm font-semibold text-[#64748B]">No attendance record for today</p>
                  <p className="text-xs text-[#64748B] mt-1">Check in to start tracking your attendance</p>
                </div>
              )}
            </div>

            {/* Upcoming Holidays */}
            <div className="clay-card-soft overflow-hidden animate-fadeInUp stagger-10">
              <div className="px-6 py-4 border-b border-[#E7EBF2]/80 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center">
                  <FiAward size={16} className="text-purple-500" />
                </div>
                <h3 className="text-sm font-bold text-[#1E293B]">Upcoming Holidays</h3>
                <span className="ml-auto text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">{currentMonthName}</span>
              </div>

              <div className="p-4">
                {upcomingHolidays.length > 0 ? (
                  <div className="space-y-2.5">
                    {upcomingHolidays.map(holiday => {
                      const holidayDate = new Date(holiday.holiday_date);
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      holidayDate.setHours(0, 0, 0, 0);
                      const daysLeft = Math.ceil((holidayDate - today) / 86400000);
                      const dayName = new Date(holiday.holiday_date).toLocaleDateString('en-US', { weekday: 'long' });
                      const displayDate = new Date(holiday.holiday_date);

                      return (
                        <div key={holiday.id} className="clay-holiday-item flex items-center gap-3.5">
                          {/* Date circle */}
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-50 to-purple-100 flex flex-col items-center justify-center flex-shrink-0 border border-purple-100/80">
                            <span className="text-[9px] font-bold text-purple-500 uppercase leading-none">
                              {displayDate.toLocaleDateString('en-US', { month: 'short' })}
                            </span>
                            <span className="text-lg font-bold text-purple-700 leading-none mt-0.5">
                              {displayDate.getDate()}
                            </span>
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#1E293B] truncate">{holiday.holiday_title}</p>
                            <p className="text-[11px] text-[#64748B] mt-0.5">
                              {holiday.holiday_type} · {dayName}
                            </p>
                          </div>
                          {/* Days left badge */}
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                            daysLeft === 0
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                              : daysLeft <= 3
                                ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                : 'bg-purple-50 text-purple-600 border border-purple-200'
                          }`}>
                            {daysLeft === 0 ? 'Today' : daysLeft === 1 ? 'Tomorrow' : `${daysLeft} days left`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-[#F1F5F9] flex items-center justify-center mx-auto mb-3">
                      <FiCalendar size={20} className="text-[#475569]" />
                    </div>
                    <p className="text-sm text-[#64748B] font-medium">No upcoming holidays this month.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              SECTION 8: INSTRUCTIONS
              ═══════════════════════════════════════════════════════ */}
          <div className="clay-card-soft overflow-hidden animate-fadeInUp stagger-10 mb-4" style={{ background: 'linear-gradient(135deg, #fffcf0, #fefaf0)' }}>
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                  <FiInfo size={14} className="text-amber-600" />
                </div>
                <h3 className="text-sm font-bold text-amber-900">Important Instructions</h3>
              </div>
              <ul className="text-xs text-amber-800/90 space-y-1.5 ml-5 list-disc">
                <li>Make sure location services are enabled on your device</li>
                <li>Check in when you arrive at the office or start working from home</li>
                <li>Check out when you finish your work for the day</li>
                <li>You can only check in and check out once per day</li>
                {!wfhEnabled && settings && <li>You must be within {settings.companyLocation.allowedRadius} meters of the office to check in</li>}
              </ul>
            </div>
          </div>

        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
          DIALOGS (COMPLETELY UNCHANGED)
          ═══════════════════════════════════════════════════════ */}
      <ConfirmDialog isOpen={confirmDialog.isOpen} onClose={() => setConfirmDialog(d => ({ ...d, isOpen:false }))} onConfirm={confirmDialog.onConfirm} title={confirmDialog.title} message={confirmDialog.message} type={confirmDialog.type} confirmText={confirmDialog.type === 'warning' ? 'Check Out' : 'Check In'} />
      <LocationDialog isOpen={locationDialog.isOpen} onClose={() => setLocationDialog(d => ({ ...d, isOpen:false }))} onAllow={locationDialog.onAllow} title={locationDialog.title} message={locationDialog.message} type={locationDialog.type} />
      <AlertDialog 
        isOpen={alertDialog.isOpen} 
        onClose={() => {
          setAlertDialog(prev => ({ ...prev, isOpen: false }));
          if (alertDialog.onCloseCallback) alertDialog.onCloseCallback();
        }} 
        title={alertDialog.title} 
        message={alertDialog.message} 
        type={alertDialog.type} 
      />
      <MotivationPopup isOpen={motivationPopup.isOpen} message={motivationPopup.message} onClose={() => setMotivationPopup({ ...motivationPopup, isOpen: false })} />
    </div>
  );
};

export default EmployeeDashboard;
