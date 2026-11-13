import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultPluginTarget, defaultStateDir, installPlugin } from '../../scripts/cli.mjs';
import { fetchAndCompileUpstream, materializeSkillDir, parseSkillMarkdown } from './upstream_sync.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '../..');

function readJsonSafe(filePath, fallback = null) {
  if (!existsSync(filePath)) return fallback;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return fallback;
  }
}

function atomicWriteText(filePath, text, mode = 0o644) {
  mkdirSync(dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, text, { encoding: 'utf-8', mode });
  renameSync(tmpPath, filePath);
  try {
    chmodSync(filePath, mode);
  } catch {
    // ignore on platforms without chmod
  }
}

function atomicWriteJson(filePath, obj, mode = 0o600) {
  atomicWriteText(filePath, `${JSON.stringify(obj, null, 2)}\n`, mode);
}

function expandHome(rawPath, homeDir) {
  const s = String(rawPath || '').trim();
  if (!s) return '';
  if (s === '~') return homeDir;
  if (s.startsWith('~/') || s.startsWith('~\\')) {
    return join(homeDir, s.slice(2));
  }
  return resolve(s);
}

function detectGitRemote(workspacePath) {
  try {
    const out = execFileSync('git', ['-C', workspacePath, 'remote', '-v'], {
      stdio: 'pipe',
      encoding: 'utf-8',
      timeout: 2500,
    });
    const line = out.split('\n').find((l) => l.trim());
    if (!line) return { hasGit: true, provider: 'none', remoteUrl: '' };
    const m = line.match(/\S+\s+(\S+)/);
    const url = m ? m[1] : '';
    let provider = 'other';
    if (/github\.com/i.test(url)) provider = 'github';
    else if (/gitlab/i.test(url)) provider = 'gitlab';
    return { hasGit: true, provider, remoteUrl: url };
  } catch {
    const hasGit = existsSync(join(workspacePath, '.git'));
    return { hasGit, provider: 'none', remoteUrl: '' };
  }
}

