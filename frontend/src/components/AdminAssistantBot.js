import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getSettings, executeBotCommand, askAssistantAI, downloadAllPayslips, downloadSinglePayslip, getBotCapabilities } from '../services/api';
import { FiX, FiSend, FiCpu, FiExternalLink, FiRotateCcw, FiTrash2 } from 'react-icons/fi';
import './AdminAssistantBot.css';

const LOGO_PATH = `${process.env.PUBLIC_URL || ''}/favicon/favicon-96x96.png`;

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

// Reusable option chips. Every bot reply offers a few of these as "related options".
const SUGGESTION = {
  todaySummary: { label: '📊 Today Summary', command: 'today attendance summary' },
  absentToday: { label: '🚫 Absent Today', command: 'who is absent today' },
  lateToday: { label: '⏰ Late Today', command: 'who is late today' },
  presentToday: { label: '✅ Present Today', command: 'who is present today' },
  stillWorking: { label: '🕒 Still Working', command: 'who is still working' },
  onLeave: { label: '🌴 On Leave Today', command: 'who is on leave today' },
  permissionsToday: { label: '🎫 Permissions Today', command: 'permissions today' },
  consistentLate: { label: '📈 Consistently Late', command: 'who is consistently late this month' },
  frequentAbsent: { label: '📉 Frequently Absent', command: 'who is frequently absent this month' },
  monthReport: { label: '📊 This Month Report', command: 'show this month report' },
  calcPayroll: { label: '💰 Calculate Payroll', command: 'prompt_calculate_payroll' },
  downloadPayslips: { label: '📄 Download Payslips', command: 'prompt_download_payslips' },
  openPayroll: { label: '💳 Open Payroll', command: 'open payroll' },
  payslipHelp: { label: '📄 Payslip Help', command: 'help_payslip' },
  holidayHelp: { label: '🌴 Holiday Help', command: 'help_holiday' },
  openHolidays: { label: '🔗 Open Holidays', command: 'open holidays' },
  searchEmployee: { label: '🔍 Search Employee', command: 'prompt_search_employee' },
  attendanceHelp: { label: '⏱ Attendance Help', command: 'help_mark_attendance' },
  openManualAttendance: { label: '🔗 Manual Attendance', command: 'open manual attendance' },
  pageHelp: { label: '🔗 Page Help', command: 'help_navigation' },
  help: { label: '❓ All Commands', command: 'help' },
  cancel: { label: 'Cancel', command: 'cancel', variant: 'cancel' }
};

const TOPIC_SUGGESTIONS = {
  general: [SUGGESTION.todaySummary, SUGGESTION.absentToday, SUGGESTION.lateToday, SUGGESTION.consistentLate],
  today_summary: [SUGGESTION.absentToday, SUGGESTION.lateToday, SUGGESTION.presentToday],
  today_absent: [SUGGESTION.lateToday, SUGGESTION.frequentAbsent, SUGGESTION.onLeave],
  today_late: [SUGGESTION.consistentLate, SUGGESTION.absentToday, SUGGESTION.permissionsToday],
  today_list: [SUGGESTION.todaySummary, SUGGESTION.absentToday, SUGGESTION.lateToday],
  insights_late: [SUGGESTION.frequentAbsent, SUGGESTION.lateToday, SUGGESTION.monthReport],
  insights_absent: [SUGGESTION.consistentLate, SUGGESTION.absentToday, SUGGESTION.monthReport],
  insights_half_day: [SUGGESTION.consistentLate, SUGGESTION.frequentAbsent, SUGGESTION.monthReport],
  report: [SUGGESTION.consistentLate, SUGGESTION.frequentAbsent, SUGGESTION.calcPayroll],
  payroll: [SUGGESTION.downloadPayslips, SUGGESTION.monthReport, SUGGESTION.openPayroll],
  payslip: [SUGGESTION.calcPayroll, SUGGESTION.openPayroll],
  holiday: [SUGGESTION.openHolidays, SUGGESTION.holidayHelp],
  attendance_action: [SUGGESTION.todaySummary, SUGGESTION.absentToday, SUGGESTION.lateToday],
  employee: [SUGGESTION.searchEmployee, SUGGESTION.todaySummary],
  navigation: [SUGGESTION.todaySummary, SUGGESTION.help],
  help: [SUGGESTION.todaySummary, SUGGESTION.consistentLate, SUGGESTION.absentToday],
  conversation: [SUGGESTION.todaySummary, SUGGESTION.absentToday, SUGGESTION.lateToday, SUGGESTION.help],
  error: [SUGGESTION.todaySummary, SUGGESTION.help]
};

const getTopicSuggestions = (topic) => TOPIC_SUGGESTIONS[topic] || TOPIC_SUGGESTIONS.general;

const ABSENT_REASON_OPTIONS = [
  { label: 'Sick Leave', command: 'Sick Leave' },
  { label: 'Personal Reason', command: 'Personal Reason' },
  { label: 'Not Informed', command: 'Not Informed' },
  SUGGESTION.cancel
];

const SIGNATURE_OPTIONS = [
  { label: 'With Signature', command: '1' },
  { label: 'Without Signature', command: '2' },
  SUGGESTION.cancel
];

const INITIAL_QUICK_ACTIONS = [
  { label: '📊 Today Summary', command: 'today attendance summary' },
  { label: '🚫 Absent Today', command: 'who is absent today' },
  { label: '⏰ Late Today', command: 'who is late today' },
  { label: '📈 Consistently Late', command: 'who is consistently late this month' },
  { label: '📉 Frequently Absent', command: 'who is frequently absent this month' },
  { label: '📊 Report Summary', command: 'show report' },
  { label: '❓ Help / Commands', command: 'help' },
  { label: '⏱ Attendance Help', command: 'help_mark_attendance' },
  { label: '📄 Payslip Help', command: 'help_payslip' },
  { label: '💰 Payroll Help', command: 'help_payroll' },
  { label: '🌴 Holiday Help', command: 'help_holiday' },
  { label: '🔗 Page Help', command: 'help_navigation' },
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

const getTimeStr = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const WELCOME_TEXT = 'Hi, I am your MTM Admin Assistant.\nAsk me about today\'s attendance, late or absent details, who is consistently late, reports, payroll, payslips, or holidays. Choose an option below or type your question.';

const createWelcomeMessage = () => ({
  id: `welcome-${Date.now()}`,
  sender: 'bot',
  text: WELCOME_TEXT,
  showQuickActions: true,
  time: getTimeStr()
});

// Chat history lives in sessionStorage (same lifetime as the admin login session, cleared on logout)
const CHAT_STORAGE_PREFIX = 'mtm_admin_assistant_chat_';
const MAX_STORED_MESSAGES = 60;

const loadChatHistory = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const valid = parsed.filter((m) => m && m.type !== 'loading' && (m.sender === 'bot' || m.sender === 'user'));
    return valid.length > 0 ? valid : null;
  } catch (e) {
    return null;
  }
};

const saveChatHistory = (key, msgs) => {
  try {
    const toStore = msgs.filter((m) => m.type !== 'loading').slice(-MAX_STORED_MESSAGES);
    sessionStorage.setItem(key, JSON.stringify(toStore));
  } catch (e) {
    // Storage full or blocked: chat keeps working in memory
  }
};

const removeChatHistory = (key) => {
  try {
    sessionStorage.removeItem(key);
  } catch (e) {}
};

const CLEAR_CHAT_RE = /^(?:clear|delete|reset|remove)\s*(?:the\s+)?(?:chat|conversation|history|messages|all\s+messages|chat\s+history)?$/;

// Commands that perform an action; these never go through the question/details detector
const ACTION_VERB_RE = /^(?:mark|put|make|check(?=\s*-?\s*(?:in|out)\b)|checkin|checkout|create|add|delete|remove|calculate|download|send|email|export|open|go\s+to|navigate|take\s+me|generate|payslip)\b/;

// Basic Hinglish -> English normalisation used only for understanding questions
const HINGLISH_RULES = [
  [/\b(?:is|iss|ye|yeh)\s+(?:mahine|mahina|month)\b/g, ' this month '],
  [/\b(?:pichle|pichhle|pichla|pichhla)\s+(\d{1,2})\s+(?:mahine|mahino|mahina|months?)\b/g, ' last $1 months '],
  [/\b(?:pichle|pichhle|pichla|pichhla)\s+(?:mahine|mahina|month)\b/g, ' last month '],
  [/\b(?:mahine|mahina)\b/g, ' month '],
  [/\b(?:aaj|aj)\b/g, ' today '],
  [/\babhi\b/g, ' now '],
  [/\b(?:baar\s*-?\s*baar|bar\s*-?\s*bar|hamesha|humesha|rozana|roz|har\s+din|aksar)\b/g, ' frequently '],
  [/\b(?:sabse|sab\s+se)\s+(?:zyada|jyada|jada)\b/g, ' most '],
  [/\b(?:der\s+se|derse|lait|leyt)\b/g, ' late '],
  [/\b(?:nahi|nahin|nai|nhi)\s+(?:aaya|aaye|aayi|aya|aye|ayi|aata|aate|aati|aa\s+raha|aa\s+rahe|aa\s+rahi)\b/g, ' absent '],
  [/\b(?:gair|ghair)\s*-?\s*(?:hazir|haazir)\b/g, ' absent '],
  [/\b(?:chutti|chhutti|chuti|chhuti)\b/g, ' leave '],
  [/\b(?:hazir|haazir|maujood|mojood)\b/g, ' present '],
  [/\b(?:hazri|haziri|hajri|haajri)\b/g, ' attendance '],
  [/\b(?:kaun|kon|koun|kaon)\b/g, ' who '],
  [/\b(?:kitne|kitni|kitna)\b/g, ' how many '],
  [/\b(?:dikhao|dikhado|dikha|batao|bata|bataiye|bataye|dikhaiye|bolo)\b/g, ' show '],
  [/\b(?:tankhwah|tankha|pagaar|pagar)\b/g, ' salary '],
  [/\b(?:log|logo|logon|wale|wala|wali|hai|hain|tha|thi|ka|ki|ke|ko|mein|me|main|par|pe|kya|hua|hue|raha|rahe|rahi|aate|aata|aati|aaye|aaya|aayi|aane|aana|karte|karta|karti|hote|hota|hoti|gaya|gaye|gayi|se)\b/g, ' ']
];

const normalizeIntentText = (lowerCmd) => {
  let text = ` ${String(lowerCmd || '').replace(/[?!.,;:]+/g, ' ')} `;
  HINGLISH_RULES.forEach(([re, replacement]) => {
    text = text.replace(re, replacement);
  });
  return text.replace(/\s+/g, ' ').trim();
};

