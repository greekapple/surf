# v0.7 regional forecast fields

## Sources actually connected and tested

- PacIOOS / University of Hawaiʻi WaveWatch III, served by NOAA ERDDAP `NWW3_Global_Best`. Official metadata: https://upwell.pfeg.noaa.gov/erddap/griddap/NWW3_Global_Best.html and https://www.pacioos.hawaii.edu/waves/model-global/ . Native 0.5° global model; documented hourly, daily update. Large-scale offshore context, not local surf. Fields Thgt (significant height, m), Tper (peak period, s), Tdir (peak FROM direction, degrees), shgt/sper/sdir (aggregate swell, not a primary/secondary partition).
- NOAA/NCEP GFS through NOAA ERDDAP `NCEP_Global_Best`. Metadata: https://upwell.pfeg.noaa.gov/erddap/griddap/NCEP_Global_Best.html . Native 0.5°, 3-hourly, 8-day global atmospheric forecasts. Only 10 m eastward/northward velocities (ugrd10m/vgrd10m, m s-1) are used. Speed = hypot(u,v); FROM bearing = atan2(-u,-v), normalized 0–360. Calm vectors have no invented direction. Gust field unavailable.
- A bounded 36–40°N, 126–122°W subset, 81 native cells per frame, is requested; no browser GRIB decoding or enormous global files.
- NOAA CO-OPS 9414290 hourly tide and distinct `interval=hilo` predictions remain station-specific. Actual event timestamps survive; extrema are not inferred from hourly curves. Official station metadata https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/9414290.json . Tide is never a continuous ocean heatmap.
- Open-Meteo spot forecasts remain the source for spot previews/ratings. They are never stretched into the regional grid. Point model and grid model can disagree; their sources are distinguished.

## Verified connection boundary

On 2026-10-20 server-side Python HTTP retrieval returned genuine JSON for all eight regional variables. Browser direct grid requests failed in this environment. The app attempts direct retrieval, then uses separately labeled genuine dated model snapshots. `SAVED MODEL SNAPSHOT` appears prominently with actual valid/retrieval times and provider. This is not demonstration data and is not advertised as a live browser connection.

Snapshots generated around 2026-10-20 05:30 UTC cover 2026-10-20 00:00 UTC through 2026-10-23 00:00 UTC: 73 hourly WW3 frames per field, 25 three-hourly GFS frames per component. Eight files, 488 variable frames, 39,528 cells were validated using the same adapter. Per-file exact retrieval times and source queries are in `public/spatial/manifest.json` and each payload. Approx. 1.7 MB total, lazy-loaded by field.

Refresh manually with `python3 scripts/refresh-spatial.py --hours 72` (Python standard library; network required), then build/deploy. The refresh script is not a scheduled production job. It only replaces successful complete fields, preserves per-field provenance and does not extend/shift times. Expired or unsupported frames show unavailable; current spot forecasts remain usable. There is no fake future color field after snapshot coverage ends.

## Rendering and interaction

Leaflet retained. Independent canvases for native-cell colors, direction arrows and optional wind flow; spot markers separate. Numeric palettes differ for height, period, speed and circular direction. All height legends use physical ft/m, never Hawaiian breaking scale; wind legends respect mph/kn/km/h. Opacity acts on the actual raster canvas. Missing cells transparent, no sub-grid values invented. Native-cell footprints can overlap land along the coast; coarse cells do not resolve shore geometry.

Wind at an hourly spot selection uses the preceding actual 3-hourly frame. Both timestamps and the difference are displayed. WW3 requires exact hourly frames. No temporal interpolation. Variable changes clear obsolete fields; subscribers cancel abandoned requests, share pending reads, cache successful fields 10 minutes, and honor 429 cooling periods. Saved field files are cached in memory. Animation illustrates directions at native wind-vector locations; particle movement is not physically scaled, pauses rendering in hidden tabs, is disabled for reduced motion, and is removed on teardown. No wave particles invented.

Current unsupported spatial fields: secondary swell, gusts, breaking-wave height, tide. Legitimate point data remain available where supplied. Independent visibility preferences use `surf-map-v2`, leaving `surf-prototype-v1` untouched. No new dependency was added.

## License, attribution and alternatives evaluated

WW3 metadata permits free use/redistribution without accuracy warranty; attribution retained to PacIOOS, University of Hawaiʻi, NOAA/IOOS. GFS metadata identifies NOAA as source and permits free redistribution subject to its stated warranty disclaimer; raw source metadata retained. These are forecasts, not guaranteed navigation products. No Surfline/Windy data or branding used.

NOAA nowCOAST GetCapabilities was retrieved, but its current service did not expose an appropriate full regional wave-forecast layer for this implementation. NCEP/NOMADS GRIB subset services were considered; ERDDAP avoids browser GRIB decode and backend tile generation for the bounded preview. Private commercial forecast tiles were not used because no key/license was provided. OSM tiles and Leaflet retain their v0.6 attribution and normal HTTP caching; no tile bulk downloading. Previous source investigations remain in v0.6 documentation.

## Buoy observations

Direct NDBC browser restrictions remain. `public/observations/ndbc-46026.json` was refreshed from a successful real server retrieval on 2026-10-20 05:31 UTC, retaining individual observation timestamps and `delivery:saved`; never called live. The optional fixed-station portable adapter `services/noaa-proxy.mjs` supports Worker fetch or `node scripts/serve-noaa.mjs`, 5-minute caching, 10-second timeout, 1 MB bound, no arbitrary upstream URLs, public-data CORS and error responses. Set `VITE_NOAA_PROXY_URL` to a separately deployed service's `/api/buoy/46026`. This service is not deployed by the static Site. Mocked handler tests pass; the real NOAA upstream was separately retrieved and normalized. Do not claim an end-to-end deployed proxy connection.
