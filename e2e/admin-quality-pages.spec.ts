import { test, expect } from '@playwright/test';
import { signInAsE2EAdmin } from './helpers/auth';

test.describe('Admin Quality Pages', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsE2EAdmin(page);
  });

  test('should render email templates admin page', async ({ page }) => {
    await page.goto('/dashboard/email-templates');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/email-templates$/);
    await expect(page.locator('#email-address')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /email templates/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /new template/i })).toBeVisible();
    await expect(page.getByText(/manage your email templates/i)).toBeVisible();
  });

  test('should render tags management page with search and tabs', async ({ page }) => {
    await page.goto('/dashboard/tags');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/tags$/);
    await expect(page.locator('#email-address')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /tags management/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /search for a tag/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /raw tags/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /refresh/i }).first()).toBeVisible();
  });

  test('should render security logs page with filters and table', async ({ page }) => {
    await page.goto('/dashboard/security-logs');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/security-logs$/);
    await expect(page.locator('#email-address')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /security logs/i })).toBeVisible();
    await expect(page.getByRole('combobox').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /refresh/i }).first()).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });
});
