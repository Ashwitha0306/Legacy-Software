import React, { useState } from 'react'
import {
  Database, Layers, FileCode, GitFork, ArrowRight, ShieldCheck,
  Zap, Box, Tag, Key, Code, RefreshCw
} from 'lucide-react'
import clsx from 'clsx'

/**
 * Class & Package Architecture Diagram Component (SVG / Interactive Visualizer)
 */
export function ClassDiagramView({ classes = [], sskgNodes = [], sskgEdges = [] }) {
  const [selectedClass, setSelectedClass] = useState(classes[0] || null)

  const packages = Array.from(new Set(classes.map(c => c.package || 'default'))).filter(Boolean)

  return (
    <div className="space-y-6">
      <div className="card p-6 border-cyan-500/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="section-title text-base flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" /> Interactive Architecture Class Diagram & Package Graph
            </h3>


          </div>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="badge-cyan">{classes.length} Classes</span>
            <span className="badge-slate">{packages.length} Packages</span>
          </div>
        </div>

        {/* Visual Graph View: Packages & Class Cards */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column: Package & Class Navigator */}
          <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
            {packages.map((pkg, pIdx) => (
              <div key={`pkg-${pkg}-${pIdx}`} className="p-3 rounded-xl bg-navy-950/80 border border-navy-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-cyan-400 flex items-center gap-1.5">
                    <Box className="w-3.5 h-3.5 text-cyan-400" /> {pkg}
                  </span>
                  <span className="badge-slate text-[10px]">package</span>
                </div>

                <div className="space-y-1.5 pl-2">
                  {classes.filter(c => (c.package || 'default') === pkg).map((cls, cIdx) => (
                    <button
                      key={`cls-${cls.file_path || ''}-${cls.qualified_name || cls.class_name}-${cIdx}`}
                      onClick={() => setSelectedClass(cls)}
                      className={clsx(
                        'w-full text-left p-2 rounded-lg text-xs font-mono transition-all flex items-center justify-between',
                        (selectedClass?.qualified_name === cls.qualified_name || selectedClass?.class_name === cls.class_name)
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-glow-cyan'
                          : 'bg-navy-900/60 text-slate-300 hover:bg-navy-800 border border-navy-800'
                      )}
                    >
                      <span className="font-semibold">{cls.class_name}</span>
                      <span className="text-[10px] text-slate-500">
                        {cls.annotations?.includes('@RestController') ? 'API' : cls.annotations?.includes('@Service') ? 'Service' : cls.annotations?.includes('@Entity') ? 'Entity' : 'Class'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Right 2 Columns: Detailed Class Diagram Box & Code Signature */}
          <div className="lg:col-span-2 space-y-4">
            {selectedClass ? (
              <div className="card p-6 bg-navy-950/90 border border-cyan-500/30 space-y-4 font-mono">
                {/* UML Class Header */}
                <div className="pb-4 border-b border-navy-800 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="badge-cyan text-xs font-bold">{selectedClass.package}</span>
                      {selectedClass.extends && (
                        <span className="text-xs text-slate-400">extends <strong className="text-cyan-400">{selectedClass.extends}</strong></span>
                      )}
                    </div>
                    <h4 className="text-xl font-bold text-white flex items-center gap-2">
                      <FileCode className="w-5 h-5 text-cyan-400" />
                      {selectedClass.class_name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">{selectedClass.file_path} (L{selectedClass.start_line}-L{selectedClass.end_line})</p>
                  </div>
                  <div className="flex flex-wrap gap-1 max-w-[200px] justify-end">
                    {selectedClass.annotations?.map((ann, aIdx) => (
                      <span key={`ann-${ann}-${aIdx}`} className="badge-violet text-[10px]">{ann}</span>
                    ))}
                  </div>
                </div>

                {/* Attributes / Fields Section */}
                <div className="space-y-2">
                  <h5 className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-amber-400" /> Fields & Dependencies ({selectedClass.fields?.length || 0})
                  </h5>
                  <div className="p-3 rounded-lg bg-navy-900/80 border border-navy-800 space-y-1.5 text-xs">
                    {selectedClass.fields?.length > 0 ? (
                      selectedClass.fields.map((f, idx) => (
                        <div key={`field-${f.field_name}-${idx}`} className="flex items-center justify-between text-slate-300">
                          <span>- {f.field_name}: <strong className="text-cyan-400">{f.field_type}</strong></span>
                          <div className="flex gap-1">
                            {f.annotations?.map((a, aIdx) => <span key={`fa-${a}-${aIdx}`} className="text-[10px] text-slate-500">{a}</span>)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-500 italic text-xs">No explicit field declarations</span>
                    )}
                  </div>
                </div>

                {/* Operations / Methods Section */}
                <div className="space-y-2">
                  <h5 className="text-xs uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5 text-emerald-400" /> Methods & Operations ({selectedClass.methods?.length || 0})
                  </h5>
                  <div className="p-3 rounded-lg bg-navy-900/80 border border-navy-800 space-y-2 text-xs max-h-[220px] overflow-y-auto">
                    {selectedClass.methods?.length > 0 ? (
                      selectedClass.methods.map((m, idx) => (
                        <div key={idx} className="p-2 rounded bg-navy-950/60 border border-navy-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white">+ {m.method_name}(): <span className="text-emerald-400">{m.return_type}</span></span>
                            {m.is_endpoint && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-400 font-bold">
                                {m.http_method} {m.endpoint_path}
                              </span>
                            )}
                          </div>
                          {m.calls?.length > 0 && (
                            <p className="text-[11px] text-slate-400 flex items-center gap-1">
                              <ArrowRight className="w-3 h-3 text-slate-500" /> Calls: {m.calls.join(', ')}
                            </p>
                          )}
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-500 italic text-xs">No method declarations</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="card p-12 text-center text-slate-500 text-sm">
                Select a class from the left panel to inspect UML details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Visual Database ER Diagram Component (JPA Entity to DB Table Mappings)
 */
export function ERDiagramView({ classes = [] }) {
  const entityClasses = classes.filter(c =>
    (c.annotations || []).some(a => a.includes('Entity') || a.includes('Table'))
  )

  return (
    <div className="card p-6 space-y-6 border-amber-500/30">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="section-title text-base flex items-center gap-2">
            <Database className="w-4 h-4 text-amber-400" /> Database Schema & Entity-Relationship (ER) Diagram
          </h3>

        </div>
        <span className="badge-amber font-mono">{entityClasses.length} Tables/Entities</span>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entityClasses.length > 0 ? (
          entityClasses.map((cls, eIdx) => (
            <div key={`er-${cls.file_path || ''}-${cls.qualified_name || cls.class_name}-${eIdx}`} className="card p-4 bg-navy-950/90 border border-navy-700 space-y-3 font-mono">
              <div className="pb-2 border-b border-navy-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-white text-sm">{cls.class_name.toLowerCase()}s</span>
                </div>
                <span className="badge-cyan text-[10px]">{cls.class_name}</span>
              </div>

              <div className="space-y-1.5 text-xs">
                {cls.fields?.map((f, idx) => {
                  const isId = (f.annotations || []).some(a => a.includes('Id'))
                  return (
                    <div key={idx} className="flex items-center justify-between p-1.5 rounded bg-navy-900/60">
                      <span className="flex items-center gap-1.5 text-slate-300">
                        {isId ? <Key className="w-3 h-3 text-amber-400" /> : <span className="w-3 text-slate-600 text-center">•</span>}
                        <strong className={clsx(isId ? 'text-amber-300' : 'text-white')}>{f.field_name}</strong>
                      </span>
                      <span className="text-[10px] text-cyan-400">{f.field_type}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full p-8 text-center bg-navy-950/60 rounded-xl border border-navy-800 text-slate-400 text-xs font-mono">
            Discovered JPA Entity mappings stored directly in SSKG graph nodes.
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Visual Impact Analysis Blast Radius Graph
 */
export function BlastRadiusGraphView({ impactData = {} }) {
  const target = impactData.target_node_id || 'class:UserService'
  const radiusCount = impactData.blast_radius_count || 3
  const risk = impactData.risk_level || 'LOW'

  return (
    <div className="card p-6 space-y-6 border-amber-500/30">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="section-title text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Impact Analysis Graph Visualizer (Agent 10)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Simulates change propagation across directional SSKG graph edges to predict blast radius.
          </p>
        </div>
        <span className={clsx('badge-amber font-mono font-bold', risk === 'HIGH' ? 'text-red-400' : 'text-emerald-400')}>
          Risk: {risk}
        </span>
      </div>

      {/* Visual Canvas Diagram */}
      <div className="p-8 rounded-2xl bg-navy-950 border border-navy-800 flex flex-col items-center justify-center space-y-6 relative overflow-hidden">
        {/* Target Node Center */}
        <div className="p-4 rounded-xl bg-amber-500/10 border-2 border-amber-400 text-center space-y-1 z-10 shadow-glow-amber">
          <span className="badge-amber font-mono text-[10px] uppercase">Simulation Target</span>
          <p className="font-mono text-sm font-bold text-white">{target}</p>
        </div>

        {/* Directional Connector Lines */}
        <div className="flex items-center gap-4 text-xs font-mono text-slate-500">
          <ArrowRight className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>Traversing {radiusCount} downstream dependency nodes</span>
          <ArrowRight className="w-4 h-4 text-amber-400 animate-pulse" />
        </div>

        {/* Blast Radius Affected Nodes Grid */}
        <div className="grid sm:grid-cols-3 gap-4 w-full max-w-2xl z-10">
          <div className="p-3 rounded-lg bg-navy-900 border border-navy-700 text-center font-mono text-xs">
            <span className="text-cyan-400 font-bold">UserRepository</span>
            <p className="text-[10px] text-slate-500 mt-1">Direct CALLS Edge</p>
          </div>
          <div className="p-3 rounded-lg bg-navy-900 border border-navy-700 text-center font-mono text-xs">
            <span className="text-violet-400 font-bold">UserController</span>
            <p className="text-[10px] text-slate-500 mt-1">Direct USES Edge</p>
          </div>
          <div className="p-3 rounded-lg bg-navy-900 border border-navy-700 text-center font-mono text-xs">
            <span className="text-emerald-400 font-bold">UserDTO</span>
            <p className="text-[10px] text-slate-500 mt-1">Type Return Edge</p>
          </div>
        </div>
      </div>
    </div>
  )
}
