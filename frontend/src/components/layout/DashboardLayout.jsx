import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain, LayoutDashboard, FolderOpen, Settings, LogOut,
  Lock, Unlock
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
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

  // Hover auto-collapse state & Manual Pin State
  const [isHovered, setIsHovered] = useState(false)
  const [isPinned, setIsPinned] = useState(false)

  // Sidebar is open if either hovered OR pinned
  const isOpen = isHovered || isPinned

  const handleLogout = async () => {
    await logout()
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
    <div className="min-h-screen flex bg-[#02050e] text-white selection:bg-cyan-500/30 overflow-x-hidden">

      {/* ── SILKY SMOOTH AUTO-HOVER SIDEBAR ───────────────────────────────── */}
      <aside
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={clsx(
          'flex-shrink-0 bg-[#060c1a]/95 border-r border-slate-800/80 flex flex-col backdrop-blur-3xl sticky top-0 h-screen z-40 shadow-[10px_0_40px_rgba(0,0,0,0.6)] group/sidebar',
          'transition-all duration-500 ease-in-out',
          isOpen ? 'w-72' : 'w-20'
        )}
      >

        {/* ── 1. BRAND HEADER & CLEAN LOCK SYMBOL ONLY ── */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between min-h-[76px] gap-3">
          
          {/* Logo & Brand Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-400 via-teal-400 to-violet-600 p-[1.5px] shadow-[0_0_20px_rgba(6,182,212,0.35)] flex-shrink-0">
              <div className="w-full h-full rounded-[14px] bg-[#030712] flex items-center justify-center">
                <Brain className="w-5 h-5 text-cyan-400" />
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
                  <p className="font-extrabold text-white text-sm tracking-tight font-sans truncate">
                    Legacy Intel
                  </p>
                  <p className="text-[10px] text-cyan-400 font-mono truncate">
                    11-Agent RAV Engine
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Lock / Unlock Symbol Only Button */}
          <AnimatePresence>
            {isOpen && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                onClick={handleTogglePin}
                className={clsx(
                  'w-8 h-8 rounded-xl border transition-all duration-300 flex items-center justify-center cursor-pointer shadow-md flex-shrink-0 ml-auto',
                  isPinned
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                    : 'bg-navy-950/80 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                )}
                title={isPinned ? 'Unlock Sidebar (Auto-Collapse on Mouse Leave)' : 'Lock Sidebar Open'}
              >
                {isPinned ? (
                  <Lock className="w-4 h-4 text-cyan-400" />
                ) : (
                  <Unlock className="w-4 h-4 text-slate-400" />
                )}
              </motion.button>
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
              className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider px-3 mb-2 font-mono flex items-center justify-between"
            >
              <span>Platform Modules</span>
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
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
                  'flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all duration-300 group relative',
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 via-teal-500/15 to-violet-500/10 text-cyan-300 border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.2)] font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-navy-800/60 border border-transparent'
                )}
                title={!isOpen ? item.label : undefined}
              >
                <Icon className={clsx('w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110', isActive ? 'text-cyan-400' : 'text-slate-400')} />

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
                    className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-cyan-400 shadow-[0_0_12px_#06b6d4]"
                  />
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* ── 3. USER PROFILE & LOGOUT FOOTER ── */}
        <div className="p-3.5 border-t border-slate-800/80 space-y-2">
          <div className={clsx('flex items-center gap-3 p-2 rounded-2xl bg-navy-950/80 border border-slate-800/80 transition-all duration-300', !isOpen && 'justify-center')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 via-teal-300 to-violet-600 p-[1.5px] flex-shrink-0 shadow-md">
              <div className="w-full h-full rounded-[10px] bg-[#030712] flex items-center justify-center text-xs font-extrabold text-cyan-400 font-mono">
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
                  <p className="text-xs font-extrabold text-white truncate">{user?.name || 'Researcher'}</p>
                  <p className="text-[10px] text-cyan-400 font-mono truncate capitalize">{user?.role || 'Lead Architect'}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleLogout}
            className={clsx(
              'w-full py-2.5 px-3 rounded-xl text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all duration-300 flex items-center gap-2 cursor-pointer',
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
      <main className="flex-1 min-h-screen overflow-y-auto p-6 sm:p-8 lg:p-10 relative z-10 w-full">
        <Outlet />
      </main>

    </div>
  )
}
