import { expect, test } from '@playwright/test';

import { getE2EAdminFirmId, signInAsE2EAdmin } from './helpers/auth';
import { expectHiddenAfterRefresh, expectVisibleAfterRefresh } from './helpers/refresh';
import {
  cardContaining,
  deleteViaApi,
  EDIT_LABEL_REGEX,
  fieldFollowingLabel,
  fillProseMirror,
  getJsonViaApi,
  postJsonViaApi,
  putJsonViaApi,
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
    const adminFirmId = await getE2EAdminFirmId();

    await page.goto('/admin?tab=firms');
    await expect(page).toHaveURL(/\/admin\?tab=firms$/);
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
    await expectVisibleAfterRefresh(page, () => cardContaining(page, firmName));

    await putJsonViaApi(page, `/api/firms/${createdFirm.id}`, { name: updatedFirmName });
    await firmSearch.fill(updatedFirmName);
    await expect(firmSearch).toHaveValue(updatedFirmName);
    await expect.poll(async () => {
      const firmsLookup = await getJsonViaApi<{ data?: Array<{ name: string }> }>(
        page,
        `/api/firms?search=${encodeURIComponent(updatedFirmName)}&refresh=1`,
      );
      return firmsLookup.data?.some((firm) => firm.name === updatedFirmName) ?? false;
    }).toBe(true);
    await expectVisibleAfterRefresh(page, () => cardContaining(page, updatedFirmName));

    const deleteFirmResponse = await deleteViaApi(page, `/api/firms/${createdFirm.id}`);
    await expect(deleteFirmResponse.ok()).toBeTruthy();
    await expectHiddenAfterRefresh(page, () => cardContaining(page, updatedFirmName));

    await page.goto('/admin?tab=users');
    await expect(page).toHaveURL(/\/admin\?tab=users$/);
    const resetFiltersButton = page.getByRole('button', { name: /réinitialiser|reset/i }).first();
    if (await resetFiltersButton.count()) {
      await resetFiltersButton.click();
    }

    const createdUserPayload = await postJsonViaApi<{
      id: string;
      email: string;
      firmId?: string;
    }>(page, '/api/auth/users', {
      name: userName,
      email: userEmail,
      jobTitle: 'QA E2E',
      phone: '',
      firmId: adminFirmId,
      role: 'localAdmin',
      status: 'active',
    });

    const userSearch = page.getByPlaceholder(/rechercher un utilisateur|search users/i).first();
    await userSearch.fill(userName);
    await expect(userSearch).toHaveValue(userName);
    await expectVisibleAfterRefresh(page, () => cardContaining(page, userName), {
      beforeRefresh: async () => {
        await userSearch.fill(userName);
      },
      afterRefresh: async () => {
        await userSearch.fill(userName);
      },
    });

    const usersLookup = await getJsonViaApi<{ data?: Array<{ id: string; email: string; firmId?: string }> }>(
      page,
      `/api/users?search=${encodeURIComponent(userEmail)}&refresh=1`,
    );
    const createdUser = usersLookup.data?.find((user) => user.email === createdUserPayload.email);
    expect(createdUser?.id).toBeTruthy();

    await putJsonViaApi(page, `/api/auth/users/${createdUser!.id}`, {
      name: updatedUserName,
      email: userEmail,
      jobTitle: 'QA E2E',
      phone: '',
      firmId: createdUserPayload.firmId || createdUser?.firmId || adminFirmId,
      role: 'localAdmin',
      status: 'active',
    });
    await userSearch.fill(updatedUserName);
    await expect(userSearch).toHaveValue(updatedUserName);
    await expect.poll(async () => {
      const usersLookupAfterUpdate = await getJsonViaApi<{ data?: Array<{ name?: string; Name?: string }> }>(
        page,
        `/api/users?search=${encodeURIComponent(userEmail)}&refresh=1`,
      );
      return usersLookupAfterUpdate.data?.some((user) => (user.name || user.Name) === updatedUserName) ?? false;
    }, { timeout: 15000 }).toBe(true);
    await expectVisibleAfterRefresh(page, () => cardContaining(page, updatedUserName), {
      beforeRefresh: async () => {
        await userSearch.fill(updatedUserName);
      },
      afterRefresh: async () => {
        await userSearch.fill(updatedUserName);
      },
    });

    const deleteUserResponse = await deleteViaApi(page, `/api/auth/users/${createdUser!.id}`);
    await expect(deleteUserResponse.ok()).toBeTruthy();
    await expectHiddenAfterRefresh(page, () => cardContaining(page, updatedUserName), {
      beforeRefresh: async () => {
        await userSearch.fill(updatedUserName);
      },
      afterRefresh: async () => {
        await userSearch.fill(updatedUserName);
      },
    });
  });

  test('should create, update and delete a CV template from the UI', async ({ page }) => {
    const templateName = uniqueName('Template E2E');
    const updatedTemplateName = `${templateName} Updated`;

    await page.goto('/admin?tab=templates');
    await expect(page).toHaveURL(/\/admin\?tab=templates$/);
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

    await expect(page).toHaveURL(/\/admin\?tab=templates$/);
    const templateSearch = page.getByRole('textbox').first();
    await templateSearch.fill(templateName);
    await expect.poll(async () => {
      const templatesLookup = await getJsonViaApi<{ data?: Array<{ Name: string }> }>(
        page,
        `/api/templates?search=${encodeURIComponent(templateName)}&refresh=1`,
      );
      return templatesLookup.data?.some((template) => template.Name === templateName) ?? false;
    }).toBe(true);
    await expectVisibleAfterRefresh(page, () => page.getByText(templateName).first());

    const templateCard = cardContaining(page, templateName);
    await templateCard.getByRole('button', { name: EDIT_LABEL_REGEX }).click();
    const updateTemplateResponsePromise = page.waitForResponse((response) => response.request().method() === 'PUT' && /\/api\/templates\//.test(response.url()));
    await page.locator('#name').fill(updatedTemplateName);
    await page.getByRole('button', { name: SAVE_LABEL_REGEX }).click();
    const updateTemplateResponse = await updateTemplateResponsePromise;
    await expect(updateTemplateResponse.ok()).toBeTruthy();

    await expect(page).toHaveURL(/\/admin\?tab=templates$/);
    await templateSearch.fill(updatedTemplateName);
    await expect.poll(async () => {
      const templatesLookup = await getJsonViaApi<{ data?: Array<{ Name: string }> }>(
        page,
        `/api/templates?search=${encodeURIComponent(updatedTemplateName)}&refresh=1`,
      );
      return templatesLookup.data?.some((template) => template.Name === updatedTemplateName) ?? false;
    }).toBe(true);
    await expectVisibleAfterRefresh(page, () => page.getByText(updatedTemplateName).first());

    const updatedTemplateCard = cardContaining(page, updatedTemplateName);
    await updatedTemplateCard.locator(`button[title*="Delete" i], button[title*="Supprimer" i]`).click();
    await page.getByRole('button', { name: /delete|supprimer/i }).last().click();
    await expectHiddenAfterRefresh(page, () => cardContaining(page, updatedTemplateName));
  });
});
