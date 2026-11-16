#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${ANTIGRAVITY_PLUGINS_REPO:-https://github.com/xinghaix/antigravity-plugins}"
RELEASE_BASE="${REPO_URL}/releases/latest/download"
PLUGINS_HOME="${HOME}/.gemini/config/plugins"

SCRIPT_SOURCE="${BASH_SOURCE[0]:-}"
SCRIPT_DIR=""
if [ -n "${SCRIPT_SOURCE}" ] && [ -f "${SCRIPT_SOURCE}" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${SCRIPT_SOURCE}")" && pwd)"
fi

# 1. Local repository execution
if [ -n "${SCRIPT_DIR}" ] && [ -f "${SCRIPT_DIR}/scripts/cli.mjs" ]; then
  if [ "$#" -eq 0 ]; then
    exec node "${SCRIPT_DIR}/scripts/cli.mjs" install --all --link
  else
    exec node "${SCRIPT_DIR}/scripts/cli.mjs" install "$@"
  fi
fi

# 2. Remote one-line execution (curl -fsSL ... | bash -s -- <plugin-id>|--all)
MODE="copy"
ALL=0
IDS=()
for arg in "$@"; do
  case "$arg" in
    --all|-a) ALL=1 ;;
    --copy|-c) MODE="copy" ;;
    --link|-l) MODE="link" ;;
    --help|-h)
      echo "Usage: curl -fsSL https://raw.githubusercontent.com/xinghaix/antigravity-plugins/main/install.sh | bash -s -- [<plugin-id>... | --all]"
      exit 0
      ;;
    -*)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
    *)
      IDS+=("$arg")
      ;;
  esac
done

if [ "${#IDS[@]}" -eq 0 ]; then
  ALL=1
fi

mkdir -p "${PLUGINS_HOME}"

# Fast path: download per-plugin release archive when specific plugin IDs are requested
if [ "${ALL}" -eq 0 ] && command -v curl >/dev/null 2>&1 && command -v tar >/dev/null 2>&1; then
  REGISTRY_JSON=""
  REGISTRY_URL="https://raw.githubusercontent.com/xinghaix/antigravity-plugins/main/registry.json"
  REGISTRY_JSON="$(curl -fsSL "${REGISTRY_URL}" 2>/dev/null || true)"
  FAILED=0
  for id in "${IDS[@]}"; do
    TMP_ARC="$(mktemp -d)"
    PLUGIN_VER=""
    if [ -n "${REGISTRY_JSON}" ] && command -v node >/dev/null 2>&1; then
      PLUGIN_VER="$(printf '%s' "${REGISTRY_JSON}" | node -e "const fs=require('fs');const d=JSON.parse(fs.readFileSync(0,'utf8'));const p=(d.plugins||[]).find(x=>x.id===process.argv[1]);if(p&&p.version)process.stdout.write(String(p.version));" "${id}" 2>/dev/null || true)"
    fi
    DOWNLOADED=0
    if [ -n "${PLUGIN_VER}" ]; then
      TAG_URL="${REPO_URL}/releases/download/${id}-v${PLUGIN_VER}/${id}.tar.gz"
      if curl -fsSL "${TAG_URL}" -o "${TMP_ARC}/${id}.tar.gz" 2>/dev/null; then
        DOWNLOADED=1
      fi
    fi
    if [ "${DOWNLOADED}" -eq 0 ]; then
      URL="${RELEASE_BASE}/${id}.tar.gz"
      if curl -fsSL "${URL}" -o "${TMP_ARC}/${id}.tar.gz" 2>/dev/null; then
        DOWNLOADED=1
      fi
    fi
    if [ "${DOWNLOADED}" -eq 1 ]; then
      rm -rf "${PLUGINS_HOME:?}/${id}"
      tar -xzf "${TMP_ARC}/${id}.tar.gz" -C "${PLUGINS_HOME}"
      rm -rf "${TMP_ARC}"
      echo "Installed ${id} (release archive) -> ${PLUGINS_HOME}/${id}"
    else
      rm -rf "${TMP_ARC}"
      FAILED=1
      break
    fi
  done
  if [ "${FAILED}" -eq 0 ]; then
    echo "Restart Antigravity (or toggle plugins in Customizations) to activate."
    exit 0
  fi
fi

# Fallback: sparse shallow clone of only requested plugins/<id> (or all)
if ! command -v git >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
  echo "Error: git and node (>=20) are required for fallback installation." >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "${TMP_DIR}"' EXIT

git clone --depth 1 --filter=blob:none --sparse "${REPO_URL}.git" "${TMP_DIR}/repo" >/dev/null 2>&1
if [ "${ALL}" -eq 1 ]; then
  git -C "${TMP_DIR}/repo" sparse-checkout set scripts plugins >/dev/null 2>&1
  node "${TMP_DIR}/repo/scripts/cli.mjs" install --all --copy
else
  SPARSE_PATHS=("scripts")
  for id in "${IDS[@]}"; do
    SPARSE_PATHS+=("plugins/${id}")
  done
  git -C "${TMP_DIR}/repo" sparse-checkout set "${SPARSE_PATHS[@]}" >/dev/null 2>&1
  node "${TMP_DIR}/repo/scripts/cli.mjs" install "${IDS[@]}" --copy
fi
