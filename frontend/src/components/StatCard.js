import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ADMIN_COLOR_MAP = {
  blue:   { icon: 'bg-blue-500/20 text-blue-400',    glow: 'shadow-[0_0_16px_rgba(59,130,246,0.2)]',  bar: 'from-blue-500 to-blue-400'    },
  green:  { icon: 'bg-emerald-500/20 text-emerald-400', glow: 'shadow-[0_0_16px_rgba(16,185,129,0.2)]', bar: 'from-emerald-500 to-emerald-400' },
  yellow: { icon: 'bg-amber-500/20 text-amber-400',  glow: 'shadow-[0_0_16px_rgba(245,158,11,0.2)]',  bar: 'from-amber-500 to-amber-400'  },
  red:    { icon: 'bg-red-500/20 text-red-400',       glow: 'shadow-[0_0_16px_rgba(239,68,68,0.2)]',   bar: 'from-red-500 to-red-400'      },
  purple: { icon: 'bg-purple-500/20 text-purple-400', glow: 'shadow-[0_0_16px_rgba(168,85,247,0.2)]',  bar: 'from-purple-500 to-purple-400'},
  orange: { icon: 'bg-orange-500/20 text-orange-400', glow: 'shadow-[0_0_16px_rgba(249,115,22,0.2)]',  bar: 'from-orange-500 to-orange-400'},
  indigo: { icon: 'bg-indigo-500/20 text-indigo-400', glow: 'shadow-[0_0_16px_rgba(99,102,241,0.2)]',  bar: 'from-indigo-500 to-indigo-400'},
};

const EMP_COLOR_MAP = {
  blue:   { icon: 'bg-blue-50 text-blue-600',    bar: 'from-blue-500 to-blue-400'    },
  green:  { icon: 'bg-emerald-50 text-emerald-600', bar: 'from-emerald-500 to-emerald-400' },
  yellow: { icon: 'bg-amber-50 text-amber-600',  bar: 'from-amber-500 to-amber-400'  },
  red:    { icon: 'bg-red-50 text-red-600',       bar: 'from-red-500 to-red-400'      },
  purple: { icon: 'bg-purple-50 text-purple-600', bar: 'from-purple-500 to-purple-400'},
  orange: { icon: 'bg-orange-50 text-orange-600', bar: 'from-orange-500 to-orange-400'},
  indigo: { icon: 'bg-indigo-50 text-indigo-600', bar: 'from-indigo-500 to-indigo-400'},
};

const StatCard = ({ title, value, icon: Icon, color = 'blue', subtitle, link }) => {
  const { isAdmin } = useAuth();

  const CardContent = ({ children }) => {
    if (link) {
      return <Link to={link} className="block">{children}</Link>;
    }
    return <>{children}</>;
  };

  if (isAdmin) {
    const cfg = ADMIN_COLOR_MAP[color] || ADMIN_COLOR_MAP.blue;
    return (
      <CardContent>
        <div className={`relative bg-[#1C2540] border border-white/[0.07] rounded-2xl p-5 flex items-center gap-4 ${link ? 'clay-card-hover cursor-pointer' : ''} shadow-[0_8px_30px_rgba(0,0,0,0.04)] ${link ? 'hover:shadow-clay-admin-hover' : ''} overflow-hidden ${cfg.glow}`}>
          {/* Subtle gradient background shimmer */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none rounded-2xl" />
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.icon}`}>
            <Icon size={22} />
          </div>
          <div className="min-w-0 flex-1 relative">
            <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wider truncate">{title}</p>
            <p className="text-3xl font-bold text-[#0F172A] mt-0.5 leading-none">{value}</p>
            {subtitle && <p className="text-xs text-[#64748B] mt-1">{subtitle}</p>}
          </div>
          <div className={`w-1 h-10 rounded-full flex-shrink-0 bg-gradient-to-b opacity-80 ${cfg.bar}`} />
        </div>
      </CardContent>
    );
  }

  const cfg = EMP_COLOR_MAP[color] || EMP_COLOR_MAP.blue;
  return (
    <CardContent>
      <div className={`bg-white border border-[#E2E8F0] rounded-2xl p-5 flex items-center gap-4 ${link ? 'clay-card-hover cursor-pointer' : ''} shadow-clay ${link ? 'hover:shadow-clay-hover' : ''}`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.icon}`}>
          <Icon size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider truncate">{title}</p>
          <p className="text-3xl font-bold text-[#0F172A] mt-0.5 leading-none">{value}</p>
          {subtitle && <p className="text-xs text-[#64748B] mt-1">{subtitle}</p>}
        </div>
        <div className={`w-1 h-10 rounded-full flex-shrink-0 bg-gradient-to-b opacity-70 ${cfg.bar}`} />
      </div>
    </CardContent>
  );
};

export default StatCard;
