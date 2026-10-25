import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  FolderOpen, GitBranch, MoreVertical, Clock,
  CheckCircle2, AlertCircle, Loader2, Activity, Trash2
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'

const STATUS_CONFIG = {
  uploaded:       { label: 'Uploaded',     icon: Clock,         color: 'text-slate-400',   bg: 'bg-slate-500/20' },
  preprocessing:  { label: 'Preprocessing',icon: Loader2,       color: 'text-cyan-400',    bg: 'bg-cyan-500/20',   spin: true },
  parsing:        { label: 'Parsing',      icon: Loader2,       color: 'text-violet-400',  bg: 'bg-violet-500/20', spin: true },
  building_graph: { label: 'Building Graph',icon: Loader2,      color: 'text-amber-400',   bg: 'bg-amber-500/20',  spin: true },
  analyzing:      { label: 'Analyzing',    icon: Activity,      color: 'text-blue-400',    bg: 'bg-blue-500/20' },
  completed:      { label: 'Completed',    icon: CheckCircle2,  color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  error:          { label: 'Error',        icon: AlertCircle,   color: 'text-red-400',     bg: 'bg-red-500/20' },
}

/**
 * ProjectCard — displays a single project in the projects grid.
 *
 * @param {{ project: object, onDelete: (id: string) => void }} props
 */
export default function ProjectCard({ project, onDelete }) {
  const navigate = useNavigate()
  const config = STATUS_CONFIG[project.status] || STATUS_CONFIG.uploaded
  const StatusIcon = config.icon

  const timeAgo = project.createdAt
    ? formatDistanceToNow(new Date(project.createdAt), { addSuffix: true })
    : ''

  const sourceIcon = project.snapshots?.[0]?.sourceType === 'github'
    ? <GitBranch className="w-3.5 h-3.5" />
    : <FolderOpen className="w-3.5 h-3.5" />

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-hover p-5 cursor-pointer group"
      onClick={() => navigate(`/dashboard/analysis/${project._id}`)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white text-sm truncate group-hover:text-cyan-400 transition-colors">
            {project.name}
          </h3>
          {project.description && (
            <p className="text-xs text-slate-500 mt-0.5 truncate">{project.description}</p>
          )}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(project._id) }}
          className="p-1.5 rounded-md text-slate-600 hover:text-red-400 hover:bg-red-500/10
                     opacity-0 group-hover:opacity-100 transition-all ml-2 flex-shrink-0"
          aria-label="Delete project"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Classes',   value: project.stats?.totalClasses   ?? '—' },
          { label: 'Methods',   value: project.stats?.totalMethods   ?? '—' },
          { label: 'Endpoints', value: project.stats?.totalEndpoints ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-base font-bold text-white">{value}</p>
            <p className="text-xs text-slate-600">{label}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-navy-700/50">
        {/* Source type & Tech stack */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            {sourceIcon}
            {project.snapshots?.[0]?.sourceType === 'github' ? 'GitHub' : 'ZIP'}
          </span>
          {(project.language || project.snapshots?.[0]?.language) && (project.language !== 'unknown' || project.snapshots?.[0]?.language !== 'unknown') && (
            <span className="badge-cyan text-[10px] uppercase font-mono px-1.5 py-0.5">
              {project.framework && project.framework !== 'unknown' ? project.framework : (project.language || project.snapshots?.[0]?.language)}
            </span>
          )}
          {project.snapshotCount === 2 && (
            <span className="badge-slate text-[10px]">2 snapshots</span>
          )}
        </div>

        {/* Status */}
        <div className={clsx('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs', config.bg)}>
          <StatusIcon className={clsx('w-3 h-3', config.color, config.spin && 'animate-spin')} />
          <span className={config.color}>{config.label}</span>
        </div>
      </div>

      {/* Time */}
      <p className="text-xs text-slate-600 mt-2">{timeAgo}</p>
    </motion.div>
  )
}
