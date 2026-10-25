/**
 * JWT Authentication Middleware
 *
 * Verifies the Bearer token from the Authorization header OR from the
 * httpOnly cookie (jwt_token). Attaches the decoded user payload to req.user.
 *
 * Usage:
 *   router.get('/protected', authenticate, handler)
 *   router.get('/admin-only', authenticate, authorize('admin'), handler)
 */

'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../config/logger');

/**
 * authenticate — verify JWT and attach user to request.
 *
 * @throws 401 if token is missing or invalid
 * @throws 401 if user no longer exists in the database
 */
const authenticate = async (req, res, next) => {
  let token;

  // 1. Try Authorization header (Bearer <token>)
  if (req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 2. Fall back to httpOnly cookie
  else if (req.cookies?.jwt_token) {
    token = req.cookies.jwt_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please log in.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify the user still exists and is active
    const user = await User.findById(decoded.id).select('-passwordHash');
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User no longer exists or account is deactivated.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    logger.warn('JWT verification failed:', err.message);

    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ success: false, message: 'Invalid token.' });
    }

    return res.status(401).json({ success: false, message: 'Authentication failed.' });
  }
};

/**
 * authorize — role-based access control (must be used after authenticate).
 *
 * @param {...string} roles — allowed roles (e.g., 'admin', 'researcher')
 */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role(s): ${roles.join(', ')}.`,
    });
  }
  next();
};

module.exports = { authenticate, authorize };