const LATE_WORD_RE = /\b(?:late|lateness|latecomers?|late\s*comers?|delayed|tardy)\b/;
const ABSENT_WORD_RE = /\b(?:absent|absents|absence|absences|absentees?|absenteeism|not\s+came|did\s*n[o']?t\s+come|not\s+come|not\s+coming)\b/;
const HALF_DAY_WORD_RE = /\bhalf[\s-]?days?\b/;
const PRESENT_WORD_RE = /\b(?:present|came|arrived|in\s+office)\b/;
const WORKING_WORD_RE = /\b(?:still\s+working|working\s+now|currently\s+working|who\s+is\s+working|not\s+checked\s*-?\s*out|not\s+check\s*-?\s*out)\b/;
const CHECKED_OUT_WORD_RE = /\b(?:checked\s*-?\s*out|left\s+office|gone\s+home|went\s+home)\b/;
const LEAVE_WORD_RE = /\b(?:on\s+leave|leave|leaves|paid\s+leave|vacation)\b/;
const PERMISSION_WORD_RE = /\bpermissions?\b/;
const NOT_MARKED_WORD_RE = /\b(?:not\s+marked|not\s+mention(?:ed)?|unmarked|not\s+checked\s*-?\s*in|no\s+attendance|yet\s+to\s+come|not\s+yet\s+come)\b/;
const PATTERN_WORD_RE = /\b(?:consistent(?:ly)?|frequent(?:ly)?|regular(?:ly)?|always|often|mostly|most|habitual(?:ly)?|repeated(?:ly)?|again\s+and\s+again|many\s+times|every\s*day|daily|top|ranking|rank|highest|maximum|max|monthly|month|weekly|week|history|times|trend|pattern|analysis|days|reports?)\b/;
const DETAIL_WORD_RE = /\b(?:details?|records?|info|information|list|summary|data)\b/;
const TODAY_WORD_RE = /\b(?:today|now|currently|so\s+far)\b/;
const PERIOD_WORD_RE = /\b(?:this|last|previous|current)\s+month\b|\b(?:last|past|previous)\s+\d{1,2}\s+months?\b|\b20\d{2}\b|\b(?:0?[1-9]|1[0-2])[/-]20\d{2}\b/;

const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_TOKEN_RE = /\b(january|february|march|april|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b/;
// "may" is also an ordinary English word, so only treat it as a month in a clear month context
const MAY_MONTH_RE = /\b(?:in|for|of|during)\s+may\b|\bmay\s+(?:20\d{2}|report|payroll|payslips?|month|salary|attendance)\b/;

const findMonthInText = (lower) => {
  const match = String(lower || '').match(MONTH_TOKEN_RE);
  if (match) return MONTH_SHORT.indexOf(match[1].substring(0, 3)) + 1;
  if (MAY_MONTH_RE.test(lower)) return 5;
  return null;
};

const INTENT_STOP_WORDS = new Set(`
who whom whose which what when where why how is are was were be been being am has have had do does did done
the a an of for to in on at by from with about into than then there here this that these those it its
last past previous current next month months monthly week weeks weekly year years today now currently so far yet
show me give get list tell find check see view display fetch bring provide want need know let
please pls plz kindly sir madam maam bro bhai ji
all any every each everyone everybody someone anyone anybody somebody employee employees staff people person persons
member members team teams emp emps worker workers ones one guys name names
late lateness latecomer latecomers comer comers coming came come arrived arrive arrival arrivals delayed delay tardy
absent absents absence absences absentee absentees absenteeism not didnt didn't did reason reasons
half day days halfday halfdays present working still checked check out in office leave leaves on paid vacation
permission permissions marked unmarked mention mentioned entry entries left gone went home yet
consistent consistently frequent frequently regular regularly always often mostly most habitual habitually repeated
repeatedly again many times time every daily top ranking rank ranked highest high maximum max more less over above least
details detail record records info information summary data report reports history trend trends pattern patterns
analysis count total number numbers and or but also too very much my our your his her their i we you he she they them us
attendance status
`.trim().split(/\s+/));

// Removes the "question words" and leaves what is probably an employee name or code
const MONTH_ONLY_TOKEN_RE = new RegExp(`^(?:${MONTH_TOKEN_RE.source.replace(/\\b/g, '')}|may)$`);

// Works token by token so employee codes like "MTM-01" or "EMP-2024" stay intact
const extractEmployeeQuery = (text) => String(text || '')
  .split(/\s+/)
  .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
  .filter((token) => token
    && !INTENT_STOP_WORDS.has(token)
    && !MONTH_ONLY_TOKEN_RE.test(token)
    && !/^20\d{2}$/.test(token)
    && !/^\d{1,2}\+?$/.test(token))
  .join(' ')
  .trim();

const parseThreshold = (text) => {
  const atLeast = text.match(/\b(\d{1,2})\s*(?:\+|or\s+more|or\s+above|times?\s+or\s+more)/) || text.match(/\b(?:at\s*least|atleast|minimum|min)\s+(\d{1,2})\b/);
  if (atLeast) return parseInt(atLeast[1], 10);
  const moreThan = text.match(/\b(?:more\s+than|above|over)\s+(\d{1,2})\b/);
  if (moreThan) return parseInt(moreThan[1], 10) + 1;
  return undefined;
};

/**
 * Understands late / absent / half-day questions.
 * Returns { kind: 'insights' | 'today', metrics, employeeQuery, ... } or null.
 */
const detectAttendanceQuestion = (text) => {
  const metrics = [];
  if (LATE_WORD_RE.test(text)) metrics.push('late');
  if (ABSENT_WORD_RE.test(text)) metrics.push('absent');
  if (HALF_DAY_WORD_RE.test(text)) metrics.push('half_day');
  if (metrics.length === 0) return null;

  const employeeQuery = extractEmployeeQuery(text);
  const hasToday = TODAY_WORD_RE.test(text);
  const hasPeriod = !!findMonthInText(text) || PERIOD_WORD_RE.test(text);
  const hasPattern = PATTERN_WORD_RE.test(text);
  const hasDetailWord = DETAIL_WORD_RE.test(text);

  const wantsMonthAnalysis = !hasToday && (hasPattern || hasPeriod || (hasDetailWord && !!employeeQuery));
  if (wantsMonthAnalysis) {
    return { kind: 'insights', metrics, employeeQuery, threshold: parseThreshold(text) };
  }
  return { kind: 'today', metrics, employeeQuery };
};

// Understands "who is present / still working / on leave / ..." questions for today
const detectTodayListQuestion = (text) => {
  const hasPeriod = !!findMonthInText(text) || PERIOD_WORD_RE.test(text);
  let status = null;
  if (WORKING_WORD_RE.test(text)) status = 'working';
  else if (NOT_MARKED_WORD_RE.test(text)) status = 'not_marked';
  else if (CHECKED_OUT_WORD_RE.test(text)) status = 'checked_out';
  else if (PERMISSION_WORD_RE.test(text) && (TODAY_WORD_RE.test(text) || /\bwho\b/.test(text))) status = 'permission';
  else if (LEAVE_WORD_RE.test(text) && !hasPeriod) status = 'leave';
  else if (PRESENT_WORD_RE.test(text)) status = 'present';
  if (!status) return null;
  return { status, hasPeriod, employeeQuery: extractEmployeeQuery(text) };
};

const FALLBACK_RULES = [
  { re: /\b(?:late|lateness|delay|punctual|punctuality|timing)\b/, items: [SUGGESTION.lateToday, SUGGESTION.consistentLate] },
  { re: /\b(?:absent|absence|missing|leave)\b/, items: [SUGGESTION.absentToday, SUGGESTION.frequentAbsent] },
  { re: /\b(?:consistent|consistently|frequent|frequently|regular|regularly|habit|pattern)\b/, items: [SUGGESTION.consistentLate, SUGGESTION.frequentAbsent] },
  { re: /\b(?:present|attendance|status|today|came|working)\b/, items: [SUGGESTION.todaySummary, SUGGESTION.presentToday] },
  { re: /\b(?:payroll|salary|pay|wage|wages|deduction|lop|ctc)\b/, items: [SUGGESTION.calcPayroll, SUGGESTION.openPayroll] },
  { re: /\b(?:payslips?|slips?)\b/, items: [SUGGESTION.downloadPayslips, SUGGESTION.payslipHelp] },
  { re: /\b(?:holidays?|vacation|festival|sunday)\b/, items: [SUGGESTION.holidayHelp, SUGGESTION.openHolidays] },
  { re: /\b(?:reports?|monthly|month|summary|analysis|performance)\b/, items: [SUGGESTION.monthReport, SUGGESTION.consistentLate] },
  { re: /\b(?:employees?|staff|person|contact|phone|email|mobile|details)\b/, items: [SUGGESTION.searchEmployee] },
  { re: /\b(?:check|checkin|checkout|mark|punch|entry)\b/, items: [SUGGESTION.attendanceHelp, SUGGESTION.openManualAttendance] },
  { re: /\b(?:page|open|go|navigate|menu|screen|settings)\b/, items: [SUGGESTION.pageHelp] }
];

const getFallbackSuggestions = (text) => {
  const picked = [];
  FALLBACK_RULES.forEach((rule) => {
    if (!rule.re.test(text)) return;
    rule.items.forEach((item) => {
      if (!picked.some((p) => p.command === item.command)) picked.push(item);
    });
  });
  if (picked.length === 0) {
    return { matched: false, items: [...TOPIC_SUGGESTIONS.general, SUGGESTION.help] };
  }
  return { matched: true, items: picked.slice(0, 4) };
};

const METRIC_WORD = { late: 'late', absent: 'absent', half_day: 'half day' };
const AI_HISTORY_LIMIT = 10;
const METRIC_PATTERN_COMMAND = {
  late: 'who is consistently late',
  absent: 'who is frequently absent',
  half_day: 'who has frequent half days'
};

const getEmployeeSuggestions = (code, monthName, year) => {
  const period = monthName && year ? ` ${monthName} ${year}` : '';
  return [
    { label: `📈 Late details ${code}`, command: `late details for ${code}${period}` },
    { label: `📉 Absent details ${code}`, command: `absent details for ${code}${period}` },
    { label: `📊 Report ${code}`, command: `show report for ${code}${period}` }
  ];
};

const getApiErrorMessage = (err, fallback) => err?.response?.data?.message || fallback;

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
    patterns: ["thanks", "thank you", "thank you bot", "thx", "shukriya", "dhanyavad"],
    response: "You're welcome! Let me know what you would like to check next."
  },
  acknowledgement: {
    patterns: ["ok", "okay", "fine", "good", "done", "theek hai", "thik hai", "accha"],
    response: "Sure. What would you like to check next?"
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

  const monthNum = findMonthInText(lower);
  if (monthNum) {
    const dayMatch = text.match(/\b(0?[1-9]|[12]\d|3[01])\b/);
    const yearMatch = text.match(/\b(20\d{2})\b/);
    const dVal = dayMatch ? parseInt(dayMatch[1]) : 1;
    const yVal = yearMatch ? parseInt(yearMatch[1]) : now.getFullYear();
    return `${yVal}-${String(monthNum).padStart(2, '0')}-${String(dVal).padStart(2, '0')}`;
  }

  return null;
};

/**
 * Natural Language Date / Month Parser
 */
const parseMonthYearFromText = (text) => {
  const lower = String(text || '').toLowerCase();
  const now = new Date();
  let month = null;
  let year = now.getFullYear();
  let relative = false;

  if (lower.includes('this month') || lower.includes('current month') || lower.includes('this period')) {
    month = now.getMonth() + 1;
    relative = true;
  } else if (lower.includes('last month') || lower.includes('previous month')) {
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    month = lastMonthDate.getMonth() + 1;
    year = lastMonthDate.getFullYear();
    relative = true;
  }

  const yearMatch = lower.match(/\b(20\d{2})\b/);
  if (yearMatch) {
    year = parseInt(yearMatch[1], 10);
  }

  const numMonthMatch = lower.match(/\b(0?[1-9]|1[0-2])[/ -](20\d{2})\b/);
  if (numMonthMatch) {
    month = parseInt(numMonthMatch[1], 10);
    year = parseInt(numMonthMatch[2], 10);
  }

  if (!month) {
    month = findMonthInText(lower);
    // "December" asked in November means the December that already happened (last year)
    if (month && !yearMatch && !relative && month > now.getMonth() + 1) {
      year = now.getFullYear() - 1;
    }
  }

  return { month, year };
};

const MAX_MULTI_MONTHS = 6;

/**
 * Returns the list of months a question is about, oldest first.
 * "last 3 months" -> the 3 completed months before this one; otherwise a single month (or none).
 */
const parsePeriodsFromText = (text) => {
  const lower = String(text || '').toLowerCase();
  const multi = lower.match(/\b(?:last|past|previous)\s+(\d{1,2})\s+months?\b/);
  if (multi) {
    const count = Math.min(Math.max(parseInt(multi[1], 10) || 1, 1), MAX_MULTI_MONTHS);
    const now = new Date();
    const periods = [];
    for (let i = count; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push({ month: d.getMonth() + 1, year: d.getFullYear() });
    }
    return periods;
  }
  const { month, year } = parseMonthYearFromText(lower);
  return month ? [{ month, year }] : [];
};

// Words that can appear in a "same question, other month" follow-up such as "check for last month also"
const FOLLOW_UP_FILLER = new Set(`
check for also what about and same show please pls plz then in of the again too month months last past previous this
current how it me give see do now ok okay sir madam tell data details detail year period also bhi ka ki ke kya for
same thing same one that one with only just
`.trim().split(/\s+/));

const hasPeriodInText = (text) => !!findMonthInText(text) || PERIOD_WORD_RE.test(text);

// True when the message only names a period ("last month", "check for October also", "what about 2025")
const isPeriodOnlyFollowUp = (text) => {
  if (!hasPeriodInText(text)) return false;
  const rest = String(text || '')
    .split(/\s+/)
    .map((token) => token.replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, ''))
    .filter((token) => token
      && !FOLLOW_UP_FILLER.has(token)
      && !MONTH_ONLY_TOKEN_RE.test(token)
      && !/^20\d{2}$/.test(token)
      && !/^\d{1,2}$/.test(token)
      && !/^(?:0?[1-9]|1[0-2])[/-]20\d{2}$/.test(token));
  return rest.length === 0;
};

const getRecentMonthOptions = (count = 6) => {
  const now = new Date();
  const items = [];
  for (let i = 2; i < count + 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const name = MONTH_NAMES[d.getMonth()];
    items.push({
      label: `${name.charAt(0).toUpperCase()}${name.slice(1, 3)} ${d.getFullYear()}`,
      command: `${name} ${d.getFullYear()}`
    });
  }
  return items;
};

const ADMIN_PAGE_ROUTES = [
  { keys: ["dashboard", "home", "admin dashboard"], label: "Dashboard", route: "/admin/dashboard", permission: "dashboard" },
  { keys: ["employee", "employees", "staff", "user", "users", "employee list"], label: "Employees", route: "/admin/employees", permission: "employees" },
  { keys: ["department", "departments", "dept"], label: "Departments", route: "/admin/departments", permission: "departments" },
  { keys: ["admin management", "admins", "admin users", "admin", "management", "admin list"], label: "Admin Management", route: "/admin/management", permission: "admin_management" },
  { keys: ["attendance", "daily attendance"], label: "Attendance", route: "/admin/attendance", permission: "attendance" },
  { keys: ["permission", "permissions", "user permissions", "role permissions"], label: "Permissions", route: "/admin/permissions", permission: "permissions" },
  { keys: ["manual attendance", "manual", "manual entry", "manual checkin", "manual attendance page"], label: "Manual Attendance", route: "/admin/manual-attendance", permission: "manual_attendance" },
  { keys: ["absent reason", "absent reasons", "reason", "reasons", "absent reason page"], label: "Absent Reasons", route: "/admin/absent-reasons", permission: "absent_reasons" },
  { keys: ["holiday", "holidays", "holiday page"], label: "Holidays", route: "/admin/holidays", permission: "holidays" },
  { keys: ["payroll", "salary", "payroll page", "salary page"], label: "Payroll", route: "/admin/payroll", permission: "payroll" },
  { keys: ["expense", "expenses", "finance", "expenses page"], label: "Expenses", route: "/admin/expenses", permission: "expenses" },
  { keys: ["reports", "report page", "reports page"], label: "Reports", route: "/admin/reports", permission: "reports" },
  { keys: ["settings", "setting", "system settings", "settings page"], label: "Settings", route: "/admin/settings", permission: "settings" },
  { keys: ["activity log", "activity logs", "admin activity", "logs", "activity log page"], label: "Activity Logs", route: "/admin/activity-logs", permission: "activity_logs" },
  { keys: ["database monitor", "database", "db monitor", "storage", "db", "database page", "db page", "database monitor page"], label: "Database Monitor", route: "/admin/database-monitor", permission: "database_monitor" },
  { keys: ["trusted device", "trusted devices", "devices", "trusted device page"], label: "Trusted Devices", route: "/admin/trusted-devices", permission: "trusted_devices" },
  { keys: ["manage", "manage page", "system manage"], label: "Manage", route: "/admin/manage", permission: "manage" },
  { keys: ["security log", "security logs", "security", "security log page"], label: "Security Logs", route: "/admin/security-logs", permission: "security_logs" },
  { keys: ["otp setting", "otp settings", "otp", "otp setting page"], label: "OTP Settings", route: "/admin/otp-settings", permission: "otp_settings" }
];

const parseNavigationCommand = (commandText) => {
  const text = commandText.toLowerCase().trim();
  const navPrefixes = ['take me to ', 'navigate to ', 'open ', 'go to '];

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
  const { isAdmin, hasPermission, hasPageAccess, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [botEnabled, setBotEnabled] = useState(false);
  const [botCapabilities, setBotCapabilities] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [processing, setProcessing] = useState(false);

  const [pendingAction, setPendingAction] = useState(null);
  // Last month-based question, so "check for last month also" can repeat it for another month
  const lastQueryRef = useRef(null);

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

  const [messages, setMessages] = useState(() => [createWelcomeMessage()]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [historyLoadedKey, setHistoryLoadedKey] = useState(null);

  const adminIdentity = user ? (user.id ?? user.email ?? user.username ?? null) : null;
  const chatStorageKey = adminIdentity !== null && adminIdentity !== undefined ? `${CHAT_STORAGE_PREFIX}${adminIdentity}` : null;

  // Restore this admin's conversation after a page refresh
  useEffect(() => {
    if (!chatStorageKey) return;
    setMessages(loadChatHistory(chatStorageKey) || [createWelcomeMessage()]);
    setPendingAction(null);
    setConfirmClear(false);
    setHistoryLoadedKey(chatStorageKey);
  }, [chatStorageKey]);

  useEffect(() => {
    if (!chatStorageKey || historyLoadedKey !== chatStorageKey) return;
    saveChatHistory(chatStorageKey, messages);
  }, [messages, chatStorageKey, historyLoadedKey]);

  const handleClearChat = () => {
    if (chatStorageKey) removeChatHistory(chatStorageKey);
    setPendingAction(null);
    setConfirmClear(false);
    setInputVal('');
    setMessages([createWelcomeMessage()]);
  };

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
    const props = { ...extraProps };
    // Every bot reply carries related options, unless it is waiting for a specific answer
    if (sender === 'bot' && !props.showQuickActions && props.suggestions === undefined) {
      const isPrompt = props.showConfirmationOptions || props.showMonthPicker || props.promptOptions || props.cardType === 'candidate_selection';
      props.suggestions = isPrompt ? [] : getTopicSuggestions(props.topic);
    }
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        sender,
        text,
        time: getTimeStr(),
        ...props
      }
    ]);
  };

  const addLoadingMessage = (text = 'Thinking...') => {
    const id = `loading-${Date.now()}-${Math.random()}`;
    setMessages((prev) => [
      ...prev,
      {
        id,
        sender: 'bot',
        type: 'loading',
        text,
        showQuickActions: false,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
    return id;
  };

  const removeLoadingMessage = (id) => {
    if (!id) return;
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  };

  const handleNavigation = (navResult) => {
    if (!navResult) return;
    if (navResult.intent === 'UNKNOWN_PAGE') {
      addMessage(
        'bot',
        'That page name did not match an admin page.\nYou can ask me to open:\nDashboard, Employees, Departments, Attendance, Permissions, Manual Attendance, Absent Reasons, Holidays, Payroll, Expenses, Reports, Settings, Activity Logs, Database Monitor, Trusted Devices, Admin Management.',
        { suggestions: [SUGGESTION.pageHelp, SUGGESTION.help] }
      );
      return;
    }

    const allowed = hasPermission ? hasPermission(navResult.permission, 'can_view') : (hasPageAccess ? hasPageAccess(navResult.permission) : true);

    if (!allowed) {
      addMessage('bot', `You do not have permission to open ${navResult.label}. Please contact your super admin for access.`, { topic: 'navigation' });
      return;
    }

    addMessage('bot', `Opening ${navResult.label} page...`, { topic: 'navigation' });
    executeBotCommand('log_navigation', { targetPage: navResult.label, path: navResult.route }).catch((err) => console.error('Navigation log error:', err));
    setTimeout(() => {
      navigate(navResult.route);
    }, 400);
  };

  const runCalculatePayroll = async (month, year) => {
    setProcessing(true);
    const loadingId = addLoadingMessage('Calculating payroll...');
    try {
      const res = await executeBotCommand('calculate_payroll', { month, year });
      removeLoadingMessage(loadingId);
      if (res.data?.success) {
        addMessage('bot', res.data.message, {
          cardType: 'payroll_result',
          data: res.data.data,
          topic: 'payroll'
        });
        return true;
      } else {
        addMessage('bot', res.data?.message || 'Payroll could not be calculated right now. Please try again.', { topic: 'payroll' });
        return false;
      }
    } catch (err) {
      removeLoadingMessage(loadingId);
      addMessage('bot', getApiErrorMessage(err, 'Payroll could not be calculated right now. Please try again.'), { topic: 'payroll' });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const runDownloadPayslips = async (month, year, signature = true) => {
    setProcessing(true);
    const mName = getMonthNameStr(month);
    const loadingId = addLoadingMessage(`Preparing payslip PDF (${signature ? 'Signed' : 'Unsigned'})...`);
    try {
      const response = await downloadAllPayslips(month, year, signature);
      removeLoadingMessage(loadingId);
      const filename = `payslips_${String(month).padStart(2, '0')}_${year}${signature ? '_signed' : ''}.pdf`;
      triggerBrowserDownload(response.data, filename);
      addMessage('bot', `Payslip download started for ${mName} ${year} (${signature ? 'With Signature' : 'Without Signature'}).`, {
        cardType: 'download_success',
        filename,
        topic: 'payslip'
      });
      return true;
    } catch (err) {
      removeLoadingMessage(loadingId);
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
      addMessage('bot', `Payslips could not be downloaded: ${errMsg}`, { topic: 'payslip' });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  const runDownloadSinglePayslip = async (employeeId, month, year, empName, signature = true) => {
    setProcessing(true);
    const mName = getMonthNameStr(month);
    const label = `${employeeId}${empName ? ' - ' + empName : ''}`;
    const loadingId = addLoadingMessage(`Preparing payslip for ${label} (${signature ? 'Signed' : 'Unsigned'})...`);
    try {
      const response = await downloadSinglePayslip(employeeId, month, year, signature);
      removeLoadingMessage(loadingId);
      const filename = `payslip_${employeeId}_${mName}_${year}${signature ? '_signed' : ''}.pdf`;
      triggerBrowserDownload(response.data, filename);
      addMessage('bot', `Payslip download started for ${label}, ${mName} ${year} (${signature ? 'With Signature' : 'Without Signature'}).`, {
        cardType: 'download_success',
        filename,
        topic: 'payslip'
      });
      return true;
    } catch (err) {
      removeLoadingMessage(loadingId);
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
      addMessage('bot', errMsg, { topic: 'payslip' });
      return false;
    } finally {
      setProcessing(false);
    }
  };

  // Runs one backend query with a loading bubble; returns the response body on success
  const runBotQuery = async (action, payload, loadingText, errorText) => {
    const loadingId = addLoadingMessage(loadingText);
    try {
      const res = await executeBotCommand(action, payload);
      removeLoadingMessage(loadingId);
      if (res.data?.success) return res.data;
      addMessage('bot', res.data?.message || errorText, { topic: 'error' });
    } catch (err) {
      removeLoadingMessage(loadingId);
      addMessage('bot', getApiErrorMessage(err, errorText), { topic: 'error' });
    }
    return null;
  };

  const runAttendanceInsights = async ({ metric, month, year, employeeQuery, threshold }) => {
    const loadingText = employeeQuery
      ? 'Checking employee attendance details...'
      : `Analysing ${metric === 'late' ? 'late arrivals' : metric === 'absent' ? 'absences' : 'half days'}...`;
    const body = await runBotQuery(
      'attendance_insights',
      { metric, month, year, employeeQuery: employeeQuery || null, threshold },
      loadingText,
      'The late/absent analysis could not be generated right now. Please try again.'
    );
    if (!body) return;

    if (body.type === 'multiple_employees_found') {
      setPendingAction({ type: 'attendance_insights', step: 'select_candidate', candidates: body.data, metric, month: body.month, year: body.year });
      addMessage('bot', body.message, { cardType: 'candidate_selection', candidates: body.data });
    } else if (body.type === 'attendance_insights_employee') {
      const d = body.data;
      const code = d.employee.employeeCode;
      const prevDate = new Date(d.year, d.month - 2, 1);
      const prevMonthName = getMonthNameStr(prevDate.getMonth() + 1);
      const otherMetric = metric === 'late' ? 'absent' : 'late';
      addMessage('bot', body.message, {
        cardType: 'insights_employee',
        data: d,
        scrollToStart: true,
        suggestions: [
          { label: `${otherMetric === 'late' ? '📈 Late' : '📉 Absent'} details ${code}`, command: `${otherMetric} details for ${code} ${d.monthName} ${d.year}` },
          { label: `⏮ ${prevMonthName} ${prevDate.getFullYear()}`, command: `${METRIC_WORD[metric]} details for ${code} ${prevMonthName} ${prevDate.getFullYear()}` },
          { label: `📊 Report ${code}`, command: `show report for ${code} ${d.monthName} ${d.year}` }
        ]
      });
    } else {
      addMessage('bot', body.message, {
        cardType: 'insights_ranking',
        data: body.data,
        scrollToStart: true,
        suggestions: getMonthNavigationSuggestions(metric, body.data)
      });
    }
  };

  // Previous / next month, the other metric for the same month, and "pick any month"
  const getMonthNavigationSuggestions = (metric, data) => {
    const month = Number(data?.month);
    const year = Number(data?.year);
    if (!month || !year) return getTopicSuggestions(`insights_${metric}`);
    const label = (d) => `${getMonthNameStr(d.getMonth() + 1)} ${d.getFullYear()}`;
    const prev = new Date(year, month - 2, 1);
    const next = new Date(year, month, 1);
    const now = new Date();
    const nextIsFuture = next > new Date(now.getFullYear(), now.getMonth(), 1);
    const otherMetric = metric === 'late' ? 'absent' : 'late';
    const items = [{ label: `⏮ ${label(prev)}`, command: `${METRIC_PATTERN_COMMAND[metric]} ${label(prev)}` }];
    if (!nextIsFuture) items.push({ label: `⏭ ${label(next)}`, command: `${METRIC_PATTERN_COMMAND[metric]} ${label(next)}` });
    items.push({
      label: `${otherMetric === 'late' ? '📈 Late' : '📉 Absent'} ${getMonthNameStr(month).substring(0, 3)} ${year}`,
      command: `${METRIC_PATTERN_COMMAND[otherMetric]} ${getMonthNameStr(month)} ${year}`
    });
    items.push({ label: '📅 Other Month', command: `prompt_insights_month:${metric}` });
    return items;
  };

  // Repeats the last month-based question (patterns or report) for other month(s)
  const runFollowUpForPeriods = async (periods) => {
    const last = lastQueryRef.current;
    const periodText = periods.map((p) => `${getMonthNameStr(p.month)} ${p.year}`).join(', ');
    if (!last) {
      const first = periods[periods.length - 1];
      const name = `${getMonthNameStr(first.month)} ${first.year}`;
      addMessage('bot', `What would you like to see for ${periodText}?`, {
        suggestions: [
          { label: '📈 Consistently Late', command: `${METRIC_PATTERN_COMMAND.late} ${name}` },
          { label: '📉 Frequently Absent', command: `${METRIC_PATTERN_COMMAND.absent} ${name}` },
          { label: `📊 ${name} Report`, command: `show ${name} report` }
        ]
      });
      return;
    }
    if (last.kind === 'report') {
      for (const p of periods) {
        const name = `${getMonthNameStr(p.month)} ${p.year}`;
        await processUserCommand(last.employeeQuery ? `show report for ${last.employeeQuery} ${name}` : `show ${name} report`);
      }
      return;
    }
    for (const p of periods) {
      for (const metric of last.metrics) {
        await runAttendanceInsights({ metric, month: p.month, year: p.year, employeeQuery: last.employeeQuery, threshold: last.threshold });
      }
    }
  };

  // Sends a free question to the backend AI. Returns false when AI is off or not configured.
  const answerWithAI = async (question) => {
    const history = messages
      .filter((m) => m.type !== 'loading' && typeof m.text === 'string' && m.text.trim())
      .slice(-AI_HISTORY_LIMIT)
      .map((m) => ({ role: m.sender === 'user' ? 'user' : 'model', text: m.text.slice(0, 1500) }));
    const loadingId = addLoadingMessage('Thinking...');
    try {
      const res = await askAssistantAI(question, history);
      removeLoadingMessage(loadingId);
      const body = res.data || {};
      if (body.type === 'ai_not_configured') return false;
      if (body.success && body.message) {
        addMessage('bot', body.message, { aiReply: true, topic: 'conversation' });
        return true;
      }
      if (body.message) {
        addMessage('bot', body.message, { topic: 'error' });
        return true;
      }
      return false;
    } catch (err) {
      removeLoadingMessage(loadingId);
      if (err?.response?.data?.type === 'ai_not_configured') return false;
      addMessage('bot', getApiErrorMessage(err, 'The AI assistant could not answer right now. Please try again or choose an option below.'), { topic: 'error' });
      return true;
    }
  };

  const runTodayList = async (status) => {
    if (status === 'late') {
      const body = await runBotQuery('today_late', {}, "Checking today's late arrivals...", "Today's late list could not be loaded right now. Please try again.");
      if (body) addMessage('bot', body.message, { cardType: 'today_late', data: body.data, topic: 'today_late' });
      return;
    }
    if (status === 'absent' || status === 'not_marked') {
      const body = await runBotQuery('today_absent', {}, "Checking today's absent employees...", "Today's absent list could not be loaded right now. Please try again.");
      if (body) addMessage('bot', body.message, { cardType: 'today_absent', data: body.data, topic: 'today_absent' });
      return;
    }
    const listStatus = status === 'half_day' ? 'half_day' : status;
    const body = await runBotQuery('today_status_list', { status: listStatus }, "Checking today's attendance...", 'This list could not be loaded right now. Please try again.');
    if (body) addMessage('bot', body.message, { cardType: 'today_list', data: body.data, topic: 'today_list' });
  };

  // "Is Bilal late today?" -> show Bilal's attendance for today; falls back to the full list
  const runEmployeeTodayStatus = async (query, fallbackStatuses) => {
    const body = await runBotQuery('search_employee', { query }, 'Searching employee details...', 'Employee search could not be completed right now. Please try again.');
    if (!body) return;
    const employees = body.data || [];
    if (employees.length > 0) {
      const single = employees.length === 1 ? employees[0] : null;
      addMessage('bot', `Today's attendance for "${query}":`, {
        cardType: 'employee_search',
        employees,
        suggestions: single ? getEmployeeSuggestions(single.employeeCode) : getTopicSuggestions('employee')
      });
      return;
    }
    addMessage('bot', `No employee matched "${query}", so here is the full list for today.`, { suggestions: [] });
    for (const status of fallbackStatuses) {
      await runTodayList(status);
    }
  };

  /**
   * Answers attendance questions such as "who is consistently late", "absent", "aaj kaun late hai",
   * "late details for MTM-01", "who is still working". Returns true when the question was handled.
   */
  const handleAttendanceQuestion = async (text) => {
    const question = detectAttendanceQuestion(text);
    if (question) {
      if (question.kind === 'insights') {
        lastQueryRef.current = { kind: 'insights', metrics: question.metrics, employeeQuery: question.employeeQuery, threshold: question.threshold };
        const periods = parsePeriodsFromText(text);
        const runFor = periods.length > 0 ? periods : [{ month: undefined, year: undefined }];
        for (const p of runFor) {
          for (const metric of question.metrics) {
            await runAttendanceInsights({ metric, month: p.month, year: p.year, employeeQuery: question.employeeQuery, threshold: question.threshold });
          }
        }
        return true;
      }
      if (question.employeeQuery) {
        await runEmployeeTodayStatus(question.employeeQuery, question.metrics);
        return true;
      }
      for (const metric of question.metrics) {
        await runTodayList(metric);
      }
      return true;
    }

    const listQuestion = detectTodayListQuestion(text);
    if (listQuestion) {
      if (listQuestion.status === 'present' && listQuestion.hasPeriod) {
        // "present days for Bilal in October" is a monthly report question
        const { month, year } = parseMonthYearFromText(text);
        const period = month ? ` ${getMonthNameStr(month)} ${year}` : ' this month';
        await processUserCommand(listQuestion.employeeQuery ? `show report for ${listQuestion.employeeQuery}${period}` : `show${period} report`);
        return true;
      }
      if (listQuestion.employeeQuery && ['present', 'working', 'checked_out', 'not_marked'].includes(listQuestion.status)) {
        await runEmployeeTodayStatus(listQuestion.employeeQuery, [listQuestion.status]);
        return true;
      }
      await runTodayList(listQuestion.status);
      return true;
    }
    return false;
  };

  const askForEmployee = (type) => {
    const verb = { mark_today_checkin: 'check in', mark_today_checkout: 'check out', mark_today_absent: 'mark absent' }[type] || 'select';
    setPendingAction({ type, step: 'ask_employee' });
    addMessage('bot', `Which employee should I ${verb}? Type the employee name or ID.`, { promptOptions: [SUGGESTION.cancel] });
  };

  // Moves a check-in / check-out / absent action forward once the employee is known
  const proceedWithEmployee = (type, emp) => {
    const empCodeStr = emp.employeeCode || emp.employee_id || emp.code;
    if (type === 'mark_today_checkin' || type === 'mark_today_attendance') {
      const confirmMsg = `Mark today check-in for ${empCodeStr} - ${emp.name} using current time? Please confirm.`;
      setPendingAction({ type: 'mark_today_checkin', step: 'confirm', employee: emp, employeeId: empCodeStr, employeeName: emp.name, date: 'today', awaitingConfirmation: true, confirmationText: confirmMsg, prompt: confirmMsg });
      addMessage('bot', confirmMsg, { showConfirmationOptions: true });
      return;
    }
    if (type === 'mark_today_checkout') {
      const confirmMsg = `Mark check-out for ${empCodeStr} - ${emp.name} using current time? Please confirm.`;
      setPendingAction({ type: 'mark_today_checkout', step: 'confirm', employee: emp, employeeId: empCodeStr, employeeName: emp.name, date: 'today', awaitingConfirmation: true, confirmationText: confirmMsg, prompt: confirmMsg });
      addMessage('bot', confirmMsg, { showConfirmationOptions: true });
      return;
    }
    if (type === 'mark_today_absent') {
      setPendingAction({ type: 'mark_today_absent', step: 'ask_reason', employee: emp, employeeId: empCodeStr, employeeName: emp.name });
      addMessage('bot', `What is the absent reason for ${empCodeStr} - ${emp.name}? Choose one below or type your own reason.`, { promptOptions: ABSENT_REASON_OPTIONS });
    }
  };

  const startEmployeeAction = async (type, query) => {
    const body = await runBotQuery('search_employee', { query }, 'Searching employee details...', 'Employee search could not be completed right now. Please try again.');
    if (!body) return;
    const employees = body.data || [];
    if (employees.length === 0) {
      addMessage('bot', `No employee found for "${query}". Please check the name or employee ID and try again.`, {
        suggestions: [SUGGESTION.searchEmployee, SUGGESTION.attendanceHelp]
      });
      return;
    }
    if (employees.length > 1) {
      setPendingAction({ type, step: 'select_candidate', candidates: employees });
      addMessage('bot', `I found ${employees.length} employees matching "${query}". Please select one:`, {
        cardType: 'candidate_selection',
        candidates: employees
      });
      return;
    }
    proceedWithEmployee(type, employees[0]);
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

    if (actionType === 'mark_today_checkin' || actionType === 'mark_today_attendance' || actionType === 'mark_today_checkout' || actionType === 'mark_today_absent') {
      proceedWithEmployee(actionType, emp);
      return;
    }

    if (actionType === 'attendance_insights') {
      const { metric } = pendingAction;
      setPendingAction(null);
      lastQueryRef.current = { kind: 'insights', metrics: [metric], employeeQuery: codeStr };
      setProcessing(true);
      runAttendanceInsights({ metric, month: currentMonth, year: currentYear, employeeQuery: codeStr }).finally(() => setProcessing(false));
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
      addMessage('bot', 'Which employee should I search? Type a name, employee ID, email, or mobile number.', { promptOptions: [SUGGESTION.cancel] });
      return;
    }

    if (lowerCmd.startsWith('prompt_insights_month')) {
      const metric = lowerCmd.split(':')[1] || 'late';
      const last = lastQueryRef.current;
      const employeeQuery = last && last.kind === 'insights' ? last.employeeQuery : '';
      setPendingAction({ type: 'insights_month', step: 'ask_month', metric, employeeQuery });
      addMessage('bot', `Which month should I check ${METRIC_WORD[metric] || metric} details for? Choose below or type one, for example "September 2026".`, {
        showMonthPicker: true
      });
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

    if (!pendingAction && (lowerCmd === 'cancel' || lowerCmd === 'stop')) {
      addMessage('bot', 'There is nothing pending right now. What would you like to check next?');
      return;
    }

    if (pendingAction) {
      if (lowerCmd === 'cancel' || lowerCmd === 'no' || lowerCmd === 'stop') {
        setPendingAction(null);
        addMessage('bot', 'Cancelled. No changes were made.');
        return;
      }

      if (pendingAction.step === 'ask_employee') {
        const type = pendingAction.type;
        setPendingAction(null);
        setProcessing(true);
        try {
          await startEmployeeAction(type, cmd);
        } finally {
          setProcessing(false);
        }
        return;
      }

      if (pendingAction.type === 'search_employee' && pendingAction.step === 'ask_query') {
        const queryVal = cmd;
        setPendingAction(null);
        setProcessing(true);
        try {
          const body = await runBotQuery('search_employee', { query: queryVal }, 'Searching employee details...', 'Employee search could not be completed right now. Please try again.');
          if (body) {
            const found = body.data || [];
            addMessage('bot', body.message, {
              cardType: 'employee_search',
              employees: found,
              suggestions: found.length === 1 ? getEmployeeSuggestions(found[0].employeeCode) : getTopicSuggestions('employee')
            });
          }
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
          
          if (type === 'insights_month') {
            const { metric, employeeQuery } = pendingAction;
            setPendingAction(null);
            setProcessing(true);
            try {
              await runAttendanceInsights({ metric, month, year, employeeQuery });
            } finally {
              setProcessing(false);
            }
          } else if (type === 'calculate_payroll') {
            setPendingAction({ type: 'calculate_payroll', step: 'confirm', month, year });
            addMessage('bot', `Calculate payroll for ${mName} ${year}? Please confirm.`, { showConfirmationOptions: true });
          } else if (type === 'download_payslips') {
            setPendingAction({ type: 'download_payslips', step: 'ask_signature', month, year });
            addMessage('bot', `Do you want the payslips for ${mName} ${year} with signature or without signature?\n\n1. With Signature\n2. Without Signature`, { promptOptions: SIGNATURE_OPTIONS });
          } else if (type === 'calculate_and_download') {
            setPendingAction({ type: 'calculate_and_download', step: 'ask_signature', month, year });
            addMessage('bot', `Do you want the payslips for ${mName} ${year} with signature or without signature?\n\n1. With Signature\n2. Without Signature`, { promptOptions: SIGNATURE_OPTIONS });
          } else if (type === 'download_single_payslip') {
            const emp = pendingAction.employee;
            const empCodeStr = emp.employeeCode || emp.employee_id || emp.code;
            const targetYear = year || new Date().getFullYear();
            setPendingAction({ type: 'download_single_payslip', step: 'ask_signature', employee: emp, month, year: targetYear });
            addMessage('bot', `Do you want the payslip for ${empCodeStr} - ${emp.name} (${mName} ${targetYear}) with signature or without signature?\n\n1. With Signature\n2. Without Signature`, { promptOptions: SIGNATURE_OPTIONS });
          }
          return;
        }
      }

      if (pendingAction.step === 'ask_signature') {
        const text = lowerCmd;
        let isWithoutSig = text.includes('without signature') || text.includes('without') || text === '2' || text.startsWith('2.') || text === 'no' || text === 'false';
        let isWithSig = text.includes('with signature') || text.includes('with') || text === '1' || text.startsWith('1.') || text === 'yes' || text === 'true';

        let signature = true;
        if (isWithoutSig && !isWithSig) {
          signature = false;
        } else {
          signature = true;
        }

        const actionToRun = { ...pendingAction, signature };
        setPendingAction(null);
        await executePendingAction(actionToRun);
        return;
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
        setPendingAction({ type: 'mark_today_absent', step: 'confirm', employee: emp, employeeId: empCodeStr, employeeName: emp.name, reason: reasonStr });
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
              addMessage('bot', 'What is the holiday name?', { promptOptions: [SUGGESTION.cancel] });
            } else {
              setPendingAction({ type: 'create_holiday', step: 'confirm', title: titleStr, date: dateStr });
              addMessage('bot', `Create holiday "${titleStr}" on ${dateStr}? Please confirm.`, {
                showConfirmationOptions: true
              });
            }
            return;
          } else {
            addMessage('bot', 'Please enter a valid date, for example 15 August 2026, 2026-08-15, or tomorrow.', {
              promptOptions: [{ label: 'Tomorrow', command: 'tomorrow' }, SUGGESTION.cancel]
            });
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

      // 0b. Navigation Commands (e.g. open dashboard, open manual attendance, open database, etc.)
      const navResult = parseNavigationCommand(cmd);
      if (navResult) {
        handleNavigation(navResult);
        setProcessing(false);
        return;
      }

      // 0c. Clear / delete chat
      if (CLEAR_CHAT_RE.test(lowerCmd)) {
        setConfirmClear(true);
        addMessage('bot', 'Tap "Clear" in the bar at the top of this chat to delete the full conversation.', { suggestions: [] });
        setProcessing(false);
        return;
      }

      // 0d-1. Same question for another month: "check for last month also", "what about October", "last 3 months"
      const followUpText = normalizeIntentText(lowerCmd);
      if (isPeriodOnlyFollowUp(followUpText)) {
        await runFollowUpForPeriods(parsePeriodsFromText(followUpText));
        setProcessing(false);
        return;
      }

      // 0d. Attendance questions: late / absent / present / leave / patterns (English + basic Hinglish)
      if (!ACTION_VERB_RE.test(lowerCmd)) {
        const handled = await handleAttendanceQuestion(normalizeIntentText(lowerCmd));
        if (handled) {
          setProcessing(false);
          return;
        }
      }

      // 1. Check-Out All Employees
      const isCheckOutAll = lowerCmd.includes('checkout all') || lowerCmd.includes('check out all') || lowerCmd.includes('check-out all') || lowerCmd.includes('checkout everyone') || lowerCmd.includes('check out everyone') || lowerCmd.includes('check-out everyone') || lowerCmd.includes('close attendance for all') || lowerCmd.includes('today checkout for all') || lowerCmd.includes('all employees checkout');
      if (isCheckOutAll) {
        const extractedDate = parseHolidayDate(cmd);
        const targetDateStr = extractedDate || 'today';
        const dateText = targetDateStr === 'today' ? 'today' : targetDateStr;
        const confirmMsg = `Do you want to mark check-out for all currently checked-in employees for ${dateText}?`;
        setPendingAction({
          type: 'checkout_all_employees',
          step: 'confirm',
          date: targetDateStr,
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
        const query = lowerCmd
          .replace(/\b(?:mark|today|check[-\s]?out|checkout|for)\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (query) {
          await startEmployeeAction('mark_today_checkout', query);
        } else {
          askForEmployee('mark_today_checkout');
        }
        setProcessing(false);
        return;
      }

      // 3. Single Check-In / Mark Attendance Commands
      const isMarkAttendance = (lowerCmd.includes('mark attendance') || lowerCmd.includes('check in') || lowerCmd.includes('check-in') || lowerCmd.includes('checkin') || lowerCmd.includes('put attendance')) && !lowerCmd.includes('absent') && !lowerCmd.includes('checkout') && !lowerCmd.includes('check out') && !lowerCmd.includes('check-out');
      if (isMarkAttendance) {
        const query = lowerCmd
          .replace(/\b(?:mark|put|attendance|today|check[-\s]?in|checkin|for)\b/gi, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (query) {
          await startEmployeeAction('mark_today_checkin', query);
        } else {
          askForEmployee('mark_today_checkin');
        }
        setProcessing(false);
        return;
      }

      // 4. Mark Absent Commands ("mark absent for MTM-01", "mark Mohamed Mushraf absent today")
      const isMarkAbsent = /^(?:mark|put|make)\b.*\babsent\b/.test(lowerCmd);
      if (isMarkAbsent) {
        const query = lowerCmd
          .replace(/^(?:mark|put|make)\s+/, '')
          .replace(/\b(?:absent|today|for|as)\b/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (query) {
          await startEmployeeAction('mark_today_absent', query);
        } else {
          askForEmployee('mark_today_absent');
        }
        setProcessing(false);
        return;
      }

      // 5. Delete Holiday Commands
      const isDeleteHoliday = (lowerCmd.includes('delete holiday') || lowerCmd.includes('remove holiday') || lowerCmd.includes('delete tomorrow holiday') || lowerCmd.includes('remove tomorrow holiday') || (lowerCmd.startsWith('delete ') && lowerCmd.includes('holiday')) || (lowerCmd.startsWith('remove ') && lowerCmd.includes('holiday')));
      if (isDeleteHoliday) {
        const holidayDateStr = parseHolidayDate(cmd);
        let titleStr = cmd
          .replace(/\b(?:delete\s+holiday\s+for|remove\s+holiday\s+for|delete\s+holiday|remove\s+holiday|delete|remove|holiday|on|for|tomorrow|today)\b/gi, ' ')
          .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b/gi, ' ')
          .replace(/\b20\d{2}\b/g, ' ')
          .replace(/\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g, ' ')
          .replace(/\b(0?[1-9]|[12]\d|3[01])\b/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const loadingId = addLoadingMessage('Searching holiday details...');
        try {
          const searchRes = await executeBotCommand('search_holiday', { query: titleStr || null, date: holidayDateStr || null });
          removeLoadingMessage(loadingId);
          if (searchRes.data?.success) {
            const holidays = searchRes.data.data || [];
            if (holidays.length === 0) {
              const notFoundMsg = holidayDateStr ? `No holiday found for ${holidayDateStr}.` : (titleStr ? `No holiday found matching "${titleStr}".` : 'No holiday found.');
              addMessage('bot', notFoundMsg, { topic: 'holiday' });
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
                candidates: holidays.map(h => ({ ...h, id: h.id, name: `${h.holiday_title} (${h.holiday_date})`, employeeCode: h.holiday_type }))
              });
              setProcessing(false);
              return;
            }
          } else {
            addMessage('bot', searchRes.data?.message || 'Holidays could not be searched right now. Please try again.', { topic: 'holiday' });
            setProcessing(false);
            return;
          }
        } catch (err) {
          removeLoadingMessage(loadingId);
          addMessage('bot', getApiErrorMessage(err, 'Holidays could not be searched right now. Please try again.'), { topic: 'holiday' });
          setProcessing(false);
          return;
        }
      }

      // 3. Create Holiday Commands
      const isCreateHoliday = (lowerCmd.includes('create holiday') || lowerCmd.includes('add holiday') || lowerCmd.includes('mark tomorrow as holiday') || lowerCmd.includes('mark holiday'));
      if (isCreateHoliday) {
        const holidayDateStr = parseHolidayDate(cmd);
        let titleStr = cmd
          .replace(/\b(?:create\s+holiday|add\s+holiday|mark\s+tomorrow\s+as\s+holiday|mark\s+holiday|on|for|tomorrow|today)\b/gi, ' ')
          .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b/gi, ' ')
          .replace(/\b20\d{2}\b/g, ' ')
          .replace(/\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g, ' ')
          .replace(/\b(0?[1-9]|[12]\d|3[01])\b/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (!holidayDateStr) {
          setPendingAction({ type: 'create_holiday', step: 'ask_date', title: titleStr || null });
          addMessage('bot', 'Which date do you want to create the holiday for? Type a date like 15 August 2026, or choose below.', {
            promptOptions: [{ label: 'Tomorrow', command: 'tomorrow' }, SUGGESTION.cancel]
          });
          setProcessing(false);
          return;
        }

        if (!titleStr) {
          setPendingAction({ type: 'create_holiday', step: 'ask_title', date: holidayDateStr });
          addMessage('bot', 'What is the holiday name?', { promptOptions: [SUGGESTION.cancel] });
          setProcessing(false);
          return;
        }

        setPendingAction({ type: 'create_holiday', step: 'confirm', title: titleStr, date: holidayDateStr });
        addMessage('bot', `Create holiday "${titleStr}" on ${holidayDateStr}? Please confirm.`, { showConfirmationOptions: true });
        setProcessing(false);
        return;
      }

      if (lowerCmd.includes('calculate') && (lowerCmd.includes('download') || lowerCmd.includes('pay slips') || lowerCmd.includes('payslip'))) {
        const { month, year } = parseMonthYearFromText(cmd);
        const targetMonth = month || new Date().getMonth() + 1;
        const targetYear = year || new Date().getFullYear();
        const mName = getMonthNameStr(targetMonth);
        setPendingAction({ type: 'calculate_and_download', step: 'confirm', month: targetMonth, year: targetYear });
        addMessage('bot', `Calculate payroll and download all payslips for ${mName} ${targetYear}? Please confirm.`, { showConfirmationOptions: true });
        setProcessing(false);
        return;
      }

      const isCalculateCommand = lowerCmd.includes('calculate') && (lowerCmd.includes('payroll') || lowerCmd.includes('salary') || lowerCmd.includes('pay'));
      if (isCalculateCommand) {
        const { month, year } = parseMonthYearFromText(cmd);
        if (!month) {
          setPendingAction({ type: 'calculate_payroll', step: 'ask_month' });
          addMessage('bot', 'Which month and year? Choose below or type one, for example October 2026.', { showMonthPicker: true });
          setProcessing(false);
          return;
        }
        const mName = getMonthNameStr(month);
        setPendingAction({ type: 'calculate_payroll', step: 'confirm', month, year });
        addMessage('bot', `Calculate payroll for ${mName} ${year}? Please confirm.`, { showConfirmationOptions: true });
        setProcessing(false);
        return;
      }

      const isDownloadCommand = (lowerCmd.includes('download') || lowerCmd.includes('get') || lowerCmd.includes('export') || lowerCmd.startsWith('payslip')) && (lowerCmd.includes('payslip') || lowerCmd.includes('payslips') || lowerCmd.includes('pay slip') || lowerCmd.includes('pay slips') || lowerCmd.includes('salary slip'));
      if (isDownloadCommand) {
        const isBulk = lowerCmd.includes('all payslips') || lowerCmd.includes('all payslip') || lowerCmd.includes('every payslip') || lowerCmd.includes('bulk payslip') || lowerCmd.includes('download all') || lowerCmd.includes('all staff payslips');
        const { month, year } = parseMonthYearFromText(cmd);

        if (!isBulk) {
          let query = lowerCmd
            .replace(/\b(?:download\s+payslips?\s+for|download\s+payslips?|download\s+pay\s+slips?\s+for|download\s+pay\s+slips?|get\s+payslips?\s+for|get\s+payslips?|export\s+payslips?\s+for|export\s+payslips?|payslips?\s+for|payslips?|pay\s+slips?\s+for|pay\s+slips?|salary\s+slips?\s+for|salary\s+slips?|download|get|export)\b/gi, ' ')
            .replace(/\b(?:this|current|last|previous)\s+month\b/gi, ' ')
            .replace(/\b(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)\b/gi, ' ')
            .replace(/\b20\d{2}\b/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

          if (query) {
            const loadingId = addLoadingMessage('Searching employee details...');
            try {
              const res = await executeBotCommand('search_employee', { query });
              removeLoadingMessage(loadingId);
              if (res.data?.success) {
                const employees = res.data.data || [];
                if (employees.length === 0) {
                  addMessage('bot', `No employee found for "${query}". Please check the name or employee ID and try again.`, {
                    suggestions: [SUGGESTION.searchEmployee, SUGGESTION.downloadPayslips]
                  });
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
                    setPendingAction({ type: 'download_single_payslip', step: 'ask_signature', employee: emp, month, year: targetYear });
                    addMessage('bot', `Do you want the payslip for ${empCodeStr} - ${emp.name} (${mName} ${targetYear}) with signature or without signature?\n\n1. With Signature\n2. Without Signature`, { promptOptions: SIGNATURE_OPTIONS });
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
            } catch (err) {
              removeLoadingMessage(loadingId);
              addMessage('bot', getApiErrorMessage(err, 'Employee search could not be completed right now. Please try again.'), { topic: 'error' });
              setProcessing(false);
              return;
            }
          }
        }

        if (!month) {
          setPendingAction({ type: 'download_payslips', step: 'ask_month' });
          addMessage('bot', 'Which month and year? Choose below or type one, for example October 2026.', { showMonthPicker: true });
          setProcessing(false);
          return;
        }
        const mName = getMonthNameStr(month);
        const targetYear = year || new Date().getFullYear();
        setPendingAction({ type: 'download_payslips', step: 'ask_signature', month, year: targetYear });
        addMessage('bot', `Do you want the payslips for ${mName} ${targetYear} with signature or without signature?\n\n1. With Signature\n2. Without Signature`, { promptOptions: SIGNATURE_OPTIONS });
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

        lastQueryRef.current = { kind: 'report', employeeQuery };

        const loadingText = employeeQuery
          ? 'Generating employee report details...'
          : 'Generating report summary...';
        const loadingId = addLoadingMessage(loadingText);

        try {
          const res = await executeBotCommand('report_summary', {
            month: targetMonth,
            year: targetYear,
            employeeQuery
          });

          removeLoadingMessage(loadingId);

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

              addMessage('bot', msgText, {
                scrollToStart: true,
                suggestions: getEmployeeSuggestions(emp.employeeCode, res.data.data.monthName, res.data.data.year).slice(0, 2).concat(SUGGESTION.consistentLate)
              });
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

              const repMonth = res.data.data.month;
              const repYear = res.data.data.year;
              const prevRep = new Date(repYear, repMonth - 2, 1);
              const prevRepName = `${getMonthNameStr(prevRep.getMonth() + 1)} ${prevRep.getFullYear()}`;
              const repName = `${res.data.data.monthName} ${repYear}`;
              addMessage('bot', msgText, {
                scrollToStart: true,
                suggestions: [
                  { label: `⏮ ${prevRepName} Report`, command: `show ${prevRepName} report` },
                  { label: `📈 Late ${repName}`, command: `${METRIC_PATTERN_COMMAND.late} ${repName}` },
                  { label: `📉 Absent ${repName}`, command: `${METRIC_PATTERN_COMMAND.absent} ${repName}` }
                ]
              });
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
            addMessage('bot', res.data?.message || 'The report summary could not be generated right now. Please try again.', { topic: 'report' });
          }
        } catch (err) {
          removeLoadingMessage(loadingId);
          addMessage('bot', getApiErrorMessage(err, 'The report summary could not be generated right now. Please try again.'), { topic: 'report' });
        } finally {
          setProcessing(false);
        }

        return;
      }

      // --- 3. STRICT EMPLOYEE SEARCH ---
      const isStrictEmployeeSearch =
        lowerCmd.startsWith('find employee ') ||
        lowerCmd.startsWith('search employee ') ||
        lowerCmd.startsWith('show employee ') ||
        lowerCmd.startsWith('employee details ') ||
        lowerCmd.startsWith('find staff ') ||
        lowerCmd.startsWith('search staff ') ||
        lowerCmd.startsWith('find emp ') ||
        lowerCmd.startsWith('search emp ') ||
        lowerCmd === 'prompt_search_employee';

      if (isStrictEmployeeSearch) {
        const searchVal = cmd.replace(/^find employee\s+|^find emp\s+|^search employee\s+|^search emp\s+|^employee details\s+|^show employee\s+|^find staff\s+|^search staff\s+/i, '').trim();
        if (searchVal && searchVal !== 'prompt_search_employee') {
          try {
            const body = await runBotQuery('search_employee', { query: searchVal }, 'Searching employee details...', 'Employee search could not be completed right now. Please try again.');
            if (body) {
              const found = body.data || [];
              addMessage('bot', body.message, {
                cardType: 'employee_search',
                employees: found,
                suggestions: found.length === 1 ? getEmployeeSuggestions(found[0].employeeCode) : getTopicSuggestions('employee')
              });
            }
          } finally {
            setProcessing(false);
          }
          return;
        }
      }

      // Safety net for late / absent wording not caught above (e.g. "check who is absent")
      if (/\babsent\b/.test(lowerCmd)) {
        await runTodayList('absent');
        setProcessing(false);
        return;
      }

      if (/\blate\b/.test(lowerCmd)) {
        await runTodayList('late');
        setProcessing(false);
        return;
      }

      const isTodayAttendanceSummary =
        lowerCmd === 'today attendance' ||
        lowerCmd === 'attendance today' ||
        lowerCmd === 'today attendance summary' ||
        lowerCmd === 'attendance summary today' ||
        lowerCmd === 'today summary' ||
        lowerCmd === 'today status' ||
        lowerCmd === 'today report' ||
        lowerCmd === 'today attendance report' ||
        lowerCmd === 'show today attendance' ||
        lowerCmd === 'show attendance today' ||
        lowerCmd === 'who is present' ||
        lowerCmd === 'summary' ||
        (lowerCmd.includes('today') && lowerCmd.includes('attendance') && !lowerCmd.startsWith('open') && !lowerCmd.startsWith('go to') && !lowerCmd.startsWith('show page') && !lowerCmd.startsWith('navigate'));

      if (isTodayAttendanceSummary) {
        try {
          const body = await runBotQuery('today_summary', {}, "Checking today's attendance summary...", "Today's attendance summary could not be loaded right now. Please try again.");
          if (body) addMessage('bot', body.message, { cardType: 'today_summary', data: body.data, topic: 'today_summary' });
        } finally {
          setProcessing(false);
        }
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
        addMessage('bot', `I was developed by ${devName}.`, { topic: 'conversation' });
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
          addMessage('bot', getGeneralHelpText(botCapabilities), { showQuickActions: false, buttons: [], scrollToStart: true, topic: 'help' });
          setProcessing(false);
          return;
        }

        const matchedAction = findMatchingAction(lowerCmd, botCapabilities);
        if (matchedAction) {
          addMessage('bot', getActionHelpText(matchedAction), { showQuickActions: false, buttons: [], scrollToStart: true, topic: 'help' });
          setProcessing(false);
          return;
        }
      }

      // --- 5. BASIC CONVERSATION INTENTS (Priority 6) ---
      const convResponse = matchBasicConversation(lowerCmd, botCapabilities);
      if (convResponse) {
        addMessage('bot', convResponse, { topic: 'conversation' });
        setProcessing(false);
        return;
      }

      // --- 6. UNKNOWN INPUT: never a dead end ---
      const intentText = normalizeIntentText(lowerCmd);

      // A short input that is only a name or code (e.g. "Bilal", "MTM-01") -> show that employee's details
      const possibleEmployee = extractEmployeeQuery(intentText);
      const tokenCount = intentText.split(' ').filter(Boolean).length;
      if (possibleEmployee && possibleEmployee === intentText && tokenCount <= 3 && /[a-z]/.test(possibleEmployee)) {
        try {
          const res = await executeBotCommand('search_employee', { query: cmd });
          const found = res.data?.success ? (res.data.data || []) : [];
          if (found.length > 0) {
            addMessage('bot', `Employee details for "${cmd}":`, {
              cardType: 'employee_search',
              employees: found,
              suggestions: found.length === 1 ? getEmployeeSuggestions(found[0].employeeCode) : getTopicSuggestions('employee')
            });
            return;
          }
        } catch (searchErr) {
          // fall through to suggestions
        }
      }

      // Free question -> Gemini AI (answers only from this project's data). Skipped when no key is set.
      const aiHandled = await answerWithAI(cmd);
      if (aiHandled) return;

      const fallback = getFallbackSuggestions(intentText);
      const fallbackText = fallback.matched
        ? (botCapabilities?.fallback?.withSuggestions || 'Here are the closest options for your request. Choose one below:')
        : (botCapabilities?.fallback?.unknown || 'I could not find an exact match for that. Please choose one of the options below, or type "help" to see everything I can do.');
      addMessage('bot', fallbackText, { suggestions: fallback.items });

    } catch (err) {
      console.error('Command execution error:', err);
      addMessage('bot', 'This request could not be completed right now. Please try again.', { topic: 'error' });
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
        const sig = action.signature !== false;
        await runDownloadSinglePayslip(empCodeStr, month, year, employee.name, sig);
      } else if (type === 'mark_today_checkin' || type === 'mark_today_attendance' || type === 'mark_checkin') {
        const empCodeStr = employee?.employeeCode || employee?.employee_id || employee?.code || action.employeeId;
        const loadingId = addLoadingMessage('Marking attendance...');
        try {
          const res = await executeBotCommand('mark_today_attendance', { employeeCode: empCodeStr });
          removeLoadingMessage(loadingId);
          if (res.data?.success) {
            window.dispatchEvent(new CustomEvent('attendanceUpdated'));
          }
          addMessage('bot', res.data?.message || 'Attendance processed.', { topic: 'attendance_action' });
        } catch (err) {
          removeLoadingMessage(loadingId);
          addMessage('bot', getApiErrorMessage(err, 'Attendance could not be marked right now. Please try again.'), { topic: 'attendance_action' });
        }
      } else if (type === 'mark_today_checkout' || type === 'mark_checkout') {
        const empCodeStr = employee?.employeeCode || employee?.employee_id || employee?.code || action.employeeId;
        const loadingId = addLoadingMessage('Marking check-out...');
        try {
          const res = await executeBotCommand('mark_today_checkout', { employeeCode: empCodeStr });
          removeLoadingMessage(loadingId);
          if (res.data?.success) {
            window.dispatchEvent(new CustomEvent('attendanceUpdated'));
          }
          addMessage('bot', res.data?.message || 'Check-out processed.', { topic: 'attendance_action' });
        } catch (err) {
          removeLoadingMessage(loadingId);
          addMessage('bot', getApiErrorMessage(err, 'Check-out could not be marked right now. Please try again.'), { topic: 'attendance_action' });
        }
      } else if (type === 'checkout_all_employees') {
        const targetDateParam = action.date && action.date !== 'today' ? action.date : null;
        const loadingId = addLoadingMessage('Checking pending employees and marking check-out...');
        try {
          const res = await executeBotCommand('checkout_all_employees', { date: targetDateParam });
          removeLoadingMessage(loadingId);
          if (res.data?.success) {
            window.dispatchEvent(new CustomEvent('attendanceUpdated'));
          }
          addMessage('bot', res.data?.message || 'Check-out all processed.', { topic: 'attendance_action' });
        } catch (err) {
          removeLoadingMessage(loadingId);
          addMessage('bot', getApiErrorMessage(err, 'Check-out for all employees could not be completed right now. Please try again.'), { topic: 'attendance_action' });
        }
      } else if (type === 'mark_today_absent' || type === 'mark_absent_today') {
        const empCodeStr = employee?.employeeCode || employee?.employee_id || employee?.code || action.employeeId;
        const loadingId = addLoadingMessage('Marking absent...');
        try {
          const res = await executeBotCommand('mark_today_absent', { employeeCode: empCodeStr, reason });
          removeLoadingMessage(loadingId);
          if (res.data?.success) {
            window.dispatchEvent(new CustomEvent('attendanceUpdated'));
          }
          addMessage('bot', res.data?.message || 'Absent marked.', { topic: 'attendance_action' });
        } catch (err) {
          removeLoadingMessage(loadingId);
          addMessage('bot', getApiErrorMessage(err, 'Absent could not be marked right now. Please try again.'), { topic: 'attendance_action' });
        }
      } else if (type === 'create_holiday') {
        const loadingId = addLoadingMessage('Saving holiday details...');
        try {
          const res = await executeBotCommand('create_holiday', { holidayTitle: title, holidayDate: date });
          removeLoadingMessage(loadingId);
          addMessage('bot', res.data?.message || 'Holiday created.', { topic: 'holiday' });
        } catch (err) {
          removeLoadingMessage(loadingId);
          addMessage('bot', getApiErrorMessage(err, 'The holiday could not be created right now. Please try again.'), { topic: 'holiday' });
        }
      } else if (type === 'delete_holiday') {
        const hId = holiday?.id || action.holidayId;
        const loadingId = addLoadingMessage('Deleting holiday...');
        try {
          const res = await executeBotCommand('delete_holiday', { holidayId: hId });
          removeLoadingMessage(loadingId);
          addMessage('bot', res.data?.message || 'Holiday deleted.', { topic: 'holiday' });
        } catch (err) {
          removeLoadingMessage(loadingId);
          addMessage('bot', getApiErrorMessage(err, 'The holiday could not be deleted right now. Please try again.'), { topic: 'holiday' });
        }
      } else if (type === 'calculate_payroll') {
        await runCalculatePayroll(month, year);
      } else if (type === 'download_payslips') {
        const sig = action.signature !== false;
        await runDownloadPayslips(month, year, sig);
      } else if (type === 'calculate_and_download') {
        const calcSuccess = await runCalculatePayroll(month, year);
        if (calcSuccess) {
          const sig = action.signature !== false;
          await runDownloadPayslips(month, year, sig);
        }
      }
    } catch (err) {
      console.error('Bot pending action execution error:', err);
      addMessage('bot', getApiErrorMessage(err, 'This action could not be completed right now. Please try again.'), { topic: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmAction = async (confirmed) => {
    if (!pendingAction) return;

    if (!confirmed) {
      setPendingAction(null);
      addMessage('bot', 'Cancelled. No changes were made.');
      return;
    }

    await executePendingAction(pendingAction);
  };

  if (!shouldRender) return null;

  const lastBotMessageId = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === 'bot' && messages[i].type !== 'loading') return messages[i].id;
    }
    return null;
  })();

  // Answer chips (signature, reason, cancel...) only work while that question is still open
  const isActivePrompt = (msg) => !!pendingAction && msg.id === lastBotMessageId;

  const renderChips = (items, extraClass = '') => (
    <div className={`admin-assistant-quick-actions ${extraClass}`}>
      {items.map((item, idx) => (
        <button
          key={`${item.command}-${idx}`}
          type="button"
          disabled={processing}
          onClick={() => handleQuickAction(item)}
          className={`admin-assistant-quick-btn ${item.variant === 'cancel' ? 'cancel' : ''} ${processing ? 'opacity-50 pointer-events-none' : ''}`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );

  const renderPersonLine = (p) => (
    <span className="admin-assistant-person">
      <strong>{p.employeeCode}</strong> - {p.name}
      {p.department && p.department !== 'N/A' ? <span className="admin-assistant-person-dept"> ({p.department})</span> : null}
    </span>
  );

  const statusTagClass = (status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'late') return 'late';
    if (s === 'absent') return 'absent';
    if (s === 'half day') return 'halfday';
    if (s === 'present' || s === 'approved') return 'present';
    if (s.includes('leave')) return 'leave';
    return 'neutral';
  };

  const SUMMARY_TILES = [
    { key: 'present', label: 'Present', color: 'green', command: 'who is present today' },
    { key: 'late', label: 'Late', color: 'amber', command: 'who is late today' },
    { key: 'absent', label: 'Absent', color: 'red', command: 'who is absent today' },
    { key: 'halfDay', label: 'Half Day', color: 'purple', command: 'half day today' },
    { key: 'working', label: 'Working', color: 'blue', command: 'who is still working' },
    { key: 'notMention', label: 'Not Mention', color: 'gray', command: 'who is not marked today' }
  ];

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
                onClick={() => setConfirmClear((v) => !v)}
                className="admin-assistant-clear-btn"
                title="Clear Chat"
                aria-label="Clear Chat"
                disabled={processing}
              >
                <FiTrash2 size={15} />
              </button>
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

          {/* Clear Chat Confirmation */}
          {confirmClear && (
            <div className="admin-assistant-clear-confirm" role="alertdialog" aria-label="Clear chat confirmation">
              <span>Delete the full conversation? This cannot be undone.</span>
              <div className="admin-assistant-clear-confirm-actions">
                <button type="button" className="admin-assistant-clear-confirm-btn danger" onClick={handleClearChat} disabled={processing}>
                  Clear
                </button>
                <button type="button" className="admin-assistant-clear-confirm-btn" onClick={() => setConfirmClear(false)}>
                  Keep
                </button>
              </div>
            </div>
          )}

          {/* Body */}
          <div className="admin-assistant-body">
            {messages.map((msg) => (
              <div key={msg.id} ref={(el) => { if (el) messageRefs.current[msg.id] = el; }} className={`admin-assistant-msg-wrapper ${msg.sender}`}>
                <div className="admin-assistant-msg-bubble">
                  {msg.type === 'loading' ? (
                    <div className="admin-assistant-loading-msg">
                      <span>{msg.text}</span>
                      <span className="bot-loading-dots">
                        <span></span>
                        <span></span>
                        <span></span>
                      </span>
                    </div>
                  ) : (
                    <>
                      {msg.aiReply && <span className="admin-assistant-ai-badge">✨ AI answer from your attendance data</span>}
                      {msg.text}

                      {/* 1. Initial Quick Actions for Welcome Message */}
                      {msg.showQuickActions && renderChips(INITIAL_QUICK_ACTIONS)}

                      {/* 1b. Custom Per-Message Buttons (e.g. Help Categories) */}
                      {msg.buttons && msg.buttons.length > 0 && renderChips(msg.buttons)}

                      {/* 1c. Answer options for an open question (reason, signature, cancel...) */}
                      {msg.promptOptions && msg.promptOptions.length > 0 && isActivePrompt(msg) && renderChips(msg.promptOptions)}

                      {/* 2. Month Picker Buttons */}
                      {msg.showMonthPicker && isActivePrompt(msg) && pendingAction.step === 'ask_month' && (
                        <div className="admin-assistant-quick-actions">
                          <button
                            type="button"
                            disabled={processing}
                            onClick={() => processUserCommand('this month')}
                            className={`admin-assistant-quick-btn ${processing ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            This Month
                          </button>
                          <button
                            type="button"
                            disabled={processing}
                            onClick={() => processUserCommand('last month')}
                            className={`admin-assistant-quick-btn ${processing ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            Last Month
                          </button>
                          {getRecentMonthOptions(4).map((opt) => (
                            <button
                              key={opt.command}
                              type="button"
                              disabled={processing}
                              onClick={() => processUserCommand(opt.command)}
                              className={`admin-assistant-quick-btn ${processing ? 'opacity-50 pointer-events-none' : ''}`}
                            >
                              {opt.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            disabled={processing}
                            onClick={() => processUserCommand('cancel')}
                            className={`admin-assistant-quick-btn cancel ${processing ? 'opacity-50 pointer-events-none' : ''}`}
                          >
                            Cancel
                          </button>
                        </div>
                      )}

                      {/* 3. Employee Search Result Cards (with today's attendance) */}
                      {msg.cardType === 'employee_search' && msg.employees && (
                        <div className="admin-assistant-emp-cards">
                          {msg.employees.map((emp) => (
                            <div key={emp.id || emp.employeeCode} className="admin-assistant-emp-card">
                              <div className="admin-assistant-emp-header">
                                <span className="admin-assistant-emp-code">{emp.employeeCode}</span>
                                <span className={`admin-assistant-emp-status ${String(emp.status || 'Active').toLowerCase()}`}>{emp.status || 'Active'}</span>
                              </div>
                              <h4 className="admin-assistant-emp-name">{emp.name}</h4>
                              <p className="admin-assistant-emp-meta">{emp.department} • {emp.designation}</p>
                              {emp.today && (
                                <div className="admin-assistant-emp-today">
                                  <span className="admin-assistant-emp-today-label">Today:</span>
                                  <span className={`admin-assistant-tag ${statusTagClass(emp.today.status)}`}>{emp.today.status}</span>
                                  {emp.today.checkIn && <span>In {emp.today.checkIn}</span>}
                                  {emp.today.checkOut && <span>Out {emp.today.checkOut}</span>}
                                  {emp.today.lateMinutes > 0 && <span>Late by {formatLateTime(emp.today.lateMinutes)}</span>}
                                  {emp.today.absentReason && <span>Reason: {emp.today.absentReason}</span>}
                                </div>
                              )}
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
                      {msg.cardType === 'candidate_selection' && msg.candidates && (() => {
                        const selectable = isActivePrompt(msg) && pendingAction.step === 'select_candidate';
                        return (
                          <div className="admin-assistant-list-card">
                            <p className="admin-assistant-list-subtitle">{selectable ? 'Please select one:' : 'Selection closed'}</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                              {msg.candidates.map((emp, idx) => (
                                <button
                                  key={emp.id || idx}
                                  type="button"
                                  onClick={() => handleSelectCandidate(emp)}
                                  disabled={!selectable || processing}
                                  className="admin-assistant-emp-btn"
                                  style={{ textAlign: 'left', justifyContent: 'flex-start', padding: '8px 12px' }}
                                >
                                  <strong>{emp.employeeCode || emp.employee_id}</strong> - {emp.name} ({emp.department || 'N/A'})
                                </button>
                              ))}
                            </div>
                            {selectable && renderChips([SUGGESTION.cancel])}
                          </div>
                        );
                      })()}

                      {/* 4. Today Absent Details Card */}
                      {msg.cardType === 'today_absent' && msg.data && (
                        <div className="admin-assistant-list-card">
                          {msg.data.dayNote && <p className="admin-assistant-list-note">{msg.data.dayNote}</p>}

                          <p className="admin-assistant-list-subtitle">Marked Absent ({msg.data.absent.length})</p>
                          {msg.data.absent.length === 0 ? (
                            <p className="admin-assistant-list-empty">No employee is marked absent today.</p>
                          ) : (
                            <ul className="admin-assistant-list font-medium">
                              {msg.data.absent.map((a, idx) => (
                                <li key={idx} className="admin-assistant-list-item">
                                  {renderPersonLine(a)}
                                  <span className="admin-assistant-detail-line">Reason: {a.reason || 'Not provided'}</span>
                                </li>
                              ))}
                            </ul>
                          )}

                          <p className="admin-assistant-list-subtitle mt-2">Not Mention - Not Marked Yet ({msg.data.notMention.length})</p>
                          {msg.data.notMention.length === 0 ? (
                            <p className="admin-assistant-list-empty">All active employees have attendance entries today.</p>
                          ) : (
                            <ul className="admin-assistant-list font-medium">
                              {msg.data.notMention.slice(0, 20).map((nm, idx) => (
                                <li key={idx}>{renderPersonLine(nm)}</li>
                              ))}
                              {msg.data.notMention.length > 20 && (
                                <li className="text-xs opacity-75">+ {msg.data.notMention.length - 20} more</li>
                              )}
                            </ul>
                          )}

                          {(msg.data.onLeave || []).length > 0 && (
                            <>
                              <p className="admin-assistant-list-subtitle mt-2">On Leave ({msg.data.onLeave.length})</p>
                              <ul className="admin-assistant-list font-medium">
                                {msg.data.onLeave.map((l, idx) => (
                                  <li key={idx} className="admin-assistant-list-item">
                                    {renderPersonLine(l)}
                                    <span className="admin-assistant-detail-line">{l.reason}</span>
                                  </li>
                                ))}
                              </ul>
                            </>
                          )}
                        </div>
                      )}

                      {/* 5. Today Late Details Card */}
                      {msg.cardType === 'today_late' && msg.data && (
                        <div className="admin-assistant-list-card">
                          {msg.data.length === 0 ? (
                            <p className="admin-assistant-list-empty">No late arrivals so far today.</p>
                          ) : (
                            <ul className="admin-assistant-list font-medium">
                              {msg.data.map((l, idx) => (
                                <li key={idx} className="admin-assistant-list-item">
                                  {renderPersonLine(l)}
                                  <span className="admin-assistant-detail-line">
                                    <span className="admin-assistant-tag late">{l.lateText ? `Late by ${l.lateText}` : 'Late'}</span>
                                    <span>In: {l.checkInTime}</span>
                                    {l.checkOutTime && <span>Out: {l.checkOutTime}</span>}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* 5b. Other Today Lists (present / working / half day / leave / permission) */}
                      {msg.cardType === 'today_list' && msg.data && (
                        <div className="admin-assistant-list-card">
                          {msg.data.items.length === 0 ? (
                            <p className="admin-assistant-list-empty">No employees in this list today.</p>
                          ) : (
                            <ul className="admin-assistant-list font-medium">
                              {msg.data.items.map((it, idx) => (
                                <li key={idx} className="admin-assistant-list-item">
                                  {renderPersonLine(it)}
                                  <span className="admin-assistant-detail-line">
                                    <span className={`admin-assistant-tag ${statusTagClass(it.status)}`}>{it.status}</span>
                                    {it.checkIn && <span>In: {it.checkIn}</span>}
                                    {it.checkOut && <span>Out: {it.checkOut}</span>}
                                    {it.lateMinutes > 0 && <span>Late by {formatLateTime(it.lateMinutes)}</span>}
                                    {it.detail && <span>{it.detail}</span>}
                                  </span>
                                  {it.reason && <span className="admin-assistant-detail-line">Reason: {it.reason}</span>}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      {/* 6. Today Attendance Summary Grid (tap a tile for details) */}
                      {msg.cardType === 'today_summary' && msg.data && (
                        <div className="admin-assistant-summary-grid">
                          {SUMMARY_TILES.map((tile) => (
                            <button
                              key={tile.key}
                              type="button"
                              disabled={processing}
                              onClick={() => handleQuickAction({ label: `${tile.label} details`, command: tile.command })}
                              className={`admin-assistant-stat ${tile.color}`}
                              title={`Show ${tile.label} details`}
                            >
                              <span className="val">{msg.data[tile.key] ?? 0}</span>
                              <span className="lbl">{tile.label}</span>
                            </button>
                          ))}
                          {msg.data.onLeave > 0 && (
                            <p className="admin-assistant-list-note" style={{ gridColumn: '1 / -1' }}>On paid leave today: {msg.data.onLeave}</p>
                          )}
                          {msg.data.present === 0 && msg.data.late === 0 && msg.data.absent === 0 && msg.data.halfDay === 0 && msg.data.working === 0 && (
                            <p className="admin-assistant-list-empty mt-2" style={{ gridColumn: '1 / -1', textAlign: 'center' }}>
                              Attendance is not marked yet for today.
                            </p>
                          )}
                        </div>
                      )}

                      {/* 7. Late / Absent Pattern Ranking */}
                      {msg.cardType === 'insights_ranking' && msg.data && (() => {
                        const d = msg.data;
                        // The message text already says nobody was late/absent
                        if (d.frequent.length === 0 && d.occasional.length === 0) return null;
                        const unit = d.metric === 'late' ? 'late' : d.metric === 'absent' ? 'absent' : 'half day';
                        const detailWord = METRIC_WORD[d.metric] || 'late';
                        const formatDates = (dates) => (dates || []).map((x) => {
                          if (d.metric === 'late') return `${x.date}${x.checkIn ? ` (${x.checkIn}${x.lateText ? `, ${x.lateText}` : ''})` : ''}`;
                          if (d.metric === 'absent') return `${x.date}${x.reason ? ` - ${x.reason}` : ''}`;
                          return x.date;
                        }).join(', ');
                        return (
                          <div className="admin-assistant-list-card">
                            {d.frequent.length > 0 && (
                              <>
                                <p className="admin-assistant-list-subtitle">{d.threshold}+ times ({d.frequent.length})</p>
                                <ul className="admin-assistant-insight-list">
                                  {d.frequent.map((e, idx) => (
                                    <li key={e.employeeCode} className="admin-assistant-insight-item">
                                      <div className="admin-assistant-insight-head">
                                        <span className="admin-assistant-insight-rank">{idx + 1}</span>
                                        {renderPersonLine(e)}
                                        <span className={`admin-assistant-tag ${d.metric === 'late' ? 'late' : d.metric === 'absent' ? 'absent' : 'halfday'}`}>{e.count} days {unit}</span>
                                      </div>
                                      {d.metric === 'late' && <span className="admin-assistant-detail-line">Total late time: {e.lateTimeText}</span>}
                                      {e.dates && e.dates.length > 0 && <span className="admin-assistant-detail-line">Dates: {formatDates(e.dates)}</span>}
                                      <button
                                        type="button"
                                        className="admin-assistant-link-btn"
                                        disabled={processing}
                                        onClick={() => handleQuickAction({ label: `Details: ${e.employeeCode}`, command: `${detailWord} details for ${e.employeeCode} ${d.monthName} ${d.year}` })}
                                      >
                                        View full details →
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}

                            {d.occasional.length > 0 && (
                              <>
                                <p className="admin-assistant-list-subtitle mt-2">1-{d.threshold - 1} times ({d.occasional.length})</p>
                                <ul className="admin-assistant-list font-medium">
                                  {d.occasional.map((e) => (
                                    <li key={e.employeeCode} className="admin-assistant-list-item">
                                      {renderPersonLine(e)}
                                      <span className="admin-assistant-detail-line">
                                        {e.count} day{e.count === 1 ? '' : 's'} {unit}{e.dates && e.dates.length > 0 ? ` - ${formatDates(e.dates)}` : ''}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}

                          </div>
                        );
                      })()}

                      {/* 8. One Employee's Late / Absent Details */}
                      {msg.cardType === 'insights_employee' && msg.data && (() => {
                        const d = msg.data;
                        const emp = d.employee;
                        const lateSection = (
                          <React.Fragment key="late">
                            <p className="admin-assistant-list-subtitle mt-2">Late Days ({d.lateDays.length})</p>
                            {d.lateDays.length === 0 ? (
                              <p className="admin-assistant-list-empty">No late arrivals in {d.periodLabel}.</p>
                            ) : (
                              <ul className="admin-assistant-list font-medium">
                                {d.lateDays.map((x) => (
                                  <li key={`l-${x.day}`}>
                                    <strong>{x.date}</strong>
                                    {x.checkIn && <span>In {x.checkIn}</span>}
                                    {x.lateText && <span className="admin-assistant-tag late">Late by {x.lateText}</span>}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </React.Fragment>
                        );
                        const absentSection = (
                          <React.Fragment key="absent">
                            <p className="admin-assistant-list-subtitle mt-2">Absent Days ({d.absentDays.length})</p>
                            {d.absentDays.length === 0 ? (
                              <p className="admin-assistant-list-empty">No absences in {d.periodLabel}.</p>
                            ) : (
                              <ul className="admin-assistant-list font-medium">
                                {d.absentDays.map((x) => (
                                  <li key={`a-${x.day}`}>
                                    <strong>{x.date}</strong>
                                    <span>Reason: {x.reason || 'Not provided'}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </React.Fragment>
                        );
                        return (
                          <div className="admin-assistant-list-card">
                            <div className="admin-assistant-summary-grid four">
                              <div className="admin-assistant-stat green"><span className="val">{emp.present}</span><span className="lbl">Present</span></div>
                              <div className="admin-assistant-stat amber"><span className="val">{emp.late}</span><span className="lbl">Late</span></div>
                              <div className="admin-assistant-stat red"><span className="val">{emp.absent}</span><span className="lbl">Absent</span></div>
                              <div className="admin-assistant-stat purple"><span className="val">{emp.halfDay}</span><span className="lbl">Half Day</span></div>
                            </div>
                            <p className="admin-assistant-list-note">
                              Late time: {emp.lateTimeText} | Permission: {emp.permissionTimeText} | Worked: {emp.totalHours}h
                            </p>
                            {d.metric === 'absent' ? [absentSection, lateSection] : [lateSection, absentSection]}
                            {d.halfDays.length > 0 && (
                              <>
                                <p className="admin-assistant-list-subtitle mt-2">Half Days ({d.halfDays.length})</p>
                                <ul className="admin-assistant-list font-medium">
                                  {d.halfDays.map((x) => (
                                    <li key={`h-${x.day}`}>
                                      <strong>{x.date}</strong>
                                      {x.checkIn && <span>In {x.checkIn}</span>}
                                      {x.checkOut && <span>Out {x.checkOut}</span>}
                                    </li>
                                  ))}
                                </ul>
                              </>
                            )}
                          </div>
                        );
                      })()}

                      {/* 9. Related options under every bot reply */}
                      {msg.sender === 'bot' && msg.suggestions && msg.suggestions.length > 0 && (
                        <div className="admin-assistant-suggestions">
                          <span className="admin-assistant-suggestions-label">💡 Related options</span>
                          {renderChips(msg.suggestions, 'compact')}
                        </div>
                      )}
                    </>
                  )}

                </div>
                <span className="admin-assistant-msg-time">{msg.time}</span>
              </div>
            ))}

            {/* In-Chat Action Confirmation Prompt */}
            {pendingAction && pendingAction.step === 'confirm' && (
              <div className="admin-assistant-confirm-box">
                {pendingAction.prompt && <p className="admin-assistant-confirm-text">{pendingAction.prompt}</p>}
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
              placeholder={processing ? "Processing request..." : "Ask e.g. who is consistently late?"}
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
