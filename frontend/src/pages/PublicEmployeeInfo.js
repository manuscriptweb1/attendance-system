import React, { useState, useEffect } from 'react';

import { getPublicAttendanceMatrix, getPublicHolidayInfo } from '../services/api';
import { FiCalendar, FiClock, FiAlertCircle } from 'react-icons/fi';
import { getAttendanceStatusClass } from '../utils/attendanceStatusStyles';
import { formatDate, toDateInputValue } from '../utils/dateUtils';

const motivationMessages = [
  "Every day is a new chance to do your best. Keep going!",
  "Your consistency matters. Let’s make today productive.",
  "Small progress every day leads to big results.",
  "Stay focused, stay positive, and keep moving forward.",
  "Teamwork and discipline make success possible.",
  "Your effort today builds tomorrow’s success.",
  "Start strong, stay steady, and finish proud.",
  "A focused mind can turn any day into progress.",
  "Success begins with showing up consistently.",
  "Do your best today, and let your work speak.",
  "Positive attitude and steady effort create great results.",
  "One good day of effort can inspire many more.",
  "Be patient, stay disciplined, and keep improving.",
  "Great teams grow through trust, effort, and consistency.",
  "Your dedication makes a difference every day.",
  "Keep learning, keep improving, and keep moving forward.",
  "A productive day starts with a positive mindset.",
  "Progress may be small, but every step matters.",
  "Focus on today’s work and give it your best.",
  "Hard work with consistency always creates value.",
  "Stay calm, stay committed, and keep going.",
  "Every task completed is a step toward success.",
  "Your discipline today becomes your strength tomorrow.",
  "Be proud of your effort and keep pushing forward.",
  "Good work starts with good focus.",
  "Keep your goals clear and your actions steady.",
  "Together, we can make every day meaningful.",
  "Your time, effort, and focus matter.",
  "A strong team is built by consistent people.",
  "Make today count with focus and confidence.",
  "Challenges are chances to become better.",
  "Keep going. Your steady effort is valuable.",
  "Work with purpose, patience, and positivity.",
  "Each day is an opportunity to improve.",
  "Stay motivated, stay responsible, and stay strong.",
  "Believe in your work and keep moving ahead.",
  "Consistency is the key to long-term success.",
  "A positive mindset makes work easier and better.",
  "Do your work with care, focus, and confidence.",
  "Let today be another step toward progress."
];

const getDailyMotivations = () => {
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;

  let seed = 0;
  for (let i = 0; i < dateKey.length; i++) {
    seed += dateKey.charCodeAt(i) * (i + 1);
  }

  const shuffled = [...motivationMessages];
  let random = seed || 1;

  for (let i = shuffled.length - 1; i > 0; i--) {
    random = (random * 1664525 + 1013904223) >>> 0;
    const j = random % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, 3);
};

const dailyMotivations = getDailyMotivations();

