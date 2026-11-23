import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUCKETS,
  inferFallbackMeta,
  ORCHESTRATION_RECIPES,
  PRESETS,
  SCENARIOS,
  SKILL_META,
  WORKFLOW_SPINE,
} from '../../overrides/metadata.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = resolve(__dirname, '../..');
export const UPSTREAM_GIT_URL = 'https://github.com/mattpocock/skills.git';

const PLAN_MODE_WRITE_SKILLS = new Set([
  'grill-with-docs',
  'setup-matt-pocock-skills',
  'to-spec',
  'to-tickets',
  'triage',
  'wayfinder',
]);

export function parseSkillMarkdown(raw) {
  const normalized = String(raw || '').replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return {
      frontmatter: {},
      name: '',
      description: '',
      disableModelInvocation: false,
      disableSlashCommand: false,
      argumentHint: '',
      body: normalized.trimStart(),
    };
  }

  const yamlBlock = match[1];
  const body = match[2].replace(/^\n+/, '');
  const frontmatter = {};

  const lines = yamlBlock.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!kv) {
      i += 1;
      continue;
    }
    const key = kv[1];
    let val = kv[2].trim();

    if (val === '|-' || val === '|' || val === '>-' || val === '>') {
      const folded = val.startsWith('>');
      const blockLines = [];
      i += 1;
      while (i < lines.length && (/^\s+/.test(lines[i]) || lines[i].trim() === '')) {
        blockLines.push(lines[i].replace(/^\s{2}/, ''));
        i += 1;
      }
      val = folded
        ? blockLines.map((l) => l.trim()).filter(Boolean).join(' ')
        : blockLines.join('\n').trim();
      frontmatter[key] = val;
      continue;
    }

    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      if (val.startsWith('"')) {
        try {
          val = JSON.parse(val);
        } catch {
          val = val.slice(1, -1);
        }
      } else {
        val = val.slice(1, -1).replace(/''/g, "'");
      }
    }
    frontmatter[key] = val;
    i += 1;
  }

  return {
    frontmatter,
    name: String(frontmatter.name || '').trim(),
    description: String(frontmatter.description || '').trim(),
    disableModelInvocation: String(frontmatter['disable-model-invocation'] || '').toLowerCase() === 'true',
    disableSlashCommand: String(frontmatter['disable-slash-command'] || '').toLowerCase() === 'true',
    argumentHint: String(frontmatter['argument-hint'] || '').trim(),
    body,
  };
}

/**
 * Validate YAML frontmatter compatibility (quoted values, required name & description).
 */
export function validateFrontmatter(raw) {
  const normalized = String(raw || '').replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!match) {
    return { valid: false, errors: ['Missing YAML frontmatter delimiters (---)'] };
  }
  const parsed = parseSkillMarkdown(normalized);
  const errors = [];
  if (!parsed.name) errors.push('Frontmatter missing non-empty "name"');
  if (!parsed.description) errors.push('Frontmatter missing non-empty "description"');
  // Detect unquoted single-line scalar containing ": " which breaks strict YAML parsers
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^description:\s*(.+)$/);
    if (!kv) continue;
    const rawVal = kv[1].trim();
    const isBlock = rawVal === '|-' || rawVal === '|' || rawVal === '>-' || rawVal === '>';
    const isQuoted = (rawVal.startsWith('"') && rawVal.endsWith('"')) || (rawVal.startsWith("'") && rawVal.endsWith("'"));
    if (!isBlock && !isQuoted && /:\s/.test(rawVal)) {
      errors.push('Unquoted "description" contains ": " which may fail strict YAML frontmatter checks');
    }
  }
  return { valid: errors.length === 0, errors, parsed };
}

export function serializeSkillMarkdown({ name, description, disableSlashCommand = false, body }) {
  const safeDesc = JSON.stringify(String(description || '').replace(/\s+/g, ' ').trim());
  const lines = [
    '---',
    `name: ${name}`,
    `description: ${safeDesc}`,
  ];
  if (disableSlashCommand) {
    lines.push('disable-slash-command: true');
  }
  lines.push('---', '', String(body || '').trimEnd(), '');
  return lines.join('\n');
}

