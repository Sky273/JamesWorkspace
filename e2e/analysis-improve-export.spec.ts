import path from 'path';
import { test, expect, type Page } from '@playwright/test';
import { signInAsE2EUser } from './helpers/auth';
import { ensureLongResumeFixture } from './helpers/docx';
import { putJsonViaApi } from './helpers/ui';

const FALLBACK_DOCX_FIXTURE = path.resolve('node_modules/mammoth/test/test-data/tables.docx');

async function uploadResumeAndOpenAnalysis(page: Page) {
  const docxFixture = await ensureLongResumeFixture().catch(() => FALLBACK_DOCX_FIXTURE);

  await page.goto('/upload');

  await page.getByRole('button', { name: /employee|collaborateur/i }).click();
  await page.locator('#candidateName').fill('Jeanne Export E2E');
  await page.getByRole('button', { name: /continue to upload|continuer vers l'upload/i }).click();

  const createJobResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/batch-jobs') && response.request().method() === 'POST',
  );

  await page.locator('input[type="file"]').setInputFiles(docxFixture);

  const createJobResponse = await createJobResponsePromise;
  expect(createJobResponse.status()).toBe(201);

  const createdJob = await createJobResponse.json() as { id?: string };
  expect(createdJob.id).toBeTruthy();

  await expect(page).toHaveURL(/\/resumes\/[^/]+\/analysis$/, { timeout: 90000 });
}

function extractResumeIdFromAnalysisUrl(page: Page): string {
  const match = page.url().match(/\/resumes\/([^/]+)\/analysis$/);
  if (!match?.[1]) {
    throw new Error(`Unable to extract resume id from ${page.url()}`);
  }

  return match[1];
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

  test('should export the improved version as PDF once the resume is marked improved', async ({ page }) => {
    test.setTimeout(180000);

    await signInAsE2EUser(page);
    await uploadResumeAndOpenAnalysis(page);
    const resumeId = extractResumeIdFromAnalysisUrl(page);

    await expect(page.locator('body')).toContainText(/resume analysis|analyse du cv/i);

    await putJsonViaApi(page, `/api/resumes/${resumeId}`, {
      improvedText: '<p>CV amélioré automatiquement pour les tests E2E.</p>',
      improvedGlobalRating: 88,
      improvedSkillsScore: 90,
      improvedExperienceScore: 86,
      improvedEducationScore: 82,
      improvedAtsScore: 89,
      improvedExecutiveSummaryScore: 85,
      improvedHobbiesLanguagesScore: 70,
      improvedSkills: ['JavaScript', 'TypeScript', 'React'],
      improvedIndustries: ['IT'],
      improvedTools: ['Node.js', 'PostgreSQL'],
      improvedSoftSkills: ['Communication'],
      improvedKeyImprovements: {
        critical: [],
        recommended: ['Version optimisée E2E'],
        optional: [],
      },
      status: 'improved',
      lastImproved: new Date().toISOString(),
    });

    await page.goto(`/resumes/${resumeId}/export`);

    await expect(page).toHaveURL(new RegExp(`/resumes/${resumeId}/export$`), { timeout: 30000 });
    await expect(page.locator('body')).toContainText(/exporting improved cv|export du cv amélioré|cv amélioré/i);

    const templateSelect = page.locator('#template');
    await expect(templateSelect).not.toHaveValue('', { timeout: 30000 });

    const exportResponsePromise = page.waitForResponse((response) =>
      response.request().method() === 'POST' && response.url().includes('/generate-pdf')
    );
    await page.getByRole('button', { name: /export|exporter/i }).click();
    const exportResponse = await exportResponsePromise;

    expect(exportResponse.ok()).toBe(true);
    expect(exportResponse.headers()['content-type'] || '').toContain('application/pdf');
  });
});
