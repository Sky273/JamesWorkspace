import { expect, type Locator, type Page } from '@playwright/test';

import { clickRefreshButton } from './ui';

interface RefreshAssertionOptions {
  beforeRefresh?: () => Promise<void>;
  afterRefresh?: () => Promise<void>;
  timeoutMs?: number;
}

export async function expectVisibleAfterRefresh(
  page: Page,
  locatorFactory: () => Locator,
  options: RefreshAssertionOptions = {},
): Promise<void> {
  const { beforeRefresh, afterRefresh, timeoutMs = 15_000 } = options;
  if (beforeRefresh) {
    await beforeRefresh();
  }
  await expect(locatorFactory()).toBeVisible({ timeout: timeoutMs });
  await clickRefreshButton(page);
  if (afterRefresh) {
    await afterRefresh();
  }
  await expect(locatorFactory()).toBeVisible({ timeout: timeoutMs });
}

export async function expectHiddenAfterRefresh(
  page: Page,
  locatorFactory: () => Locator,
  options: RefreshAssertionOptions = {},
): Promise<void> {
  const { beforeRefresh, afterRefresh, timeoutMs = 15_000 } = options;
  if (beforeRefresh) {
    await beforeRefresh();
  }
  await clickRefreshButton(page);
  if (afterRefresh) {
    await afterRefresh();
  }
  await expect(locatorFactory()).toHaveCount(0, { timeout: timeoutMs });
}
