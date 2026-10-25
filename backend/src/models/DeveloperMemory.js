/**
 * Developer Memory Model
 *
 * Stores developer feedback, corrections, accepted claims, and rejected claims.
 * Used by DeveloperMemoryAgent for retrieval-based adaptation.
 */

'use strict';

const mongoose = require('mongoose');

const developerMemorySchema = new mongoose.Schema(
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
    statementId: {
      type: String,
      required: true,
    },
    feedbackType: {
      type: String,
      enum: ['accept', 'reject', 'correction'],
      required: true,
    },
    originalContent: {
      type: String,
      required: true,
    },
    correctionText: {
      type: String,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'developer_memories',
    timestamps: true,
  }
);

module.exports = mongoose.model('DeveloperMemory', developerMemorySchema);
