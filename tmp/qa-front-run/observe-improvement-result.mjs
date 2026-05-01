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

const shot = async (name) => page.screenshot({ path: path.join(outDir, name), fullPage: true });
const text = async () => page.locator('body').innerText({ timeout: 10000 }).catch(() => '');

async function login() {
  await page.goto(`${baseUrl}/signin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  if ((await page.locator('input[type="email"], input[name="email"]').count()) > 0) {
    await page.locator('input[type="email"], input[name="email"]').first().fill(email);
    await page.locator('input[type="password"], input[name="password"]').first().fill(password);
    await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2000);
  }
}

try {
  await login();
  await page.goto(`${baseUrl}/resumes`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const search = page.locator('input[placeholder*="CV"], input[placeholder*="Rechercher"]').first();
  if (await search.count()) {
    await search.fill('SEHLI');
    await page.waitForTimeout(1500);
  }
  await shot('improvement-result-resume-list.png');

  const listText = await text();
  const preview = page.getByRole('button', { name: /Aperçu du CV/i });
  if ((await preview.count()) > 0) {
    await preview.first().click();
    await page.waitForTimeout(2500);
    await shot('improvement-result-preview.png');
  }

  const previewText = await text();
  await fs.writeFile(
    path.join(outDir, 'improvement-result-text.json'),
    JSON.stringify({ listText, previewText, url: page.url() }, null, 2),
    'utf8',
  );
  console.log(JSON.stringify({
    url: page.url(),
    analyzedVisible: /ANALYS|Analys/i.test(listText),
    improvedVisible: /AMÉLIOR|Amélior/i.test(listText + previewText),
    errorVisible: /Erreur|Impossible|échoué/i.test(listText + previewText),
  }, null, 2));
} finally {
  await browser.close();
}
