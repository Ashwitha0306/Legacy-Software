import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (theme === 'light') {
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
  if (saved) {
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
        if (state?.theme) {
          applyTheme(state.theme)
        }
      },
    }
  )
)

