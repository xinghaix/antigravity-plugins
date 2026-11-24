import assert from 'node:assert/strict';
import http from 'node:http';
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
import { createConversationClient, normalizeConversationServiceOrigin } from '../sidecars/mp_studio/conversations_client.mjs';
import { buildOrchestrationPlan, createStore, inspectSkillsManifests, parseScratchTickets } from '../sidecars/mp_studio/studio_store.mjs';
import {
  adaptSkillMarkdown,
  compileUpstreamDirectory,
  parseSkillMarkdown,
  validateFrontmatter,
} from '../sidecars/mp_studio/upstream_sync.mjs';

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

  // 5b. Topological waves + 2.34+ run_workflow & swarm plan builder + cycle detection
  const authFeat = board.features.find((f) => f.slug === 'auth-flow');
  assert.ok(authFeat);
  assert.equal(authFeat.waves.length, 2);
  assert.deepEqual(authFeat.waves[0], { wave: 1, tickets: ['02'] });
  assert.deepEqual(authFeat.waves[1], { wave: 2, tickets: ['03'] });
  assert.equal(authFeat.cycles.length, 0);

  writeFileSync(join(wsDir, '.scratch', 'auth-flow', 'spec.md'), '# Auth Spec\n');
  const orchPlan = buildOrchestrationPlan({ workspacePath: wsDir, feature: 'auth-flow' });
  assert.equal(orchPlan.ok, true);
  assert.equal(orchPlan.feature, 'auth-flow');
  assert.equal(orchPlan.waves.length, 2);
  assert.ok(orchPlan.workflowScript.includes('phase(f"Wave {w_num}: Parallel Ticket Implementation")'));
  assert.ok(orchPlan.workflowScript.includes('workspace="share"'));
  assert.ok(orchPlan.workflowScript.includes('mp-standards-reviewer'));
  assert.ok(orchPlan.workflowScript.includes('mp-spec-reviewer'));
  assert.ok(orchPlan.swarmPlanJson.goal.title.includes('auth-flow'));
  assert.equal(orchPlan.swarmPlanJson.threads.length, 2);
  assert.equal(orchPlan.ticketPrompts.length, 2);

  // Cycle detection in parseScratchTickets
  const cyclicDir = join(wsDir, '.scratch', 'cyclic-feat', 'issues');
  mkdirSync(cyclicDir, { recursive: true });
  writeFileSync(join(cyclicDir, '01-a.md'), '# 01: A\n\n**Blocked by:** 02\n\n**Status:** ready-for-agent\n');
  writeFileSync(join(cyclicDir, '02-b.md'), '# 02: B\n\n**Blocked by:** 01\n\n**Status:** ready-for-agent\n');
  const cycBoard = parseScratchTickets(wsDir);
  const cycFeat = cycBoard.features.find((f) => f.slug === 'cyclic-feat');
  assert.equal(cycFeat.waves.length, 0);
  assert.equal(cycFeat.cycles.length, 2);

  // 5c. Upstream YAML frontmatter validation (PR #1453 / #1455) & 2.34+ orchestration notes
  const quotedFm = '---\nname: software-factory\ndescription: "Run a factory: triage, build, verify."\n---\nBody\n';
  assert.equal(validateFrontmatter(quotedFm).valid, true);
  assert.equal(validateFrontmatter('---\nname: bad\ndescription: Unquoted: colon breaks yaml\n---\n').valid, false);

  const implPreview = store.getSkillPreview({ name: 'implement-spec' });
  assert.ok(implPreview.adaptedSkillMd.includes('run_workflow'));
  assert.ok(implPreview.adaptedSkillMd.includes('swarm_pane'));
  assert.ok(implPreview.adaptedSkillMd.includes('workspace="share"'));

  const loopPreview = store.getSkillPreview({ name: 'loop-me' });
  assert.ok(loopPreview.adaptedSkillMd.includes('run_workflow'));
  assert.ok(loopPreview.adaptedSkillMd.includes('implementer = agent'));

  const recipePlan = buildOrchestrationPlan({ recipeId: 'code-review-dual-axis' });
  assert.equal(recipePlan.mode, 'recipe');
  assert.ok(recipePlan.workflowScript.includes('mp-standards-reviewer'));

  // Verify st.orchestrationRecipes exists in getStudioState
  st = store.getState([wsDir]);
  assert.ok(Array.isArray(st.orchestrationRecipes) && st.orchestrationRecipes.length >= 6);

  // 5d. Antigravity 2.35+ hierarchical .agents/skills.json / rules.json inspection & zero-copy manifest delivery
  const manifestWs = join(tempRoot, 'mono-235');
  const pkgWs = join(manifestWs, 'packages', 'web');
  const sharedDir = join(manifestWs, 'tools', 'shared-skills');
  mkdirSync(join(manifestWs, '.git'), { recursive: true });
  mkdirSync(join(manifestWs, '.agents'), { recursive: true });
  mkdirSync(join(pkgWs, '.agents'), { recursive: true });
  mkdirSync(join(sharedDir, 'alpha-skill'), { recursive: true });
  mkdirSync(join(sharedDir, 'experimental-beta'), { recursive: true });
  writeFileSync(join(sharedDir, 'alpha-skill', 'SKILL.md'), '---\nname: alpha-skill\ndescription: Alpha.\n---\nBody\n');
  writeFileSync(join(sharedDir, 'experimental-beta', 'SKILL.md'), '---\nname: experimental-beta\ndescription: Beta.\n---\nBody\n');
  writeFileSync(
    join(manifestWs, '.agents', 'skills.json'),
    JSON.stringify({ entries: [{ path: 'tools/shared-skills', exclude: ['experimental-.*'] }] }, null, 2),
  );
  writeFileSync(join(manifestWs, '.agents', 'rules.json'), JSON.stringify({ entries: [] }, null, 2));
  const sharedInhJson = join(manifestWs, 'shared-inh.json');
  writeFileSync(
    sharedInhJson,
    JSON.stringify({ entries: [{ path: 'tools/shared-skills', include_only: ['alpha-skill'] }] }, null, 2),
  );
  writeFileSync(
    join(pkgWs, '.agents', 'skills.json'),
    JSON.stringify({ inherits: [{ path: '../../shared-inh.json' }], entries: [] }, null, 2),
  );
  const mfInspect = inspectSkillsManifests(pkgWs, fakeHome);
  assert.equal(mfInspect.hasSkillsJson, true);
  assert.equal(mfInspect.hasRulesJson, true);
  assert.equal(mfInspect.ancestors.length, 2, 'Should walk upward from packages/web to .git repo root');
  assert.ok(mfInspect.resolvedSkills.some((s) => s.name === 'alpha-skill'));
  assert.equal(mfInspect.resolvedSkills.some((s) => s.name === 'experimental-beta'), false);

  // Zero-copy deliver via mode: 'manifest' preserves unrelated entries & creates backup
  const customKeepDir = join(wsDir, 'custom-skills');
  mkdirSync(join(customKeepDir, 'local-helper'), { recursive: true });
  writeFileSync(join(customKeepDir, 'local-helper', 'SKILL.md'), '---\nname: local-helper\ndescription: Local.\n---\nHi\n');
  mkdirSync(join(wsDir, '.agents'), { recursive: true });
  writeFileSync(
    join(wsDir, '.agents', 'skills.json'),
    JSON.stringify({ entries: [{ path: 'custom-skills' }] }, null, 2),
  );
  const mfDeliver = store.deliverToWorkspace({
    workspacePath: wsDir,
    skillNames: ['grill-with-docs'],
    mode: 'manifest',
  });
  assert.equal(mfDeliver.mode, 'manifest');
  assert.ok(mfDeliver.delivered.includes('grill-with-docs'));
  assert.ok(mfDeliver.delivered.includes('grilling'));
  assert.ok(mfDeliver.delivered.includes('domain-modeling'));
  const writtenMf = JSON.parse(readFileSync(join(wsDir, '.agents', 'skills.json'), 'utf-8'));
  assert.equal(writtenMf.entries.length, 2, 'Should preserve custom-skills entry and add plugin skills entry');
  assert.ok(mfDeliver.workspace.manifests.resolvedSkills.some((s) => s.name === 'local-helper'));

  // 5e. Antigravity 2.35+ ConversationService HTTP+JSON client
  assert.equal(normalizeConversationServiceOrigin('localhost:56266'), 'http://127.0.0.1:56266');
  assert.equal(normalizeConversationServiceOrigin('192.168.1.50:56266'), null);
  assert.equal(createConversationClient({ env: {} }).isAvailable(), false);

  const convRequests = [];
  const convServer = http.createServer((req, res) => {
    let rawBody = '';
    req.on('data', (c) => { rawBody += c; });
    req.on('end', () => {
      assert.equal(req.headers['connect-protocol-version'], '1');
      assert.equal(req.headers['x-antigravity-csrf-token'], 'conv-secret-235');
      const parsedBody = rawBody ? JSON.parse(rawBody) : {};
      convRequests.push({ url: req.url, body: parsedBody });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      if (req.url.endsWith('/ListConversations')) {
        res.end(JSON.stringify({
          conversations: [{
            id: 'conv-1',
            metadata: { tags: ['mp-studio'] },
            annotations: { title: 'Wave #1', pinned: false },
            state: { summary: 'Wave #1', runState: 'RUN_STATE_IDLE' },
          }],
        }));
      } else if (req.url.endsWith('/CreateConversation')) {
        res.end(JSON.stringify({
          conversation: {
            id: 'conv-created-235',
            metadata: { tags: parsedBody.tags || [] },
            annotations: { title: parsedBody.title || '' },
            state: { runState: 'RUN_STATE_RUNNING' },
          },
        }));
      } else if (req.url.endsWith('/UpdateConversation')) {
        res.end(JSON.stringify({
          conversation: {
            id: parsedBody.conversationId,
            annotations: parsedBody.annotations,
          },
        }));
      } else {
        res.end('{}');
      }
    });
  });
  await new Promise((r) => convServer.listen(0, '127.0.0.1', r));
  try {
    const convPort = convServer.address().port;
    const convClient = createConversationClient({
      env: {
        ANTIGRAVITY_LS_ADDRESS: `localhost:${convPort}`,
        ANTIGRAVITY_CSRF_TOKEN: 'conv-secret-235',
      },
    });
    assert.equal(convClient.isAvailable(), true);
    const listed = await convClient.listConversations({ pageSize: 10, tags: ['mp-studio'] });
    assert.equal(listed.conversations.length, 1);
    const created = await convClient.createConversation({
      title: 'Run Ticket 01',
      model: 'flash',
      tags: ['mp-studio'],
      prompt: '/implement .scratch/auth-flow/issues/01.md',
    });
    assert.equal(created.conversation.id, 'conv-created-235');
    assert.deepEqual(convRequests[1].body.prompt, [{ text: '/implement .scratch/auth-flow/issues/01.md' }]);
    const updated = await convClient.updateConversation({
      conversationId: 'conv-created-235',
      annotations: { pinned: true },
    });
    assert.equal(updated.conversation.annotations.pinned, true);
  } finally {
    await new Promise((r) => convServer.close(r));
  }

  // 6. Uninstall cleanup
  const unRes = uninstallPlugin({ target: pluginTarget });
  assert.equal(unRes.removed, true);
  assert.equal(existsSync(pluginTarget), false);

  console.log('ALL TESTS PASSED (compiler, cli link/copy, store toggles, workspace delivery, setup/backup, ticket DAG)');
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
