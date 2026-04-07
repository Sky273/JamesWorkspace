import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import { signInAsE2EUser } from './helpers/auth';
import { ensureLongResumeFixture } from './helpers/docx';

const FALLBACK_DOCX_FIXTURE = path.resolve('node_modules/mammoth/test/test-data/tables.docx');

async function uploadResumeAndOpenAnalysis(page: Page) {
  const docxFixture = await ensureLongResumeFixture().catch(() => FALLBACK_DOCX_FIXTURE);

  await page.goto('/upload');

  await page.getByRole('button', { name: /employee|collaborateur/i }).click();
  await page.locator('#candidateName').fill('Jeanne Export E2E');
  await page.getByRole('button', { name: /continue to upload|continuer vers l'upload/i }).click();

  const createJobResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/batch-jobs') && response.request().method() === 'POST'
  );

  await page.locator('input[type="file"]').setInputFiles(docxFixture);

  const createJobResponse = await createJobResponsePromise;
  expect(createJobResponse.status()).toBe(201);

  const createdJob = await createJobResponse.json() as { id?: string };
  expect(createdJob.id).toBeTruthy();

  await expect(page).toHaveURL(/\/resumes\/[^/]+\/analysis$/, { timeout: 90000 });
}

test.describe('Analysis Improve Export', () => {
  test('should display a fullscreen overlay that covers footer and chatbot during resume improvement', async ({ page }) => {
    test.setTimeout(300000);

    await signInAsE2EUser(page);
    await uploadResumeAndOpenAnalysis(page);

    await expect(page.locator('body')).toContainText(/resume analysis|analyse du cv/i);

    await page.getByRole('button', { name: /improve|ameliorer|améliorer/i }).first().click();

    const overlay = page.getByTestId('improvement-animation-fullscreen-overlay');
    await expect(overlay).toBeVisible({ timeout: 30000 });

    const overlayBox = await overlay.boundingBox();
    expect(overlayBox).toBeTruthy();

    const viewport = page.viewportSize();
    expect(viewport).toBeTruthy();

    expect(overlayBox!.x).toBeLessThanOrEqual(0);
    expect(overlayBox!.y).toBeLessThanOrEqual(0);
    expect(overlayBox!.width).toBeGreaterThanOrEqual(viewport!.width - 2);
    expect(overlayBox!.height).toBeGreaterThanOrEqual(viewport!.height - 2);

    const footerCovered = await page.evaluate(() => {
      const overlay = document.querySelector('[data-testid="improvement-animation-fullscreen-overlay"]');
      const probe = document.elementFromPoint(window.innerWidth / 2, window.innerHeight - 8);
      return Boolean(overlay && probe && overlay.contains(probe));
    });
    expect(footerCovered).toBe(true);

    const launcher = page.getByTestId('chatbot-launcher');
    if (await launcher.count()) {
      const launcherCovered = await page.evaluate(() => {
        const overlay = document.querySelector('[data-testid="improvement-animation-fullscreen-overlay"]');
        const launcher = document.querySelector('[data-testid="chatbot-launcher"]');
        if (!overlay || !launcher) return true;
        const rect = launcher.getBoundingClientRect();
        const probe = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return Boolean(probe && overlay.contains(probe));
      });
      expect(launcherCovered).toBe(true);
    }
  });

  test('should improve an uploaded resume and export the improved version as PDF', async ({ page }) => {
    test.setTimeout(300000);

    await signInAsE2EUser(page);
    await uploadResumeAndOpenAnalysis(page);

    await expect(page.locator('body')).toContainText(/resume analysis|analyse du cv/i);

    await page.getByRole('button', { name: /improve|ameliorer|améliorer/i }).first().click();

    await expect(page).toHaveURL(/\/resumes\/[^/]+\/improve$/, { timeout: 240000 });
    await expect(page.locator('body')).toContainText(/save changes|enregistrer|sauvegarder/i, { timeout: 30000 });

    await page.getByRole('link', { name: /export/i }).first().click();

    await expect(page).toHaveURL(/\/resumes\/[^/]+\/export$/, { timeout: 30000 });
    await expect(page.locator('body')).toContainText(/exporting improved cv|export du cv amélioré|cv amélioré/i);

    const templateSelect = page.locator('#template');
    await expect(templateSelect).not.toHaveValue('', { timeout: 30000 });
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export|exporter/i }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename().toLowerCase()).toContain('.pdf');
  });
});
