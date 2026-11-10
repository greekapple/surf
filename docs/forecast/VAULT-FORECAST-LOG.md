# Daily forecast in each spot's Obsidian note (vault-forecast-log, 2026-11-10)

`scripts/vault-forecast-log.mjs` writes each APP spot's daily forecast into its note under `~/Knowledge/AI-Knowledge/10-Projects/SWELLO/Spots/` (the Spots folder, World subfolders included). **No scheduled job exists**: the launchd plist below is a proposal; installing it is a standing configuration change that needs the user's confirmation.

## What it does
- **Source:** the newest COMPLETE `howright/v2/shown/<UTC date>.json` (the daily capture of the Open-Meteo marine and wind hours at the app's model points) and `howright/v2/scorecard.json`, from R2 (`wrangler r2 object get swello-forecast-cache/<key> --remote`) or a local copy of the bucket (`--dir`). "Complete" is the Worker's own rule (`services/coast-ratings.mjs`: the status file says so for that day, or every catalogue spot is in the file; today's, yesterday's or the day before's).
- **Notes:** the id→note map uses the note's frontmatter `spot_id` first, then an unambiguous title or alias (two notes with the same name are reported and skipped, never guessed). Notes whose `spot_id` is not an app spot are ignored. `99-Private/`, `.obsidian/`, `.git` and `node_modules` are never listed, read or written.
- **The block** sits between `<!-- swello:forecast-log start -->` and `<!-- swello:forecast-log end -->`, under a `## Forecast log` heading. A note without the block gets the heading and block at its end; a note that already has the heading but no markers gets the block right under the heading; nothing else in the note changes (not even `updated:`). The block has:
  - a table of the last 14 capture days (older rows drop): capture day (UTC), capture time in the spot's own zone, the best daylit window of the next 48 h with its rating word and peak score (rated with the CURRENT rules from the stored marine and wind inputs, judged as of the model run; the column header reads "current rules, as of the run": `src/services/coastSnapshot.ts`), the offshore Hs range at the model point (m and ft), the wind range and its direction at the best hour, and the model-run age at capture. Older days' rows are read back from the block itself (never recomputed); today's row replaces the same date;
  - the How-right lines **verbatim** (`offshoreLine`, `ratingLine` of `src/services/howRightAll.ts`: "Offshore wave height at the buoy (not surf at the spot): …") when the scorecard has numbers; "collecting: N days so far (we need 3 before showing a number)" while it is collecting; the scorecard's own "No offshore check: <reason>" for a spot with no usable buoy;
  - a source line naming the capture and the scorecard time ("Offshore model values, not surf at the spot").
  Values come from the capture only; nothing is estimated or filled.
- **Idempotent:** the same capture gives the same block; a second run changes no byte. `--dry-run` prints the notes that would change (the first two blocks in full, `--show N` for more) and writes nothing.

```
node --experimental-strip-types --no-warnings scripts/vault-forecast-log.mjs --dry-run          # reads R2 with wrangler
node --experimental-strip-types --no-warnings scripts/vault-forecast-log.mjs --dir ~/Development/swello-data/r2 --now 2026-11-10T20:00:00Z --dry-run   # a local copy of the bucket
options: --vault <Spots dir>  --days N (also read the N-1 earlier captures, a one-off backfill)  --keep 14  --show N  --list-missing
```

## Dry run against the real vault (2026-11-10, local copy of the R2 capture of 2026-11-10)
8,118 notes read; **478 of the 492 app spots have a note; 478 notes would change**; 14 app spots have no note (`cs-rodeo-beach`, `cs-kellys-cove`, `cs-sloat`, `cs-sharp-park`, `cs-rockaway`, `cs-princeton-jetty`, `cs-half-moon-bay`, `cs-pescadero`, `cs-pigeon-point`, `cs-scott-creek`, `cs-capitola`, `cs-natural-bridges`, `cs-marina`, `cs-andrew-molera`); 0 ambiguous by name; 7,581 notes belong to catalogued world spots that are not in the app (left alone). The same run on a copy of the vault changed 478 notes the first time and 0 the second, and the only differences from the originals were the heading and the block.

## Proposed launchd job (NOT installed)
Daily at 07:30 Pacific (the capture finishes by 06:20 UTC = 22:20 PT the evening before), as the user's agent: `~/Library/LaunchAgents/com.swello.vault-forecast-log.plist`.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.swello.vault-forecast-log</string>
  <key>ProgramArguments</key><array>
    <string>/bin/zsh</string><string>-lic</string>
    <string>cd /Users/milosin/Development/projects/surf &amp;&amp; node --experimental-strip-types --no-warnings scripts/vault-forecast-log.mjs</string>
  </array>
  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>30</integer></dict>
  <key>StandardOutPath</key><string>/Users/milosin/Library/Logs/swello-vault-forecast-log.log</string>
  <key>StandardErrorPath</key><string>/Users/milosin/Library/Logs/swello-vault-forecast-log.log</string>
  <key>RunAtLoad</key><false/>
</dict></plist>
```
Notes: the Mac's clock is Pacific, so `StartCalendarInterval` 07:30 is 07:30 PT (a Mac asleep at that time runs the job when it wakes). `zsh -lic` loads the fnm Node as the other SWELLO commands do. The R2 read uses wrangler's own login (`wrangler login`, an OAuth token in `~/.wrangler`) or `CLOUDFLARE_API_TOKEN` in the user's environment; no credential is written in the plist or the script. Install with `launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.swello.vault-forecast-log.plist`; remove with `launchctl bootout gui/$(id -u)/com.swello.vault-forecast-log`. The repo path must be the checkout that has this script (the main checkout after the merge).

## Checks
`src/tests/vault-forecast-log.test.ts` on a temporary vault and a local bucket copy: id, then title matching; ambiguous and missing reported; 99-Private and `.obsidian` never read or written; the row is the capture's numbers; a run changes only the block (and the heading where it was missing), a second run changes no byte, `--dry-run` writes nothing; the How-right lines verbatim, "collecting" otherwise; the 14-day cap with older rows read back unchanged; no complete capture writes nothing.

## Notes for app spots that had none (vault-notes-bay, 2026-11-10)
`scripts/vault-spot-notes.mjs <id> ...` creates the missing note of an app spot in the style of the existing app-spot notes (frontmatter with `spot_id`, Coverage, Published facts, Tide, Weather zone and buoys, Sources). **Create-only** (an existing note, by `spot_id` or file name, is skipped), `--dry-run`, never `99-Private/` or `.obsidian/`. Only sourced data: the guide facts as their own strings with their links (`spotFactsSourced.ts`), the MOP assignment text, the tide station the app picks, the NWS zone and the context and reference buoys; a field the guides do not state is not written. The county's region fields are copied from the existing notes of the same county. The 14 notes created: Rodeo Beach, Kelly's Cove, Sloat, Sharp Park, Rockaway, Princeton Jetty, Half Moon Bay, Pescadero, Pigeon Point, Scott Creek, Capitola, Natural Bridges, Marina, Andrew Molera; the forecast block was then written to them (492 of 492 app spots have a note). `Spots-Index.md` (last updated 2026-11-02, 45 spots) was not touched.
