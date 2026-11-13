'use strict';
// Preserve Electron ASAR support in the host process.

/**
 * Antigravity 上下文加长 (Context Window Unlock) 引擎
 * 
 * 方案参考与致敬：
 * 解锁方案提供者：Linux.do @23375 (https://linux.do/u/23375/summary)
 * 本项目进行 Node.js 原生适配与客户端集成。
 *
 * 核心原理：
 * 运行时解析 Go 二进制文件中的 .gopclntab 符号表，动态定位目标函数并修补 256K (0x3e800) 压缩硬上限：
 * - Gate 3A: utils.GetCheckpointConfig (移除 256,000 封顶 clamp，恢复按模型物理窗口动态计算 983,040 上限)
 * - Gate 3B: config.applyFeatureProviderCheckpointOverrideConfig (阻止 CASCADE_USE_EXPERIMENT_CHECKPOINTER 覆盖)
 * - 针对 agy CLI 额外支持 Gate 1 (model.SelectorModel.offersContextWindow) 与 Gate 2 (store.(*Store).ContextWindow)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile, execFileSync } = require('child_process');
const { getStateDir } = require('./asar-engine');

const PCLNTAB_MAGIC = 0xFFFFFFF1;

const FUNC_OFFERS = 'model.SelectorModel.offersContextWindow';
const FUNC_STORE_CW = 'store.(*Store).ContextWindow';
const FUNC_STORE_CHOICE = 'store.(*Store).ContextWindowChoice';
const FUNC_CHECKPOINT = 'utils.GetCheckpointConfig';
const FUNC_EXP_CHECKPOINT = 'config.applyFeatureProviderCheckpointOverrideConfig';
const FUNC_SELECT_EXP_KEY = 'config.selectCheckpointExperimentKey';
const FUNC_OVERRIDE = 'store.AutoCompactOverride';

const NOP_ARM64 = Buffer.from([0x1f, 0x20, 0x03, 0xd5]);
const RET_TRUE_ARM64 = Buffer.from([0x20, 0x00, 0x80, 0x52, 0xc0, 0x03, 0x5f, 0xd6]);
const RET_TRUE_X64 = Buffer.from([0xb8, 0x01, 0x00, 0x00, 0x00, 0xc3]);

const CLAMP_256K_ARM64 = Buffer.from('04009dd26400a0f27f00046b04009dd26400a0f26330849a', 'hex');
const CLAMP_256K_X64 = Buffer.from('81fa00e80300be00e803000f42f2', 'hex');
const PATCH_256K_X64 = Buffer.concat([Buffer.from('89d6', 'hex'), Buffer.alloc(12, 0x90)]);

const AUTHOR_INFO = {
  name: 'Linux.do @23375',
  credit: '解锁方案来源：原作者帖子 (Linux.do @23375)',
  url: 'https://linux.do/t/topic/3117832',
  disclaimer: '本功能为非官方本地技术修补，更新官方客户端后可能失效；账号风险未知，无法承诺“不会封号”。'
};

function sha256Buffer(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

/**
 * 探测本机 Antigravity 桌面端 language_server 二进制路径
 */
function detectTargetBinary(customPath) {
  if (customPath) {
    const resolved = path.resolve(customPath);
    if (fs.existsSync(resolved)) return resolved;
    throw new Error(`指定的目标文件不存在: ${customPath}`);
  }

  const home = os.homedir();
  const candidates = [];

  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    candidates.push(
      path.join(localAppData, 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe'),
      path.join(programFiles, 'antigravity', 'resources', 'bin', 'language_server.exe'),
      path.join(programFiles, 'Google Antigravity', 'resources', 'bin', 'language_server.exe')
    );
  } else if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Antigravity.app/Contents/Resources/bin/language_server',
      path.join(home, 'Applications', 'Antigravity.app', 'Contents', 'Resources', 'bin', 'language_server')
    );
  } else {
    candidates.push(
      '/opt/antigravity/resources/bin/language_server',
      '/usr/lib/antigravity/resources/bin/language_server',
      path.join(home, '.local', 'share', 'antigravity', 'resources', 'bin', 'language_server')
    );
  }

  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * 二进制容器解析：提取 .text 节区信息
 */
function findTextSection(buf) {
  if (buf.length < 64) throw new Error('文件体积过小，非有效可执行文件');

  // Mach-O 64-bit LE
  if (buf[0] === 0xcf && buf[1] === 0xfa && buf[2] === 0xed && buf[3] === 0xfe) {
    const cputype = buf.readUInt32LE(4);
    const arch = cputype === 0x0100000C ? 'arm64' : (cputype === 0x01000007 ? 'x86-64' : null);
    if (!arch) throw new Error(`不支持的 Mach-O cputype: 0x${cputype.toString(16)}`);
    const ncmds = buf.readUInt32LE(16);
    let off = 32;
    for (let c = 0; c < ncmds; c++) {
      const cmd = buf.readUInt32LE(off);
      const size = buf.readUInt32LE(off + 4);
      if (cmd === 0x19) { // LC_SEGMENT_64
        const nsects = buf.readUInt32LE(off + 64);
        let sect = off + 72;
        for (let s = 0; s < nsects; s++) {
          const sectName = buf.subarray(sect, sect + 16).toString().replace(/\0+$/, '');
          if (sectName === '__text') {
            const addr = buf.readBigUInt64LE(sect + 32);
            const offset = buf.readUInt32LE(sect + 48);
            return { textVA: addr, textOff: offset, arch, format: 'Mach-O' };
          }
          sect += 80;
        }
      }
      off += size;
    }
    throw new Error('未在 Mach-O 中找到 __text 段');
  }

  // ELF 64-bit LE
  if (buf.subarray(0, 4).toString('ascii') === '\x7fELF') {
    if (buf[4] !== 2 || buf[5] !== 1) throw new Error('仅支持 64 位小端 ELF');
    const machine = buf.readUInt16LE(18);
    const arch = machine === 0xb7 ? 'arm64' : (machine === 0x3e ? 'x86-64' : null);
    if (!arch) throw new Error(`不支持的 ELF 架构: 0x${machine.toString(16)}`);
    const shoff = Number(buf.readBigUInt64LE(40));
    const shentsize = buf.readUInt16LE(58);
    const shnum = buf.readUInt16LE(60);
    const shstrndx = buf.readUInt16LE(62);
    const strtabOff = Number(buf.readBigUInt64LE(shoff + shstrndx * shentsize + 24));

    for (let i = 0; i < shnum; i++) {
      const sh = shoff + i * shentsize;
      const nameoff = buf.readUInt32LE(sh);
      const end = buf.indexOf(0, strtabOff + nameoff);
      const name = buf.subarray(strtabOff + nameoff, end).toString('utf8');
      if (name === '.text') {
        const addr = buf.readBigUInt64LE(sh + 16);
        const offset = Number(buf.readBigUInt64LE(sh + 24));
        return { textVA: addr, textOff: offset, arch, format: 'ELF' };
      }
    }
    throw new Error('未在 ELF 中找到 .text 段');
  }

  // PE (Windows)
  if (buf[0] === 0x4d && buf[1] === 0x5a) { // MZ
    const peOff = buf.readUInt32LE(0x3c);
    if (buf.subarray(peOff, peOff + 4).toString('ascii') !== 'PE\0\0') {
      throw new Error('无效的 PE 签名');
    }
    const machine = buf.readUInt16LE(peOff + 4);
    const arch = machine === 0x8664 ? 'x86-64' : (machine === 0xaa64 ? 'arm64' : null);
    if (!arch) throw new Error(`不支持的 PE 机器架构: 0x${machine.toString(16)}`);
    const nsec = buf.readUInt16LE(peOff + 6);
    const optSize = buf.readUInt16LE(peOff + 20);
    const opt = peOff + 24;
    const imageBase = buf.readBigUInt64LE(opt + 24);
    let sect = opt + optSize;
    for (let i = 0; i < nsec; i++) {
      const name = buf.subarray(sect, sect + 8).toString().replace(/\0+$/, '');
      if (name === '.text') {
        const vaddr = buf.readUInt32LE(sect + 12);
        const rawptr = buf.readUInt32LE(sect + 20);
        return { textVA: imageBase + BigInt(vaddr), textOff: rawptr, arch, format: 'PE' };
      }
      sect += 40;
    }
    throw new Error('未在 PE 中找到 .text 段');
  }

  throw new Error('无法识别的可执行文件格式 (必须为 PE、Mach-O 或 ELF)');
}

