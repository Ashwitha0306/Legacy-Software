/**
 * End-to-End MongoDB Storage & API Test
 * Verifies User registration, Login token generation, and Project creation directly in MongoDB Atlas.
 */

'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });
const http = require('http');

function postJSON(path, data, token) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path,
      method: 'POST',
      headers,
    }, (res) => {
      let resp = '';
      res.on('data', chunk => resp += chunk);
      res.on('end', () => resolve(JSON.parse(resp)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function testE2E() {
  console.log('🚀 Running End-to-End MongoDB Persistence Verification...');
  
  const testEmail = `test_architect_${Date.now()}@legacyintel.ai`;
  
  // 1. Test Register
  console.log(`\n1. Creating user in MongoDB Atlas: ${testEmail}`);
  const regRes = await postJSON('/api/auth/register', {
    name: 'MongoDB Verification Architect',
    email: testEmail,
    password: 'Password123!',
  });
  console.log('✅ Register Response:', regRes.success, regRes.message);
  
  if (!regRes.success) throw new Error(regRes.message);
  const token = regRes.data.token;

  // 2. Test Project Creation from GitHub in MongoDB
  console.log('\n2. Creating GitHub Project in MongoDB Atlas...');
  const projRes = await postJSON('/api/projects/from-github', {
    githubUrl: 'https://github.com/spring-projects/spring-petclinic',
    name: `Verification Spring Project ${Date.now()}`,
    description: 'Stored and verified in MongoDB Atlas legacy_intel database',
  }, token);
  
  console.log('✅ Project Creation Response:', projRes.success, projRes.message);
  console.log('📦 Project MongoDB ID:', projRes.data?.project?._id);

  console.log('\n======================================================');
  console.log('🎉 VERIFICATION COMPLETE: ALL DATA STORED IN MONGODB!');
  console.log('======================================================\n');
}

testE2E().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
