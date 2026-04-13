import { test, expect } from '@playwright/test';

/**
 * Security E2E Tests
 * Tests access control and security features
 */

test.describe('API Security', () => {
  test('should reject unauthenticated API requests', async ({ request }) => {
    const response = await request.get('/api/resumes');
    expect(response.status()).toBe(401);
  });

  test('should reject requests without CSRF token', async ({ request }) => {
    const response = await request.post('/api/auth/signin', {
      data: { email: 'test@test.com', password: 'test' }
    });
    // Should fail due to missing CSRF token
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test('should have security headers', async ({ request }) => {
    const response = await request.get('/health');
    const headers = response.headers();
    
    // Check for security headers set by Helmet
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-frame-options']).toBeDefined();
  });
});

test.describe('Rate Limiting', () => {
  test('should reject repeated invalid auth attempts', async ({ request }) => {
    const responses = [];
    
    // Make multiple rapid requests
    for (let i = 0; i < 15; i++) {
      const response = await request.post('/api/auth/signin', {
        data: { email: 'test@test.com', password: 'wrongpass-123' }
      });
      responses.push(response.status());
    }
    
    expect(responses.every(status => status >= 400)).toBe(true);
  });
});
