/**
 * Global error handler middleware.
 * Must be registered LAST in the Express middleware chain.
 *
 * Handles:
 *   - Mongoose validation errors (400)
 *   - Mongoose duplicate key errors (409)
 *   - Mongoose CastError (400)
 *   - JWT errors (401) — caught by auth middleware but re-handled here as fallback
 *   - Generic application errors
 */

'use strict';

const logger = require('../config/logger');

const errorHandler = (err, req, res, next) => {
  // Log full error in development, abbreviated in production
  if (process.env.NODE_ENV === 'development') {
    logger.error('Error:', { message: err.message, stack: err.stack, path: req.path });
  } else {
    logger.error('Error:', { message: err.message, path: req.path });
  }

  // Default response
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';
  let errors = null;

  // ── Mongoose: validation error ────────────────────────────────────────────
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // ── Mongoose: duplicate key ───────────────────────────────────────────────
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern)[0];
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // ── Mongoose: invalid ObjectId ────────────────────────────────────────────
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // ── Multer: file too large ─────────────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = `File too large. Maximum allowed size is ${process.env.MAX_FILE_SIZE_MB || 500}MB`;
  }

  // Never expose internal details in production
  const response = {
    success: false,
    message,
    ...(errors && { errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
