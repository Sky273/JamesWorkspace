import { expect, type APIResponse, type Locator, type Page } from '@playwright/test';

export const REFRESH_LABEL_REGEX = /actualiser|rafraîchir|refresh/i;
export const EDIT_LABEL_REGEX = /modifier|edit/i;
export const DELETE_LABEL_REGEX = /supprimer|delete/i;
export const SAVE_LABEL_REGEX = /enregistrer|save|sauvegarder/i;
export const CONFIRM_LABEL_REGEX = /confirmer|confirm|supprimer|delete/i;
export const CANCEL_LABEL_REGEX = /annuler|cancel/i;
export const SIGNIN_HEADING_REGEX = /connectez-vous à votre compte|sign in to your account|connect|sign in|login/i;
export const REGISTER_ACCOUNT_LABEL_REGEX = /créer un compte|create an account/i;
export const RESET_PASSWORD_LABEL_REGEX = /réinitialiser|reset|modifier/i;
export const IMPROVE_LABEL_REGEX = /improve|améliorer|ameliorer/i;
export const LIST_VIEW_LABEL_REGEX = /liste|list/i;
export const BY_DEAL_VIEW_LABEL_REGEX = /par affaire|by deal/i;
export const EMPLOYEE_LABEL_REGEX = /employee|collaborateur/i;
export const CONTINUE_TO_UPLOAD_LABEL_REGEX = /continue to upload|continuer vers l'upload/i;
export const EXPORT_LABEL_REGEX = /export|exporter/i;

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now()} ${Math.floor(Math.random() * 1000)}`;
}

export function publicEntryLink(page: Page, target: 'signin' | 'register'): Locator {
  return page.locator(`a[href="/${target}"]`).first();
}

export function signInHeading(page: Page): Locator {
  return page.getByRole('heading', { name: SIGNIN_HEADING_REGEX }).first();
}

export async function clickButtonSafely(button: Locator): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await expect(button).toBeVisible();
      await button.scrollIntoViewIfNeeded();
      await button.click({ timeout: 5_000 });
      return;
    } catch (error) {
      if (attempt === 2) {
        try {
          await button.evaluate((element) => {
            (element as HTMLButtonElement).click();
          });
          return;
        } catch {
          throw error;
        }
      }

      await button.page().waitForTimeout(200);
    }
  }
}

export async function clickNamedButton(root: Page | Locator, name: RegExp): Promise<void> {
  const button = root.getByRole('button', { name }).last();
  await clickButtonSafely(button);
}

export async function gotoAndWaitForVisible(
  page: Page,
  path: string,
  locator: Locator,
  timeout = 30_000,
): Promise<void> {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await expect(locator).toBeVisible({ timeout });
}

export async function setInputFilesWhenReady(
  page: Page,
  files: string | string[] | { name: string; mimeType: string; buffer: Buffer },
  selector = 'input[type="file"]',
  timeout = 30_000,
): Promise<void> {
  const input = page.locator(selector);
  await expect(input).toBeVisible({ timeout });
  await input.setInputFiles(files);
}

export async function clickRefreshButton(page: Page): Promise<void> {
  const button = page
    .locator('button[title*="Actualiser" i], button[title*="Refresh" i], button[title*="Rafra" i], button[aria-label*="Actualiser" i], button[aria-label*="Refresh" i], button[aria-label*="Rafra" i]')
    .first();

  if (await button.count()) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await clickButtonSafely(button);
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

export async function switchToListView(page: Page): Promise<void> {
  await clickNamedButton(page, LIST_VIEW_LABEL_REGEX);
}

export async function switchToByDealView(page: Page): Promise<void> {
  await clickNamedButton(page, BY_DEAL_VIEW_LABEL_REGEX);
}

export async function deleteViaApi(page: Page, path: string): Promise<APIResponse> {
  const request = page.context().request;
  const csrfToken = await getCsrfToken(page);

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

export async function getCsrfToken(page: Page): Promise<string> {
  const request = page.context().request;
  const csrfResponse = await request.get('/api/csrf-token');
  expect(csrfResponse.ok()).toBe(true);
  const csrfPayload = await csrfResponse.json();
  return typeof csrfPayload?.csrfToken === 'string' ? csrfPayload.csrfToken : '';
}

export async function postJsonViaApi<TResponse = unknown>(page: Page, path: string, payload: unknown): Promise<TResponse> {
  const request = page.context().request;
  const csrfToken = await getCsrfToken(page);
  const response = await request.post(path, {
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    data: payload,
  });

  expect(response.ok()).toBe(true);
  return response.json() as Promise<TResponse>;
}

export async function putJsonViaApi<TResponse = unknown>(page: Page, path: string, payload: unknown): Promise<TResponse> {
  const request = page.context().request;
  const csrfToken = await getCsrfToken(page);
  const response = await request.put(path, {
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    data: payload,
  });

  expect(response.ok()).toBe(true);
  return response.json() as Promise<TResponse>;
}

export async function clickConfirmButton(page: Page): Promise<void> {
  const dialog = page.getByRole('dialog').last();

  if (await dialog.count()) {
    const button = dialog.getByRole('button', { name: CONFIRM_LABEL_REGEX }).last();
    await clickButtonSafely(button);
    return;
  }

  const button = page.getByRole('button', { name: CONFIRM_LABEL_REGEX }).last();
  await clickButtonSafely(button);
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
