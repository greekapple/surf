# References round: what the user's tab group, YouTube and 66 saved reels change for SWELLO

Status: APPLYING (user: "make a spec and apply it yourself") · 2026-11-02 · lead
Sources (all in `~/Development/swello-design-references/`):
- tab group: Surfline home, Quiver, YouTube "Types of Waves" (Surfing Online), Google Images "waves breaking surfer";
- 66 transcribed Instagram reels from the user's "Claude" collection (`19-instagram-claude/all.md`; 3 had no audio);
- the taste-skill repo (MIT, installed at `~/.claude/skills/taste-skill`).

## 1. Product and design changes
| # | Finding (source) | Change for SWELLO | Owner |
|---|---|---|---|
| 1 | Surfline home: a "your spots this week" grid. Rows = spots, columns = 8 days; each cell a size range ("8–10 ft") + a 3-segment AM/mid/PM rating bar over a soft size-trend curve. Scannable in seconds. | Home's main block becomes this grid for saved spots (plus nearby), built from `spotHour` and the T-064 day logic; dark parts of days are not rated. | product T-067 |
| 2 | Surfline vs ours, Central OB this week: theirs 8–10, 8–12, 8–10, **4–6 (Thu)**, 8–12, 8–12, 6–8, 15–18; ours roughly 3× wider and **no Thursday dip**. | Investigate (engineering T-066 point 2). If ours lacks the dip because of input data, document it; if it's our logic, fix it. | engineering |
| 3 | YouTube "Types of Waves": **spilling** (gradual slope, slow, beginner) vs **plunging** (reef/steep bank, lip pitches, experts). | Done in T-064: `breakerType` (Iribarren/Battjes), in the Call's why and Board Match. Next: show "est. breaker type" on the spot page; widen coverage only with sourced slopes. 3D families (wave-v3) follow the same split. | product (label), wave-v3 |
| 4 | Google Images refs: point-break lines, offshore spray veil, streaky faces, cauliflower foam, crumbly small waves. | Sent to the wave-v3 agent as look targets. | wave-v3 |
| 5 | Reel (AJ, DcEJDHBTyPY), list of "vibe-coded" tells: pure white ground, Inter/Geist, soft radii everywhere, check-mark bullets, em dashes, "it's not X, it's Y", three feature cards, sparkle icons, hover animations on everything, no skeleton loaders, no ToS/privacy. Taste-skill `app-screens.md` agrees: stock Inter + a light ground + white cards = "a well-applied kit, not a product with its own identity". | **De-AI pass 2:** (a) replace ✓/✗ check-mark reasons with words and condition dots; (b) copy audit: no em dashes or "not X, it's Y" in UI text; (c) give SWELLO a face: a ground tinted from its world (sea-foam/sand off-white instead of #ffffff), one data hue on the main series, a SWELLO mark in the shell, and **one element only SWELLO has** on each main screen (the surf-band strip, the wave scale); (d) typeface: see open question. Run taste-skill `inspect.mjs --app` as the check. | product T-067 |
| 6 | Reels on legal hygiene (Alex Yates, Adilet): privacy, terms, cookie/consent, accessibility, image copyright, no fake reviews, fonts not loaded from Google (IP leak), session-replay analytics. | Audit: we have Privacy/Terms pages and self-hosted fonts, no analytics, credited CC photos. Add: a note on localStorage use and third-party services (Esri tiles, Open-Meteo, NOAA/NDBC/CDIP, NWS) on the Privacy page; check contrast and keyboard order with web-design-guidelines. | product T-067 (small) |

## 2. Workflow changes (how we build)
| Finding (reels) | Status / action |
|---|---|
| Give agents authority, run overnight (Aiden Johnston) | Done today: full-autonomy CLAUDE.md + settings deny list. |
| Two-model cross-review: one model builds, another audits (Jack Roberts, "Claudex") | Done: Codex reviews every merge (`tools/review/codex-review.sh`); P0/P1 wake the lead. |
| Worktrees per agent, agents talking to each other (Foundable Devs, Champ McCorkle) | In use: lead + product + engineering terminals, plus the wave-v3 agent in its own worktree. |
| Orchestrator on the best model, cheaper models execute (Thomas Lentine) | Adopt for mechanical subagent work (transcription summaries, test runs): use `model: sonnet` on those Agent calls; keep Opus for design/physics. |
| Give Claude eyes: frames + transcript (Ben Kimball) | Done for this round: yt-dlp + ffmpeg + local whisper.cpp; scripts in `19-instagram-claude/transcribe.sh`. |
| Obsidian as a second brain (Chase AI) | Tonight: the planned linked-notes expansion (spots, buoys, tasks, decisions, components). |
| Design skills (taste-skill, Impeccable, Web Design Guidelines, Apple HIG skills) | taste-skill installed (reviewed: MIT, local scripts). Impeccable and web-design-guidelines already present. Apple HIG skill: optional later (its HIG content is Apple IP). |
| Free "unlimited Claude" routers (OmniRoute, Free LLM API), abliterated models, unofficial phone control | **Not adopted:** account/ToS and security risk, no benefit for this project. |

## 3. Open question (user)
- **Typeface.** On 2026-11-02 you chose Inter-only, and that's live. Your own saved reel and taste-skill both name stock Inter as a top "AI-made" tell. Recommended: keep Inter for numbers and data (it's excellent for tabular figures) and add one distinctive, free, self-hosted face for headings and the brand: General Sans or Satoshi (Fontshare, free licence), or Instrument Sans (OFL). Alternatively keep Inter-only and get the "face" from colour, the mark and the signature elements.

## Acceptance
- Home: weekly grid shipped (1440/390 shots next to Surfline's home grid); dark parts unrated.
- De-AI pass 2: taste-skill `inspect.mjs --app` run on Home and Spot, 0 hard fails reported; copy audit diff; the check-mark reasons replaced.
- Privacy page lists local storage + third-party data sources.
- Thursday-dip investigation written up with numbers.
