import { test, expect } from '@playwright/test';

test.describe('Password Recovery Flow', () => {
  test('should redirect reset-password without token back to forgot-password', async ({ page }) => {
    await page.goto('/reset-password');

    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.locator('#email')).toBeVisible();
  });

  test('should validate mismatched passwords on reset-password before any server success path', async ({ page }) => {
    await page.goto('/reset-password?token=fake-token');

    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('#confirm-password')).toBeVisible();

    await page.locator('#password').fill('password123');
    await page.locator('#confirm-password').fill('different123');
    await page.getByRole('button', { name: /réinitialiser|reset|modifier/i }).click();

    await expect(page.locator('.bg-red-50, .dark\\:bg-red-900\\/50')).toBeVisible();
    await expect(page).toHaveURL(/\/reset-password\?token=fake-token$/);
  });

  test('should enforce minimum password length on reset-password', async ({ page }) => {
    await page.goto('/reset-password?token=fake-token');

    await page.locator('#password').fill('short');
    await page.locator('#confirm-password').fill('short');
    await page.getByRole('button', { name: /réinitialiser|reset|modifier/i }).click();

    const passwordValidity = await page.locator('#password').evaluate((input) => {
      const element = input as HTMLInputElement;
      return {
        tooShort: element.validity.tooShort,
        valid: element.validity.valid,
      };
    });

    expect(passwordValidity.tooShort).toBe(true);
    expect(passwordValidity.valid).toBe(false);
    await expect(page).toHaveURL(/\/reset-password\?token=fake-token$/);
  });
});
