/**
 * Auth Routes
 *
 * POST   /api/auth/register    — create new account
 * POST   /api/auth/login       — login, receive JWT (cookie + body)
 * POST   /api/auth/logout      — clear JWT cookie
 * GET    /api/auth/me          — get current user profile
 * PATCH  /api/auth/preferences — update user analysis preferences
 */

'use strict';

const express = require('express');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const { registerUser, loginUser, cookieOptions, updatePreferences } = require('../services/authService');

const router = express.Router();

// ── Validation rules ──────────────────────────────────────────────────────────

const registerRules = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/)
    .withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/)
    .withMessage('Password must contain at least one number'),
];

const loginRules = [
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

const preferencesRules = [
  body('confidenceAlpha').optional().isFloat({ min: 0, max: 1 })
    .withMessage('confidenceAlpha must be between 0 and 1'),
  body('confidenceBeta').optional().isFloat({ min: 0, max: 1 })
    .withMessage('confidenceBeta must be between 0 and 1'),
  body('confidenceGamma').optional().isFloat({ min: 0, max: 1 })
    .withMessage('confidenceGamma must be between 0 and 1'),
  body('llmTemperature').optional().isFloat({ min: 0, max: 1 })
    .withMessage('llmTemperature must be between 0 and 1'),
];

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * POST /api/auth/register
 */
router.post('/register', registerRules, validate, async (req, res) => {
  const { name, email, password } = req.body;
  const { user, token } = await registerUser({ name, email, password });

  res.cookie('jwt_token', token, cookieOptions());

  res.status(201).json({
    success: true,
    message: 'Account created successfully',
    data: {
      user,
      token, // also returned in body for non-browser clients
    },
  });
});

/**
 * POST /api/auth/login
 */
router.post('/login', loginRules, validate, async (req, res) => {
  const { email, password } = req.body;
  const { user, token } = await loginUser({ email, password });

  res.cookie('jwt_token', token, cookieOptions());

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: { user, token },
  });
});

/**
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('jwt_token', { path: '/' });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

/**
 * GET /api/auth/me
 * Returns the currently authenticated user's profile.
 */
router.get('/me', authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    data: { user: req.user },
  });
});

/**
 * PATCH /api/auth/preferences
 * Update analysis configuration preferences for the current user.
 */
router.patch('/preferences', authenticate, preferencesRules, validate, async (req, res) => {
  const user = await updatePreferences(req.user._id, req.body);
  res.status(200).json({
    success: true,
    message: 'Preferences updated',
    data: { user },
  });
});

module.exports = router;
