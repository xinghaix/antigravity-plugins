#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MONOREPO_ROOT = resolve(__dirname, '..');

const filter = process.argv[2] || '';
const testFiles = [];

const rootTestsDir = join(MONOREPO_ROOT, 'tests');
if (!filter && existsSync(rootTestsDir)) {
  for (const f of readdirSync(rootTestsDir).filter((n) => n.endsWith('.test.mjs')).sort()) {
    testFiles.push(join(rootTestsDir, f));
  }
}

const pluginsDir = join(MONOREPO_ROOT, 'plugins');
if (existsSync(pluginsDir)) {
  for (const pDir of readdirSync(pluginsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!pDir.isDirectory()) continue;
    if (filter && pDir.name !== filter) continue;
    const pTests = join(pluginsDir, pDir.name, 'tests');
    if (!existsSync(pTests)) continue;
    for (const f of readdirSync(pTests).filter((n) => n.endsWith('.test.mjs')).sort()) {
      testFiles.push(join(pTests, f));
    }
  }
}

if (testFiles.length === 0) {
  console.error(`No test files found${filter ? ` for plugin "${filter}"` : ''}.`);
  process.exit(1);
}

for (const file of testFiles) {
  console.log(`Running ${file.slice(MONOREPO_ROOT.length + 1)}...`);
  execFileSync(process.execPath, [file], { stdio: 'inherit' });
}

console.log(`ALL MONOREPO TESTS PASSED (${testFiles.length} suites)`);
