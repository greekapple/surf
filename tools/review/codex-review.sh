#!/bin/bash
# Codex (ChatGPT plan) reviews one commit — by default the merge just made — and saves the review to docs/reviews/.
# Runs automatically after `git merge` (PostToolUse hook in .claude/settings.json). Stops for the day once the plan's usage
# limit is hit (marker file), so it never blocks work. Exit 2 = Codex found P0/P1 issues (wakes Claude); 0 otherwise.
set -u
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 0
# resolve the commit where we are (a worktree's HEAD is its own branch), THEN move to the main checkout,
# where Codex can read .git (worktree commits live in the shared repo)
SHA=$(git rev-parse --short "${1:-HEAD}" 2>/dev/null) || exit 0
cd "$(dirname "$(cd "$(git rev-parse --git-common-dir)" && pwd)")" || exit 0
MARK="$(git rev-parse --git-common-dir)/codex-usage-limit"
[ -f "$MARK" ] && [ "$(cat "$MARK")" = "$(date +%F)" ] && { echo "codex review skipped: usage limit reached today"; exit 0; }
command -v codex >/dev/null || { echo "codex review skipped: codex CLI not found"; exit 0; }
OUT="docs/reviews/$(date +%F)-$SHA.md"; RAW=$(mktemp)
TITLE=$(git log -1 --format=%s "$SHA")
codex review --commit "$SHA" --title "$TITLE" >"$RAW" 2>&1; rc=$?
# only a failed run that says so counts as the usage limit (a review may mention "rate limit" in the code it reviews)
if [ "$rc" -ne 0 ] && grep -qiE "usage limit|rate limit|quota|too many requests|exceeded your|429" "$RAW"; then
  date +%F > "$MARK"; echo "codex review skipped: ChatGPT usage limit reached (will retry tomorrow)"; rm -f "$RAW"; exit 0
fi
# keep Codex's final message (after its last 'codex' marker line); fall back to the tail
SUMMARY=$(awk '/^codex$/{buf=""; next} {buf=buf $0 "\n"} END{printf "%s", buf}' "$RAW")
[ -z "$SUMMARY" ] && SUMMARY=$(tail -40 "$RAW")
{ echo "# Codex review: $SHA"; echo; echo "- Commit: $TITLE"; echo "- Date: $(date '+%F %H:%M')"; echo "- codex exit: $rc"; echo; echo "$SUMMARY"; } > "$OUT"
rm -f "$RAW"
echo "codex review saved: $OUT"
if echo "$SUMMARY" | grep -qE "\[P0\]|\[P1\]|P0:|P1:|\bP0\b|\bP1\b"; then echo "$SUMMARY" | head -40 >&2; exit 2; fi
exit 0
