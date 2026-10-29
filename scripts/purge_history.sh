#!/usr/bin/env bash
# =============================================================================
# ApexSovereign.ai - gated git-history purge for exposed credentials
# =============================================================================
#
# This script rewrites a MIRROR clone, never the active working tree. The push
# phase is withheld unless PURGE_CONFIRM=ROTATION_COMPLETE is set, so a leaked
# credential cannot be erased from history before it has been rotated.
#
# Usage:
#   scripts/purge_history.sh --prepare
#   PURGE_CONFIRM=ROTATION_COMPLETE scripts/purge_history.sh --push
#
# Manifest:
#   scripts/purge_manifest.tsv classifies each of the 19 flagged paths as
#   "remove" (secret stores/build artifacts absent from HEAD) or "scrub"
#   (source/templates whose credential literals are replaced with REDACTED).
#
# Requirements:
#   git
#   git-filter-repo   (pip install git-filter-repo)
#   gitleaks 8.x      (auto-detected, or set GITLEAKS_BIN)
#   python 3.9+
#
# Safety properties:
#   - The active repository is never rewritten.
#   - The remote URL is passed to git but never printed.
#   - Whole-path removal is refused for any path present in the working tree.
#   - Replacement expressions are generated from a local, unredacted Gitleaks
#     report and are never printed.
#   - The rewritten mirror is re-scanned; any remaining finding aborts the run.
#   - The push phase requires an explicit confirmation value.
# =============================================================================
set -euo pipefail
umask 077

CONFIRMATION="ROTATION_COMPLETE"
MODE="prepare"

usage() {
  cat <<'EOF'
Usage: scripts/purge_history.sh [--prepare|--push]

  --prepare  Rewrite a mirror clone, scrub credentials, re-scan, and verify.
             This is the default. Nothing is pushed.
  --push     Perform the rewrite and verification, then force-push all branches
             and tags. Requires PURGE_CONFIRM=ROTATION_COMPLETE.

Environment:
  PURGE_MANIFEST        Manifest path (default: scripts/purge_manifest.tsv)
  PURGE_WORK_ROOT       Mirror workspace (default: <repo>/artifacts/history-purge)
  PURGE_CONFIRM         Must equal ROTATION_COMPLETE for --push
  GITLEAKS_BIN          Path to gitleaks (auto-detected when unset)
  PYTHON_BIN            Python interpreter (auto-detected when unset)
EOF
}

for arg in "$@"; do
  case "$arg" in
    --prepare) MODE="prepare" ;;
    --push) MODE="push" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "[purge] unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

if [ "$MODE" = "push" ] && [ "${PURGE_CONFIRM:-}" != "$CONFIRMATION" ]; then
  echo "[purge] refusing to push: rotation is not confirmed." >&2
  echo "[purge] set PURGE_CONFIRM=$CONFIRMATION only after every exposed" >&2
  echo "[purge] credential has been rotated and the old one is rejected." >&2
  exit 3
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[purge] missing required command: $1" >&2
    exit 1
  fi
}

require_command git

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

MANIFEST="${PURGE_MANIFEST:-$REPO_ROOT/scripts/purge_manifest.tsv}"
if [ ! -f "$MANIFEST" ]; then
  echo "[purge] manifest not found: $MANIFEST" >&2
  exit 1
fi

