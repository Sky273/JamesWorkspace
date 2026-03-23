import { test, expect } from '@playwright/test';

/**
 * Authentication E2E Tests
 * Tests login, logout, and protected routes
 */

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display public entry page for unauthenticated users', async ({ page }) => {
    await expect(page).toHaveURL(/\/(welcome|signin)(\?.*)?$/);
    await expect(page.getByRole('link', { name: /se connecter|connexion|login/i }).first()).toBeVisible();
  });

  test('should show email and password fields on signin page', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/mot de passe|password/i)).toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/signin');
    await page.getByLabel(/email/i).fill('invalid@test.com');
    await page.getByLabel(/mot de passe|password/i).fill('wrongpassword');

    const signInResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/auth/signin') && response.request().method() === 'POST'
    );

    await page.getByRole('button', { name: /^se connecter$/i }).click();

    const signInResponse = await signInResponsePromise;
    expect(signInResponse.status()).toBeGreaterThanOrEqual(400);
    await expect(page).toHaveURL(/\/signin(\?.*)?$/);
  });

  test('should redirect unauthenticated users away from protected routes', async ({ page }) => {
    await page.goto('/resumes');
    await expect(page).toHaveURL(/\/(welcome|signin)(\?.*)?$/);
  });
});

test.describe('Health Check', () => {
  test('should return a valid health payload', async ({ request }) => {
    const response = await request.get('/health');
    expect([200, 503]).toContain(response.status());

    const body = await response.json();
    expect(['healthy', 'degraded', 'unhealthy']).toContain(body.status);
    expect(body.timestamp).toBeTruthy();
  });
});
