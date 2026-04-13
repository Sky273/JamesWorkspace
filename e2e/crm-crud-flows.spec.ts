import { expect, test, type Page } from '@playwright/test';
import { signInAsE2EAdmin } from './helpers/auth';
import { createDealFixture, createMissionFixture } from './helpers/crud';
import { expectHiddenAfterRefresh, expectVisibleAfterRefresh } from './helpers/refresh';
import {
  cardContaining,
  clickNamedButton,
  deleteViaApi,
  EDIT_LABEL_REGEX,
  fieldFollowingLabel,
  putJsonViaApi,
  SAVE_LABEL_REGEX,
  uniqueName,
} from './helpers/ui';

function escapedRegex(text: string): RegExp {
  return new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

async function searchClients(page: Page, term: string): Promise<void> {
  await page.getByPlaceholder(/rechercher un client|search.*client/i).fill(term);
  await page.waitForTimeout(350);
}

async function searchDeals(page: Page, term: string): Promise<void> {
  await page.getByPlaceholder(/rechercher une affaire|search.*deal/i).fill(term);
  await page.waitForTimeout(350);
}

async function searchMissions(page: Page, term: string): Promise<void> {
  await page.getByPlaceholder(/rechercher une mission|search.*mission/i).fill(term);
  await page.waitForTimeout(350);
}

function dealCardByTitle(page: Page, title: string) {
  return page
    .getByRole('heading', { name: escapedRegex(title) })
    .locator('xpath=ancestor::div[contains(@class,"shadow")][1]')
    .first();
}

test.describe('CRM CRUD flows', () => {
  test.setTimeout(60_000);

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
    await page.getByRole('dialog').last().getByRole('button', { name: SAVE_LABEL_REGEX }).last().click({ force: true });

    await expectVisibleAfterRefresh(page, () => cardContaining(page, clientName), {
      afterRefresh: async () => searchClients(page, clientName),
    });

    const clientCard = cardContaining(page, clientName);
    await clientCard.getByRole('button', { name: EDIT_LABEL_REGEX }).click();
    await fieldFollowingLabel(page, /nom|name/i).fill(updatedClientName);
    await clickNamedButton(page, SAVE_LABEL_REGEX);

    await expectVisibleAfterRefresh(page, () => cardContaining(page, updatedClientName), {
      afterRefresh: async () => searchClients(page, updatedClientName),
    });

    const updatedClientCard = cardContaining(page, updatedClientName);
    await updatedClientCard.getByRole('button', { name: /view|voir/i }).click();
    await expect(page.getByRole('heading', { name: escapedRegex(updatedClientName) }).last()).toBeVisible();

    await page.getByRole('button', { name: /add contact|ajouter un contact/i }).click();
    await fieldFollowingLabel(page, /nom|contact name/i).fill(contactName);
    await fieldFollowingLabel(page, /fonction|^r[oô]le$|^role$/i).fill('Manager');
    await fieldFollowingLabel(page, /email/i).fill(`contact-${Date.now()}@example.com`);
    await clickNamedButton(page, SAVE_LABEL_REGEX);

    await expect(page.getByText(contactName)).toBeVisible();
    await page.getByRole('button', { name: /actualiser.*contacts|refresh.*contacts/i }).click();
    await expect(page.getByText(contactName)).toBeVisible();

    const clientRecordResponse = await page.context().request.get(`/api/clients?search=${encodeURIComponent(updatedClientName)}&refresh=1`);
    expect(clientRecordResponse.ok()).toBe(true);
    const clientPayload = await clientRecordResponse.json() as { data?: Array<{ id: string }> };
    const currentClientId = clientPayload.data?.[0]?.id;
    expect(currentClientId).toBeTruthy();

    const createdContactDetailResponse = await page.context().request.get(`/api/clients/${currentClientId}?refresh=1`);
    expect(createdContactDetailResponse.ok()).toBe(true);
    const createdClientDetail = await createdContactDetailResponse.json() as { contacts?: Array<{ id: string; name: string }> };
    const createdContactId = createdClientDetail.contacts?.find((contact) => contact.name === contactName)?.id;
    expect(createdContactId).toBeTruthy();

    await putJsonViaApi(page, `/api/clients/${currentClientId}/contacts/${createdContactId}`, {
      name: updatedContactName,
      role: 'Manager',
    });

    await expect.poll(async () => {
      const contactDetailResponse = await page.context().request.get(`/api/clients/${currentClientId}?refresh=1`);
      if (!contactDetailResponse.ok()) {
        return false;
      }
      const clientDetail = await contactDetailResponse.json() as { contacts?: Array<{ id: string; name: string }> };
      return clientDetail.contacts?.some((contact) => contact.name === updatedContactName) ?? false;
    }).toBe(true);

    await page.getByRole('button', { name: /actualiser.*contacts|refresh.*contacts/i }).click();
    await expect(page.getByText(updatedContactName)).toBeVisible();

    const contactDetailResponse = await page.context().request.get(`/api/clients/${currentClientId}?refresh=1`);
    expect(contactDetailResponse.ok()).toBe(true);
    const clientDetail = await contactDetailResponse.json() as { contacts?: Array<{ id: string; name: string }> };
    const currentContactId = clientDetail.contacts?.find((contact) => contact.name === updatedContactName)?.id;
    expect(currentContactId).toBeTruthy();

    const createdDeal = await createDealFixture(page, {
      title: dealTitle,
      clientId: currentClientId,
      contactId: currentContactId,
    });

    await page.goto('/clients?tab=deals');
    await expect(page).toHaveURL(/\/clients\?tab=deals/);

    await searchDeals(page, dealTitle);
    await expectVisibleAfterRefresh(page, () => dealCardByTitle(page, dealTitle), {
      afterRefresh: async () => searchDeals(page, dealTitle),
    });

    await putJsonViaApi(page, `/api/deals/${createdDeal.id}`, { title: updatedDealTitle });

    await searchDeals(page, updatedDealTitle);
    await expectVisibleAfterRefresh(page, () => dealCardByTitle(page, updatedDealTitle), {
      beforeRefresh: async () => searchDeals(page, updatedDealTitle),
      afterRefresh: async () => searchDeals(page, updatedDealTitle),
    });

    const createdMission = await createMissionFixture(page, {
      title: missionTitle,
      clientId: currentClientId,
      dealId: createdDeal.id,
      content: 'Mission body E2E',
    });

    await page.goto('/missions');
    await expect(page.getByRole('heading', { name: /missions/i }).first()).toBeVisible();
    await page.getByRole('button', { name: /^liste$/i }).click();
    await searchMissions(page, missionTitle);

    await expectVisibleAfterRefresh(page, () => cardContaining(page, missionTitle), {
      afterRefresh: async () => searchMissions(page, missionTitle),
    });

    await putJsonViaApi(page, `/api/missions/${createdMission.id}`, { title: updatedMissionTitle });

    await searchMissions(page, updatedMissionTitle);
    await expect(page.locator('article').filter({ hasText: updatedMissionTitle }).first()).toBeVisible();
    await expectVisibleAfterRefresh(page, () => page.locator('article').filter({ hasText: updatedMissionTitle }).first(), {
      beforeRefresh: async () => searchMissions(page, updatedMissionTitle),
      afterRefresh: async () => searchMissions(page, updatedMissionTitle),
    });

    const deleteMissionResponse = await deleteViaApi(page, `/api/missions/${createdMission.id}`);
    expect(deleteMissionResponse.ok()).toBe(true);
    await expectHiddenAfterRefresh(page, () => page.locator('article').filter({ hasText: updatedMissionTitle }), {
      afterRefresh: async () => searchMissions(page, updatedMissionTitle),
    });

    await page.goto('/clients?tab=deals');
    await searchDeals(page, updatedDealTitle);
    const deleteDealResponse = await deleteViaApi(page, `/api/deals/${createdDeal.id}`);
    expect(deleteDealResponse.ok()).toBe(true);
    await expectHiddenAfterRefresh(page, () => dealCardByTitle(page, updatedDealTitle), {
      beforeRefresh: async () => searchDeals(page, updatedDealTitle),
      afterRefresh: async () => searchDeals(page, updatedDealTitle),
    });

    await page.goto('/clients');
    await searchClients(page, updatedClientName);
    const deleteContactResponse = await deleteViaApi(page, `/api/clients/${currentClientId}/contacts/${currentContactId}`);
    expect(deleteContactResponse.ok()).toBe(true);

    const deleteClientResponse = await deleteViaApi(page, `/api/clients/${currentClientId}`);
    expect(deleteClientResponse.ok()).toBe(true);
    await expectHiddenAfterRefresh(page, () => cardContaining(page, updatedClientName), {
      beforeRefresh: async () => searchClients(page, updatedClientName),
      afterRefresh: async () => searchClients(page, updatedClientName),
    });
  });
});
