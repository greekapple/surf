# Request map: plain-language area → where to look

Starting points, not exhaustive. Verify paths still exist; update this table when an area moves.

| User says… | Route | Source | References (`INDEX.jsonl` query) | Open items |
|---|---|---|---|---|
| Home, cards, hero, "the week" | `/` | `src/features/home/` (`HomeView.tsx`, `home.css`) | `"category": "Home"` | D-03, D-04 |
| Forecast, charts, timeline, "doesn't match references" | `/forecast` | `src/features/forecast/` (`ForecastView.tsx`, `charts.tsx`) | `"category": "Forecast"` | D-05, D-07, V-02 |
| Explore, map, wind/swell layers | `/explore/*` | `src/features/explore/`, `src/map/`, `worker/` (grid API) | `"feature": "explore-map"` (reference D is `proposed-primary`) | T-012 / V-01, X-03 |
| Quiver, boards, showroom, "unrealistic boards" | `/quiver/*` | `src/features/quiver/`, `src/recommendation/` | `"category": "Quiver"`, `"category": "3D References"` | F-01, F-02 |
| Wave Scale, 3D wave | `/forecast/wave-scale` | `src/features/scale/` | `"category": "3D References"` | F-03, X-01 |
| Personal, settings, profile, theme | `/personal` | `src/features/personal/`, `src/ui/tokens.css` | `"category": "Personal"` | D-06, V-03 |
| Navigation, brand, typography, colours | all | `src/app/`, `src/ui/` | `"category": "Brand and Navigation"`, `CHATGPT-REFERENCES.md` | V-04 (theme decision) |
| Data, sources, ratings, "numbers look wrong" | n/a | `src/ocean/`, `src/ratings/`, `src/services/`, `docs/forecast/` | — | T-008, X-01, X-02 |
| "Buttons don't work" (anywhere) | all | the area's view file | — | run `swello-controls.mjs` / `journeys.mjs` first to locate dead controls |

Reference library: `~/Development/swello-design-references/INDEX.md` (read the header only), `CHATGPT-REFERENCES.md` for the visual direction.
Vault hub: `~/Knowledge/AI-Knowledge/10-Projects/SWELLO/00-SWELLO-Hub.md`; area notes are numbered 01–14.
