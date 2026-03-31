#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn, execFile as execFileCallback } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execFile = promisify(execFileCallback);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, 'logs', 'memory-profiles');

function parseArgs(argv) {
  const options = {
    durationSeconds: 300,
    intervalSeconds: 5,
    startStack: false,
    proxyPort: 3001,
    pdfPort: 3002,
    outputDir: DEFAULT_OUTPUT_DIR,
    scenarioPath: null,
    proxyPid: null,
    pdfPid: null,
    includePdfHealth: true,
    profileName: 'memory-profile',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--start-stack') {
      options.startStack = true;
      continue;
    }
    if (arg === '--duration' && next) {
      options.durationSeconds = Number(next);
      index += 1;
      continue;
    }
    if (arg === '--interval' && next) {
      options.intervalSeconds = Number(next);
      index += 1;
      continue;
    }
    if (arg === '--proxy-port' && next) {
      options.proxyPort = Number(next);
      index += 1;
      continue;
    }
    if (arg === '--pdf-port' && next) {
      options.pdfPort = Number(next);
      index += 1;
      continue;
    }
    if (arg === '--output-dir' && next) {
      options.outputDir = path.resolve(ROOT_DIR, next);
      index += 1;
      continue;
    }
    if (arg === '--scenario' && next) {
      options.scenarioPath = path.resolve(ROOT_DIR, next);
      index += 1;
      continue;
    }
    if (arg === '--proxy-pid' && next) {
      options.proxyPid = Number(next);
      index += 1;
      continue;
    }
    if (arg === '--pdf-pid' && next) {
      options.pdfPid = Number(next);
      index += 1;
      continue;
    }
    if (arg === '--name' && next) {
      options.profileName = next;
      index += 1;
      continue;
    }
    if (arg === '--no-pdf-health') {
      options.includePdfHealth = false;
      continue;
    }
    if (arg === '--help') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Usage:
  node scripts/profile-memory.mjs [options]

Options:
  --start-stack            Start proxy-server and pdf-server for the profile run
  --duration <seconds>     Total sampling duration (default: 300)
  --interval <seconds>     Sampling interval (default: 5)
  --scenario <path>        JSON scenario file with HTTP requests to exercise the app
  --proxy-port <port>      Proxy server port (default: 3001)
  --pdf-port <port>        PDF server port (default: 3002)
  --proxy-pid <pid>        Existing proxy-server PID to monitor
  --pdf-pid <pid>          Existing pdf-server PID to monitor
  --output-dir <path>      Output directory for reports
  --name <label>           Profile label used in output filenames
  --no-pdf-health          Skip PDF server /health fetches

Scenario JSON format:
  {
    "steps": [
      {
        "name": "Proxy health",
        "request": { "method": "GET", "url": "http://localhost:3001/health" },
        "repeat": 20,
        "delayMs": 500
      }
    ]
  }
`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function formatTimestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function resolveScenarioPath(scenarioPath) {
  if (!scenarioPath) {
    return null;
  }
  return scenarioPath;
}

function loadScenario(scenarioPath) {
  if (!scenarioPath) {
    return { steps: [] };
  }

  const raw = fs.readFileSync(scenarioPath, 'utf8');
  const parsed = JSON.parse(raw);
  if (!parsed || !Array.isArray(parsed.steps)) {
    throw new Error(`Scenario file must contain a "steps" array: ${scenarioPath}`);
  }
  return parsed;
}

function spawnChild(label, args, extraEnv = {}) {
  const child = spawn(process.execPath, args, {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: { ...process.env, ...extraEnv },
  });

  child.on('error', (error) => {
    console.error(`[profile-memory] Failed to start ${label}: ${error.message}`);
  });

  return child;
}

async function waitForHttp(url, timeoutMs = 120000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url, { method: 'GET' });
      if (response.ok || response.status < 500) {
        return;
      }
    } catch {
      // Retry until timeout
    }
    await sleep(1000);
  }

  throw new Error(`Timed out waiting for ${url}`);
}

async function getProcessMemoryRssMb(pid) {
  if (!pid) {
    return null;
  }

  if (process.platform === 'win32') {
    const { stdout } = await execFile('tasklist', ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH']);
    const line = stdout.trim();
    if (!line || line.startsWith('INFO:')) {
      return null;
    }

    const columns = parseCsvLine(line);
    const memUsage = columns[4] || '';
    const numericKb = Number(memUsage.replace(/[^\d]/g, ''));
    if (!Number.isFinite(numericKb)) {
      return null;
    }
    return round2(numericKb / 1024);
  }

  const { stdout } = await execFile('ps', ['-o', 'rss=', '-p', String(pid)]);
  const rssKb = Number(String(stdout).trim());
  if (!Number.isFinite(rssKb)) {
    return null;
  }
  return round2(rssKb / 1024);
}

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (character === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  result.push(current);
  return result;
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

async function fetchJson(url, options = {}) {
  const startedAt = Date.now();
  const response = await fetch(url, options);
  const durationMs = Date.now() - startedAt;
  const bodyText = await response.text();
  let json = null;

  try {
    json = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    json = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    durationMs,
    json,
    bodyText,
  };
}

async function runScenario(scenario, context) {
  const startedAt = new Date().toISOString();
  const stepResults = [];

  for (const step of scenario.steps) {
    const repeat = Number(step.repeat || 1);
    const delayMs = Number(step.delayMs || 0);
    const stepName = step.name || step.request?.url || 'unnamed-step';
    const request = step.request || {};
    const requestInit = {
      method: request.method || 'GET',
      headers: request.headers || {},
      body: typeof request.body === 'string' ? request.body : request.body ? JSON.stringify(request.body) : undefined,
    };

    let successCount = 0;
    let failureCount = 0;
    const errors = [];
    const durations = [];

    for (let iteration = 0; iteration < repeat; iteration += 1) {
      try {
        const response = await fetchJson(request.url, requestInit);
        durations.push(response.durationMs);
        if (response.ok) {
          successCount += 1;
        } else {
          failureCount += 1;
          errors.push(`HTTP ${response.status}`);
        }
      } catch (error) {
        failureCount += 1;
        errors.push(error instanceof Error ? error.message : String(error));
      }

      if (delayMs > 0 && iteration < repeat - 1) {
        await sleep(delayMs);
      }
    }

    const avgDurationMs = durations.length > 0
      ? round2(durations.reduce((sum, value) => sum + value, 0) / durations.length)
      : null;

    stepResults.push({
      name: stepName,
      request,
      repeat,
      delayMs,
      successCount,
      failureCount,
      avgDurationMs,
      errors: [...new Set(errors)].slice(0, 10),
    });
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    stepResults,
    context,
  };
}

async function collectSample({ proxyPid, pdfPid, proxyUrl, pdfUrl, includePdfHealth }) {
  const sample = {
    timestamp: new Date().toISOString(),
    proxy: {
      pid: proxyPid,
      rssMb: null,
      reachable: null,
      responseTimeMs: null,
    },
    pdf: {
      pid: pdfPid,
      rssMb: null,
      reachable: null,
      responseTimeMs: null,
      activeGenerationJobs: null,
      rateLimitEntries: null,
    },
  };

  if (proxyPid) {
    try {
      sample.proxy.rssMb = await getProcessMemoryRssMb(proxyPid);
    } catch (error) {
      sample.proxy.memoryError = error instanceof Error ? error.message : String(error);
    }
  }

  if (pdfPid) {
    try {
      sample.pdf.rssMb = await getProcessMemoryRssMb(pdfPid);
    } catch (error) {
      sample.pdf.memoryError = error instanceof Error ? error.message : String(error);
    }
  }

  if (proxyUrl) {
    try {
      const response = await fetchJson(proxyUrl);
      sample.proxy.reachable = response.ok;
      sample.proxy.responseTimeMs = response.durationMs;
      sample.proxy.httpStatus = response.status;
    } catch (error) {
      sample.proxy.reachable = false;
      sample.proxy.healthError = error instanceof Error ? error.message : String(error);
    }
  }

  if (includePdfHealth && pdfUrl) {
    try {
      const response = await fetchJson(pdfUrl);
      sample.pdf.reachable = response.ok;
      sample.pdf.responseTimeMs = response.durationMs;
      sample.pdf.httpStatus = response.status;
      sample.pdf.activeGenerationJobs = response.json?.activeGenerationJobs ?? null;
      sample.pdf.rateLimitEntries = response.json?.rateLimitEntries ?? null;
      sample.pdf.heapUsedMb = parseHealthMemoryValue(response.json?.memory?.heapUsed);
    } catch (error) {
      sample.pdf.reachable = false;
      sample.pdf.healthError = error instanceof Error ? error.message : String(error);
    }
  }

  return sample;
}

function parseHealthMemoryValue(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const numeric = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(numeric) ? numeric : null;
}

function computeSeriesSummary(samples, selector) {
  const values = samples
    .map(selector)
    .filter((value) => typeof value === 'number' && Number.isFinite(value));

  if (values.length === 0) {
    return null;
  }

  const start = values[0];
  const end = values[values.length - 1];
  const peak = Math.max(...values);
  const min = Math.min(...values);

  return {
    startMb: round2(start),
    endMb: round2(end),
    minMb: round2(min),
    peakMb: round2(peak),
    growthMb: round2(end - start),
  };
}

function buildSummary(samples, scenarioResult, options, startedAt, finishedAt) {
  const proxySummary = computeSeriesSummary(samples, (sample) => sample.proxy.rssMb);
  const pdfSummary = computeSeriesSummary(samples, (sample) => sample.pdf.rssMb);

  return {
    profileName: options.profileName,
    startedAt,
    finishedAt,
    durationSeconds: round2((new Date(finishedAt) - new Date(startedAt)) / 1000),
    samplingIntervalSeconds: options.intervalSeconds,
    sampleCount: samples.length,
    proxy: {
      pid: samples.at(-1)?.proxy.pid ?? options.proxyPid ?? null,
      ...proxySummary,
      failedHealthChecks: samples.filter((sample) => sample.proxy.reachable === false).length,
    },
    pdf: {
      pid: samples.at(-1)?.pdf.pid ?? options.pdfPid ?? null,
      ...pdfSummary,
      failedHealthChecks: samples.filter((sample) => sample.pdf.reachable === false).length,
    },
    scenario: scenarioResult
      ? {
          stepCount: scenarioResult.stepResults.length,
          failures: scenarioResult.stepResults.reduce((sum, step) => sum + step.failureCount, 0),
        }
      : null,
  };
}

function buildMarkdownReport(summary, scenarioResult, samples) {
  const lines = [];
  lines.push('# Memory Profile Report');
  lines.push('');
  lines.push(`- Profile: \`${summary.profileName}\``);
  lines.push(`- Started: \`${summary.startedAt}\``);
  lines.push(`- Finished: \`${summary.finishedAt}\``);
  lines.push(`- Duration: \`${summary.durationSeconds}s\``);
  lines.push(`- Samples: \`${summary.sampleCount}\``);
  lines.push('');
  lines.push('## Proxy Server');
  lines.push('');
  lines.push(renderProcessSummary(summary.proxy));
  lines.push('');
  lines.push('## PDF Server');
  lines.push('');
  lines.push(renderProcessSummary(summary.pdf));
  lines.push('');

  if (scenarioResult) {
    lines.push('## Scenario');
    lines.push('');
    for (const step of scenarioResult.stepResults) {
      lines.push(`- ${step.name}: success=${step.successCount}, failure=${step.failureCount}, avg=${step.avgDurationMs ?? 'n/a'}ms`);
    }
    lines.push('');
  }

  const tailSamples = samples.slice(-5);
  if (tailSamples.length > 0) {
    lines.push('## Last Samples');
    lines.push('');
    for (const sample of tailSamples) {
      lines.push(`- ${sample.timestamp}: proxy=${sample.proxy.rssMb ?? 'n/a'}MB, pdf=${sample.pdf.rssMb ?? 'n/a'}MB`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function renderProcessSummary(summary) {
  if (!summary || summary.startMb === undefined) {
    return '- No process samples collected';
  }

  return [
    `- PID: \`${summary.pid ?? 'n/a'}\``,
    `- Start RSS: \`${summary.startMb} MB\``,
    `- End RSS: \`${summary.endMb} MB\``,
    `- Peak RSS: \`${summary.peakMb} MB\``,
    `- Growth: \`${summary.growthMb} MB\``,
    `- Failed health checks: \`${summary.failedHealthChecks}\``,
  ].join('\n');
}

async function shutdownChildren(children) {
  for (const child of children) {
    if (!child || child.killed) {
      continue;
    }

    child.kill('SIGTERM');
  }

  await sleep(2000);

  for (const child of children) {
    if (!child || child.killed) {
      continue;
    }

    child.kill('SIGKILL');
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const scenarioPath = resolveScenarioPath(options.scenarioPath);
  const scenario = loadScenario(scenarioPath);
  const children = [];

  if (!options.startStack && !options.proxyPid && !options.pdfPid) {
    throw new Error('Provide --start-stack or explicit --proxy-pid / --pdf-pid values.');
  }

  if (!Number.isFinite(options.durationSeconds) || options.durationSeconds <= 0) {
    throw new Error('--duration must be a positive number.');
  }

  if (!Number.isFinite(options.intervalSeconds) || options.intervalSeconds <= 0) {
    throw new Error('--interval must be a positive number.');
  }

  ensureDir(options.outputDir);

  try {
    if (options.startStack) {
      const sharedEnv = {
        PDF_SERVER_INTERNAL_TOKEN: process.env.PDF_SERVER_INTERNAL_TOKEN || 'profile-memory-pdf-server-internal-token-32chars',
        REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET || 'profile-memory-refresh-token-secret-32chars',
        HTTPS_ENABLED: process.env.HTTPS_ENABLED || 'false',
      };

      const pdfChild = spawnChild('pdf-server', ['pdf-server/server.cjs'], {
        ...sharedEnv,
      });
      const proxyChild = spawnChild('proxy-server', ['--max-old-space-size=2048', '--expose-gc', 'server/proxy-server.js'], {
        ...sharedEnv,
      });

      children.push(pdfChild, proxyChild);
      options.pdfPid = pdfChild.pid ?? null;
      options.proxyPid = proxyChild.pid ?? null;

      await waitForHttp(`http://localhost:${options.pdfPort}/health`, 120000);
      await waitForHttp(`http://localhost:${options.proxyPort}/health`, 120000);
    }

    const startedAt = new Date().toISOString();
    const samples = [];
    const proxyHealthUrl = `http://localhost:${options.proxyPort}/health`;
    const pdfHealthUrl = `http://localhost:${options.pdfPort}/health`;
    const durationMs = options.durationSeconds * 1000;
    const intervalMs = options.intervalSeconds * 1000;
    const profilingStartedAt = Date.now();

    const scenarioPromise = scenario.steps.length > 0
      ? runScenario(scenario, {
          startedAt,
          scenarioPath,
        })
      : Promise.resolve(null);

    while (Date.now() - profilingStartedAt <= durationMs) {
      const sample = await collectSample({
        proxyPid: options.proxyPid,
        pdfPid: options.pdfPid,
        proxyUrl: proxyHealthUrl,
        pdfUrl: pdfHealthUrl,
        includePdfHealth: options.includePdfHealth,
      });
      samples.push(sample);
      await sleep(intervalMs);
    }

    const scenarioResult = await scenarioPromise;
    const finishedAt = new Date().toISOString();
    const summary = buildSummary(samples, scenarioResult, options, startedAt, finishedAt);

    const baseName = `${formatTimestampForFile(new Date())}-${options.profileName}`;
    const jsonPath = path.join(options.outputDir, `${baseName}.json`);
    const mdPath = path.join(options.outputDir, `${baseName}.md`);

    const payload = {
      summary,
      options: {
        ...options,
        scenarioPath,
      },
      scenario: scenarioResult,
      samples,
    };

    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    fs.writeFileSync(mdPath, buildMarkdownReport(summary, scenarioResult, samples), 'utf8');

    console.log(`[profile-memory] Report written: ${jsonPath}`);
    console.log(`[profile-memory] Report written: ${mdPath}`);
    console.log(`[profile-memory] Proxy growth: ${summary.proxy?.growthMb ?? 'n/a'} MB`);
    console.log(`[profile-memory] PDF growth: ${summary.pdf?.growthMb ?? 'n/a'} MB`);
  } finally {
    await shutdownChildren(children);
  }
}

main().catch((error) => {
  console.error(`[profile-memory] ${error.message}`);
  process.exit(1);
});
