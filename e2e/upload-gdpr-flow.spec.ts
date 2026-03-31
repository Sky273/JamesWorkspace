import { test, expect } from '@playwright/test';
import { signInAsE2EUser } from './helpers/auth';

test.describe('Upload GDPR Flow', () => {
  const continueButton = (page: import('@playwright/test').Page) =>
    page.getByRole('button', { name: /continue to upload|continuer vers l'upload/i });

  test.beforeEach(async ({ page }) => {
    await signInAsE2EUser(page);
    await page.goto('/upload');
    await expect(page).toHaveURL(/\/upload$/);
  });

  test('should validate required GDPR fields before moving to upload step', async ({ page }) => {
    await continueButton(page).click();

    await expect(page.getByText(/le nom est requis|name is required/i)).toBeVisible();
    await expect(page.getByText(/l'email est requis pour les externes|email is required for external candidates/i)).toBeVisible();
    await expect(page.locator('#candidateName')).toBeVisible();
    await expect(page.locator('#candidateEmail')).toBeVisible();
  });

  test('should move to the upload step and allow returning to the GDPR form', async ({ page }) => {
    await page.locator('#candidateName').fill('Jean Dupont');
    await page.locator('#candidateEmail').fill('jean.dupont@example.com');
    await continueButton(page).click();

    await expect(page.getByText('Jean Dupont')).toBeVisible();
    await expect(page.getByText('jean.dupont@example.com')).toBeVisible();
    await expect(page.locator('input[type="file"]')).toHaveCount(1);

    await page.getByRole('button', { name: /modifier|modify|edit/i }).click();

    await expect(page.locator('#candidateName')).toHaveValue('Jean Dupont');
    await expect(page.locator('#candidateEmail')).toHaveValue('jean.dupont@example.com');
  });
});
