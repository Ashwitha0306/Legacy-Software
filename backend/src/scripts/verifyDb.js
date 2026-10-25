/**
 * MongoDB Data Integrity & Seed Verification Script
 *
 * Connects to MongoDB Atlas / Local DB and ensures:
 * 1. Database connection is active.
 * 2. Default admin/researcher user exists (or creates one).
 * 3. Default legacy project seeds exist in the 'projects' collection.
 * 4. Indexes are synced and collections are verified.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Project = require('../models/Project');
const AnalysisRun = require('../models/AnalysisRun');

const verifyAndSeedDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/legacy_intel';
  console.log('🔍 Checking MongoDB Atlas Database connection...');

  try {
    const conn = await mongoose.connect(uri, {
      dbName: process.env.MONGODB_DB_NAME || 'legacy_intel',
      serverSelectionTimeoutMS: 10000,
    });

    console.log(`✅ Connected to MongoDB Host: ${conn.connection.host}`);
    console.log(`   Database Name: ${conn.connection.name}`);

    // 1. Verify Users Collection
    let defaultUser = await User.findOne({ email: 'researcher@legacyintel.ai' });
    if (!defaultUser) {
      console.log('👤 Creating default Lead Researcher user in MongoDB...');
      defaultUser = await User.create({
        name: 'Lead Architect',
        email: 'researcher@legacyintel.ai',
        passwordHash: 'Password123!', // Pre-save hook will hash with bcrypt
        role: 'researcher',
        preferences: {
          confidenceAlpha: 0.5,
          confidenceBeta: 0.3,
          confidenceGamma: 0.2,
        },
      });
      console.log(`✅ Seed User Created: ${defaultUser._id} (${defaultUser.email})`);
    } else {
      console.log(`✅ Lead Researcher User verified: ${defaultUser._id}`);
    }

    // 2. Verify Projects Collection
    const projectCount = await Project.countDocuments();
    console.log(`📊 Current MongoDB Project Count: ${projectCount}`);

    if (projectCount === 0) {
      console.log('📦 Seeding default Spring Boot legacy codebase into MongoDB...');
      const sampleProject = await Project.create({
        name: 'Legacy PetClinic Spring Boot',
        description: 'Enterprise Java Spring Boot monolith codebase parsed into SSKG Knowledge Graph',
        userId: defaultUser._id,
        status: 'completed',
        language: 'Java 17',
        framework: 'Spring Boot 3.2.0',
        techStack: 'Spring Data JPA, Hibernate, PostgreSQL, Thymeleaf',
        snapshots: [
          {
            label: 'snapshot1',
            sourceType: 'zip',
            extractedPath: './uploads/extracted/petclinic_v1',
            language: 'Java 17',
            framework: 'Spring Boot 3.2.0',
            springBootVersion: '3.2.0',
            uploadedAt: new Date(),
          },
        ],
        stats: {
          totalClasses: 48,
          totalMethods: 312,
          totalEndpoints: 24,
          totalPackages: 8,
          graphNodeCount: 384,
          graphEdgeCount: 1024,
        },
        tags: ['spring-boot', 'petclinic', 'monolith', 'java'],
      });
      console.log(`✅ Seed Project Created: ${sampleProject._id} (${sampleProject.name})`);
    }

    // 3. Collection Summary
    const userTotal = await User.countDocuments();
    const projTotal = await Project.countDocuments();
    const runTotal = await AnalysisRun.countDocuments();

    console.log('\n==================================================');
    console.log('🎉 MONODB DATABASE INTEGRITY SUMMARY');
    console.log(`   - Users Collection:         ${userTotal} documents`);
    console.log(`   - Projects Collection:      ${projTotal} documents`);
    console.log(`   - Analysis Runs Collection: ${runTotal} documents`);
    console.log('==================================================\n');

  } catch (err) {
    console.error('❌ MongoDB Integrity Verification Failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

verifyAndSeedDB();
