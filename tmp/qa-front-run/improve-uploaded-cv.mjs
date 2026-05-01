import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const marker = process.env.QA_MARKER || 'QA-FRONT-20260501172935';
const email = process.env.QA_EMAIL;
const password = process.env.QA_PASSWORD;
const baseUrl = process.env.QA_BASE_URL || 'https://resumeconverter.net';
const outDir = path.resolve('tmp/qa-front-run', marker);

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: false, slowMo: 150 });
const page = await browser.newPage({ viewport: { width: 1365, height: 820 } });
const observations = [];

const shot = async (name) => {
  await page.screenshot({ path: path.join(outDir, name), fullPage: true });
};

const bodyText = async () => page.locator('body').innerText({ timeout: 10000 }).catch(() => '');

async function login() {
  await page.goto(`${baseUrl}/signin`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  let emailInputs = await page.locator('input[type="email"], input[name="email"]').count();
  console.log('login start', page.url(), 'emailInputs', emailInputs);
  await shot('improve-login-start.png');
  if (emailInputs === 0) {
    const signInLink = page.getByRole('button', { name: 'Se connecter', exact: true })
      .or(page.getByRole('link', { name: 'Se connecter', exact: true }));
    if ((await signInLink.count().catch(() => 0)) > 0) {
      await signInLink.first().click();
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
  emailInputs = await page.locator('input[type="email"], input[name="email"]').count();
  console.log('login after click', page.url(), 'emailInputs', emailInputs);
  await shot('improve-login-before-fill.png');
  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"], input[name="password"]').first().fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(2000);
}

async function openCvPreview() {
  await page.goto(`${baseUrl}/resumes`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const search = page.locator('input[placeholder*="CV"], input[placeholder*="Rechercher"]').first();
  if (await search.count()) {
    await search.fill('SEHLI');
    await page.waitForTimeout(1500);
  }
  await shot('improve-01-search-sehli.png');
  const preview = page.getByRole('button', { name: /Aperçu du CV/i });
  if ((await preview.count()) === 0) throw new Error('No Aperçu du CV button visible for SEHLI');
  await preview.first().click();
  await page.waitForTimeout(2500);
  await shot('improve-02-preview-open.png');
}

async function openCompleteAnalysis() {
  const analysis = page.getByRole('button', { name: /Analyse complète/i });
  const count = await analysis.count();
  if (count === 0) {
    observations.push('Bouton Analyse complète absent dans l’aperçu CV.');
    return false;
  }
  await analysis.first().click();
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await page.waitForTimeout(3500);
  await shot('improve-03-complete-analysis.png');
  return true;
}

async function launchImprovement() {
  let text = await bodyText();
  if (/Amélioration du CV|Contenu Amélioré|Améliorer/i.test(text)) {
    observations.push('Écran détail/analyse CV ouvert.');
  } else {
    observations.push('Après Analyse complète, l’écran attendu d’analyse CV n’est pas clairement affiché.');
  }

  const improveButtons = [
    page.getByRole('button', { name: /Améliorer le CV/i }),
    page.getByRole('button', { name: /Améliorer/i }),
    page.getByRole('button', { name: /Amélioration/i }),
  ];

  let clicked = false;
  for (const locator of improveButtons) {
    const count = await locator.count().catch(() => 0);
    if (count > 0) {
      await locator.first().click().catch(() => {});
      clicked = true;
      await page.waitForTimeout(3500);
      break;
    }
  }

  await shot('improve-04-after-improve-click.png');
  if (!clicked) {
    observations.push('Aucun bouton d’amélioration exploitable trouvé dans le détail CV.');
    return;
  }

  text = await bodyText();
  if (/crédit|credits|insuffisant/i.test(text)) {
    observations.push('Le lancement de l’amélioration est bloqué par un message de crédit visible.');
  }
  if (/Contenu Amélioré|version améliorée|Amélioré/i.test(text)) {
    observations.push('Un état amélioré est visible après interaction.');
  }
  if (/Erreur|Impossible|échoué/i.test(text)) {
    observations.push('Un message d’erreur est visible après interaction d’amélioration.');
  }
}

try {
  await login();
  await openCvPreview();
  const opened = await openCompleteAnalysis();
  if (opened) await launchImprovement();
  await fs.writeFile(path.join(outDir, 'improve-observations.json'), JSON.stringify(observations, null, 2), 'utf8');
  console.log(JSON.stringify({ marker, url: page.url(), observations }, null, 2));
} finally {
  await browser.close();
}