const PublicEmployeeInfo = () => {
  const [matrixData, setMatrixData] = useState(null);
  const [holidayData, setHolidayData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const fetchData = async () => {
    try {
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();

      const [matrixRes, holidayRes] = await Promise.all([
        getPublicAttendanceMatrix(month, year),
        getPublicHolidayInfo()
      ]);

      if (matrixRes.data.success) setMatrixData(matrixRes.data);
      if (holidayRes.data.success) setHolidayData(holidayRes.data);
      
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch public info:', err);
      setError('Unable to load public attendance information. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Auto refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);



  return (
    <div className="public-info-page min-h-screen flex flex-col bg-slate-50">
      {/* Simple Standalone Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <div className="flex items-center gap-3">
            <img src="/favicon/favicon-96x96.png" alt="Manuscript Attendance" className="w-8 h-8 rounded" />
            <span className="font-bold text-slate-900 text-lg">Manuscript Attendance</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0F172A] mb-3 flex justify-center items-center gap-3">
              <img src="/favicon/favicon-96x96.png" alt="Logo" className="w-10 h-10 rounded-lg shadow-sm" />
              Manuscript Attendance Public Information
            </h1>
            <p className="text-lg text-[#475569]">View current attendance status and holiday updates.</p>
            {!loading && !error && (
              <p className="text-xs text-gray-400 mt-2 flex justify-center items-center gap-1">
                <FiClock size={12} /> Last updated: {lastUpdated.toLocaleString()}
              </p>
            )}
          </div>

          <div className="public-motivation-marquee">
            <div className="public-motivation-marquee-label">
              ✨ Daily Motivation
            </div>
            <div className="public-motivation-marquee-track">
              <div className="public-motivation-marquee-content">
                {dailyMotivations.map((message, index) => (
                  <React.Fragment key={index}>
                    <span className="public-motivation-message">
                      {message}
                    </span>

                    {index < dailyMotivations.length - 1 && (
                      <span className="public-motivation-separator">
                        <span className="separator-dot"></span>
                        <span className="separator-line"></span>
                        <span className="separator-spark">✦</span>
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-64 text-[#2563EB]">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2563EB]"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 text-red-600 p-6 rounded-2xl border border-red-100 text-center flex flex-col items-center shadow-sm">
              <FiAlertCircle size={32} className="mb-2" />
              <p>{error}</p>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* SECTION 1: Attendance Matrix */}
              {matrixData && (
                <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-clay overflow-hidden">
                  <div className="p-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                      <FiCalendar className="text-[#2563EB]" /> Attendance Matrix
                    </h2>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                        <tr>
                          <th className="px-4 py-3 font-semibold text-[#0F172A] sticky left-0 bg-[#F8FAFC] z-10 border-r border-[#E2E8F0]">Employee</th>
                          {Array.from({ length: new Date(matrixData.year, matrixData.month, 0).getDate() }).map((_, i) => (
                            <th key={i} className="px-2 py-3 font-semibold text-[#475569] text-center">{i + 1}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8F0]">
                        {matrixData.employees.map((emp) => (
                          <tr key={emp.employee_id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 sticky left-0 bg-white border-r border-[#E2E8F0] z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] group-hover:bg-slate-50">
                              <div className="font-semibold text-[#0F172A]">{emp.employee_name}</div>
                              <div className="text-xs text-[#475569]">{emp.employee_id}</div>
                            </td>
                            {Array.from({ length: new Date(matrixData.year, matrixData.month, 0).getDate() }).map((_, i) => {
                              const code = emp.attendance[i + 1] || '-';
                              return (
                                <td key={i} className="px-1 py-3 text-center">
                                  <span className={getAttendanceStatusClass(code)}>
                                    {code}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                        {matrixData.employees.length === 0 && (
                          <tr>
                            <td colSpan="100%" className="px-4 py-8 text-center text-[#475569]">No active employees found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {matrixData.legend && (
                    <div className="p-4 bg-slate-50 border-t border-[#E2E8F0]">
                      <div className="flex flex-wrap gap-4 text-xs text-[#475569] justify-center">
                        {Object.entries(matrixData.legend).map(([key, value]) => (
                          <div key={key} className="flex items-center gap-1.5">
                            <span className={getAttendanceStatusClass(key)}>
                              {key}
                            </span>
                            <span>- {value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SECTION 2: Holiday Information */}
              {holidayData && (
                <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-clay overflow-hidden">
                  <div className="p-5 border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    <h2 className="text-lg font-bold text-[#0F172A] flex items-center gap-2">
                      <FiCalendar className="text-[#2563EB]" /> Holiday Information
                    </h2>
                  </div>
                  
                  <div className="p-5">
                    {holidayData.mode === 'none' ? (
                      <div className="text-center py-8 text-[#475569] bg-slate-50 rounded-xl border border-slate-100">
                        {holidayData.message}
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
                            <tr>
                              <th className="px-4 py-3 font-semibold text-[#0F172A]">Date</th>
                              <th className="px-4 py-3 font-semibold text-[#0F172A]">Holiday Name</th>
                              <th className="px-4 py-3 font-semibold text-[#0F172A]">Type</th>
                              <th className="px-4 py-3 font-semibold text-[#0F172A]">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E2E8F0]">
                            {holidayData.holidays.map((h, i) => (
                              <tr key={i} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <div className="font-semibold text-[#0F172A]">
                                    {formatDate(h.holiday_date)}
                                  </div>
                                </td>
                                <td className="px-4 py-4">
                                  <div className="font-medium text-[#0F172A]">{h.holiday_name}</div>
                                  {holidayData.mode === 'upcoming' && (
                                    (() => {
                                      const isToday = toDateInputValue(h.holiday_date) === toDateInputValue(new Date());
                                      return (
                                        <div className={`public-holiday-badge ${isToday ? 'today' : 'upcoming'}`}>
                                          {isToday ? 'Today Holiday' : 'Upcoming Holiday'}
                                        </div>
                                      );
                                    })()
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium">
                                    {h.holiday_type}
                                  </span>
                                </td>
                                <td className="px-4 py-4 text-[#475569]">{h.notes || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {holidayData.mode === 'recent_completed' && (
                      <div className="mt-4 p-4 bg-blue-50 text-blue-700 text-sm text-center rounded-xl border border-blue-100 font-medium shadow-sm">
                        “The recent holiday has passed. Let’s move forward with focus, energy, and a positive mindset.”
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>
      </main>

      {/* Simple Standalone Footer */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} Manuscript Attendance
        </div>
      </footer>
    </div>
  );
};

export default PublicEmployeeInfo;
