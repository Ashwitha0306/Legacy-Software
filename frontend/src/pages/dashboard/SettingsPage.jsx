import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  User, FlaskConical, Database, Save, Trash2, Download, CheckCircle2, Sliders
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import clsx from 'clsx'

export default function SettingsPage() {
  const { user } = useAuthStore()

  // State for Default Ablation Mode
  const [defaultAblation, setDefaultAblation] = useState(() => localStorage.getItem('anchorai_ablation') || 'full_rav')

  const handleSaveSettings = (e) => {
    if (e) e.preventDefault()
    localStorage.setItem('anchorai_ablation', defaultAblation)
    toast.success('Platform preferences saved!')
  }

  const handleClearCache = () => {
    if (window.confirm('Clear cached local telemetry and temporary LLM query history?')) {
      localStorage.removeItem('anchorai_llm_key')
      toast.success('Local cache & temporary tokens cleared')
    }
  }

  return (
    <div className="animate-fade-in space-y-8 w-full pb-16">

      {/* ── 1. HEADER TITLE ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-navy-900/90 p-6 sm:p-8 rounded-2xl border border-navy-800 backdrop-blur-xl w-full">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-extrabold text-white flex items-center gap-2.5">
              <Sliders className="w-7 h-7 text-cyan-400" />
              Platform Control Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-mono font-bold">
              Active Workspace
            </span>
          </div>
          <p className="text-slate-400 text-xs sm:text-sm">
            Manage user profile, default ablation modes, and system diagnostic telemetry
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          className="px-6 py-3 rounded-xl font-extrabold text-xs text-navy-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400 hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all flex items-center gap-2 cursor-pointer shadow-lg"
        >
          <Save className="w-4 h-4" />
          Save Preferences
        </button>
      </div>

      {/* ── SECTION 1: DEVELOPER PROFILE & WORKSPACE PERMISSIONS ── */}
      <section className="p-6 sm:p-8 rounded-2xl bg-navy-900/80 border border-navy-800 space-y-6 backdrop-blur-xl w-full">
        <div className="flex items-center justify-between border-b border-navy-800 pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
              <User className="w-5 h-5 text-cyan-400" /> Developer Profile &amp; Workspace Role
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Workspace identity, role permissions, and active telemetry</p>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">Active Session</span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-navy-950/80 border border-navy-800 space-y-1">
            <span className="text-xs text-slate-500 font-mono">Full Name</span>
            <p className="text-sm font-bold text-white">{user?.name || 'Lead Researcher'}</p>
          </div>

          <div className="p-4 rounded-xl bg-navy-950/80 border border-navy-800 space-y-1">
            <span className="text-xs text-slate-500 font-mono">Email Address</span>
            <p className="text-sm font-mono text-cyan-300 truncate">{user?.email || 'researcher@legacyintel.ai'}</p>
          </div>

          <div className="p-4 rounded-xl bg-navy-950/80 border border-navy-800 space-y-1">
            <span className="text-xs text-slate-500 font-mono">Platform Access Tier</span>
            <div className="pt-0.5">
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-xs font-mono font-bold">
                {user?.role || 'Lead Architect'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-navy-950/80 border border-navy-800 space-y-1">
            <span className="text-xs text-slate-500 font-mono">Active Workspace</span>
            <p className="text-sm font-semibold text-slate-200">Grounded RAV Production</p>
          </div>
        </div>
      </section>

      {/* ── SECTION 2: PIPELINE BENCHMARKS & ABLATION DEFAULTS ── */}
      <section className="p-6 sm:p-8 rounded-2xl bg-navy-900/80 border border-navy-800 space-y-6 backdrop-blur-xl w-full">
        <div className="flex items-center justify-between border-b border-navy-800 pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
              <FlaskConical className="w-5 h-5 text-amber-400" /> Pipeline Execution Mode &amp; Ablation Defaults
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Select default execution mode for formal comparative ablation studies
            </p>
          </div>
          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">Benchmarking</span>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 pt-2">
          {[
            ['full_rav', 'Full Grounded RAV', 'SSKG + Verification Agent (Recommended)'],
            ['rag_only', 'RAG-Only Baseline', 'SSKG Retrieval without Verification Agent'],
            ['plain_llm', 'Plain LLM Baseline', 'Raw Direct Context Window Baseline'],
          ].map(([mode, name, desc]) => (
            <div
              key={mode}
              onClick={() => setDefaultAblation(mode)}
              className={clsx(
                'p-5 rounded-xl border text-left cursor-pointer transition-all',
                defaultAblation === mode
                  ? 'border-cyan-400 bg-cyan-500/10 text-white shadow-[0_0_20px_rgba(6,182,212,0.2)]'
                  : 'border-navy-800 bg-navy-950/60 text-slate-400 hover:border-slate-700'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-sm">{name}</span>
                {defaultAblation === mode && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 3: SYSTEM TELEMETRY & STORAGE CACHE ── */}
      <section className="p-6 sm:p-8 rounded-2xl bg-navy-900/80 border border-navy-800 space-y-6 backdrop-blur-xl w-full">
        <div className="flex items-center justify-between border-b border-navy-800 pb-4">
          <div>
            <h2 className="text-xl font-extrabold text-white flex items-center gap-2.5">
              <Database className="w-5 h-5 text-cyan-400" /> System Telemetry &amp; Storage Cache
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">Manage browser local storage, session state, and diagnostic telemetry</p>
          </div>
          <span className="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20">Maintenance</span>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-5 rounded-xl bg-navy-950/80 border border-navy-800 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white">Reset Local Credentials Cache</h4>
              <p className="text-xs text-slate-400 mt-0.5">Clears saved local tokens and temporary session preferences.</p>
            </div>

            <button
              type="button"
              onClick={handleClearCache}
              className="px-4 py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" /> Clear Cache
            </button>
          </div>

          <div className="p-5 rounded-xl bg-navy-950/80 border border-navy-800 flex items-center justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-white">Export Diagnostic Telemetry</h4>
              <p className="text-xs text-slate-400 mt-0.5">Download diagnostic pipeline log trace for research evaluation.</p>
            </div>

            <button
              type="button"
              onClick={() => toast.success('Diagnostic log bundle downloaded')}
              className="px-4 py-2.5 rounded-xl bg-navy-800 border border-slate-700 hover:border-cyan-500/40 text-slate-200 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer flex-shrink-0"
            >
              <Download className="w-4 h-4 text-cyan-400" /> Export Logs
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER SAVE BAR ── */}
      <div className="flex items-center justify-between p-6 rounded-2xl bg-navy-900/90 border border-navy-800 backdrop-blur-xl">
        <span className="text-xs text-slate-400 font-mono">
          All settings persist locally across browser sessions.
        </span>

        <button
          onClick={handleSaveSettings}
          className="px-6 py-3 rounded-xl font-extrabold text-xs text-navy-950 bg-gradient-to-r from-cyan-400 via-teal-300 to-cyan-400 hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] transition-all flex items-center gap-2 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          Save All Settings
        </button>
      </div>

    </div>
  )
}
