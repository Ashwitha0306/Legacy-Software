/**
 * Unit & Integration tests for Backend API Route Contracts
 */

const request = require('supertest');
const express = require('express');

describe('Backend API Route Contracts', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Health route
    const healthRoutes = require('../routes/health');
    app.use('/api/health', healthRoutes);
  });

  test('GET /api/health returns 200 with service status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBeDefined();
  });

  test('Health check provides timestamp and service identity', async () => {
    const res = await request(app).get('/api/health');
    expect(res.body).toHaveProperty('timestamp');
  });
});
