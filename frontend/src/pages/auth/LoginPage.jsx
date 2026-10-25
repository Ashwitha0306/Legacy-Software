import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Eye, EyeOff, Brain, Loader2, Mail, Lock, ArrowRight,
  Sparkles, ShieldCheck, GitBranch, Terminal, Zap
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import ReactBitsBackground from '@/components/ui/ReactBitsBackground'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading } = useAuthStore()

  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [rememberMe, setRememberMe] = useState(true)

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.email) errs.email = 'Email address is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email address'
    if (!form.password) errs.password = 'Password is required'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    const result = await login(form.email, form.password)
    if (result.success) {
      toast.success('Welcome back!')
      navigate('/dashboard')
    } else {
      toast.error(result.message || 'Login failed. Please check your credentials.')
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#030612] text-white flex flex-col lg:flex-row overflow-x-hidden relative selection:bg-cyan-500/30">

      {/* ── VIBRANT REACTBITS SILK & BEAMS BACKDROP ── */}
      <ReactBitsBackground variant="cyan" />

      {/* ── LEFT HERO SHOWCASE PANEL (Desktop) ── */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 lg:p-16 relative z-10 border-r border-slate-800/80 bg-gradient-to-b from-[#050b18]/95 via-[#030713]/60 to-[#050b18]/95 backdrop-blur-3xl">

        {/* Header Logo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 via-teal-400 to-violet-600 p-[1.5px] shadow-[0_0_30px_rgba(6,182,212,0.45)]">
              <div className="w-full h-full rounded-[14px] bg-[#030712] flex items-center justify-center">
                <Brain className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white font-sans">
                Legacy Intel
              </span>
              <p className="text-xs text-slate-400 font-mono">Software Intelligence Platform</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono bg-navy-900/80 px-3.5 py-1.5 rounded-full border border-slate-700/80 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            Live Engine Active
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
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/20 via-teal-500/20 to-violet-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-mono shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              Next-Gen Software Architecture Analytics
            </div>
            <h1 className="text-4xl lg:text-5xl font-extrabold text-white leading-[1.15] tracking-tight">
              Understand Any Codebase <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-violet-400 bg-clip-text text-transparent">In Minutes</span>
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Instantly map software architecture, generate accurate UML diagrams, inspect API contracts, and perform natural-language queries grounded in your codebase.
            </p>
          </motion.div>

          {/* Feature Cards */}
          <div className="space-y-3.5">
            <div className="p-4.5 rounded-2xl bg-navy-900/60 border border-slate-800/80 flex items-start gap-4 backdrop-blur-xl hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <GitBranch className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">Architecture Knowledge Graph</h4>
                <p className="text-slate-400 text-xs leading-relaxed">Automated extraction of typed system components, REST endpoints, and call dependencies.</p>
              </div>
            </div>

            <div className="p-4.5 rounded-2xl bg-navy-900/60 border border-slate-800/80 flex items-start gap-4 backdrop-blur-xl hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                <ShieldCheck className="w-5 h-5 text-violet-400" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">Evidence-Grounded Intelligence</h4>
                <p className="text-slate-400 text-xs leading-relaxed">Every statement is cross-referenced with line-by-line static source code citations.</p>
              </div>
            </div>

            <div className="p-4.5 rounded-2xl bg-navy-900/60 border border-slate-800/80 flex items-start gap-4 backdrop-blur-xl hover:border-slate-700 transition-colors">
              <div className="w-10 h-10 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-[0_0_15px_rgba(20,184,166,0.2)]">
                <Terminal className="w-5 h-5 text-teal-400" />
              </div>
              <div className="space-y-1">
                <h4 className="font-bold text-white text-sm">Conversational AI Chatbot</h4>
                <p className="text-slate-400 text-xs leading-relaxed">Ask questions about endpoints, data schemas, or workflows with multi-turn memory.</p>
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
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 via-teal-400 to-violet-600 p-[1.5px] shadow-[0_0_25px_rgba(6,182,212,0.4)] mb-2">
              <div className="w-full h-full rounded-[14px] bg-[#030712] flex items-center justify-center">
                <Brain className="w-7 h-7 text-cyan-400" />
              </div>
            </div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-violet-400 bg-clip-text text-transparent">Legacy Intel</h1>
            <p className="text-xs text-slate-400">Software Intelligence Platform</p>
          </div>

          {/* Glass Card Outer Glow Wrapper */}
          <div className="p-[1.5px] rounded-[2.5rem] bg-gradient-to-b from-cyan-400/50 via-teal-500/25 to-violet-600/50 shadow-[0_25px_80px_rgba(0,0,0,0.85)] backdrop-blur-3xl relative">

            <div className="rounded-[2.45rem] bg-[#070e1b]/95 p-8 sm:p-10 space-y-6 relative overflow-hidden">

              {/* Top Shimmer Line */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent animate-pulse" />

              {/* Title Section */}
              <div className="space-y-1 text-center sm:text-left">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">Sign In to Dashboard</h2>
                <p className="text-xs text-slate-400">Enter your credentials to access your workspace.</p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} noValidate className="space-y-4">

                {/* Email Address */}
                <div className="space-y-1.5">
                  <label htmlFor="login-email" className="text-xs font-medium text-slate-300 block">
                    Email Address
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      id="login-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      value={form.email}
                      onChange={handleChange}
                      placeholder="name@company.com"
                      className={`w-full pl-11 pr-4 py-3.5 rounded-2xl bg-[#030712]/90 border text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 ${
                        errors.email
                          ? 'border-red-500/80 focus:border-red-500 focus:ring-4 focus:ring-red-500/15'
                          : 'border-slate-800 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/15'
                      }`}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-red-400 text-xs flex items-center gap-1 mt-1">
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="login-password" className="text-xs font-medium text-slate-300">
                      Password
                    </label>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-cyan-400 transition-colors" />
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={form.password}
                      onChange={handleChange}
                      placeholder="••••••••"
                      className={`w-full pl-11 pr-11 py-3.5 rounded-2xl bg-[#030712]/90 border text-sm text-white placeholder-slate-500 outline-none transition-all duration-200 ${
                        errors.password
                          ? 'border-red-500/80 focus:border-red-500 focus:ring-4 focus:ring-red-500/15'
                          : 'border-slate-800 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-500/15'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
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

                {/* Remember Me */}
                <div className="flex items-center justify-between pt-1 text-xs">
                  <label className="flex items-center gap-2 text-slate-400 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/20"
                    />
                    Remember me
                  </label>
                </div>

                {/* Radiant Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  id="login-submit-btn"
                  className="w-full py-4 px-4 rounded-2xl font-extrabold text-sm text-navy-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400 hover:from-cyan-300 hover:to-teal-200 shadow-[0_0_30px_rgba(6,182,212,0.45)] hover:shadow-[0_0_40px_rgba(6,182,212,0.7)] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
                  ) : (
                    <>Sign In <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>
              </form>

              {/* Register Link */}
              <div className="pt-2 text-center text-xs text-slate-400 border-t border-slate-800">
                Don't have an account?{' '}
                <Link to="/register" className="text-cyan-400 hover:text-cyan-300 font-semibold transition-colors">
                  Create one free →
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
