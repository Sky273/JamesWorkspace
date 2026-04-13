import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const STAGE_COMMANDS = {
  core: [
    ['npm', ['run', 'typecheck']],
    ['npm', ['run', 'test']],
    ['npm', ['run', 'test:client']],
    ['npm', ['run', 'test:pdf']],
  ],
  e2e: [
    ['npm', ['run', 'test:e2e']],
  ],
};

function parseStage(argv) {
  const stageArg = argv.find((arg) => arg.startsWith('--stage='));
  const stage = stageArg?.split('=')[1] || 'all';
  if (!['core', 'e2e', 'all'].includes(stage)) {
    throw new Error(`Unsupported stage "${stage}". Expected core, e2e, or all.`);
  }
  return stage;
}

function resolveCommands(stage) {
  if (stage === 'all') {
    return [...STAGE_COMMANDS.core, ...STAGE_COMMANDS.e2e];
  }
  return STAGE_COMMANDS[stage];
}

function nowIso() {
  return new Date().toISOString();
}

async function runCommand(command, args, cwd) {
  const startedAt = Date.now();
  console.log(`\n> ${command} ${args.join(' ')}`);

  const exitCode = await new Promise((resolve) => {
    const child = process.platform === 'win32'
      ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `${command} ${args.join(' ')}`], {
        cwd,
        stdio: 'inherit',
        env: process.env,
      })
      : spawn(command, args, {
        cwd,
        stdio: 'inherit',
        env: process.env,
      });

    child.on('exit', (code) => resolve(code ?? 1));
    child.on('error', () => resolve(1));
  });

  return {
    command: `${command} ${args.join(' ')}`,
    exitCode,
    durationMs: Date.now() - startedAt,
    status: exitCode === 0 ? 'passed' : 'failed',
  };
}

async function main() {
  const stage = parseStage(process.argv.slice(2));
  const cwd = process.cwd();
  const commands = resolveCommands(stage);
  const results = [];
  const suiteStartedAt = Date.now();

  for (const [command, args] of commands) {
    const result = await runCommand(command, args, cwd);
    results.push(result);
    if (result.exitCode !== 0) {
      break;
    }
  }

  const summary = {
    stage,
    startedAt: new Date(suiteStartedAt).toISOString(),
    completedAt: nowIso(),
    durationMs: Date.now() - suiteStartedAt,
    status: results.every((result) => result.exitCode === 0) ? 'passed' : 'failed',
    results,
  };

  const outputDir = path.join(cwd, 'test-results');
  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, `validation-summary-${stage}.json`),
    `${JSON.stringify(summary, null, 2)}\n`,
    'utf8',
  );

  if (summary.status !== 'passed') {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
