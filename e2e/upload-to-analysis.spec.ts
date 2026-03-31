import path from 'path';
import { test, expect } from '@playwright/test';
import { signInAsE2EUser } from './helpers/auth';

const DOCX_FIXTURE = path.resolve('node_modules/mammoth/test/test-data/tables.docx');

test.describe('Upload To Analysis', () => {
  test('should create an import job and open the analysis page for the uploaded resume', async ({ page }) => {
    test.setTimeout(120000);

    await signInAsE2EUser(page);
    await page.goto('/upload');

    await page.getByRole('button', { name: /employee|collaborateur/i }).click();
    await page.locator('#candidateName').fill('Jean E2E');
    await page.getByRole('button', { name: /continue to upload|continuer vers l'upload/i }).click();

    const createJobResponsePromise = page.waitForResponse((response) =>
      response.url().includes('/api/batch-jobs') && response.request().method() === 'POST'
    );

    await page.locator('input[type="file"]').setInputFiles(DOCX_FIXTURE);

    const createJobResponse = await createJobResponsePromise;
    expect(createJobResponse.status()).toBe(201);

    const createdJob = await createJobResponse.json() as { id?: string };
    expect(createdJob.id).toBeTruthy();

    await expect(page).toHaveURL(/\/resumes\/[^/]+\/analysis$/, { timeout: 90000 });
    await expect(page.locator('body')).toContainText(/resume analysis|analyse du cv/i);
    await expect(page.locator('body')).toContainText(/share|partager/i);
    await expect(page.locator('body')).toContainText(/improve|ameliorer/i);
    await expect(page.locator('body')).toContainText(/export/i);
  });
});
