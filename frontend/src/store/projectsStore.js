/**
 * Projects Store (Zustand)
 *
 * Manages the list of projects and the upload flow.
 */

import { create } from 'zustand'
import { projectsApi } from '@/api/projectsApi'

export const useProjectsStore = create((set, get) => ({
  projects: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  isLoading: false,
  isUploading: false,
  uploadProgress: 0,
  error: null,

  fetchProjects: async (params = {}) => {
    set({ isLoading: true, error: null })
    try {
      const result = await projectsApi.list(params)
      set({
        projects: result.projects,
        pagination: result.pagination,
        isLoading: false,
      })
    } catch (err) {
      set({ isLoading: false, error: err.response?.data?.message || 'Failed to load projects' })
    }
  },

  uploadZip: async (file, meta = {}) => {
    set({ isUploading: true, uploadProgress: 0, error: null })
    try {
      const result = await projectsApi.uploadZip(file, meta, (pct) => {
        set({ uploadProgress: pct })
      })
      // Prepend new project to list
      set((s) => ({
        projects: [result.project, ...s.projects],
        isUploading: false,
        uploadProgress: 100,
      }))
      return { success: true, data: result }
    } catch (err) {
      const message = err.response?.data?.message || 'Upload failed'
      set({ isUploading: false, uploadProgress: 0, error: message })
      return { success: false, message }
    }
  },

  fromGitHub: async (params) => {
    set({ isUploading: true, uploadProgress: 0, error: null })
    try {
      const result = await projectsApi.fromGitHub(params)
      set((s) => ({
        projects: [result.project, ...s.projects],
        isUploading: false,
        uploadProgress: 100,
      }))
      return { success: true, data: result }
    } catch (err) {
      const message = err.response?.data?.message || 'Failed to add GitHub project'
      set({ isUploading: false, error: message })
      return { success: false, message }
    }
  },

  deleteProject: async (id) => {
    try {
      await projectsApi.delete(id)
      set((s) => ({ projects: s.projects.filter((p) => p._id !== id) }))
      return { success: true }
    } catch (err) {
      return { success: false, message: err.response?.data?.message || 'Delete failed' }
    }
  },

  resetUpload: () => set({ isUploading: false, uploadProgress: 0, error: null }),
}))
