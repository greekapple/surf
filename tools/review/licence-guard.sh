#!/bin/bash
# PreToolUse guard for `git push` (hook stdin = the tool call JSON). The repo is PUBLIC: block a push whose OUTGOING commits
# contain licensed (TurboSquid) meshes or anything derived from them. Fails closed: if the outgoing range can't be
# determined, the push is blocked. Only the refs being pushed are inspected. Exit 2 = block (message to Claude); 0 = allow.
cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || { echo "BLOCKED: licence guard can't find the repo" >&2; exit 2; }
PATTERN='(turbosquid|public/media/scale3d-live/.*\.(glb|bin)$|public/media/scale3d-atlas/|\.fbx$)'
cmd=$(python3 -c 'import json,sys
try: print(json.load(sys.stdin).get("tool_input",{}).get("command",""))
except Exception: print("")' 2>/dev/null)
# normalise shell spelling before detection (Codex P1s on 9e3099b, 92f176d): delete backslash-newline continuations exactly as
# the shell does (no space, so `foo\<newline>bar` is one word `foobar`) and drop quotes,
# so `git 'push'`, `git "push"` and `git \<newline> push` are all seen as a push
# A comment ending in a backslash does NOT continue (bash runs the next line), so joining would hide the next line's push
# (Codex P1 on 88ae04d): any command with both a continuation and a '#' is checked strictly, and detection also runs on the unjoined text.
raw=$cmd
cmd=$(printf '%s' "$raw" | python3 -c 'import sys,re; s=sys.stdin.read(); s=re.sub(r"\\\r?\n","",s); print(s.replace("\x27","").replace("\"",""), end="")')
split=$(printf '%s' "$raw" | python3 -c 'import sys,re; s=sys.stdin.read(); s=re.sub(r"\\\r?\n","\n",s); print(s.replace("\x27","").replace("\"",""), end="")')
forcestrict=0; printf '%s' "$raw" | grep -q '\\$' && printf '%s' "$raw" | grep -q '#' && forcestrict=1
# only act on commands that could run a push (the hook may be invoked for other Bash calls)
# (a `git … push` within one shell segment, or a --push flag such as `gh repo create --push`; JS `arr.push(` and prose don't count)
PUSH_RE='(^|[^[:alnum:]_.-])git([[:space:]]+(-C|-c|--git-dir|--work-tree)[[:space:]]+[^[:space:]]+|[[:space:]]+-[^[:space:]]+)*[[:space:]]+push([[:space:]]|$)|--push([[:space:]=]|$)'
{ printf '%s' "$cmd" | tr ';&|' '\n\n\n' | grep -Eq "$PUSH_RE" || printf '%s' "$split" | tr ';&|' '\n\n\n' | grep -Eq "$PUSH_RE"; } || exit 0

# strict mode for anything not a single plain `git push <remote> <refs>`: --all/--mirror/--tags, several pushes, git global
# options before `push` (e.g. -C), aliases or scripts. Then every local branch ahead of its remote base must be clean (fails closed).
npush=$(printf '%s' "$cmd" | grep -Eo '(^|[^[:alnum:]_-])push([^[:alnum:]_-]|$)' | wc -l | tr -d ' ')
if [ "$forcestrict" = 1 ] || [ "$npush" != "1" ] || ! printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])git[[:space:]]+push([[:space:]]|$)' \
   || printf '%s' "$cmd" | grep -Eq -- '--(all|mirror|tags|follow-tags)' \
   || [ "$(printf '%s' "$cmd" | sed -n 's/.*git[[:space:]]\{1,\}push\(.*\)/\1/p' | sed 's/[;&|].*//' | tr ' ' '\n' | grep -v '^-' | grep -v '[<>]' | grep -c .)" -lt 2 ]; then
  # (no explicit refspec: push.default / remote.<name>.push decide what goes out, so check every branch)
  git fetch -q --all 2>/dev/null
  # every local branch AND tag (a tag can carry commits no branch has; engineering, on 7c39504): what isn't on origin yet would go out
  for ref in $(git for-each-ref --format='%(refname)' refs/heads refs/tags); do
    files=$(git log --name-only --format= "$ref" --not --remotes=origin) || { echo "BLOCKED: licence guard (strict) couldn't read '$ref'" >&2; exit 2; }
    hit=$(printf '%s\n' "$files" | grep -E "$PATTERN" | sort -u | head -3)
    [ -n "$hit" ] && { printf 'BLOCKED: this form is checked strictly and local %s carries licensed/derived assets; send one clean branch explicitly (git <upload> origin <branch>) or scrub history:\n%s\n' "${ref#refs/}" "$hit" >&2; exit 2; }
  done
  exit 0
fi
# the push part of the command: words after "push" up to the next shell separator
pushpart=$(printf '%s' "$cmd" | sed -n 's/.*git[[:space:]]\{1,\}push\(.*\)/\1/p' | sed 's/[;&|].*//')
args=(); for w in $pushpart; do case "$w" in -*|*'>'*|*'<'*) ;; *) args+=("$w");; esac; done  # skip options and redirections (2>&1, >file)
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
