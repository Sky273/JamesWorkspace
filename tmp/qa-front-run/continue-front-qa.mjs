import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const marker = process.env.QA_MARKER || 'QA-FRONT-20260501172935';
const email = process.env.QA_EMAIL;
const password = process.env.QA_PASSWORD;
const baseUrl = process.env.QA_BASE_URL || 'https://resumeconverter.net';
const outDir = path.resolve('tmp/qa-front-run', marker);

if (!email || !password) {
  throw new Error('QA_EMAIL and QA_PASSWORD are required');
}

await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: false, slowMo: 120 });
const page = await browser.newPage({ viewport: { width: 1365, height: 820 } });
const findings = [];

const shot = async (name) => {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, fullPage: true });
  return file;
};

const visibleText = async () => {
  return page.locator('body').innerText({ timeout: 10000 }).catch(() => '');
};

const clickText = async (text, options = {}) => {
  const locator = page.getByText(text, { exact: options.exact ?? false });
  await locator.first().click({ timeout: options.timeout ?? 10000 });
};

async function login() {
  await page.goto(`${baseUrl}/signin`, { waitUntil: 'domcontentloaded' });
  const body = await visibleText();
  if (!body.includes('Connexion') && !body.includes('Se connecter') && page.url().includes('/resumes')) {
    return;
  }
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passwordInput = page.locator('input[type="password"], input[name="password"]').first();
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
}

async function searchResumes(term) {
  await page.goto(`${baseUrl}/resumes`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const search = page.locator('input[placeholder*="CV"], input[placeholder*="Rechercher"]').first();
  if (await search.count()) {
    await search.fill(term);
    await page.waitForTimeout(1800);
  }
  const text = await visibleText();
  await shot(`resumes-search-${term.replace(/[^a-z0-9-]/gi, '_')}.png`);
  return text;
}

async function observeJobs() {
  await page.goto(`${baseUrl}/jobs`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await shot('jobs-observation.png');
  return visibleText();
}

async function openResumeDetail() {
  await page.goto(`${baseUrl}/resumes`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const search = page.locator('input[placeholder*="CV"], input[placeholder*="Rechercher"]').first();
  if (await search.count()) {
    await search.fill(marker);
    await page.waitForTimeout(1500);
  }
  let text = await visibleText();
  if (!text.includes(marker)) {
    await search.fill('SEHLI');
    await page.waitForTimeout(1500);
    text = await visibleText();
  }
  await shot('resumes-before-open-detail.png');

  const previewButtons = page.getByRole('button', { name: /Aperçu du CV|Voir|Ouvrir/i });
  const count = await previewButtons.count();
  if (count > 0) {
    await previewButtons.first().click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2500);
    await shot('resume-detail-opened.png');
    return true;
  }

  const card = page.locator('text=SEHLI').first();
  if (await card.count()) {
    await card.click();
    await page.waitForLoadState('domcontentloaded').catch(() => {});
    await page.waitForTimeout(2500);
    await shot('resume-detail-opened-by-card.png');
    return true;
  }

  return false;
}

async function tryImproveResume() {
  const body = await visibleText();
  if (!/Amélior|Analy|Export|Score/i.test(body)) {
    findings.push('Le détail CV ne montre pas les contrôles attendus Analyse/Amélioration/Export.');
    return;
  }

  const improveCandidates = [
    page.getByRole('button', { name: /Améliorer le CV/i }),
    page.getByRole('button', { name: /Amélioration/i }),
    page.getByText('Amélioration', { exact: false }),
  ];

  for (const locator of improveCandidates) {
    const count = await locator.count().catch(() => 0);
    if (count > 0) {
      await locator.first().click({ timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(2500);
      break;
    }
  }

  await shot('resume-improvement-after-click.png');
  const afterClick = await visibleText();
  if (/crédit|credits|insuffisant/i.test(afterClick)) {
    findings.push('Amélioration CV bloquée par crédit ou message équivalent visible.');
    return;
  }

  const launch = page.getByRole('button', { name: /Améliorer|Lancer|Générer|Optimiser/i });
  if ((await launch.count().catch(() => 0)) > 0) {
    await launch.first().click().catch(() => {});
    await page.waitForTimeout(5000);
    await shot('resume-improvement-launched.png');
  }

  const finalText = await visibleText();
  if (/Amélioré|Contenu Amélioré|Score/i.test(finalText)) {
    findings.push('L’écran d’amélioration CV est accessible et affiche un état exploitable.');
  } else {
    findings.push('Après clic sur amélioration, aucun état final clair n’est visible.');
  }
}

try {
  await login();
  await shot('logged-in.png');

  const jobsText = await observeJobs();
  const resumesByMarker = await searchResumes(marker);
  const resumesBySehli = await searchResumes('SEHLI');

  await fs.writeFile(
    path.join(outDir, 'front-observation-text.json'),
    JSON.stringify({ jobsText, resumesByMarker, resumesBySehli }, null, 2),
    'utf8',
  );

  if (resumesByMarker.includes(marker) || resumesBySehli.toLowerCase().includes('sehli')) {
    const opened = await openResumeDetail();
    if (opened) {
      await tryImproveResume();
    } else {
      findings.push('CV visible dans la liste mais ouverture du détail non réussie depuis les contrôles front.');
    }
  } else {
    findings.push('CV uploadé introuvable dans la CVthèque après recherche par marqueur et par SEHLI.');
  }

  await fs.writeFile(path.join(outDir, 'front-findings.json'), JSON.stringify(findings, null, 2), 'utf8');
  console.log(JSON.stringify({ marker, findings, url: page.url(), outDir }, null, 2));
} finally {
  await browser.close();
}
