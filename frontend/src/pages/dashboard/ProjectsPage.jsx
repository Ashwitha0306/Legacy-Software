import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Plus, Search, RefreshCw, FolderOpen,
  SlidersHorizontal, AlertCircle
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useProjectsStore } from '@/store/projectsStore'
import ProjectCard from '@/components/projects/ProjectCard'
import UploadModal from '@/components/projects/UploadModal'

const STATUS_FILTERS = [
  { label: 'All',        value: '' },
  { label: 'Completed',  value: 'completed' },
  { label: 'Analyzing',  value: 'analyzing' },
  { label: 'Uploaded',   value: 'uploaded' },
  { label: 'Error',      value: 'error' },
]

export default function ProjectsPage() {
  const { projects, pagination, isLoading, error, fetchProjects, deleteProject } = useProjectsStore()
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    fetchProjects({ status: statusFilter || undefined })
  }, [statusFilter])

  // Real-time status polling for live status changes
  useEffect(() => {
    const hasPending = projects.some(p => p.status === 'analyzing' || p.status === 'uploaded')
    if (!hasPending) return

    const interval = setInterval(() => {
      fetchProjects({ status: statusFilter || undefined })
    }, 3000)

    return () => clearInterval(interval)
  }, [projects, statusFilter])

  const handleProjectSuccess = (project) => {
    toast.success(`Project "${project.name}" created! Analysis pipeline started.`)
    fetchProjects({ status: statusFilter || undefined })
  }

  const handleDelete = async (id) => {
    const project = projects.find((p) => p._id === id)
    if (!window.confirm(`Delete "${project?.name}"? This cannot be undone.`)) return

    const result = await deleteProject(id)
    if (result.success) {
      toast.success('Project deleted')
    } else {
      toast.error(result.message || 'Delete failed')
    }
  }

  // Client-side search filter
  const filtered = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="animate-fade-in space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {pagination.total} project{pagination.total !== 1 ? 's' : ''} · Upload any legacy codebase for AI-powered analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchProjects({ status: statusFilter || undefined })}
            disabled={isLoading}
            className="btn-secondary"
            aria-label="Refresh projects"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setIsUploadOpen(true)}
            id="new-project-btn"
            className="btn-primary"
          >
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="input pl-10"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <div className="flex gap-1">
            {STATUS_FILTERS.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === value
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-navy-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && projects.length === 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="h-4 bg-navy-700 rounded mb-3 w-3/4" />
              <div className="h-3 bg-navy-800 rounded mb-4 w-1/2" />
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[...Array(3)].map((_, j) => (
                  <div key={j} className="h-8 bg-navy-800 rounded" />
                ))}
              </div>
              <div className="h-3 bg-navy-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-16 flex flex-col items-center justify-center text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-navy-800/80 border border-navy-700
                          flex items-center justify-center mb-5">
            <FolderOpen className="w-9 h-9 text-slate-600" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {search ? 'No matching projects' : 'No projects yet'}
          </h3>
          <p className="text-slate-500 text-sm max-w-xs mb-6">
            {search
              ? `No projects match "${search}"`
              : 'Upload a legacy codebase (any language) or provide a GitHub repository URL to get started.'}
          </p>
          {!search && (
            <button onClick={() => setIsUploadOpen(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Create your first project
            </button>
          )}
        </motion.div>
      )}

      {/* Projects grid */}
      {filtered.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((project, i) => (
            <motion.div
              key={project._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <ProjectCard project={project} onDelete={handleDelete} />
            </motion.div>
          ))}
        </div>
      )}

      {/* Pagination (if multiple pages) */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {[...Array(pagination.totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => fetchProjects({ page: i + 1, status: statusFilter || undefined })}
              className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                pagination.page === i + 1
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:bg-navy-800'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleProjectSuccess}
      />
    </div>
  )
}
