/**
 * Database Migration Script
 *
 * Migrates all collections (users, projects, analysisruns) from the default 'test' database
 * into the target 'legacy_intel' database, and drops the empty collections from 'test'.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const mongoose = require('mongoose');

const migrate = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/legacy_intel';
  console.log('Connecting to MongoDB...');

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`Connected to MongoDB host: ${conn.connection.host}`);

    const client = conn.connection.client;

    const testDb = client.db('test');
    const legacyDb = client.db('legacy_intel');

    const collectionsToMigrate = ['users', 'projects', 'analysisruns', 'developer_memories'];

    for (const collName of collectionsToMigrate) {
      try {
        const testColl = testDb.collection(collName);
        const legacyColl = legacyDb.collection(collName);

        const docs = await testColl.find({}).toArray();
        if (docs.length > 0) {
          console.log(`Found ${docs.length} documents in test.${collName}. Migrating to legacy_intel.${collName}...`);
          for (const doc of docs) {
            await legacyColl.replaceOne({ _id: doc._id }, doc, { upsert: true });
          }
          console.log(`Migrated ${docs.length} documents into legacy_intel.${collName}.`);
          await testColl.drop().catch(() => {});
          console.log(`Dropped collection test.${collName}.`);
        } else {
          console.log(`No documents found in test.${collName}. Skipping.`);
        }
      } catch (collErr) {
        console.log(`Info for collection '${collName}': ${collErr.message}`);
      }
    }

    console.log('\nMigration complete! All database collections consolidated under legacy_intel.');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

migrate();
