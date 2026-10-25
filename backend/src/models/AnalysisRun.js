/**
 * AnalysisRun Model
 *
 * Records a single execution of the RAV pipeline for a project snapshot.
 * Every agent's result is stored here so the dashboard can reconstruct
 * the full analysis without re-running the pipeline.
 *
 * Each agent writes to a dedicated sub-document field so results remain
 * independently queryable and replaceable (e.g., re-running only the
 * Verification Agent without re-parsing).
 */

'use strict';

const mongoose = require('mongoose');

// ── Sub-schema: individual agent result ───────────────────────────────────────
const agentResultSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ['pending', 'running', 'success', 'failed', 'skipped'],
      default: 'pending',
    },
    startedAt:   { type: Date },
    completedAt: { type: Date },
    durationMs:  { type: Number },
    // Structured output payload (varies by agent — stored as Mixed for flexibility)
    output: { type: mongoose.Schema.Types.Mixed },
    // Error details if status === 'failed'
    error: { type: String },
  },
  { _id: false }
);

// ── Main schema ───────────────────────────────────────────────────────────────
const analysisRunSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Which snapshot(s) this run covers
    snapshotLabel: {
      type: String,
      enum: ['snapshot1', 'snapshot2', 'both'],
      default: 'snapshot1',
    },
    // Ablation mode: controls which pipeline stages are active
    // full_rav   = SSKG + Retrieval + Verification (the complete pipeline)
    // rag_only   = SSKG + Retrieval, NO Verification Agent
    // plain_llm  = direct LLM call on raw source, NO SSKG, NO Verification
    ablationMode: {
      type: String,
      enum: ['full_rav', 'rag_only', 'plain_llm'],
      default: 'full_rav',
    },
    // Overall run status
    status: {
      type: String,
      enum: ['queued', 'running', 'completed', 'failed'],
      default: 'queued',
      index: true,
    },
    startedAt:   { type: Date },
    completedAt: { type: Date },
    durationMs:  { type: Number },

    // ── Per-agent results (11-agent spec) ──────────────────────────────────
    preprocessing:       { type: agentResultSchema, default: () => ({}) },
    parsing:             { type: agentResultSchema, default: () => ({}) },
    graphConstruction:   { type: agentResultSchema, default: () => ({}) },
    diagrams:            { type: agentResultSchema, default: () => ({}) },
    legacyDoc:           { type: agentResultSchema, default: () => ({}) },
    retrieval:           { type: agentResultSchema, default: () => ({}) },
    reconstruction:      { type: agentResultSchema, default: () => ({}) },
    verification:        { type: agentResultSchema, default: () => ({}) },
    conversationalQuery: { type: agentResultSchema, default: () => ({}) },
    evaluation:          { type: agentResultSchema, default: () => ({}) },

    // ── Top-level metrics (denormalized for fast dashboard stat cards) ──────
    // Populated from EvaluationAgent output at end of each run.
    metrics: {
      ablation_mode:                    { type: String },
      precision:                        { type: Number },
      recall:                           { type: Number },
      f1_score:                         { type: Number },
      hallucination_rate:               { type: Number },
      evidence_citation_accuracy:       { type: Number },
      verification_classification_accuracy: { type: Number },
      architecture_reconstruction_accuracy: { type: Number },
      api_detection_accuracy:           { type: Number },
      software_knowledge_coverage:      { type: Number },
      time_saved_minutes:               { type: Number },
      raw_counts:                       { type: mongoose.Schema.Types.Mixed },
    },

    // Orchestrator execution log (array of step entries)
    executionLog: [
      {
        timestamp: { type: Date, default: Date.now },
        agent:     { type: String },
        event:     { type: String },
        detail:    { type: mongoose.Schema.Types.Mixed },
      },
    ],

    // User query that triggered this run (if query-driven)
    userQuery: { type: String },

    // Last error message
    errorMessage: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// ── Indexes ───────────────────────────────────────────────────────────────────
analysisRunSchema.index({ projectId: 1, createdAt: -1 });
analysisRunSchema.index({ userId: 1, createdAt: -1 });

const AnalysisRun = mongoose.model('AnalysisRun', analysisRunSchema);

module.exports = AnalysisRun;
