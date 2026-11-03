# T-079 (product): more spot photos

Branch `worktree-product` (merged forecast-trust 0269b5e first). One commit, local only. No Codex run.

## Coverage
**40 of 45 spots now have a credited real photo** (was 3). There are 37 new photos, one per spot; Ocean Beach, Bolinas and Linda Mar keep their existing set.

No photo (they fall back to the drawn coast plan, honestly): **Moss Landing, Malibu (Surfrider), County Line, Trestles, Cardiff Reef.** Candidates for these were off-subject (a nuclear plant, film posters, a grave), too far away, or Unsplash-licence files, which I excluded because that is not a free licence.

## How each photo was chosen
- **Search:** Wikimedia Commons API. Files geotagged within 3 km of the spot, plus a name search ("<spot> surf / <region> beach / waves"), plus a second pass with alternative names for the misses.
- **Licence filter:** CC0, public domain, CC BY, CC BY-SA only. NC/ND, unknown and Unsplash-licence files are dropped; JPEG ≥ 1200 px only.
- **Subject filter:** no birds, plants, fungi, buildings, signs or portraits. Geotagged files more than 4 km away are dropped.
- **Selection:** I reviewed every candidate on contact sheets and picked by eye: surf, lineup or the break itself first (Steamer Lane, Pleasure Point, Mavericks, The Wedge, Morro Rock, Black's, Cowell's), else the beach and its water.
- **Self-hosted:** Commons' own resized renditions at 800 and 1600 px (`public/photos/<spot>-c1-{800,1600}.jpg`; ~14 MB at 1600 and 4 MB at 800 for 37 photos). Re-encoding locally made them larger, so I kept Commons' encoding.
- **Manifest:** `src/ui/photos.ts` has 37 new `PHOTOS` entries (photographer as Commons records it, licence, licence URL, Commons file page as source, `generic: false`). `SPOT_PHOTOS` puts each new photo first for its spot.
  - Notable credits: Point Arena (BLM California, public domain); Sand Dollar (US National Archives, public domain, author unknown); Imperial Beach (CC0).
  - "Mountain Mike Johans…" is truncated in Commons' own metadata; I kept it verbatim.
- **Where they appear:** automatically, through the existing `SpotPhoto`/`SpotBand` (the spot page band, Home's welcome band, the cards).

## Checks (5184)
- tsc OK; unit tests 414/414; build OK.
- t045 54/0; t047 55/0; t074 28/0; density ALL PASS; journeys 8/8.
- Bands spot-checked in Chrome: Steamer Lane, The Wedge, Salt Creek and Sand Dollar load with their credits; Trestles falls back to the drawn coast.
- Shots: `playwright-toolkit/swello/artifacts/t079/`.

## Notes
- No AI images; no new dependencies. The public repo gains about 18 MB of CC images, all with attribution in the manifest.
- These photos are free licences, so they're compatible with the public-repo rule; CC BY-SA requires the credit shown, which the band and cards display.
