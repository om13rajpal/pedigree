#!/usr/bin/env bash
# Install pedigree-mcp dependencies for the GitHub Action.
#
# Checks for Python 3.11+, installs uv if missing, syncs the
# pedigree-mcp package, and warns (without failing) if gitsign
# is absent since the ed25519 fallback signer works offline.

set -euo pipefail

MCP_PATH="${1:?Usage: install-deps.sh <path-to-pedigree-mcp>}"

# ── Colours for CI output ────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No colour

log_ok()   { echo -e "${GREEN}[pedigree]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[pedigree]${NC} $*"; }
log_err()  { echo -e "${RED}[pedigree]${NC} $*"; }

# ── Python version check ─────────────────────────────────────────────
PYTHON_MIN_MAJOR=3
PYTHON_MIN_MINOR=11

if ! command -v python3 &>/dev/null; then
    log_err "python3 not found on PATH"
    exit 1
fi

PYTHON_VERSION="$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
PYTHON_MAJOR="${PYTHON_VERSION%%.*}"
PYTHON_MINOR="${PYTHON_VERSION##*.}"

if [[ "${PYTHON_MAJOR}" -lt "${PYTHON_MIN_MAJOR}" ]] || \
   { [[ "${PYTHON_MAJOR}" -eq "${PYTHON_MIN_MAJOR}" ]] && [[ "${PYTHON_MINOR}" -lt "${PYTHON_MIN_MINOR}" ]]; }; then
    log_err "Python ${PYTHON_MIN_MAJOR}.${PYTHON_MIN_MINOR}+ required, found ${PYTHON_VERSION}"
    exit 1
fi

log_ok "Python ${PYTHON_VERSION} found"

# ── Install uv if not present ────────────────────────────────────────
if ! command -v uv &>/dev/null; then
    log_warn "uv not found -- installing via pip"
    python3 -m pip install --quiet uv
fi

UV_VERSION="$(uv --version 2>/dev/null || echo 'unknown')"
log_ok "uv available: ${UV_VERSION}"

# ── Sync pedigree-mcp ────────────────────────────────────────────────
if [[ ! -d "${MCP_PATH}" ]]; then
    log_err "pedigree-mcp path not found: ${MCP_PATH}"
    exit 1
fi

if [[ ! -f "${MCP_PATH}/pyproject.toml" ]]; then
    log_err "No pyproject.toml in ${MCP_PATH}"
    exit 1
fi

log_ok "Installing pedigree-mcp from ${MCP_PATH}"
uv sync --directory "${MCP_PATH}" --quiet

log_ok "pedigree-mcp dependencies installed"

# ── Check for gitsign (optional) ─────────────────────────────────────
if command -v gitsign &>/dev/null; then
    GITSIGN_VERSION="$(gitsign version 2>/dev/null || echo 'unknown')"
    log_ok "gitsign found: ${GITSIGN_VERSION}"
else
    log_warn "gitsign not found -- ed25519 fallback signer will be used"
    log_warn "Install gitsign for Sigstore OIDC signing: https://github.com/sigstore/gitsign"
fi

log_ok "Dependency installation complete"
