#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="/data/.openclaw/workspace"
REPO_DIR="$WORKSPACE/integrations/agent4science/publish/JamesWorkspace"
TARGET_DIR="$REPO_DIR/workspace-backup/current"
TOKEN_FILE="/data/.config/github-james/token"
REMOTE_URL="https://github.com/Sky273/JamesWorkspace.git"

if [[ ! -d "$REPO_DIR/.git" ]]; then
  echo "Backup repo not found at $REPO_DIR" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"

python3 - <<'PY'
from pathlib import Path
import shutil

workspace = Path('/data/.openclaw/workspace').resolve()
repo_dir = (workspace / 'integrations/agent4science/publish/JamesWorkspace').resolve()
target = (repo_dir / 'workspace-backup/current').resolve()

exclude_abs = {
    repo_dir,
}


def is_excluded(path: Path) -> bool:
    try:
        rel = path.relative_to(workspace)
    except ValueError:
        return True
    parts = rel.parts
    if '.git' in parts:
        return True
    for ex in exclude_abs:
        if path == ex or ex in path.parents:
            return True
    return False

# Build source inventory and copy files.
seen_files = set()
seen_dirs = {target}
for src in workspace.rglob('*'):
    src = src.resolve()
    if is_excluded(src):
        continue
    rel = src.relative_to(workspace)
    dst = target / rel
    if src.is_dir():
        dst.mkdir(parents=True, exist_ok=True)
        seen_dirs.add(dst)
    elif src.is_file():
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        seen_files.add(dst)
        seen_dirs.add(dst.parent)

# Remove files/dirs that no longer exist in source snapshot.
for existing in sorted(target.rglob('*'), reverse=True):
    if existing.is_file() and existing not in seen_files:
        existing.unlink()
    elif existing.is_dir() and existing not in seen_dirs:
        shutil.rmtree(existing)
PY

UTC_NOW="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
LOCAL_DATE="$(date +%Y-%m-%d)"
MANIFEST="$REPO_DIR/workspace-backup/manifest.md"
cat > "$MANIFEST" <<EOF
# James workspace backup

- Local date: $LOCAL_DATE
- Created at (UTC): $UTC_NOW
- Source: /data/.openclaw/workspace
- Repo: $REMOTE_URL

This private repository is intended to contain the full workspace backup, including sensitive files when present.
EOF

cd "$REPO_DIR"
git config user.name 'James'
git config user.email 'james@agent4science.local'
git add workspace-backup

if git diff --cached --quiet; then
  echo "No changes to back up."
  exit 0
fi

git commit -m "Workspace backup $LOCAL_DATE"
TOKEN="$(cat "$TOKEN_FILE")"
git push "https://x-access-token:${TOKEN}@github.com/Sky273/JamesWorkspace.git" main

echo "Backup completed for $LOCAL_DATE"
