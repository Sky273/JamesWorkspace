import { expect, test } from '@playwright/test';

import { signInAsE2EAdmin } from './helpers/auth';
import { SAVE_LABEL_REGEX, getJsonViaApi } from './helpers/ui';

test.describe('Settings LLM Hugging Face', () => {
  test.describe.configure({ mode: 'serial' });

  test('should save and reload a custom Hugging Face model in settings', async ({ page }) => {
    const customModel = 'meta-llama/Llama-3.3-70B-Instruct';

    await signInAsE2EAdmin(page);
    await page.goto('/settings');

    const providerSelect = page.locator('select').first();
    await expect(providerSelect).toBeVisible();
    await providerSelect.selectOption('huggingface');

    const modelInput = page.getByPlaceholder('MiniMaxAI/MiniMax-M2.7');
    await expect(modelInput).toBeVisible();
    await modelInput.fill(customModel);

    await page.getByRole('button', { name: SAVE_LABEL_REGEX }).click();
    await expect(modelInput).toHaveValue(customModel);

    await page.reload();
    await expect(page.getByPlaceholder('MiniMaxAI/MiniMax-M2.7')).toHaveValue(customModel);

    const settings = await getJsonViaApi<{ llmProvider?: string; llmModel?: string }>(page, '/api/settings');
    expect(settings.llmProvider).toBe('huggingface');
    expect(settings.llmModel).toBe(customModel);
  });
});
