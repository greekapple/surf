#!/bin/bash
# Codex (ChatGPT plan) reviews one commit — by default the merge just made — and saves the review to docs/reviews/.
# Runs automatically after `git merge` (PostToolUse hook in .claude/settings.json). Stops for the day once the plan's usage
# limit is hit (marker file), so it never blocks work. Exit 2 = Codex found P0/P1 issues (wakes Claude); 0 otherwise.
set -u
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 0
# resolve the commit where we are (a worktree's HEAD is its own branch), THEN move to the main checkout,
# where Codex can read .git (worktree commits live in the shared repo)
SHA=HEAD; [ "${1:-}" = "--drain" ] || { SHA=$(git rev-parse --short "${1:-HEAD}" 2>/dev/null) || exit 0; }
cd "$(dirname "$(cd "$(git rev-parse --git-common-dir)" && pwd)")" || exit 0
MARK="$(git rev-parse --git-common-dir)/codex-usage-limit"   # epoch of the last limit hit (the plan's window is ~5 h)
QUEUE="$(git rev-parse --git-common-dir)/codex-pending"      # commits skipped at the limit, reviewed later with --drain
if [ "${1:-}" = "--drain" ]; then   # review every queued commit once the limit has reset
  [ -s "$QUEUE" ] || { echo "codex queue empty"; exit 0; }
  rc_all=0; cp "$QUEUE" "$QUEUE.run"; : > "$QUEUE"
  while read -r q; do [ -n "$q" ] && { "$0" "$q"; r=$?; [ $r -gt $rc_all ] && rc_all=$r; }; done < "$QUEUE.run"
  rm -f "$QUEUE.run"; exit $rc_all
fi
last=$(cat "$MARK" 2>/dev/null); case "$last" in ''|*[!0-9]*) last=0;; esac
if [ $(( $(date +%s) - last )) -lt 3600 ]; then   # retry at most hourly after a limit hit
  grep -qx "$SHA" "$QUEUE" 2>/dev/null || echo "$SHA" >> "$QUEUE"
  echo "codex review deferred: usage limit hit $(( ($(date +%s) - last) / 60 )) min ago; queued $SHA (run with --drain later)"; exit 0
fi
command -v codex >/dev/null || { echo "codex review skipped: codex CLI not found"; exit 0; }
OUT="docs/reviews/$(date +%F)-$SHA.md"; RAW=$(mktemp)
TITLE=$(git log -1 --format=%s "$SHA")
codex review --commit "$SHA" --title "$TITLE" >"$RAW" 2>&1; rc=$?
# only a failed run that says so counts as the usage limit (a review may mention "rate limit" in the code it reviews)
if [ "$rc" -ne 0 ] && grep -qiE "usage limit|rate limit|quota|too many requests|exceeded your|429" "$RAW"; then
  date +%s > "$MARK"; grep -qx "$SHA" "$QUEUE" 2>/dev/null || echo "$SHA" >> "$QUEUE"
  echo "codex review deferred: ChatGPT usage limit reached; queued $SHA, retrying hourly ($(grep -oiE 'try again[^.]*' "$RAW" | head -1))"; rm -f "$RAW"; exit 0
fi
# keep Codex's final message (after its last 'codex' marker line); fall back to the tail
SUMMARY=$(awk '/^codex$/{buf=""; next} {buf=buf $0 "\n"} END{printf "%s", buf}' "$RAW")
[ -z "$SUMMARY" ] && SUMMARY=$(tail -40 "$RAW")
{ echo "# Codex review: $SHA"; echo; echo "- Commit: $TITLE"; echo "- Date: $(date '+%F %H:%M')"; echo "- codex exit: $rc"; echo; echo "$SUMMARY"; } > "$OUT"
rm -f "$RAW"
echo "codex review saved: $OUT"
if echo "$SUMMARY" | grep -qE "\[P0\]|\[P1\]|P0:|P1:|\bP0\b|\bP1\b"; then echo "$SUMMARY" | head -40 >&2; exit 2; fi
exit 0
