# World spot research brief (lead, 2026-11-09)
Spec: `docs/specs/2026-11-09-global-spots.md`. You research ONE region. Find as many real, sourced surf spots as you can. Gather every accurate public reading and never estimate.

## Per spot
**Position.** A public map position:
- OSM: use Nominatim `https://nominatim.openstreetmap.org/search?q=...&format=jsonv2`, or a lookup by OSM id, with User-Agent `SWELLO spot research`, at most 1 request a second;
- or a park/agency page;
- or a guide's map pin, saying which.

Round to 3 dp and keep the URL.

**Guide facts.** From published guides, curled directly. Firecrawl may be down.
- Sources: `curl -s -A 'Mozilla/5.0' https://www.surfnerd.com/surf-forecast/<slug>` and `https://www.surf-forecast.com/breaks/<Slug>`, and other public guides (Wannasurf, national surf guides, tourism or park pages).
- Read the page text. Never guess a fact from a name.
- Pace: about 1 request a second per site.
- Facts to capture: facing (word plus degrees), swell window, ideal swell, offshore wind, tide, bottom, wave type and direction, size range, exposure, hazards, season, access restrictions.
- Each fact is attributed to its source in brackets. Where two sources disagree, keep both.

**Nearest data sources.** Computed distances, from official registries:
- NDBC: `https://www.ndbc.noaa.gov/activestations.xml`, which lists many non-US partner buoys;
- national wave buoy networks;
- tide gauges: IOC sea-level monitoring `https://www.ioc-sealevelmonitoring.org/list.php`, UHSLC;
- airports with METARs, via IEM networks.

Record the id, the owner, the distance in km, and whether it is live.

**Time zone.** The IANA zone (e.g. Europe/Lisbon). Also the country and the region.

**Drops.** No sourced position, or no sourced facing → DROP the spot, with a reason. Never invent. Never use AI-generated or "typical" values.

## Output (no file is shared with another agent)
1. **Repo:** `docs/forecast/data/world-spots/<region-slug>.json`, shaped as:
   ```json
   {
     "region": "...",
     "retrievedOn": "2026-11-09",
     "spots": [
       {
         "id": "w-<region>-<slug>",
         "name": "...",
         "country": "...",
         "region": "...",
         "timeZone": "...",
         "type": "Beach|Point|Reef",
         "lat": 0,
         "lon": 0,
         "seaward": 0,
         "positionSource": {"text": "...", "url": "..."},
         "facingSource": {"text": "...", "url": "..."},
         "facts": {},
         "nearestSources": []
       }
     ],
     "dropped": [{"name": "...", "reason": "..."}]
   }
   ```
   - `facts` follows the schema of the entries in `docs/forecast/data/guide-facts.json` (see the cs-imperial entry).
   - Commit it on your worktree branch. The commit message ends `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
2. **Obsidian** (write directly; NEVER read or touch `99-Private/` or `.obsidian/`):
   - **One note per spot:** `~/Knowledge/AI-Knowledge/10-Projects/SWELLO/Spots/World/<Region>/Spot-<Name>.md`.
     - Copy the frontmatter style of `~/Knowledge/AI-Knowledge/10-Projects/SWELLO/Spots/Spot-Asilomar.md`.
     - Use `kind: spot`, `status: catalogued`, `in_app: false`, `country`, `time_zone`, `lat`, `lon`, `facing`.
     - The body: published facts with source links, nearest data sources, and what the app would and would not have for this spot.
   - **One region note:** `Spots/World/<Region>/Region-<Region>.md`. It covers the coast, the swell season, the data sources available there, the spot list with links, and the dropped list.
3. **Final report** (≤200 words):
   - the branch and commit;
   - spots kept and dropped (counts);
   - the 3 facts you are least sure of, and why;
   - any source that blocked or rate-limited you.

## Rules
- Public pages only.
- Don't log in, don't accept terms, and don't download files beyond pages and JSON.
- Don't edit any `src/` file. The JSON and the vault notes are your only outputs.
- Quantity matters, but every row must be real. Aim for every named break with a guide page in your region.