function detectMonorepo(workspacePath) {
  if (existsSync(join(workspacePath, 'pnpm-workspace.yaml'))) return true;
  const pkg = readJsonSafe(join(workspacePath, 'package.json'), null);
  if (pkg && pkg.workspaces) return true;
  const pkgsDir = join(workspacePath, 'packages');
  if (existsSync(pkgsDir)) {
    try {
      const subdirs = readdirSync(pkgsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
      if (subdirs.some((d) => existsSync(join(pkgsDir, d.name, 'src')))) return true;
    } catch {
      // ignore
    }
  }
  return false;
}

export function parseScratchTickets(workspacePath) {
  const scratchDir = join(workspacePath, '.scratch');
  const features = [];
  if (!existsSync(scratchDir)) return { features, tickets: [] };

  const allTickets = [];
  let featureDirs = [];
  try {
    featureDirs = readdirSync(scratchDir, { withFileTypes: true }).filter((d) => d.isDirectory());
  } catch {
    return { features, tickets: [] };
  }

  for (const fDir of featureDirs.sort((a, b) => a.name.localeCompare(b.name))) {
    const issuesDir = join(scratchDir, fDir.name, 'issues');
    const specExists = existsSync(join(scratchDir, fDir.name, 'spec.md'));
    const mapExists = existsSync(join(scratchDir, fDir.name, 'map.md'));
    if (!existsSync(issuesDir) && !specExists && !mapExists) continue;

    const featureTickets = [];
    if (existsSync(issuesDir)) {
      const files = readdirSync(issuesDir)
        .filter((n) => n.endsWith('.md'))
        .sort((a, b) => a.localeCompare(b));

      for (const file of files) {
        const fullPath = join(issuesDir, file);
        const content = readFileSync(fullPath, 'utf-8');
        const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || file.replace(/\.md$/, '');
        const numMatch = file.match(/^(\d+)/);
        const num = numMatch ? numMatch[1] : file.replace(/\.md$/, '');

        const statusRaw = (
          content.match(/^\*\*Status:\*\*\s*(.+)$/im)?.[1] ||
          content.match(/^Status:\s*(.+)$/im)?.[1] ||
          'ready-for-agent'
        ).trim().toLowerCase();

        const blockedRaw = (
          content.match(/^\*\*Blocked by:\*\*\s*(.+)$/im)?.[1] ||
          content.match(/^Blocked by:\s*(.+)$/im)?.[1] ||
          'None'
        ).trim();

        const blockers = [];
        if (!/^none\b/i.test(blockedRaw) && blockedRaw !== '-' && blockedRaw !== '无') {
          for (const part of blockedRaw.split(/[,，]/)) {
            const cleaned = part.trim();
            if (!cleaned) continue;
            const idMatch = cleaned.match(/#?(\d+)/);
            blockers.push(idMatch ? idMatch[1].padStart(2, '0') : cleaned);
          }
        }

        const totalChecks = (content.match(/^- \[[ xX]\]/gm) || []).length;
        const doneChecks = (content.match(/^- \[[xX]\]/gm) || []).length;
        const isDone =
          statusRaw === 'done' ||
          statusRaw === 'closed' ||
          statusRaw === 'resolved' ||
          statusRaw === 'completed' ||
          (totalChecks > 0 && doneChecks === totalChecks);

        featureTickets.push({
          feature: fDir.name,
          file,
          relPath: `.scratch/${fDir.name}/issues/${file}`,
          num: num.padStart(2, '0'),
          title: heading,
          statusRaw,
          blockers,
          totalChecks,
          doneChecks,
          isDone,
          state: isDone ? 'done' : 'pending',
        });
      }
    }

    const doneSet = new Set(featureTickets.filter((t) => t.isDone).map((t) => t.num));
    for (const t of featureTickets) {
      if (t.isDone) {
        t.state = 'done';
        t.unresolvedBlockers = [];
      } else {
        t.unresolvedBlockers = t.blockers.filter((b) => !doneSet.has(b) && !doneSet.has(b.replace(/^0+/, '')));
        t.state = t.unresolvedBlockers.length === 0 ? 'ready' : 'blocked';
      }
      allTickets.push(t);
    }

    features.push({
      slug: fDir.name,
      hasSpec: specExists,
      hasMap: mapExists,
      total: featureTickets.length,
      ready: featureTickets.filter((t) => t.state === 'ready').length,
      blocked: featureTickets.filter((t) => t.state === 'blocked').length,
      done: featureTickets.filter((t) => t.state === 'done').length,
    });
  }

  return { features, tickets: allTickets };
}

function upsertAgentSkillsSection(existingContent, newSection) {
  const norm = String(existingContent || '').replace(/\r\n/g, '\n');
  const sectionRe = /^## Agent skills\b[\s\S]*?(?=^## (?!#)|(?![\s\S]))/m;
  if (sectionRe.test(norm)) {
    return norm.replace(sectionRe, `${newSection.trim()}\n\n`).replace(/\n{3,}/g, '\n\n');
  }
  const trimmed = norm.trimEnd();
  return trimmed ? `${trimmed}\n\n${newSection.trim()}\n` : `${newSection.trim()}\n`;
}

export function createStore({
  homeDir = homedir(),
  repoRoot = REPO_ROOT,
  pluginTarget = defaultPluginTarget(homeDir),
  stateDir = defaultStateDir(homeDir),
} = {}) {
  const statePath = join(stateDir, 'state.json');
  const backupsDir = join(stateDir, 'backups');

  function loadUserState() {
    const raw = readJsonSafe(statePath, null) || {};
    return {
      workspaces: Array.isArray(raw.workspaces) ? raw.workspaces.filter((p) => typeof p === 'string' && p.trim()) : [],
      slashHiddenSkills: Array.isArray(raw.slashHiddenSkills) ? raw.slashHiddenSkills : [],
      lastPreset: typeof raw.lastPreset === 'string' ? raw.lastPreset : 'promoted',
      backups: Array.isArray(raw.backups) ? raw.backups : [],
    };
  }

  function saveUserState(st) {
    mkdirSync(stateDir, { recursive: true });
    atomicWriteJson(statePath, st, 0o600);
  }

  function detectInstallInfo() {
    let installMode = 'not_installed';
    let linkedTo = null;
    try {
      const st = lstatSync(pluginTarget);
      if (st.isSymbolicLink()) {
        installMode = 'symlink';
        linkedTo = readlinkSync(pluginTarget);
      } else if (st.isDirectory()) {
        installMode = 'copy';
      }
    } catch {
      installMode = 'not_installed';
    }
    const activePluginRoot = installMode === 'not_installed' ? repoRoot : pluginTarget;
    return { installMode, target: pluginTarget, linkedTo, activePluginRoot };
  }

  function readCatalog() {
    const indexPath = join(repoRoot, 'catalog', 'index.json');
    const data = readJsonSafe(indexPath, null);
    if (!data) {
      throw new Error('Catalog index.json not found. Run `npm run sync:upstream` first.');
    }
    return data;
  }

  function readActiveSkillsMap(activePluginRoot) {
    const skillsDir = join(activePluginRoot, 'skills');
    const active = new Map();
    if (!existsSync(skillsDir)) return active;
    for (const ent of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!ent.isDirectory() || ent.name === 'mp-studio') continue;
      const skillMd = join(skillsDir, ent.name, 'SKILL.md');
      let disableSlashCommand = false;
      if (existsSync(skillMd)) {
        const parsed = parseSkillMarkdown(readFileSync(skillMd, 'utf-8'));
        disableSlashCommand = parsed.disableSlashCommand;
      }
      active.set(ent.name, { disableSlashCommand });
    }
    return active;
  }

  function mergeWorkspaces(hostWorkspaces = []) {
    const st = loadUserState();
    const seen = new Set();
    const merged = [];
    for (const raw of [...hostWorkspaces, ...st.workspaces]) {
      if (!raw || typeof raw !== 'string') continue;
      const abs = expandHome(raw, homeDir);
      if (!abs || seen.has(abs)) continue;
      if (existsSync(abs)) {
        seen.add(abs);
        merged.push(abs);
      }
    }
    return merged;
  }

  function inspectWorkspace(workspacePath) {
    const abs = expandHome(workspacePath, homeDir);
    if (!abs || !existsSync(abs)) {
      return { path: abs, exists: false };
    }

    const git = detectGitRemote(abs);
    const isMonorepo = detectMonorepo(abs);
    const hasAgentsMd = existsSync(join(abs, 'AGENTS.md'));
    const hasGeminiMd = existsSync(join(abs, 'GEMINI.md'));
    const hasClaudeMd = existsSync(join(abs, 'CLAUDE.md'));
    const hasRuleFile = existsSync(join(abs, '.agents', 'rules', 'mattpocock-skills.md'));

    const trackerDocPath = join(abs, 'docs', 'agents', 'issue-tracker.md');
    const labelsDocPath = join(abs, 'docs', 'agents', 'triage-labels.md');
    const domainDocPath = join(abs, 'docs', 'agents', 'domain.md');

    let detectedTracker = git.provider === 'github' ? 'github' : (git.provider === 'gitlab' ? 'gitlab' : 'local');
    if (existsSync(trackerDocPath)) {
      const txt = readFileSync(trackerDocPath, 'utf-8');
      if (/Issue tracker:\s*GitHub/i.test(txt)) detectedTracker = 'github';
      else if (/Issue tracker:\s*GitLab/i.test(txt)) detectedTracker = 'gitlab';
      else if (/Issue tracker:\s*Local Markdown/i.test(txt)) detectedTracker = 'local';
      else detectedTracker = 'custom';
    }

    const labels = {
      'needs-triage': 'needs-triage',
      'needs-info': 'needs-info',
      'ready-for-agent': 'ready-for-agent',
      'ready-for-human': 'ready-for-human',
      'wontfix': 'wontfix',
    };
    if (existsSync(labelsDocPath)) {
      const txt = readFileSync(labelsDocPath, 'utf-8');
      for (const role of Object.keys(labels)) {
        const re = new RegExp(`\\|\\s*\`${role}\`\\s*\\|\\s*\`([^\`]+)\`\\s*\\|`);
        const m = txt.match(re);
        if (m) labels[role] = m[1].trim();
      }
    }

    let domainLayout = isMonorepo ? 'multi-context' : 'single-context';
    if (existsSync(join(abs, 'GLOSSARY-MAP.md'))) domainLayout = 'multi-context';

    // Workspace delivered skills under .agents/skills/
    const wsSkillsDir = join(abs, '.agents', 'skills');
    const deliveredSkills = [];
    if (existsSync(wsSkillsDir)) {
      for (const ent of readdirSync(wsSkillsDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = join(wsSkillsDir, ent.name);
        let isSymlink = false;
        try {
          isSymlink = lstatSync(full).isSymbolicLink();
        } catch {
          isSymlink = false;
        }
        if (ent.isDirectory() || isSymlink) {
          deliveredSkills.push({
            name: ent.name,
            mode: isSymlink ? 'symlink' : 'copy',
          });
        }
      }
    }

    // Domain docs: GLOSSARY.md, ADRs, reports
    const glossaryPath = join(abs, 'GLOSSARY.md');
    const glossaryContent = existsSync(glossaryPath) ? readFileSync(glossaryPath, 'utf-8') : '';

    const adrDir = join(abs, 'docs', 'adr');
    const adrs = existsSync(adrDir)
      ? readdirSync(adrDir)
          .filter((n) => n.endsWith('.md'))
          .sort()
          .map((n) => {
            const firstLine = readFileSync(join(adrDir, n), 'utf-8').split('\n').find((l) => l.startsWith('#')) || n;
            return { file: n, path: `docs/adr/${n}`, title: firstLine.replace(/^#+\s*/, '').trim() };
          })
      : [];

    const reportsDir = join(abs, '.scratch', 'reports');
    const reports = existsSync(reportsDir)
      ? readdirSync(reportsDir)
          .filter((n) => n.endsWith('.html'))
          .sort()
          .reverse()
          .map((n) => ({ file: n, path: `.scratch/reports/${n}` }))
      : [];

    const board = parseScratchTickets(abs);

    return {
      path: abs,
      name: basename(abs),
      exists: true,
      git,
      isMonorepo,
      steering: {
        hasAgentsMd,
        hasGeminiMd,
        hasClaudeMd,
        hasRuleFile,
        recommendedRuleTarget: hasAgentsMd ? 'AGENTS.md' : '.agents/rules/mattpocock-skills.md',
      },
      setup: {
        configured: existsSync(trackerDocPath) && existsSync(domainDocPath),
        hasTrackerDoc: existsSync(trackerDocPath),
        hasLabelsDoc: existsSync(labelsDocPath),
        hasDomainDoc: existsSync(domainDocPath),
        trackerType: detectedTracker,
        labels,
        domainLayout,
      },
      deliveredSkills,
      glossary: {
        exists: existsSync(glossaryPath),
        content: glossaryContent,
      },
      adrs,
      reports,
      board,
    };
  }

  function getState(hostWorkspaces = [], selectedWorkspace = '') {
    const catalog = readCatalog();
    const install = detectInstallInfo();
    const userState = loadUserState();
    const hiddenSet = new Set(userState.slashHiddenSkills);
    const activeMap = readActiveSkillsMap(install.activePluginRoot);

    const skills = catalog.skills.map((s) => {
      const activeEntry = activeMap.get(s.name);
      return {
        ...s,
        enabled: Boolean(activeEntry),
        disableSlashCommand: activeEntry ? activeEntry.disableSlashCommand : hiddenSet.has(s.name),
      };
    });

    const buckets = catalog.buckets.map((b) => {
      const bucketSkills = skills.filter((s) => s.bucket === b.id);
      const enabledCount = bucketSkills.filter((s) => s.enabled).length;
      return {
        ...b,
        totalCount: bucketSkills.length,
        enabledCount,
      };
    });

    const workspaces = mergeWorkspaces(hostWorkspaces).map((p) => ({
      path: p,
      name: basename(p),
      isHostDetected: hostWorkspaces.includes(p),
    }));

    const targetWs = selectedWorkspace && existsSync(expandHome(selectedWorkspace, homeDir))
      ? expandHome(selectedWorkspace, homeDir)
      : (workspaces[0]?.path || '');

    return {
      install: {
        ...install,
        repoRoot,
      },
      upstream: catalog.upstream,
      buckets,
      scenarios: catalog.scenarios,
      presets: catalog.presets,
      workflow: catalog.workflow,
      skills,
      workspaces,
      activeWorkspace: targetWs ? inspectWorkspace(targetWs) : null,
      backupsCount: userState.backups.length,
    };
  }

  function getSkillPreview({ name }) {
    const catalog = readCatalog();
    const skill = catalog.skills.find((s) => s.name === name);
    if (!skill) throw new Error(`Unknown skill: ${name}`);

    const adaptedDir = join(repoRoot, 'catalog', 'adapted', skill.bucket, skill.name);
    const upstreamFile = join(repoRoot, 'catalog', 'upstream', skill.bucket, skill.name, 'SKILL.md');
    const install = detectInstallInfo();
    const activeSkillFile = join(install.activePluginRoot, 'skills', skill.name, 'SKILL.md');

    const adaptedSkillMd = existsSync(activeSkillFile)
      ? readFileSync(activeSkillFile, 'utf-8')
      : readFileSync(join(adaptedDir, 'SKILL.md'), 'utf-8');
    const upstreamSkillMd = existsSync(upstreamFile) ? readFileSync(upstreamFile, 'utf-8') : '';

    const companionFiles = [];
    for (const rel of skill.companionFiles || []) {
      const full = join(adaptedDir, rel);
      if (existsSync(full)) {
        companionFiles.push({
          name: rel,
          content: readFileSync(full, 'utf-8'),
        });
      }
    }

    return {
      skill,
      adaptedSkillMd,
      upstreamSkillMd,
      companionFiles,
    };
  }

  function resolveDependencies(skillName, catalogSkills, visited = new Set()) {
    if (visited.has(skillName)) return [];
    visited.add(skillName);
    const skill = catalogSkills.find((s) => s.name === skillName);
    if (!skill) return [];
    const deps = [];
    for (const dep of skill.dependsOnSkills || []) {
      deps.push(dep);
      deps.push(...resolveDependencies(dep, catalogSkills, visited));
    }
    return [...new Set(deps)];
  }

  function toggleSkill({ name, enabled, disableSlashCommand }) {
    const catalog = readCatalog();
    const skill = catalog.skills.find((s) => s.name === name);
    if (!skill) throw new Error(`Unknown skill: ${name}`);

    const install = detectInstallInfo();
    const activeSkillsDir = join(install.activePluginRoot, 'skills');
    mkdirSync(activeSkillsDir, { recursive: true });

    const userState = loadUserState();
    const hiddenSet = new Set(userState.slashHiddenSkills);
    if (typeof disableSlashCommand === 'boolean') {
      if (disableSlashCommand) hiddenSet.add(name);
      else hiddenSet.delete(name);
      userState.slashHiddenSkills = [...hiddenSet];
      saveUserState(userState);
    }

    const autoEnabled = [];
    const dependentsWarning = [];

    if (enabled) {
      const targets = [name, ...resolveDependencies(name, catalog.skills)];
      for (const targetName of targets) {
        const meta = catalog.skills.find((s) => s.name === targetName);
        if (!meta) continue;
        const dst = join(activeSkillsDir, targetName);
        const already = existsSync(dst);
        if (targetName !== name && !already) {
          autoEnabled.push(targetName);
        }
        if (targetName === name || !already) {
          materializeSkillDir({
            adaptedDir: join(repoRoot, 'catalog', 'adapted', meta.bucket, targetName),
            targetDir: dst,
            disableSlashCommand: hiddenSet.has(targetName),
          });
        }
      }
    } else {
      rmSync(join(activeSkillsDir, name), { recursive: true, force: true });
      const activeMap = readActiveSkillsMap(install.activePluginRoot);
      for (const other of catalog.skills) {
        if (activeMap.has(other.name) && (other.dependsOnSkills || []).includes(name)) {
          dependentsWarning.push(other.name);
        }
      }
    }

    return { ok: true, name, enabled, autoEnabled, dependentsWarning };
  }

  function toggleBucket({ bucket, enabled }) {
    const catalog = readCatalog();
    const targets = catalog.skills.filter((s) => s.bucket === bucket);
    if (targets.length === 0) throw new Error(`Unknown bucket: ${bucket}`);

    const install = detectInstallInfo();
    const activeSkillsDir = join(install.activePluginRoot, 'skills');
    const userState = loadUserState();
    const hiddenSet = new Set(userState.slashHiddenSkills);
    mkdirSync(activeSkillsDir, { recursive: true });

    const autoEnabled = [];
    for (const s of targets) {
      if (enabled) {
        materializeSkillDir({
          adaptedDir: join(repoRoot, 'catalog', 'adapted', s.bucket, s.name),
          targetDir: join(activeSkillsDir, s.name),
          disableSlashCommand: hiddenSet.has(s.name),
        });
        for (const dep of resolveDependencies(s.name, catalog.skills)) {
          const depMeta = catalog.skills.find((x) => x.name === dep);
          if (depMeta && !existsSync(join(activeSkillsDir, dep))) {
            materializeSkillDir({
              adaptedDir: join(repoRoot, 'catalog', 'adapted', depMeta.bucket, dep),
              targetDir: join(activeSkillsDir, dep),
              disableSlashCommand: hiddenSet.has(dep),
            });
            autoEnabled.push(dep);
          }
        }
      } else {
        rmSync(join(activeSkillsDir, s.name), { recursive: true, force: true });
      }
    }

    return { ok: true, bucket, enabled, count: targets.length, autoEnabled: [...new Set(autoEnabled)] };
  }

  function applyPreset({ preset }) {
    const catalog = readCatalog();
    const spec = catalog.presets[preset];
    if (!spec) throw new Error(`Unknown preset: ${preset}`);

    const enableSet = new Set();
    if (Array.isArray(spec.skills)) {
      for (const n of spec.skills) {
        enableSet.add(n);
        for (const d of resolveDependencies(n, catalog.skills)) enableSet.add(d);
      }
    } else if (Array.isArray(spec.buckets)) {
      for (const s of catalog.skills) {
        if (spec.buckets.includes(s.bucket)) {
          enableSet.add(s.name);
          for (const d of resolveDependencies(s.name, catalog.skills)) enableSet.add(d);
        }
      }
    }

    const install = detectInstallInfo();
    const activeSkillsDir = join(install.activePluginRoot, 'skills');
    const userState = loadUserState();
    const hiddenSet = new Set(userState.slashHiddenSkills);
    mkdirSync(activeSkillsDir, { recursive: true });

    for (const s of catalog.skills) {
      const dst = join(activeSkillsDir, s.name);
      if (enableSet.has(s.name)) {
        materializeSkillDir({
          adaptedDir: join(repoRoot, 'catalog', 'adapted', s.bucket, s.name),
          targetDir: dst,
          disableSlashCommand: hiddenSet.has(s.name),
        });
      } else {
        rmSync(dst, { recursive: true, force: true });
      }
    }

    userState.lastPreset = preset;
    saveUserState(userState);

    return { ok: true, preset, enabledCount: enableSet.size };
  }

  function switchInstallMode({ mode }) {
    if (mode !== 'link' && mode !== 'copy') {
      throw new Error(`Invalid install mode: ${mode}`);
    }
    const installBefore = detectInstallInfo();
    const activeBefore = readActiveSkillsMap(installBefore.activePluginRoot);

    const res = installPlugin({
      link: mode === 'link',
      target: pluginTarget,
      sourceRoot: repoRoot,
    });

    // If switched to copy mode, preserve the previously enabled skill selection
    if (mode === 'copy' && activeBefore.size > 0) {
      const catalog = readCatalog();
      const targetSkillsDir = join(pluginTarget, 'skills');
      const userState = loadUserState();
      const hiddenSet = new Set(userState.slashHiddenSkills);
      for (const s of catalog.skills) {
        const dst = join(targetSkillsDir, s.name);
        if (activeBefore.has(s.name)) {
          materializeSkillDir({
            adaptedDir: join(repoRoot, 'catalog', 'adapted', s.bucket, s.name),
            targetDir: dst,
            disableSlashCommand: hiddenSet.has(s.name),
          });
        } else {
          rmSync(dst, { recursive: true, force: true });
        }
      }
    }

    return { ok: true, ...res };
  }

  function addWorkspace(rawPath) {
    const abs = expandHome(rawPath, homeDir);
    if (!abs || !existsSync(abs)) {
      throw new Error(`Workspace path does not exist: ${rawPath}`);
    }
    const st = loadUserState();
    if (!st.workspaces.includes(abs)) {
      st.workspaces.unshift(abs);
      saveUserState(st);
    }
    return abs;
  }

  function removeWorkspace(rawPath) {
    const abs = expandHome(rawPath, homeDir);
    const st = loadUserState();
    st.workspaces = st.workspaces.filter((p) => expandHome(p, homeDir) !== abs);
    saveUserState(st);
    return st.workspaces;
  }

  function deliverToWorkspace({ workspacePath, skillNames, mode = 'copy' }) {
    const absWs = expandHome(workspacePath, homeDir);
    if (!absWs || !existsSync(absWs)) {
      throw new Error(`Workspace path does not exist: ${workspacePath}`);
    }
    const catalog = readCatalog();
    const install = detectInstallInfo();
    const activeMap = readActiveSkillsMap(install.activePluginRoot);
    const userState = loadUserState();
    const hiddenSet = new Set(userState.slashHiddenSkills);

    const chosenNames = Array.isArray(skillNames) && skillNames.length > 0
      ? skillNames
      : [...activeMap.keys()];

    const withDeps = new Set(chosenNames);
    for (const n of chosenNames) {
      for (const d of resolveDependencies(n, catalog.skills)) withDeps.add(d);
    }

    const wsSkillsDir = join(absWs, '.agents', 'skills');
    mkdirSync(wsSkillsDir, { recursive: true });

    const delivered = [];
    for (const name of withDeps) {
      const meta = catalog.skills.find((s) => s.name === name);
      if (!meta) continue;
      const srcDir = join(repoRoot, 'catalog', 'adapted', meta.bucket, name);
      const dstDir = join(wsSkillsDir, name);
      rmSync(dstDir, { recursive: true, force: true });
      if (mode === 'link') {
        const linkType = process.platform === 'win32' ? 'junction' : 'dir';
        symlinkSync(srcDir, dstDir, linkType);
      } else {
        materializeSkillDir({
          adaptedDir: srcDir,
          targetDir: dstDir,
          disableSlashCommand: hiddenSet.has(name),
        });
      }
      delivered.push(name);
    }

    return { ok: true, workspacePath: absWs, mode, delivered };
  }

  function removeWorkspaceSkill({ workspacePath, skillName }) {
    const absWs = expandHome(workspacePath, homeDir);
    const target = join(absWs, '.agents', 'skills', skillName);
    rmSync(target, { recursive: true, force: true });
    return { ok: true, workspacePath: absWs, skillName };
  }

  function createFileBackup(workspacePath, relFiles) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const snapshotDir = join(backupsDir, id);
    const filesRecorded = [];

    for (const rel of relFiles) {
      const full = join(workspacePath, rel);
      const existed = existsSync(full);
      if (existed) {
        const dst = join(snapshotDir, 'files', rel);
        mkdirSync(dirname(dst), { recursive: true });
        cpSync(full, dst);
      }
      filesRecorded.push({ rel, existed });
    }

    mkdirSync(snapshotDir, { recursive: true });
    atomicWriteJson(join(snapshotDir, 'meta.json'), {
      id,
      createdAt: new Date().toISOString(),
      workspacePath,
      files: filesRecorded,
    });

    const st = loadUserState();
    st.backups.unshift({ id, createdAt: new Date().toISOString(), workspacePath, fileCount: filesRecorded.length });
    if (st.backups.length > 20) {
      const removed = st.backups.splice(20);
      for (const old of removed) {
        rmSync(join(backupsDir, old.id), { recursive: true, force: true });
      }
    }
    saveUserState(st);
    return id;
  }

  function saveRepoSetup({
    workspacePath,
    trackerType = 'github',
    customTrackerProse = '',
    labels = {},
    domainLayout = 'single-context',
    targetRuleFile = 'AGENTS.md',
    syncGithubLabels = false,
  }) {
    const absWs = expandHome(workspacePath, homeDir);
    if (!absWs || !existsSync(absWs)) {
      throw new Error(`Workspace path does not exist: ${workspacePath}`);
    }

    const seedDir = join(repoRoot, 'catalog', 'adapted', 'engineering', 'setup-matt-pocock-skills');
    const ruleRel = targetRuleFile === '.agents/rules/mattpocock-skills.md'
      ? '.agents/rules/mattpocock-skills.md'
      : (targetRuleFile === 'GEMINI.md' ? 'GEMINI.md' : 'AGENTS.md');

    const trackedRels = [
      'docs/agents/issue-tracker.md',
      'docs/agents/triage-labels.md',
      'docs/agents/domain.md',
      ruleRel,
    ];
    const backupId = createFileBackup(absWs, trackedRels);

    // 1. Write docs/agents/issue-tracker.md
    let trackerDoc = '';
    if (trackerType === 'github') {
      trackerDoc = readFileSync(join(seedDir, 'issue-tracker-github.md'), 'utf-8');
    } else if (trackerType === 'gitlab') {
      trackerDoc = readFileSync(join(seedDir, 'issue-tracker-gitlab.md'), 'utf-8');
    } else if (trackerType === 'local') {
      trackerDoc = readFileSync(join(seedDir, 'issue-tracker-local.md'), 'utf-8');
    } else {
      trackerDoc = `# Issue tracker: Custom\n\n${customTrackerProse.trim() || 'Describe your issue tracker workflow here.'}\n`;
    }
    atomicWriteText(join(absWs, 'docs/agents/issue-tracker.md'), trackerDoc);

    // 2. Write docs/agents/triage-labels.md
    const canonicalRoles = [
      ['needs-triage', 'Maintainer needs to evaluate this issue'],
      ['needs-info', 'Waiting on reporter for more information'],
      ['ready-for-agent', 'Fully specified, ready for an AFK agent'],
      ['ready-for-human', 'Requires human implementation'],
      ['wontfix', 'Will not be actioned'],
    ];
    const mergedLabels = {};
    const labelRows = canonicalRoles.map(([role, meaning]) => {
      const mapped = String(labels[role] || role).trim() || role;
      mergedLabels[role] = mapped;
      return `| \`${role}\` | \`${mapped}\` | ${meaning} |`;
    });
    const labelsDoc = [
      '# Triage Labels',
      '',
      'The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo\'s issue tracker.',
      '',
      '| Label in mattpocock/skills | Label in our tracker | Meaning |',
      '| --- | --- | --- |',
      ...labelRows,
      '',
      'When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.',
      '',
    ].join('\n');
    atomicWriteText(join(absWs, 'docs/agents/triage-labels.md'), labelsDoc);

    // 3. Write docs/agents/domain.md
    const domainSeed = readFileSync(join(seedDir, 'domain.md'), 'utf-8');
    atomicWriteText(join(absWs, 'docs/agents/domain.md'), domainSeed);

    // 4. Write or update AGENTS.md / GEMINI.md / .agents/rules/mattpocock-skills.md
    const trackerSummary = trackerType === 'github'
      ? 'GitHub Issues (`gh` CLI)'
      : trackerType === 'gitlab'
        ? 'GitLab Issues (`glab` CLI)'
        : trackerType === 'local'
          ? 'Local Markdown files under `.scratch/<feature>/`'
          : 'Custom issue tracker workflow';
    const isDefaultLabels = canonicalRoles.every(([role]) => mergedLabels[role] === role);
    const labelSummary = isDefaultLabels
      ? 'Default canonical triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`)'
      : `Custom triage labels mapped from canonical roles (${Object.values(mergedLabels).join(', ')})`;

    const agentSkillsBlock = [
      '## Agent skills',
      '',
      '### Issue tracker',
      '',
      `${trackerSummary}. See \`docs/agents/issue-tracker.md\`.`,
      '',
      '### Triage labels',
      '',
      `${labelSummary}. See \`docs/agents/triage-labels.md\`.`,
      '',
      '### Domain docs',
      '',
      `${domainLayout === 'multi-context' ? 'multi-context' : 'single-context'} layout. See \`docs/agents/domain.md\`.`,
    ].join('\n');

    const ruleFullPath = join(absWs, ruleRel);
    if (ruleRel === '.agents/rules/mattpocock-skills.md') {
      const ruleBody = `---\ntrigger: always_on\n---\n\n${agentSkillsBlock}\n`;
      atomicWriteText(ruleFullPath, ruleBody);
    } else {
      const existing = existsSync(ruleFullPath) ? readFileSync(ruleFullPath, 'utf-8') : '';
      atomicWriteText(ruleFullPath, upsertAgentSkillsSection(existing, agentSkillsBlock));
    }

    // 5. Optionally sync labels to GitHub via gh CLI
    const labelSyncResults = [];
    if (syncGithubLabels && trackerType === 'github') {
      for (const [, targetLabel] of Object.entries(mergedLabels)) {
        try {
          execFileSync('gh', ['label', 'create', targetLabel, '--force'], {
            cwd: absWs,
            stdio: 'pipe',
            timeout: 8000,
          });
          labelSyncResults.push({ label: targetLabel, ok: true });
        } catch (err) {
          labelSyncResults.push({ label: targetLabel, ok: false, error: err?.message || 'gh label create failed' });
        }
      }
    }

    return {
      ok: true,
      backupId,
      writtenFiles: trackedRels,
      labelSyncResults,
      workspace: inspectWorkspace(absWs),
    };
  }

  function saveGlossary({ workspacePath, content }) {
    const absWs = expandHome(workspacePath, homeDir);
    if (!absWs || !existsSync(absWs)) {
      throw new Error(`Workspace path does not exist: ${workspacePath}`);
    }
    const backupId = createFileBackup(absWs, ['GLOSSARY.md']);
    atomicWriteText(join(absWs, 'GLOSSARY.md'), String(content || ''));
    return { ok: true, backupId, workspace: inspectWorkspace(absWs) };
  }

  function listBackups() {
    const st = loadUserState();
    return st.backups;
  }

  function restoreBackup({ id }) {
    const metaPath = join(backupsDir, id, 'meta.json');
    const meta = readJsonSafe(metaPath, null);
    if (!meta) throw new Error(`Backup not found: ${id}`);

    for (const f of meta.files || []) {
      const target = join(meta.workspacePath, f.rel);
      if (f.existed) {
        const src = join(backupsDir, id, 'files', f.rel);
        if (existsSync(src)) {
          mkdirSync(dirname(target), { recursive: true });
          cpSync(src, target);
        }
      } else {
        rmSync(target, { force: true });
      }
    }

    return { ok: true, restoredId: id, workspace: inspectWorkspace(meta.workspacePath) };
  }

  function syncUpstream() {
    const userState = loadUserState();
    const index = fetchAndCompileUpstream({
      targetRepoRoot: repoRoot,
      preserveExistingActive: true,
      slashHiddenSkills: userState.slashHiddenSkills,
    });

    const install = detectInstallInfo();
    if (install.installMode === 'copy') {
      // Refresh copy install keeping currently enabled skills
      const activeMap = readActiveSkillsMap(install.activePluginRoot);
      installPlugin({ link: false, target: pluginTarget, sourceRoot: repoRoot });
      const targetSkillsDir = join(pluginTarget, 'skills');
      const hiddenSet = new Set(userState.slashHiddenSkills);
      for (const s of index.skills) {
        const dst = join(targetSkillsDir, s.name);
        if (activeMap.has(s.name)) {
          materializeSkillDir({
            adaptedDir: join(repoRoot, 'catalog', 'adapted', s.bucket, s.name),
            targetDir: dst,
            disableSlashCommand: hiddenSet.has(s.name),
          });
        } else {
          rmSync(dst, { recursive: true, force: true });
        }
      }
    }

    return {
      ok: true,
      upstream: index.upstream,
      totalSkills: index.skills.length,
    };
  }

  return {
    getState,
    getSkillPreview,
    toggleSkill,
    toggleBucket,
    applyPreset,
    switchInstallMode,
    addWorkspace,
    removeWorkspace,
    inspectWorkspace,
    deliverToWorkspace,
    removeWorkspaceSkill,
    saveRepoSetup,
    saveGlossary,
    listBackups,
    restoreBackup,
    syncUpstream,
  };
}
