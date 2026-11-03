# T-080 (product): more live cam links + own-cam plan

Branch `worktree-product`. One commit, local only. No Codex run.

## Cam links (links only, owner pages, verified in Chrome on 2026-11-02 around 11 PM)
There were 1 and are now **6**. `src/data/cams.ts` and `docs/forecast/CAMS.md` record each one's owner, operator, URL, what it shows, the verified date, and how it was verified (page HTTP 200 and the player received video frames).
| Spot | Label | What it shows |
|---|---|---|
| Malibu | Live cam · Swell Magnet | Malibu Point / Surfrider lineup, PTZ (1920 px stream) |
| El Porto | Live cam · Swell Magnet | Rosecrans overlook, 38th–45th St (2560 px) |
| Hermosa Pier | Live cam · Swell Magnet | North of the pier (2560 px) |
| Black's Beach | Live cam · Hotel La Jolla | La Jolla Shores; the roaming PTZ also shows Scripps Pier and Black's. The link says it is not a fixed view of Black's |
| Pleasure Point | Live cam · Santa Cruz Port District | The harbor entrance ~3 km west, **not** the break; the link says so |
| Morro Rock (existing) | Live cam · Morro Bay National Estuary Program | Rock and harbour from the bay side |

**Skipped, with reasons (in CAMS.md):**
- Huntington: no owner stream found.
- Newport/Wedge: the city points to Surfline, a subscription aggregator.
- Manresa: Visit Santa Cruz's "Palm State Beach" cam is at Pajaro Dunes, ~8 km away.
- Steamer Lane, Cowell's, Pismo, Oceanside, Imperial Beach, SF Ocean Beach, Linda Mar: only aggregators or no owner page.

## Own-cam plan
`docs/product/CAMS-PLAN.md` covers:
- why: seeing the break, the honest "observed" path, calibration;
- per-site hardware with prices seen on cited pages, a first cam at about $350–650 in parts (an estimate), plus Cloudflare Stream Live at $1 per 1,000 minutes delivered (cited);
- candidate sites (Ocean Beach, Linda Mar) and permissions (private property with the owner's consent first; the public-land/CDP question, with cited precedents);
- privacy rules, the three-step observed label path (your observation, then cam-observed by a reviewer, then measured by video, experimental), and computer-vision height later;
- the steps that need the user (money, host, deploy).

## Checks (5184)
- t063 42/0; t045 54/0; t047 55/0; t074 28/0; density ALL PASS; journeys 8/8.
- Links confirmed rendering on all six spot pages, with the owner label and an honest view title.
- Shots: `playwright-toolkit/swello/artifacts/t080/`.
