/**
 * Project Model
 *
 * Represents a legacy Java Spring Boot project uploaded to the platform.
 * Supports two input types:
 *   - zip    : uploaded as a ZIP file
 *   - github : fetched/cloned from a GitHub repository URL
 *
 * A project can have up to two snapshots (for drift comparison):
 *   - snapshot1: the initial / baseline version
 *   - snapshot2: the later / updated version
 *
 * Each project can have multiple AnalysisRun records (stored separately),
 * referenced here by ID for efficient querying.
 */

'use strict';

const mongoose = require('mongoose');

// ── Sub-schema: snapshot metadata ─────────────────────────────────────────────
const snapshotSchema = new mongoose.Schema(
  {
    label: { type: String, enum: ['snapshot1', 'snapshot2'], required: true },
    sourceType: { type: String, enum: ['zip', 'github'], required: true },
    // For ZIP uploads: path on disk (relative to project uploads dir)
    zipPath: { type: String },
    // For GitHub: original URL and resolved ref (commit SHA)
    githubUrl: { type: String },
    githubRef: { type: String, default: 'main' }, // branch / tag / commit
    githubCommitSha: { type: String },
    // Path to the extracted/cloned source tree on disk
    extractedPath: { type: String, required: true },
    // Detected language & framework (filled by Preprocessing Agent)
    language: { type: String },
    framework: { type: String },
    techStack: { type: String },
    springBootVersion: { type: String },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────
const projectSchema = new mongoose.Schema(
  {
    // Human-readable name (derived from repo/zip name, editable by user)
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [200, 'Project name must not exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description must not exceed 1000 characters'],
    },
    // Owner reference
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Universal Technology Stack metadata
    language: { type: String, default: 'unknown' },
    framework: { type: String, default: 'unknown' },
    techStack: { type: String, default: 'unknown' },
    // Overall lifecycle status
    status: {
      type: String,
      enum: [
        'uploaded',
        'preprocessing',
        'parsing',
        'building_graph',
        'analyzing',
        'completed',
        'error',
      ],
      default: 'uploaded',
      index: true,
    },
    // The one or two snapshots for this project
    snapshots: {
      type: [snapshotSchema],
      validate: {
        validator: (arr) => arr.length >= 1 && arr.length <= 2,
        message: 'A project must have 1 or 2 snapshots',
      },
    },
    // IDs of AnalysisRun documents produced for this project
    analysisRunIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AnalysisRun',
      },
    ],
    // Quick stats populated after the first successful analysis
    stats: {
      totalClasses:   { type: Number, default: 0 },
      totalMethods:   { type: Number, default: 0 },
      totalEndpoints: { type: Number, default: 0 },
      totalPackages:  { type: Number, default: 0 },
      graphNodeCount: { type: Number, default: 0 },
      graphEdgeCount: { type: Number, default: 0 },
      citationAccuracy: { type: Number },
    },
    // Evaluation metrics denormalized from the latest completed AnalysisRun
    metrics: { type: mongoose.Schema.Types.Mixed },
    // Last error message (if status === 'error')
    errorMessage: { type: String },
    // Tags for filtering/searching in the dashboard
    tags: [{ type: String, trim: true }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// ── Virtual: number of snapshots ──────────────────────────────────────────────
projectSchema.virtual('snapshotCount').get(function () {
  return this.snapshots ? this.snapshots.length : 0;
});

// ── Indexes ───────────────────────────────────────────────────────────────────
projectSchema.index({ userId: 1, createdAt: -1 });

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
