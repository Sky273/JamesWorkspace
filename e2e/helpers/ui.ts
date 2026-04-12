import { expect, type APIResponse, type Locator, type Page } from '@playwright/test';

export const REFRESH_LABEL_REGEX = /actualiser|rafra[iî]chir|refresh/i;
export const EDIT_LABEL_REGEX = /modifier|edit/i;
export const DELETE_LABEL_REGEX = /supprimer|delete/i;
export const SAVE_LABEL_REGEX = /enregistrer|save|sauvegarder/i;
export const CONFIRM_LABEL_REGEX = /confirmer|confirm|supprimer|delete/i;
export const CANCEL_LABEL_REGEX = /annuler|cancel/i;

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()} ${Math.floor(Math.random() * 1000)}`;
}

export async function clickRefreshButton(page: Page): Promise<void> {
  const button = page
    .locator('button[title*="Actualiser" i], button[title*="Refresh" i], button[title*="Rafra" i], button[aria-label*="Actualiser" i], button[aria-label*="Refresh" i], button[aria-label*="Rafra" i]')
    .first();

  if (await button.count()) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await expect(button).toBeVisible();
        await button.click({ timeout: 5_000 });
        return;
      } catch (error) {
        if (attempt === 2) {
          throw error;
        }
        await page.waitForTimeout(250);
      }
    }
  }

  await page.getByRole('button', { name: REFRESH_LABEL_REGEX }).first().click({ timeout: 5_000 });
}

export async function deleteViaApi(page: Page, path: string): Promise<APIResponse> {
  const request = page.context().request;
  const csrfResponse = await request.get('/api/csrf-token');
  expect(csrfResponse.ok()).toBe(true);
  const csrfPayload = await csrfResponse.json();
  const csrfToken = typeof csrfPayload?.csrfToken === 'string' ? csrfPayload.csrfToken : '';

  return request.delete(path, {
    headers: {
      'x-csrf-token': csrfToken,
    },
  });
}

export async function getJsonViaApi<T>(page: Page, path: string): Promise<T> {
  const request = page.context().request;
  const response = await request.get(path);
  expect(response.ok()).toBe(true);
  return response.json() as Promise<T>;
}

export async function clickConfirmButton(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog').last();

  if (await dialog.count()) {
    const button = dialog.getByRole('button', { name: CONFIRM_LABEL_REGEX }).last();
    await expect(button).toBeVisible();
    await button.evaluate((element) => {
      (element as HTMLButtonElement).click();
    });
    return;
  }

  const button = page.getByRole('button', { name: CONFIRM_LABEL_REGEX }).last();
  await expect(button).toBeVisible();
  await button.evaluate((element) => {
    (element as HTMLButtonElement).click();
  });
}

export async function fillProseMirror(page: Page, index: number, text: string): Promise<void> {
  const editor = page.locator('.ProseMirror').nth(index);
  await expect(editor).toBeVisible();
  await editor.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.type(text);
}

export function cardContaining(page: Page, text: string): Locator {
  return page.locator('article, [class*="card"], .lux-card').filter({ hasText: text }).first();
}

export function fieldFollowingLabel(root: Page | Locator, label: RegExp, kind: 'input' | 'textarea' | 'select' = 'input'): Locator {
  const fieldSelector = kind === 'input'
    ? 'xpath=following-sibling::input[1]'
    : kind === 'textarea'
      ? 'xpath=following-sibling::textarea[1]'
      : 'xpath=following-sibling::select[1]';

  return root.locator('label').filter({ hasText: label }).locator(fieldSelector);
}
