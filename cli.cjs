#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const tsxCli = path.join(__dirname, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const script = path.join(__dirname, 'index.ts');
const result = spawnSync(process.execPath, [tsxCli, script, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
