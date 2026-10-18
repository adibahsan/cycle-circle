#!/usr/bin/env bash
# Run under bash 5.2 (reproduces patsub_replacement): docker run --rm -v "$PWD":/w -w /w bash:5.2 bash ops/deploy/scripts/test-install-vesta-crontab.sh
set -euo pipefail

if [ "${BASH_VERSINFO[0]}" -lt 5 ] || { [ "${BASH_VERSINFO[0]}" -eq 5 ] && [ "${BASH_VERSINFO[1]}" -lt 2 ]; }; then
  echo "NOTE: bash ${BASH_VERSION} does not exercise patsub_replacement; run ops:test:docker"
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_CRONTAB="${HERE}/../vesta-crontab"
INSTALLER="${HERE}/install-vesta-crontab.sh"

T=$(mktemp -d)
trap 'rm -rf "$T"' EXIT

SECRET='ab&cd/ef\gh'
mkdir -p "$T/ops/deploy" "$T/bin"
cp "$SRC_CRONTAB" "$T/ops/deploy/vesta-crontab"
printf 'CRON_SECRET=%s\n' "$SECRET" > "$T/.env.web.production"

# NOTE: this sudo stub is a no-op, so it deliberately hides chown/permission problems; those are not tested here.
printf '#!/bin/sh\nexit 0\n' > "$T/bin/sudo"
cat > "$T/bin/crontab" <<EOF
#!/bin/sh
if [ "\$1" = "-l" ]; then cat "$T/installed"; else cp "\$1" "$T/installed"; fi
EOF
chmod +x "$T/bin/sudo" "$T/bin/crontab"

PATH="$T/bin:$PATH" REPO_ROOT="$T" bash "$INSTALLER" >/dev/null

fail=0
nsched=0
while IFS= read -r line; do
  case "$line" in
    [0-9]*)
      nsched=$((nsched + 1))
      case "$line" in *CRON_SECRET_PLACEHOLDER*) echo "FAIL: placeholder left: $line"; fail=1;; esac
      # Only the jobs that carry the secret must contain it byte-for-byte.
      ;;
  esac
done < "$T/installed"

# Lines that had the placeholder in source must contain the literal secret.
while IFS= read -r src; do
  case "$src" in
    [0-9]*CRON_SECRET_PLACEHOLDER*)
      expected=${src//CRON_SECRET_PLACEHOLDER/"$SECRET"}
      if ! grep -qxF -- "$expected" "$T/installed"; then
        echo "FAIL: secret not literal for: $src"; fail=1
      fi;;
  esac
done < "$SRC_CRONTAB"

# Hard-coded literal check, independent of the substitution logic above.
n=$(grep -cF -- 'Bearer ab&cd/ef\gh"' "$T/installed" || true)
if [ "$n" -ne 3 ]; then
  echo "FAIL: expected exactly 3 lines with literal secret, got $n"; fail=1
fi

# Non-schedule lines unchanged.
grep -v '^[0-9]' "$SRC_CRONTAB" > "$T/src.rest"
grep -v '^[0-9]' "$T/installed" > "$T/out.rest"
if ! cmp -s "$T/src.rest" "$T/out.rest"; then
  echo "FAIL: non-schedule lines changed"; fail=1
fi

[ "$nsched" -gt 0 ] || { echo "FAIL: no schedule lines installed"; fail=1; }

if [ "$fail" -eq 0 ]; then echo "PASS (bash ${BASH_VERSION})"; else echo "FAIL (bash ${BASH_VERSION})"; exit 1; fi
