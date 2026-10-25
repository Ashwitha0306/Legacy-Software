/**
 * Projects API — calls to /api/projects/* endpoints.
 */

import apiClient from './client'

export const projectsApi = {
  /**
   * List all projects (paginated).
   */
  list: async ({ page = 1, limit = 20, status } = {}) => {
    const params = { page, limit, ...(status && { status }) }
    const { data } = await apiClient.get('/projects', { params })
    return data.data
  },

  /**
   * Get a single project with its latest run.
   */
  get: async (id) => {
    const { data } = await apiClient.get(`/projects/${id}`)
    return data.data
  },

  /**
   * Upload a ZIP file with optional supporting documentation files. Sends multipart/form-data.
   * @param {File} file
   * @param {{ name?: string, description?: string, docsFiles?: File[] }} meta
   * @param {function} onProgress — (percent: number) => void
   */
  uploadZip: async (file, meta = {}, onProgress) => {
    const formData = new FormData()
    formData.append('file', file)
    if (meta.name) formData.append('name', meta.name)
    if (meta.description) formData.append('description', meta.description)
    if (meta.docsFiles && meta.docsFiles.length > 0) {
      meta.docsFiles.forEach((docFile) => {
        formData.append('docs', docFile)
      })
    }

    const { data } = await apiClient.post('/projects/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 10 * 60 * 1000, // 10 minutes timeout for large ZIP files (e.g. 100MB+)
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded * 100) / e.total))
        }
      },
    })
    return data.data
  },

  /**
   * Ingest a GitHub repository URL with optional supporting documentation files.
   */
  fromGitHub: async ({ githubUrl, githubRef = 'main', name, description, docsFiles = [] } = {}) => {
    if (docsFiles && docsFiles.length > 0) {
      const formData = new FormData()
      formData.append('githubUrl', githubUrl)
      formData.append('githubRef', githubRef)
      if (name) formData.append('name', name)
      if (description) formData.append('description', description)
      docsFiles.forEach((docFile) => {
        formData.append('docs', docFile)
      })

      const { data } = await apiClient.post('/projects/from-github', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 10 * 60 * 1000,
      })
      return data.data
    }

    const { data } = await apiClient.post('/projects/from-github', {
      githubUrl, githubRef, name, description,
    }, { timeout: 10 * 60 * 1000 })
    return data.data
  },

  /**
   * Add a second snapshot to an existing project (for drift analysis).
   */
  addSnapshot: async (projectId, { sourceType, file, githubUrl, githubRef, docsFiles = [] } = {}) => {
    if (sourceType === 'zip') {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sourceType', 'zip')
      if (docsFiles && docsFiles.length > 0) {
        docsFiles.forEach((docFile) => formData.append('docs', docFile))
      }
      const { data } = await apiClient.post(`/projects/${projectId}/snapshot`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 10 * 60 * 1000,
      })
      return data.data
    }
    const { data } = await apiClient.post(`/projects/${projectId}/snapshot`, {
      sourceType: 'github', githubUrl, githubRef,
    }, { timeout: 10 * 60 * 1000 })
    return data.data
  },

  /**
   * Delete a project.
   */
  delete: async (id) => {
    const { data } = await apiClient.delete(`/projects/${id}`)
    return data
  },

  /**
   * List analysis runs for a project.
   */
  getRuns: async (projectId) => {
    const { data } = await apiClient.get(`/analysis/${projectId}/runs`)
    return data.data
  },
}
