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

    if (page.url().includes('/welcome')) {
      await expect(page.locator('a[href="/signin"]').first()).toBeVisible();
      return;
    }

    await expect(page.getByRole('heading', { name: /connexion|se connecter|login/i })).toBeVisible();
    await expect(page.locator('#email-address')).toBeVisible();
  });

  test('should show email and password fields on signin page', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.locator('#email-address')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('should reject invalid credentials', async ({ page }) => {
    await page.goto('/signin');
    await page.locator('#email-address').fill('invalid@test.com');
    await page.locator('#password').fill('wrongpassword');

    const signInResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/auth/signin') && response.request().method() === 'POST'
    );

    await page.locator('button[type="submit"]').click();

    const signInResponse = await signInResponsePromise;
    expect(signInResponse.status()).toBeGreaterThanOrEqual(400);
    await expect(page).toHaveURL(/\/signin(\?.*)?$/);
  });

  test('should redirect unauthenticated users away from protected shell routes', async ({ page }) => {
    const protectedRoutes = ['/resumes', '/settings', '/facts', '/dashboard/users'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/(welcome|signin)(\?.*)?$/);
    }
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
