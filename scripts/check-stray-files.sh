#!/usr/bin/env bash
# Fail on editor/sed leftovers in git: BSD `sed -i -e` writes `<file>-e`, merges leave `.orig`.
#   scripts/check-stray-files.sh           every tracked file (CI)
#   scripts/check-stray-files.sh --staged  files added in the commit being made (pre-commit)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if [[ "${1:-}" == "--staged" ]]; then
  files="$(git diff --cached --name-only --diff-filter=A)"
else
  files="$(git ls-files)"
fi

# ops/vendor/ holds third-party SDKs exactly as shipped (one ships a .war.bak).
stray="$(grep -E -- '(-[eE]|\.orig|\.bak|\.rej|~)$' <<<"$files" | grep -v '^ops/vendor/' || true)"
if [[ -n "$stray" ]]; then
  echo "Stray backup files (sed -i / merge leftovers). Delete them, or git rm --cached:" >&2
  echo "$stray" | sed 's/^/  /' >&2
  exit 1
fi
