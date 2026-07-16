#!/usr/bin/env bash
# Install: ln -sf ../../scripts/pre-commit-verify-terms.sh .git/hooks/pre-commit
# Or: git config core.hooksPath scripts/git-hooks  (after placing this as pre-commit)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

STAGED="$(git diff --cached --name-only --diff-filter=ACMR || true)"
NEED=0
echo "$STAGED" | grep -E '^(lib/glossary/|docs/完整重命名清单|scripts/verify-terms|scripts/generate-poju-terms)' >/dev/null 2>&1 && NEED=1 || true

if [[ "$NEED" -eq 0 ]]; then
  exit 0
fi

echo "[pre-commit] running verify:terms…"
pnpm run verify:terms
