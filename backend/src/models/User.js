/**
 * User Model
 *
 * Stores registered users for the platform. Passwords are hashed with bcrypt
 * before storage. The model exposes a comparePassword instance method for
 * authentication.
 *
 * Fields:
 *   name         — display name
 *   email        — unique login identifier
 *   passwordHash — bcrypt hash; the raw password is NEVER stored
 *   role         — 'researcher' | 'developer' | 'admin'
 *   preferences  — configurable analysis defaults per user
 *   createdAt    — auto-managed by Mongoose timestamps
 *   updatedAt    — auto-managed by Mongoose timestamps
 */

'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name must not exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // Never returned in queries by default
    },
    role: {
      type: String,
      enum: ['researcher', 'developer', 'admin'],
      default: 'researcher',
    },
    preferences: {
      // Default weights for confidence scoring (can be overridden per user)
      confidenceAlpha: { type: Number, default: 0.5 },
      confidenceBeta:  { type: Number, default: 0.3 },
      confidenceGamma: { type: Number, default: 0.2 },
      // LLM temperature preference (0.0 = deterministic for research)
      llmTemperature:  { type: Number, default: 0.1, min: 0.0, max: 1.0 },
      // Default output language for documentation
      docLanguage: { type: String, default: 'en' },
    },
    lastLoginAt: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    // Do not expose passwordHash or __v in JSON output
    toJSON: {
      transform: (doc, ret) => {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  }
);


// ── Pre-save hook: hash password if modified ──────────────────────────────────
userSchema.pre('save', async function (next) {
  // Only hash when the password field has changed (avoids re-hashing on other saves)
  if (!this.isModified('passwordHash')) return next();
  this.passwordHash = await bcrypt.hash(this.passwordHash, BCRYPT_ROUNDS);
  next();
});

// ── Instance method: verify password ─────────────────────────────────────────
/**
 * @param {string} candidatePassword — plain-text password from login request
 * @returns {Promise<boolean>}
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// ── Static method: find by email including passwordHash (for auth) ─────────
userSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email: email.toLowerCase() }).select('+passwordHash');
};

const User = mongoose.model('User', userSchema);

module.exports = User;
