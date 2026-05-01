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
  await page.goto(`${baseUrl}/resumes`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const search = page.locator('input[placeholder*="CV"], input[placeholder*="Rechercher"]').first();
  await search.fill('SEHLI');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /Aperçu du CV/i }).first().click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: /Analyse complète/i }).first().click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(3500);
  await shot('analysis-after-improvement-job.png');
  const fullText = await page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
  await fs.writeFile(path.join(outDir, 'analysis-after-improvement-job.txt'), fullText, 'utf8');
  console.log(JSON.stringify({
    url: page.url(),
    hasImprovedTab: /Amélioré|Contenu Amélioré|Amélioration du CV/i.test(fullText),
    scoreText: (fullText.match(/Score\\s*:?\\s*\\d+%/i) || [null])[0],
    excerpt: fullText.slice(0, 800),
  }, null, 2));
} finally {
  await browser.close();
}
