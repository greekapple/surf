#!/bin/bash
# PreToolUse guard for `git push`: the repo is PUBLIC, so block a push whose outgoing commits contain licensed (TurboSquid)
# meshes or anything derived from them. Exit 2 = block with a message Claude sees; 0 = allow.
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 0
PATTERN='(turbosquid|public/media/scale3d-live/.*\.(glb|bin)$|public/media/scale3d-atlas/|\.fbx$)'
bad=""
for ref in $(git for-each-ref --format='%(refname:short)' refs/heads); do
  up=$(git rev-parse --abbrev-ref "$ref@{upstream}" 2>/dev/null || echo origin/surf-history)
  files=$(git log --name-only --format= "$up..$ref" 2>/dev/null | grep -E "$PATTERN" | sort -u)
  [ -n "$files" ] && bad="$bad\n$ref: $(echo "$files" | head -5 | tr '\n' ' ')"
done
if [ -n "$bad" ]; then
  printf 'BLOCKED: outgoing commits contain licensed/derived assets (public repo). Scrub them from history first:%b\n' "$bad" >&2
  exit 2
fi
exit 0
