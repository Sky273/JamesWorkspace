import { expect, test } from '@playwright/test';
import { signInAsE2EAdmin } from './helpers/auth';
import {
  cardContaining,
  clickConfirmButton,
  clickRefreshButton,
  EDIT_LABEL_REGEX,
  fieldFollowingLabel,
  fillProseMirror,
  SAVE_LABEL_REGEX,
  uniqueName,
} from './helpers/ui';

test.describe('CRM CRUD flows', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsE2EAdmin(page);
  });

  test('should create, update and delete client, contact, deal and mission with consistent refresh behaviour', async ({ page }) => {
    const clientName = uniqueName('Client E2E');
    const updatedClientName = `${clientName} Updated`;
    const contactName = uniqueName('Contact E2E');
    const updatedContactName = `${contactName} Updated`;
    const dealTitle = uniqueName('Deal E2E');
    const updatedDealTitle = `${dealTitle} Updated`;
    const missionTitle = uniqueName('Mission E2E');
    const updatedMissionTitle = `${missionTitle} Updated`;

    await page.goto('/clients');
    await expect(page.getByRole('heading', { name: /crm|clients|prospects/i }).first()).toBeVisible();

    await page.getByRole('button', { name: /add client|ajouter/i }).click();
    await fieldFollowingLabel(page, /nom|name/i).fill(clientName);
    await fieldFollowingLabel(page, /^type/i, 'select').selectOption('client');
    await fieldFollowingLabel(page, /secteur|industry/i, 'select').selectOption({ index: 1 }).catch(async () => {
      // Some fixtures may only expose the empty placeholder.
    });
    await page.getByRole('button', { name: SAVE_LABEL_REGEX }).click();

    await expect(cardContaining(page, clientName)).toBeVisible();
    await clickRefreshButton(page);
    await expect(cardContaining(page, clientName)).toBeVisible();

    const clientCard = cardContaining(page, clientName);
    await clientCard.getByRole('button', { name: EDIT_LABEL_REGEX }).click();
    await fieldFollowingLabel(page, /nom|name/i).fill(updatedClientName);
    await page.getByRole('button', { name: SAVE_LABEL_REGEX }).click();

    await expect(cardContaining(page, updatedClientName)).toBeVisible();
    await clickRefreshButton(page);
    await expect(cardContaining(page, updatedClientName)).toBeVisible();

    const updatedClientCard = cardContaining(page, updatedClientName);
    await updatedClientCard.getByRole('button', { name: /view|voir/i }).click();
    await expect(page.getByText(updatedClientName)).toBeVisible();

    await page.getByRole('button', { name: /add contact|ajouter un contact/i }).click();
    await fieldFollowingLabel(page, /nom|contact name/i).fill(contactName);
    await fieldFollowingLabel(page, /^r[oô]le$|^role$/i).fill('Manager');
    await fieldFollowingLabel(page, /email/i).fill(`contact-${Date.now()}@example.com`);
    await page.getByRole('button', { name: SAVE_LABEL_REGEX }).click();

    await expect(page.getByText(contactName)).toBeVisible();
    await page.getByRole('button', { name: /actualiser.*contacts|refresh.*contacts/i }).click();
    await expect(page.getByText(contactName)).toBeVisible();

    const contactRow = page.locator('[class*="border"]').filter({ hasText: contactName }).first();
    await contactRow.locator('button').nth(0).click();
    await fieldFollowingLabel(page, /nom|contact name/i).fill(updatedContactName);
    await page.getByRole('button', { name: SAVE_LABEL_REGEX }).click();

    await expect(page.getByText(updatedContactName)).toBeVisible();

    await page.getByRole('button', { name: /deals|affaires/i }).click();
    await expect(page).toHaveURL(/\/clients\?tab=deals/);
    await page.getByRole('button', { name: /add|ajouter/i }).click();
    await fieldFollowingLabel(page, /nom|name/i).fill(dealTitle);
    await fieldFollowingLabel(page, /client/i, 'select').selectOption({ label: new RegExp(updatedClientName, 'i') }).catch(async () => {
      await fieldFollowingLabel(page, /client/i, 'select').selectOption({ index: 1 });
    });
    await fieldFollowingLabel(page, /contact/i, 'select').selectOption({ label: new RegExp(updatedContactName, 'i') }).catch(async () => {
      await fieldFollowingLabel(page, /contact/i, 'select').selectOption({ index: 1 });
    });
    await page.getByRole('button', { name: SAVE_LABEL_REGEX }).click();

    await expect(cardContaining(page, dealTitle)).toBeVisible();
    await clickRefreshButton(page);
    await expect(cardContaining(page, dealTitle)).toBeVisible();

    const dealCard = cardContaining(page, dealTitle);
    await dealCard.locator(`button[title*="Edit" i], button[title*="Modifier" i]`).click();
    await fieldFollowingLabel(page, /nom|name/i).fill(updatedDealTitle);
    await page.getByRole('button', { name: SAVE_LABEL_REGEX }).click();

    await expect(cardContaining(page, updatedDealTitle)).toBeVisible();

    await page.goto('/missions');
    await expect(page.getByRole('heading', { name: /missions/i }).first()).toBeVisible();
    await page.getByRole('button', { name: /add mission|ajouter une mission/i }).click();
    await fieldFollowingLabel(page, /titre|mission title/i).fill(missionTitle);
    await fieldFollowingLabel(page, /client/i, 'select').selectOption({ label: new RegExp(updatedClientName, 'i') }).catch(async () => {
      await fieldFollowingLabel(page, /client/i, 'select').selectOption({ index: 1 });
    });
    await fieldFollowingLabel(page, /affaire|deal/i, 'select').selectOption({ label: new RegExp(updatedDealTitle, 'i') }).catch(async () => {
      await fieldFollowingLabel(page, /affaire|deal/i, 'select').selectOption({ index: 1 });
    });
    await fillProseMirror(page, 0, 'Mission body E2E');
    await page.getByRole('button', { name: /create|cr[eé]er/i }).click();

    await expect(cardContaining(page, missionTitle)).toBeVisible();
    await clickRefreshButton(page);
    await expect(cardContaining(page, missionTitle)).toBeVisible();

    const missionCard = page.locator('article').filter({ hasText: missionTitle }).first();
    await missionCard.locator(`button[title*="Edit" i], button[title*="Modifier" i]`).click();
    await fieldFollowingLabel(page, /titre|mission title/i).fill(updatedMissionTitle);
    await page.getByRole('button', { name: /update|mettre.*jour|enregistrer/i }).click();

    await expect(page.locator('article').filter({ hasText: updatedMissionTitle }).first()).toBeVisible();
    await clickRefreshButton(page);
    await expect(page.locator('article').filter({ hasText: updatedMissionTitle }).first()).toBeVisible();

    const updatedMissionCard = page.locator('article').filter({ hasText: updatedMissionTitle }).first();
    await updatedMissionCard.locator(`button[title*="Delete" i], button[title*="Supprimer" i]`).click();
    await page.getByRole('button', { name: /delete|supprimer/i }).last().click();
    await expect(page.locator('article').filter({ hasText: updatedMissionTitle })).toHaveCount(0);
    await clickRefreshButton(page);
    await expect(page.locator('article').filter({ hasText: updatedMissionTitle })).toHaveCount(0);

    await page.goto('/clients?tab=deals');
    const updatedDealCard = cardContaining(page, updatedDealTitle);
    await updatedDealCard.locator(`button[title*="Delete" i], button[title*="Supprimer" i]`).click();
    await clickConfirmButton(page);
    await expect(cardContaining(page, updatedDealTitle)).toHaveCount(0);
    await clickRefreshButton(page);
    await expect(cardContaining(page, updatedDealTitle)).toHaveCount(0);

    await page.goto('/clients');
    const finalClientCard = cardContaining(page, updatedClientName);
    await finalClientCard.getByRole('button', { name: /view|voir/i }).click();
    const updatedContactRow = page.locator('[class*="border"]').filter({ hasText: updatedContactName }).first();
    await updatedContactRow.locator('button').nth(1).click();
    await clickConfirmButton(page);
    await expect(page.getByText(updatedContactName)).toHaveCount(0);
    await page.getByRole('button', { name: /close|fermer|annuler/i }).first().click();

    const clientCardAfterContactDelete = cardContaining(page, updatedClientName);
    await clientCardAfterContactDelete.locator(`button[title*="Delete" i], button[title*="Supprimer" i]`).click();
    await clickConfirmButton(page);
    await expect(cardContaining(page, updatedClientName)).toHaveCount(0);
    await clickRefreshButton(page);
    await expect(cardContaining(page, updatedClientName)).toHaveCount(0);
  });
});
