import { expect, test } from '@playwright/test';
import { signInAsE2EAdmin } from './helpers/auth';
import { cardContaining, clickNamedButton, clickRefreshButton, DELETE_LABEL_REGEX, EDIT_LABEL_REGEX, SAVE_LABEL_REGEX, uniqueName } from './helpers/ui';

test.describe('Email templates CRUD flows', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await signInAsE2EAdmin(page);
  });

  test('should create, update and delete an email template with real refresh behaviour', async ({ page }) => {
    const templateName = uniqueName('Email Template E2E');
    const updatedTemplateName = `${templateName} Updated`;

    await page.goto('/email-templates');
    await expect(page.getByRole('heading', { name: /templates email|email templates/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /nouveau template|new template/i }).click();
    await page.getByPlaceholder(/candidature standard/i).fill(templateName);
    await page.getByPlaceholder(/description du template/i).fill('Template email Playwright');
    await page.getByPlaceholder(/candidature - .*resume\.name/i).fill(`Sujet ${templateName}`);
    await page.locator('textarea[data-block-id]').first().fill(`Bonjour {{contact.firstName}}, ${templateName}`);
    await clickNamedButton(page, SAVE_LABEL_REGEX);

    await expect(cardContaining(page, templateName)).toBeVisible();
    await clickRefreshButton(page);
    await expect(cardContaining(page, templateName)).toBeVisible();

    const templateCard = cardContaining(page, templateName);
    await templateCard.getByRole('button', { name: EDIT_LABEL_REGEX }).click();
    await page.getByPlaceholder(/candidature standard/i).fill(updatedTemplateName);
    await clickNamedButton(page, SAVE_LABEL_REGEX);

    await expect(cardContaining(page, updatedTemplateName)).toBeVisible();
    await clickRefreshButton(page);
    await expect(cardContaining(page, updatedTemplateName)).toBeVisible();

    page.once('dialog', (dialog) => dialog.accept());
    await cardContaining(page, updatedTemplateName).getByRole('button', { name: DELETE_LABEL_REGEX }).click();
    await expect(cardContaining(page, updatedTemplateName)).toHaveCount(0);
    await clickRefreshButton(page);
    await expect(cardContaining(page, updatedTemplateName)).toHaveCount(0);
  });
});
