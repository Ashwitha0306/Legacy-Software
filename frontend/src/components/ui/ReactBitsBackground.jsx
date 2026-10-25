import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

export default function ReactBitsBackground({ variant = 'cyan' }) {
  const isCyan = variant === 'cyan'
  const spotlightRef = useRef(null)

  useEffect(() => {
    let rafId = null

    const handleMouseMove = (e) => {
      if (rafId) return
      rafId = requestAnimationFrame(() => {
        if (spotlightRef.current) {
          spotlightRef.current.style.transform = `translate3d(${e.clientX - 325}px, ${e.clientY - 325}px, 0)`
        }
        rafId = null
      })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [])

  // Bright Beams Colors
  const cPrimary = isCyan ? '#06b6d4' : '#a855f7'
  const cSecondary = isCyan ? '#14b8a6' : '#ec4899'
  const cAccent = isCyan ? '#3b82f6' : '#6366f1'

  const beamColumns = [
    { left: '2%', width: '12%', speed: 7, delay: 0, color: cPrimary },
    { left: '16%', width: '13%', speed: 9, delay: 1.5, color: cSecondary },
    { left: '31%', width: '14%', speed: 6, delay: 0.7, color: cAccent },
    { left: '47%', width: '12%', speed: 8, delay: 2.2, color: cPrimary },
    { left: '61%', width: '13%', speed: 10, delay: 1.0, color: cSecondary },
    { left: '76%', width: '12%', speed: 7.5, delay: 1.8, color: cAccent },
    { left: '90%', width: '10%', speed: 8.5, delay: 0.3, color: cPrimary },
  ]

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-[#02040c] transform-gpu">

      {/* ── 1. Cyber Perspective Grid Backdrop ── */}
      <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:32px_32px] opacity-30 pointer-events-none" />

      {/* ── 2. REACTBITS BEAMS COLUMNS (Hardware Accelerated Light Shafts) ── */}
      <div className="absolute inset-0 flex justify-between px-1 pointer-events-none">
        {beamColumns.map((col, idx) => (
          <div
            key={idx}
            className="absolute top-0 bottom-0 overflow-hidden border-x border-slate-800/30"
            style={{ left: col.left, width: col.width }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-white/[0.015] via-white/[0.03] to-white/[0.015]" />

            <motion.div
              initial={{ y: '-100%' }}
              animate={{ y: ['-100%', '200%'] }}
              transition={{
                duration: col.speed,
                repeat: Infinity,
                ease: 'linear',
                delay: col.delay,
              }}
              className="w-full h-[650px] opacity-80 blur-md will-change-transform"
              style={{
                background: `linear-gradient(to bottom, transparent 0%, ${col.color} 50%, transparent 100%)`,
              }}
            />
          </div>
        ))}
      </div>

      {/* ── 3. HARDWARE-ACCELERATED CURSOR SPOTLIGHT (Zero React Re-renders) ── */}
      <div
        ref={spotlightRef}
        className="absolute top-0 left-0 w-[650px] h-[650px] rounded-full blur-[140px] opacity-45 pointer-events-none will-change-transform transition-opacity duration-300"
        style={{
          transform: 'translate3d(-650px, -650px, 0)',
          background: isCyan
            ? 'radial-gradient(circle, rgba(6,182,212,0.45) 0%, rgba(20,184,166,0.18) 50%, transparent 80%)'
            : 'radial-gradient(circle, rgba(168,85,247,0.45) 0%, rgba(236,72,153,0.18) 50%, transparent 80%)',
        }}
      />

      {/* ── 4. Ambient Pulsing Spotlight Orbs ── */}
      <div
        className={`absolute -top-36 -left-36 w-[700px] h-[700px] rounded-full blur-[150px] opacity-40 animate-pulse pointer-events-none ${
          isCyan
            ? 'bg-gradient-to-br from-cyan-500/30 via-teal-400/15 to-transparent'
            : 'bg-gradient-to-br from-purple-600/35 via-pink-500/15 to-transparent'
        }`}
      />

      <div
        className={`absolute -bottom-36 -right-36 w-[750px] h-[750px] rounded-full blur-[160px] opacity-35 animate-pulse pointer-events-none ${
          isCyan
            ? 'bg-gradient-to-tl from-purple-600/30 via-cyan-500/15 to-transparent'
            : 'bg-gradient-to-tl from-cyan-500/30 via-indigo-600/20 to-transparent'
        }`}
      />

      {/* Subtle Scanline Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_50%,rgba(0,0,0,0.2)_51%)] bg-[length:100%_4px] pointer-events-none opacity-15" />

    </div>
  )
}
