/**
 * Auth API — calls to /api/auth/* endpoints.
 */

import apiClient from './client'

export const authApi = {
  register: async ({ name, email, password }) => {
    const { data } = await apiClient.post('/auth/register', { name, email, password })
    return data.data
  },

  login: async ({ email, password }) => {
    const { data } = await apiClient.post('/auth/login', { email, password })
    return data.data
  },

  logout: async () => {
    await apiClient.post('/auth/logout')
  },

  me: async () => {
    const { data } = await apiClient.get('/auth/me')
    return data.data
  },

  updatePreferences: async (preferences) => {
    const { data } = await apiClient.patch('/auth/preferences', preferences)
    return data.data
  },
}
