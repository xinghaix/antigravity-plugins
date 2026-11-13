#!/usr/bin/env node
import { fetchAndCompileUpstream } from '../sidecars/mp_studio/upstream_sync.mjs';

const args = new Set(process.argv.slice(2));
const preserve = args.has('--preserve');

const index = fetchAndCompileUpstream({ preserveExistingActive: preserve });
console.log(
  `Synced mattpocock/skills v${index.upstream.version} (${index.upstream.commit.slice(0, 7)}): ` +
  `${index.skills.length} total skills compiled, ${index.skills.filter((s) => s.defaultEnabled).length} promoted enabled.`,
);
