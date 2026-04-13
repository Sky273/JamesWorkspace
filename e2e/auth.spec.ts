import { test, expect } from '@playwright/test';
import {
  deleteUserAndOrphanFirmByEmailForE2E,
  findUserByEmailForE2E,
  setSelfServiceRegistrationAutoApproval,
} from './helpers/auth';

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
    const protectedRoutes = ['/resumes', '/settings', '/facts', '/admin'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/(welcome|signin)(\?.*)?$/);
    }
  });

  test('should auto-approve self-service registration when the setting is enabled', async ({ page }) => {
    const email = `playwright-auto-approved-${Date.now()}@example.com`;
    const password = 'PlaywrightAuto123!';

    await deleteUserAndOrphanFirmByEmailForE2E(email);
    await setSelfServiceRegistrationAutoApproval(true);

    try {
      await page.goto('/register');

      await page.locator('#name').fill('Playwright Auto Approved');
      await page.locator('#email').fill(email);
      await page.locator('#password').fill(password);
      await page.locator('#confirmPassword').fill(password);
      await page.getByRole('button', { name: /créer un compte|create an account/i }).click();

      await expect(page).toHaveURL(/\/signin(\?.*)?$/);

      const createdUser = await findUserByEmailForE2E(email);
      expect(createdUser).not.toBeNull();
      expect(createdUser?.status).toBe('active');
      expect(createdUser?.firm_name).toMatch(/^Cabinet test(?: \d+)?$/);

      await page.locator('#email-address').fill(email);
      await page.locator('#password').fill(password);
      await page.locator('button[type="submit"]').click();

      await expect(page).toHaveURL(/\/$/);
    } finally {
      await deleteUserAndOrphanFirmByEmailForE2E(email);
      await setSelfServiceRegistrationAutoApproval(false);
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
