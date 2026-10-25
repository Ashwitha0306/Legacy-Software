/**
 * Health Check Routes
 *
 * GET /api/health         — basic liveness probe
 * GET /api/health/full    — readiness probe (checks MongoDB + Analysis Service)
 */

'use strict';

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const logger = require('../config/logger');

const router = express.Router();

/**
 * GET /api/health
 * Liveness probe — returns 200 if the Node process is up.
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'Legacy Intel Backend',
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
  });
});

/**
 * GET /api/health/full
 * Readiness probe — checks MongoDB connection and analysis-service availability.
 */
router.get('/full', async (req, res) => {
  const checks = {
    database: 'unknown',
    analysisService: 'unknown',
  };
  let overallStatus = 'ok';

  // ── Check MongoDB ─────────────────────────────────────────────────────────
  try {
    const dbState = mongoose.connection.readyState;
    // readyState: 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
    checks.database = dbState === 1 ? 'connected' : 'disconnected';
    if (dbState !== 1) overallStatus = 'degraded';
  } catch (err) {
    checks.database = 'error';
    overallStatus = 'degraded';
    logger.warn('Health check: MongoDB error', err.message);
  }

  // ── Check Analysis Service ────────────────────────────────────────────────
  try {
    const url = `${process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8000'}/health`;
    const response = await axios.get(url, { timeout: 3000 });
    checks.analysisService = response.data?.status === 'ok' ? 'reachable' : 'error';
  } catch (err) {
    checks.analysisService = 'unreachable';
    overallStatus = 'degraded';
    logger.warn('Health check: Analysis service unreachable', err.message);
  }

  const statusCode = overallStatus === 'ok' ? 200 : 503;
  res.status(statusCode).json({
    success: overallStatus === 'ok',
    service: 'Legacy Intel Backend',
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks,
  });
});

module.exports = router;
