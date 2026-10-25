/**
 * Axios API client
 *
 * Configures a shared Axios instance with:
 *   - Base URL pointing to the backend API gateway
 *   - withCredentials: true so httpOnly cookies are sent automatically
 *   - Response interceptor for 401 handling (auto-logout)
 */

import axios from 'axios'

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,  // Required for httpOnly cookie auth
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// ── Response interceptor ───────────────────────────────────────────────────────
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear persisted auth state on 401 (token expired or invalid)
      // Import dynamically to avoid circular imports
      import('@/store/authStore').then(({ useAuthStore }) => {
        const state = useAuthStore.getState()
        if (state.isAuthenticated) {
          state.logout()
        }
      })
    }
    return Promise.reject(error)
  }
)

export default apiClient
