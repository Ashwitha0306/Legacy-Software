/**
 * Analysis Routes
 *
 * POST /api/analysis/:projectId/trigger   — trigger new pipeline run (supports ablationMode & query)
 * POST /api/analysis/:projectId/query     — Conversational Query Agent Q&A on demand
 * POST /api/analysis/:projectId/feedback  — store developer feedback in memory agent
 * GET  /api/analysis/:projectId/runs      — list runs
 * GET  /api/analysis/runs/:runId          — get full run details
 * GET  /api/analysis/runs/:runId/status   — poll run status
 */

'use strict';

const express = require('express');
const axios = require('axios');
const { authenticate } = require('../middleware/auth');
const AnalysisRun = require('../models/AnalysisRun');
const Project = require('../models/Project');
const DeveloperMemory = require('../models/DeveloperMemory');
const logger = require('../config/logger');

const router = express.Router();
router.use(authenticate);

/**
 * POST /api/analysis/:projectId/trigger
 */
router.post('/:projectId/trigger', async (req, res) => {
  const { ablationMode = 'full_rav', userQuery, targetNodeId } = req.body;

  const project = await Project.findOne({ _id: req.params.projectId, userId: req.user._id });
  if (!project) {
    return res.status(404).json({ success: false, message: 'Project not found' });
  }

  const snapshot = project.snapshots[0];
  if (!snapshot) {
    return res.status(400).json({ success: false, message: 'Project has no uploaded snapshot' });
  }

  const run = new AnalysisRun({
    projectId: project._id,
    userId: req.user._id,
    snapshotLabel: snapshot.label,
    ablationMode,
    userQuery,
    status: 'queued',
  });
  await run.save();

  await Project.findByIdAndUpdate(project._id, {
    $push: { analysisRunIds: run._id },
    status: 'preprocessing',
  });

  setImmediate(async () => {
    try {
      const payload = {
        project_id: project._id.toString(),
        run_id: run._id.toString(),
        extracted_path: snapshot.extractedPath,
        ablation_mode: ablationMode,
        user_query: userQuery,
        target_node_id: targetNodeId,
        source_type: snapshot.sourceType,
        github_url: snapshot.githubUrl || null,
        github_ref: snapshot.githubRef || 'main',
        project_name: project.name,
      };

      const analysisUrl = `${process.env.ANALYSIS_SERVICE_URL}/pipeline/run`;
      await axios.post(analysisUrl, payload, {
        timeout: 30 * 60 * 1000,
        headers: { 'X-Internal-Secret': process.env.ANALYSIS_SERVICE_SECRET },
      });
    } catch (err) {
      logger.error('Failed to trigger analysis run', { runId: run._id, error: err.message });
      await AnalysisRun.findByIdAndUpdate(run._id, {
        status: 'failed',
        errorMessage: err.message,
        completedAt: new Date(),
      });
      await Project.findByIdAndUpdate(project._id, { status: 'error', errorMessage: err.message });
    }
  });

  res.status(202).json({
    success: true,
    message: 'Analysis pipeline triggered',
    data: { runId: run._id, ablationMode },
  });
});

/**
 * POST /api/analysis/:projectId/query
 * Conversational Query Agent on demand
 */
