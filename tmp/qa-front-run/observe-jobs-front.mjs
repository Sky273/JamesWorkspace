import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const marker = process.env.QA_MARKER || 'QA-FRONT-20260501172935';
const email = process.env.QA_EMAIL;
const password = process.env.QA_PASSWORD;
const baseUrl = process.env.QA_BASE_URL || 'https://resumeconverter.net';
const outDir = path.resolve('tmp/qa-front-run', marker);
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: false, slowMo: 120 });
const page = await browser.newPage({ viewport: { width: 1365, height: 820 } });
const shot = (name) => page.screenshot({ path: path.join(outDir, name), fullPage: true });

try {
  await page.goto(`${baseUrl}/signin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"], input[name="password"]').first().fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(2000);
  await page.getByRole('link', { name: /Jobs/i }).click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(3000);
  const jobsText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
  await shot('jobs-via-sidebar.png');
  await fs.writeFile(path.join(outDir, 'jobs-via-sidebar.txt'), jobsText, 'utf8');
  console.log(JSON.stringify({ url: page.url(), hasJobsText: jobsText.length > 0, excerpt: jobsText.slice(0, 500) }, null, 2));
} finally {
  await browser.close();
}
