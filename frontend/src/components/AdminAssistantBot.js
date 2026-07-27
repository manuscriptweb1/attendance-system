import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSettings, executeBotCommand, downloadAllPayslips, downloadSinglePayslip, getBotCapabilities } from '../services/api';
import { FiX, FiSend, FiCpu, FiExternalLink, FiRotateCcw } from 'react-icons/fi';
import './AdminAssistantBot.css';

const LOGO_PATH = '/favicon/favicon-96x96.png';

const getGeneralHelpText = (caps) => {
  const data = caps;
  let text = `I can help you with these actions:\n\n`;
  if (data?.actions) {
    data.actions.forEach((action, idx) => {
      text += `${idx + 1}. ${action.title}\n`;
      if (action.description) {
        text += `${action.description}\n`;
      }
      text += `Examples:\n`;
      action.commands.forEach((cmd) => {
        text += `- ${cmd}\n`;
      });
      if (idx < data.actions.length - 1) {
        text += `\n`;
      }
    });
  } else {
    text = `I can help you navigate admin pages, search employees, mark attendance, calculate payroll, and download payslips. Type 'help' to view actions.`;
  }
  return text.trim();
};

const getActionHelpText = (action) => {
  if (!action) return null;
  let text = `You can use these ${action.title} commands:\n\n`;
  action.commands.forEach((cmd) => {
    text += `- ${cmd}\n`;
  });
  return text.trim();
};

const findMatchingAction = (query, caps) => {
  const data = caps;
  let text = (query || '').toLowerCase().trim();
  if (!text || !data?.actions) return null;

  if (text.startsWith('help_')) {
    text = text.replace('help_', '');
  }

  let matched = data.actions.find(action =>
    action.id.toLowerCase() === text ||
    action.title.toLowerCase() === text
  );
  if (matched) return matched;

  matched = data.actions.find(action =>
    action.keywords && action.keywords.some(kw => text.includes(kw.toLowerCase()))
  );
  if (matched) return matched;

  matched = data.actions.find(action =>
    action.aliases && action.aliases.some(alias => text.includes(alias.toLowerCase()))
  );
  if (matched) return matched;

  matched = data.actions.find(action =>
    action.commands && action.commands.some(cmd => text.includes(cmd.toLowerCase()))
  );
  return matched;
};

const INITIAL_QUICK_ACTIONS = [
  { label: '❓ Help / Commands', command: 'help' },
  { label: '📊 Report Summary', command: 'show report' },
  { label: '⏱ Attendance Help', command: 'help_mark_attendance' },
  { label: '📄 Payslip Help', command: 'help_payslip' },
  { label: '💰 Payroll Help', command: 'help_payroll' },
  { label: '🌴 Holiday Help', command: 'help_holiday' },
  { label: '🔗 Page Help', command: 'help_navigation' },
  { label: '📊 Today Summary', command: 'today attendance summary' },
  { label: '💳 Open Payroll', command: 'open payroll' }
];

const formatLateTime = (minutes) => {
  const total = Number(minutes || 0);
  if (!total || total <= 0) return "-";
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return `${mins} min`;
  return `${hours}h ${String(mins).padStart(2, "0")}m`;
};

const DEFAULT_CONVERSATION = {
  greetings: {
    patterns: ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"],
    response: "Hi! I am your MTM Admin Assistant. How can I help you today?"
  },
  wellbeing: {
    patterns: ["how are you", "how are you doing", "how r u", "how is it going", "are you fine"],
    response: "I am doing well and ready to help you with attendance, payroll, reports, payslips, and admin tasks."
  },
  thanks: {
    patterns: ["thanks", "thank you", "thank you bot"],
    response: "You're welcome!"
  },
  acknowledgement: {
    patterns: ["ok", "okay", "fine", "good", "done"],
    response: "Okay."
  },
  bye: {
    patterns: ["bye", "goodbye", "see you"],
    response: "Goodbye! Have a good day."
  },
  identity: {
    patterns: ["who are you", "what are you", "your name"],
    response: "I am your MTM Admin Assistant. I can help you navigate admin pages, search employees, manage attendance, generate reports, calculate payroll, and download payslips."
  }
};

const matchBasicConversation = (lowerCmd, caps) => {
  const convConfig = caps?.conversation || DEFAULT_CONVERSATION;
  const text = (lowerCmd || '').trim();
  if (!text) return null;

  for (const key of Object.keys(convConfig)) {
    const item = convConfig[key];
    if (item && item.patterns && Array.isArray(item.patterns)) {
      for (const pattern of item.patterns) {
        const p = pattern.toLowerCase().trim();
        if (p.length <= 4) {
          if (text === p || text.startsWith(p + ' ') || text.endsWith(' ' + p) || text.includes(' ' + p + ' ')) {
            return item.response;
          }
        } else {
          if (text === p || text.includes(p)) {
            return item.response;
          }
        }
      }
    }
  }

  return null;
};

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december"
];

const parseHolidayDate = (text) => {
  if (!text) return null;
  const lower = text.toLowerCase();
  const now = new Date();
  if (lower.includes('tomorrow')) {
    const tmr = new Date(now);
    tmr.setDate(now.getDate() + 1);
    const y = tmr.getFullYear();
    const m = String(tmr.getMonth() + 1).padStart(2, '0');
    const d = String(tmr.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (lower.includes('today')) {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const isoMatch = text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/);
  if (isoMatch) return `${isoMatch[1]}-${String(isoMatch[2]).padStart(2, '0')}-${String(isoMatch[3]).padStart(2, '0')}`;

  const dmyMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])[/ -](0?[1-9]|1[0-2])[/ -](20\d{2})\b/);
  if (dmyMatch) return `${dmyMatch[3]}-${String(dmyMatch[2]).padStart(2, '0')}-${String(dmyMatch[1]).padStart(2, '0')}`;

  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  for (let i = 0; i < monthNames.length; i++) {
    const mName = monthNames[i];
    if (lower.includes(mName) || lower.includes(mName.substring(0, 3))) {
      const dayMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])\b/);
      const yearMatch = text.match(/\b(20\d{2})\b/);
      const dVal = dayMatch ? parseInt(dayMatch[1]) : 1;
      const yVal = yearMatch ? parseInt(yearMatch[1]) : now.getFullYear();
      return `${yVal}-${String(i + 1).padStart(2, '0')}-${String(dVal).padStart(2, '0')}`;
    }
  }

  return null;
};

/**
 * Natural Language Date / Month Parser
 */
const parseMonthYearFromText = (text) => {
  const lower = text.toLowerCase();
  const now = new Date();
  let month = null;
  let year = now.getFullYear();

  if (lower.includes('this month') || lower.includes('current month') || lower.includes('this period')) {
    month = now.getMonth() + 1;
  } else if (lower.includes('last month') || lower.includes('previous month')) {
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    month = lastMonthDate.getMonth() + 1;
    year = lastMonthDate.getFullYear();
  }

  const yearMatch = lower.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1]);
  }

  const numMonthMatch = lower.match(/\b(0?[1-9]|1[0-2])[/ -](20\d{2})\b/);
  if (numMonthMatch) {
    month = parseInt(numMonthMatch[1]);
    year = parseInt(numMonthMatch[2]);
  }

  if (!month) {
    for (let i = 0; i < MONTH_NAMES.length; i++) {
      const mName = MONTH_NAMES[i];
      if (lower.includes(mName) || lower.includes(mName.substring(0, 3))) {
        month = i + 1;
        break;
      }
    }
  }

  return { month, year };
};

const ADMIN_PAGE_ROUTES = [
  { keys: ["dashboard", "home"], label: "Dashboard", route: "/admin/dashboard", permission: "dashboard" },
  { keys: ["employee", "employees", "staff", "user", "users"], label: "Employees", route: "/admin/employees", permission: "employees" },
  { keys: ["department", "departments", "dept"], label: "Departments", route: "/admin/departments", permission: "departments" },
  { keys: ["admin management", "admins", "admin users", "admin", "management"], label: "Admin Management", route: "/admin/management", permission: "admin_management" },
  { keys: ["attendance", "daily attendance"], label: "Attendance", route: "/admin/attendance", permission: "attendance" },
  { keys: ["permission", "permissions"], label: "Permissions", route: "/admin/permissions", permission: "permissions" },
  { keys: ["manual attendance", "manual", "manual entry"], label: "Manual Attendance", route: "/admin/manual-attendance", permission: "manual_attendance" },
  { keys: ["absent reason", "absent reasons", "reason", "reasons"], label: "Absent Reasons", route: "/admin/absent-reasons", permission: "absent_reasons" },
  { keys: ["holiday", "holidays"], label: "Holidays", route: "/admin/holidays", permission: "holidays" },
  { keys: ["payroll", "salary", "payslip", "payslips", "pay slip", "pay slips"], label: "Payroll", route: "/admin/payroll", permission: "payroll" },
  { keys: ["expense", "expenses", "finance"], label: "Expenses", route: "/admin/expenses", permission: "expenses" },
  { keys: ["report", "reports", "attendance report"], label: "Reports", route: "/admin/reports", permission: "reports" },
  { keys: ["settings", "setting", "system settings"], label: "Settings", route: "/admin/settings", permission: "settings" },
  { keys: ["activity log", "activity logs", "admin activity", "logs"], label: "Activity Logs", route: "/admin/activity-logs", permission: "activity_logs" },
  { keys: ["database monitor", "database", "db monitor", "storage"], label: "Database Monitor", route: "/admin/database-monitor", permission: "database_monitor" },
  { keys: ["trusted device", "trusted devices", "devices"], label: "Trusted Devices", route: "/admin/trusted-devices", permission: "trusted_devices" },
  { keys: ["manage", "manage page", "system manage"], label: "Manage", route: "/admin/manage", permission: "manage" },
  { keys: ["security log", "security logs", "security"], label: "Security Logs", route: "/admin/security-logs", permission: "security_logs" },
  { keys: ["otp setting", "otp settings", "otp"], label: "OTP Settings", route: "/admin/otp-settings", permission: "otp_settings" }
];

