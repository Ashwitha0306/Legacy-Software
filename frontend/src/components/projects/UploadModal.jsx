import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload, Github, X, FileArchive, Loader2, CheckCircle2,
  AlertCircle, ArrowRight, ChevronDown, FileText, Trash2
} from 'lucide-react'
import clsx from 'clsx'

/**
 * UploadModal — handles ZIP file upload, GitHub URL import, and supporting legacy documentation files.
 *
 * @param {{ isOpen: boolean, onClose: () => void, onSuccess: (project) => void }} props
 */
export default function UploadModal({ isOpen, onClose, onSuccess }) {
  const [tab, setTab] = useState('zip')         // 'zip' | 'github'
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState(null)
  const [githubUrl, setGithubUrl] = useState('')
  const [githubRef, setGithubRef] = useState('main')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [projectName, setProjectName] = useState('')

  // Supporting legacy documentation files state
  const [docsFiles, setDocsFiles] = useState([])

  const [status, setStatus] = useState('idle') // 'idle' | 'uploading' | 'success' | 'error'
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const fileInputRef = useRef(null)
  const docsInputRef = useRef(null)

  const reset = () => {
    setFile(null)
    setGithubUrl('')
    setGithubRef('main')
    setProjectName('')
    setDocsFiles([])
    setStatus('idle')
    setProgress(0)
    setErrorMsg('')
    setShowAdvanced(false)
  }

  const handleClose = () => {
    if (status === 'uploading') return
    reset()
    onClose()
  }

  // ── Drag & drop for codebase ZIP ────────────────────────────────────────────
  const onDrop = useCallback((e) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped && dropped.name.endsWith('.zip')) {
      setFile(dropped)
      setErrorMsg('')
    } else {
      setErrorMsg('Only .zip files are accepted for codebase upload')
    }
  }, [])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)

  const onFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) { setFile(selected); setErrorMsg('') }
  }

  // ── Handle Docs Selection ──────────────────────────────────────────────────
  const onDocsChange = (e) => {
    if (e.target.files) {
      const selectedList = Array.from(e.target.files)
      setDocsFiles((prev) => [...prev, ...selectedList])
    }
  }

  const removeDocFile = (index) => {
    setDocsFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Submit ZIP ─────────────────────────────────────────────────────────────
  const handleZipSubmit = async () => {
    if (!file) { setErrorMsg('Please select a codebase ZIP file'); return }
    setStatus('uploading')
    setProgress(0)

    const { projectsApi } = await import('@/api/projectsApi')
    try {
      const result = await projectsApi.uploadZip(
        file,
        { name: projectName || undefined, docsFiles },
        (pct) => setProgress(pct)
      )
      setStatus('success')
      setTimeout(() => { onSuccess(result.project); handleClose() }, 1200)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.response?.data?.message || err.message || 'Upload failed. Please try again.')
    }
  }

  // ── Submit GitHub ──────────────────────────────────────────────────────────
  const handleGitHubSubmit = async () => {
    if (!githubUrl.startsWith('https://github.com/')) {
      setErrorMsg('Enter a valid https://github.com/<owner>/<repo> URL')
      return
    }
    setStatus('uploading')

    const { projectsApi } = await import('@/api/projectsApi')
    try {
      const result = await projectsApi.fromGitHub({
        githubUrl: githubUrl.trim(),
        githubRef: githubRef.trim() || 'main',
        name: projectName || undefined,
        docsFiles,
      })
      setStatus('success')
      setTimeout(() => { onSuccess(result.project); handleClose() }, 1200)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to add repository. Please try again.')
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="w-full max-w-lg bg-navy-900 border border-navy-700/80 rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-navy-800">
                <div>
                  <h2 className="text-lg font-semibold text-white">New Project Analysis</h2>
                  <p className="text-sm text-slate-400 mt-0.5">Upload any legacy codebase — Java, Python, Node.js, Go, C#, Ruby, PHP, Rust &amp; more</p>
                </div>
                <button onClick={handleClose} disabled={status === 'uploading'} className="btn-ghost p-2">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-navy-800">
                {[
                  { id: 'zip',    label: 'Codebase ZIP', icon: FileArchive },
                  { id: 'github', label: 'GitHub URL',   icon: Github },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => { setTab(id); reset() }}
                    disabled={status === 'uploading'}
                    className={clsx(
                      'flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all',
                      tab === id
                        ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5'
                        : 'text-slate-400 hover:text-white'
                    )}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>

              <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                {/* ── ZIP tab ─────────────────────────────────────────────── */}
                {tab === 'zip' && (
                  <>
                    <div
                      onDrop={onDrop}
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onClick={() => fileInputRef.current?.click()}
                      className={clsx(
                        'relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all',
                        dragging
                          ? 'border-cyan-400 bg-cyan-500/10'
                          : file
                          ? 'border-emerald-500/50 bg-emerald-500/5'
                          : 'border-navy-600 hover:border-cyan-500/50 hover:bg-cyan-500/5'
                      )}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        className="hidden"
                        onChange={onFileChange}
                        id="zip-file-input"
                      />
                      {file ? (
                        <>
                          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                          <p className="text-white font-medium text-sm">{file.name}</p>
                          <p className="text-slate-500 text-xs mt-0.5">
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); setFile(null) }}
                            className="mt-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
                          >
                            Remove Codebase ZIP
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                          <p className="text-white text-sm font-medium">Drop your codebase ZIP here</p>
                          <p className="text-slate-500 text-xs mt-0.5">Java · Python · Node.js · Go · C# · Ruby · PHP · Rust · and more</p>
                          <p className="text-slate-600 text-xs mt-0.5">or click to browse · max 500MB</p>
                        </>
                      )}
                    </div>
                  </>
                )}

                {/* ── GitHub tab ───────────────────────────────────────────── */}
                {tab === 'github' && (
                  <>
                    <div>
                      <label htmlFor="github-url" className="input-label">Repository URL</label>
                      <div className="relative">
                        <Github className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                        <input
                          id="github-url"
                          type="url"
                          value={githubUrl}
                          onChange={(e) => { setGithubUrl(e.target.value); setErrorMsg('') }}
                          placeholder="https://github.com/owner/repository"
                          className="input pl-10"
                          disabled={status === 'uploading'}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => setShowAdvanced((v) => !v)}
                      className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform', showAdvanced && 'rotate-180')} />
                      Advanced options
                    </button>

                    {showAdvanced && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-3"
                      >
                        <div>
                          <label htmlFor="github-ref" className="input-label">Branch / Tag / Commit</label>
                          <input
                            id="github-ref"
                            type="text"
                            value={githubRef}
                            onChange={(e) => setGithubRef(e.target.value)}
                            placeholder="main"
                            className="input"
                            disabled={status === 'uploading'}
                          />
                        </div>
                      </motion.div>
                    )}
                  </>
                )}

                {/* ── Existing Legacy Documentation Files Upload Field ─────── */}
                <div className="p-4 rounded-xl bg-navy-950/80 border border-navy-800 space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-cyan-400 flex items-center gap-1.5 uppercase font-mono tracking-wider">
                      <FileText className="w-4 h-4 text-cyan-400" /> Existing Legacy Docs (Optional)
                    </label>
                    <span className="text-[11px] text-slate-500">PDF, DOCX, MD, OpenAPI specs</span>
                  </div>

                  <input
                    ref={docsInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.md,.txt,.json,.yaml,.yml"
                    className="hidden"
                    onChange={onDocsChange}
                  />

                  <button
                    type="button"
                    onClick={() => docsInputRef.current?.click()}
                    disabled={status === 'uploading'}
                    className="btn-secondary w-full text-xs py-2 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5 text-cyan-400" /> Add Legacy Documentation Files
                  </button>

                  {docsFiles.length > 0 && (
                    <div className="space-y-1.5 pt-2 max-h-32 overflow-y-auto">
                      {docsFiles.map((df, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded bg-navy-900 border border-navy-700/60 text-xs">
                          <span className="text-slate-300 truncate max-w-[240px] font-mono">{df.name}</span>
                          <button
                            type="button"
                            onClick={() => removeDocFile(idx)}
                            className="text-slate-500 hover:text-red-400 transition-colors p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Optional project name */}
                <div>
                  <label htmlFor="project-name" className="input-label">
                    Project name <span className="text-slate-600">(optional)</span>
                  </label>
                  <input
                    id="project-name"
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Auto-detected from filename / repo name"
                    className="input"
                    disabled={status === 'uploading'}
                    maxLength={200}
                  />
                </div>

                {/* Error */}
                {errorMsg && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {errorMsg}
                  </div>
                )}

                {/* Upload progress */}
                {status === 'uploading' && tab === 'zip' && (
                  <div>
                    <div className="confidence-bar">
                      <div
                        className="confidence-fill bg-cyan-400"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 text-right">{progress}%</p>
                  </div>
                )}

                {/* Submit */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleClose}
                    disabled={status === 'uploading'}
                    className="btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={tab === 'zip' ? handleZipSubmit : handleGitHubSubmit}
                    disabled={status === 'uploading' || status === 'success'}
                    id="upload-submit-btn"
                    className="btn-primary flex-1"
                  >
                    {status === 'uploading' ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />
                        {tab === 'github' ? 'Cloning...' : 'Uploading...'}</>
                    ) : status === 'success' ? (
                      <><CheckCircle2 className="w-4 h-4" /> Done!</>
                    ) : (
                      <>{tab === 'github' ? 'Import & Analyze' : 'Upload & Analyze'}
                        <ArrowRight className="w-4 h-4" /></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