/**
 * 定位 Go .gopclntab 符号表基址
 */
function findPclntab(buf) {
  const magic = Buffer.from([0xf1, 0xff, 0xff, 0xff, 0x00, 0x00]);
  let pos = 0;
  while (pos < buf.length - 64) {
    const idx = buf.indexOf(magic, pos);
    if (idx < 0) break;
    pos = idx + 1;
    const minLC = buf[idx + 6];
    const ptrSize = buf[idx + 7];
    if ((minLC === 1 || minLC === 2 || minLC === 4) && ptrSize === 8) {
      const nfunc = Number(buf.readBigUInt64LE(idx + 8));
      if (nfunc > 1000 && nfunc < 5000000) {
        const fnOff = Number(buf.readBigUInt64LE(idx + 32));
        if (idx + fnOff + 16 <= buf.length) {
          const head = buf.subarray(idx + fnOff, idx + fnOff + 16);
          let valid = true;
          for (let b of head) {
            if (!( (b >= 0x20 && b < 0x7f) || b === 0 )) {
              valid = false;
              break;
            }
          }
          if (valid) {
            return { base: idx, nfunc };
          }
        }
      }
    }
  }
  throw new Error('未在二进制中检测到 Go .gopclntab 符号表（可能已被深度 strip 或非 Go 编译）');
}

/**
 * 解析 Go 函数符号表
 */
function buildFunctions(buf, targetSymbols) {
  const { base, nfunc } = findPclntab(buf);
  const fnstart = base + Number(buf.readBigUInt64LE(base + 32));
  const pcln = base + Number(buf.readBigUInt64LE(base + 64));

  const targetSet = new Set(targetSymbols || [
    FUNC_OFFERS,
    FUNC_STORE_CW,
    FUNC_STORE_CHOICE,
    FUNC_CHECKPOINT,
    FUNC_EXP_CHECKPOINT,
    FUNC_SELECT_EXP_KEY,
    FUNC_OVERRIDE
  ]);

  const funcs = {};
  let targetsFound = 0;

  for (let i = 0; i < nfunc; i++) {
    const off = pcln + i * 8;
    if (off + 16 > buf.length) break;
    const entryoff = buf.readUInt32LE(off);
    const funcoff = buf.readUInt32LE(off + 4);
    const nextEntry = buf.readUInt32LE(off + 8);

    const rec = pcln + funcoff;
    if (rec + 8 > buf.length) continue;
    const nameoff = buf.readInt32LE(rec + 4);
    const s = fnstart + nameoff;
    const end = buf.indexOf(0, s);
    if (end < 0 || end - s > 500) continue;

    const fullName = buf.subarray(s, end).toString('ascii');
    const shortName = fullName.split('/').pop();
    if (targetSet.has(shortName)) {
      if (!funcs[shortName]) {
        funcs[shortName] = {
          entryoff,
          size: Math.max(0, nextEntry - entryoff),
          fullName
        };
        targetsFound++;
        if (targetsFound >= targetSet.size) break;
      }
    }
  }

  return { funcs, totalSymbols: nfunc };
}

/**
 * 检测 Gate 3A 状态
 */
function checkGate3A(buf, textOff, sym, arch) {
  const fnOff = textOff + sym.entryoff;
  const fnSize = sym.size || 0x600;
  const body = buf.subarray(fnOff, Math.min(buf.length, fnOff + fnSize));

  if (arch === 'arm64') {
    const nop6 = Buffer.concat([NOP_ARM64, NOP_ARM64, NOP_ARM64, NOP_ARM64, NOP_ARM64, NOP_ARM64]);
    if (body.indexOf(CLAMP_256K_ARM64) >= 0) {
      return { status: 'unpatched', offset: fnOff + body.indexOf(CLAMP_256K_ARM64), length: 24 };
    }
    if (body.indexOf(nop6) >= 0) {
      return { status: 'patched', offset: fnOff + body.indexOf(nop6), length: 24 };
    }
    return { status: 'unknown' };
  }

  // x86-64
  const idx = body.indexOf(CLAMP_256K_X64);
  if (idx >= 0) {
    return { status: 'unpatched', offset: fnOff + idx, length: CLAMP_256K_X64.length };
  }
  const pIdx = body.indexOf(PATCH_256K_X64);
  if (pIdx >= 0) {
    return { status: 'patched', offset: fnOff + pIdx, length: PATCH_256K_X64.length };
  }
  return { status: 'unknown' };
}

function findArm64TbnzGate3B(body, textVA, fnVA, fnOff, symSelect) {
  if (!symSelect) return null;
  const selVA = textVA + BigInt(symSelect.entryoff);

  for (let rel = 0; rel <= body.length - 16; rel += 4) {
    const insn = body.readUInt32LE(rel);
    if ((insn >>> 26) !== 0x25) continue; // BL <target>
    const imm26 = insn & 0x03ffffff;
    const sImm26 = (imm26 & 0x02000000) ? (imm26 - 0x04000000) : imm26;
    const callTargetVA = fnVA + BigInt(rel) + BigInt(sImm26 * 4);
    if (callTargetVA !== selVA) continue;

    const searchEnd = Math.min(body.length - 16, rel + 96);
    for (let k = rel + 4; k <= searchEnd; k += 4) {
      const w0 = body.readUInt32LE(k);
      if (((w0 & 0xfffffc1f) >>> 0) !== 0xd63f0000) continue; // BLR xN

      const next = body.readUInt32LE(k + 4);
      const ldrInsn = body.readUInt32LE(k + 8);
      const bInsn = body.readUInt32LE(k + 12);
      const isLdrSp = ((ldrInsn & 0xffc003e0) >>> 0) === 0xf94003e0;
      const isBranchOrRet = ((bInsn >>> 26) === 0x05) || bInsn === 0xd65f03c0;
      if (!isLdrSp || !isBranchOrRet) continue;

      if (((next & 0xfff8001f) >>> 0) === 0x37000000) {
        return {
          status: 'unpatched',
          patchMode: 'tbnz_nop',
          offset: fnOff + k + 4,
          length: 4,
          origBytes: Array.from(body.subarray(k + 4, k + 8))
        };
      }
      if (next === 0xd503201f) {
        return {
          status: 'patched',
          patchMode: 'tbnz_nop',
          offset: fnOff + k + 4,
          length: 4
        };
      }
    }
  }
  return null;
}