function rewriteSkillToolCalls(text) {
  let out = text;

  // 1. Call the Skill tool twice, for "A" and "B"
  out = out.replace(
    /\b(Call|call)\s+the\s+Skill\s+tool\s+twice,\s+for\s+["`]([^"`]+)["`]\s+and\s+["`]([^"`]+)["`]/g,
    (_, verb, a, b) => {
      const lead = verb === 'Call' ? 'Read and follow' : 'read and follow';
      return `${lead} both [${a}](../${a}/SKILL.md) and [${b}](../${b}/SKILL.md) via \`read_file\``;
    },
  );

  // 2. Call/calling/calls the Skill tool with "X"
  out = out.replace(
    /\b(Call|call|calls|calling)\s+the\s+Skill\s+tool\s+with\s+["`]([^"`]+)["`]/g,
    (_, verb, target) => {
      let lead = 'read and follow';
      if (verb === 'Call') lead = 'Read and follow';
      else if (verb === 'calls') lead = 'reads and follows';
      else if (verb === 'calling') lead = 'reading and following';
      return `${lead} [${target}](../${target}/SKILL.md) via \`read_file\``;
    },
  );

  // 3. Generic Skill tool phrasing in wayfinder, handoff, etc.
  out = out.replace(
    /\b(Call|call)\s+the\s+Skill\s+tool\s+for\s+whichever\s+skills/g,
    (_, verb) => `${verb === 'Call' ? 'Read and follow' : 'read and follow'} the \`SKILL.md\` files for whichever skills`,
  );
  out = out.replace(
    /should\s+call\s+the\s+Skill\s+tool\s+for/g,
    'should load via `read_file` and follow',
  );
  out = out.replace(
    /\bthe\s+Skill\s+tool\b/g,
    '`read_file` on the target `SKILL.md`',
  );

  return out;
}

