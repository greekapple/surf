# Afternoon block (2026-11-03, about 13:45 to 15:15): finish, then improve SWELLO, the vault and Agent City
Status: APPROVED (user, about 13:40: "after finishing the current progressions continue developing and improving either the obsidian vault, agent city or swello improvements, make a spec for this once finished with the current improvements, see you in an hour and a half"). The lead chose the order below. The user is in class, so the lead runs it autonomously within the usual limits (no money, no production deploys, nothing licensed pushed).

## 0. Finish what's running (first)
| Item | Owner | Done when |
|---|---|---|
| Surfer motion (spec 2026-11-03-surfer-motion) | Fable `wave-round3` | t102 motion checks + t104 pass on its branch; real-GPU 60 fps / 1% low ≥ 55; t062 drag and flip fixed; a 4 s GIF at 1440/390 looked at by the lead; merged |
| T-109 UI fixes from the site critique | product `t109-ui` | merged after tsc, tests, build, journeys, t034, and 1440/390 light and dark looked at |

The surfer is merged without the user's eye on the GIF only if it's clearly better than what's live (no jumps, board along its path, rider on the face). Otherwise the GIF waits on the user's return and the merge waits with it.

## 1. SWELLO next (engineering, product): small, verifiable, user-visible
1. **T-110 (engineering): today's Codex P2s.**
   - Compare's new surf ranges are labelled "model estimate" and keep the Hawaiian scale label (c3b7e2f).
   - The Home hero caption keeps the source-freshness labels (stale/saved) (df7d103).
   - Drain the Codex queue (9682084) and fix any P0/P1.
   - Update t062's flip invariant after Fable's camera change.
2. **T-111 (product): spot-page hero ready for cams.**
   - Reuse T-106's `MediaSlot` on the spot page: an own cam first (none yet), then the credited photo, then the drawn wave. Photos stay until cams exist (the user: "ultimately the photos will be replaced with real surf cams").
   - Add a visible "Cams" link row on the spot page, from the 6 verified public cams (T-080), as links, never embeds.
   - No layout jump at 390.
3. **T-112 (engineering): a pass through the dead ends** the critique didn't click: Why, Board Match, Find Spots, the swell and wind map layers, Quiver compare/match, the Personal sub-pages.
   - Fix broken links, empty states with no exit, and numbers that disagree with the spot page.
   - Report what was fixed and what was left.

## 2. Obsidian vault (one agent, Sonnet): bring the vault up to today
- **New or updated notes:**
  - T-100 to T-112;
  - the three specs from today (wave-surfer follow-up, surfer motion, Home round) and this one;
  - decisions: the surfer rides, the AI photo removed, the gentle follow camera, the week grid at midday, offshore energy kept in the rating under its honest name, the board contact gate at 0–20 cm.
- Update the SWELLO hub and Decision Log. Link everything and run the broken-link check (0 broken).
- **Rules:** never touch `99-Private/`; no secrets; factual, from git and handoffs only.

## 3. Agent City (one agent): show today and close round-2 gaps
- **Ingest today:**
  - check that the morning and afternoon merges, the restart and the three new specs show up;
  - check that the restart gap (about 13:20) is compressed, not drawn as a dead hour.
- **Close known gaps:**
  - tags overlap in the densest minutes (declutter by priority with a leader line);
  - trip tags at 390;
  - residents' step-in/out on the animation clock.
- **Verify:** build, 0 console errors, the replay watched, 60 fps.
- Commit in the agent-city repo (still local only; the GitHub repo is waiting on the user).

## Limits
- At most 2 workers busy on SWELLO at once (engineering and product) plus Fable.
- The vault and Agent City agents run one at a time.
- One Codex review per merge.
- 2 correction cycles per task, then stop and report.

## Report when the user is back (in chat, short)
- what merged (with checks);
- what to look at (the surfer GIF path, Home, the spot page);
- what's waiting on the user;
- anything partial, said plainly.
