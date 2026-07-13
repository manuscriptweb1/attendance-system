import React from 'react';

/**
 * AuthLayout — Shared responsive shell for all authentication pages.
 *
 * On large screens  : Two-column grid, illustration left, form right.
 *                     Centered with generous padding.
 * On laptop screens : Compact — reduced illustration, tighter spacing,
 *                     still shows all content without overflow.
 * On mobile/tablet  : Single column, illustration hidden, form only.
 *
 * The key technique is `min-h-screen` with `py-safe` overflow-y-auto
 * so the page scrolls gracefully if truly needed but NEVER clips.
 */

const AuthLayout = ({
  children,
  background = 'light',         // 'light' | 'dark'
  leftColumn,                    // JSX — illustration panel
  maxWidth = '1100px',
}) => {
  const isDark = background === 'dark';

  return (
    <div
      className={`
        relative font-sans overflow-x-hidden
        ${isDark
          ? 'bg-[#0B1120] selection:bg-blue-500/30'
          : 'bg-[#F8FAFC]'}
      `}
      style={{ minHeight: '100vh' }}
    >
      {/* ── Ambient glow blobs ─────────────────────────────────────────── */}
      <div
        className="absolute top-[-15%] left-[-8%] rounded-full blur-[120px] pointer-events-none animate-pulse"
        style={{
          width: 'clamp(300px, 55vw, 750px)',
          height: 'clamp(300px, 55vw, 750px)',
          background: isDark
            ? 'rgba(59,130,246,0.08)'
            : 'rgba(147,197,253,0.25)',
          animationDuration: '8s',
        }}
      />
      <div
        className="absolute bottom-[-15%] right-[-8%] rounded-full blur-[120px] pointer-events-none animate-pulse"
        style={{
          width: 'clamp(300px, 55vw, 750px)',
          height: 'clamp(300px, 55vw, 750px)',
          background: isDark
            ? 'rgba(124,58,237,0.08)'
            : 'rgba(196,181,253,0.25)',
          animationDuration: '10s',
        }}
      />

      {/* ── Dot grid pattern ───────────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: isDark
            ? 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)'
            : 'radial-gradient(#94A3B8 1.5px, transparent 1.5px)',
          backgroundSize: isDark ? '40px 40px' : '22px 22px',
          opacity: isDark ? 1 : 0.18,
        }}
      />
      {!isDark && (
        <div
          className="absolute bottom-6 right-6 w-52 h-52 opacity-15 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#94A3B8 2px, transparent 2px)',
            backgroundSize: '22px 22px',
          }}
        />
      )}

      {/* ── Scrollable content wrapper ─────────────────────────────────── */}
      <div
        className="relative z-10 flex items-center justify-center"
        style={{ minHeight: '100vh', padding: 'clamp(16px, 3vh, 40px) 16px' }}
      >
        <div
          className="w-full grid grid-cols-1 lg:grid-cols-2 relative"
          style={{
            maxWidth,
            columnGap: 'clamp(24px, 4vw, 80px)',
            alignItems: 'center',
          }}
        >
          {/* ── Left column: illustration (hidden on mobile) ────────────── */}
          {leftColumn && (
            <div className="hidden lg:flex flex-col justify-center items-center w-full">
              {leftColumn}
            </div>
          )}

          {/* ── Right column: form ──────────────────────────────────────── */}
          <div className="w-full flex flex-col items-center">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
