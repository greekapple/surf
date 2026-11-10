# Surfline cam links, Bay Area (surfline-links, 2026-11-10)

User: "only link for now". A link button "Surfline cam ↗" on the spot page (new tab, `rel="noopener noreferrer"`), labelled "Surfline's, not ours · may need a Surfline subscription". **No iframe, no embed, no thumbnail, no preview; nothing of Surfline is loaded by the page** (browser check: 0 requests to any surfline.com host over a visit to 12 spot pages). Under our Camera panel where there is one (Cowell's, Steamer Lane, Sharp Park, Linda Mar), as an extra. Data: `provider: 'surfline'` entries in `src/data/cams.ts` (cam name, URL); `camsFor`/`camFor` leave them out, so the map badge and the Callout are unchanged; `surflineFor(spotId)` returns the link.

**How the URLs were found.** Surfline's own pages answer automated requests with a Cloudflare challenge (HTTP 403 "Just a moment…"), which was not worked around, so **no Surfline page was opened**. The URL, the page name and the cam listing were read from public web-search results (the spot id appeared in at least two independent results for each); a page counts as having a cam when its title says Surf Cam / Surf Cams / Live Surf Cam. These are listings as indexed, some old: a link may land on a page whose cam Surfline has since removed.

| App spot | Surfline page | Note |
|---|---|---|
| Cowell's | Cowells | |
| Steamer Lane | Steamer Lane | a separate "Steamer Lane Overview" page carries the HD cam |
| Pleasure Point | Pleasure Point | |
| Capitola | Capitola | |
| Ocean Beach | Ocean Beach Overview | Surfline marks it a premium-only high-resolution cam |
| Mavericks | Maverick's | |
| Half Moon Bay (Dunes Beach) | Half Moon Bay | |
| Sharp Park | Sharp Park | |
| Linda Mar | Linda Mar | |
| Stinson | Stinson Beach | |

**No link** (Surfline's own listing says "No cam", or no match was found): Natural Bridges, Princeton Jetty, Montara, Rockaway, Bolinas (all listed "No cam"); Kelly's Cove, Sloat (Surfline has Ocean Beach South/Central pages, not matched to these spots) and Rodeo Beach (the search results disagree).

Checks: `src/tests/surfline-links.test.ts` (the ten spots, URL form, no link for the others, the map unchanged, every entry an `<a>` and no Surfline URL in any iframe/img/src/CSS url/fetch), browser `playwright-toolkit/swello/surfline-link.mjs` at 1440 and 390.
