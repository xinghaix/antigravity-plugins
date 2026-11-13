#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateRawSync, gzipSync } from 'node:zlib';
import { scanPlugins } from './sync-registry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const MONOREPO_ROOT = resolve(__dirname, '..');

const EXCLUDE_DIRS = new Set(['.git', '.github', 'dist', 'node_modules', 'tests']);
const EXCLUDE_FILES = new Set(['.DS_Store']);

function collectEntries(absBase, archivePrefix, out = [], { skipTests = true } = {}) {
  if (!existsSync(absBase)) return out;
  const st = statSync(absBase);
  if (st.isDirectory()) {
    for (const ent of readdirSync(absBase, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (EXCLUDE_FILES.has(ent.name)) continue;
      if (ent.isDirectory() && (ent.name === '.git' || ent.name === 'node_modules' || ent.name === 'dist')) continue;
      if (skipTests && ent.isDirectory() && EXCLUDE_DIRS.has(ent.name)) continue;
      collectEntries(join(absBase, ent.name), `${archivePrefix}/${ent.name}`, out, { skipTests });
    }
  } else if (st.isFile()) {
    out.push({
      relPath: archivePrefix.replace(/\\/g, '/'),
      data: readFileSync(absBase),
      mode: (st.mode & 0o111) ? 0o755 : 0o644,
    });
  }
  return out;
}

function buildZip(entries) {
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.relPath, 'utf-8');
    const raw = entry.data;
    const compressed = deflateRawSync(raw, { level: 9 });
    const useDeflate = compressed.length < raw.length;
    const method = useDeflate ? 8 : 0;
    const payload = useDeflate ? compressed : raw;
    const crc = crc32(raw) >>> 0;

    const dosTime = 0;
    const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    localChunks.push(local, nameBuf, payload);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE((3 << 8) | 20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((entry.mode & 0o777) << 16, 38);
    central.writeUInt32LE(offset, 42);
    centralChunks.push(central, nameBuf);

    offset += local.length + nameBuf.length + payload.length;
  }

  const centralDir = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localChunks, centralDir, eocd]);
}

function splitUstarPath(relPath) {
  const fullBytes = Buffer.from(relPath, 'utf-8');
  if (fullBytes.length <= 100) {
    return { name: fullBytes, prefix: Buffer.alloc(0) };
  }
  const parts = relPath.split('/');
  for (let i = parts.length - 1; i >= 1; i--) {
    const prefixBuf = Buffer.from(parts.slice(0, i).join('/'), 'utf-8');
    const nameBuf = Buffer.from(parts.slice(i).join('/'), 'utf-8');
    if (nameBuf.length <= 100 && prefixBuf.length <= 155) {
      return { name: nameBuf, prefix: prefixBuf };
    }
  }
  throw new Error(`Tar path exceeds USTAR limits (255 bytes): ${relPath}`);
}

function writeOctal(buf, offset, len, value) {
  const str = value.toString(8).padStart(len - 1, '0');
  buf.write(str, offset, len - 1, 'ascii');
  buf[offset + len - 1] = 0;
}

function buildTarGz(entries) {
  const blocks = [];
  for (const entry of entries) {
    const header = Buffer.alloc(512, 0);
    const { name, prefix } = splitUstarPath(entry.relPath);
    name.copy(header, 0);
    writeOctal(header, 100, 8, entry.mode);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, entry.data.length);
    writeOctal(header, 136, 12, 1767225600);
    header.fill(0x20, 148, 156);
    header[156] = '0'.charCodeAt(0);
    header.write('ustar\0', 257, 6, 'ascii');
    header.write('00', 263, 2, 'ascii');
    if (prefix.length > 0) prefix.copy(header, 345);

    let sum = 0;
    for (let i = 0; i < 512; i++) sum += header[i];
    header.write(`${sum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');

    blocks.push(header);
    if (entry.data.length > 0) {
      blocks.push(entry.data);
      const rem = entry.data.length % 512;
      if (rem !== 0) blocks.push(Buffer.alloc(512 - rem, 0));
    }
  }
  blocks.push(Buffer.alloc(1024, 0));
  return gzipSync(Buffer.concat(blocks), { level: 9 });
}

function extractReleaseNotes(rootDir, version) {
  const changelogPath = join(rootDir, 'CHANGELOG.md');
  if (!existsSync(changelogPath)) {
    return `## v${version}\n\nRelease v${version}\n`;
  }
  const md = readFileSync(changelogPath, 'utf-8');
  const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = new RegExp(`(## \\[${escaped}\\][^]*?)(?=\\n## \\[|$)`).exec(md);
  return match ? `${match[1].trim()}\n` : `## v${version}\n`;
}