/**
 * 检测 Gate 3B 状态
 */
function checkGate3B(buf, textVA, textOff, symExp, symSelect, arch) {
  const fnOff = textOff + symExp.entryoff;
  const fnSize = symExp.size || 0x200;
  const fnVA = textVA + BigInt(symExp.entryoff);
  const body = buf.subarray(fnOff, Math.min(buf.length, fnOff + fnSize));

  if (arch === 'x86-64') {
    if (!symSelect) return { status: 'unknown' };
    const selVA = textVA + BigInt(symSelect.entryoff);

    for (let rel = 0; rel < body.length - 12; rel++) {
      if (body[rel] === 0xe8) {
        const disp = body.readInt32LE(rel + 1);
        if (fnVA + BigInt(rel + 5 + disp) === selVA) {
          const window = body.subarray(rel + 5, Math.min(body.length, rel + 105));
          const tIdx = window.indexOf(Buffer.from([0x84, 0xc0])); // test %al, %al
          if (tIdx >= 0) {
            const jOff = rel + 5 + tIdx + 2;
            const b1 = body[jOff];
            const b2 = body[jOff + 1];
            if (b1 === 0x75) {
              return { status: 'unpatched', offset: fnOff + jOff, length: 2, jumpType: 'rel8', origBytes: [b1, b2] };
            }
            if (b1 === 0x0f && b2 === 0x85) {
              return { status: 'unpatched', offset: fnOff + jOff, length: 6, jumpType: 'rel32', origBytes: Array.from(body.subarray(jOff, jOff + 6)) };
            }
            if (b1 === 0x90 && b2 === 0x90) {
              return { status: 'patched', offset: fnOff + jOff, length: 2 };
            }
            if (b1 === 0x90 && body.subarray(jOff, jOff + 6).every(b => b === 0x90)) {
              return { status: 'patched', offset: fnOff + jOff, length: 6 };
            }
          }
        }
      }
    }
    return { status: 'unknown' };
  }

  if (arch === 'arm64') {
    const tbnzMatch = findArm64TbnzGate3B(body, textVA, fnVA, fnOff, symSelect);
    if (tbnzMatch) return tbnzMatch;

    for (let rel = 4; rel < body.length - 16; rel += 4) {
      const w0 = body.readUInt32LE(rel);
      const w1 = body.readUInt32LE(rel + 4);
      if ((w0 & 0xff00001f) === 0xb4000000 && w1 === 0xb9000c1f) {
        return { status: 'patched', patchMode: 'legacy_cbz', offset: fnOff + rel, length: 24 };
      }
      if ((w0 & 0xff00001f) === 0xb4000001) { // cbz x1, ...
        return { status: 'unpatched', patchMode: 'legacy_cbz', offset: fnOff + rel, length: 24 };
      }
    }
    return { status: 'unknown' };
  }

  return { status: 'unknown' };
}

