import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Checks whether the current window location is an authentication page
 * (Login or Registration). Auth pages MUST ALWAYS remain in pure dark theme.
 */
export function isAuthRoute() {
  if (typeof window === 'undefined') return false
  const path = window.location.pathname.toLowerCase()
  return (
    path === '/login' ||
    path === '/register' ||
    path.startsWith('/login') ||
    path.startsWith('/register')
  )
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  // Auth pages (login & registration) MUST ALWAYS remain in dark theme
  const forceDark = isAuthRoute()
  const effectiveTheme = forceDark ? 'dark' : (theme || 'dark')

  if (effectiveTheme === 'light') {
    root.classList.remove('dark')
    root.classList.add('light')
    root.setAttribute('data-theme', 'light')
  } else {
    root.classList.remove('light')
    root.classList.add('dark')
    root.setAttribute('data-theme', 'dark')
  }
}

// Apply saved theme immediately on script execution to prevent FOUC
try {
  const saved = localStorage.getItem('anchorai_theme')
  if (saved && !isAuthRoute()) {
    const parsed = JSON.parse(saved)
    if (parsed?.state?.theme) {
      applyTheme(parsed.state.theme)
    }
  } else {
    applyTheme('dark')
  }
} catch {
  applyTheme('dark')
}

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark', // 'dark' | 'light'
      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark'
        set({ theme: next })
        applyTheme(next)
      },
      setTheme: (theme) => {
        set({ theme })
        applyTheme(theme)
      },
    }),
    {
      name: 'anchorai_theme',
      onRehydrateStorage: () => (state) => {
        if (state?.theme && !isAuthRoute()) {
          applyTheme(state.theme)
        } else {
          applyTheme('dark')
        }
      },
    }
  )
)