function buildNativeNotes({ skillName }) {
  const notes = [];

  if (skillName === 'code-review') {
    notes.push(
      '- **Subagent execution**: Dispatch `mp-standards-reviewer` and `mp-spec-reviewer` in parallel using `invoke_subagent` (`Workspace: "inherit"`). Both are read-only leaf subagents without subagent-spawning permissions, preventing recursive `/code-review` loops. Stop calling tools after dispatching and wait for Antigravity reactive wakeup.',
      '- **Structured `run_workflow` option (Antigravity 2.34+)**: When reviewing large branches or automating verdicts in a pipeline, you can run `parallel(["standards", "spec"], ...)` via `run_workflow` with `type_name="mp-standards-reviewer"` and `type_name="mp-spec-reviewer"` and strict JSON verdict `schema` outputs.',
    );
  }
  if (skillName === 'research') {
    notes.push(
      '- **Use `mp-researcher` (not built-in `research`)**: Always pass `TypeName: "mp-researcher"` to `invoke_subagent` so the background researcher has `search_web` and `write_file` access. Antigravity\'s built-in `research` subagent runs in an offline, read-only sandbox.',
    );
  }
  if (skillName === 'implement-spec') {
    notes.push(
      '- **Antigravity 2.34+ Orchestration Modes** (pick the lightest fit for the DAG):',
      '  - **Mode A · Topological Wave Runner (`run_workflow`, recommended for 3+ tickets)**: Read the `run-workflow` skill and execute topological waves deterministically in Python: `phase("Wave N")`, `await parallel(wave_tickets, lambda t: agent(..., workspace="share", schema=...))`, run a wave-merger/test turn, then close with `parallel` `mp-standards-reviewer` + `mp-spec-reviewer`. Pass sparse file-path pointers (`spec.md`, ticket `.md`, `GLOSSARY.md`) in every agent prompt because workflow agents do not share conversation history.',
      '  - **Mode B · Collaborative Board (`swarm`, for cross-worker contract coordination)**: Read `swarm_pane`, spawn workers via `swarm(action="add", workspace="share", name=...)`, and publish `<appData>/brain/<conversationId>/.system_generated/swarm/plan.json` (`goal`, `tasks`, `threads`) so Antigravity\'s Swarm Overview UI tracks wave progress live.',
      '  - **Mode C · Lightweight Subagents (`invoke_subagent`)**: For 1–2 tickets, launch `invoke_subagent` with `TypeName: "self"` and `Workspace: "share"` (no polling needed; reactive wakeup notifies on completion). Use `mp-explorer` before dispatching to inspect hotspots read-only.',
      '- **Visual DAG Waves**: Users can inspect computed topological ticket waves and generate ready-to-run `run_workflow` / `swarm` scripts in `[Mattpocock Skills](sidecar://mattpocock-skills/mp_studio/)`.',
    );
  }
  if (skillName === 'codebase-design') {
    notes.push(
      '- **Design-it-twice orchestration (`run_workflow` / `invoke_subagent`)**: Explore radically contrasting module seams in parallel via `run_workflow` `parallel(...)` (`workspace="inherit"` for read-only interface proposals or `"share"` for code prototypes) or parallel `invoke_subagent` calls.',
    );
  }
  if (skillName === 'wayfinder') {
    notes.push(
      '- **Parallel primary-source fan-out (`run_workflow` + `mp-researcher`)**: When clearing 3+ independent decision unknowns simultaneously, use `run_workflow` `parallel()` dispatching `type_name="mp-researcher"` agents with structured citation schemas, and use `mp-explorer` for read-only codebase checks.',
    );
  }
  if (skillName === 'triage') {
    notes.push(
      '- **Batch triage pipeline (`run_workflow`)**: When triaging a backlog of open issues or PRs at once, use `run_workflow` `parallel()` (with lighter `model="flash"` if appropriate) to deduplicate and gather evidence before interactive verification.',
    );
  }
  if (skillName === 'diagnosing-bugs') {
    notes.push(
      '- **Isolated reproducer & fact-finding**: Use `mp-explorer` via `invoke_subagent` for read-only trace/log investigation without filling the main diagnostic window, or `run_workflow` when bisecting multiple candidate hypotheses in parallel.',
    );
  }
  if (skillName === 'loop-me') {
    notes.push(
      '- **Antigravity 2.34+ stateful Generator ↔ Verifier loop (`run_workflow`)**: Read the `run-workflow` skill and instantiate two persistent multi-turn agents (`implementer = agent(..., workspace="share")` and `verifier = agent(...)`) inside a bounded `for i in range(max_iterations)` loop (`await implementer(...)` -> `await verifier(..., schema={"passed": boolean, "feedback": string})`), keeping iteration history across rounds without polluting the parent conversation.',
    );
  }
  if (skillName === 'chief-of-staff') {
    notes.push(
      '- **Antigravity 2.34+ `schedule` + `run_workflow` / `swarm` mapping**: Map recurring briefings and inbox scans to `schedule(CronExpression=..., IsDaemon=True)`, and fan out per-stream repo/issue checks concurrently via `run_workflow` or `swarm`.',
    );
  }
  if (skillName === 'software-factory') {
    notes.push(
      '- **Antigravity 2.34+ local factory mapping**: When prototyping or running factory pipelines inside Antigravity, map Orchestrator to `run_workflow`, isolated Runners to `agent(..., workspace="branch"|"share")` or `swarm`, scheduled triggers to `schedule`, and deterministic tool guardrails to plugin `hooks.json`.',
    );
  }
  if (skillName === 'improve-codebase-architecture') {
    notes.push(
      '- **Codebase explorer**: Use `invoke_subagent` with `TypeName: "mp-explorer"` for read-only hotspot scanning.',
      '- **Antigravity Generative UI option**: In addition to saving a standalone HTML file (`<tmpdir>/architecture-review-<timestamp>.html` or `.scratch/reports/`), you may render the report as an Antigravity HTML Artifact (`UserFacing: true`) using the allowlisted `https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js` script and host CSS theme tokens (`--card`, `--foreground`, `--border`, `--muted-foreground`).',
    );
  }
  if (skillName === 'prototype') {
    notes.push(
      '- **Antigravity Generative UI option**: For single-file HTML logic/state prototypes, you may also write an Antigravity HTML Artifact (`UserFacing: true`) styled with allowlisted `https://www.gstatic.com/antigravity/web/dev/tailwindcss.min.js` and host theme variables (`--card`, `--foreground`, `--border`) so the user can interact directly in the side pane.',
    );
  }
  if (skillName === 'setup-matt-pocock-skills') {
    notes.push(
      '- **Antigravity steering file preference**: Prefer updating `AGENTS.md` (or `GEMINI.md` / `.agents/rules/mattpocock-skills.md`) unless `CLAUDE.md` is explicitly already in use for this repo.',
      '- **Visual setup alternative**: Users can also configure tracker, triage labels, and rules visually in one click via `[Mattpocock Skills](sidecar://mattpocock-skills/mp_studio/)`.',
    );
  }
  if (skillName === 'ask-matt') {
    notes.push(
      '- **Context reset mapping**: Where this guide refers to `/clear`, start a **New Conversation** in Antigravity (`/compact` works natively).',
      '- **Visual workflow navigator & 2.34+ orchestration recipes**: Users can browse the full flow visually and launch `run_workflow` / `swarm` blueprints in `[Mattpocock Skills](sidecar://mattpocock-skills/mp_studio/)`.',
    );
  }
  if (skillName === 'handoff') {
    notes.push(
      '- **Context reset mapping**: After writing the handoff file, instruct the user to start a **New Conversation** in Antigravity (equivalent to `/clear`) and point the new session at the generated handoff file.',
    );
  }
  if (skillName === 'grill-me') {
    notes.push(
      '- **Command disambiguation**: Antigravity includes a built-in `/grill-me` workflow. Inside code repositories, prefer `/grill-with-docs`; for non-code grilling with this skill, refer to `mattpocock-skills:grill-me` explicitly.',
    );
  }
  if (skillName === 'grilling') {
    notes.push(
      '- **Fact-finding subagent**: Dispatch `mp-explorer` via `invoke_subagent` when you need read-only codebase facts without polluting the grilling context.',
    );
  }
  if (PLAN_MODE_WRITE_SKILLS.has(skillName)) {
    notes.push(
      '- **Plan Mode handoff**: If Antigravity Plan Mode is active while interviewing or exploring, stay read-only during questioning and call `exit_plan_mode` with the concrete file edits when ready to write `GLOSSARY.md`, `docs/adr/`, `docs/agents/`, or `.scratch/` artifacts.',
    );
  }

  return notes;
}