function resolveUnlockBackupDir(overrideDir, createIfMissing = false) {
  let dir;
  if (overrideDir && typeof overrideDir === 'string') {
    dir = overrideDir;
  } else if (process.env.AG_UNLOCK_DIR) {
    dir = path.resolve(process.env.AG_UNLOCK_DIR);
  } else {
    try {
      dir = path.join(getStateDir(), 'backups', 'context-unlock');
    } catch {
      return null;
    }
  }
  if (createIfMissing && !fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 备份目录位置（支持通过 options 或环境变量隔离，单测安全）
 */
function getUnlockBackupDir(overrideDir) {
  return resolveUnlockBackupDir(overrideDir, true);
}

function getManifestPath(backupDir, createIfMissing = false) {
  const dir = resolveUnlockBackupDir(backupDir, createIfMissing);
  return dir ? path.join(dir, 'manifest.json') : null;
}

function loadManifest(backupDir) {
  try {
    const mf = getManifestPath(backupDir, false);
    if (mf && fs.existsSync(mf)) {
      return JSON.parse(fs.readFileSync(mf, 'utf8'));
    }
  } catch {
    return null;
  }
  return null;
}

function saveManifest(data, backupDir) {
  const mf = getManifestPath(backupDir, true);
  if (!mf) throw new Error('无法确定解锁备份目录');
  fs.writeFileSync(mf, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * 安全清理因运行中文件占用重命名产生的历史残留文件 (.old_*)
 * 严格只处理 targetDir 目录下且命名匹配 `<targetName>.old_<timestamp>` 的孤立旧文件
 * 绝对不触碰原版备份 (.orig)、当前目标文件及其他无关文件
 */
function cleanupOldReplacedFiles(targetDir, targetFileName, excludePath = null) {
  const cleaned = [];
  const retained = [];
  if (!targetDir || !fs.existsSync(targetDir) || !targetFileName) {
    return { cleaned, retained };
  }
  const escapedName = targetFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const oldPattern = new RegExp(`^${escapedName}\\.old_\\d+$`, 'i');
  try {
    const files = fs.readdirSync(targetDir);
    for (const f of files) {
      if (oldPattern.test(f)) {
        const full = path.join(targetDir, f);
        if (excludePath && path.resolve(full) === path.resolve(excludePath)) {
          continue;
        }
        try {
          fs.unlinkSync(full);
          cleaned.push(f);
        } catch (err) {
          retained.push({ file: f, reason: err.code || err.message });
        }
      }
    }
  } catch {}
  return { cleaned, retained };
}

/**
 * 进程状态缓存（短生命周期，按目标路径隔离，避免面板快速连续刷新触发重复进程枚举）
 */
let cachedProcInfo = null;
let cachedProcTarget = null;
let cachedProcAt = 0;
let inFlightProcQuery = null;
let inFlightProcKey = null;

function normalizeComparePath(filePath) {
  if (!filePath) return '';
  const resolved = path.resolve(filePath);
  return process.platform === 'linux' ? resolved : resolved.toLowerCase();
}

function parsePsEtimeSeconds(etimeStr) {
  const s = String(etimeStr || '').trim();
  if (!s) return NaN;
  let days = 0;
  let rest = s;
  const dashIdx = rest.indexOf('-');
  if (dashIdx >= 0) {
    days = parseInt(rest.slice(0, dashIdx), 10);
    rest = rest.slice(dashIdx + 1);
    if (isNaN(days)) return NaN;
  }
  const parts = rest.split(':').map(n => parseInt(n, 10));
  if (parts.some(isNaN)) return NaN;
  if (parts.length === 2) return days * 86400 + parts[0] * 60 + parts[1];
  if (parts.length === 3) return days * 86400 + parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 1) return days * 86400 + parts[0];
  return NaN;
}

function extractProcessExePath(cmdLine, targetPath, binName) {
  const cmd = String(cmdLine || '').trim();
  if (!cmd) return null;

  if (targetPath) {
    const resolved = path.resolve(targetPath);
    const normCmd = process.platform === 'linux' ? cmd : cmd.toLowerCase();
    const normTarget = normalizeComparePath(resolved);
    if (normCmd === normTarget || normCmd.startsWith(normTarget + ' ') || normCmd.startsWith(normTarget + '\t')) {
      return resolved;
    }
  }

  const name = binName || 'language_server';
  const marker = `/${name}`;
  let searchFrom = 0;
  while (true) {
    const idx = cmd.indexOf(marker, searchFrom);
    if (idx < 0) break;
    const after = idx + marker.length;
    if (after === cmd.length || /\s/.test(cmd[after])) {
      const prefix = cmd.slice(0, idx);
      if (prefix.startsWith('/') && !/\s-(?:c|e|f)\s| --?/.test(prefix)) {
        return cmd.slice(0, after);
      }
    }
    searchFrom = idx + 1;
  }

  if (cmd === name || cmd.startsWith(name + ' ') || cmd.startsWith(name + '\t')) {
    return name;
  }
  return null;
}

/**
 * 辅助检查文件独占写锁（耗时 < 0.2ms，仅作为辅助信号，不能直接代表进程正在运行）
 */
function checkFileWriteLock(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return false;
  // macOS 不对运行中的可执行文件施加写锁，打开 r+ 只会在只读或沙箱目录下误报 EPERM
  if (process.platform === 'darwin') return false;
  try {
    const fd = fs.openSync(filePath, 'r+');
    fs.closeSync(fd);
    return false;
  } catch (e) {
    if (process.platform === 'win32') {
      return e.code === 'EBUSY' || e.code === 'EPERM';
    }
    return e.code === 'EBUSY' || e.code === 'ETXTBSY';
  }
}

/**
 * 纯异步获取运行中 language_server 进程的详细信息（PID、路径、启动时间毫秒）
 * 包含：并发去重 (In-flight Promise 复用)、2.5s 短期缓存、3000ms 超时控制，绝不阻塞主进程事件循环
 */
async function getRunningLanguageServerInfoAsync(targetPath, forceRefresh = false) {
  const now = Date.now();
  const targetNormalized = targetPath ? normalizeComparePath(targetPath) : null;
  const cacheKey = targetNormalized || '__default__';
  if (!forceRefresh && cachedProcInfo && cachedProcTarget === cacheKey && (now - cachedProcAt < 2500)) {
    return cachedProcInfo;
  }

  if (inFlightProcQuery && inFlightProcKey === cacheKey) {
    return inFlightProcQuery;
  }

  const queryPromise = (async () => {
    const result = {
      isRunning: false,
      locked: checkFileWriteLock(targetPath),
      pid: null,
      path: null,
      startTimeMs: null,
      pids: [],
      isUnknown: false,
      queryFailed: false
    };

    if (process.platform === 'win32') {
      try {
        const psScript = `
          $procs = Get-Process -Name 'language_server*' -ErrorAction SilentlyContinue
          if (!$procs) { '[]'; exit }
          $list = @($procs) | ForEach-Object {
            $p = ''
            try { $p = $_.Path } catch {}
            $st = 0
            try { $st = [int64]($_.StartTime.ToUniversalTime() - (Get-Date '1970-01-01')).TotalMilliseconds } catch {}
            [PSCustomObject]@{
              Id = $_.Id
              Path = $p
              StartTimeMs = $st
            }
          }
          $list | ConvertTo-Json -Compress
        `;

        const stdout = await new Promise((resolve, reject) => {
          execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psScript], {
            encoding: 'utf8',
            timeout: 3000,
            windowsHide: true
          }, (err, out) => {
            if (err) reject(err);
            else resolve(out);
          });
        });

        const parsed = JSON.parse(String(stdout || '').trim() || '[]');
        const procList = Array.isArray(parsed) ? parsed : [parsed];

        if (procList.length > 0) {
          result.pids = procList.map(p => p.Id).filter(Boolean);

          let matched = null;
          if (targetNormalized) {
            matched = procList.find(p => p.Path && path.resolve(p.Path).toLowerCase() === targetNormalized);
          }

          if (matched) {
            result.isRunning = true;
            result.pid = matched.Id;
            result.path = matched.Path || targetPath || null;
            if (matched.StartTimeMs && Number(matched.StartTimeMs) > 0) {
              result.startTimeMs = Number(matched.StartTimeMs);
            }
          } else {
            result.isRunning = result.locked;
          }
        } else {
          result.isRunning = false;
        }
      } catch (e) {
        // 异步查询超时或失败：标记为未知状态，辅助文件锁保留
        result.queryFailed = true;
        result.isUnknown = true;
        result.isRunning = result.locked;
      }
    } else {
      // Unix / macOS 异步探测
      try {
        const binName = targetPath ? path.basename(targetPath) : 'language_server';
        const psOut = await new Promise((resolve, reject) => {
          execFile('ps', ['-ax', '-o', 'pid=,etime=,args='], {
            encoding: 'utf8',
            timeout: 2500,
            maxBuffer: 4 * 1024 * 1024
          }, (err, out) => {
            if (err) reject(err);
            else resolve(out);
          });
        });

        const procs = [];
        for (const line of String(psOut || '').split(/\r?\n/)) {
          const m = line.match(/^\s*(\d+)\s+(\S+)\s+(.+)$/);
          if (!m) continue;
          const pid = parseInt(m[1], 10);
          if (!pid || pid === process.pid) continue;
          const etimeSec = parsePsEtimeSeconds(m[2]);
          const exePath = extractProcessExePath(m[3], targetPath, binName);
          if (!exePath) continue;
          procs.push({
            pid,
            path: exePath,
            startTimeMs: !isNaN(etimeSec) ? Date.now() - etimeSec * 1000 : null
          });
        }

        if (procs.length > 0) {
          result.pids = procs.map(p => p.pid);
          const matched = targetNormalized
            ? procs.find(p => p.path && normalizeComparePath(p.path) === targetNormalized)
            : procs[0];
          if (matched) {
            result.isRunning = true;
            result.pid = matched.pid;
            result.path = matched.path || targetPath || null;
            result.startTimeMs = matched.startTimeMs;
          } else {
            result.isRunning = result.locked;
          }
        } else {
          result.isRunning = false;
        }
      } catch {
        result.queryFailed = true;
        result.isUnknown = true;
        result.isRunning = result.locked;
      }
    }

    cachedProcInfo = result;
    cachedProcTarget = cacheKey;
    cachedProcAt = Date.now();
    return result;
  })();

  inFlightProcQuery = queryPromise;
  inFlightProcKey = cacheKey;
  try {
    return await queryPromise;
  } finally {
    inFlightProcQuery = null;
    inFlightProcKey = null;
  }
}

/**
 * 同步快速获取进程状态（优先使用短期缓存或仅检查文件锁，绝不发起同步 powershell 阻塞主进程）
 */
function getRunningLanguageServerInfo(targetPath, forceRefresh = false) {
  const now = Date.now();
  const cacheKey = targetPath ? normalizeComparePath(targetPath) : '__default__';
  if (!forceRefresh && cachedProcInfo && cachedProcTarget === cacheKey && (now - cachedProcAt < 2500)) {
    return cachedProcInfo;
  }
  const isLocked = checkFileWriteLock(targetPath);
  return {
    isRunning: isLocked,
    locked: isLocked,
    pid: null,
    path: targetPath || null,
    startTimeMs: null,
    pids: [],
    isUnknown: isLocked ? true : false,
    isSyncFallback: true
  };
}

/**
 * 保持旧签名兼容
 */
function checkProcessActivity(targetPath) {
  return getRunningLanguageServerInfo(targetPath, false);
}

/**
 * 核心状态判定推导算法（综合静态特征、真实请求预算证据与进程生命周期）
 */
function synthesizeAnalysisStatus(options = {}) {
  const {
    gate3a,
    gate3b,
    proc,
    manifest,
    stats,
    target,
    currentSha256,
    observedBudget,
    isBudgetVerified
  } = options;

  let overallStatus = 'unsupported';
  let statusText = '不支持';
  let details = '';

  const targetNorm = normalizeComparePath(target);
  const manifestTargetNorm = (manifest && manifest.targetPath) ? normalizeComparePath(manifest.targetPath) : null;
  const isTargetMatched = manifestTargetNorm === targetNorm;
  const isRecent = Boolean(manifest && manifest.patchedSha256 === currentSha256 && isTargetMatched);
  const patchedAtMs = (isRecent && manifest && manifest.patchedAt) ? new Date(manifest.patchedAt).getTime() : 0;
  const fileMtimeMs = (stats && stats.mtimeMs) ? stats.mtimeMs : 0;
  const effectivePatchTimeMs = patchedAtMs > 0 ? patchedAtMs : fileMtimeMs;

  const isProcPathMatched = Boolean(
    proc?.path &&
    targetNorm &&
    normalizeComparePath(proc.path) === targetNorm
  );

  let restartDetected = null;
  // 必须确证目标进程路径匹配，绝不能仅凭存在某个新启动的同名进程就判定加载了本次修改后的二进制！
  if (isProcPathMatched && proc?.startTimeMs && effectivePatchTimeMs > 0) {
    restartDetected = (proc.startTimeMs >= effectivePatchTimeMs - 1500);
  }

  if (gate3a.status === 'unpatched' && gate3b.status === 'unpatched') {
    overallStatus = 'not_patched';
    statusText = '未解锁';
    details = '检测到官方原版二进制，门禁特征完整，可安全执行加长解锁。';
  } else if (gate3a.status === 'patched' && gate3b.status === 'patched') {
    // 证据等级 1: 真实请求预算已突破 256,000 封顶（最强确凿证据）
    if (isBudgetVerified) {
      overallStatus = 'verified_active';
      statusText = '已验证生效';
      details = `补丁已加载生效，且当前会话已通过真实请求预算验证（有效检查点上限为 ${observedBudget.toLocaleString()} tokens）。`;
      if (manifest && manifest.needsRestart) {
        manifest.needsRestart = false;
        try { saveManifest(manifest, options.backupDir); } catch {}
      }
    } else if (proc && !proc.isUnknown && !proc.queryFailed && !proc.isRunning && !proc.locked) {
      // 客户端未处于运行状态：补丁已在磁盘安全就绪，但尚未在运行时加载生效，严禁误报 verified_active！
      overallStatus = 'patched_runtime_unconfirmed';
      statusText = '磁盘已解锁，运行待确认';
      details = '静态特征校验通过，双重 256,000 上限已放行；当前核心进程未运行，将在客户端启动后生效。';
    } else if (restartDetected === true && isProcPathMatched) {
      // 明确检测到目标进程 (路径严格匹配) 启动时间晚于补丁修改时间 -> 确证已加载修改后的新二进制
      overallStatus = 'verified_active';
      statusText = '已验证生效';
      details = `目标进程 (PID ${proc?.pid || '未知'}) 路径严格匹配，且启动时间晚于补丁写入时间，确证已加载本次修改后的二进制文件；待首条会话请求验证实际预算。`;
      if (manifest && manifest.needsRestart) {
        manifest.needsRestart = false;
        try { saveManifest(manifest, options.backupDir); } catch {}
      }
    } else if (restartDetected === false && isProcPathMatched) {
      // 明确检测到运行中的进程启动时间早于打补丁时间 -> 确实未重启
      overallStatus = 'patched_pending_restart';
      statusText = '已写入补丁，待重启';
      details = `补丁已安全写入磁盘，但当前运行中的 Antigravity 宿主进程 (PID ${proc?.pid || '未知'}) 启动于打补丁之前，请正常重启客户端以生效。`;
    } else {
      // 无法确证进程状态（如进程路径不匹配、仅文件被外部占用、进程枚举受限或缺少启动时间戳），严禁盲目误报已生效！
      overallStatus = 'patched_runtime_unconfirmed';
      statusText = '磁盘已解锁，运行待确认';
      details = isProcPathMatched
        ? '补丁已写入磁盘并通过底层特征校验。若尚未重启客户端，请重启以生效；若已重启，发送一条对话请求即可自动确认。'
        : '补丁已写入磁盘目标文件；检测到后台活动但未能确证目标进程加载路径，待客户端启动并拉起目标二进制后生效。';
    }
  } else if (gate3a.status === 'unknown' || gate3b.status === 'unknown') {
    overallStatus = 'failed';
    statusText = '检测或执行失败';
    details = `特征匹配异常 (Gate 3A: ${gate3a.status}, Gate 3B: ${gate3b.status})，为防止损坏文件已中止操作。`;
  } else {
    overallStatus = 'failed';
    statusText = '检测或执行失败';
    details = `门禁状态不一致 (Gate 3A: ${gate3a.status}, Gate 3B: ${gate3b.status})。`;
  }

  return {
    overallStatus,
    statusText,
    details,
    restartDetected
  };
}

/**
 * 完整分析二进制支持度与补丁状态（纯异步非阻塞版本，供主进程 IPC、CLI 及前端使用）
 */
async function analyzeBinaryAsync(filePath, options = {}) {
  const target = filePath || detectTargetBinary();
  if (!target || !fs.existsSync(target)) {
    return {
      status: 'unsupported',
      targetPath: target,
      reason: target ? '目标文件不存在' : '未检测到 Antigravity 后端文件 (language_server)'
    };
  }

  let buf;
  let stats;
  try {
    stats = fs.statSync(target);
    buf = fs.readFileSync(target);
  } catch (e) {
    return {
      status: 'failed',
      targetPath: target,
      reason: `读取目标文件失败: ${e.message}`
    };
  }

  const currentSha256 = sha256Buffer(buf);

  let container;
  try {
    container = findTextSection(buf);
  } catch (e) {
    return {
      status: 'unsupported',
      targetPath: target,
      sha256: currentSha256,
      reason: e.message
    };
  }

  const { textVA, textOff, arch, format } = container;

  if (arch !== 'x86-64' && arch !== 'arm64') {
    return {
      status: 'unsupported',
      targetPath: target,
      arch,
      format,
      sha256: currentSha256,
      reason: `不支持的处理器架构: ${arch}（仅支持 x86-64 与 arm64）。`,
      isPlatformSupported: false
    };
  }

  let funcsData;
  try {
    funcsData = buildFunctions(buf);
  } catch (e) {
    return {
      status: 'unsupported',
      targetPath: target,
      arch,
      format,
      sha256: currentSha256,
      reason: e.message
    };
  }

  const { funcs, totalSymbols } = funcsData;
  const isServerOnly = (!funcs[FUNC_OFFERS] && !funcs[FUNC_STORE_CW]);
  const mode = isServerOnly ? 'standalone language_server' : 'agy CLI';

  const symCheckpoint = funcs[FUNC_CHECKPOINT];
  const symExp = funcs[FUNC_EXP_CHECKPOINT];
  const symSelect = funcs[FUNC_SELECT_EXP_KEY];

  if (!symCheckpoint || !symExp) {
    return {
      status: 'unsupported',
      targetPath: target,
      arch,
      format,
      mode,
      sha256: currentSha256,
      reason: '缺少核心检查点上限符号 (utils.GetCheckpointConfig 或 config.applyFeatureProviderCheckpointOverrideConfig)'
    };
  }

  const gate3a = checkGate3A(buf, textOff, symCheckpoint, arch);
  const gate3b = checkGate3B(buf, textVA, textOff, symExp, symSelect, arch);

  // 异步非阻塞枚举进程信息
  const proc = await getRunningLanguageServerInfoAsync(target, options.forceRefresh === true);
  const manifest = loadManifest(options.backupDir);

  const observedBudget = Number(options?.currentBudget || options?.observedBudget || 0);
  const isBudgetVerified = observedBudget > 256000;

  const synthesis = synthesizeAnalysisStatus({
    gate3a,
    gate3b,
    proc,
    manifest,
    stats,
    target,
    currentSha256,
    observedBudget,
    isBudgetVerified,
    backupDir: options.backupDir
  });

  return {
    status: synthesis.overallStatus,
    statusText: synthesis.statusText,
    details: synthesis.details,
    targetPath: target,
    format,
    arch,
    mode,
    fileSize: stats.size,
    sha256: currentSha256,
    totalSymbols,
    gate3a,
    gate3b,
    isProcessRunning: proc.isRunning,
    isProcessLocked: proc.locked,
    runtimeEvidence: {
      isProcessRunning: proc.isRunning,
      isProcessLocked: proc.locked,
      processPid: proc.pid || null,
      processStartTime: proc.startTimeMs ? new Date(proc.startTimeMs).toISOString() : null,
      patchedAt: manifest ? manifest.patchedAt : null,
      restartDetected: synthesis.restartDetected,
      observedBudget: observedBudget || null,
      budgetVerified: isBudgetVerified
    },
    hasBackup: Boolean(manifest && manifest.backupPath && fs.existsSync(manifest.backupPath)),
    backupInfo: manifest ? {
      origSha256: manifest.origSha256,
      backupPath: manifest.backupPath,
      patchedAt: manifest.patchedAt
    } : null,
    author: AUTHOR_INFO
  };
}

/**
 * 同步分析（保持与单测兼容，使用非阻塞快速探测）
 */
function analyzeBinary(filePath, options = {}) {
  const target = filePath || detectTargetBinary();
  if (!target || !fs.existsSync(target)) {
    return {
      status: 'unsupported',
      targetPath: target,
      reason: target ? '目标文件不存在' : '未检测到 Antigravity 后端文件 (language_server)'
    };
  }

  let buf;
  let stats;
  try {
    stats = fs.statSync(target);
    buf = fs.readFileSync(target);
  } catch (e) {
    return {
      status: 'failed',
      targetPath: target,
      reason: `读取目标文件失败: ${e.message}`
    };
  }

  const currentSha256 = sha256Buffer(buf);

  let container;
  try {
    container = findTextSection(buf);
  } catch (e) {
    return {
      status: 'unsupported',
      targetPath: target,
      sha256: currentSha256,
      reason: e.message
    };
  }

  const { textVA, textOff, arch, format } = container;

  let funcsData;
  try {
    funcsData = buildFunctions(buf);
  } catch (e) {
    return {
      status: 'unsupported',
      targetPath: target,
      arch,
      format,
      sha256: currentSha256,
      reason: e.message
    };
  }

  const { funcs, totalSymbols } = funcsData;
  const isServerOnly = (!funcs[FUNC_OFFERS] && !funcs[FUNC_STORE_CW]);
  const mode = isServerOnly ? 'standalone language_server' : 'agy CLI';

  const symCheckpoint = funcs[FUNC_CHECKPOINT];
  const symExp = funcs[FUNC_EXP_CHECKPOINT];
  const symSelect = funcs[FUNC_SELECT_EXP_KEY];

  if (!symCheckpoint || !symExp) {
    return {
      status: 'unsupported',
      targetPath: target,
      arch,
      format,
      mode,
      sha256: currentSha256,
      reason: '缺少核心检查点上限符号 (utils.GetCheckpointConfig 或 config.applyFeatureProviderCheckpointOverrideConfig)'
    };
  }

  const gate3a = checkGate3A(buf, textOff, symCheckpoint, arch);
  const gate3b = checkGate3B(buf, textVA, textOff, symExp, symSelect, arch);

  const proc = checkProcessActivity(target);
  const manifest = loadManifest(options.backupDir);

  const observedBudget = Number(options?.currentBudget || options?.observedBudget || 0);
  const isBudgetVerified = observedBudget > 256000;

  const synthesis = synthesizeAnalysisStatus({
    gate3a,
    gate3b,
    proc,
    manifest,
    stats,
    target,
    currentSha256,
    observedBudget,
    isBudgetVerified,
    backupDir: options.backupDir
  });

  return {
    status: synthesis.overallStatus,
    statusText: synthesis.statusText,
    details: synthesis.details,
    targetPath: target,
    format,
    arch,
    mode,
    fileSize: stats.size,
    sha256: currentSha256,
    totalSymbols,
    gate3a,
    gate3b,
    isProcessRunning: proc.isRunning,
    isProcessLocked: proc.locked,
    runtimeEvidence: {
      isProcessRunning: proc.isRunning,
      isProcessLocked: proc.locked,
      processPid: proc.pid || null,
      processStartTime: proc.startTimeMs ? new Date(proc.startTimeMs).toISOString() : null,
      patchedAt: manifest ? manifest.patchedAt : null,
      restartDetected: synthesis.restartDetected,
      observedBudget: observedBudget || null,
      budgetVerified: isBudgetVerified
    },
    hasBackup: Boolean(manifest && manifest.backupPath && fs.existsSync(manifest.backupPath)),
    backupInfo: manifest ? {
      origSha256: manifest.origSha256,
      backupPath: manifest.backupPath,
      patchedAt: manifest.patchedAt
    } : null,
    author: AUTHOR_INFO
  };
}

function resignMachOBinary(tmpBinaryPath, origBinaryPath, origMode) {
  const execMode = (origMode & 0o777) ? ((origMode & 0o777) | 0o700) : 0o755;
  fs.chmodSync(tmpBinaryPath, execMode);

  let entTmp = null;
  try {
    try {
      const out = execFileSync('codesign', ['-d', '--entitlements', '-', '--xml', origBinaryPath], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 5000
      });
      const xmlStart = out.indexOf('<?xml');
      const plistEnd = out.lastIndexOf('</plist>');
      if (xmlStart >= 0 && plistEnd > xmlStart) {
        entTmp = `${tmpBinaryPath}.entitlements.plist`;
        fs.writeFileSync(entTmp, out.slice(xmlStart, plistEnd + '</plist>'.length), 'utf8');
      }
    } catch {
      entTmp = null;
    }

    const args = ['-f', '-s', '-'];
    if (entTmp) args.push('--entitlements', entTmp);
    args.push(tmpBinaryPath);
    execFileSync('codesign', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 });
    execFileSync('codesign', ['-v', tmpBinaryPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 5000 });
  } finally {
    if (entTmp && fs.existsSync(entTmp)) {
      try { fs.unlinkSync(entTmp); } catch {}
    }
  }
}

