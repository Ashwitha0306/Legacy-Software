/**
 * Analysis API client
 */

import apiClient from './client'

export const analysisApi = {
  triggerRun: async (projectId, { ablationMode = 'full_rav', userQuery, targetNodeId } = {}) => {
    const { data } = await apiClient.post(`/analysis/${projectId}/trigger`, {
      ablationMode, userQuery, targetNodeId,
    })
    return data.data
  },

  getRuns: async (projectId) => {
    const { data } = await apiClient.get(`/analysis/${projectId}/runs`)
    return data.data
  },

  getRunDetails: async (runId) => {
    const { data } = await apiClient.get(`/analysis/runs/${runId}`)
    return data.data
  },

  getRunStatus: async (runId) => {
    const { data } = await apiClient.get(`/analysis/runs/${runId}/status`)
    return data.data
  },

  sendConversationalQuery: async (projectId, query, { apiKey, provider, chatHistory } = {}) => {
    const { data } = await apiClient.post(`/analysis/${projectId}/query`, {
      query,
      apiKey,
      provider,
      chatHistory: chatHistory || [],
    })
    return data.data
  },

  submitDeveloperFeedback: async (projectId, { statementId, feedbackType, originalContent, correctionText }) => {
    const { data } = await apiClient.post(`/analysis/${projectId}/feedback`, {
      statementId, feedbackType, originalContent, correctionText,
    })
    return data.data
  },

  getDeveloperMemories: async (projectId) => {
    const { data } = await apiClient.get(`/analysis/${projectId}/feedback`)
    return data.data
  },

  getArchitectureHealth: async (projectId) => {
    const { data } = await apiClient.post(`/analysis/${projectId}/health`)
    return data.data
  },

  runImpactAnalysis: async (projectId, { targetNodeId } = {}) => {
    const { data } = await apiClient.post(`/analysis/${projectId}/impact`, { targetNodeId })
    return data.data
  },

  runArchDrift: async (projectId, { runId1, runId2 } = {}) => {
    const { data } = await apiClient.post(`/analysis/${projectId}/drift/arch`, { runId1, runId2 })
    return data.data
  },

  runDocDrift: async (projectId, { runId1, runId2, changedFiles } = {}) => {
    const { data } = await apiClient.post(`/analysis/${projectId}/drift/doc`, { runId1, runId2, changedFiles })
    return data.data
  },

  runRefactoringSimulation: async (projectId, { proposedAction, targetClassName } = {}) => {
    const { data } = await apiClient.post(`/analysis/${projectId}/refactoring`, { proposedAction, targetClassName })
    return data.data
  },
}