export function adaptSkillMarkdown({ bucket, skillName, rawContent, disableSlashCommand = false }) {
  const parsed = parseSkillMarkdown(rawContent);
  const invocation = parsed.disableModelInvocation ? 'user' : 'model';
  const adaptations = [];

  let body = parsed.body;
  if (parsed.argumentHint && !body.includes('Argument hint:')) {
    body = `> **Argument hint**: ${parsed.argumentHint}\n\n${body}`;
    adaptations.push('preserved-argument-hint');
  }

  const rewrittenBody = rewriteSkillToolCalls(body);
  if (rewrittenBody !== body) {
    adaptations.push('rewrote-skill-tool-to-read_file');
  }
  body = rewrittenBody;

  if (skillName === 'ask-matt' || skillName === 'handoff') {
    const beforeClear = body;
    body = body.replace(/`\/clear`(?![^\n]*New Conversation)/g, '`/clear` (start a **New Conversation** in Antigravity)');
    if (body !== beforeClear) {
      adaptations.push('mapped-clear-to-new-conversation');
    }
  }

  const notes = buildNativeNotes({ bucket, skillName });
  if (notes.length > 0) {
    body = `${body.trimEnd()}\n\n## Antigravity Native Runtime Notes\n\n${notes.join('\n')}\n`;
    adaptations.push('added-native-runtime-notes');
  }

  const adaptedMarkdown = serializeSkillMarkdown({
    name: skillName,
    description: parsed.description || `Matt Pocock ${skillName} skill.`,
    disableSlashCommand,
    body,
  });

  return {
    name: skillName,
    bucket,
    invocation,
    description: parsed.description,
    argumentHint: parsed.argumentHint,
    adaptations,
    adaptedMarkdown,
    upstreamMarkdown: String(rawContent || '').replace(/\r\n/g, '\n'),
  };
}

function copyCompanionTree(srcDir, dstDir, { excludeRel = new Set() } = {}) {
  const companions = [];
  if (!existsSync(srcDir)) return companions;

  function walk(curSrc, curDst, relBase) {
    mkdirSync(curDst, { recursive: true });
    for (const ent of readdirSync(curSrc, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (ent.name === '.DS_Store' || ent.name === 'node_modules') continue;
      const rel = relBase ? `${relBase}/${ent.name}` : ent.name;
      if (excludeRel.has(rel) || rel === 'agents/openai.yaml') continue;

      const sPath = join(curSrc, ent.name);
      const dPath = join(curDst, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === 'agents') {
          // Skip Codex-specific agents/openai.yaml container if it only holds openai.yaml
          const children = readdirSync(sPath);
          if (children.every((c) => c === 'openai.yaml' || c === '.DS_Store')) continue;
        }
        walk(sPath, dPath, rel);
      } else if (ent.isFile()) {
        cpSync(sPath, dPath);
        const st = statSync(sPath);
        if (st.mode & 0o111) {
          chmodSync(dPath, 0o755);
        }
        companions.push(rel);
      }
    }
  }

  walk(srcDir, dstDir, '');
  return companions;
}

