# Comparison plumbing: NWS Surf Zone Forecasts and nearshore gauges against what we show (branch srf-compare)

Plumbing and a first run, **not** a calibration decision and **no change to any number the app shows** (calibration belongs to Track 2). Everything here reads captures and writes files outside the repo (`~/Development/swello-data/srf-compare/`).

## Pieces
| | |
|---|---|
| `services/srf-parse.mjs` | Parser for NWS SRF products (`{id, issuingOffice, issuanceTime, productText}` as api.weather.gov serves them). Per zone and period: every "Surf Height" range as written (with its facing label, the "becoming ..." remainder and "sets to" kept), the rip current lines, every other keyed line as raw text (tides left out). Never fills or guesses: an unreadable surf line is `kind: 'text'` with no numbers, "N feet or less" has no lower bound, "around N" is lo = hi = N, a holiday or multi-day period label has no date. Handles the MTR/EKA/LOX/SGX facing form, BOX sub-lines per coast and inline periods, GUM facing reefs, MFR/PQR single or "N to M ft", the CAR "Surf" key, and the HFO facing table (read only when its columns match). `pickEntry` chooses the entry for a spot by its seaward bearing (nearest facing within 45 degrees; ties, mismatches and "or less" are excluded with a reason). Tests: `src/tests/srf-parse.test.ts` (11). |
| zone to spot map | `docs/forecast/data/surf-height-sources.json` (`spots[id].nws_srf.zone`, km), unchanged. |
| `scripts/srf-compare.mjs` | Joins the shown captures (`howright/v2/shown/<day>.json`) with the SRF ranges for the same spot and local date; writes `srf-compare-<date>.csv` and `.md` (our mid-range against theirs per zone and region, with n). |
| `scripts/gauge-compare.mjs` | Gauge Hs (NDBC WVHT) against our surf estimate at the spots within 5 km of a nearshore gauge (depth <= 45 m), hour by hour; CSV and `.md`, with gauge depth and distance in every row. No Duck FRF data. |
| `scripts/pull-r2-captures.mjs` | Read-only copy of the R2 objects the two scripts read (shown captures, the SRF index and products, hourly gauge objects) into `~/Development/swello-data/srf-compare/r2*`; skips what it has. |
| `scripts/lib/compare-common.mjs` | Shared: where the data is, and our surf range per captured hour of a spot. |

Run: `zsh -lic 'cd <worktree> && node scripts/pull-r2-captures.mjs && node scripts/srf-compare.mjs && node scripts/gauge-compare.mjs'`.

## What is compared, exactly
- **Theirs:** the zone's "Surf Height" for one local calendar day (TODAY / REST OF TODAY / a weekday period), in feet, as the NWS wrote it. Their mid-range is (lo + hi) / 2. "N feet or less" is excluded (counted), Hawaii (the HFO facing table is parsed, but its half-day columns are not joined yet) is not in the first run.
- **Ours:** the app's surf range (`headlineSurf` / `surfBand`: lo, hi, central) **re-derived now with the current engine from the hours stored in the shown capture** (the same convention as the stored rating), uncalibrated (no personal observations) and without the CDIP MOP, SWAN and model-spread inputs (none is in the capture): the v1 offshore-to-break chain, which may differ from what a visitor saw. Our mid-range for a day is the mean of (lo + hi) / 2 over that local day's daylight hours (at least 4); a same-day SRF only from its issue time on.
- **Pairing:** one row per (spot, local date, capture); for each zone and date the SRF product issued closest in time to the capture is used. The gap and the lead (capture to local noon) are columns.
- **Gauges:** NDBC `WVHT` (metres to feet) nearest each whole hour within 15 minutes against our central (typical wave) for the same hour from the newest capture made before it; our offshore model Hs at the spot's marine point is a reference column. A gauge Hs and a breaking range are different quantities: the bias is shown as it is with the gauge depth and distance, nothing is adjusted.
- n is printed everywhere. Spots in a zone share their SRF range and spots near a gauge share its readings, so the independent count is the zone-days / gauge hours column.

## First run (2026-11-11, on what had been captured)
**Inputs:** 2 shown capture(s) (2026-11-10, 2026-11-11), 75 SRF products from 19 offices (KBOX KBRO KCAR KCRP KEKA KJAX KLOX KMFL KMFR KMLB KMOB KMTR KPQR KSGX KTAE KTBW PGUM PHFO TJSJ), issued 2026-11-08 to 2026-11-11.

## Overall
| | n (spot-days) | spots | zone-days | their mid (ft) | our mid (ft) | ours - theirs, mean (ft) | mean abs miss (ft) | median diff (ft) |
|---|---|---|---|---|---|---|---|---|
| all | 283 | 97 | 81 | 5.32 | 4.36 | -0.96 | 1.32 | -1 |

**n is small and the rows are not independent:** every spot in a zone is compared with the same SRF range, so the 81 zone-days are the real number of independent comparisons, and 2 capture day(s) of ours cover only a few local dates.

### By lead (capture to local noon of the day)
| | n (spot-days) | spots | zone-days | their mid (ft) | our mid (ft) | ours - theirs, mean (ft) | mean abs miss (ft) | median diff (ft) |
|---|---|---|---|---|---|---|---|---|
| 0-12 h | 165 | 92 | 49 | 5.05 | 4.04 | -1.02 | 1.28 | -1 |
| 12-36 h | 118 | 79 | 32 | 5.68 | 4.81 | -0.87 | 1.37 | -1 |

