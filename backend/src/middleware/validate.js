/**
 * Input validation middleware factory.
 * Wraps express-validator's validationResult and returns a standardized
 * 422 response if any validation rule fails.
 *
 * Usage:
 *   router.post('/register', [...validationRules], validate, handler)
 */

'use strict';

const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(({ path, msg, value }) => ({
        field: path,
        message: msg,
        ...(process.env.NODE_ENV === 'development' && { received: value }),
      })),
    });
  }
  next();
};

module.exports = { validate };
