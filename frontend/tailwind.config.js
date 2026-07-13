/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        // Admin theme palette mapped to CSS variables
        admin: {
          bg:       'var(--admin-bg)',
          surface:  'var(--admin-surface)',
          elevated: 'var(--admin-elevated)',
          accent:   'var(--admin-accent)',
          accent2:  'var(--admin-accent2)',
          text:     'var(--admin-text)',
          heading:  'var(--admin-heading)',
          secondary:'var(--admin-secondary)',
          muted:    'var(--admin-muted)',
          subtle:   'var(--admin-subtle)',
          border:   'var(--admin-border)',
          'modal-bg': 'var(--admin-modal-bg)',
          'modal-text': 'var(--admin-modal-text)',
          'overlay': 'var(--admin-overlay)',
          'dropdown-bg': 'var(--admin-dropdown-bg)',
          'dropdown-text': 'var(--admin-dropdown-text)',
          'dropdown-hover': 'var(--admin-dropdown-hover)',
        },
        // Employee light theme palette
        emp: {
          bg:       '#F8FAFC',
          card:     '#FFFFFF',
          elevated: '#F1F5F9',
          accent:   '#2563EB',
          accent2:  '#3B82F6',
          text:     '#0F172A',
          secondary:'#475569',
          border:   '#E2E8F0',
        },
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Claymorphism palette
        clay: {
          bg:      '#F5F7FB',
          card:    '#FFFFFF',
          border:  '#E7EBF2',
          blue:    '#4F6CE1',
          blueLt:  '#7B93F5',
        },
      },
      boxShadow: {
        // Clay admin dark / responsive light
        'clay-admin':       'var(--shadow-admin-card)',
        'clay-admin-hover': 'var(--shadow-admin-card-hover)',
        'clay-admin-modal': 'var(--shadow-admin-modal)',
        'glow-blue':        '0 0 20px rgba(59,130,246,0.4), 0 0 40px rgba(59,130,246,0.15)',
        'glow-blue-sm':     '0 0 12px rgba(59,130,246,0.35)',
        'glow-emerald':     '0 0 16px rgba(16,185,129,0.4)',
        // Clay employee light
        'clay':             '0 4px 20px rgba(0,0,0,0.06), 0 1px 6px rgba(0,0,0,0.04)',
        'clay-hover':       '0 8px 32px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
        'clay-modal':       '0 20px 64px rgba(0,0,0,0.18), 0 6px 20px rgba(0,0,0,0.1)',
        'clay-lg':          '0 12px 40px rgba(0,0,0,0.1), 0 4px 12px rgba(0,0,0,0.06)',
        // Claymorphism Soft UI shadows
        'clay-soft':        '0 4px 24px rgba(149,163,187,0.10), 0 1px 4px rgba(149,163,187,0.06), inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 3px rgba(149,163,187,0.04)',
        'clay-soft-hover':  '0 8px 40px rgba(149,163,187,0.16), 0 2px 8px rgba(149,163,187,0.08), inset 0 1px 0 rgba(255,255,255,1), inset 0 -1px 3px rgba(149,163,187,0.06)',
        'clay-soft-lg':     '0 12px 48px rgba(149,163,187,0.14), 0 4px 12px rgba(149,163,187,0.08), inset 0 1px 0 rgba(255,255,255,1), inset 0 -2px 4px rgba(149,163,187,0.05)',
        'clay-inset':       'inset 0 2px 6px rgba(149,163,187,0.12), inset 0 1px 2px rgba(149,163,187,0.08)',
        // Legacy
        'card':             '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover':       '0 4px 12px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)',
        'modal':            '0 20px 60px rgba(0,0,0,0.25)',
      },
      borderRadius: {
        'clay':    '16px',
        'clay-lg': '20px',
        'clay-xl': '24px',
      },
      animation: {
        'fade-in':    'fadeIn 0.15s ease-out',
        'slide-up':   'slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        'scale-in':   'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        'float':      'float 3s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'skeleton':   'skeleton 1.5s ease-in-out infinite',
        'shimmer':    'shimmer 1.4s ease-in-out infinite',
        // Claymorphism animations
        'fadeInUp':      'fadeInUp 0.5s ease-out forwards',
        'progressFill':  'progressFill 1.2s ease-out forwards',
        'barGrow':       'barGrow 0.8s ease-out forwards',
        'livePulse':     'livePulse 2s ease-in-out infinite',
        'countUp':       'countUp 0.6s ease-out',
        'slideInRight':  'slideInRight 0.4s ease-out forwards',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%':   { opacity: '0', transform: 'scale(0.94) translateY(6px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-4px)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 12px rgba(59,130,246,0.3)' },
          '50%':      { boxShadow: '0 0 24px rgba(59,130,246,0.6)' },
        },
        skeleton: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
        // Claymorphism keyframes
        fadeInUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        progressFill: {
          '0%':   { strokeDashoffset: '327' },
          '100%': { strokeDashoffset: 'var(--progress-offset, 0)' },
        },
        barGrow: {
          '0%':   { transform: 'scaleY(0)', opacity: '0' },
          '100%': { transform: 'scaleY(1)', opacity: '1' },
        },
        livePulse: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.5' },
        },
        countUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%':   { opacity: '0', transform: 'translateX(-12px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
}
