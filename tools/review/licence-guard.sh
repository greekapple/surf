#!/bin/bash
# PreToolUse guard for `git push` (hook stdin = the tool call JSON). The repo is PUBLIC: block a push whose OUTGOING commits
# contain licensed (TurboSquid) meshes or anything derived from them. Fails closed: if the outgoing range can't be
# determined, the push is blocked. Only the refs being pushed are inspected. Exit 2 = block (message to Claude); 0 = allow.
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || { echo "BLOCKED: licence guard can't find the repo" >&2; exit 2; }
PATTERN='(turbosquid|public/media/scale3d-live/.*\.(glb|bin)$|public/media/scale3d-atlas/|\.fbx$)'
cmd=$(python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("tool_input",{}).get("command",""))
except Exception: print("")' 2>/dev/null)
# only act on commands that actually run a push (the hook may be invoked for other Bash calls)
printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+push([[:space:]]|$)' || exit 0
# the push part of the command: words after "push" up to the next shell separator
pushpart=$(printf '%s' "$cmd" | sed -n 's/.*git[[:space:]]\{1,\}push\(.*\)/\1/p' | sed 's/[;&|].*//')
args=(); for w in $pushpart; do case "$w" in -*) ;; *) args+=("$w");; esac; done
remote="${args[0]:-origin}"
refs=("${args[@]:1}"); [ ${#refs[@]} -eq 0 ] && refs=("$(git rev-parse --abbrev-ref HEAD)")
git fetch -q "$remote" 2>/dev/null
for spec in "${refs[@]}"; do
  src="${spec%%:*}"; dst="${spec##*:}"; [ "$src" = "HEAD" ] && src=$(git rev-parse --abbrev-ref HEAD)
  git rev-parse --verify -q "$src^{commit}" >/dev/null || { echo "BLOCKED: licence guard can't resolve '$src' (fails closed)" >&2; exit 2; }
  base=""
  for cand in "$remote/$dst" "$remote/$src" "$remote/surf-history" "$remote/HEAD"; do
    git rev-parse --verify -q "$cand^{commit}" >/dev/null && { base="$cand"; break; }
  done
  [ -z "$base" ] && { echo "BLOCKED: licence guard can't find a remote base for '$src' (fails closed)" >&2; exit 2; }
  files=$(git log --name-only --format= "$base..$src") || { echo "BLOCKED: licence guard couldn't read the history of '$src'" >&2; exit 2; }
  hit=$(printf '%s\n' "$files" | grep -E "$PATTERN" | sort -u | head -5)
  if [ -n "$hit" ]; then
    printf 'BLOCKED: pushing %s would publish licensed/derived assets (public repo); scrub them from its history first:\n%s\n' "$src" "$hit" >&2
    exit 2
  fi
done
exit 0
