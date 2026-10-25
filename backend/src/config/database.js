/**
 * MongoDB connection configuration using Mongoose.
 * Uses MongoDB Atlas (or local mongod) based on MONGODB_URI env variable.
 */

'use strict';

const mongoose = require('mongoose');
const logger = require('./logger');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  try {
    const conn = await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || 'legacy_intel',
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`✅ MongoDB connected: ${conn.connection.host}`);

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    return conn;
  } catch (err) {
    logger.warn(`Primary MongoDB connection failed (${err.message}). Attempting fallback to local MongoDB...`);
    try {
      const fallbackUri = 'mongodb://127.0.0.1:27017/legacy_intel';
      const conn = await mongoose.connect(fallbackUri, {
        serverSelectionTimeoutMS: 3000,
      });
      logger.info(`✅ Connected to local MongoDB fallback: ${fallbackUri}`);
      return conn;
    } catch (localErr) {
      logger.error('MongoDB connection failed: Could not connect to Atlas or local MongoDB.');
      logger.error('To fix Atlas connection, whitelist your current IP address (0.0.0.0/0 for dev) in MongoDB Atlas Network Access: https://www.mongodb.com/docs/atlas/security-whitelist/');
      throw err;
    }
  }
};

module.exports = connectDB;
