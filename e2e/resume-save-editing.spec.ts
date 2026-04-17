import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import { signInAsE2EUser } from './helpers/auth';
import { ensureLongResumeFixture } from './helpers/docx';
import {
  CONTINUE_TO_UPLOAD_LABEL_REGEX,
  EMPLOYEE_LABEL_REGEX,
  fillProseMirror,
  getJsonViaApi,
  putJsonViaApi,
  setInputFilesWhenReady,
} from './helpers/ui';

const FALLBACK_DOCX_FIXTURE = path.resolve('node_modules/mammoth/test/test-data/tables.docx');

async function uploadResumeAndOpenAnalysis(page: Page, candidateName: string) {
  const docxFixture = await ensureLongResumeFixture().catch(() => FALLBACK_DOCX_FIXTURE);

  await page.goto('/upload');
  await page.getByRole('button', { name: EMPLOYEE_LABEL_REGEX }).click();
  await page.locator('#candidateName').fill(candidateName);
  await page.getByRole('button', { name: CONTINUE_TO_UPLOAD_LABEL_REGEX }).click();

  const createJobResponsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/batch-jobs') && response.request().method() === 'POST'
  );

  await setInputFilesWhenReady(page, docxFixture);

  const createJobResponse = await createJobResponsePromise;
  expect(createJobResponse.status()).toBe(201);

  await expect(page).toHaveURL(/\/resumes\/[^/]+\/analysis$/, { timeout: 90000 });
}

function extractResumeIdFromAnalysisUrl(page: Page): string {
  const match = page.url().match(/\/resumes\/([^/]+)\/analysis$/);
  if (!match?.[1]) {
    throw new Error(`Unable to extract resume id from ${page.url()}`);
  }

  return match[1];
}

async function waitForResumeToBeEditable(page: Page, resumeId: string) {
  await expect.poll(async () => {
    const resume = await getJsonViaApi<Record<string, unknown>>(page, `/api/resumes/${resumeId}`);
    const status = String(resume.Status || resume.status || '').toLowerCase();
    const originalText = String(resume['Original Text'] || resume.originalText || '');

    return {
      status,
      hasOriginalText: originalText.trim().length > 0,
    };
  }, {
    timeout: 90000,
    intervals: [1000, 1500, 2000],
  }).toEqual({
    status: 'analyzed',
    hasOriginalText: true,
  });
}

test.describe('Resume save editing', () => {
  test('persists saved changes on the analyzed resume extracted content tab', async ({ page }) => {
    test.setTimeout(180000);

    await signInAsE2EUser(page);
    await uploadResumeAndOpenAnalysis(page, `Analyse Save E2E ${Date.now()}`);
    const resumeId = extractResumeIdFromAnalysisUrl(page);
    const updatedExtractedText = `Texte extrait modifié E2E ${Date.now()}`;
    await waitForResumeToBeEditable(page, resumeId);

    await page.getByRole('button', { name: /contenu extrait/i }).click();
    await fillProseMirror(page, 0, updatedExtractedText);
    const saveButton = page.getByRole('button', { name: /save|enregistrer/i });
    await expect(saveButton).toBeEnabled({ timeout: 15000 });
    const saveResponsePromise = page.waitForResponse((response) =>
      response.url().includes(`/api/resumes/${resumeId}`) && response.request().method() === 'PUT'
    );
    await saveButton.click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBe(true);

    await expect(page.getByText(/saved successfully|modifications saved successfully|enregistre/i)).toBeVisible({ timeout: 15000 });

    await page.reload();
    await page.getByRole('button', { name: /contenu extrait/i }).click();
    await expect(page.locator('.ProseMirror').first()).toContainText(updatedExtractedText);

    const updatedResume = await getJsonViaApi<Record<string, unknown>>(page, `/api/resumes/${resumeId}`);
    expect(String(updatedResume['Original Text'] || updatedResume.originalText || '')).toContain(updatedExtractedText);
  });

  test('persists saved changes on the improved resume tab after reload', async ({ page }) => {
    test.setTimeout(180000);

    await signInAsE2EUser(page);
    await uploadResumeAndOpenAnalysis(page, `Improve Save E2E ${Date.now()}`);
    const resumeId = extractResumeIdFromAnalysisUrl(page);
    const improvedBodyText = `Version améliorée sauvegardée E2E ${Date.now()}`;
    await waitForResumeToBeEditable(page, resumeId);

    const updatedViaApi = await putJsonViaApi<Record<string, unknown>>(page, `/api/resumes/${resumeId}`, {
      improvedText: `<p>${improvedBodyText}</p>`,
      improvedGlobalRating: 91,
      improvedSkillsScore: 90,
      improvedExperienceScore: 89,
      improvedEducationScore: 87,
      improvedAtsScore: 93,
      improvedExecutiveSummaryScore: 88,
      improvedHobbiesLanguagesScore: 72,
      improvedSkills: ['TypeScript', 'React'],
      improvedIndustries: ['IT'],
      improvedTools: ['Playwright'],
      improvedSoftSkills: ['Communication'],
      improvedKeyImprovements: {
        critical: [],
        recommended: ['Sauvegarde e2e'],
        optional: [],
      },
      status: 'improved',
      lastImproved: new Date().toISOString(),
    });
    expect(String(updatedViaApi['Improved Text'] || updatedViaApi.improvedText || '')).toContain(improvedBodyText);

    const improvedPage = await page.context().newPage();
    await improvedPage.goto(`/resumes/${resumeId}`);
    await expect(improvedPage).toHaveURL(new RegExp(`/resumes/${resumeId}/improve$`), { timeout: 30000 });

    const savedImprovedText = `${improvedBodyText} mise à jour`;
    await fillProseMirror(improvedPage, 0, savedImprovedText);
    const saveButton = improvedPage.getByRole('button', { name: /enregistrer les modifications|save changes|save/i });
    await expect(saveButton).toBeEnabled({ timeout: 15000 });
    const saveResponsePromise = improvedPage.waitForResponse((response) =>
      response.url().includes(`/api/resumes/${resumeId}`) && response.request().method() === 'PUT'
    );
    await saveButton.click();
    const saveResponse = await saveResponsePromise;
    expect(saveResponse.ok()).toBe(true);

    await expect(saveButton).toBeEnabled({ timeout: 15000 });

    const updatedResume = await getJsonViaApi<Record<string, unknown>>(improvedPage, `/api/resumes/${resumeId}`);
    expect(String(updatedResume['Improved Text'] || updatedResume.improvedText || '')).toContain(savedImprovedText);

    await improvedPage.reload();
    await expect(improvedPage).toHaveURL(new RegExp(`/resumes/${resumeId}/improve$`), { timeout: 30000 });
    await expect(improvedPage.locator('.ProseMirror').first()).toContainText(savedImprovedText);
    await improvedPage.close();
  });
});