export function packageRelease(rootDir = MONOREPO_ROOT) {
  const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
  const refName = process.env.GITHUB_REF_NAME || '';
  if (refName.startsWith('v') && refName !== `v${pkg.version}`) {
    throw new Error(`Tag ${refName} does not match root package.json version v${pkg.version}`);
  }

  const outDir = join(rootDir, 'dist', 'release');
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const plugins = scanPlugins(rootDir);
  const archives = [];
  const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

  // 1. Per-plugin versioned & stable latest archives (for remote 1-line installer)
  for (const p of plugins) {
    const pluginAbs = join(rootDir, p.path);
    const entries = collectEntries(pluginAbs, p.id, [], { skipTests: true });
    const zipBuf = buildZip(entries);
    const tgzBuf = buildTarGz(entries);

    const vZip = `${p.id}-v${p.version}.zip`;
    const vTgz = `${p.id}-v${p.version}.tar.gz`;
    const sZip = `${p.id}.zip`;
    const sTgz = `${p.id}.tar.gz`;

    for (const [name, buf] of [[vZip, zipBuf], [vTgz, tgzBuf], [sZip, zipBuf], [sTgz, tgzBuf]]) {
      writeFileSync(join(outDir, name), buf);
      archives.push({ name, hash: sha256(buf) });
    }
  }

  // 2. Full monorepo bundle archive
  const bundleItems = [
    'README.md',
    'README.en.md',
    'AGENTS.md',
    'LICENSE',
    'NOTICE',
    'CHANGELOG.md',
    'CONTRIBUTING.md',
    'SECURITY.md',
    'CODE_OF_CONDUCT.md',
    'registry.json',
    'package.json',
    'install.sh',
    'install.bat',
    'uninstall.sh',
    'uninstall.bat',
    'scripts',
    'plugins',
  ];
  const bundleEntries = [];
  for (const item of bundleItems) {
    const abs = join(rootDir, item);
    if (existsSync(abs)) collectEntries(abs, `antigravity-plugins/${item}`, bundleEntries, { skipTests: true });
  }
  const bZip = `antigravity-plugins-bundle-v${pkg.version}.zip`;
  const bTgz = `antigravity-plugins-bundle-v${pkg.version}.tar.gz`;
  const bZipBuf = buildZip(bundleEntries);
  const bTgzBuf = buildTarGz(bundleEntries);
  writeFileSync(join(outDir, bZip), bZipBuf);
  writeFileSync(join(outDir, bTgz), bTgzBuf);
  archives.push({ name: bZip, hash: sha256(bZipBuf) });
  archives.push({ name: bTgz, hash: sha256(bTgzBuf) });

  const sums = `${archives.map((a) => `${a.hash}  ${a.name}`).join('\n')}\n`;
  writeFileSync(join(outDir, 'SHA256SUMS.txt'), sums, 'utf-8');
  writeFileSync(join(outDir, 'RELEASE_BODY.md'), extractReleaseNotes(rootDir, pkg.version), 'utf-8');

  return { outDir, archives: archives.map((a) => a.name), pluginCount: plugins.length };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const res = packageRelease(MONOREPO_ROOT);
  console.log(`Packaged ${res.pluginCount} plugins (${res.archives.length} archives) into ${res.outDir}`);
}
