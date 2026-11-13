import assert from 'node:assert/strict';
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getStatus, installPlugin, uninstallPlugin } from '../scripts/cli.mjs';
import { createStore, parseScratchTickets } from '../sidecars/mp_studio/studio_store.mjs';
import { adaptSkillMarkdown, compileUpstreamDirectory, parseSkillMarkdown } from '../sidecars/mp_studio/upstream_sync.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const tempRoot = mkdtempSync(join(tmpdir(), 'mp-studio-test-'));

try {
  // 1. Upstream compiler transform tests
  const sampleUpstream = `---
name: grill-with-docs
description: A relentless interview.
disable-model-invocation: true
---

Call the Skill tool twice, for "grilling" and "domain-modeling".
Also call the Skill tool with "codebase-design".
`;
  const adapted = adaptSkillMarkdown({
    bucket: 'engineering',
    skillName: 'grill-with-docs',
    rawContent: sampleUpstream,
  });
  assert.equal(adapted.invocation, 'user');
  assert.equal(/\bSkill tool\b/.test(adapted.adaptedMarkdown), false);
  assert.ok(adapted.adaptedMarkdown.includes('[grilling](../grilling/SKILL.md)'));
  assert.ok(adapted.adaptedMarkdown.includes('[domain-modeling](../domain-modeling/SKILL.md)'));
  assert.ok(adapted.adaptedMarkdown.includes('[codebase-design](../codebase-design/SKILL.md)'));
  assert.ok(adapted.adaptedMarkdown.includes('## Antigravity Native Runtime Notes'));
  assert.ok(adapted.adaptedMarkdown.includes('exit_plan_mode'));

  // Compile from a mock upstream dir into a temp repo copy
  const mockUpstreamRepo = join(tempRoot, 'mock-upstream');
  const mockCompiledRepo = join(tempRoot, 'mock-compiled');
  cpSync(join(REPO_ROOT, 'overrides'), join(mockCompiledRepo, 'overrides'), { recursive: true });
  cpSync(join(REPO_ROOT, 'catalog', 'system'), join(mockCompiledRepo, 'catalog', 'system'), { recursive: true });
  mkdirSync(join(mockUpstreamRepo, 'skills', 'engineering', 'grill-with-docs', 'agents'), { recursive: true });
  mkdirSync(join(mockUpstreamRepo, 'skills', 'productivity', 'grilling'), { recursive: true });
  mkdirSync(join(mockUpstreamRepo, 'skills', 'engineering', 'domain-modeling'), { recursive: true });
  writeFileSync(join(mockUpstreamRepo, 'skills', 'engineering', 'grill-with-docs', 'SKILL.md'), sampleUpstream);
  writeFileSync(join(mockUpstreamRepo, 'skills', 'engineering', 'grill-with-docs', 'agents', 'openai.yaml'), 'interface:\n  display_name: Grill\n');
  writeFileSync(join(mockUpstreamRepo, 'skills', 'productivity', 'grilling', 'SKILL.md'), '---\nname: grilling\ndescription: Interview.\n---\nAsk questions.\n');
  writeFileSync(join(mockUpstreamRepo, 'skills', 'engineering', 'domain-modeling', 'SKILL.md'), '---\nname: domain-modeling\ndescription: Glossary.\n---\nUpdate GLOSSARY.md.\n');

  const compiledIdx = compileUpstreamDirectory({
    sourceRepoDir: mockUpstreamRepo,
    targetRepoRoot: mockCompiledRepo,
    commitSha: 'deadbeef',
    upstreamVersion: '9.9.9',
  });
  assert.equal(compiledIdx.skills.length, 3);
  assert.equal(
    existsSync(join(mockCompiledRepo, 'catalog', 'adapted', 'engineering', 'grill-with-docs', 'agents', 'openai.yaml')),
    false,
    'openai.yaml should be stripped during compile',
  );

  // 2. CLI install (--link default and --copy) + studio_store dynamic toggling
  const fakeHome = join(tempRoot, 'home');
  const pluginTarget = join(fakeHome, '.gemini', 'config', 'plugins', 'mattpocock-skills');
  const stateDir = join(fakeHome, '.gemini', 'config', 'mattpocock-skills-state');
  const wsDir = join(tempRoot, 'sample-workspace');
  mkdirSync(wsDir, { recursive: true });

  // 2a. Default --link install
  const linkRes = installPlugin({ target: pluginTarget, sourceRoot: REPO_ROOT });
  assert.equal(linkRes.mode, 'link');
  assert.equal(lstatSync(pluginTarget).isSymbolicLink(), true);
  assert.equal(realpathSync(pluginTarget), realpathSync(REPO_ROOT));

  const linkStatus = getStatus({ target: pluginTarget, home: fakeHome });
  assert.equal(linkStatus.installMode, 'symlink');
  assert.ok(linkStatus.activeSkillsCount >= 28);

  // 2b. Switch to --copy install for untracked global dynamic toggling
  const copyRes = installPlugin({ link: false, target: pluginTarget, sourceRoot: REPO_ROOT });
  assert.equal(copyRes.mode, 'copy');
  assert.equal(lstatSync(pluginTarget).isDirectory(), true);
  assert.equal(lstatSync(pluginTarget).isSymbolicLink(), false);

  const store = createStore({
    homeDir: fakeHome,
    repoRoot: REPO_ROOT,
    pluginTarget,
    stateDir,
  });

  let st = store.getState([wsDir]);
  assert.equal(st.skills.length >= 39, true);
  assert.equal(st.skills.find((s) => s.name === 'grill-with-docs')?.enabled, true);
  assert.equal(st.skills.find((s) => s.name === 'loop-me')?.enabled, false);

  // Disable grilling, then re-enable grill-with-docs -> should auto-enable grilling!
  store.toggleSkill({ name: 'grilling', enabled: false });
  assert.equal(existsSync(join(pluginTarget, 'skills', 'grilling')), false);

  const reEnable = store.toggleSkill({ name: 'grill-with-docs', enabled: true });
  assert.ok(reEnable.autoEnabled.includes('grilling'));
  assert.equal(existsSync(join(pluginTarget, 'skills', 'grilling', 'SKILL.md')), true);

  // Toggle slash command visibility
  store.toggleSkill({ name: 'grilling', enabled: true, disableSlashCommand: true });
  const parsedGrilling = parseSkillMarkdown(readFileSync(join(pluginTarget, 'skills', 'grilling', 'SKILL.md'), 'utf-8'));
  assert.equal(parsedGrilling.disableSlashCommand, true);

  // Toggle bucket & apply core preset
  store.toggleBucket({ bucket: 'in-progress', enabled: true });
  assert.equal(existsSync(join(pluginTarget, 'skills', 'loop-me', 'SKILL.md')), true);

  const presetRes = store.applyPreset({ preset: 'core' });
  assert.equal(presetRes.enabledCount, 10);
  assert.equal(existsSync(join(pluginTarget, 'skills', 'loop-me')), false);
  assert.equal(existsSync(join(pluginTarget, 'skills', 'tdd', 'SKILL.md')), true);

  // Preview adapted vs upstream
  const preview = store.getSkillPreview({ name: 'code-review' });
  assert.ok(preview.adaptedSkillMd.includes('mp-standards-reviewer'));
  assert.ok(preview.upstreamSkillMd.includes('Standards'));

  // 3. Workspace .agents/skills/ delivery (copy & link)
  const deliverRes = store.deliverToWorkspace({
    workspacePath: wsDir,
    skillNames: ['grill-with-docs'],
    mode: 'copy',
  });
  assert.ok(deliverRes.delivered.includes('grill-with-docs'));
  assert.ok(deliverRes.delivered.includes('grilling'));
  assert.ok(deliverRes.delivered.includes('domain-modeling'));
  assert.equal(existsSync(join(wsDir, '.agents', 'skills', 'grilling', 'SKILL.md')), true);

  store.removeWorkspaceSkill({ workspacePath: wsDir, skillName: 'grilling' });
  assert.equal(existsSync(join(wsDir, '.agents', 'skills', 'grilling')), false);

  // 4. Visual Repo Setup & Backup Restore
  writeFileSync(join(wsDir, 'AGENTS.md'), '# Project Rules\n\nKeep code clean.\n');
  const setupRes = store.saveRepoSetup({
    workspacePath: wsDir,
    trackerType: 'local',
    labels: {
      'needs-triage': 'triage:new',
      'ready-for-agent': 'agent:ready',
    },
    domainLayout: 'single-context',
    targetRuleFile: 'AGENTS.md',
  });
  assert.equal(existsSync(join(wsDir, 'docs', 'agents', 'issue-tracker.md')), true);
  assert.ok(readFileSync(join(wsDir, 'docs', 'agents', 'triage-labels.md'), 'utf-8').includes('agent:ready'));
  const agentsTxt = readFileSync(join(wsDir, 'AGENTS.md'), 'utf-8');
  assert.ok(agentsTxt.includes('# Project Rules'));
  assert.ok(agentsTxt.includes('## Agent skills'));

  // Idempotent update of AGENTS.md + restore backup
  store.saveRepoSetup({
    workspacePath: wsDir,
    trackerType: 'github',
    domainLayout: 'single-context',
    targetRuleFile: 'AGENTS.md',
  });
  const agentsUpdated = readFileSync(join(wsDir, 'AGENTS.md'), 'utf-8');
  assert.equal(agentsUpdated.match(/## Agent skills/g)?.length, 1);

  const backups = store.listBackups();
  assert.ok(backups.length >= 2);
  store.restoreBackup({ id: setupRes.backupId });
  assert.equal(existsSync(join(wsDir, 'docs', 'agents', 'issue-tracker.md')), false);
  assert.equal(readFileSync(join(wsDir, 'AGENTS.md'), 'utf-8'), '# Project Rules\n\nKeep code clean.\n');

  // 5. .scratch ticket DAG parsing
  const issuesDir = join(wsDir, '.scratch', 'auth-flow', 'issues');
  mkdirSync(issuesDir, { recursive: true });
  writeFileSync(
    join(issuesDir, '01-token-store.md'),
    '# 01: Token Store\n\n**Blocked by:** None\n\n**Status:** done\n\n- [x] Store works\n',
  );
  writeFileSync(
    join(issuesDir, '02-login-endpoint.md'),
    '# 02: Login Endpoint\n\n**Blocked by:** 01\n\n**Status:** ready-for-agent\n\n- [ ] Endpoint passes\n',
  );
  writeFileSync(
    join(issuesDir, '03-refresh-flow.md'),
    '# 03: Refresh Flow\n\n**Blocked by:** 02\n\n**Status:** ready-for-agent\n\n- [ ] Refresh passes\n',
  );

  const board = parseScratchTickets(wsDir);
  assert.equal(board.tickets.length, 3);
  assert.equal(board.tickets.find((x) => x.num === '01')?.state, 'done');
  assert.equal(board.tickets.find((x) => x.num === '02')?.state, 'ready');
  assert.equal(board.tickets.find((x) => x.num === '03')?.state, 'blocked');

  // 6. Uninstall cleanup
  const unRes = uninstallPlugin({ target: pluginTarget });
  assert.equal(unRes.removed, true);
  assert.equal(existsSync(pluginTarget), false);

  console.log('ALL TESTS PASSED (compiler, cli link/copy, store toggles, workspace delivery, setup/backup, ticket DAG)');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
