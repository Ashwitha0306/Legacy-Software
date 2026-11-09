/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Deep navy base (dynamic CSS variables for Dark/Light mode)
        navy: {
          950: 'rgb(var(--color-navy-950) / <alpha-value>)',
          900: 'rgb(var(--color-navy-900) / <alpha-value>)',
          800: 'rgb(var(--color-navy-800) / <alpha-value>)',
          700: 'rgb(var(--color-navy-700) / <alpha-value>)',
          600: 'rgb(var(--color-navy-600) / <alpha-value>)',
          500: 'rgb(var(--color-navy-500) / <alpha-value>)',
        },
        // Cyan accent (primary interactive color)
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        // Violet secondary accent
        violet: {
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
        },
        // Verification status colors
        verified:   { DEFAULT: '#10b981', light: '#d1fae5' },
        partial:    { DEFAULT: '#f59e0b', light: '#fef3c7' },
        unsupported:{ DEFAULT: '#ef4444', light: '#fee2e2' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-pattern': 'linear-gradient(135deg, #060b18 0%, #0a1628 50%, #0f2040 100%)',
        'card-gradient': 'linear-gradient(145deg, rgba(15,32,64,0.8) 0%, rgba(10,22,40,0.9) 100%)',
      },
      boxShadow: {
        'glow-cyan':   '0 0 20px rgba(6,182,212,0.3)',
        'glow-violet': '0 0 20px rgba(139,92,246,0.3)',
        'card':        '0 4px 24px rgba(0,0,0,0.4)',
        'card-hover':  '0 8px 40px rgba(0,0,0,0.6)',
      },
      animation: {
        'fade-in':      'fadeIn 0.3s ease-in-out',
        'slide-up':     'slideUp 0.4s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'pulse-glow':   'pulseGlow 2s infinite',
        'spin-slow':    'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(16px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInRight: {
          '0%':   { transform: 'translateX(16px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(6,182,212,0.2)' },
          '50%':      { boxShadow: '0 0 30px rgba(6,182,212,0.6)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
