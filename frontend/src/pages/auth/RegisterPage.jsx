import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Eye, EyeOff, Brain, Loader2, Mail, Lock, User, ArrowRight,
  Sparkles, ShieldCheck, GitBranch, Terminal
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore, applyTheme } from '@/store/themeStore'
import ReactBitsBackground from '@/components/ui/ReactBitsBackground'

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register, isLoading } = useAuthStore()

  // Authentication pages (Login & Register) must ALWAYS remain in dark theme
  useEffect(() => {
    applyTheme('dark')
    return () => {
      const savedTheme = useThemeStore.getState().theme || 'dark'
      applyTheme(savedTheme)
    }
  }, [])

  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.name || form.name.trim().length < 2) errs.name = 'Full name must be at least 2 characters'
    if (!form.email) errs.email = 'Email address is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email address'
    if (!form.password || form.password.length < 8) errs.password = 'Password must be at least 8 characters'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    const result = await register(form.name.trim(), form.email, form.password)
    if (result.success) {
      toast.success('Account created! Welcome to Legacy Intel.')
      navigate('/dashboard')
    } else {
      toast.error(result.message || 'Registration failed')
    }
  }

  return (
    <div className="auth-dark-scope min-h-screen w-full bg-[#030612] text-white flex flex-col lg:flex-row overflow-x-hidden relative selection:bg-violet-500/30">

      {/* ── VIBRANT REACTBITS SILK & BEAMS BACKDROP ── */}
      <ReactBitsBackground variant="violet" />

      {/* ── LEFT HERO SHOWCASE PANEL (Desktop) ── */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 lg:p-16 relative z-10 border-r border-slate-800/60 bg-gradient-to-b from-[#050b18]/95 via-[#030713]/60 to-[#050b18]/95 backdrop-blur-3xl">

        {/* Header Logo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-400 via-indigo-500 to-cyan-400 p-[1.5px] shadow-[0_0_30px_rgba(139,92,246,0.4)]">
              <div className="w-full h-full rounded-[14px] bg-[#030712] flex items-center justify-center">
                <Brain className="w-6 h-6 text-violet-400" />
              </div>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white font-sans">
                Legacy Intel
              </span>
              <p className="text-xs text-slate-400 font-mono">Software Intelligence Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono bg-navy-900/80 px-3.5 py-1.5 rounded-full border border-slate-700/80 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.15)]">
            <ShieldCheck className="w-4 h-4 text-violet-400" />
            Developer Workspace
          </div>
        </div>

        {/* Central Product Value Proposition */}
        <div className="my-auto py-8 space-y-8 max-w-xl">

          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-violet-500/15 via-indigo-500/15 to-cyan-500/15 border border-violet-500/30 text-violet-300 text-xs font-mono">
              <Sparkles className="w-4 h-4 text-violet-400" />
              Developer Account Setup
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-[1.15] tracking-tight">
              Build & Analyze Codebases with <span className="bg-gradient-to-r from-violet-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">Grounded AI</span>
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Create your account to run static analysis pipelines, generate UML diagrams, and query project architecture with complete confidence.
            </p>
          </motion.div>

          {/* Clean Feature Cards */}
          <div className="space-y-3.5">
            <div className="p-4.5 rounded-2xl bg-navy-900/60 border border-slate-800/80 flex items-start gap-4 backdrop-blur-xl hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                <ShieldCheck className="w-5 h-5 text-violet-400" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">Grounded Code Verification</h4>
                <p className="text-slate-400 text-xs leading-relaxed">Line-by-line evidence mapping to ensure generated docs match source code 1:1.</p>
              </div>
            </div>

            <div className="p-4.5 rounded-2xl bg-navy-900/60 border border-slate-800/80 flex items-start gap-4 backdrop-blur-xl hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <Terminal className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">Conversational AI Chatbot</h4>
                <p className="text-slate-400 text-xs leading-relaxed">Ask questions about endpoints, data schemas, or business logic with multi-turn memory.</p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="text-xs text-slate-500 font-mono flex items-center justify-between border-t border-slate-800/80 pt-4">
          <span>Enterprise Code Intelligence</span>
          <span>© 2026 Legacy Intel</span>
        </div>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 lg:p-16 relative z-10">

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md space-y-6"
        >

          {/* Mobile Brand Header */}
          <div className="text-center lg:hidden space-y-2">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-400 via-indigo-500 to-cyan-400 p-[1.5px] shadow-[0_0_25px_rgba(139,92,246,0.4)] mb-2">
              <div className="w-full h-full rounded-[14px] bg-[#030712] flex items-center justify-center">
                <Brain className="w-6 h-6 text-violet-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">Legacy Intel</h1>
            <p className="text-xs text-slate-400">Software Intelligence Platform</p>
          </div>

          {/* Glass Card Outer Glow Wrapper */}
          <div className="p-[1.5px] rounded-[2.5rem] bg-gradient-to-b from-violet-500/50 via-indigo-500/25 to-cyan-500/50 shadow-[0_25px_80px_rgba(0,0,0,0.85)] backdrop-blur-3xl relative">

            <div className="rounded-[2.45rem] bg-[#070e1b]/95 p-8 sm:p-10 space-y-6 relative overflow-hidden">

              {/* Top Shimmer Line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-violet-400 to-transparent animate-pulse" />

              {/* Title Section */}
              <div className="space-y-1 text-center sm:text-left">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">Create Account</h2>
                <p className="text-xs text-slate-400">Register your account to access the workspace.</p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} noValidate className="space-y-4">

                {/* Full Name */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-name" className="text-xs font-medium text-slate-300 block">
                    Full Name
                  </label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                    <input
                      id="reg-name"
                      name="name"
                      type="text"
                      autoComplete="name"
                      value={form.name}
                      onChange={handleChange}
                      placeholder="Jane Smith"
                      className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#030712]/90 border text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 ${
                        errors.name
                          ? 'border-red-500/80 focus:border-red-500 focus:ring-4 focus:ring-red-500/15'
                          : 'border-slate-800 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15'
                      }`}
                    />
                  </div>
                  {errors.name && (
                    <p className="text-red-400 text-xs flex items-center gap-1 mt-1">
                      {errors.name}
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-email" className="text-xs font-medium text-slate-300 block">
                    Email Address
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                    <input
                      id="reg-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="name@company.com"
                      className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#030712]/90 border text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 ${
                        errors.email
                          ? 'border-red-500/80 focus:border-red-500 focus:ring-4 focus:ring-red-500/15'
                          : 'border-slate-800 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15'
                      }`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-xs flex items-center gap-1 mt-1">
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Password Input */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-password" className="text-xs font-medium text-slate-300 block">
                    Password
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
                    <input
                      id="reg-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className={`w-full pl-11 pr-11 py-3.5 rounded-2xl bg-[#030712]/90 border text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 ${
                        errors.password
                          ? 'border-red-500/80 focus:border-red-500 focus:ring-4 focus:ring-red-500/15'
                          : 'border-slate-800 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/15'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="text-red-400 text-xs flex items-center gap-1 mt-1">
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* Radiant Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  id="register-submit-btn"
                  className="w-full py-4 px-4 rounded-2xl font-extrabold text-sm text-white bg-gradient-to-r from-violet-600 via-indigo-500 to-cyan-400 hover:from-violet-500 hover:to-cyan-300 shadow-[0_0_30px_rgba(139,92,246,0.45)] hover:shadow-[0_0_40px_rgba(139,92,246,0.7)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Creating Account...</>
                  ) : (
                    <>Create Account <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              {/* Navigation Link */}
              <div className="pt-2 text-center text-xs text-slate-400 border-t border-slate-800">
                Already have an account?{' '}
                <Link to="/login" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
                  Sign in →
                </Link>
              </div>

            </div>
          </div>

          {/* Footnote */}
          <div className="text-center text-[11px] text-slate-500 font-mono">
            Legacy Software Intelligence Platform
          </div>

        </motion.div>
      </div>

    </div>
  )
}
