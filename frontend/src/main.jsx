import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: '#0f2040',
          color: '#fff',
          border: '1px solid rgba(30,58,110,0.6)',
          borderRadius: '0.75rem',
          fontSize: '0.875rem',
        },
        success: {
          iconTheme: { primary: '#22d3ee', secondary: '#0a1628' },
        },
        error: {
          iconTheme: { primary: '#ef4444', secondary: '#0a1628' },
        },
        duration: 4000,
      }}
    />
  </React.StrictMode>,
)
