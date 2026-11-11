# Overnight 2026-11-10/11: toward a reliable surf height

The user, before bed: "continue the workflow, make spec for tonight that I don't have to give you any permissions for. Basically just continue collecting as much data as possible, specifically surf height data as well, so there can be an actual true reliable source of surf height."

**No new permissions tonight:** no launchd or cron installs on the Mac, no account or dashboard changes, no emails, no purchases, no new production crons.
- **Deploys:** only work the user already approved (the audit-fix set, the reviewed branches) may deploy, after the full gate. If the safety check blocks a deploy, it waits merged for the morning.
- **Local data collection:** runs inside this session's own background shells only.

## Why surf height is hard, and the plan
SWELLO's surf number today is a model estimate: offshore swell, carried to the break by CDIP MOP in California or by a profile rule elsewhere. A truly reliable surf height needs two things: better nearshore models where they exist, and *observations at or near the break* to calibrate and score against. Tonight builds both sides and starts the record.

## Streams
### S1. Nearshore model heights (eng-term, after the audit fixes)
- **Hawaii, PacIOOS SWAN (swan-hawaii, already specified):**
  - the 152-spot cell table (8–20 m depth, swell side);
  - the Worker reader behind a flag that stays off;
  - the buoy comparison script against CDIP 106 Waimea and 098 Mokapu.
- **Start the record tonight:** a local script captures SWAN at every Hawaii spot cell, plus the two buoys, every 3 h into `~/Development/swello-data/swan/`. It runs as this session's background loop, keyless, at ≤1 request a second. This becomes the first days of the 7-day validation.

### S2. Observed and official surf heights: research (agent)
Find every public source of **surf height at or near the break**, and the licence for each:
- **NWS Surf Zone Forecasts (product SRF):** issued by coastal offices with "Surf height X to Y ft" per zone, public domain, via api.weather.gov products. This is an official surf-height forecast to compare against. Map the zones to our spots.
- **Surf-zone wave gauges:**
  - CDIP nearshore buoys and pier gauges (e.g. Scripps Pier LJPC1, 46254 Scripps Nearshore);
  - the USACE Field Research Facility at Duck, NC: pier and surf-zone gauges, public data;
  - USGS coastal sensors;
  - NOAA NOS met/wave stations on piers.
- **Lifeguard surf reports:** county and state lifeguard services that publish observed surf heights (e.g. LA County, San Diego, Volusia County FL), with the format, how often they post, and the terms. Record exactly what we may show. Nothing is scraped where the terms forbid it.
- **Output:** `docs/research/SURF-HEIGHT-SOURCES.md`, plus `docs/forecast/data/surf-height-sources.json` with per-spot coverage.

### S3. Start recording what's allowed (lead, local)
- For every source S2 clears as public and keyless, a local capture script writes into `~/Development/swello-data/` on a polite cadence (NWS SRF text twice a day; surf-zone gauges hourly).
- These are this session's background loops only.
- A day of records is still a day of records. They go to the server once the user approves a cron in the morning.

### S4. Keep the existing record growing (already live)
- **The Worker's daily capture:** forecast plus rating for all spots, scored against buoys. Tomorrow it shows the first "How right" numbers for about 194 spots.
- **The NDBC archive:** daily.

These need nothing tonight. Check them in the morning and report.

### S5. Finish and ship the approved work
- **Merge with reviews:**
  - the reviewed branches: water quality, stable windows and sharing, "looks like your sessions";
  - the audit fixes: W1, W2, eng, product map;
  - zoom-groups after its correction round;
  - dedupe-pairs;
  - the Europe model check.
- **One gated deploy** of approved work, verified on production. If the safety check blocks it, it waits for the morning.
- **Phone pass:** continues on its branch (product-term); it ships after its own review.

## Morning report
Write it to `80-Handoffs/2026-11-11-morning-report.md`. It covers:
- what merged and what deployed;
- the first How-right numbers;
- the surf-height source map;
- days captured per source;
- the Fable briefing additions (the surf-height calibration plan for Wednesday);
- anything that needs the user (crons to approve for the new captures, licence asks).
