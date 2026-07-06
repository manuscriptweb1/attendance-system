import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';

const NAV_LINKS = [
  { label: 'Home',     path: '/'         },
  { label: 'Features', path: '/features' },
  { label: 'About',    path: '/about'    },
  { label: 'FAQ',      path: '/faq'      },
  { label: 'Contact',  path: '/contact'  },
];

const FOOTER_LINKS = {
  Pages:   [['Home','/'],[' Features','/features'],['About','/about'],['FAQ','/faq']],
  Support: [['Contact','/contact'],['Help Center','/support'],['Login','/employee/login']],
  Legal:   [['Privacy Policy','/privacy-policy'],['Terms of Service','/terms-and-conditions']],
};

export const PublicNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="bg-white/95 backdrop-blur-md border-b border-[#E2E8F0] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group">
            <div className="flex items-center justify-center">
              <img src="/favicon/favicon-96x96.png" alt="Manuscript Attendance" className="brand-logo" />
            </div>
            <span className="text-lg font-extrabold text-[#0F172A]">Manuscript Attendance</span>
          </button>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(({ label, path }) => (
              <button key={path} onClick={() => navigate(path)}
                className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${location.pathname === path ? 'text-[#2563EB] bg-[#2563EB]/8' : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F1F5F9]'}`}>
                {label}
              </button>
            ))}
            <button onClick={() => navigate('/employee/login')}
              className="ml-3 px-4 py-2 bg-[#2563EB] text-white text-sm font-bold rounded-xl hover:bg-blue-700 shadow-[0_4px_12px_rgba(37,99,235,0.3)] hover:-translate-y-0.5 transition-all duration-200">
              Login
            </button>
          </div>

          {/* Mobile toggle */}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2 rounded-xl text-[#475569] hover:bg-[#F1F5F9]">
            {mobileOpen ? <FiX size={20} /> : <FiMenu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#E2E8F0] bg-white px-4 py-3 space-y-1">
          {NAV_LINKS.map(({ label, path }) => (
            <button key={path} onClick={() => { navigate(path); setMobileOpen(false); }}
              className={`w-full text-left px-3 py-2.5 text-sm font-semibold rounded-xl ${location.pathname === path ? 'text-[#2563EB] bg-[#2563EB]/8' : 'text-[#475569] hover:bg-[#F1F5F9]'}`}>
              {label}
            </button>
          ))}
          <button onClick={() => navigate('/employee/login')}
            className="w-full mt-2 px-4 py-2.5 bg-[#2563EB] text-white text-sm font-bold rounded-xl">
            Login
          </button>
        </div>
      )}
    </nav>
  );
};

export const PublicFooter = () => {
  const navigate = useNavigate();
  return (
    <footer className="bg-[#0F172A] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="flex items-center justify-center">
                <img src="/favicon/favicon-96x96.png" alt="Manuscript Attendance" className="brand-logo" />
              </div>
              <span className="text-base font-extrabold text-white">Manuscript Attendance</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">Modern attendance management for modern organizations.</p>
          </div>
          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{section}</h3>
              <ul className="space-y-2.5">
                {links.map(([label, path]) => (
                  <li key={path}><button onClick={() => navigate(path)} className="text-sm text-slate-400 hover:text-white transition-colors">{label}</button></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10 mt-10 pt-8 text-center text-sm text-slate-400">
          &copy; {new Date().getFullYear()} Manuscript Attendance. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

const PublicLayout = ({ children }) => (
  <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
    <PublicNavbar />
    <main className="flex-1">{children}</main>
    <PublicFooter />
  </div>
);

export default PublicLayout;
