/**
 * Auth Store (Zustand)
 *
 * Manages authentication state across the React app.
 * JWT is stored in an httpOnly cookie by the backend; the user object
 * is stored in memory (Zustand) and hydrated on app load via /api/auth/me.
 *
 * This store intentionally does NOT store the raw JWT — it only stores the
 * decoded user profile. Token transmission is handled automatically by the
 * browser's cookie mechanism.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { authApi } from '@/api/authApi'

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      /**
       * Register a new account and set authenticated state on success.
       */
      register: async (name, email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { user } = await authApi.register({ name, email, password })
          set({ user, isAuthenticated: true, isLoading: false })
          return { success: true }
        } catch (err) {
          const message = err.response?.data?.message || 'Registration failed'
          set({ isLoading: false, error: message })
          return { success: false, message }
        }
      },

      /**
       * Log in with email/password.
       */
      login: async (email, password) => {
        set({ isLoading: true, error: null })
        try {
          const { user } = await authApi.login({ email, password })
          set({ user, isAuthenticated: true, isLoading: false })
          return { success: true }
        } catch (err) {
          const message = err.response?.data?.message || 'Login failed'
          set({ isLoading: false, error: message })
          return { success: false, message }
        }
      },

      /**
       * Log out — clears local state and tells the backend to clear the cookie.
       */
      logout: async () => {
        try {
          await authApi.logout()
        } catch (_) {
          // Ignore API errors on logout; clear local state regardless
        }
        set({ user: null, isAuthenticated: false, error: null })
      },

      /**
       * Hydrate user from the server (called on app load).
       * If the cookie is expired/invalid, silently clears auth state.
       */
      hydrate: async () => {
        if (!get().isAuthenticated) return
        try {
          const { user } = await authApi.me()
          set({ user, isAuthenticated: true })
        } catch (_) {
          set({ user: null, isAuthenticated: false })
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'legacy-intel-auth',
      // Only persist user and isAuthenticated (not loading/error state)
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