const parseNavigationCommand = (commandText) => {
  const text = commandText.toLowerCase().trim();
  const navPrefixes = ['take me to ', 'navigate to ', 'open ', 'go to ', 'show ', 'view '];

  let isExplicitNav = false;
  let cleanedText = text;

  for (const prefix of navPrefixes) {
    if (text.startsWith(prefix)) {
      isExplicitNav = true;
      cleanedText = text.substring(prefix.length).trim();
      break;
    }
  }

  const targetKey = cleanedText.replace(/\s+page$/, '').trim();

  let matched = ADMIN_PAGE_ROUTES.find(page =>
    page.keys.some(key => targetKey === key)
  );

  if (!matched && (isExplicitNav || text.endsWith(' page'))) {
    matched = ADMIN_PAGE_ROUTES.find(page =>
      page.keys.some(key => targetKey.includes(key) || key.includes(targetKey))
    );
  }

  if (matched) {
    return {
      intent: 'NAVIGATE',
      label: matched.label,
      route: matched.route,
      permission: matched.permission
    };
  }

  if (isExplicitNav) {
    return { intent: 'UNKNOWN_PAGE' };
  }

  return null;
};

const getMonthNameStr = (mNum) => {
  const idx = parseInt(mNum) - 1;
  if (idx >= 0 && idx < 12) {
    return MONTH_NAMES[idx].charAt(0).toUpperCase() + MONTH_NAMES[idx].slice(1);
  }
  return String(mNum);
};