## Excluded (not compared)
- 1028 x the capture holds no hours of that local date (its 48 h do not reach it)
- 662 x their period has no readable surf height
- 129 x fewer than 4 daylight hours with a surf estimate of ours
- 128 x their range is "or less" (no lower bound)
- 20 x spot faces more than 45 degrees from every facing they list
- 10 x two facings equally near the spot (ambiguous)
(A count is one spot x zone period; the same period can be excluded for many spots of a zone.)

The per-region and per-zone tables are in `~/Development/swello-data/srf-compare/out/srf-compare-2026-11-11.md` (24 regions, 28 zones, most with 1 to 4 zone-days: too few to read individually).

### Gauges
**Inputs:** 2 shown capture(s) (2026-11-10, 2026-11-11); readings from 9 of 42 nearshore gauges (41115 1375, 41121 2144, 46254 2181, 46266 2170, 46268 2153, 46274 2081, 46285 2162, 46286 2177, 51211 2156 readings); hours 2026-11-10T08Z to 2026-11-11T17Z.

## Overall
| | n (gauge-hour x spot) | gauge hours | spots | gauge Hs (ft) | our central (ft) | ours - gauge, mean (ft) | mean abs miss (ft) | median diff (ft) | model offshore Hs (ft) | offshore - gauge, mean (ft) |
|---|---|---|---|---|---|---|---|---|---|---|
| all | 229 | 99 | 7 | 3.35 | 3.36 | +0.01 | 0.72 | -0.07 | 3.68 | +0.32 |

**n is small and the rows are not independent:** the spots near one gauge share its readings, and 2 capture day(s) hold only the hours from each capture onward.

### By gauge (depth, spots within 5 km)
| | n (gauge-hour x spot) | gauge hours | spots | gauge Hs (ft) | our central (ft) | ours - gauge, mean (ft) | mean abs miss (ft) | median diff (ft) | model offshore Hs (ft) | offshore - gauge, mean (ft) |
|---|---|---|---|---|---|---|---|---|---|---|
| 46254 SCRIPPS Nearshore, CA (201), 41 m | 102 | 34 | 3 | 3.02 | 3.83 | +0.81 | 0.81 | +0.75 | 3.96 | +0.94 |
| 46274 Leucadia Nearshore, CA (262), 17 m | 93 | 31 | 3 | 3.55 | 2.85 | -0.69 | 0.69 | -0.72 | 3.43 | -0.12 |
| 46266 Del Mar Nearshore, CA (153), 17 m | 34 | 34 | 1 | 3.83 | 3.34 | -0.49 | 0.49 | -0.45 | 3.5 | -0.33 |

### By distance gauge to spot
| | n (gauge-hour x spot) | gauge hours | spots | gauge Hs (ft) | our central (ft) | ours - gauge, mean (ft) | mean abs miss (ft) | median diff (ft) | model offshore Hs (ft) | offshore - gauge, mean (ft) |
|---|---|---|---|---|---|---|---|---|---|---|
| 2.5 to 5 km | 164 | 99 | 5 | 3.39 | 3.37 | -0.02 | 0.78 | -0.22 | 3.7 | +0.31 |
| 1 to 2.5 km | 34 | 34 | 1 | 3.02 | 3.61 | +0.59 | 0.59 | +0.54 | 3.81 | +0.79 |
| spot within 1 km | 31 | 31 | 1 | 3.55 | 3.04 | -0.5 | 0.51 | -0.43 | 3.43 | -0.12 |

### By gauge depth
| | n (gauge-hour x spot) | gauge hours | spots | gauge Hs (ft) | our central (ft) | ours - gauge, mean (ft) | mean abs miss (ft) | median diff (ft) | model offshore Hs (ft) | offshore - gauge, mean (ft) |
|---|---|---|---|---|---|---|---|---|---|---|
| gauge 25 to 45 m | 102 | 34 | 3 | 3.02 | 3.83 | +0.81 | 0.81 | +0.75 | 3.96 | +0.94 |
| gauge 12 to 25 m | 127 | 65 | 4 | 3.62 | 2.98 | -0.64 | 0.64 | -0.61 | 3.45 | -0.17 |

## Not compared
- 13812 x gauge hours (of the readings kept, up to 45 days) that no capture of ours holds for the spot: before our first capture or after the last
- 33 of the 42 nearshore gauges have no captured readings (the capture holds only the stations listed under Inputs): 41065 41067 41108 41110 41112 41113 41114 41117 41120 41122 41159 42033 42034 42098 42354 44084 44085 44086 44087 44090 44091 44095 44099 44100 45215 46108 46211 46215 46237 46243 46256 46275 46278

## Reading these numbers
- **n is tiny.** 2 capture days of ours; the SRF side has 75 products (a week, from the local capture; the R2 SRF capture had not run yet at the time); the gauge side has 2 days of hours from 3 gauges that have a catalogued spot within 5 km.
- A negative "ours - theirs" means our range sits below the NWS range. The first numbers lean low (about -1 ft overall, larger in Oregon and San Francisco swell, positive in Monterey / Big Sur and Humboldt), but 81 zone-days over 2 days of captures cannot support a statement about a region.
- Same-day SRFs and our capture were made hours apart; the lead column and table separate the two lead buckets.
- Nothing was fitted, tuned or adjusted, and nothing here feeds a rating or a number the app shows.
