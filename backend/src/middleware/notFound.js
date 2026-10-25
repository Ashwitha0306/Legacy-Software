/**
 * 404 Not Found middleware.
 * Catches any request that didn't match a registered route.
 */

'use strict';

const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
};

module.exports = { notFound };