function replaceBinarySafely(targetPath, tmpNewPath, origMode) {
  if (origMode) {
    try { fs.chmodSync(tmpNewPath, origMode & 0o777); } catch {}
  }

  if (process.platform !== 'win32') {
    fs.renameSync(tmpNewPath, targetPath);
    return { usedRenameTrick: false, tmpOldCreated: null };
  }

  try {
    fs.copyFileSync(tmpNewPath, targetPath);
    return { usedRenameTrick: false, tmpOldCreated: null };
  } catch (e) {
    if (e.code === 'EBUSY' || e.code === 'EPERM') {
      const tmpOld = `${targetPath}.old_${Date.now()}`;
      fs.renameSync(targetPath, tmpOld);
      try {
        fs.renameSync(tmpNewPath, targetPath);
        return { usedRenameTrick: true, tmpOldCreated: tmpOld };
      } catch (renameNewErr) {
        try {
          fs.renameSync(tmpOld, targetPath);
        } catch (rollbackErr) {
          throw new Error(`替换新文件失败且回滚原文件失败: ${rollbackErr.message} (原始错误: ${renameNewErr.message})`);
        }
        const wrapped = new Error(`写入新文件失败，已安全回滚原文件: ${renameNewErr.message}`);
        wrapped.alreadyRolledBack = true;
        throw wrapped;
      }
    }
    throw e;
  }
}

