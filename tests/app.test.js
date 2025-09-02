const request = require('supertest');
const app = require('../src/app');

describe('Express App', () => {
  describe('GET /health', () => {
    it('should return 200 and health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'OK');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('GET /api/status', () => {
    it('should return system status', async () => {
      const response = await request(app)
        .get('/api/status')
        .expect(200);

      expect(response.body).toHaveProperty('assistant');
      expect(response.body).toHaveProperty('evolution');
      expect(response.body).toHaveProperty('database');
      expect(response.body.assistant).toHaveProperty('enabled', false);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/nonexistent-route')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Route not found');
    });
  });

  describe('POST requests with JSON', () => {
    it('should handle JSON requests properly', async () => {
      const testData = { test: 'data' };
      
      await request(app)
        .post('/nonexistent-post-route')
        .send(testData)
        .set('Accept', 'application/json')
        .expect(404);
    });
  });
});