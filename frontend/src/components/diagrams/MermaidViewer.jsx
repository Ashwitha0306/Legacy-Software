import React, { useEffect, useRef, useState, useCallback } from 'react'
import mermaid from 'mermaid'
import { Copy, Download, ZoomIn, ZoomOut, RotateCcw, Check, X, Maximize2, Code2, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import clsx from 'clsx'
import { useThemeStore } from '@/store/themeStore'

// ── Mermaid global theme ──────────────────────────────────────────────────────
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 15,
  themeVariables: {
    darkMode: true,
    background: '#060d1f',
    primaryColor: '#1e3a6e',
    primaryTextColor: '#f1f5f9',
    primaryBorderColor: '#22d3ee',
    lineColor: '#38bdf8',
    secondaryColor: '#152b56',
    tertiaryColor: '#0f2040',
    classText: '#f1f5f9',
    actorBkg: '#0f2040',
    actorBorder: '#22d3ee',
    actorTextColor: '#f1f5f9',
    actorLineColor: '#38bdf8',
    signalColor: '#22d3ee',
    signalTextColor: '#f1f5f9',
    labelBoxBkgColor: '#152b56',
    labelBoxBorderColor: '#22d3ee',
    labelTextColor: '#f1f5f9',
    loopTextColor: '#f1f5f9',
    noteBorderColor: '#a78bfa',
    noteBkgColor: '#1e1b4b',
    noteTextColor: '#f1f5f9',
    activationBorderColor: '#22d3ee',
    activationBkgColor: '#0f2040',
    sequenceNumberColor: '#060b18',
    attributeBackgroundColorOdd: '#0f2040',
    attributeBackgroundColorEven: '#152b56',
    edgeLabelBackground: '#0a1628',
  },
})

// ── Safety guard ──────────────────────────────────────────────────────────────
const ILLEGAL = [/class @[A-Z]/, /NodeType\./, /RelationshipType\./, /class \w+\([^)]+\)/, /<<NodeType\./]
const isSafe = code => code && !ILLEGAL.some(r => r.test(code))

// ── Mermaid flowchart reserved-keyword sanitizer ───────────────────────────────
// Old diagram data stored in the database may contain bare Mermaid reserved words
// as node IDs (e.g. `class["class [service]"]:::svc`). This function rewrites them
// to `N_<keyword>` so they parse correctly — matching what the backend now emits.
const FLOWCHART_RESERVED = [
  'class', 'end', 'style', 'classDef', 'graph', 'direction',
  'click', 'linkStyle', 'note', 'default', 'subgraph',
]

function patchMermaidCode(code) {
  if (!code) return code
  const trimmed = code.trim()
  if (!trimmed.startsWith('flowchart')) return code

  return code.split('\n').map(line => {
    const stripped = line.trim()
    // Skip directive lines (classDef declarations, subgraph headers, bare 'end', comments)
    if (
      stripped.startsWith('classDef ') ||
      stripped.startsWith('subgraph ') ||
      stripped === 'end' ||
      stripped.startsWith('%%') ||
      stripped.startsWith('flowchart')
    ) return line

    let out = line
    for (const kw of FLOWCHART_RESERVED) {
      // Node definition:  kw["..."]  or  kw[...]  or  kw(...)  or  kw{...}
      out = out.replace(
        new RegExp(`(?<![a-zA-Z0-9_])${kw}(?=[\\[\\(\\{])`, 'g'),
        `N_${kw}`
      )
      // Edge source:  kw --> or kw ---
      out = out.replace(
        new RegExp(`(?<![a-zA-Z0-9_])${kw}(?=\\s*(?:-->|---|==>|\.\.-))`, 'g'),
        `N_${kw}`
      )
      // Edge target:  --> kw  or  --- kw
      out = out.replace(
        new RegExp(`(-->|---|==>|\\.\.-)\\s*${kw}(?![a-zA-Z0-9_])`, 'g'),
        `$1 N_${kw}`
      )
    }
    return out
  }).join('\n')
}

// ── SVG XML sanitizer ───────────────────────────────────────────────────────
function sanitizeSvgForXml(svgString) {
  if (!svgString || typeof svgString !== 'string') return ''
  return svgString
    .replace(/&laquo;/g, '&#171;')
    .replace(/&raquo;/g, '&#187;')
    .replace(/<!--([\s\S]*?)-->/g, (_, inner) => '<!--' + inner.replace(/--/g, ' - ') + '-->')
}

// ── SVG → blob URL (always fits any container via CSS) ───────────────────────
function svgToBlobUrl(svgString) {
  const clean = sanitizeSvgForXml(svgString)
  const blob = new Blob([clean], { type: 'image/svg+xml;charset=utf-8' })
  return URL.createObjectURL(blob)
}