/**
 * 执行上下文加长解锁 (Apply)
 */
function applyUnlock(options = {}) {
  const target = options.targetPath || detectTargetBinary();
  const analysis = analyzeBinary(target, options);

  if (analysis.status === 'verified_active' || analysis.status === 'patched_pending_restart' || analysis.status === 'patched_runtime_unconfirmed') {
    return {
      ok: true,
      alreadyPatched: true,
      needsRestart: analysis.status === 'patched_pending_restart',
      message: '目标已经处于解锁状态，无需重复打补丁。',
      analysis
    };
  }

  if (analysis.status !== 'not_patched') {
    return {
      ok: false,
      error: `无法执行解锁：${analysis.details || analysis.reason || '目标不受支持'}`,
      analysis
    };
  }

  const { gate3a, gate3b, arch, format, targetPath, sha256: origSha256, fileSize: origSize } = analysis;
  const origMode = fs.statSync(targetPath).mode;
  const backupDir = getUnlockBackupDir(options.backupDir);
  const backupFile = path.join(backupDir, `${path.basename(targetPath)}_${origSha256.slice(0, 12)}.orig`);

  // 1. 备份原版二进制至外部目录
  try {
    fs.copyFileSync(targetPath, backupFile);
    const backupSha = sha256File(backupFile);
    if (backupSha !== origSha256) {
      if (fs.existsSync(backupFile)) fs.unlinkSync(backupFile);
      return { ok: false, error: '原版备份哈希校验不匹配，操作已中止。' };
    }
  } catch (e) {
    return { ok: false, error: `创建原版备份失败: ${e.message}` };
  }

  // 2. 内存打补丁
  const buf = fs.readFileSync(targetPath);

  // Patch Gate 3A
  if (arch === 'x86-64') {
    buf.set(PATCH_256K_X64, gate3a.offset);
  } else if (arch === 'arm64') {
    const nop6 = Buffer.concat([NOP_ARM64, NOP_ARM64, NOP_ARM64, NOP_ARM64, NOP_ARM64, NOP_ARM64]);
    buf.set(nop6, gate3a.offset);
  }

  // Patch Gate 3B
  if (arch === 'x86-64') {
    const nopCount = gate3b.length || 2;
    buf.fill(0x90, gate3b.offset, gate3b.offset + nopCount);
  } else if (arch === 'arm64') {
    if (gate3b.patchMode === 'tbnz_nop' || gate3b.length === 4) {
      NOP_ARM64.copy(buf, gate3b.offset);
    } else {
      const cbz_x0 = 0xb4000000;
      const str_wzr = 0xb9000c1f;
      const blob = Buffer.alloc(24, 0x1f); // NOPs
      for (let i = 0; i < 24; i += 4) {
        NOP_ARM64.copy(blob, i);
      }
      blob.writeUInt32LE(cbz_x0, 0);
      blob.writeUInt32LE(str_wzr, 4);
      buf.set(blob, gate3b.offset);
    }
  }

  // 3. 安全写盘：macOS 先对临时文件执行保留 entitlements 的 ad-hoc 重签名并计算签名后哈希，再原子替换
  const tmpNew = `${targetPath}.new_${Date.now()}`;
  let patchedSha256;
  let usedRenameTrick = false;
  let tmpOldCreated = null;

  try {
    fs.writeFileSync(tmpNew, buf);

    if (process.platform === 'darwin' && format === 'Mach-O' && !options.skipCodesign) {
      try {
        resignMachOBinary(tmpNew, targetPath, origMode);
      } catch (signErr) {
        return {
          ok: false,
          error: `macOS 代码签名失败，已安全中止（未修改原文件）: ${signErr.message}`
        };
      }
    }

    patchedSha256 = sha256File(tmpNew);
    const swapRes = replaceBinarySafely(targetPath, tmpNew, origMode);
    usedRenameTrick = swapRes.usedRenameTrick;
    tmpOldCreated = swapRes.tmpOldCreated;
  } catch (e) {
    if (e.alreadyRolledBack) {
      return { ok: false, error: e.message };
    }
    const hint = (e.code === 'EACCES' || e.code === 'EPERM')
      ? '请检查目标应用目录写入权限，或确认未锁定后重试。'
      : '若客户端正在运行，请退出 Antigravity 客户端后重试。';
    return {
      ok: false,
      error: `写入补丁失败 (${e.code || e.message})。${hint}`
    };
  } finally {
    if (fs.existsSync(tmpNew)) {
      try { fs.unlinkSync(tmpNew); } catch {}
    }
  }

  // 4. 清理同目录下此前遗留的历史 .old_* 文件（当前刚刚被占用的 tmpOld 除外）
  try {
    cleanupOldReplacedFiles(path.dirname(targetPath), path.basename(targetPath), tmpOldCreated);
  } catch {}

  // 5. 保存持久化清单
  const manifest = {
    targetPath,
    arch,
    format,
    origSha256,
    origSize,
    backupPath: backupFile,
    backupSha256: origSha256,
    patchedSha256,
    gate3bPatchMode: gate3b.patchMode || null,
    gate3bOffset: gate3b.offset,
    gate3bOrigHex: gate3b.origBytes ? Buffer.from(gate3b.origBytes).toString('hex') : null,
    patchedAt: new Date().toISOString(),
    needsRestart: true,
    author: AUTHOR_INFO
  };
  saveManifest(manifest, options.backupDir);

  return {
    ok: true,
    needsRestart: true,
    targetPath,
    beforeSha256: origSha256,
    afterSha256: patchedSha256,
    backupPath: backupFile,
    message: (usedRenameTrick || analysis.isProcessRunning)
      ? '已成功应用上下文加长补丁！由于客户端可能正在运行，请【完全退出并重启 Antigravity 客户端】使新后端生效。'
      : '已成功应用上下文加长补丁！请重启 Antigravity 客户端使新配置生效。'
  };
}

