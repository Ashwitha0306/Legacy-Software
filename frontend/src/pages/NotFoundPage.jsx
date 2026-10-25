import { Link } from 'react-router-dom'
import { Brain, Home } from 'lucide-react'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-hero-pattern flex items-center justify-center p-4">
      <div className="text-center">
        <Brain className="w-16 h-16 text-cyan-400/40 mx-auto mb-6" />
        <h1 className="text-7xl font-bold text-gradient-cyan mb-4">404</h1>
        <p className="text-xl text-white mb-2">Page not found</p>
        <p className="text-slate-500 mb-8">This route does not exist in the RAV pipeline.</p>
        <Link to="/dashboard" className="btn-primary">
          <Home className="w-4 h-4" /> Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
