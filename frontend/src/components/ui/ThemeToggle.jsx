import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { useThemeStore } from '@/store/themeStore'
import clsx from 'clsx'
import toast from 'react-hot-toast'

export default function ThemeToggle({
  className = '',
  variant = 'icon', // 'icon' | 'pill' | 'card'
  showLabel = false,
}) {
  const { theme, toggleTheme, setTheme } = useThemeStore()
  const isDark = theme === 'dark'

  const handleToggle = (e) => {
    e?.stopPropagation?.()
    toggleTheme()
    const next = isDark ? 'Light' : 'Dark'
    toast(`${next} Mode Enabled`, {
      icon: isDark ? '☀️' : '🌙',
      style: {
        background: isDark ? '#ffffff' : '#070e1b',
        color: isDark ? '#0f172a' : '#ffffff',
        border: isDark ? '1px solid #cbd5e1' : '1px solid #1e293b',
      },
      duration: 1800,
    })
  }

  if (variant === 'pill') {
    return (
      <button
        onClick={handleToggle}
        className={clsx(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-300 cursor-pointer shadow-sm',
          isDark
            ? 'bg-navy-950/80 border-slate-700/80 text-amber-300 hover:text-amber-200 hover:border-amber-400/40 hover:bg-navy-900'
            : 'bg-white border-slate-300 text-slate-700 hover:text-slate-900 hover:border-slate-400 hover:bg-slate-50',
          className
        )}
        title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
        aria-label="Toggle Global Theme"
      >
        <AnimatePresence mode="wait" initial={false}>
          {isDark ? (
            <motion.div
              key="sun"
              initial={{ rotate: -90, scale: 0.7, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: 90, scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5 text-amber-400"
            >
              <Sun className="w-4 h-4" />
              <span>Light Mode</span>
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ rotate: 90, scale: 0.7, opacity: 0 }}
              animate={{ rotate: 0, scale: 1, opacity: 1 }}
              exit={{ rotate: -90, scale: 0.7, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-1.5 text-cyan-600"
            >
              <Moon className="w-4 h-4" />
              <span>Dark Mode</span>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    )
  }

  // Default 'icon' button
  return (
    <button
      onClick={handleToggle}
      className={clsx(
        'w-8 h-8 rounded-xl border transition-all duration-300 flex items-center justify-center cursor-pointer shadow-sm relative overflow-hidden flex-shrink-0',
        isDark
          ? 'bg-navy-950/90 border-slate-700/80 text-amber-400 hover:border-amber-400/50 hover:bg-amber-500/10 hover:text-amber-300'
          : 'bg-white border-slate-200 text-slate-600 hover:border-cyan-400 hover:text-cyan-600 hover:bg-cyan-50/60 shadow-slate-200/50',
        className
      )}
      title={isDark ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
      aria-label="Toggle Global Theme"
    >
      <AnimatePresence mode="wait" initial={false}>
        {isDark ? (
          <motion.div
            key="moon"
            initial={{ rotate: -90, scale: 0.5, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Sun className="w-4 h-4 text-amber-400" />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ rotate: 90, scale: 0.5, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: -90, scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Moon className="w-4 h-4 text-cyan-600" />
          </motion.div>
        )}
      </AnimatePresence>
    </button>
  )
}

