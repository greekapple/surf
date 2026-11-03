#!/bin/bash
# Replays new first-parent commits of the local integration branch (old history, which still contains licensed GLBs in
# early commits) onto the scrubbed public line as tree snapshots. Content is identical; worker-branch topology is not kept.
# Usage: tools/review/port-to-clean.sh [source=forecast-trust] [clean=swello-v0.17]
# State: <git-common-dir>/clean-port-last holds the last ported source commit. Refuses any tree with licensed paths.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
SRC="${1:-forecast-trust}"; CLEAN="${2:-swello-v0.17}"
MARK="$(git rev-parse --git-common-dir)/clean-port-last"
PATTERN='(turbosquid|public/media/scale3d-live/.*\.(glb|bin)$|public/media/scale3d-atlas/|\.fbx$)'
[ -f "$MARK" ] || { echo "no $MARK: write the source commit that matches the clean tip first" >&2; exit 1; }
last=$(cat "$MARK")
[ "$(git rev-parse "$last^{tree}")" = "$(git rev-parse "$CLEAN^{tree}")" ] \
  || { echo "clean tip tree != tree of $last; refusing (state out of sync)" >&2; exit 1; }
n=0; tip=$(git rev-parse "$CLEAN")
for c in $(git rev-list --reverse --first-parent "$last..$SRC"); do
  tree=$(git rev-parse "$c^{tree}")
  if git ls-tree -r --name-only "$tree" | grep -Eq "$PATTERN"; then
    echo "commit $c tracks licensed/derived files; stopping" >&2; exit 2
  fi
  msg="$(git log -1 --format=%B "$c")

Ported-from: $(git rev-parse --short "$c")"
  tip=$(GIT_AUTHOR_NAME="$(git log -1 --format=%an "$c")" GIT_AUTHOR_EMAIL="$(git log -1 --format=%ae "$c")" \
        GIT_AUTHOR_DATE="$(git log -1 --format=%aD "$c")" git commit-tree "$tree" -p "$tip" -m "$msg")
  last=$c; n=$((n+1))
done
git update-ref "refs/heads/$CLEAN" "$tip"
echo "$last" > "$MARK"
echo "ported $n commit(s) onto $CLEAN; tip $(git rev-parse --short "$tip")"
