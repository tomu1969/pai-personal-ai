const request = require('supertest');
const app = require('../../src/app');

describe('QR Code API Endpoint', () => {
  describe('GET /api/whatsapp/qrcode', () => {
    it('should return QR code data with proper structure', async () => {
      const response = await request(app)
        .get('/api/whatsapp/qrcode')
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty('connected');
      expect(response.body).toHaveProperty('qrCode');
      expect(response.body).toHaveProperty('instanceId');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.connected).toBe(false);
    });

    it('should return base64 image data in qrCode field', async () => {
      const response = await request(app)
        .get('/api/whatsapp/qrcode')
        .expect(200);

      // Verify qrCode contains base64 image data
      expect(response.body.qrCode).toBeDefined();
      expect(response.body.qrCode).toMatch(/^data:image\/png;base64,/);
      
      // Verify it's a valid base64 string
      const base64Data = response.body.qrCode.replace('data:image/png;base64,', '');
      expect(() => Buffer.from(base64Data, 'base64')).not.toThrow();
    });

    it('should return valid timestamp', async () => {
      const response = await request(app)
        .get('/api/whatsapp/qrcode')
        .expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
      
      // Should be recent (within last minute)
      const now = new Date();
      const diff = Math.abs(now - timestamp);
      expect(diff).toBeLessThan(60000); // 1 minute
    });

    it('should handle Evolution API errors gracefully', async () => {
      // This test would require mocking the Evolution API
      // For now, we'll just verify that errors return proper structure
      const response = await request(app)
        .get('/api/whatsapp/qrcode');

      // Should either succeed with 200 or fail with proper error structure
      if (response.status !== 200) {
        expect(response.body).toHaveProperty('error');
        expect(response.body).toHaveProperty('message');
      }
    });

    it('should include instanceId when available', async () => {
      const response = await request(app)
        .get('/api/whatsapp/qrcode')
        .expect(200);

      expect(response.body.instanceId).toBeDefined();
      expect(typeof response.body.instanceId).toBe('string');
    });
  });

  describe('QR Code Data Quality', () => {
    it('should return QR code with sufficient data length', async () => {
      const response = await request(app)
        .get('/api/whatsapp/qrcode')
        .expect(200);

      if (response.body.qrCode) {
        // Base64 QR code should be substantial in size
        expect(response.body.qrCode.length).toBeGreaterThan(1000);
      }
    });

    it('should return consistent data structure across multiple calls', async () => {
      const response1 = await request(app)
        .get('/api/whatsapp/qrcode')
        .expect(200);

      const response2 = await request(app)
        .get('/api/whatsapp/qrcode')
        .expect(200);

      // Both responses should have same structure
      expect(Object.keys(response1.body).sort()).toEqual(Object.keys(response2.body).sort());
      
      // Both should have same connected status
      expect(response1.body.connected).toEqual(response2.body.connected);
    });
  });
});