const triggerBrowserDownload = (blobData, filename) => {
  const url = window.URL.createObjectURL(new Blob([blobData], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const BOT_BUTTON_SIZE = 64;
const BOT_PADDING = 16;
const BOT_POS_STORAGE_KEY = 'mtm_admin_assistant_button_position';

const getDefaultBotPosition = () => {
  return {
    x: Math.max(BOT_PADDING, window.innerWidth - BOT_BUTTON_SIZE - 24),
    y: Math.max(BOT_PADDING, window.innerHeight - BOT_BUTTON_SIZE - 24)
  };
};

const clampBotPosition = (x, y) => {
  const maxX = Math.max(BOT_PADDING, window.innerWidth - BOT_BUTTON_SIZE - BOT_PADDING);
  const maxY = Math.max(BOT_PADDING, window.innerHeight - BOT_BUTTON_SIZE - BOT_PADDING);
  return {
    x: Math.min(Math.max(x, BOT_PADDING), maxX),
    y: Math.min(Math.max(y, BOT_PADDING), maxY)
  };
};

const getClampedPanelPosition = (btnPos) => {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const panelWidth = Math.min(380, viewportWidth - 32);
  const panelHeight = Math.min(540, viewportHeight - 32);
  const padding = 16;
  const buttonSize = 64;

  if (viewportWidth <= 768) {
    return {
      left: Math.max(12, Math.floor((viewportWidth - panelWidth) / 2)),
      top: Math.max(12, Math.floor((viewportHeight - panelHeight) / 2))
    };
  }

  let left = btnPos.x + buttonSize - panelWidth;
  let top = btnPos.y - panelHeight - 12;

  // If not enough space above button, open below button
  if (top < padding) {
    top = btnPos.y + buttonSize + 12;
  }

  // Clamp horizontal (left/right margins)
  if (left < padding) {
    left = padding;
  }
  if (left + panelWidth > viewportWidth - padding) {
    left = viewportWidth - panelWidth - padding;
  }

  // Clamp vertical (top/bottom margins)
  if (top < padding) {
    top = padding;
  }
  if (top + panelHeight > viewportHeight - padding) {
    top = viewportHeight - panelHeight - padding;
  }

  return { left, top };
};

const AdminAssistantBot = () => {
  const { isAdmin, hasPermission, hasPageAccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [botEnabled, setBotEnabled] = useState(false);
  const [botCapabilities, setBotCapabilities] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [processing, setProcessing] = useState(false);

  const [pendingAction, setPendingAction] = useState(null);

  const [buttonPosition, setButtonPosition] = useState(() => {
    try {
      const saved = localStorage.getItem(BOT_POS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
          return clampBotPosition(parsed.x, parsed.y);
        }
      }
    } catch (e) {
      console.error('Failed to load bot position:', e);
    }
    return getDefaultBotPosition();
  });

  const [panelPosition, setPanelPosition] = useState(() => getClampedPanelPosition(buttonPosition));

  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0 });
  const hasMovedRef = useRef(false);

  const openBotPanel = () => {
    const safeBtnPos = clampBotPosition(buttonPosition.x, buttonPosition.y);
    const safePanelPos = getClampedPanelPosition(safeBtnPos);
    setButtonPosition(safeBtnPos);
    setPanelPosition(safePanelPos);
    setIsOpen(true);
  };

  const toggleBotPanel = () => {
    if (!isOpen) {
      openBotPanel();
    } else {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setButtonPosition((prev) => {
        const clampedBtn = clampBotPosition(prev.x, prev.y);
        setPanelPosition(getClampedPanelPosition(clampedBtn));
        return clampedBtn;
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handlePointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}
    setIsDragging(true);
    hasMovedRef.current = false;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: buttonPosition.x,
      initialY: buttonPosition.y
    };
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - dragStartRef.current.startX;
    const deltaY = e.clientY - dragStartRef.current.startY;

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      hasMovedRef.current = true;
    }

    const newX = dragStartRef.current.initialX + deltaX;
    const newY = dragStartRef.current.initialY + deltaY;
    setButtonPosition(clampBotPosition(newX, newY));
  };

  const handlePointerUp = (e) => {
    if (!isDragging) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}
    setIsDragging(false);

    if (hasMovedRef.current) {
      const finalPos = clampBotPosition(buttonPosition.x, buttonPosition.y);
      try {
        localStorage.setItem(BOT_POS_STORAGE_KEY, JSON.stringify(finalPos));
      } catch (err) {}
    } else {
      toggleBotPanel();
    }
  };

  const handleResetPosition = () => {
    const defPos = getDefaultBotPosition();
    setButtonPosition(defPos);
    setPanelPosition(getClampedPanelPosition(defPos));
    try {
      localStorage.removeItem(BOT_POS_STORAGE_KEY);
    } catch (err) {}
  };

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: 'Hi, I am your MTM Admin Assistant.\nI can help you navigate to any admin page, search employees, view today\'s absent/late list, calculate payroll, and download payslips directly.',
      showQuickActions: true,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);

  const messagesEndRef = useRef(null);

  const isLoginPage = location.pathname === '/admin' || location.pathname === '/admin/login';
  const isAdminRoute = location.pathname.startsWith('/admin');
  const shouldRender = isAdmin && isAdminRoute && !isLoginPage && botEnabled;

  useEffect(() => {
    let isMounted = true;
    const fetchBotSetting = async () => {
      if (!isAdmin || isLoginPage || !isAdminRoute) return;
      try {
        const res = await getSettings();
        if (res.data?.success && isMounted) {
          const enabled = res.data.settings?.adminAssistant?.enabled ?? false;
          setBotEnabled(enabled);
        }
      } catch (err) {
        console.error('Failed to fetch bot settings:', err);
      }
    };

    const loadBotCapabilities = async () => {
      if (!isAdmin || isLoginPage || !isAdminRoute) return;
      try {
        const res = await getBotCapabilities();
        if (res.data?.success && isMounted) {
          setBotCapabilities(res.data.data);
        }
      } catch (err) {
        console.error('Failed to load bot capabilities:', err);
      }
    };

    fetchBotSetting();
    loadBotCapabilities();
    return () => { isMounted = false; };
  }, [isAdmin, location.pathname, isLoginPage, isAdminRoute]);

  const messageRefs = useRef({});

  useEffect(() => {
    if (!isOpen) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg) {
      if (lastMsg.scrollToStart && messageRefs.current[lastMsg.id]) {
        messageRefs.current[lastMsg.id].scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, isOpen, pendingAction]);

  const addMessage = (sender, text, extraProps = {}) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        sender,
        text,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        ...extraProps
      }
    ]);
  };

  const handleNavigation = (navResult) => {
    if (!navResult) return;
    if (navResult.intent === 'UNKNOWN_PAGE') {
      addMessage(
        'bot',
        'I could not find that admin page.\nYou can ask me to open:\nDashboard, Employees, Departments, Attendance, Permissions, Manual Attendance, Absent Reasons, Holidays, Payroll, Expenses, Reports, Settings, Activity Logs, Database Monitor, Trusted Devices, Admin Management.'
      );
      return;
    }

    const allowed = hasPageAccess ? hasPageAccess(navResult.permission) : (hasPermission ? hasPermission(navResult.permission, 'can_view') : true);

    if (!allowed) {
      addMessage('bot', `You do not have permission to open ${navResult.label}.`);
      return;
    }

    addMessage('bot', `Opening ${navResult.label} page...`);
    setTimeout(() => {
      navigate(navResult.route);
    }, 400);
  };

  const runCalculatePayroll = async (month, year) => {
    setProcessing(true);
    try {
      const res = await executeBotCommand('calculate_payroll', { month, year });
      if (res.data?.success) {
        addMessage('bot', res.data.message, {
          cardType: 'payroll_result',
          data: res.data.data
        });
        return true;
      } else {
        addMessage('bot', `Payroll calculation failed: ${res.data?.message || 'Server error'}`);
        return false;
      }
    } catch (err) {
      addMessage('bot', `Payroll calculation failed: ${err.response?.data?.message || err.message || 'Unknown error'}`);
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const runDownloadPayslips = async (month, year) => {
    setProcessing(true);
    const mName = getMonthNameStr(month);
    try {
      addMessage('bot', `Preparing payslip PDF for ${mName} ${year}...`);
      const response = await downloadAllPayslips(month, year);
      const filename = `payslips_${String(month).padStart(2, '0')}_${year}.pdf`;
      triggerBrowserDownload(response.data, filename);
      addMessage('bot', `Payslip download started for ${mName} ${year} (${filename}).`, {
        cardType: 'download_success',
        filename
      });
      return true;
    } catch (err) {
      console.error('Payslip download error:', err);
      let errMsg = 'Failed to download payslips. Please ensure payroll is calculated for this month.';
      if (err.response && err.response.data) {
        if (err.response.data instanceof Blob) {
          try {
            const text = await err.response.data.text();
            const json = JSON.parse(text);
            if (json.message) errMsg = json.message;
          } catch (e) {}
        } else if (err.response.data.message) {
          errMsg = err.response.data.message;
        }
      }
      addMessage('bot', `Payslip download failed: ${errMsg}`);
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const runDownloadSinglePayslip = async (employeeId, month, year, empName) => {
    setProcessing(true);
    const mName = getMonthNameStr(month);
    const label = `${employeeId}${empName ? ' - ' + empName : ''}`;
    try {
      addMessage('bot', `Preparing payslip for ${label}...`);
      const response = await downloadSinglePayslip(employeeId, month, year);
      const filename = `payslip_${employeeId}_${mName}_${year}.pdf`;
      triggerBrowserDownload(response.data, filename);
      addMessage('bot', `Payslip download started for ${label}, ${mName} ${year}.`, {
        cardType: 'download_success',
        filename
      });
      return true;
    } catch (err) {
      console.error('Download single payslip error:', err);
      let errMsg = `No payroll record found for ${employeeId} in ${mName} ${year}. Please calculate payroll first.`;
      if (err.response && err.response.data) {
        if (err.response.data instanceof Blob) {
          try {
            const text = await err.response.data.text();
            const json = JSON.parse(text);
            if (json.message) errMsg = json.message;
          } catch (e) {}
        } else if (err.response.data.message) {
          errMsg = err.response.data.message;
        }
      }
      addMessage('bot', errMsg);
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectCandidate = (emp) => {
    const actionType = pendingAction?.type;
    const currentMonth = pendingAction?.month;
    const currentYear = pendingAction?.year || new Date().getFullYear();
    const codeStr = emp.employeeCode || emp.employee_id || emp.code;

    if (actionType === 'delete_holiday') {
      const formattedDateStr = emp.holiday_date ? new Date(emp.holiday_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      setPendingAction({ type: 'delete_holiday', step: 'confirm', holiday: emp });
      addMessage('bot', `I found holiday "${emp.holiday_title || emp.name}" on ${formattedDateStr}.\nDo you want to delete this holiday?`, {
        showConfirmationOptions: true
      });
      return;
    }

    if (actionType === 'mark_today_checkin' || actionType === 'mark_today_attendance') {
      setPendingAction({ type: 'mark_today_checkin', step: 'confirm', employee: emp });
      addMessage('bot', `Mark today check-in for ${codeStr} - ${emp.name} using current time? Please confirm.`, {
        showConfirmationOptions: true
      });
      return;
    }

    if (actionType === 'mark_today_checkout') {
      setPendingAction({ type: 'mark_today_checkout', step: 'confirm', employee: emp });
      addMessage('bot', `Mark check-out for ${codeStr} - ${emp.name} using current time? Please confirm.`, {
        showConfirmationOptions: true
      });
      return;
    }

    if (actionType === 'mark_today_absent') {
      setPendingAction({ type: 'mark_today_absent', step: 'ask_reason', employee: emp });
      addMessage('bot', `Please provide absent reason for ${codeStr} - ${emp.name}.`);
      return;
    }

    if (actionType === 'report_summary') {
      setPendingAction(null);
      const m = currentMonth ? ` ${getMonthNameStr(currentMonth)} ${currentYear}` : '';
      processUserCommand(`show report for ${codeStr}${m}`);
      return;
    }

    if (!currentMonth) {
      setPendingAction({ type: 'download_single_payslip', step: 'ask_month', employee: emp });
      addMessage('bot', `Which month and year do you want to download payslip for ${codeStr} - ${emp.name}?`, {
        showMonthPicker: true
      });
    } else {
      const mName = getMonthNameStr(currentMonth);
      setPendingAction({ type: 'download_single_payslip', step: 'confirm', employee: emp, month: currentMonth, year: currentYear });
      addMessage('bot', `Download payslip for ${codeStr} - ${emp.name} for ${mName} ${currentYear}? Please confirm.`, {
        showConfirmationOptions: true
      });
    }
  };

  const processUserCommand = async (rawCmd) => {
    const cmd = rawCmd.trim();
    const lowerCmd = cmd.toLowerCase();

    if (lowerCmd === 'prompt_search_employee') {
      setPendingAction({ type: 'search_employee', step: 'ask_query' });
      addMessage('bot', 'Which employee name or ID should I search?');
      return;
    }

    if (lowerCmd === 'prompt_calculate_payroll') {
      setPendingAction({ type: 'calculate_payroll', step: 'ask_month' });
      addMessage('bot', 'Which month and year do you want to calculate payroll for?', {
        showMonthPicker: true
      });
      return;
    }

    if (lowerCmd === 'prompt_download_payslips') {
      setPendingAction({ type: 'download_payslips', step: 'ask_month' });
      addMessage('bot', 'Which month and year do you want to download payslips for?', {
        showMonthPicker: true
      });
      return;
    }

    if (pendingAction) {
      if (lowerCmd === 'cancel' || lowerCmd === 'no' || lowerCmd === 'stop') {
        setPendingAction(null);
        addMessage('bot', 'Action cancelled.');
        return;
      }

      if (pendingAction.type === 'search_employee' && pendingAction.step === 'ask_query') {
        const queryVal = cmd;
        setPendingAction(null);
        setProcessing(true);
        try {
          const res = await executeBotCommand('search_employee', { query: queryVal });
          if (res.data?.success) {
            addMessage('bot', res.data.message, {
              cardType: 'employee_search',
              employees: res.data.data
            });
          } else {
            addMessage('bot', res.data?.message || 'I could not search employees right now. Please try again.');
          }
        } catch (err) {
          addMessage('bot', 'I could not search employees right now. Please check employee data or try again.');
        } finally {
          setProcessing(false);
        }
        return;
      }

      if (pendingAction.step === 'ask_month') {
        const { month, year } = parseMonthYearFromText(cmd);
        if (month) {
          const mName = getMonthNameStr(month);
          const type = pendingAction.type;
          
          if (type === 'calculate_payroll') {
            setPendingAction({ type: 'calculate_payroll', step: 'confirm', month, year });
            addMessage('bot', `Calculate payroll for ${mName} ${year}? Please confirm.`);
          } else if (type === 'download_payslips') {
            setPendingAction({ type: 'download_payslips', step: 'confirm', month, year });
            addMessage('bot', `Download payslips for ${mName} ${year}? Please confirm.`);
          } else if (type === 'calculate_and_download') {
            setPendingAction({ type: 'calculate_and_download', step: 'confirm', month, year });
            addMessage('bot', `Calculate payroll and download payslips for ${mName} ${year}? Please confirm.`);
          } else if (type === 'download_single_payslip') {
            const emp = pendingAction.employee;
            const empCodeStr = emp.employeeCode || emp.employee_id || emp.code;
            const targetYear = year || new Date().getFullYear();
            setPendingAction({ type: 'download_single_payslip', step: 'confirm', employee: emp, month, year: targetYear });
            addMessage('bot', `Download payslip for ${empCodeStr} - ${emp.name} for ${mName} ${targetYear}? Please confirm.`);
          }
          return;
        }
      }

      if (pendingAction.type === 'download_single_payslip' && pendingAction.step === 'select_candidate') {
        const candidates = pendingAction.candidates || [];
        const matched = candidates.find(c => {
          const code = (c.employeeCode || c.employee_id || '').toLowerCase();
          return code === lowerCmd || c.name.toLowerCase().includes(lowerCmd);
        });
        if (matched) {
          handleSelectCandidate(matched);
          return;
        }
      }

      if (pendingAction.type === 'mark_today_absent' && pendingAction.step === 'ask_reason') {
        const emp = pendingAction.employee;
        const empCodeStr = emp.employeeCode || emp.employee_id || emp.code;
        const reasonStr = cmd;
        setPendingAction({ type: 'mark_today_absent', step: 'confirm', employee: emp, reason: reasonStr });
        addMessage('bot', `Mark ${empCodeStr} - ${emp.name} as Absent today with reason "${reasonStr}"? Please confirm.`, {
          showConfirmationOptions: true
        });
        return;
      }

      if (pendingAction.type === 'create_holiday') {
        if (pendingAction.step === 'ask_date') {
          const dateStr = parseHolidayDate(cmd);
          if (dateStr) {
            const titleStr = pendingAction.title;
            if (!titleStr) {
              setPendingAction({ type: 'create_holiday', step: 'ask_title', date: dateStr });
              addMessage('bot', 'What is the holiday name?');
            } else {
              setPendingAction({ type: 'create_holiday', step: 'confirm', title: titleStr, date: dateStr });
              addMessage('bot', `Create holiday "${titleStr}" on ${dateStr}? Please confirm.`, {
                showConfirmationOptions: true
              });
            }
            return;
          } else {
            addMessage('bot', 'Please enter a valid date (e.g. 15 August 2026 or 2026-08-15 or tomorrow).');
            return;
          }
        }

        if (pendingAction.step === 'ask_title') {
          const titleStr = cmd;
          const dateStr = pendingAction.date;
          setPendingAction({ type: 'create_holiday', step: 'confirm', title: titleStr, date: dateStr });
          addMessage('bot', `Create holiday "${titleStr}" on ${dateStr}? Please confirm.`, {
            showConfirmationOptions: true
          });
          return;
        }
      }

      if (pendingAction.step === 'confirm') {
        const isConfirmWord = lowerCmd === 'confirm' || lowerCmd === 'yes' || lowerCmd === 'ok' || lowerCmd === 'continue' || lowerCmd.startsWith('confirm ');
        if (isConfirmWord) {
          const actionToRun = pendingAction;
          await executePendingAction(actionToRun);
          return;
        } else {
          // Repeat command during pending confirmation
          if (pendingAction.type === 'download_single_payslip' && pendingAction.employee) {
            const emp = pendingAction.employee;
            const empCodeStr = emp.employeeCode || emp.employee_id || emp.code;
            const mName = getMonthNameStr(pendingAction.month);
            addMessage('bot', `You already have a pending payslip download for ${empCodeStr} - ${emp.name}, ${mName} ${pendingAction.year}. Please confirm or cancel.`, {
              showConfirmationOptions: true
            });
            return;
          } else if (pendingAction.type === 'checkout_all_employees') {
            addMessage('bot', `You already have a pending check-out for all employees. Please confirm or cancel.`, {
              showConfirmationOptions: true
            });
            return;
          } else if (pendingAction.type === 'mark_today_checkout' && pendingAction.employee) {
            const emp = pendingAction.employee;
            const empCodeStr = emp.employeeCode || emp.employee_id || emp.code;
            addMessage('bot', `You already have a pending check-out confirmation for ${empCodeStr} - ${emp.name}. Please confirm or cancel.`, {
              showConfirmationOptions: true
            });
            return;
          } else if ((pendingAction.type === 'mark_today_checkin' || pendingAction.type === 'mark_today_attendance') && pendingAction.employee) {
            const emp = pendingAction.employee;
            const empCodeStr = emp.employeeCode || emp.employee_id || emp.code;
            addMessage('bot', `You already have a pending check-in confirmation for ${empCodeStr} - ${emp.name}. Please confirm or cancel.`, {
              showConfirmationOptions: true
            });
            return;
          } else if (pendingAction.type === 'mark_today_absent' && pendingAction.employee) {
            const emp = pendingAction.employee;
            const empCodeStr = emp.employeeCode || emp.employee_id || emp.code;
            addMessage('bot', `You already have a pending absent mark action for ${empCodeStr} - ${emp.name}. Please confirm or cancel.`, {
              showConfirmationOptions: true
            });
            return;
          } else if (pendingAction.type === 'create_holiday') {
            addMessage('bot', `You already have a pending holiday creation for "${pendingAction.title}" on ${pendingAction.date}. Please confirm or cancel.`, {
              showConfirmationOptions: true
            });
            return;
          } else if (pendingAction.type === 'delete_holiday' && pendingAction.holiday) {
            const h = pendingAction.holiday;
            const formattedDateStr = h.holiday_date ? new Date(h.holiday_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
            addMessage('bot', `You already have a pending holiday deletion for "${h.holiday_title}" on ${formattedDateStr}. Please confirm or cancel.`, {
              showConfirmationOptions: true
            });
            return;
          }
        }
      }
    }

    setProcessing(true);

    try {
      // 0. Quick Buttons / Action Buttons / Dot "." Trigger
      const isQuickButtonsQuery =
        lowerCmd === '.' ||
        lowerCmd === 'quick buttons' ||
        lowerCmd === 'quick button' ||
        lowerCmd === 'buttons' ||
        lowerCmd === 'button' ||
        lowerCmd === 'action buttons' ||
        lowerCmd === 'action button' ||
        lowerCmd === 'quick actions' ||
        lowerCmd === 'quick action' ||
        lowerCmd === 'show buttons' ||
        lowerCmd === 'show action buttons' ||
        lowerCmd === 'show quick actions' ||
        lowerCmd === 'actions' ||
        lowerCmd === 'action';

      if (isQuickButtonsQuery) {
        addMessage('bot', 'Here are the quick action buttons:', { showQuickActions: true });
        setProcessing(false);
        return;
      }

      // 1. Check-Out All Employees
      const isCheckOutAll = lowerCmd.includes('checkout all') || lowerCmd.includes('check out all') || lowerCmd.includes('check-out all') || lowerCmd.includes('checkout everyone') || lowerCmd.includes('check out everyone') || lowerCmd.includes('check-out everyone') || lowerCmd.includes('close attendance for all') || lowerCmd.includes('today checkout for all') || lowerCmd.includes('all employees checkout');
      if (isCheckOutAll) {
        const confirmMsg = 'Do you want to mark check-out for all currently checked-in employees using current time?';
        setPendingAction({
          type: 'checkout_all_employees',
          step: 'confirm',
          date: 'today',
          awaitingConfirmation: true,
          confirmationText: confirmMsg,
          prompt: confirmMsg
        });
        addMessage('bot', confirmMsg, {
          showConfirmationOptions: true
        });
        setProcessing(false);
        return;
      }

      // 2. Single Check-Out Commands
      const isSingleCheckOut = (lowerCmd.includes('check out') || lowerCmd.includes('checkout') || lowerCmd.includes('check-out') || lowerCmd.includes('mark checkout') || lowerCmd.includes('mark check-out')) && !lowerCmd.includes('all') && !lowerCmd.includes('everyone');
      if (isSingleCheckOut) {
        let query = lowerCmd
          .replace(/^(?:mark\s+today\s+checkout\s+for|mark\s+today\s+check-out\s+for|mark\s+checkout\s+for|mark\s+check-out\s+for|check[-\s]?out\s+for|check[-\s]?out|checkout\s+for|checkout)\s+/i, '')
          .replace(/today/gi, '')
          .replace(/^for\s+/i, '')
          .trim();

        if (query) {
          const res = await executeBotCommand('search_employee', { query });
          if (res.data?.success) {
            const employees = res.data.data || [];
            if (employees.length === 0) {
              addMessage('bot', `No employee found for "${query}".`);
              setProcessing(false);
              return;
            } else if (employees.length === 1) {
              const emp = employees[0];
              const empCodeStr = emp.employeeCode || emp.employee_id || emp.code;
              const confirmMsg = `Mark check-out for ${empCodeStr} - ${emp.name} using current time? Please confirm.`;
              setPendingAction({
                type: 'mark_today_checkout',
                step: 'confirm',
                employee: emp,
                employeeId: empCodeStr,
                employeeName: emp.name,
                date: 'today',
                awaitingConfirmation: true,
                confirmationText: confirmMsg,
                prompt: confirmMsg
              });
              addMessage('bot', confirmMsg, {
                showConfirmationOptions: true
              });
              setProcessing(false);
              return;
            } else {
              setPendingAction({ type: 'mark_today_checkout', step: 'select_candidate', candidates: employees });
              addMessage('bot', `I found multiple employees matching "${query}". Please select one:`, {
                cardType: 'candidate_selection',
                candidates: employees
              });
              setProcessing(false);
              return;
            }
          }
        }
      }

      // 3. Single Check-In / Mark Attendance Commands
      const isMarkAttendance = (lowerCmd.includes('mark attendance') || lowerCmd.includes('check in') || lowerCmd.includes('check-in') || lowerCmd.includes('checkin') || lowerCmd.includes('put attendance')) && !lowerCmd.includes('absent') && !lowerCmd.includes('checkout') && !lowerCmd.includes('check out') && !lowerCmd.includes('check-out');
      if (isMarkAttendance) {
        let query = lowerCmd
          .replace(/^(?:mark\s+today\s+attendance\s+for|mark\s+attendance\s+for|mark\s+attendance|put\s+attendance\s+for|put\s+attendance|check[-\s]?in\s+for|check[-\s]?in|checkin\s+for|checkin)\s+/i, '')
          .replace(/today/gi, '')
          .replace(/^for\s+/i, '')
          .trim();

        if (query) {
          const res = await executeBotCommand('search_employee', { query });
          if (res.data?.success) {
            const employees = res.data.data || [];
            if (employees.length === 0) {
              addMessage('bot', `No employee found for "${query}".`);
              setProcessing(false);
              return;
            } else if (employees.length === 1) {
              const emp = employees[0];
              const empCodeStr = emp.employeeCode || emp.employee_id || emp.code;
              const confirmMsg = `Mark today check-in for ${empCodeStr} - ${emp.name} using current time? Please confirm.`;
              setPendingAction({
                type: 'mark_today_checkin',
                step: 'confirm',
                employee: emp,
                employeeId: empCodeStr,
                employeeName: emp.name,
                date: 'today',
                awaitingConfirmation: true,
                confirmationText: confirmMsg,
                prompt: confirmMsg
              });
              addMessage('bot', confirmMsg, {
                showConfirmationOptions: true
              });
              setProcessing(false);
              return;
            } else {
              setPendingAction({ type: 'mark_today_checkin', step: 'select_candidate', candidates: employees });
              addMessage('bot', `I found multiple employees matching "${query}". Please select one:`, {
                cardType: 'candidate_selection',
                candidates: employees
              });
              setProcessing(false);
              return;
            }
          }
        }
      }

      // 4. Mark Absent Commands
      const isMarkAbsent = (lowerCmd.includes('mark absent') || lowerCmd.includes('today absent') || lowerCmd.includes('put absent')) && !lowerCmd.includes('who is absent') && !lowerCmd.includes('summary');
      if (isMarkAbsent) {
        let query = lowerCmd
          .replace(/^(?:mark\s+absent\s+for|mark\s+absent|put\s+absent\s+for|put\s+absent|today\s+absent|absent)\s+/i, '')
          .replace(/today/gi, '')
          .replace(/^for\s+/i, '')
          .trim();

        if (query) {
          const res = await executeBotCommand('search_employee', { query });
          if (res.data?.success) {
            const employees = res.data.data || [];
            if (employees.length === 0) {
              addMessage('bot', `No employee found for "${query}".`);
              setProcessing(false);
              return;
            } else if (employees.length === 1) {
              const emp = employees[0];
              const empCodeStr = emp.employeeCode || emp.employee_id || emp.code;
              setPendingAction({ type: 'mark_today_absent', step: 'ask_reason', employee: emp, employeeId: empCodeStr, employeeName: emp.name });
              addMessage('bot', `Please provide absent reason for ${empCodeStr} - ${emp.name}.`);
              setProcessing(false);
              return;
            } else {
              setPendingAction({ type: 'mark_today_absent', step: 'select_candidate', candidates: employees });
              addMessage('bot', `I found multiple employees matching "${query}". Please select one:`, {
                cardType: 'candidate_selection',
                candidates: employees
              });
              setProcessing(false);
              return;
            }
          }
        }
      }

      // 5. Delete Holiday Commands
      const isDeleteHoliday = (lowerCmd.includes('delete holiday') || lowerCmd.includes('remove holiday') || lowerCmd.includes('delete tomorrow holiday') || lowerCmd.includes('remove tomorrow holiday') || (lowerCmd.startsWith('delete ') && lowerCmd.includes('holiday')) || (lowerCmd.startsWith('remove ') && lowerCmd.includes('holiday')));
      if (isDeleteHoliday) {
        const holidayDateStr = parseHolidayDate(cmd);
        let titleStr = lowerCmd
          .replace(/delete\s+holiday\s+for|remove\s+holiday\s+for|delete\s+holiday|remove\s+holiday|delete|remove|holiday|on|for|tomorrow|today/gi, '')
          .replace(/january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec/gi, '')
          .replace(/\b20\d{2}\b/g, '')
          .replace(/\b(0?[1-9]|[12]\d|3[01])\b/g, '')
          .trim();

        const searchRes = await executeBotCommand('search_holiday', { query: titleStr || null, date: holidayDateStr || null });
        if (searchRes.data?.success) {
          const holidays = searchRes.data.data || [];
          if (holidays.length === 0) {
            const notFoundMsg = holidayDateStr ? `No holiday found for ${holidayDateStr}.` : (titleStr ? `No holiday found matching "${titleStr}".` : 'No holiday found.');
            addMessage('bot', notFoundMsg);
            setProcessing(false);
            return;
          } else if (holidays.length === 1) {
            const h = holidays[0];
            const formattedDateStr = new Date(h.holiday_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
            setPendingAction({ type: 'delete_holiday', step: 'confirm', holiday: h });
            addMessage('bot', `I found holiday "${h.holiday_title}" on ${formattedDateStr}.\nDo you want to delete this holiday?`, {
              showConfirmationOptions: true
            });
            setProcessing(false);
            return;
          } else {
            setPendingAction({ type: 'delete_holiday', step: 'select_candidate', candidates: holidays });
            addMessage('bot', 'I found multiple holidays. Please select one to delete:', {
              cardType: 'candidate_selection',
              candidates: holidays.map(h => ({ id: h.id, name: `${h.holiday_title} (${h.holiday_date})`, employeeCode: h.holiday_type }))
            });
            setProcessing(false);
            return;
          }
        } else {
          addMessage('bot', searchRes.data?.message || 'Error searching holiday to delete.');
          setProcessing(false);
          return;
        }
      }

      // 3. Create Holiday Commands
      const isCreateHoliday = (lowerCmd.includes('create holiday') || lowerCmd.includes('add holiday') || lowerCmd.includes('mark tomorrow as holiday') || lowerCmd.includes('mark holiday'));
      if (isCreateHoliday) {
        const holidayDateStr = parseHolidayDate(cmd);
        let titleStr = lowerCmd
          .replace(/create\s+holiday|add\s+holiday|mark\s+tomorrow\s+as\s+holiday|mark\s+holiday|on|for|tomorrow|today/gi, '')
          .replace(/january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec/gi, '')
          .replace(/\b20\d{2}\b/g, '')
          .replace(/\b(0?[1-9]|[12]\d|3[01])\b/g, '')
          .trim();

        if (!holidayDateStr) {
          setPendingAction({ type: 'create_holiday', step: 'ask_date', title: titleStr || null });
          addMessage('bot', 'Which date do you want to create the holiday for?');
          setProcessing(false);
          return;
        }

        if (!titleStr) {
          setPendingAction({ type: 'create_holiday', step: 'ask_title', date: holidayDateStr });
          addMessage('bot', 'What is the holiday name?');
          setProcessing(false);
          return;
        }

        setPendingAction({ type: 'create_holiday', step: 'confirm', title: titleStr, date: holidayDateStr });
        addMessage('bot', `Create holiday "${titleStr}" on ${holidayDateStr}? Please confirm.`);
        setProcessing(false);
        return;
      }

      if (lowerCmd.includes('calculate') && (lowerCmd.includes('download') || lowerCmd.includes('pay slips') || lowerCmd.includes('payslip'))) {
        const { month, year } = parseMonthYearFromText(cmd);
        const targetMonth = month || new Date().getMonth() + 1;
        const targetYear = year || new Date().getFullYear();
        const mName = getMonthNameStr(targetMonth);
        setPendingAction({ type: 'calculate_and_download', step: 'confirm', month: targetMonth, year: targetYear });
        addMessage('bot', `Calculate payroll and download all payslips for ${mName} ${targetYear}? Please confirm.`);
        setProcessing(false);
        return;
      }

      const isCalculateCommand = lowerCmd.includes('calculate') && (lowerCmd.includes('payroll') || lowerCmd.includes('salary') || lowerCmd.includes('pay'));
      if (isCalculateCommand) {
        const { month, year } = parseMonthYearFromText(cmd);
        if (!month) {
          setPendingAction({ type: 'calculate_payroll', step: 'ask_month' });
          addMessage('bot', 'Which month and year?', { showMonthPicker: true });
          setProcessing(false);
          return;
        }
        const mName = getMonthNameStr(month);
        setPendingAction({ type: 'calculate_payroll', step: 'confirm', month, year });
        addMessage('bot', `Calculate payroll for ${mName} ${year}? Please confirm.`);
        setProcessing(false);
        return;
      }

      const isDownloadCommand = (lowerCmd.includes('download') || lowerCmd.includes('get') || lowerCmd.includes('export') || lowerCmd.startsWith('payslip')) && (lowerCmd.includes('payslip') || lowerCmd.includes('payslips') || lowerCmd.includes('pay slip') || lowerCmd.includes('pay slips') || lowerCmd.includes('salary slip'));
      if (isDownloadCommand) {
        const isBulk = lowerCmd.includes('all payslips') || lowerCmd.includes('all payslip') || lowerCmd.includes('every payslip') || lowerCmd.includes('bulk payslip') || lowerCmd.includes('download all') || lowerCmd.includes('all staff payslips');
        const { month, year } = parseMonthYearFromText(cmd);

        if (!isBulk) {
          let query = lowerCmd
            .replace(/download\s+payslips?\s+for|download\s+payslips?|download\s+pay\s+slips?\s+for|download\s+pay\s+slips?|get\s+payslips?\s+for|get\s+payslips?|export\s+payslips?\s+for|export\s+payslips?|payslips?\s+for|payslips?|pay\s+slips?\s+for|pay\s+slips?|salary\s+slips?\s+for|salary\s+slips?|download|get|export/gi, '')
            .replace(/this\s+month|current\s+month|last\s+month|previous\s+month/gi, '')
            .replace(/january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec/gi, '')
            .replace(/\b20\d{2}\b/g, '')
            .trim();

          if (query) {
            const res = await executeBotCommand('search_employee', { query });
            if (res.data?.success) {
              const employees = res.data.data || [];
              if (employees.length === 0) {
                addMessage('bot', `No employee found for "${query}".`);
                setProcessing(false);
                return;
              } else if (employees.length === 1) {
                const emp = employees[0];
                const empCodeStr = emp.employeeCode || emp.employee_id || emp.code;
                if (!month) {
                  setPendingAction({ type: 'download_single_payslip', step: 'ask_month', employee: emp });
                  addMessage('bot', `Which month and year do you want to download payslip for ${empCodeStr} - ${emp.name}?`, {
                    showMonthPicker: true
                  });
                  setProcessing(false);
                  return;
                } else {
                  const targetYear = year || new Date().getFullYear();
                  const mName = getMonthNameStr(month);
                  setPendingAction({ type: 'download_single_payslip', step: 'confirm', employee: emp, month, year: targetYear });
                  addMessage('bot', `Download payslip for ${empCodeStr} - ${emp.name} for ${mName} ${targetYear}? Please confirm.`);
                  setProcessing(false);
                  return;
                }
              } else {
                setPendingAction({ type: 'download_single_payslip', step: 'select_candidate', candidates: employees, month, year: year || new Date().getFullYear() });
                addMessage('bot', `I found multiple employees matching "${query}". Please select one:`, {
                  cardType: 'candidate_selection',
                  candidates: employees
                });
                setProcessing(false);
                return;
              }
            }
          }
        }

        if (!month) {
          setPendingAction({ type: 'download_payslips', step: 'ask_month' });
          addMessage('bot', 'Which month and year?', { showMonthPicker: true });
          setProcessing(false);
          return;
        }
        const mName = getMonthNameStr(month);
        const targetYear = year || new Date().getFullYear();
        setPendingAction({ type: 'download_payslips', step: 'confirm', month, year: targetYear });
        addMessage('bot', `Download all payslips for ${mName} ${targetYear}? Please confirm.`);
        setProcessing(false);
        return;
      }

      // Report Summary Commands
      const isReportSummary = 
        (lowerCmd.includes('report') || lowerCmd.includes('reports')) &&
        !lowerCmd.startsWith('open') &&
        !lowerCmd.startsWith('go to') &&
        !lowerCmd.startsWith('navigate') &&
        !lowerCmd.startsWith('take me to') &&
        !lowerCmd.includes('today report') &&
        !lowerCmd.includes('today attendance report');

      if (isReportSummary) {
        const { month, year } = parseMonthYearFromText(cmd);
        const targetMonth = month || (new Date().getMonth() + 1);
        const targetYear = year || new Date().getFullYear();

        let employeeQuery = null;
        const forMatch = cmd.match(/(?:report\s+(?:details\s+)?(?:for|of)|employee\s+report\s+for|report\s+for)\s+([a-zA-Z0-9\s-]+?)(?:\s+(?:for|in)\s+|$|\b(?:january|february|march|april|may|june|july|august|september|october|november|december|this month|last month|current month|20\d{2}))/i);

        if (forMatch && forMatch[1]) {
          const raw = forMatch[1].trim();
          const cleaned = raw.replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|this month|last month|current month|20\d{2}|report|reports)\b/gi, '').trim();
          if (cleaned && cleaned.length > 0 && !['details', 'summary', 'attendance'].includes(cleaned.toLowerCase())) {
            employeeQuery = cleaned;
          }
        }

        if (!employeeQuery) {
          const simpleForMatch = cmd.match(/\bfor\s+([a-zA-Z0-9\s-]+)/i);
          if (simpleForMatch && simpleForMatch[1]) {
            const cleaned = simpleForMatch[1].replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december|this month|last month|current month|20\d{2}|report|reports|details|summary|attendance)\b/gi, '').trim();
            if (cleaned && cleaned.length > 0) {
              employeeQuery = cleaned;
            }
          }
        }

        const res = await executeBotCommand('report_summary', {
          month: targetMonth,
          year: targetYear,
          employeeQuery
        });

        if (res.data?.success) {
          const type = res.data.type;
          if (type === 'report_summary_single') {
            const emp = res.data.data.employee;
            let msgText = `Report Details - ${emp.employeeName}\nMonth: ${res.data.data.monthName} ${res.data.data.year}\n\n`;
            msgText += `Present Days: ${emp.present}\n`;
            msgText += `Absent Days: ${emp.absent}\n`;
            msgText += `Half Day: ${emp.halfDay}\n`;
            msgText += `Late Days: ${emp.lateCount}\n`;
            msgText += `Counted Late + Permission Time: ${formatLateTime(emp.countedLateAndPermissionMinutes)}\n`;
            msgText += `Total Working Hours: ${emp.totalHours || 0}h`;

            addMessage('bot', msgText, { scrollToStart: true });
          } else if (type === 'report_summary_all') {
            const employeesList = res.data.data.employees || [];
            let msgText = `Report Summary - ${res.data.data.monthName} ${res.data.data.year}\n\n`;
            employeesList.forEach((emp, index) => {
              msgText += `${index + 1}. ${emp.employeeName}\n`;
              msgText += `Present Days: ${emp.present}\n`;
              msgText += `Absent Days: ${emp.absent}\n`;
              msgText += `Half Day: ${emp.halfDay}\n`;
              msgText += `Late Days: ${emp.lateCount}\n`;
              msgText += `Counted Late + Permission Time: ${formatLateTime(emp.countedLateAndPermissionMinutes)}\n`;
              msgText += `Total Working Hours: ${emp.totalHours || 0}h`;
              if (index < employeesList.length - 1) {
                msgText += `\n\n`;
              }
            });

            addMessage('bot', msgText, { scrollToStart: true });
          } else if (type === 'multiple_employees_found') {
            const candidates = res.data.data || [];
            setPendingAction({
              type: 'report_summary',
              step: 'select_candidate',
              candidates,
              month: targetMonth,
              year: targetYear
            });
            addMessage('bot', `I found multiple employees matching "${employeeQuery}". Please select one:`, {
              cardType: 'candidate_selection',
              candidates
            });
          }
        } else {
          addMessage('bot', res.data?.message || 'I could not generate report summary right now.');
        }

        setProcessing(false);
        return;
      }

      // --- 3. DEVELOPER QUERY (Priority 3) ---
      const isDeveloperQuery =
        lowerCmd.includes('who developed you') ||
        lowerCmd.includes('who created you') ||
        lowerCmd.includes('who is your developer') ||
        lowerCmd.includes('how developed you') ||
        lowerCmd.includes('who made you') ||
        lowerCmd === 'developer name' ||
        lowerCmd === 'developer';

      if (isDeveloperQuery && !lowerCmd.startsWith('open') && !lowerCmd.startsWith('go to') && !lowerCmd.startsWith('show page') && !lowerCmd.startsWith('navigate')) {
        const devName = botCapabilities?.botInfo?.developer || botCapabilities?.fallback?.developerResponse || 'Mohamed Mushraf';
        addMessage('bot', `I was developed by ${devName}.`);
        setProcessing(false);
        return;
      }

      // --- 4. GENERAL HELP & SPECIFIC HELP (Priority 4 & 5) ---
      const isHelpQuery =
        lowerCmd === 'help' ||
        lowerCmd === 'commands' ||
        lowerCmd === 'show commands' ||
        lowerCmd.startsWith('help_') ||
        lowerCmd.startsWith('how to') ||
        lowerCmd.startsWith('how do') ||
        lowerCmd.startsWith('how can') ||
        lowerCmd.endsWith(' help') ||
        lowerCmd.includes('help for') ||
        lowerCmd.includes('what can you do') ||
        lowerCmd.includes('what will you do') ||
        lowerCmd.includes('what are your actions') ||
        lowerCmd.includes('what actions can you do') ||
        lowerCmd.includes('how to use bot') ||
        lowerCmd.includes('how to use you') ||
        lowerCmd.includes('what command should i give') ||
        lowerCmd.includes('what can i ask') ||
        lowerCmd === 'prompt_help';

      if (isHelpQuery) {
        const isGeneralHelp =
          lowerCmd === 'help' ||
          lowerCmd === 'commands' ||
          lowerCmd === 'show commands' ||
          lowerCmd === 'prompt_help' ||
          lowerCmd === 'help_general' ||
          lowerCmd.includes('what can you do') ||
          lowerCmd.includes('what will you do') ||
          lowerCmd.includes('what are your actions') ||
          lowerCmd.includes('what actions can you do') ||
          lowerCmd.includes('how to use bot') ||
          lowerCmd.includes('what command should i give');

        if (isGeneralHelp) {
          addMessage('bot', getGeneralHelpText(botCapabilities), { showQuickActions: false, buttons: [], scrollToStart: true });
          setProcessing(false);
          return;
        }

        const matchedAction = findMatchingAction(lowerCmd, botCapabilities);
        if (matchedAction) {
          addMessage('bot', getActionHelpText(matchedAction), { showQuickActions: false, buttons: [], scrollToStart: true });
          setProcessing(false);
          return;
        }
      }

      // --- 5. BASIC CONVERSATION INTENTS (Priority 6) ---
      const convResponse = matchBasicConversation(lowerCmd, botCapabilities);
      if (convResponse) {
        addMessage('bot', convResponse);
        setProcessing(false);
        return;
      }

      // --- 6. UNKNOWN FALLBACK (Priority 7) ---
      const fallbackText = botCapabilities?.fallback?.unknown || 'I do not know that. Please ask my developer.';
      addMessage('bot', fallbackText);

    } catch (err) {
      console.error('Command execution error:', err);
      addMessage('bot', 'I could not process this command.');
    } finally {
      setProcessing(false);
    }
  };

  const handleSend = (e) => {
    e?.preventDefault();
    if (!inputVal.trim() || processing) return;

    const userText = inputVal.trim();
    setInputVal('');
    addMessage('user', userText);
    processUserCommand(userText);
  };

  const handleQuickAction = (action) => {
    addMessage('user', action.label);
    processUserCommand(action.command);
  };

  const executePendingAction = async (action) => {
    if (!action) return;

    console.log('pendingAction before confirm:', action);
    console.log('executing pending action:', action.type);

    const { type, month, year, employee, reason, title, date, holiday } = action;
    setPendingAction(null);

    setProcessing(true);
    try {
      if (type === 'download_single_payslip' && employee) {
        const empCodeStr = employee.employeeCode || employee.employee_id || employee.code || action.employeeId;
        await runDownloadSinglePayslip(empCodeStr, month, year, employee.name);
      } else if (type === 'mark_today_checkin' || type === 'mark_today_attendance' || type === 'mark_checkin') {
        const empCodeStr = employee?.employeeCode || employee?.employee_id || employee?.code || action.employeeId;
        addMessage('bot', `Marking check-in for ${empCodeStr} - ${employee?.name || action.employeeName || empCodeStr}...`);
        const res = await executeBotCommand('mark_today_attendance', { employeeCode: empCodeStr });
        addMessage('bot', res.data?.message || 'Attendance processed.');
      } else if (type === 'mark_today_checkout' || type === 'mark_checkout') {
        const empCodeStr = employee?.employeeCode || employee?.employee_id || employee?.code || action.employeeId;
        addMessage('bot', `Marking check-out for ${empCodeStr} - ${employee?.name || action.employeeName || empCodeStr}...`);
        const res = await executeBotCommand('mark_today_checkout', { employeeCode: empCodeStr });
        addMessage('bot', res.data?.message || 'Check-out processed.');
      } else if (type === 'checkout_all_employees') {
        addMessage('bot', 'Marking check-out for all pending employees...');
        const res = await executeBotCommand('checkout_all_employees');
        addMessage('bot', res.data?.message || 'Check-out all processed.');
      } else if (type === 'mark_today_absent' || type === 'mark_absent_today') {
        const empCodeStr = employee?.employeeCode || employee?.employee_id || employee?.code || action.employeeId;
        addMessage('bot', `Marking absent for ${empCodeStr} - ${employee?.name || action.employeeName || empCodeStr}...`);
        const res = await executeBotCommand('mark_today_absent', { employeeCode: empCodeStr, reason });
        addMessage('bot', res.data?.message || 'Absent marked.');
      } else if (type === 'create_holiday') {
        addMessage('bot', `Creating holiday "${title}" on ${date}...`);
        const res = await executeBotCommand('create_holiday', { holidayTitle: title, holidayDate: date });
        addMessage('bot', res.data?.message || 'Holiday created.');
      } else if (type === 'delete_holiday') {
        const hId = holiday?.id || action.holidayId;
        addMessage('bot', 'Deleting holiday...');
        const res = await executeBotCommand('delete_holiday', { holidayId: hId });
        addMessage('bot', res.data?.message || 'Holiday deleted.');
      } else if (type === 'calculate_payroll') {
        await runCalculatePayroll(month, year);
      } else if (type === 'download_payslips') {
        await runDownloadPayslips(month, year);
      } else if (type === 'calculate_and_download') {
        const calcSuccess = await runCalculatePayroll(month, year);
        if (calcSuccess) {
          await runDownloadPayslips(month, year);
        }
      }
    } catch (err) {
      console.error('Bot pending action execution error:', err);
      addMessage('bot', `Failed to execute action: ${err.response?.data?.message || err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmAction = async (confirmed) => {
    if (!pendingAction) return;

    if (!confirmed) {
      setPendingAction(null);
      addMessage('bot', 'Action cancelled.');
      return;
    }

    await executePendingAction(pendingAction);
  };

  if (!shouldRender) return null;

  return (
    <>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleBotPanel();
            }
          }}
          className={`admin-assistant-trigger ${isDragging ? 'is-dragging dragging' : ''}`}
          style={{
            left: `${buttonPosition.x}px`,
            top: `${buttonPosition.y}px`,
            right: 'auto',
            bottom: 'auto'
          }}
          title="MTM Admin Assistant (Drag to move)"
          aria-label="Open MTM Admin Assistant"
        >
          <div className="admin-assistant-trigger-inner">
            {!imgError ? (
              <img
                src={LOGO_PATH}
                alt="MTM Assistant"
                className="admin-assistant-logo"
                draggable="false"
                onDragStart={(e) => e.preventDefault()}
                onError={() => setImgError(true)}
              />
            ) : (
              <FiCpu size={28} className="text-blue-500 dark:text-blue-400" />
            )}
          </div>
        </button>
      )}

      {/* Bot Chat Panel */}
      {isOpen && (
        <div
          className="admin-assistant-panel"
          style={{
            left: `${panelPosition.left}px`,
            top: `${panelPosition.top}px`,
            right: 'auto',
            bottom: 'auto'
          }}
        >
          {/* Header */}
          <div className="admin-assistant-header">
            <div className="admin-assistant-header-info">
              <div className="admin-assistant-avatar">
                {!imgError ? (
                  <img
                    src={LOGO_PATH}
                    alt="MTM Logo"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <FiCpu size={18} className="text-blue-400" />
                )}
              </div>
              <div>
                <h3 className="admin-assistant-title">MTM Admin Assistant</h3>
                <span className="admin-assistant-subtitle">
                  <span className="admin-assistant-subtitle-dot" /> Online
                </span>
              </div>
            </div>

            <div className="admin-assistant-header-actions">
              <button
                type="button"
                onClick={handleResetPosition}
                className="admin-assistant-reset-btn"
                title="Reset Bot Position"
                aria-label="Reset Bot Position"
              >
                <FiRotateCcw size={16} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="admin-assistant-close-btn"
                title="Close Assistant"
                aria-label="Close Assistant"
              >
                <FiX size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="admin-assistant-body">
            {messages.map((msg) => (
              <div key={msg.id} ref={(el) => { if (el) messageRefs.current[msg.id] = el; }} className={`admin-assistant-msg-wrapper ${msg.sender}`}>
                <div className="admin-assistant-msg-bubble">
                  {msg.text}

                  {/* 1. Initial Quick Actions for Welcome Message */}
                  {msg.showQuickActions && (
                    <div className="admin-assistant-quick-actions">
                      {INITIAL_QUICK_ACTIONS.map((qa, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleQuickAction(qa)}
                          className="admin-assistant-quick-btn"
                        >
                          {qa.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 1b. Custom Per-Message Buttons (e.g. Help Categories) */}
                  {msg.buttons && msg.buttons.length > 0 && (
                    <div className="admin-assistant-quick-actions">
                      {msg.buttons.map((btn, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => handleQuickAction(btn)}
                          className="admin-assistant-quick-btn"
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 2. Month Picker Buttons */}
                  {msg.showMonthPicker && (
                    <div className="admin-assistant-quick-actions">
                      <button
                        type="button"
                        onClick={() => processUserCommand('this month')}
                        className="admin-assistant-quick-btn"
                      >
                        This Month
                      </button>
                      <button
                        type="button"
                        onClick={() => processUserCommand('last month')}
                        className="admin-assistant-quick-btn"
                      >
                        Last Month
                      </button>
                      <button
                        type="button"
                        onClick={() => processUserCommand('cancel')}
                        className="admin-assistant-quick-btn cancel"
                      >
                        Cancel
                      </button>
                    </div>
                  )}

                  {/* 3. Employee Search Result Cards */}
                  {msg.cardType === 'employee_search' && msg.employees && (
                    <div className="admin-assistant-emp-cards">
                      {msg.employees.map((emp) => (
                        <div key={emp.id} className="admin-assistant-emp-card">
                          <div className="admin-assistant-emp-header">
                            <span className="admin-assistant-emp-code">{emp.employeeCode}</span>
                            <span className={`admin-assistant-emp-status ${emp.status.toLowerCase()}`}>{emp.status}</span>
                          </div>
                          <h4 className="admin-assistant-emp-name">{emp.name}</h4>
                          <p className="admin-assistant-emp-meta">{emp.department} • {emp.designation}</p>
                          <div className="admin-assistant-emp-details">
                            <p>✉ {emp.email}</p>
                            <p>📞 {emp.phone}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleNavigation(parseNavigationCommand('open employees'))}
                            className="admin-assistant-emp-btn"
                          >
                            <FiExternalLink size={12} /> Open Employee Page
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Candidate Selection Card */}
                  {msg.cardType === 'candidate_selection' && msg.candidates && (
                    <div className="admin-assistant-list-card">
                      <p className="admin-assistant-list-subtitle">Please select an employee:</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                        {msg.candidates.map((emp, idx) => (
                          <button
                            key={emp.id || idx}
                            type="button"
                            onClick={() => handleSelectCandidate(emp)}
                            className="admin-assistant-emp-btn"
                            style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '8px 12px' }}
                          >
                            <strong>{emp.employeeCode || emp.employee_id}</strong> - {emp.name} ({emp.department || 'N/A'})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Today Absent List Card */}
                  {msg.cardType === 'today_absent' && msg.data && (
                    <div className="admin-assistant-list-card">
                      <p className="admin-assistant-list-subtitle">Marked Absent ({msg.data.absent.length})</p>
                      {msg.data.absent.length === 0 ? (
                        <p className="admin-assistant-list-empty">No marked absent employees today.</p>
                      ) : (
                        <ul className="admin-assistant-list font-medium">
                          {msg.data.absent.map((a, idx) => (
                            <li key={idx}><strong>{a.employeeCode}</strong> - {a.name} ({a.department})</li>
                          ))}
                        </ul>
                      )}

                      <p className="admin-assistant-list-subtitle mt-2">Not Mention ({msg.data.notMention.length})</p>
                      {msg.data.notMention.length === 0 ? (
                        <p className="admin-assistant-list-empty">All active employees have attendance entries today.</p>
                      ) : (
                        <ul className="admin-assistant-list font-medium">
                          {msg.data.notMention.slice(0, 8).map((nm, idx) => (
                            <li key={idx}><strong>{nm.employeeCode}</strong> - {nm.name} ({nm.department})</li>
                          ))}
                          {msg.data.notMention.length > 8 && (
                            <li className="text-xs opacity-75">+ {msg.data.notMention.length - 8} more</li>
                          )}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* 5. Today Late List Card */}
                  {msg.cardType === 'today_late' && msg.data && (
                    <div className="admin-assistant-list-card">
                      {msg.data.length === 0 ? (
                        <p className="admin-assistant-list-empty">No late employees found today.</p>
                      ) : (
                        <ul className="admin-assistant-list font-medium">
                          {msg.data.map((l, idx) => (
                            <li key={idx}>
                              <strong>{l.employeeCode}</strong> - {l.name}
                              <span className="admin-assistant-tag late">Late</span>
                              <span className="admin-assistant-time-text">In: {l.checkInTime}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* 6. Today Attendance Summary Grid */}
                  {msg.cardType === 'today_summary' && msg.data && (
                    <div className="admin-assistant-summary-grid">
                      <div className="admin-assistant-stat green">
                        <span className="val">{msg.data.present}</span>
                        <span className="lbl">Present</span>
                      </div>
                      <div className="admin-assistant-stat amber">
                        <span className="val">{msg.data.late}</span>
                        <span className="lbl">Late</span>
                      </div>
                      <div className="admin-assistant-stat red">
                        <span className="val">{msg.data.absent}</span>
                        <span className="lbl">Absent</span>
                      </div>
                      <div className="admin-assistant-stat purple">
                        <span className="val">{msg.data.halfDay}</span>
                        <span className="lbl">Half Day</span>
                      </div>
                      <div className="admin-assistant-stat blue">
                        <span className="val">{msg.data.working}</span>
                        <span className="lbl">Working</span>
                      </div>
                      <div className="admin-assistant-stat gray">
                        <span className="val">{msg.data.notMention}</span>
                        <span className="lbl">Not Mention</span>
                      </div>
                      {msg.data.present === 0 && msg.data.late === 0 && msg.data.absent === 0 && msg.data.halfDay === 0 && msg.data.working === 0 && (
                        <p className="admin-assistant-list-empty mt-2" style={{ gridColumn: 'span 2', textAlign: 'center' }}>
                          Attendance is not marked yet for today.
                        </p>
                      )}
                    </div>
                  )}

                </div>
                <span className="admin-assistant-msg-time">{msg.time}</span>
              </div>
            ))}

            {/* In-Chat Action Confirmation Prompt */}
            {pendingAction && pendingAction.step === 'confirm' && (
              <div className="admin-assistant-confirm-box">
                <p className="admin-assistant-confirm-text">{pendingAction.prompt}</p>
                <div className="admin-assistant-confirm-actions">
                  <button
                    type="button"
                    onClick={() => handleConfirmAction(true)}
                    className="admin-assistant-confirm-btn confirm"
                    disabled={processing}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmAction(false)}
                    className="admin-assistant-confirm-btn cancel"
                    disabled={processing}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input */}
          <form onSubmit={handleSend} className="admin-assistant-footer">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Type a command..."
              className="admin-assistant-input"
              disabled={processing}
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || processing}
              className="admin-assistant-send-btn"
              title="Send"
            >
              <FiSend size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

export default AdminAssistantBot;