/**
 * 恢复原版二进制 (Restore)
 */
function restoreUnlock(options = {}) {
  const target = options.targetPath || detectTargetBinary();
  const manifest = loadManifest(options.backupDir);

  if (!target || !fs.existsSync(target)) {
    return { ok: false, error: '目标文件不存在，无法恢复' };
  }

  const currentSha256 = sha256File(target);
  const origMode = fs.statSync(target).mode;

  // 1. 如果已有 manifest 且备份有效（原版 .orig 自带官方原始签名，无需重新签名）
  if (manifest && manifest.backupPath && fs.existsSync(manifest.backupPath)) {
    if (normalizeComparePath(manifest.targetPath) !== normalizeComparePath(target)) {
      return { ok: false, error: '安装记录目标与当前恢复目标不一致，拒绝跨路径还原。' };
    }

    const backupSha = sha256File(manifest.backupPath);
    if (backupSha !== manifest.origSha256) {
      return { ok: false, error: '原版备份文件已损坏或被篡改，无法执行还原。' };
    }

    if (currentSha256 === manifest.origSha256) {
      manifest.needsRestart = false;
      saveManifest(manifest, options.backupDir);
      return { ok: true, alreadyRestored: true, message: '当前已经是官方原版，无需重复恢复。' };
    }

    const tmpNew = `${target}.res_${Date.now()}`;
    let usedRename = false;
    let tmpOldCreated = null;
    try {
      fs.copyFileSync(manifest.backupPath, tmpNew);
      const swapRes = replaceBinarySafely(target, tmpNew, origMode);
      usedRename = swapRes.usedRenameTrick;
      tmpOldCreated = swapRes.tmpOldCreated;
    } catch (e) {
      return { ok: false, error: `恢复原版写入失败: ${e.message}。请退出客户端后重试。` };
    } finally {
      if (fs.existsSync(tmpNew)) try { fs.unlinkSync(tmpNew); } catch {}
    }

    try {
      cleanupOldReplacedFiles(path.dirname(target), path.basename(target), tmpOldCreated);
    } catch {}

    manifest.needsRestart = true;
    saveManifest(manifest, options.backupDir);

    return {
      ok: true,
      needsRestart: true,
      message: usedRename
        ? '已成功恢复官方原版二进制！请【完全退出并重启 Antigravity 客户端】生效。'
        : '已成功恢复官方原版二进制！请重启客户端生效。'
    };
  }

  // 2. 无备份文件时：尝试基于已知确定性原版特征逆向还原
  const analysis = analyzeBinary(target, options);
  if (analysis.status === 'not_patched') {
    return { ok: true, alreadyRestored: true, message: '当前已经是官方原版，无需恢复。' };
  }

  if (analysis.gate3a.status === 'patched' && analysis.gate3b.status === 'patched') {
    const buf = fs.readFileSync(target);
    if (analysis.arch === 'x86-64') {
      buf.set(CLAMP_256K_X64, analysis.gate3a.offset);
      if (manifest && manifest.gate3bOrigHex && manifest.gate3bOffset === analysis.gate3b.offset) {
        buf.set(Buffer.from(manifest.gate3bOrigHex, 'hex'), analysis.gate3b.offset);
      } else if ((analysis.gate3b.length || 2) === 2) {
        buf.set(Buffer.from([0x75, 0x08]), analysis.gate3b.offset);
      } else {
        return { ok: false, error: '未找到原版备份文件，且当前 6 字节 Gate 3B 原始跳转偏移未知，拒绝盲目还原。' };
      }
    } else if (analysis.arch === 'arm64') {
      buf.set(CLAMP_256K_ARM64, analysis.gate3a.offset);
      if (manifest && manifest.gate3bOrigHex && manifest.gate3bOffset === analysis.gate3b.offset) {
        buf.set(Buffer.from(manifest.gate3bOrigHex, 'hex'), analysis.gate3b.offset);
      } else if (analysis.gate3b.patchMode === 'tbnz_nop') {
        const off = analysis.gate3b.offset;
        const ldrInsn = buf.readUInt32LE(off + 4);
        const bInsn = buf.readUInt32LE(off + 8);
        const isDirectFallthrough = ((ldrInsn & 0xffc003e0) >>> 0) === 0xf94003e0 && (bInsn >>> 26) === 0x05;
        if (!isDirectFallthrough) {
          return { ok: false, error: '未找到原版备份文件，无法确定 tbnz 原分支偏移，拒绝盲目还原。' };
        }
        buf.writeUInt32LE(0x37000060, off); // tbnz w0, #0, +0xc
      } else {
        const cbz_x1 = 0xb4000001;
        buf.writeUInt32LE(cbz_x1, analysis.gate3b.offset);
      }
    }

    const tmpNew = `${target}.rev_${Date.now()}`;
    let tmpOldCreated = null;
    try {
      fs.writeFileSync(tmpNew, buf);
      if (process.platform === 'darwin' && analysis.format === 'Mach-O' && !options.skipCodesign) {
        resignMachOBinary(tmpNew, target, origMode);
      }
      const swapRes = replaceBinarySafely(target, tmpNew, origMode);
      tmpOldCreated = swapRes.tmpOldCreated;
    } catch (e) {
      return { ok: false, error: `逆向还原写入失败: ${e.message}` };
    } finally {
      if (fs.existsSync(tmpNew)) try { fs.unlinkSync(tmpNew); } catch {}
    }

    try {
      cleanupOldReplacedFiles(path.dirname(target), path.basename(target), tmpOldCreated);
    } catch {}

    return {
      ok: true,
      needsRestart: true,
      message: '已通过确定性逆向特征恢复官方原版！请重启 Antigravity 客户端生效。'
    };
  }

  return { ok: false, error: '未找到原版备份文件，且当前文件特征不匹配已知补丁，拒绝盲目覆盖。' };
}

module.exports = {
  AUTHOR_INFO,
  detectTargetBinary,
  findTextSection,
  findPclntab,
  buildFunctions,
  analyzeBinary,
  analyzeBinaryAsync,
  getRunningLanguageServerInfoAsync,
  cleanupOldReplacedFiles,
  synthesizeAnalysisStatus,
  applyUnlock,
  restoreUnlock,
  getUnlockBackupDir
};
