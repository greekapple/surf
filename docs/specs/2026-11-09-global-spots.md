# Global spot expansion, overnight (2026-11-09)

User, before bed:
- "expand this spot finding across the globe, make a spec";
- "use Fable when you need";
- "use the agent worktrees and other terminals as well as the git trees";
- "use references per usual, make the Obsidian more extensive";
- "overnight I should see more reference for data of spots in Obsidian and spot growth in exponential numbers";
- "gather as much data as possible; obviously don't make random estimates, but anywhere you can get an accurate reading, get it".

Permissions were granted in-session, and the deploy command was approved. Live deploys only for app-ready spots that pass the full gate.

## Ground truth before planning
- **In the app:** 59 spots (deployed 8b1ed47f).
- **The pipeline** (`docs/forecast/data/add-spots.ts`) adds a researched row everywhere in one run:
  - MOP;
  - slope;
  - the CO-OPS tide station;
  - the NWS zone;
  - shore wind;
  - the service lists.
- **The fetch budget** holds to about 95 spots under Open-Meteo's free 10,000 calls a day: 48 calls per spot per day, so 59 → 2,832.
  - Above about 150 spots, add a cheaper path: batch Open-Meteo multi-location requests, or longer TTLs for spots nobody has opened recently. Engineering stream 3.
- **The app is Pacific-time only:** about 24 files use America/Los_Angeles or pacificDate.
  - A spot outside Pacific time would show the wrong clock, wrong "today" and wrong dark hours.
  - So: no spot outside Pacific time goes into the app until the time-zone work lands.
- **Data outside the US:**
  - Open-Meteo marine and weather are global.
  - CDIP MOP, CO-OPS tides, NWS alerts and NDBC shore stations are US only.
  - A global spot gets offshore model output and wind. It shows tides "not available" and no alerts, honestly, never borrowed from another country.

## What "accurate" means here
A fact enters the catalogue only from a named public source, with its URL and retrieval date:
- **Position:** an OSM feature, a park or agency page, or a guide's map pin (said which), rounded to 3 dp.
- **Facing, swell window, wind, tide, bottom, type, hazards:** from published guides (surfnerd, surf-forecast and similar), each attributed. Where two guides disagree, both are kept.
- **Nearest data sources:** a buoy or tide station from the official registry (NDBC activestations, CO-OPS mdapi, national services where public), with the distance computed, not guessed.
- **Drops:** a spot that can't be sourced is dropped and listed with the reason. No estimate fills a gap.

## Streams (run in parallel)
### A. App-ready, live when gated (Pacific time + US data)
- **A1. Phase B, SLO to the border** (spec 2026-11-08, the list there):
  - product-term researches;
  - eng-term runs add-spots;
  - the lead reviews and gates.
- **A2. Oregon and Washington coast:**
  - a research agent (worktree);
  - then add-spots. It needs MOP to handle "no MOP coverage" (MOP is California only), as it already does for spots with none.
- **Merge and deploy** after the full gate and a data-honesty review of each batch.
- **Target:** 59 → 90+ (A1) → 120+ (A2).

### B. Global catalogue (data and Obsidian, not in the app yet)
**Research agents, one per region:**
- Isolated git worktrees; Opus, with Fable for the hardest region, where sources disagree most.
- Each writes:
  - `docs/forecast/data/world-spots/<region>.json`: rows plus guide facts in the `guide-facts.json` schema, plus `nearestSources` (buoy and tide ids with distance), plus `dropped`;
  - Obsidian: `10-Projects/SWELLO/Spots/World/<Region>/Spot-<Name>.md`, in the existing spot-note frontmatter style with `status: catalogued`, `in_app: false`, and a `Region-<Name>.md`.
- No two agents write the same file. The lead keeps the indexes.

**Region order:** best-documented first, to grow fastest.
1. Hawaii (Oahu North and South Shore first; US data, HST time);
2. Portugal and Spain (Atlantic);
3. France (Basque and Landes);
4. Australia (NSW and Queensland);
5. Indonesia (Bali);
6. Mexico (Pacific);
7. Costa Rica and Nicaragua;
8. Peru and Chile;
9. South Africa;
10. UK and Ireland;
11. Japan;
12. New Zealand;
13. Morocco.

**Pace:** at most 4 agents at once (8 GB machine). Polite fetches, about 1 request a second per site.

### C. Engineering (eng-term): unblock the globe
- **C1. Per-spot time zone:** every SpotEvidence gets an IANA `timeZone`, and every pacificDate, clock or daylight call takes the spot's zone. The default stays America/Los_Angeles, so nothing changes for the existing spots.
  - Tests: a Honolulu spot and a Lisbon spot get the right "today", clock labels and dark hours.
  - On a branch; merged only after the full gate.
- **C2.** "No US data" honesty for non-US spots: tide, alerts, MOP and shore wind say "not available in this region", and the rating still works.
- **C3.** A fetch budget above about 150 spots (see above).

## Obsidian
- New indexes (lead):
  - `Spots/World/World-Spots-Index.md`: counts per region, links, and what each spot has and lacks;
  - `Data-Sources/` notes for each new source family: national buoy networks and tide services where public, Open-Meteo global coverage limits, guides.
- A morning handoff: `80-Handoffs/2026-11-09-morning-report-global-spots.md`, covering:
  - counts (app / catalogued / dropped);
  - what went live;
  - what failed;
  - what needs the user.

## Acceptance (morning)
- App spots well up from 59, all gated, data-honesty reviewed and deployed. Or, if a gate failed, merged-not-live with the reason.
- The catalogued world spots and their notes number in the hundreds. Every one has sources, and every drop has a reason.
- C1 merged or on a branch, with an honest status.
- No invented fact. The data-honesty reviewer spot-checks each batch: 5 random spots fetched against their sources.
