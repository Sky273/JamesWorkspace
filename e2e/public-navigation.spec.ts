import { test, expect } from '@playwright/test';
import { gotoAndWaitForVisible, publicEntryLink } from './helpers/ui';

test.describe('Public Navigation', () => {
  test('should navigate from the public home page to signin and register', async ({ page }) => {
    await gotoAndWaitForVisible(page, '/welcome', publicEntryLink(page, 'signin'));

    await expect(page).toHaveURL(/\/welcome$/);

    await publicEntryLink(page, 'signin').click();
    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.locator('#email-address')).toBeVisible();

    await gotoAndWaitForVisible(page, '/welcome', publicEntryLink(page, 'register'));
    await publicEntryLink(page, 'register').click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
  });

  test('should expose legal pages from the footer and allow returning to the public shell', async ({ page }) => {
    await gotoAndWaitForVisible(page, '/signin', page.locator('a[href="/privacy"]'));

    await page.locator('a[href="/privacy"]').click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.locator('text=privacy@aptea.net')).toBeVisible();
    await page.locator('a[href="/"]').first().click();
    await expect(page).toHaveURL(/\/(welcome|signin)$/);

    await gotoAndWaitForVisible(page, '/signin', page.locator('a[href="/terms"]'));
    await page.locator('a[href="/terms"]').click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.locator('text=legal@aptea.net')).toBeVisible();
  });

  test('should navigate from signin to forgot password and back', async ({ page }) => {
    await gotoAndWaitForVisible(page, '/signin', page.locator('a[href="/forgot-password"]'));

    await page.locator('a[href="/forgot-password"]').click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.locator('#email')).toBeVisible();

    await page.locator('a[href="/signin"]').click();
    await expect(page).toHaveURL(/\/signin$/);
    await expect(page.locator('#password')).toBeVisible();
  });
});
