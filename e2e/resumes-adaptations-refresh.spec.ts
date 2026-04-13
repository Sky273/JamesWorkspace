import { expect, test } from '@playwright/test';
import { signInAsE2EAdmin } from './helpers/auth';
import {
  createAdaptationFixture,
  createClientFixture,
  createDealFixture,
  createMissionFixture,
  uploadResumeAndWaitForAnalysis,
} from './helpers/crud';
import {
  cardContaining,
  clickRefreshButton,
  deleteViaApi,
  postJsonViaApi,
  uniqueName,
} from './helpers/ui';

function adaptationHeading(page, text: string) {
  return page.getByRole('heading', {
    name: new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
  }).first();
}

test.describe('Resumes and adaptations refresh flows', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(300_000);

  test.beforeEach(async ({ page }) => {
    await signInAsE2EAdmin(page);
  });

  test('should keep CVthèque and adaptations views coherent across list and by-deal modes', async ({ page }) => {
    const clientName = uniqueName('Client Resume E2E');
    const dealTitle = uniqueName('Deal Resume E2E');
    const missionTitle = uniqueName('Mission Resume E2E');
    const candidateName = uniqueName('Candidate Resume E2E');

    const client = await createClientFixture(page, { name: clientName, type: 'client' });
    const deal = await createDealFixture(page, { title: dealTitle, clientId: client.id });
    const mission = await createMissionFixture(page, { title: missionTitle, clientId: client.id, dealId: deal.id });

    const { resumeId, displayName } = await uploadResumeAndWaitForAnalysis(page, candidateName);

    await page.goto('/resumes');
    await expect(page.getByRole('heading', { name: /cvth[eè]que|resumes/i }).first()).toBeVisible();

    const resumeSearch = page.getByPlaceholder(/rechercher/i).first();
    await resumeSearch.fill(displayName);
    await expect(cardContaining(page, displayName)).toBeVisible();
    await clickRefreshButton(page);
    await expect(cardContaining(page, displayName)).toBeVisible();

    await postJsonViaApi(page, `/api/deals/${deal.id}/resumes`, {
      resumeId,
      status: 'new',
    });

    await page.getByRole('button', { name: /par affaire/i }).click();
    await clickRefreshButton(page);
    await expect(page.getByText(displayName).first()).toBeVisible();

    const { adaptationId } = await createAdaptationFixture(page, { resumeId, missionId: mission.id });
    await page.goto(`/adaptations/${adaptationId}`);
    await expect(page).toHaveURL(/\/adaptations\/[^/]+$/, { timeout: 30_000 });

    await page.goto('/adaptations');
    await page.getByRole('button', { name: /liste/i }).click();
    const adaptationSearch = page.getByPlaceholder(/rechercher/i).first();
    await adaptationSearch.fill(displayName);
    await expect(adaptationHeading(page, candidateName)).toBeVisible();
    await clickRefreshButton(page);
    await expect(adaptationHeading(page, candidateName)).toBeVisible();

    await page.getByRole('button', { name: /par affaire/i }).click();
    await clickRefreshButton(page);
    await expect(page.getByText(displayName).first()).toBeVisible();

    await page.getByRole('button', { name: /liste/i }).click();
    await adaptationSearch.fill(displayName);
    await expect(adaptationHeading(page, candidateName)).toBeVisible();
    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByRole('button', { name: /supprimer|delete/i }).last().click();
    await clickRefreshButton(page);
    await expect(adaptationHeading(page, candidateName)).toHaveCount(0);

    await page.goto('/resumes');
    await page.getByRole('button', { name: /liste/i }).click();
    await resumeSearch.fill(displayName);
    await cardContaining(page, displayName).getByRole('button', { name: /supprimer|delete/i }).click();
    await page.getByRole('button', { name: /confirmer|confirm|supprimer|delete/i }).last().click();
    await clickRefreshButton(page);
    await expect(cardContaining(page, displayName)).toHaveCount(0);

    await page.getByRole('button', { name: /par affaire/i }).click();
    await clickRefreshButton(page);
    await expect(page.getByText(displayName)).toHaveCount(0);

    const deleteMissionResponse = await deleteViaApi(page, `/api/missions/${mission.id}`);
    expect(deleteMissionResponse.ok()).toBe(true);
    const deleteDealResponse = await deleteViaApi(page, `/api/deals/${deal.id}`);
    expect(deleteDealResponse.ok()).toBe(true);
    const deleteClientResponse = await deleteViaApi(page, `/api/clients/${client.id}`);
    expect(deleteClientResponse.ok()).toBe(true);
  });
});