export function materializeSkillDir({ adaptedDir, targetDir, disableSlashCommand = false }) {
  rmSync(targetDir, { recursive: true, force: true });
  cpSync(adaptedDir, targetDir, { recursive: true });
  if (disableSlashCommand) {
    const skillMdPath = join(targetDir, 'SKILL.md');
    if (existsSync(skillMdPath)) {
      const parsed = parseSkillMarkdown(readFileSync(skillMdPath, 'utf-8'));
      const updated = serializeSkillMarkdown({
        name: parsed.name,
        description: parsed.description,
        disableSlashCommand: true,
        body: parsed.body,
      });
      writeFileSync(skillMdPath, updated, 'utf-8');
    }
  }
}

export function compileUpstreamDirectory({
  sourceRepoDir,
  targetRepoRoot = DEFAULT_REPO_ROOT,
  commitSha = 'local',
  upstreamVersion = '1.3.2',
  preserveExistingActive = false,
  slashHiddenSkills = [],
}) {
  const hiddenSet = new Set(slashHiddenSkills);
  const catalogRoot = join(targetRepoRoot, 'catalog');
  const adaptedRoot = join(catalogRoot, 'adapted');
  const upstreamRoot = join(catalogRoot, 'upstream');
  const activeSkillsRoot = join(targetRepoRoot, 'skills');

  // Snapshot previously enabled skill names if preserving user active configuration
  const previouslyEnabled = new Set();
  if (preserveExistingActive && existsSync(activeSkillsRoot)) {
    for (const ent of readdirSync(activeSkillsRoot, { withFileTypes: true })) {
      if (ent.isDirectory() && ent.name !== 'mp-studio') {
        previouslyEnabled.add(ent.name);
      }
    }
  }

  rmSync(adaptedRoot, { recursive: true, force: true });
  rmSync(upstreamRoot, { recursive: true, force: true });
  mkdirSync(adaptedRoot, { recursive: true });
  mkdirSync(upstreamRoot, { recursive: true });

  const skills = [];
  for (const bucketInfo of BUCKETS) {
    const bucket = bucketInfo.id;
    const bucketSrcDir = join(sourceRepoDir, 'skills', bucket);
    if (!existsSync(bucketSrcDir)) continue;

    for (const ent of readdirSync(bucketSrcDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (!ent.isDirectory()) continue;
      const skillName = ent.name;
      const skillSrcDir = join(bucketSrcDir, skillName);
      const skillMdSrc = join(skillSrcDir, 'SKILL.md');
      if (!existsSync(skillMdSrc)) continue;

      const rawContent = readFileSync(skillMdSrc, 'utf-8');
      const adapted = adaptSkillMarkdown({ bucket, skillName, rawContent, disableSlashCommand: false });

      const adaptedSkillDir = join(adaptedRoot, bucket, skillName);
      const upstreamSkillDir = join(upstreamRoot, bucket, skillName);
      mkdirSync(adaptedSkillDir, { recursive: true });
      mkdirSync(upstreamSkillDir, { recursive: true });

      writeFileSync(join(upstreamSkillDir, 'SKILL.md'), adapted.upstreamMarkdown, 'utf-8');
      writeFileSync(join(adaptedSkillDir, 'SKILL.md'), adapted.adaptedMarkdown, 'utf-8');

      const companions = copyCompanionTree(skillSrcDir, adaptedSkillDir, {
        excludeRel: new Set(['SKILL.md']),
      });

      const meta = SKILL_META[skillName] || inferFallbackMeta(skillName, bucket);

      skills.push({
        name: skillName,
        bucket,
        defaultEnabled: bucketInfo.defaultEnabled,
        invocation: adapted.invocation,
        description: adapted.description,
        argumentHint: adapted.argumentHint,
        scenario: meta.scenario,
        workflowStage: meta.workflowStage,
        zhSummary: meta.zhSummary,
        enSummary: meta.enSummary,
        dependsOnSkills: meta.dependsOnSkills || [],
        usesAgents: meta.usesAgents || [],
        orchestration: meta.orchestration || null,
        collisionNote: meta.collisionNote || '',
        samplePrompt: meta.samplePrompt || (adapted.invocation === 'user' ? `/${skillName}` : `Use ${skillName}`),
        companionFiles: companions,
        adaptations: adapted.adaptations,
      });
    }
  }

  const syncedAt = new Date().toISOString();
  const indexData = {
    schemaVersion: 1,
    upstream: {
      repo: 'mattpocock/skills',
      version: upstreamVersion,
      commit: commitSha,
      syncedAt,
    },
    buckets: BUCKETS,
    scenarios: SCENARIOS,
    presets: PRESETS,
    workflow: WORKFLOW_SPINE,
    orchestrationRecipes: ORCHESTRATION_RECIPES,
    skills,
  };

  writeFileSync(join(catalogRoot, 'index.json'), `${JSON.stringify(indexData, null, 2)}\n`, 'utf-8');
  writeFileSync(
    join(targetRepoRoot, 'upstream.lock.json'),
    `${JSON.stringify({
      repo: 'https://github.com/mattpocock/skills',
      branch: 'main',
      version: upstreamVersion,
      commit: commitSha,
      syncedAt,
      totalSkills: skills.length,
      promotedSkills: skills.filter((s) => s.defaultEnabled).length,
    }, null, 2)}\n`,
    'utf-8',
  );

  // Materialize active skills/ directory (keeping mp-studio intact)
  mkdirSync(activeSkillsRoot, { recursive: true });
  for (const ent of readdirSync(activeSkillsRoot, { withFileTypes: true })) {
    if (ent.name === 'mp-studio') continue;
    rmSync(join(activeSkillsRoot, ent.name), { recursive: true, force: true });
  }

  // Ensure system mp-studio skill is synced from catalog/system/mp-studio if present
  const sysStudio = join(catalogRoot, 'system', 'mp-studio');
  if (existsSync(sysStudio)) {
    materializeSkillDir({ adaptedDir: sysStudio, targetDir: join(activeSkillsRoot, 'mp-studio') });
  }

  for (const s of skills) {
    const shouldEnable = preserveExistingActive ? previouslyEnabled.has(s.name) : s.defaultEnabled;
    if (!shouldEnable) continue;
    materializeSkillDir({
      adaptedDir: join(adaptedRoot, s.bucket, s.name),
      targetDir: join(activeSkillsRoot, s.name),
      disableSlashCommand: hiddenSet.has(s.name),
    });
  }

  return indexData;
}

export function fetchAndCompileUpstream({
  targetRepoRoot = DEFAULT_REPO_ROOT,
  repoUrl = UPSTREAM_GIT_URL,
  branch = 'main',
  preserveExistingActive = false,
  slashHiddenSkills = [],
} = {}) {
  const tempDir = mkdtempSync(join(tmpdir(), 'mp-skills-upstream-'));
  const cloneDir = join(tempDir, 'repo');

  try {
    let commitSha = 'unknown';
    try {
      execFileSync('git', ['clone', '--depth', '1', '--branch', branch, repoUrl, cloneDir], {
        stdio: 'pipe',
        timeout: 60_000,
      });
      commitSha = execFileSync('git', ['-C', cloneDir, 'rev-parse', 'HEAD'], {
        stdio: 'pipe',
        encoding: 'utf-8',
      }).trim();
    } catch {
      // Fallback via GitHub tarball if git clone fails
      mkdirSync(cloneDir, { recursive: true });
      const tarPath = join(tempDir, 'upstream.tar.gz');
      const tarBuf = execFileSync('gh', ['api', `repos/mattpocock/skills/tarball/${branch}`], {
        stdio: 'pipe',
        maxBuffer: 50 * 1024 * 1024,
      });
      writeFileSync(tarPath, tarBuf);
      execFileSync('tar', ['-xzf', tarPath, '-C', cloneDir, '--strip-components=1'], { stdio: 'pipe' });
      try {
        const metaRaw = execFileSync('gh', ['api', `repos/mattpocock/skills/commits/${branch}`, '--jq', '.sha'], {
          stdio: 'pipe',
          encoding: 'utf-8',
        }).trim();
        if (metaRaw) commitSha = metaRaw;
      } catch {
        commitSha = 'tarball';
      }
    }

    let upstreamVersion = 'unknown';
    const upstreamManifest = join(cloneDir, '.claude-plugin', 'plugin.json');
    if (existsSync(upstreamManifest)) {
      try {
        upstreamVersion = JSON.parse(readFileSync(upstreamManifest, 'utf-8')).version || 'unknown';
      } catch {
        upstreamVersion = 'unknown';
      }
    }

    return compileUpstreamDirectory({
      sourceRepoDir: cloneDir,
      targetRepoRoot,
      commitSha,
      upstreamVersion,
      preserveExistingActive,
      slashHiddenSkills,
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
