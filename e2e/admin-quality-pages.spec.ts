import { test, expect } from '@playwright/test';
import { signInAsE2EAdmin } from './helpers/auth';

test.describe('Admin Quality Pages', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsE2EAdmin(page);
  });

  test('should render email templates admin page', async ({ page }) => {
    await page.goto('/admin?tab=emailTemplates');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/admin\?tab=emailTemplates$/);
    await expect(page.locator('#email-address')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /adminWorkspace\.tabs\.emailTemplates|templates email|email templates/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /nouveau template|new template/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /actualiser|refresh/i }).first()).toBeVisible();
  });

  test('should render tags management page with search and tabs', async ({ page }) => {
    await page.goto('/admin?tab=tags');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/admin\?tab=tags$/);
    await expect(page.locator('#email-address')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /tags bruts|raw tags/i }).first()).toBeVisible();
    await expect(page.getByPlaceholder(/rechercher un tag|search for a tag/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /actualiser|refresh/i }).first()).toBeVisible();
  });

  test('should render security logs page with filters and table', async ({ page }) => {
    await page.goto('/dashboard/security-logs');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/security-logs$/);
    await expect(page.locator('#email-address')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /logs de s[ée]curit[ée]|security logs/i })).toBeVisible();
    await expect(page.getByRole('combobox').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /actualiser|refresh/i }).first()).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('should render gdpr audit page with stats and filters action', async ({ page }) => {
    await page.goto('/dashboard/gdpr-audit');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/dashboard\/gdpr-audit$/);
    await expect(page.locator('#email-address')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /journal d'audit rgpd|gdpr/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /filtres|filters/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /actualiser|refresh/i }).first()).toBeVisible();
  });
});
