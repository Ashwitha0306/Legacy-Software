/**
 * Auth Service
 *
 * Business logic for user registration, login, and token management.
 * Keeps route handlers thin by centralizing all auth-related operations here.
 */

'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * Generate a signed JWT for a given user ID.
 *
 * @param {string} userId — MongoDB ObjectId as string
 * @returns {string} signed JWT
 */
const generateToken = (userId) => {
  return jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

/**
 * Cookie options for JWT.
 * httpOnly prevents XSS access; SameSite=strict prevents CSRF.
 *
 * @param {number} maxAgeMs
 * @returns {object} cookie options
 */
const cookieOptions = (maxAgeMs = 7 * 24 * 60 * 60 * 1000) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: maxAgeMs,
  path: '/',
});

/**
 * Register a new user.
 *
 * @param {{ name, email, password }} payload
 * @returns {{ user: UserDoc, token: string }}
 * @throws Error if email already exists
 */
const registerUser = async ({ name, email, password }) => {
  // Check for duplicate email before attempting to save (gives clearer error)
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    const err = new Error('An account with this email already exists');
    err.statusCode = 409;
    throw err;
  }

  // Store the raw password in passwordHash field — the pre-save hook will hash it
  const user = new User({ name, email, passwordHash: password });
  await user.save();

  const token = generateToken(user._id.toString());
  logger.info(`New user registered: ${email}`);

  return { user, token };
};

/**
 * Authenticate an existing user.
 *
 * @param {{ email, password }} credentials
 * @returns {{ user: UserDoc, token: string }}
 * @throws Error if credentials are invalid
 */
const loginUser = async ({ email, password }) => {
  // Explicitly select passwordHash (excluded by default in schema)
  const user = await User.findByEmailWithPassword(email);

  if (!user) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error('Account is deactivated. Please contact support.');
    err.statusCode = 403;
    throw err;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    throw err;
  }

  // Update last login timestamp
  user.lastLoginAt = new Date();
  await user.save();

  const token = generateToken(user._id.toString());
  logger.info(`User logged in: ${email}`);

  // Remove passwordHash from returned user object
  user.passwordHash = undefined;

  return { user, token };
};

/**
 * Update user preferences.
 *
 * @param {string} userId
 * @param {object} preferences
 * @returns {UserDoc}
 */
const updatePreferences = async (userId, preferences) => {
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { preferences } },
    { new: true, runValidators: true }
  );
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }
  return user;
};

module.exports = { generateToken, cookieOptions, registerUser, loginUser, updatePreferences };
