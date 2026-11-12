# Atlantic 8 s minimum period: does v1 below 8 s track the NWS and the gauges? (branch atlantic-8s)

Evidence for an open user decision (briefing 2026-11-11, Track 2 proposal 1). **No rule or number in the app is changed.** The 8 s minimum (`GENERIC_MIN_PERIOD_S` in `src/ocean/spotFactsRules.ts`, enforced by `src/ocean/breakingEstimate.ts` as `short-period`) is bypassed only inside the analysis script.

Script: `docs/forecast/data/atlantic-8s.mjs` (run: `zsh -lic 'cd <repo> && node docs/forecast/data/atlantic-8s.mjs'`; `--offline` re-runs from the cache). Output and caches stay outside the repo in `~/Development/swello-data/atlantic-8s/` (`out/atlantic-8s.md`, per-row JSON). Run 2026-11-12, 122 Open-Meteo marine requests (about 245 weighted calls), 18 NDBC realtime2 files.

## Method
- **Spots:** 398 US East Coast spots (Maine to Southeast Florida, Keys left out) whose v1 profile has minPeriod 8, a shelter factor and a beach orientation. (Spots with no shelter factor are refused every hour, which is not a period question.)
- **Bypass:** the script sets `minPeriod = 0` on the in-memory `breakingProfiles` array the engine reads, then runs the app's own chain (`normalizeOpenMeteo` -> `headlineSurf`, method `v1` only). All other refusals still apply (swell outside the window, wind sea larger than the swell). A second pass with the profiles untouched records whether the app shows an estimate today (the "app shows today" column: 0 % below 8 s, as expected).
- **Period bin:** the primary swell period the gate reads (Open-Meteo `swell_wave_period` at the spot's marine point): <5, 5-6, 6-7, 7-8 s, and >=8 s as the control (the hours the app already shows).
- **Inputs:** (1) the three stored shown captures (2026-11-10/11/12, forecast as issued, 48 h each); (2) Open-Meteo marine `past_days` (the model's own recent hours, hindcast-like, not a forecast made at the time): up to 3 spots per SRF zone for the last 8 days, and up to 3 spots within 25 km of each East Coast nearshore gauge for the last 45 days.
- **NWS SRF:** the zone's "Surf Height" for the spot's local date (`services/srf-parse.mjs`, `pickEntry` by seaward bearing). Captures use the product issued closest to the capture (as `scripts/srf-compare.mjs`); the hindcast uses the newest product issued before 17Z that day. "N ft or less" counts as their own statement, 0 to N, for inside/above/below, but is left out of the mid-range error. Per daylight hour: our band mid-range (lo+hi)/2 against their [lo, hi]. Captured East Coast products: BOX, CAR, JAX, MLB, MFL only (none from GYX, OKX, PHI, AKQ, MHX, ILM or CHS), 2026-11-05 to 2026-11-12; CAR's zones hold no spot of this set.
- **Gauges:** NDBC realtime2 WVHT (45 days, the reading nearest each hour within 15 min) of the East Coast nearshore buoys (depth <= 45 m) with a spot within 25 km, plus 44056 (Duck FRF 17 m; FRF data are private-use, read here for internal analysis only). Ours: the central value (the typical wave, the 10 m-depth convention height, the quantity closest to a gauge Hs). The model's own offshore Hs minus the gauge is shown beside it to separate input error from the transfer.
- **Independence:** spots in one zone share the SRF range and spots near one gauge share its readings, so zone-days and gauge-hours are the real n. Hours within a day are strongly correlated.

## Results

### NWS SRF (inside / above / below their range, per daylight hour)
| input | period bin | n hours | zone-days | their range "N or less" | inside | above | below | median ours − their mid (ft) | median distance outside their range (ft) |
|---|---|---|---|---|---|---|---|---|---|
| captures | 5-6 s | 125 | 11 | 64% | 30% | 54% | 17% | 0.0 | +0.5 |
| captures | 6-7 s | 123 | 13 | 47% | 41% | 11% | 47% | −0.5 | 0.0 |
| captures | 7-8 s | 2903 | 65 | 5% | 25% | 4% | 72% | −0.5 | −0.5 |
| captures | **5-8 s** | 3151 | 70 | 9% | **26%** | 6% | 69% | **−0.5** | −0.5 |
| captures | **>=8 s (control)** | 2007 | 39 | 0% | **9%** | 3% | 87% | **−1.0** | −0.5 |
| hindcast | 5-6 s | 330 | 27 | 16% | 39% | 20% | 41% | −0.5 | 0.0 |
| hindcast | 6-7 s | 32 | 6 | 84% | 25% | 66% | 9% | −1.0 | +0.5 |
| hindcast | 7-8 s | 247 | 26 | 14% | 36% | 33% | 31% | 0.0 | 0.0 |
| hindcast | **5-8 s** | 609 | 51 | 19% | **37%** | 28% | 35% | **−0.5** | 0.0 |
| hindcast | **>=8 s (control)** | 593 | 44 | 0% | **10%** | 9% | 81% | **−1.0** | −0.5 |
| captures | <5 s (for reference) | 249 | 16 | 23% | 20% | 23% | 57% | −0.5 | −0.5 |

By office (both inputs, 5-8 s vs >=8 s): BOX 42% inside, −0.5 ft (27 zone-days) vs 0% inside, −2.5 ft (7); JAX 40%, −1.0 (39) vs 6%, −1.0 (27); MLB 2%, −0.5 (30) vs 11%, −1.0 (49); MFL 49%, 0.0 (25) vs no >=8 s hours. MLB (Space Coast) sits below the NWS range in both bins.

### Nearshore gauges (45 days, 17 gauges, 2026-09-28 to 2026-11-12)
| period bin | n spot-hours | gauge-hours | gauges | median ours − gauge Hs (ft) | mean abs miss (ft) | median ours / gauge | median model offshore Hs − gauge (ft) |
|---|---|---|---|---|---|---|---|
| <5 s (for reference) | 4212 | 1740 | 16 | −0.8 | 0.9 | 0.69 | −0.6 |
| 5-6 s | 4930 | 2143 | 17 | −0.8 | 0.9 | 0.72 | −0.5 |
| 6-7 s | 6857 | 2842 | 16 | −0.9 | 1.2 | 0.70 | −0.6 |
| 7-8 s | 6097 | 2653 | 16 | −0.7 | 1.0 | 0.75 | −0.4 |
| **5-8 s** | 17884 | 7042 | 17 | **−0.8** | **1.0** | **0.72** | −0.5 |
| **>=8 s (control)** | 9629 | 3702 | 15 | **−0.8** | **1.3** | **0.77** | −0.5 |

Per gauge, ours / gauge below 8 s vs at or above 8 s (same spots, same gauge): 41065 Capers SC 0.98 vs 1.04; 41067 Fripp SC 0.84 vs 0.94; 41110 Masonboro NC 0.88 vs 0.96; 41112 Fernandina FL 0.80 vs 0.90; 41113 Canaveral FL 0.64 vs 0.73; 41114 Fort Pierce FL 0.66 vs 0.75; 41117 St. Augustine FL 0.53 vs 0.61; 41120 Hatteras 0.76 vs 0.73; 41122 Hollywood FL 0.84 vs 0.94; 44086 Nags Head 0.68 vs 0.75; 44095 Oregon Inlet 0.73 vs 0.70; 44099 Cape Henry 0.68 vs 0.81; 44100 Duck 26 m 0.67 vs 0.75; 44056 Duck 17 m 0.74 vs 0.82 (n per gauge 1,000-1,750 below 8 s; 44085, 44087, 44090 have few rows). The full per-gauge table is in the run output.

### What the bypass would turn on
Of the spot-hours read, once the 8 s gate is bypassed: 5-6 s 43% get an estimate (the rest: outside the window 32%, wind sea dominant 24%), 6-7 s 64%, 7-8 s 79%, <5 s 27%; >=8 s 85% (today's control). So the window and wind-sea checks still refuse most of the steep, local hours.

## Reading it
- **Below 8 s, v1 is no worse than above 8 s on either reference.** Against the NWS it sits inside their range more often (26-37% of hours vs 9-10%) and its median miss is smaller (−0.5 vs −1.0 ft). Against the gauges the median miss is the same (−0.8 ft), the mean absolute miss smaller (1.0 vs 1.3 ft, the waves are smaller), and the ratio slightly lower (0.72 vs 0.77). At the same gauge the short-period ratio is lower than the long-period one at 12 of 14 gauges, by about 0.05-0.1: the short-period hours run a little lower still, not off in a new way.
- **The low bias is not a short-period effect.** In every bin the model's own offshore Hs is already about 0.5 ft under the gauges, and v1 is about 25% under in both bins (and below the NWS in both). That belongs to proposal 2 (a regional correction), not to the period minimum.
- **6-7 s is the weakest bin** (gauges −0.9 ft, ratio 0.70; SRF only 19 zone-days, 84% "or less" in the hindcast). 7-8 s is the best-supported bin on both references.
- **Limits:** the SRF side covers 8 days and four offices, with MLB's zones below the NWS whatever the period; the hindcast inputs are the model's recent hours, not a forecast made at the time; gauges sit 10-29 m deep and 4-24 km from the spots, so they test the 10 m convention height, not the breaking band (the SRF tests the band); no gauge sits within 25 km of a New Jersey, New York, Delaware or Georgia spot of this set, and Maine/New Hampshire/New York/New Jersey/Mid-Atlantic have no captured SRF.

## Verdict
**Lower the Atlantic minimum to 7 s now; 6 s is supported by the gauges but has thin NWS data.** 7-8 s is the best-supported bin on both references (gauges −0.7 ft, ratio 0.75, about 2,650 gauge-hours; NWS median −0.5 / 0.0 ft over 91 zone-days) and is where most of the refused hours are (about 10,000 of 17,000 spot-hours read). 6-7 s tracks the gauges almost as well (2,840 gauge-hours) but has only 19 NWS zone-days. The same low bias as above 8 s carries over, so the change should come with the proposal-2 correction or the same "runs low" wording.
- **Scope:** `GENERIC_MIN_PERIOD_S` is shared by every guide profile, including the West Coast and Hawaii. This evidence is East Coast only, so a change should be an Atlantic value, not the shared constant.
- **When 6 s will have enough NWS data:** the SRF capture runs hourly; at about 2-3 zone-days a day in the 6-7 s bin (19 in 8 days), about 30 more zone-days take 2 to 3 weeks: re-run this script around **2026-12-03** (and earlier if the GYX/OKX/PHI/MHX/ILM/CHS products start appearing in the capture).
