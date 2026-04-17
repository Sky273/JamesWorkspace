import path from 'path';
import { expect, type Page } from '@playwright/test';
import { ensureLongResumeFixture } from './docx';
import {
  CONTINUE_TO_UPLOAD_LABEL_REGEX,
  EMPLOYEE_LABEL_REGEX,
  getCsrfToken,
  getJsonViaApi,
  postJsonViaApi,
  putJsonViaApi,
  setInputFilesWhenReady,
} from './ui';

const FALLBACK_DOCX_FIXTURE = path.resolve('node_modules/mammoth/test/test-data/tables.docx');

export async function createClientFixture(
  page: Page,
  {
    name,
    type = 'client',
    status = 'active',
  }: {
    name: string;
    type?: 'client' | 'prospect';
    status?: string;
  },
): Promise<{ id: string; name: string }> {
  return postJsonViaApi(page, '/api/clients', {
    name,
    type,
    status,
  });
}

export async function createDealFixture(
  page: Page,
  {
    title,
    clientId,
    contactId,
    status = 'open',
    priority = 'medium',
  }: {
    title: string;
    clientId?: string | null;
    contactId?: string | null;
    status?: string;
    priority?: string;
  },
): Promise<{ id: string; title: string }> {
  return postJsonViaApi(page, '/api/deals', {
    title,
    clientId: clientId || undefined,
    contactId: contactId || undefined,
    status,
    priority,
  });
}

export async function createMissionFixture(
  page: Page,
  {
    title,
    clientId,
    dealId,
    content = 'Mission Playwright de validation du refresh transverse.',
    status = 'active',
  }: {
    title: string;
    clientId?: string | null;
    dealId?: string | null;
    content?: string;
    status?: string;
  },
): Promise<{ id: string; Title?: string; title?: string }> {
  return postJsonViaApi(page, '/api/missions', {
    title,
    content,
    clientId: clientId || undefined,
    dealId: dealId || undefined,
    status,
  });
}

export async function uploadResumeAndWaitForAnalysis(
  page: Page,
  candidateName: string,
): Promise<{ resumeId: string; candidateName: string; displayName: string }> {
  const docxFixture = await ensureLongResumeFixture(candidateName).catch(() => FALLBACK_DOCX_FIXTURE);

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

  await expect(page).toHaveURL(/\/resumes\/[^/]+\/analysis$/, { timeout: 90_000 });

  const match = page.url().match(/\/resumes\/([^/]+)\/analysis$/);
  expect(match?.[1]).toBeTruthy();

  const resumeId = match![1];
  await putJsonViaApi(page, `/api/resumes/${resumeId}`, { Name: candidateName });
  const resume = await getJsonViaApi<Record<string, unknown>>(page, `/api/resumes/${resumeId}?refresh=1`);
  const displayName = typeof resume?.Name === 'string' && resume.Name.trim()
    ? resume.Name.trim()
    : candidateName;

  return {
    resumeId,
    candidateName,
    displayName,
  };
}

export async function createAdaptationFixture(
  page: Page,
  {
    resumeId,
    missionId,
    timeoutMs = 180_000,
  }: {
    resumeId: string;
    missionId: string;
    timeoutMs?: number;
  },
): Promise<{ adaptationId: string }> {
  const request = page.context().request;
  const csrfToken = await getCsrfToken(page);
  const createResponse = await request.post('/api/batch-jobs/adapt', {
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken,
    },
    data: {
      resumeIds: [resumeId],
      missionId,
    },
  });

  expect(createResponse.ok()).toBe(true);
  const createdJob = await createResponse.json() as { id?: string };
  expect(createdJob.id).toBeTruthy();

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const job = await getJsonViaApi<{
      status?: string;
      error_message?: string;
      items?: Array<{
        resume_id?: string;
        status?: string;
        adaptation_id?: string;
        error_message?: string;
      }>;
    }>(page, `/api/batch-jobs/${createdJob.id}`);

    if (job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(job.error_message || 'Adaptation job failed');
    }

    const item = job.items?.find((currentItem) => currentItem.resume_id === resumeId);
    if (item?.status === 'error') {
      throw new Error(item.error_message || 'Adaptation item failed');
    }

    if (item?.status === 'success' && item.adaptation_id) {
      return { adaptationId: item.adaptation_id };
    }

    await page.waitForTimeout(1000);
  }

  throw new Error('Timed out while waiting for adaptation fixture');
}
