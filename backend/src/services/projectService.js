/**
 * Project Service — Supporting Legacy Documentation Files Ingestion
 */

'use strict';

const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const AdmZip = require('adm-zip');
const axios = require('axios');
const mongoose = require('mongoose');

const Project = require('../models/Project');
const AnalysisRun = require('../models/AnalysisRun');
const logger = require('../config/logger');

const UPLOADS_ROOT = path.resolve(__dirname, '..', '..', 'uploads', 'projects');

const ensureUploadsDir = (projectId, snapshotLabel) => {
  const dir = path.join(UPLOADS_ROOT, projectId, snapshotLabel);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};

const PRUNE_NAMES = new Set([
  'node_modules', '.git', 'dist', 'build', 'target', 'venv', '.venv',
  '__pycache__', '.next', 'vendor', '.turbo', '.cache', 'coverage',
  '.gradle', '.idea', '.vscode', 'pods', 'bin', 'obj',
]);

const isBadZipEntry = (entryName) => {
  const normalized = (entryName || '').replace(/\\/g, '/');
  const parts = normalized.split('/');
  for (const part of parts) {
    if (!part) continue;
    if (PRUNE_NAMES.has(part.toLowerCase())) return true;
    if (part.includes('{') || part.includes('}') || /[<>:"|?*]/.test(part)) return true;
  }
  return false;
};

const safeRemoveDir = (dirPath) => {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch (_) {
    if (process.platform === 'win32') {
      try {
        const resolved = path.resolve(dirPath);
        const winPath = resolved.startsWith('\\\\?\\') ? resolved : `\\\\?\\${resolved}`;
        fs.rmSync(winPath, { recursive: true, force: true });
      } catch (_) {}
    }
  }
};

const cleanExtractedDir = (targetDir) => {
  const removeRecursive = (currentDir) => {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const nameLower = entry.name.toLowerCase();
        if (
          PRUNE_NAMES.has(nameLower) ||
          entry.name.includes('{') ||
          entry.name.includes('}') ||
          /[<>:"|?*]/.test(entry.name)
        ) {
          safeRemoveDir(fullPath);
        } else if (entry.isDirectory()) {
          removeRecursive(fullPath);
        }
      }
    } catch (_) {}
  };
  removeRecursive(targetDir);
};

const extractZip = (zipFilePath, projectId, snapshotLabel) => {
  const extractDir = ensureUploadsDir(projectId, snapshotLabel);

  try {
    const zip = new AdmZip(zipFilePath);
    const entries = zip.getEntries();
    for (const entry of entries) {
      if (isBadZipEntry(entry.entryName)) {
        zip.deleteFile(entry);
      }
    }
    zip.extractAllTo(extractDir, true);
    cleanExtractedDir(extractDir);
    logger.info(`ZIP extracted and cleaned of package directories: ${extractDir}`, { projectId });
    return extractDir;
  } catch (err) {
    safeRemoveDir(extractDir);
    throw new Error(`Failed to extract ZIP: ${err.message}`);
  } finally {
    try { fs.unlinkSync(zipFilePath); } catch (_) {}
  }
};

const processDocFiles = (docFiles = [], projectId) => {
  if (!docFiles || docFiles.length === 0) return [];
  const docsDir = path.join(UPLOADS_ROOT, projectId, 'legacy_docs');
  fs.mkdirSync(docsDir, { recursive: true });

  const savedPaths = [];
  for (const f of docFiles) {
    const destPath = path.join(docsDir, f.originalname);
    fs.copyFileSync(f.path, destPath);
    try { fs.unlinkSync(f.path); } catch (_) {}
    savedPaths.push(destPath);
    logger.info(`Saved legacy doc file: ${destPath}`, { projectId });
  }

  return savedPaths;
};

const deriveProjectName = (source) => {
  const githubMatch = source.match(/github\.com\/[^/]+\/([^/]+?)(?:\.git)?\/?$/);
  if (githubMatch) return githubMatch[1];

  return path.basename(source, '.zip')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || 'Unnamed Project';
};

const createProjectFromZip = async ({
  userId,
  file,
  docFiles = [],
  name,
  description,
  snapshotLabel = 'snapshot1',
  existingProjectId,
}) => {
  const projectId = existingProjectId || new mongoose.Types.ObjectId().toString();
  const extractedPath = extractZip(file.path, projectId, snapshotLabel);
  const docFilePaths = processDocFiles(docFiles, projectId);
  const projectName = name || deriveProjectName(file.originalname);

  const snapshot = {
    label: snapshotLabel,
    sourceType: 'zip',
    zipPath: file.originalname,
    extractedPath,
  };

  let project;
  if (existingProjectId) {
    project = await Project.findByIdAndUpdate(
      existingProjectId,
      { $push: { snapshots: snapshot } },
      { new: true }
    );
    if (!project) throw Object.assign(new Error('Project not found'), { statusCode: 404 });
  } else {
    project = new Project({
      _id: projectId,
      name: projectName,
      description,
      userId,
      status: 'uploaded',
      snapshots: [snapshot],
    });
    await project.save();
  }

  const runId = await _triggerPipeline(project, userId, snapshot, 'full_rav', null, 'main', docFilePaths);

  logger.info('Project created from ZIP with legacy docs', { projectId: project._id, docsCount: docFilePaths.length });
  return { project, analysisRunId: runId };
};

const createProjectFromGitHub = async ({
  userId,
  githubUrl,
  githubRef = 'main',
  docFiles = [],
  name,
  description,
  snapshotLabel = 'snapshot1',
  existingProjectId,
}) => {
  if (!githubUrl.startsWith('https://github.com/')) {
    const err = new Error('Only https://github.com/ URLs are supported');
    err.statusCode = 422;
    throw err;
  }

  const projectId = existingProjectId || new mongoose.Types.ObjectId().toString();
  const docFilePaths = processDocFiles(docFiles, projectId);
  const projectName = name || deriveProjectName(githubUrl);

  const snapshot = {
    label: snapshotLabel,
    sourceType: 'github',
    githubUrl,
    githubRef,
    extractedPath: path.join(UPLOADS_ROOT, projectId, snapshotLabel),
  };

  let project;
  if (existingProjectId) {
    project = await Project.findByIdAndUpdate(
      existingProjectId,
      { $push: { snapshots: snapshot } },
      { new: true }
    );
    if (!project) throw Object.assign(new Error('Project not found'), { statusCode: 404 });
  } else {
    project = new Project({
      _id: projectId,
      name: projectName,
      description,
      userId,
      status: 'uploaded',
      snapshots: [snapshot],
    });
    await project.save();
  }

  const runId = await _triggerPipeline(project, userId, snapshot, 'full_rav', githubUrl, githubRef, docFilePaths);

  logger.info('Project created from GitHub with legacy docs', { projectId: project._id, docsCount: docFilePaths.length });
  return { project, analysisRunId: runId };
};

const _triggerPipeline = async (project, userId, snapshot, ablationMode, githubUrl, githubRef, docFiles = []) => {
  const run = new AnalysisRun({
    projectId: project._id,
    userId,
    snapshotLabel: snapshot.label,
    ablationMode,
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
        source_type: snapshot.sourceType,
        github_url: githubUrl || null,
        github_ref: githubRef || 'main',
        project_name: project.name,
        doc_files: docFiles,
      };

      const analysisUrl = `${process.env.ANALYSIS_SERVICE_URL}/pipeline/run`;

      // Fire-and-forget: do NOT await the full pipeline response.
      // The Python service updates MongoDB directly as agents complete.
      // The frontend polls /api/analysis/runs/:id for live status.
      axios.post(analysisUrl, payload, {
        timeout: 30 * 60 * 1000, // 30 min — generous timeout for large GitHub repos
        headers: {
          'X-Internal-Secret': process.env.ANALYSIS_SERVICE_SECRET,
        },
      }).catch(async (err) => {
        // Only mark as failed if the service itself errored (not a timeout on our side)
        logger.error('Analysis pipeline call failed', {
          projectId: project._id,
          runId: run._id,
          error: err.message,
        });
        await AnalysisRun.findByIdAndUpdate(run._id, {
          status: 'failed',
          errorMessage: err.message,
          completedAt: new Date(),
        });
        await Project.findByIdAndUpdate(project._id, { status: 'error', errorMessage: err.message });
      });

    } catch (err) {
      logger.error('Failed to trigger analysis pipeline', {
        projectId: project._id,
        runId: run._id,
        error: err.message,
      });
      await AnalysisRun.findByIdAndUpdate(run._id, {
        status: 'failed',
        errorMessage: `Pipeline trigger failed: ${err.message}`,
        completedAt: new Date(),
      });
      await Project.findByIdAndUpdate(project._id, { status: 'error', errorMessage: err.message });
    }
  });


  return run._id.toString();
};

const deleteProject = async (projectId, userId) => {
  const project = await Project.findOne({ _id: projectId, userId });
  if (!project) {
    throw Object.assign(new Error('Project not found'), { statusCode: 404 });
  }

  const projectDir = path.join(UPLOADS_ROOT, projectId);
  if (fs.existsSync(projectDir)) {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }

  await AnalysisRun.deleteMany({ projectId });
  await Project.findByIdAndDelete(projectId);
};

module.exports = {
  createProjectFromZip,
  createProjectFromGitHub,
  deleteProject,
};