router.post('/:projectId/query', async (req, res) => {
  const { query, apiKey, provider, chatHistory } = req.body;
  if (!query) {
    return res.status(400).json({ success: false, message: 'Query string is required' });
  }

  try {
    const project = await Project.findOne({ _id: req.params.projectId, userId: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const latestRun = await AnalysisRun.findOne({ projectId: req.params.projectId, status: 'completed' })
      .sort({ completedAt: -1 });

    // SSKG graph nodes/edges (from graph construction agent)
    const nodes = latestRun?.graphConstruction?.output?.nodes || latestRun?.graphConstruction?.data?.nodes || latestRun?.graphConstruction?.nodes || [];
    const edges = latestRun?.graphConstruction?.output?.edges || latestRun?.graphConstruction?.data?.edges || latestRun?.graphConstruction?.edges || [];

    // Parsed AST classes — gives Agent 10 real method/field/annotation data
    const classes = latestRun?.parsing?.output?.classes || latestRun?.parsing?.data?.classes || latestRun?.parsing?.classes || [];

    // Source file list from preprocessing output
    const sourceFiles = latestRun?.preprocessing?.output?.source_files || latestRun?.preprocessing?.data?.source_files || [];

    // Language / framework resolved from run preprocessing or project record
    const language = latestRun?.preprocessing?.output?.language || project.language || 'javascript';
    const framework = latestRun?.preprocessing?.output?.framework || project.framework || 'express';
    const techStack = latestRun?.preprocessing?.output?.tech_stack || project.techStack || `${language}-${framework}`;

    // Legacy documentation passages
    const legacyPassages = latestRun?.legacyDoc?.output?.passages || latestRun?.legacyDoc?.data?.passages || [];

    // Trim classes to lightweight metadata only — full method snippets can be
    // many MB and will cause ECONNRESET / body-size errors in the analysis service.
    const trimmedClasses = classes.slice(0, 150).map(cls => ({
      class_name:    cls.class_name,
      qualified_name: cls.qualified_name,
      file_path:     cls.file_path,
      language:      cls.language,
      annotations:   cls.annotations || [],
      fields:  (cls.fields  || []).slice(0, 20).map(f => ({ field_name: f.field_name, field_type: f.field_type })),
      methods: (cls.methods || []).slice(0, 20).map(m => ({
        method_name:   m.method_name,
        is_endpoint:   m.is_endpoint,
        http_method:   m.http_method,
        endpoint_path: m.endpoint_path,
        start_line:    m.start_line,
      })),
    }))

    const analysisUrl = `${process.env.ANALYSIS_SERVICE_URL}/agents/query`;
    const response = await axios.post(analysisUrl, {
      project_id:       req.params.projectId,
      query,
      api_key:          apiKey || null,
      provider:         provider || null,
      chat_history:     chatHistory || [],
      nodes:            (nodes  || []).slice(0, 200),
      edges:            (edges  || []).slice(0, 400),
      classes:          trimmedClasses,
      source_files:     (sourceFiles || []).slice(0, 300),
      legacy_passages:  (legacyPassages || []).slice(0, 20),
      project_name:     project.name,
      language,
      framework,
      tech_stack:       techStack,
      stats:            project.stats,
    }, {
      timeout: 90000,   // 90 s — gives LLM time to respond without hanging forever
      maxContentLength: Infinity,
      maxBodyLength:    Infinity,
    });


    res.status(200).json({
      success: true,
      data: response.data?.data?.data || response.data?.data || response.data,
    });
  } catch (err) {
    logger.error('Conversational Query Agent error', { projectId: req.params.projectId, error: err.message });
    res.status(500).json({ success: false, message: 'Failed to process query: ' + err.message });
  }
});

/**
 * POST /api/analysis/:projectId/health
 * Compute Architecture Health Score on demand
 */
router.post('/:projectId/health', async (req, res) => {
  try {
    const project = await Project.findOne({ _id: req.params.projectId, userId: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const latestRun = await AnalysisRun.findOne({ projectId: req.params.projectId, status: 'completed' })
      .sort({ completedAt: -1 });

    const nodes = latestRun?.graphConstruction?.output?.nodes || [];
    const edges = latestRun?.graphConstruction?.output?.edges || [];
    const parseData = latestRun?.parsing?.output || {};
    const verificationData = latestRun?.verification?.output || {};

    const analysisUrl = `${process.env.ANALYSIS_SERVICE_URL}/agents/health`;
    const response = await axios.post(analysisUrl, {
      project_id: req.params.projectId,
      parse_data: parseData,
      verification_data: verificationData,
      nodes,
      edges,
    });

    res.status(200).json({
      success: true,
      data: response.data?.data?.data || response.data?.data || response.data,
    });
  } catch (err) {
    logger.error('Health Agent error', { projectId: req.params.projectId, error: err.message });
    res.status(500).json({ success: false, message: 'Failed to compute health score: ' + err.message });
  }
});

/**
 * POST /api/analysis/:projectId/impact
 * Run Impact Analysis / Blast Radius Simulation
 */
router.post('/:projectId/impact', async (req, res) => {
  const { targetNodeId } = req.body;

  try {
    const project = await Project.findOne({ _id: req.params.projectId, userId: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const latestRun = await AnalysisRun.findOne({ projectId: req.params.projectId, status: 'completed' })
      .sort({ completedAt: -1 });

    const nodes = latestRun?.graphConstruction?.output?.nodes || [];
    const edges = latestRun?.graphConstruction?.output?.edges || [];

    const analysisUrl = `${process.env.ANALYSIS_SERVICE_URL}/agents/impact`;
    const response = await axios.post(analysisUrl, {
      project_id: req.params.projectId,
      target_node_id: targetNodeId,
      nodes,
      edges,
    });

    res.status(200).json({
      success: true,
      data: response.data?.data?.data || response.data?.data || response.data,
    });
  } catch (err) {
    logger.error('Impact Analysis Agent error', { projectId: req.params.projectId, error: err.message });
    res.status(500).json({ success: false, message: 'Failed to run impact analysis: ' + err.message });
  }
});

/**
 * POST /api/analysis/:projectId/drift/arch
 * Run Architecture Drift Agent across snapshots
 */
router.post('/:projectId/drift/arch', async (req, res) => {
  const { runId1, runId2 } = req.body;

  try {
    const project = await Project.findOne({ _id: req.params.projectId, userId: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const runs = await AnalysisRun.find({ projectId: req.params.projectId, status: 'completed' })
      .sort({ createdAt: 1 });

    const r1 = runId1 ? await AnalysisRun.findById(runId1) : runs[0];
    const r2 = runId2 ? await AnalysisRun.findById(runId2) : (runs[1] || runs[0]);

    const s1Nodes = r1?.graphConstruction?.output?.nodes || [];
    const s1Edges = r1?.graphConstruction?.output?.edges || [];
    const s2Nodes = r2?.graphConstruction?.output?.nodes || [];
    const s2Edges = r2?.graphConstruction?.output?.edges || [];

    const analysisUrl = `${process.env.ANALYSIS_SERVICE_URL}/agents/arch-drift`;
    const response = await axios.post(analysisUrl, {
      project_id: req.params.projectId,
      snapshot1_nodes: s1Nodes,
      snapshot1_edges: s1Edges,
      snapshot2_nodes: s2Nodes,
      snapshot2_edges: s2Edges,
    });

    res.status(200).json({
      success: true,
      data: response.data?.data?.data || response.data?.data || response.data,
    });
  } catch (err) {
    logger.error('Architecture Drift error', { projectId: req.params.projectId, error: err.message });
    res.status(500).json({ success: false, message: 'Failed to compute architecture drift: ' + err.message });
  }
});

/**
 * POST /api/analysis/:projectId/drift/doc
 * Run Documentation Drift Agent across snapshots
 */
router.post('/:projectId/drift/doc', async (req, res) => {
  const { runId1, runId2, changedFiles } = req.body;

  try {
    const project = await Project.findOne({ _id: req.params.projectId, userId: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const runs = await AnalysisRun.find({ projectId: req.params.projectId, status: 'completed' })
      .sort({ createdAt: 1 });

    const r1 = runId1 ? await AnalysisRun.findById(runId1) : runs[0];
    const r2 = runId2 ? await AnalysisRun.findById(runId2) : (runs[1] || runs[0]);

    const s1Statements = r1?.verification?.output?.verified_statements || r1?.reconstruction?.output?.statements || [];
    const s2Statements = r2?.verification?.output?.verified_statements || r2?.reconstruction?.output?.statements || [];

    const analysisUrl = `${process.env.ANALYSIS_SERVICE_URL}/agents/doc-drift`;
    const response = await axios.post(analysisUrl, {
      project_id: req.params.projectId,
      snapshot1_statements: s1Statements,
      snapshot2_statements: s2Statements,
      changed_files: changedFiles || [],
    });

    res.status(200).json({
      success: true,
      data: response.data?.data?.data || response.data?.data || response.data,
    });
  } catch (err) {
    logger.error('Documentation Drift error', { projectId: req.params.projectId, error: err.message });
    res.status(500).json({ success: false, message: 'Failed to compute documentation drift: ' + err.message });
  }
});

/**
 * POST /api/analysis/:projectId/refactoring
 * Run Refactoring Simulation Agent
 */
router.post('/:projectId/refactoring', async (req, res) => {
  const { proposedAction = 'extract_service', targetClassName = 'UserService' } = req.body;

  try {
    const project = await Project.findOne({ _id: req.params.projectId, userId: req.user._id });
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const latestRun = await AnalysisRun.findOne({ projectId: req.params.projectId, status: 'completed' })
      .sort({ completedAt: -1 });

    const nodes = latestRun?.graphConstruction?.output?.nodes || [];
    const edges = latestRun?.graphConstruction?.output?.edges || [];

    const analysisUrl = `${process.env.ANALYSIS_SERVICE_URL}/agents/refactoring`;
    const response = await axios.post(analysisUrl, {
      project_id: req.params.projectId,
      proposed_action: proposedAction,
      target_class_name: targetClassName,
      nodes,
      edges,
    });

    res.status(200).json({
      success: true,
      data: response.data?.data?.data || response.data?.data || response.data,
    });
  } catch (err) {
    logger.error('Refactoring Simulation error', { projectId: req.params.projectId, error: err.message });
    res.status(500).json({ success: false, message: 'Failed to simulate refactoring: ' + err.message });
  }
});

/**
 * POST /api/analysis/:projectId/feedback
 * Store developer feedback / corrections in MongoDB and analysis service
 */
router.post('/:projectId/feedback', async (req, res) => {
  const { statementId, feedbackType, originalContent, correctionText } = req.body;

  try {
    const memory = new DeveloperMemory({
      projectId: req.params.projectId,
      userId: req.user._id,
      statementId,
      feedbackType,
      originalContent,
      correctionText: correctionText || '',
    });
    await memory.save();

    // Also forward to analysis service memory agent
    try {
      const analysisUrl = `${process.env.ANALYSIS_SERVICE_URL}/agents/memory/store`;
      await axios.post(analysisUrl, {
        project_id: req.params.projectId,
        user_id: req.user._id.toString(),
        statement_id: statementId,
        feedback_type: feedbackType,
        original_content: originalContent,
        correction_text: correctionText || '',
      });
    } catch (_) {
      // Memory saved in Mongo, ignore if python microservice offline
    }

    res.status(200).json({
      success: true,
      message: 'Developer memory feedback recorded successfully',
      data: memory,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to record feedback: ' + err.message });
  }
});

/**
 * GET /api/analysis/:projectId/feedback
 * Retrieve stored developer memories for a project
 */
router.get('/:projectId/feedback', async (req, res) => {
  try {
    const memories = await DeveloperMemory.find({ projectId: req.params.projectId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: { memories },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to retrieve feedback memories' });
  }
});

/**
 * GET /api/analysis/:projectId/runs
 */
router.get('/:projectId/runs', async (req, res) => {
  const project = await Project.findOne({ _id: req.params.projectId, userId: req.user._id });
  if (!project) {
    return res.status(404).json({ success: false, message: 'Project not found' });
  }

  const runs = await AnalysisRun.find({ projectId: req.params.projectId })
    .sort({ createdAt: -1 })
    .select('status ablationMode snapshotLabel userQuery startedAt completedAt durationMs metrics createdAt');

  res.status(200).json({ success: true, data: { runs } });
});

/**
 * GET /api/analysis/runs/:runId
 */
router.get('/runs/:runId', async (req, res) => {
  const run = await AnalysisRun.findOne({ _id: req.params.runId, userId: req.user._id });
  if (!run) {
    return res.status(404).json({ success: false, message: 'Analysis run not found' });
  }
  res.status(200).json({ success: true, data: { run } });
});

/**
 * GET /api/analysis/runs/:runId/status
 */
router.get('/runs/:runId/status', async (req, res) => {
  const run = await AnalysisRun.findOne(
    { _id: req.params.runId, userId: req.user._id },
    'status ablationMode startedAt completedAt durationMs errorMessage preprocessing parsing graphConstruction diagrams legacyDoc retrieval reconstruction verification conversationalQuery evaluation'
  );
  if (!run) {
    return res.status(404).json({ success: false, message: 'Analysis run not found' });
  }

  const stages = {
    preprocessing:       run.preprocessing?.status,
    parsing:             run.parsing?.status,
    graphConstruction:   run.graphConstruction?.status,
    diagrams:            run.diagrams?.status,
    legacyDoc:           run.legacyDoc?.status,
    retrieval:           run.retrieval?.status,
    reconstruction:      run.reconstruction?.status,
    verification:        run.verification?.status,
    conversationalQuery: run.conversationalQuery?.status,
    evaluation:          run.evaluation?.status,
  };

  res.status(200).json({
    success: true,
    data: {
      runId: run._id,
      status: run.status,
      ablationMode: run.ablationMode,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      durationMs: run.durationMs,
      stages,
      errorMessage: run.errorMessage,
    },
  });
});

module.exports = router;
