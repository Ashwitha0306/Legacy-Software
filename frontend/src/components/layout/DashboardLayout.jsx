import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, LayoutDashboard, FolderOpen, Settings, LogOut,
  Lock, Unlock
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore, applyTheme } from '@/store/themeStore'
import ThemeToggle from '@/components/ui/ThemeToggle'
import toast from 'react-hot-toast'
import clsx from 'clsx'

const NAV_ITEMS = [
  { to: '/dashboard',            label: 'Overview & Telemetry',  icon: LayoutDashboard, end: true },
  { to: '/dashboard/projects',   label: 'Codebase Projects',     icon: FolderOpen },
  { to: '/dashboard/settings',   label: 'Platform Settings',    icon: Settings },
]

export default function DashboardLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  // Ensure user's chosen theme (light/dark) is active inside the dashboard
  useEffect(() => {
    const savedTheme = useThemeStore.getState().theme || 'dark'
    applyTheme(savedTheme)
  }, [])

  // Hover auto-collapse state & Manual Pin State
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)

  // Sidebar is open if either hovered OR pinned
  const isOpen = isHovered || isPinned

  const handleLogout = async () => {
    await logout()
    applyTheme('dark')
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const handleTogglePin = (e) => {
    e.stopPropagation()
    setIsPinned((prev) => {
      const next = !prev
      toast(next ? 'Sidebar Locked Open' : 'Sidebar Auto-Hover Active', {
        icon: next ? '🔒' : '🔓',
        style: { background: '#070e1b', color: '#fff', border: '1px solid #1e293b' }
      })
      return next
    })
  }

  return (
    <div className="min-h-screen flex text-slate-900 dark:text-white selection:bg-cyan-500/30 overflow-x-clip relative transition-colors duration-200">

      {/* Structural layout spacer to preserve content positioning and flow */}
      <div
        className={clsx(
          'flex-shrink-0 transition-all duration-300 ease-in-out',
          isOpen ? 'w-72' : 'w-20'
        )}
        aria-hidden="true"
      />

      {/* ── PERMANENTLY FIXED AUTO-HOVER SIDEBAR ────────────────────────────── */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={clsx(
          'glass-sidebar flex flex-col group/sidebar',
          isOpen ? 'w-72' : 'w-20'
        )}
      >

        {/* ── 1. BRAND HEADER & CLEAN LOCK SYMBOL ONLY ── */}
        <div className="p-4 border-b border-emerald-200/50 dark:border-slate-800/80 flex items-center justify-between min-h-[76px] gap-3 bg-white/30 dark:bg-transparent backdrop-blur-md">
          
          {/* Logo & Brand Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 via-teal-400 to-violet-600 p-[1.5px] shadow-[0_0_20px_rgba(6,182,212,0.35)] flex-shrink-0">
              <div className="w-full h-full rounded-[14px] bg-white/90 dark:bg-[#030712] flex items-center justify-center backdrop-blur-sm">
                <Brain className="w-5 h-5 text-emerald-600 dark:text-cyan-400" />
              </div>
            </div>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                  className="min-w-0 flex-1 overflow-hidden whitespace-nowrap"
                >
                  <p className="font-extrabold text-slate-900 dark:text-white text-sm tracking-tight font-sans truncate">
                    Legacy Intel
                  </p>
                  <p className="text-[10px] text-emerald-700 dark:text-cyan-400 font-mono truncate font-bold">
                    11-Agent RAV Engine
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Header Controls: Theme Toggle & Lock/Pin Button */}
          <AnimatePresence>
            {isOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-1.5 flex-shrink-0 ml-auto"
              >
                <ThemeToggle variant="icon" />
                <button
                  onClick={handleTogglePin}
                  className={clsx(
                    'w-8 h-8 rounded-xl border transition-all duration-300 flex items-center justify-center cursor-pointer shadow-xs flex-shrink-0 backdrop-blur-md',
                    isPinned
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-700 dark:text-cyan-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                      : 'bg-white/70 dark:bg-navy-950/80 border-emerald-200/70 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-emerald-800 dark:hover:text-white hover:bg-white/95 hover:border-emerald-300 dark:hover:border-slate-500'
                  )}
                  title={isPinned ? 'Unlock Sidebar (Auto-Collapse on Mouse Leave)' : 'Lock Sidebar Open'}
                >
                  {isPinned ? (
                    <Lock className="w-4 h-4 text-emerald-600 dark:text-cyan-400" />
                  ) : (
                    <Unlock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>

        </div>

        {/* ── 2. NAVIGATION LINKS ── */}
        <nav className="flex-1 p-3 space-y-2 overflow-y-auto custom-scrollbar">
          {isOpen && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="text-[10px] font-extrabold text-emerald-800/80 dark:text-slate-500 uppercase tracking-wider px-3 mb-2 font-mono flex items-center justify-between"
            >
              <span>Platform Modules</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-cyan-400 animate-ping" />
            </motion.p>
          )}

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.to || (item.end && location.pathname === '/dashboard')
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={clsx(
                  'flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all duration-200 group relative',
                  isActive
                    ? 'bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-emerald-400/10 dark:from-cyan-500/20 dark:via-teal-500/15 dark:to-violet-500/10 text-emerald-950 dark:text-cyan-300 border border-emerald-400/60 dark:border-cyan-500/40 shadow-xs font-bold backdrop-blur-md'
                    : 'text-slate-700 dark:text-slate-400 hover:text-emerald-950 dark:hover:text-cyan-300 hover:bg-white/80 dark:hover:bg-blue-950/70 hover:border-emerald-300/70 dark:hover:border-cyan-500/30 hover:shadow-xs border border-transparent backdrop-blur-sm'
                )}
                title={!isOpen ? item.label : undefined}
              >
                <Icon className={clsx('w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110', isActive ? 'text-emerald-600 dark:text-cyan-400' : 'text-slate-500 dark:text-slate-400 group-hover:text-emerald-600')} />

                <AnimatePresence>
                  {isOpen && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.25 }}
                      className="text-xs font-semibold truncate flex-1 whitespace-nowrap"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>

                {isActive && (
                  <motion.div
                    layoutId="activeGlow"
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-gradient-to-b from-emerald-500 to-teal-400 dark:bg-cyan-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]"
                  />
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* ── 3. USER PROFILE, THEME TOGGLE & LOGOUT FOOTER ── */}
        <div className="p-3.5 border-t border-emerald-200/50 dark:border-slate-800/80 space-y-2.5 mt-auto bg-white/30 dark:bg-transparent backdrop-blur-md">
          {/* User profile capsule */}
          <div className={clsx('flex items-center gap-3 p-2 rounded-2xl bg-white/70 dark:bg-navy-950/80 border border-emerald-200/70 dark:border-slate-800/80 shadow-xs hover:bg-white/95 hover:border-emerald-300/90 hover:shadow-sm transition-all duration-300 cursor-pointer backdrop-blur-md', !isOpen && 'justify-center')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-teal-300 to-violet-600 p-[1.5px] flex-shrink-0 shadow-md">
              <div className="w-full h-full rounded-[10px] bg-gradient-to-br from-emerald-100 to-teal-100 dark:bg-[#030712] border border-emerald-300/50 dark:border-transparent flex items-center justify-center text-xs font-black text-emerald-800 dark:text-cyan-400 font-mono shadow-xs">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </div>
            </div>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.25 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-xs font-extrabold text-slate-900 dark:text-white truncate">{user?.name || 'Researcher'}</p>
                  <p className="text-[10px] text-emerald-700 dark:text-cyan-400 font-mono truncate capitalize font-bold">{user?.role || 'Lead Architect'}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Theme Toggle in Footer */}
          <div className="w-full flex items-center justify-center">
            <ThemeToggle
              variant={isOpen ? 'pill' : 'icon'}
              className="w-full justify-center"
            />
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className={clsx(
              'w-full py-2.5 px-3 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-red-400 hover:bg-rose-500/10 hover:border-rose-300/60 dark:hover:border-red-500/30 border border-transparent transition-all duration-300 flex items-center gap-2 cursor-pointer backdrop-blur-sm',
              !isOpen && 'justify-center'
            )}
            title={!isOpen ? 'Sign Out' : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {isOpen && <span>Sign Out</span>}
          </button>
        </div>

      </aside>

      {/* ── MAIN CONTENT VIEW CONTAINER ─────────────────────────────────────────── */}
      <main className="flex-1 min-h-screen min-w-0 p-6 sm:p-8 lg:p-10 relative z-10 w-full">
        <Outlet />
      </main>

    </div>
  )
}
