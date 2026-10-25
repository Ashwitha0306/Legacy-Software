/**
 * Projects Routes — Full Implementation with Legacy Documentation File Ingestion
 *
 * GET    /api/projects                        — list user's projects (paginated)
 * GET    /api/projects/:id                    — get project details
 * DELETE /api/projects/:id                    — delete project + files + runs
 * POST   /api/projects/upload                 — upload ZIP file + optional legacy docs (PDF/DOCX/MD/TXT/OpenAPI)
 * POST   /api/projects/from-github            — ingest GitHub repository URL + optional legacy docs
 * POST   /api/projects/:id/snapshot           — add snapshot2 (ZIP or GitHub URL)
 * GET    /api/projects/:id/runs               — list analysis runs for a project
 */

'use strict';

const express = require('express');
const { body, query } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const upload = require('../config/upload');
const Project = require('../models/Project');
const AnalysisRun = require('../models/AnalysisRun');
const {
  createProjectFromZip,
  createProjectFromGitHub,
  deleteProject,
} = require('../services/projectService');
const logger = require('../config/logger');

const router = express.Router();
router.use(authenticate);

// ── Validation rules ──────────────────────────────────────────────────────────

const githubUploadRules = [
  body('githubUrl')
    .trim()
    .notEmpty().withMessage('GitHub URL is required')
    .matches(/^https:\/\/github\.com\/[^/]+\/[^/]+/)
    .withMessage('Must be a valid https://github.com/<owner>/<repo> URL'),
  body('githubRef')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('githubRef must be 1–100 characters'),
  body('name')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('name must not exceed 200 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 }),
];

const snapshotRules = [
  body('sourceType')
    .isIn(['zip', 'github'])
    .withMessage('sourceType must be zip or github'),
  body('githubUrl').optional().trim(),
  body('githubRef').optional().trim(),
];

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * GET /api/projects
 */
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('status').optional().isString(),
  ],
  validate,
  async (req, res) => {
    const page  = parseInt(req.query.page  || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const skip  = (page - 1) * limit;

    const filter = { userId: req.user._id };
    if (req.query.status) filter.status = req.query.status;

    const [rawProjects, total] = await Promise.all([
      Project.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('-snapshots.extractedPath -snapshots.zipPath'),
      Project.countDocuments(filter),
    ]);

    // Attach latest analysis run metrics dynamically if not already denormalized
    const projectIds = rawProjects.map(p => p._id);
    const latestRuns = await AnalysisRun.find({
      projectId: { $in: projectIds },
      status: 'completed',
    }).sort({ createdAt: -1 });

    const runsByProject = new Map();
    for (const r of latestRuns) {
      const pid = r.projectId.toString();
      if (!runsByProject.has(pid)) {
        runsByProject.set(pid, r);
      }
    }

    const projects = rawProjects.map(p => {
      const pObj = p.toObject ? p.toObject() : { ...p };
      const run = runsByProject.get(p._id.toString());
      if (run && run.metrics) {
        if (!pObj.metrics) pObj.metrics = run.metrics;
        if (!pObj.stats) pObj.stats = {};
        if (pObj.stats.citationAccuracy === undefined && run.metrics.evidence_citation_accuracy !== undefined) {
          pObj.stats.citationAccuracy = run.metrics.evidence_citation_accuracy;
        }
      }
      return pObj;
    });

    res.status(200).json({
      success: true,
      data: {
        projects,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  }
);

/**
 * GET /api/projects/:id
 */
router.get('/:id', async (req, res) => {
  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

  const latestRun = await AnalysisRun.findOne(
    { projectId: project._id },
    'status ablationMode metrics createdAt',
  ).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    data: { project, latestRun: latestRun || null },
  });
});

/**
 * DELETE /api/projects/:id
 */
router.delete('/:id', async (req, res) => {
  await deleteProject(req.params.id, req.user._id.toString());
  res.status(200).json({ success: true, message: 'Project deleted successfully' });
});

/**
 * POST /api/projects/upload
 * Upload a Spring Boot ZIP file + optional legacy documentation files.
 */
router.post(
  '/upload',
  upload.fields([{ name: 'file', maxCount: 1 }, { name: 'docs', maxCount: 10 }]),
  async (req, res) => {
    const zipFile = req.files?.file?.[0];
    const docFiles = req.files?.docs || [];

    if (!zipFile) {
      return res.status(400).json({
        success: false,
        message: 'No codebase ZIP file uploaded. Include a .zip file in the "file" form field.',
      });
    }

    const { name, description } = req.body;

    const { project, analysisRunId } = await createProjectFromZip({
      userId: req.user._id,
      file: zipFile,
      docFiles,
      name: name?.trim(),
      description: description?.trim(),
      snapshotLabel: 'snapshot1',
    });

    res.status(201).json({
      success: true,
      message: 'Project uploaded. Analysis pipeline started.',
      data: {
        project,
        analysisRunId,
      },
    });
  }
);

/**
 * POST /api/projects/from-github
 * Ingest a GitHub repository URL + optional legacy documentation files.
 */
router.post(
  '/from-github',
  upload.fields([{ name: 'docs', maxCount: 10 }]),
  githubUploadRules,
  validate,
  async (req, res) => {
    const docFiles = req.files?.docs || [];
    const { githubUrl, githubRef = 'main', name, description } = req.body;

    const { project, analysisRunId } = await createProjectFromGitHub({
      userId: req.user._id,
      githubUrl: githubUrl.trim(),
      githubRef: githubRef.trim(),
      docFiles,
      name: name?.trim(),
      description: description?.trim(),
      snapshotLabel: 'snapshot1',
    });

    res.status(201).json({
      success: true,
      message: 'GitHub repository queued. Analysis pipeline started.',
      data: {
        project,
        analysisRunId,
      },
    });
  }
);

/**
 * POST /api/projects/:id/snapshot
 */
router.post('/:id/snapshot', snapshotRules, validate, async (req, res, next) => {
  const { sourceType } = req.body;

  const project = await Project.findOne({ _id: req.params.id, userId: req.user._id });
  if (!project) return res.status(404).json({ success: false, message: 'Project not found' });

  if (project.snapshots.length >= 2) {
    return res.status(409).json({
      success: false,
      message: 'This project already has two snapshots.',
    });
  }

  if (sourceType === 'zip') {
    upload.fields([{ name: 'file', maxCount: 1 }, { name: 'docs', maxCount: 10 }])(req, res, async (err) => {
      if (err) return next(err);
      const zipFile = req.files?.file?.[0];
      const docFiles = req.files?.docs || [];

      if (!zipFile) {
        return res.status(400).json({ success: false, message: 'No file uploaded' });
      }

      const { project: updatedProject, analysisRunId } = await createProjectFromZip({
        userId: req.user._id,
        file: zipFile,
        docFiles,
        snapshotLabel: 'snapshot2',
        existingProjectId: req.params.id,
      });

      res.status(201).json({
        success: true,
        message: 'Snapshot 2 uploaded. Analysis pipeline started.',
        data: { project: updatedProject, analysisRunId },
      });
    });
  } else {
    const { githubUrl, githubRef = 'main' } = req.body;
    if (!githubUrl) {
      return res.status(422).json({ success: false, message: 'githubUrl is required for GitHub snapshots' });
    }

    const { project: updatedProject, analysisRunId } = await createProjectFromGitHub({
      userId: req.user._id,
      githubUrl: githubUrl.trim(),
      githubRef: githubRef.trim(),
      snapshotLabel: 'snapshot2',
      existingProjectId: req.params.id,
    });

    res.status(201).json({
      success: true,
      message: 'GitHub snapshot 2 queued. Analysis pipeline started.',
      data: { project: updatedProject, analysisRunId },
    });
  }
});

module.exports = router;
