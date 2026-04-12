import { expect, test } from '@playwright/test';
import { signInAsE2EAdmin } from './helpers/auth';
import {
  cardContaining,
  clickRefreshButton,
  deleteViaApi,
  EDIT_LABEL_REGEX,
  fieldFollowingLabel,
  fillProseMirror,
  getJsonViaApi,
  SAVE_LABEL_REGEX,
  uniqueName,
} from './helpers/ui';

test.describe('Admin CRUD flows', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90000);

  test.beforeEach(async ({ page }) => {
    await signInAsE2EAdmin(page);
  });

  test('should create, update and delete a firm and a user with stable refresh behaviour', async ({ page }) => {
    const firmName = uniqueName('Firm E2E');
    const updatedFirmName = `${firmName} Updated`;
    const userName = uniqueName('User E2E');
    const updatedUserName = `${userName} Updated`;
    const userEmail = `e2e-${Date.now()}@example.com`;

    await page.goto('/dashboard/users');
    await expect(page.getByRole('heading', { name: /users|utilisateurs/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /firms|cabinets/i }).click();
    await page.getByRole('button', { name: /add firm|ajouter.*cabinet/i }).click();
    const createFirmResponsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/firms$/.test(response.url()));
    await fieldFollowingLabel(page, /nom|name/i).fill(firmName);
    await page.getByRole('button', { name: SAVE_LABEL_REGEX }).click({ force: true });
    const createdFirmResponse = await createFirmResponsePromise;
    await expect(createdFirmResponse.ok()).toBeTruthy();
    const createdFirm = await createdFirmResponse.json();
    const firmSearch = page.getByPlaceholder(/rechercher un cabinet|search firms/i);
    await firmSearch.fill(firmName);
    await expect(firmSearch).toHaveValue(firmName);
    await expect.poll(async () => {
      const firmsLookup = await getJsonViaApi<{ data?: Array<{ name: string }> }>(
        page,
        `/api/firms?search=${encodeURIComponent(firmName)}&refresh=1`,
      );
      return firmsLookup.data?.some((firm) => firm.name === firmName) ?? false;
    }).toBe(true);

    await expect(cardContaining(page, firmName)).toBeVisible();
    await clickRefreshButton(page);
    await expect(cardContaining(page, firmName)).toBeVisible();

    const firmCard = cardContaining(page, firmName);
    await expect(firmCard).toBeVisible();
    await firmCard.getByRole('button', { name: EDIT_LABEL_REGEX }).click({ force: true });
    await fieldFollowingLabel(page, /nom|name/i).fill(updatedFirmName);
    await page.keyboard.press('Enter');
    await firmSearch.fill(updatedFirmName);
    await expect(firmSearch).toHaveValue(updatedFirmName);
    await expect.poll(async () => {
      const firmsLookup = await getJsonViaApi<{ data?: Array<{ name: string }> }>(
        page,
        `/api/firms?search=${encodeURIComponent(updatedFirmName)}&refresh=1`,
      );
      return firmsLookup.data?.some((firm) => firm.name === updatedFirmName) ?? false;
    }).toBe(true);

    await expect(cardContaining(page, updatedFirmName)).toBeVisible();
    await clickRefreshButton(page);
    await expect(cardContaining(page, updatedFirmName)).toBeVisible();

    const deleteFirmResponse = await deleteViaApi(page, `/api/firms/${createdFirm.id}`);
    await expect(deleteFirmResponse.ok()).toBeTruthy();
    await clickRefreshButton(page);
    await expect(cardContaining(page, updatedFirmName)).toHaveCount(0);

    await page.getByRole('button', { name: /^(utilisateurs|users)/i }).first().click();
    const resetFiltersButton = page.getByRole('button', { name: /réinitialiser|reset/i }).first();
    if (await resetFiltersButton.count()) {
      await resetFiltersButton.click();
    }
    await page.getByRole('button', { name: /add user|ajouter.*utilisateur/i }).click();
    const createUserDialog = page.getByRole('dialog', { name: /ajouter un utilisateur|add user/i });
    await expect(createUserDialog).toBeVisible();
    await createUserDialog.getByPlaceholder(/jean dupont/i).fill(userName);
    await createUserDialog.getByPlaceholder(/prenom\.nom@cabinet\.fr/i).fill(userEmail);
    await createUserDialog.getByPlaceholder(/consultant, manager/i).fill('QA E2E');
    await createUserDialog.getByRole('button', { name: SAVE_LABEL_REGEX }).click({ force: true });
    await expect(createUserDialog).toHaveCount(0);
    const userSearch = page.getByPlaceholder(/rechercher un utilisateur|search users/i).first();
    await userSearch.fill(userName);
    await expect(userSearch).toHaveValue(userName);
    await expect(cardContaining(page, userName)).toBeVisible();
    const usersLookup = await getJsonViaApi<{ data?: Array<{ id: string; email: string }> }>(
      page,
      `/api/users?search=${encodeURIComponent(userEmail)}&refresh=1`,
    );
    const createdUser = usersLookup.data?.find((user) => user.email === userEmail);
    expect(createdUser?.id).toBeTruthy();

    const userCard = cardContaining(page, userName);
    await expect(userCard).toBeVisible();
    await userCard.getByRole('button', { name: EDIT_LABEL_REGEX }).click({ force: true });
    const editUserDialog = page.getByRole('dialog', { name: /modifier.+utilisateur|edit user/i });
    await expect(editUserDialog).toBeVisible();
    await editUserDialog.getByPlaceholder(/jean dupont/i).fill(updatedUserName);
    await editUserDialog.getByRole('button', { name: /save changes|enregistrer|save/i }).click({ force: true });
    await expect(editUserDialog).toHaveCount(0);
    await userSearch.fill(updatedUserName);
    await expect(userSearch).toHaveValue(updatedUserName);
    await expect(cardContaining(page, updatedUserName)).toBeVisible();

    const deleteUserResponse = await deleteViaApi(page, `/api/auth/users/${createdUser!.id}`);
    await expect(deleteUserResponse.ok()).toBeTruthy();
    await clickRefreshButton(page);
    await expect(cardContaining(page, updatedUserName)).toHaveCount(0);
  });

  test('should create, update and delete a CV template from the UI', async ({ page }) => {
    const templateName = uniqueName('Template E2E');
    const updatedTemplateName = `${templateName} Updated`;

    await page.goto('/templates');
    await expect(page).toHaveURL(/\/templates$/);
    await expect(page.getByRole('button', { name: /new template|nouveau/i })).toBeVisible();

    await page.getByRole('button', { name: /new template|nouveau/i }).click();
    await expect(page.locator('#name')).toBeVisible();

    const createTemplateResponsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && /\/api\/templates$/.test(response.url()));
    await page.locator('#name').fill(templateName);
    await page.locator('#description').fill('Playwright template coverage');
    await fillProseMirror(page, 0, 'Header E2E');
    await fillProseMirror(page, 1, 'Body E2E');
    await fillProseMirror(page, 2, 'Footer E2E');
    await page.getByRole('button', { name: SAVE_LABEL_REGEX }).click({ force: true });
    const createdTemplateResponse = await createTemplateResponsePromise;
    await expect(createdTemplateResponse.ok()).toBeTruthy();
    const createdTemplate = await createdTemplateResponse.json();

    await expect(page).toHaveURL(/\/templates$/);
    const templateSearch = page.getByRole('textbox').first();
    await templateSearch.fill(templateName);
    await expect.poll(async () => {
      const templatesLookup = await getJsonViaApi<{ data?: Array<{ Name: string }> }>(
        page,
        `/api/templates?search=${encodeURIComponent(templateName)}&refresh=1`,
      );
      return templatesLookup.data?.some((template) => template.Name === templateName) ?? false;
    }).toBe(true);
    await expect(cardContaining(page, templateName)).toBeVisible();
    await clickRefreshButton(page);
    await expect(cardContaining(page, templateName)).toBeVisible();

    const templateCard = cardContaining(page, templateName);
    await templateCard.getByRole('button', { name: EDIT_LABEL_REGEX }).click();
    const updateTemplateResponsePromise = page.waitForResponse((response) => response.request().method() === 'PUT' && /\/api\/templates\//.test(response.url()));
    await page.locator('#name').fill(updatedTemplateName);
    await page.getByRole('button', { name: SAVE_LABEL_REGEX }).click();
    const updateTemplateResponse = await updateTemplateResponsePromise;
    await expect(updateTemplateResponse.ok()).toBeTruthy();

    await expect(page).toHaveURL(/\/templates$/);
    await templateSearch.fill(updatedTemplateName);
    await expect.poll(async () => {
      const templatesLookup = await getJsonViaApi<{ data?: Array<{ Name: string }> }>(
        page,
        `/api/templates?search=${encodeURIComponent(updatedTemplateName)}&refresh=1`,
      );
      return templatesLookup.data?.some((template) => template.Name === updatedTemplateName) ?? false;
    }).toBe(true);
    await expect(cardContaining(page, updatedTemplateName)).toBeVisible();
    await clickRefreshButton(page);
    await expect(cardContaining(page, updatedTemplateName)).toBeVisible();

    const updatedTemplateCard = cardContaining(page, updatedTemplateName);
    await updatedTemplateCard.locator(`button[title*="Delete" i], button[title*="Supprimer" i]`).click();
    await page.getByRole('button', { name: /delete|supprimer/i }).last().click();
    await clickRefreshButton(page);
    await expect(cardContaining(page, updatedTemplateName)).toHaveCount(0);
  });
});