// ── Diagram accent colours ─────────────────────────────────────────────────────
const ACCENTS = {
  use_case:   { label: 'Use Case Diagram',    pill: 'bg-orange-500/15 text-orange-300 border-orange-500/30', glow: 'shadow-[0_0_40px_rgba(251,146,60,0.14)]' },
  activity:   { label: 'Activity Diagram',    pill: 'bg-rose-500/15 text-rose-300 border-rose-500/30',       glow: 'shadow-[0_0_40px_rgba(244,63,94,0.12)]' },
  sequence:   { label: 'Sequence Diagram',    pill: 'bg-violet-500/15 text-violet-300 border-violet-500/30', glow: 'shadow-[0_0_40px_rgba(167,139,250,0.10)]' },
  class:      { label: 'Class Diagram',       pill: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',       glow: 'shadow-[0_0_40px_rgba(34,211,238,0.10)]' },
  component:  { label: 'Component Diagram',   pill: 'bg-amber-500/15 text-amber-300 border-amber-500/30',    glow: 'shadow-[0_0_40px_rgba(245,158,11,0.10)]' },
  deployment: { label: 'Deployment Diagram',  pill: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', glow: 'shadow-[0_0_40px_rgba(16,185,129,0.10)]' },
  package:    { label: 'Package Diagram',     pill: 'bg-sky-500/15 text-sky-300 border-sky-500/30',          glow: 'shadow-[0_0_40px_rgba(56,189,248,0.10)]' },
  er:         { label: 'ER Diagram',          pill: 'bg-teal-500/15 text-teal-300 border-teal-500/30',       glow: 'shadow-[0_0_40px_rgba(20,184,166,0.10)]' },
}

// ════════════════════════════════════════════════════════════════════════════
// Lightbox — full-screen modal with zoom / pan
// ════════════════════════════════════════════════════════════════════════════
function Lightbox({ svgContent, title, accent, onClose }) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan]   = useState({ x: 0, y: 0 })
  const dragging = useRef(false)
  const origin   = useRef({ x: 0, y: 0 })

  // Esc to close
  useEffect(() => {
    const h = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = '' }
  }, [onClose])

  const onMD = e => {
    dragging.current = true
    origin.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
  }
  const onMM = e => { if (dragging.current) setPan({ x: e.clientX - origin.current.x, y: e.clientY - origin.current.y }) }
  const canvasRef = useRef(null)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const handleWheel = e => {
      e.preventDefault()
      setZoom(z => Math.min(8, Math.max(0.2, z + (e.deltaY > 0 ? -0.15 : 0.15))))
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [])

  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  // Create an img URL from SVG for crisp rendering at any zoom
  const [imgUrl, setImgUrl] = useState('')
  useEffect(() => {
    const url = svgToBlobUrl(svgContent)
    setImgUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [svgContent])

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ background: 'rgba(2,6,18,0.93)', backdropFilter: 'blur(12px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* Panel */}
      <div
        className="relative flex flex-col bg-[#060d1f] border border-white/10 rounded-3xl
                   shadow-2xl overflow-hidden"
        style={{ width: '94vw', height: '92vh', maxWidth: 1500 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 bg-navy-900/80 flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className={clsx('text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border', accent?.pill || 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30')}>
              {accent?.label || 'UML'}
            </span>
            <span className="font-semibold text-white">{title}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-slate-500 font-mono">Full View — Zoom &amp; Pan</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Zoom */}
            <div className="flex items-center bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              <button onClick={() => setZoom(z => Math.max(0.2, z - 0.2))} className="px-3 py-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><ZoomOut className="w-4 h-4" /></button>
              <button onClick={reset} className="px-3 py-2 text-sm font-mono text-slate-300 hover:text-white hover:bg-white/10 transition-colors border-x border-white/10 min-w-[60px] text-center">{Math.round(zoom * 100)}%</button>
              <button onClick={() => setZoom(z => Math.min(8, z + 0.2))} className="px-3 py-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"><ZoomIn className="w-4 h-4" /></button>
            </div>
            <button onClick={reset} className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors" title="Reset"><RotateCcw className="w-4 h-4" /></button>
            <button onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 text-sm font-medium transition-colors">
              <X className="w-4 h-4" /> Close
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          className="flex-1 overflow-hidden relative"
          style={{
            cursor: dragging.current ? 'grabbing' : 'grab',
            userSelect: 'none',
            background: 'radial-gradient(ellipse at 50% 30%, #0d1f40 0%, #060d1f 70%)',
          }}
          ref={canvasRef}
          onMouseDown={onMD} onMouseMove={onMM} onMouseUp={() => { dragging.current = false }} onMouseLeave={() => { dragging.current = false }}
        >
          {/* Grid */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.06]"
            style={{ backgroundImage: 'radial-gradient(circle, #38bdf8 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

          {/* Image — infinitely sharp at any zoom */}
          {imgUrl && (
            <div className="absolute inset-0 flex items-center justify-center"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center center',
                transition: dragging.current ? 'none' : 'transform 0.06s ease-out',
              }}
            >
              <img
                src={imgUrl}
                alt={title}
                draggable={false}
                onError={e => {
                  e.currentTarget.style.display = 'none'
                  const fallback = e.currentTarget.parentElement?.querySelector('.inline-lightbox-fallback')
                  if (fallback) fallback.style.display = 'block'
                }}
                style={{
                  maxWidth: 'none',
                  filter: 'drop-shadow(0 8px 40px rgba(34,211,238,0.18))',
                  imageRendering: 'crisp-edges',
                }}
              />
              <div
                className="inline-lightbox-fallback"
                style={{ display: 'none', maxWidth: 'none' }}
                dangerouslySetInnerHTML={{ __html: sanitizeSvgForXml(svgContent) }}
              />
            </div>
          )}

          {/* Hint */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] font-mono
                          text-slate-600 bg-navy-900/80 border border-white/8 rounded-full px-4 py-1.5 pointer-events-none">
            Scroll to zoom · Drag to pan · <kbd className="px-1 rounded bg-white/8 text-slate-500">Esc</kbd> to close
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// Main MermaidViewer
// ════════════════════════════════════════════════════════════════════════════
export default function MermaidViewer({ chartCode, svgCode, title, description, diagramType = 'class', isDemo = false }) {
  const { theme } = useThemeStore()
  const isDark = theme === 'dark'

  const [svgContent, setSvgContent]   = useState('')
  const [imgUrl, setImgUrl]           = useState('')
  const [renderError, setRenderError] = useState(null)
  const [lightbox, setLightbox]       = useState(false)
  const [copied, setCopied]           = useState(false)
  const [showCode, setShowCode]       = useState(false)

  const accent = ACCENTS[diagramType] || ACCENTS.class

  // ── Render ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    setSvgContent('')
    setImgUrl('')
    setRenderError(null)

    // Direct SVG handling (vector exact match)
    if (svgCode || chartCode?.trim().startsWith('<svg')) {
      const directSvg = (svgCode || chartCode).trim()
      setSvgContent(directSvg)
      const url = svgToBlobUrl(directSvg)
      setImgUrl(url)
      return () => {
        mounted = false
        URL.revokeObjectURL(url)
      }
    }

    if (!chartCode?.trim()) return
    if (!isSafe(chartCode)) { setRenderError('legacy'); return }

    const go = async () => {
      try {
        const id = `md-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const { svg } = await mermaid.render(id, patchMermaidCode(chartCode.trim()))
        if (!mounted) return
        setSvgContent(svg)
        // Create blob URL for crisp img display
        const url = svgToBlobUrl(svg)
        setImgUrl(url)
      } catch (err) {
        console.error(err)
        if (mounted) setRenderError(err?.message || 'render failed')
      }
    }
    go()

    return () => {
      mounted = false
      // Revoke old blob URL
      setImgUrl(prev => { if (prev) URL.revokeObjectURL(prev); return '' })
    }
  }, [chartCode, svgCode])

  const copyCode = () => {
    navigator.clipboard.writeText(chartCode || svgCode || '')
    setCopied(true)
    toast.success('Source copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadSVG = () => {
    if (!svgContent) return
    const a = Object.assign(document.createElement('a'), {
      href: imgUrl,
      download: `${(title || 'diagram').toLowerCase().replace(/\s+/g, '_')}.svg`,
    })
    a.click()
    toast.success('SVG saved!')
  }

  // ── Render states ──────────────────────────────────────────────────────────
  const canOpen = !!svgContent

  return (
    <>
      {/* Lightbox */}
      {lightbox && svgContent && (
        <Lightbox svgContent={svgContent} title={title} accent={accent} onClose={() => setLightbox(false)} />
      )}

      {/* Card */}
      <div className={clsx('flex flex-col rounded-2xl border overflow-hidden transition-colors', accent.glow, isDark ? 'border-white/8' : 'border-slate-200 bg-white shadow-card')}
        style={isDark ? { background: 'linear-gradient(160deg, #0a1628 0%, #060d1f 100%)' } : { background: '#ffffff' }}>

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <div className={clsx(
          'flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 border-b flex-shrink-0 transition-colors',
          isDark ? 'border-white/8 bg-navy-900/50' : 'border-slate-200 bg-slate-50/90'
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <span className={clsx('flex-shrink-0 text-[11px] font-mono font-bold px-2.5 py-1 rounded-full border', accent.pill)}>
              {accent.label}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{title || 'UML Diagram'}</p>
              {description && <p className="text-[11px] text-slate-500 truncate mt-0.5">{description}</p>}
            </div>
            {isDemo
              ? <span className="flex-shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-500">DEMO</span>
              : svgContent
                ? <span className="flex-shrink-0 flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-500">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE
                  </span>
                : null}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowCode(v => !v)}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                showCode
                  ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-600 dark:text-cyan-300'
                  : isDark ? 'bg-white/5 border-white/10 text-slate-400 hover:text-white' : 'bg-slate-100 border-slate-200 text-slate-600 hover:text-slate-900')}>
              <Code2 className="w-3.5 h-3.5" /> Source
            </button>

            <button onClick={copyCode}
              className={clsx('flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors',
                isDark ? 'border-white/10 bg-white/5 text-slate-400 hover:text-white' : 'border-slate-200 bg-slate-100 text-slate-600 hover:text-slate-900')}>
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied!' : 'Copy'}
            </button>

            <button onClick={downloadSVG} disabled={!canOpen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 text-xs font-medium transition-colors disabled:opacity-30">
              <Download className="w-3.5 h-3.5" /> SVG
            </button>

            <button onClick={() => setLightbox(true)} disabled={!canOpen}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300 hover:bg-violet-500/20 text-xs font-semibold transition-colors disabled:opacity-30">
              <Maximize2 className="w-3.5 h-3.5" /> Full View
            </button>
          </div>
        </div>

        {/* Source code */}
        {showCode && (
          <div className="border-b border-white/8 bg-black/30 flex-shrink-0">
            <pre className="text-[11px] font-mono text-slate-300 p-4 overflow-x-auto max-h-52 leading-relaxed">{chartCode}</pre>
          </div>
        )}

        {/* ── Diagram display ──────────────────────────────────────────────── */}
        <div className={clsx('relative flex-1', !isDark && 'bg-slate-50/50')} style={{ minHeight: 500 }}>

          {renderError === 'legacy' ? (
            /* Outdated data */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <RefreshCw className="w-7 h-7 text-amber-400" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-white mb-1">Re-run Analysis Required</p>
                <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                  Stored diagram was generated by an older pipeline version and cannot be rendered.
                  Re-run the analysis to get fresh UML diagrams.
                </p>
              </div>
            </div>

          ) : renderError ? (
            /* Render error */
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
              <p className="text-xs font-mono text-red-400 mb-2">⚠ Render Error</p>
              <p className="text-[11px] text-slate-500 text-center max-w-sm">{renderError}</p>
            </div>

          ) : !imgUrl ? (
            /* Loading */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-cyan-400/20" />
                <div className="absolute inset-0 rounded-full border-2 border-t-cyan-400 animate-spin" />
              </div>
              <p className="text-xs text-slate-500 font-mono animate-pulse">Generating UML diagram…</p>
            </div>

          ) : (
            /* ── THE DIAGRAM — img with object-fit: contain ── */
            <>
              {/* Click-to-expand overlay */}
              <button
                onClick={() => setLightbox(true)}
                className="absolute inset-0 w-full h-full flex items-center justify-center group z-10"
                style={{ background: 'transparent' }}
                title="Click to open full view"
              >
                {/* The diagram image — fills container, maintains aspect ratio */}
                <img
                  src={imgUrl}
                  alt={title || 'UML Diagram'}
                  draggable={false}
                  onError={e => {
                    e.currentTarget.style.display = 'none'
                    const fallback = e.currentTarget.parentElement?.querySelector('.inline-svg-fallback')
                    if (fallback) fallback.style.display = 'flex'
                  }}
                  className="w-full h-full transition-all duration-300 group-hover:scale-[1.01] group-hover:brightness-110"
                  style={{
                    objectFit: 'contain',
                    padding: '24px',
                    filter: 'drop-shadow(0 4px 24px rgba(34,211,238,0.10))',
                    imageRendering: 'auto',
                  }}
                />
                <div
                  className="inline-svg-fallback w-full h-full p-6 items-center justify-center overflow-auto pointer-events-none"
                  style={{ display: 'none' }}
                  dangerouslySetInnerHTML={{ __html: sanitizeSvgForXml(svgContent) }}
                />

                {/* Hover expand hint */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl
                                  bg-navy-900/90 border border-violet-400/50 backdrop-blur-md
                                  text-violet-200 text-sm font-semibold shadow-xl">
                    <Maximize2 className="w-5 h-5 text-violet-400" />
                    Click to open Full View
                  </div>
                </div>
              </button>

              {/* Bottom status bar */}
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between
                              px-4 py-2 bg-gradient-to-t from-[#060d1f] to-transparent pointer-events-none">
                <span className="text-[10px] font-mono text-slate-600">
                  {isDemo ? '⚠ Demo diagram — re-run analysis for live data' : '✓ Generated from code AST & SSKG'}
                </span>
                <span className="text-[10px] font-mono text-slate-600 flex items-center gap-1">
                  <Maximize2 className="w-3 h-3" /> Click diagram to zoom &amp; pan
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