REMOVE_PATHS=()
SCRUB_PATHS=()
while IFS=$'\t' read -r action path _rest; do
  case "$action" in
    ''|'#'*) continue ;;
  esac
  if [ -z "${path:-}" ]; then
    echo "[purge] manifest row is missing a path: $action" >&2
    exit 2
  fi
  case "$path" in
    /*|*..*)
      echo "[purge] refusing invalid manifest path: $path" >&2
      exit 2
      ;;
  esac
  case "$action" in
    remove) REMOVE_PATHS+=("$path") ;;
    scrub) SCRUB_PATHS+=("$path") ;;
    *)
      echo "[purge] unknown manifest action: $action" >&2
      exit 2
      ;;
  esac
done < "$MANIFEST"

if [ "${#REMOVE_PATHS[@]}" -eq 0 ] && [ "${#SCRUB_PATHS[@]}" -eq 0 ]; then
  echo "[purge] manifest is empty; nothing to do." >&2
  exit 1
fi

# Whole-path deletion is only safe for files that should not exist in HEAD.
for path in "${REMOVE_PATHS[@]}"; do
  if [ -e "$REPO_ROOT/$path" ]; then
    echo "[purge] refusing to remove '$path': it is present in the working tree." >&2
    echo "[purge] classify it as 'scrub' instead so HEAD keeps the file." >&2
    exit 2
  fi
done

HISTORY_PATHS=()
for path in "${REMOVE_PATHS[@]}" "${SCRUB_PATHS[@]}"; do
  if git log --all --oneline -- "$path" | grep -q .; then
    HISTORY_PATHS+=("$path")
  fi
done

if [ "${#HISTORY_PATHS[@]}" -eq 0 ]; then
  echo "[purge] none of the manifest paths are present in local history."
  echo "[purge] nothing to rewrite; no push was attempted."
  exit 0
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "[purge] no 'origin' remote is configured" >&2
  exit 1
fi
REMOTE_URL="$(git remote get-url origin)"

if [ -n "${PYTHON_BIN:-}" ] && command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  :
elif command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  echo "[purge] python is required to parse Gitleaks reports." >&2
  exit 1
fi

if command -v git-filter-repo >/dev/null 2>&1; then
  FILTER_REPO=(git-filter-repo)
elif "$PYTHON_BIN" -c 'import git_filter_repo' >/dev/null 2>&1; then
  FILTER_REPO=("$PYTHON_BIN" -m git_filter_repo)
else
  echo "[purge] git-filter-repo is not installed." >&2
  echo "[purge] install it with: $PYTHON_BIN -m pip install --user git-filter-repo" >&2
  exit 1
fi

if [ -n "${GITLEAKS_BIN:-}" ] && [ -x "$GITLEAKS_BIN" ]; then
  :
elif command -v gitleaks >/dev/null 2>&1; then
  GITLEAKS_BIN="$(command -v gitleaks)"
elif [ -x "$REPO_ROOT/artifacts/tools/gitleaks/gitleaks.exe" ]; then
  GITLEAKS_BIN="$REPO_ROOT/artifacts/tools/gitleaks/gitleaks.exe"
elif [ -x "$REPO_ROOT/artifacts/tools/gitleaks/gitleaks" ]; then
  GITLEAKS_BIN="$REPO_ROOT/artifacts/tools/gitleaks/gitleaks"
else
  echo "[purge] gitleaks 8.x is required to generate and verify scrub rules." >&2
  echo "[purge] set GITLEAKS_BIN to the binary path." >&2
  exit 1
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)-$$"
WORK_ROOT="${PURGE_WORK_ROOT:-$REPO_ROOT/artifacts/history-purge}"
WORK_DIR="$WORK_ROOT/$STAMP"
MIRROR_DIR="$WORK_DIR/repo-mirror.git"
RAW_REPORT="$WORK_DIR/gitleaks-before.json"
POST_REPORT="$WORK_DIR/gitleaks-after.json"
REPLACEMENTS="$WORK_DIR/replacements.txt"
FILTER_LOG="$WORK_DIR/filter-repo.log"

mkdir -p "$WORK_DIR"
chmod 700 "$WORK_ROOT" "$WORK_DIR" 2>/dev/null || true

cleanup() {
  rm -f "$RAW_REPORT" "$POST_REPORT" "$REPLACEMENTS" "$FILTER_LOG"
}
trap cleanup EXIT

scan_gitleaks() {
  local repo="$1"
  local report="$2"
  rm -f "$report"
  set +e
  "$GITLEAKS_BIN" git --no-banner --redact=0 \
    --report-format json --report-path "$report" "$repo" >/dev/null 2>&1
  local status=$?
  set -e
  # gitleaks exits 1 when it finds leaks; 0 when clean. Anything else is fatal.
  if [ "$status" -gt 1 ] || [ ! -s "$report" ]; then
    return 1
  fi
  return 0
}

json_count() {
  "$PYTHON_BIN" - "$1" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    data = json.load(handle)
if not isinstance(data, list):
    raise SystemExit("report is not a JSON array")
print(len(data))
PY
}

echo "[purge] cloning mirror into $MIRROR_DIR (remote URL redacted)"
git clone --mirror "$REMOTE_URL" "$MIRROR_DIR"

BEFORE_COMMITS="$(git -C "$MIRROR_DIR" rev-list --all --count)"
echo "[purge] scanning mirror history with Gitleaks (report stays local)"
if ! scan_gitleaks "$MIRROR_DIR" "$RAW_REPORT"; then
  echo "[purge] FAILED: Gitleaks could not scan the mirror." >&2
  exit 1
fi
BEFORE_COUNT="$(json_count "$RAW_REPORT")"
echo "[purge] historical findings: $BEFORE_COUNT"

echo "[purge] generating replacement expressions (values are never printed)"
"$PYTHON_BIN" - "$RAW_REPORT" "$REPLACEMENTS" <<'PY'
import json
import re
import sys

raw_path, output_path = sys.argv[1], sys.argv[2]
with open(raw_path, encoding="utf-8") as handle:
    findings = json.load(handle)

secrets = {
    str(finding.get("Secret") or "")
    for finding in findings
    if isinstance(finding, dict)
}
# Ignore fragments too short to be credentials; Gitleaks itself reports longer
# values, and a short literal would risk rewriting ordinary prose.
secrets = {secret for secret in secrets if len(secret) >= 12}

lines = []
# Known envelope-encoded key material. Gitleaks can report the decoded PEM
# block while the repository stores a short base64 placeholder, so the decoded
# literal is not present in the blob. Redact the assignment line itself.
lines.extend(
    [
        "regex:(?m)^AURAPHARM_ED25519_PRIVATE_KEY_B64=.*$"
        "==>AURAPHARM_ED25519_PRIVATE_KEY_B64=REDACTED",
        "regex:(?m)^AURAPHARM_ED25519_PUBLIC_KEY_B64=.*$"
        "==>AURAPHARM_ED25519_PUBLIC_KEY_B64=REDACTED",
    ]
)

for secret in sorted(secrets, key=len, reverse=True):
    pattern = re.escape(secret)
    # re.escape() represents a newline as backslash + newline. Convert that
    # pair first; otherwise the replacement would look for a literal "\n".
    pattern = (
        pattern.replace("\\\r\n", r"\r\n")
        .replace("\\\n", r"\n")
        .replace("\\\r", r"\r")
    )
    pattern = pattern.replace("\r", r"\r").replace("\n", r"\n")
    # git-filter-repo splits expressions on "==>"; make any literal '=' safe.
    pattern = pattern.replace("=", r"\x3d")
    if "\n" in secret or "\r" in secret:
        pattern = "(?s)" + pattern
    lines.append(f"regex:{pattern}==>REDACTED")

with open(output_path, "w", encoding="utf-8", newline="\n") as handle:
    if lines:
        handle.write("\n".join(lines) + "\n")

print(len(lines))
PY
REPLACEMENT_COUNT="$(wc -l < "$REPLACEMENTS" | tr -d ' ')"
echo "[purge] replacement expressions: $REPLACEMENT_COUNT"

if [ "$BEFORE_COUNT" -gt 0 ] && [ "$REPLACEMENT_COUNT" -eq 0 ]; then
  echo "[purge] FAILED: findings exist but no replacement expressions were produced." >&2
  exit 1
fi

echo "[purge] rewriting mirror with git-filter-repo"
FILTER_ARGS=(--force --replace-text "$REPLACEMENTS")
if [ "${#REMOVE_PATHS[@]}" -gt 0 ]; then
  for path in "${REMOVE_PATHS[@]}"; do
    FILTER_ARGS+=(--path "$path")
  done
  FILTER_ARGS+=(--invert-paths)
fi

(
  cd "$MIRROR_DIR"
  "${FILTER_REPO[@]}" "${FILTER_ARGS[@]}"
) > "$FILTER_LOG" 2>&1 || {
  echo "[purge] git-filter-repo failed; last redacted lines:" >&2
  sed -E 's#https?://[^[:space:]]+#[REDACTED_URL]#g' "$FILTER_LOG" | tail -40 >&2
  exit 1
}

# git-filter-repo detaches the origin remote to prevent accidental pushes.
if ! git -C "$MIRROR_DIR" remote get-url origin >/dev/null 2>&1; then
  git -C "$MIRROR_DIR" remote add origin "$REMOTE_URL"
fi

echo "[purge] pruning unreachable objects in the mirror"
git -C "$MIRROR_DIR" reflog expire --expire=now --all
git -C "$MIRROR_DIR" gc --prune=now

echo "[purge] verifying removed paths are absent from every ref"
for path in "${REMOVE_PATHS[@]}"; do
  if git -C "$MIRROR_DIR" log --all --oneline -- "$path" | grep -q .; then
    echo "[purge] FAILED: $path is still reachable from a ref" >&2
    exit 1
  fi
  if git -C "$MIRROR_DIR" rev-list --all --objects \
    | awk -v target="$path" '{ candidate=$0; sub(/^[^ ]+ /, "", candidate); if (candidate == target) found=1 } END { exit found ? 0 : 1 }'; then
    echo "[purge] FAILED: $path is still present in reachable objects" >&2
    exit 1
  fi
done

echo "[purge] re-scanning rewritten mirror for remaining credentials"
if ! scan_gitleaks "$MIRROR_DIR" "$POST_REPORT"; then
  echo "[purge] FAILED: Gitleaks could not scan the rewritten mirror." >&2
  exit 1
fi
AFTER_COUNT="$(json_count "$POST_REPORT")"
AFTER_COMMITS="$(git -C "$MIRROR_DIR" rev-list --all --count)"

if [ "$AFTER_COUNT" -ne 0 ]; then
  echo "[purge] FAILED: $AFTER_COUNT credential findings remain after rewrite." >&2
  echo "[purge] no push was attempted." >&2
  exit 1
fi

echo "[purge] verification passed"
echo "[purge]   commits: $BEFORE_COMMITS -> $AFTER_COMMITS"
echo "[purge]   findings: $BEFORE_COUNT -> 0"
echo "[purge]   removed paths: ${#REMOVE_PATHS[@]}"
echo "[purge]   scrubbed paths: ${#SCRUB_PATHS[@]}"

if [ "$MODE" != "push" ]; then
  echo "[purge] prepare complete. Push phase withheld."
  echo "[purge] mirror retained for audit: $MIRROR_DIR"
  echo "[purge] after rotation is confirmed, run:"
  echo "         PURGE_CONFIRM=$CONFIRMATION $0 --push"
  exit 0
fi

if [ "${PURGE_CONFIRM:-}" != "$CONFIRMATION" ]; then
  echo "[purge] refusing to push: rotation is not confirmed." >&2
  echo "[purge] set PURGE_CONFIRM=$CONFIRMATION only after every exposed" >&2
  echo "[purge] credential has been rotated and the old one is rejected." >&2
  exit 3
fi

echo "[purge] force-pushing rewritten branches"
git -C "$MIRROR_DIR" push --force --all origin

echo "[purge] force-pushing rewritten tags"
git -C "$MIRROR_DIR" push --force --tags origin

cat <<EOF
[purge] push complete.

Post-push steps (not automated):
  1. Delete or force-update stale Dependabot branches that still point at the
     old history.
  2. Ask GitHub Support to purge cached/unreachable objects and resolve any
     secret-scanning alerts.
  3. Treat every existing clone and CI cache as compromised.
  4. Verify from a fresh clone:
       git log --all --oneline -- .env.production
     The output must be empty, and a full Gitleaks scan must report 0 findings.
EOF
