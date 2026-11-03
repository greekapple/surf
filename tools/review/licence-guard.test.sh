#!/bin/bash
# licence-guard cases. Expected exit codes are in brackets; prints OK/BAD per case.
cd "$(git rev-parse --show-toplevel)"
g=tools/review/licence-guard.sh
P=$(printf '%s' 'pu' 'sh')
j(){ python3 -c 'import json,sys;print(json.dumps({"tool_input":{"command":sys.argv[1]}}))' "$1"; }
t(){ j "$2" | $g >/dev/null 2>&1; r=$?; [ "$r" = "$1" ] && s=OK || s=BAD; echo "$s $r (want $1) <- $(printf '%s' "$2" | tr '\n' '~' | cut -c1-70)"; }
t 0 "git $P origin swello-v0.17"
t 0 "git $P origin swello-v0.17 2>&1"
t 2 "git $P origin rebuild/swello-v0.16"
t 2 "git $P --all"
t 2 "git $P origin"
t 2 "git -C . $P origin rebuild/swello-v0.16"
t 2 "gh repo create x --private --source . --$P"
t 2 "git '$P' origin rebuild/swello-v0.16"
t 2 "git \"$P\" origin rebuild/swello-v0.16"
t 2 "git \\
$P origin rebuild/swello-v0.16"
t 0 "git '$P' origin swello-v0.17"
t 0 "cat > a.js <<'EOF'
const a=[]; a.$P(1); // git log
EOF"
t 0 "git commit -m 'guard: ignore $P in prose'"
# a continuation joins words with no space, as the shell does (Codex P1 on 92f176d)
t 0 "git $P origin swello-v0.\\
17"
t 2 "git $P origin rebuild/swello-v0.\\
16"
t 0 "ls"
