import { test, expect } from '@playwright/test';
import { signInAsE2EUser } from './helpers/auth';

test.describe('Protected Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsE2EUser(page);
  });

  test('should allow an authenticated user to open protected routes', async ({ page }) => {
    const protectedRoutes = ['/', '/upload', '/facts', '/profile'];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(`${route === '/' ? '\\/$' : `${route}$`}`));
      await expect(page.locator('#email-address')).toHaveCount(0);
    }
  });

  test('should redirect a standard user away from admin-only routes', async ({ page }) => {
    for (const route of ['/settings', '/batch-upload']) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/$/);
    }
  });
});
