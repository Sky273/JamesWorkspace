import { runNodeTool } from './tooling-preflight.mjs';

runNodeTool({
  toolName: 'eslint',
  entryRelativePath: 'node_modules/eslint/bin/eslint.js',
  args: process.argv.slice(2),
});

