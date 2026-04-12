import { expect, test, type Page } from '@playwright/test';
import { signInAsE2EAdmin } from './helpers/auth';

type ReadyCheck =
  | { kind: 'heading'; name: RegExp }
  | { kind: 'placeholder'; name: RegExp }
  | { kind: 'button'; name: RegExp };

const cacheManagedPages: Array<{
  path: string;
  ready: ReadyCheck;
  refreshName: RegExp;
}> = [
  {
    path: '/dashboard/users',
    ready: { kind: 'heading', name: /utilisateurs|users/i },
    refreshName: /actualiser|rafra[iî]chir|refresh/i,
  },
  {
    path: '/clients',
    ready: { kind: 'placeholder', name: /rechercher un client ou prospect/i },
    refreshName: /actualiser|rafra[iî]chir|refresh/i,
  },
  {
    path: '/missions',
    ready: { kind: 'heading', name: /missions/i },
    refreshName: /actualiser|rafra[iî]chir|refresh/i,
  },
  {
    path: '/resumes',
    ready: { kind: 'button', name: /actualiser|rafra[iî]chir|refresh/i },
    refreshName: /actualiser|rafra[iî]chir|refresh/i,
  },
  {
    path: '/templates',
    ready: { kind: 'heading', name: /mod[eè]les|templates/i },
    refreshName: /actualiser|rafra[iî]chir|refresh/i,
  },
];

async function expectPageReady(page: Page, ready: ReadyCheck): Promise<void> {
  if (ready.kind === 'heading') {
    await expect(page.getByRole('heading', { name: ready.name }).first()).toBeVisible();
    return;
  }

  if (ready.kind === 'placeholder') {
    await expect(page.getByPlaceholder(ready.name).first()).toBeVisible();
    return;
  }

  await expect(page.getByRole('button', { name: ready.name }).first()).toBeVisible();
}

test.describe('Admin Cache Managed Pages', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsE2EAdmin(page);
  });

  for (const entry of cacheManagedPages) {
    test(`should render ${entry.path} with a refresh action`, async ({ page }) => {
      await page.goto(entry.path);
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(new RegExp(entry.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
      await expect(page.locator('#email-address')).toHaveCount(0);
      await expectPageReady(page, entry.ready);
      await expect(page.getByRole('button', { name: entry.refreshName }).first()).toBeVisible();
    });
  }
});
