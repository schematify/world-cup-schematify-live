#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const tsxPackage = require.resolve('tsx/package.json', { paths: [__dirname] });
const tsxCli = path.join(path.dirname(tsxPackage), 'dist', 'cli.mjs');
const script = path.join(__dirname, 'index.ts');
const result = spawnSync(process.execPath, [tsxCli, script, ...process.argv.slice(2)], {
  stdio: 'inherit',
});
process.exit(result.status ?? 1);
