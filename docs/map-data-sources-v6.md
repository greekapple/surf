# Map data and dependencies — checked 2026-10-20

## Implemented layers
All forecast map layers are point-based, at the exact shared forecast timestamp. There is no continuous regional meteorological overlay and no point interpolation. The map is genuinely interactive: pan/zoom, keyboard access, selectable geographic spot markers, source-aware previews, point-direction indicators, comparisons, units, actual-record playback, and a regional tide chart. It uses already fetched records; no forecast fetch occurs on a layer/time change or animation frame.

| Layer | Actual data used | Geography | Limits |
| --- | --- | --- | --- |
| SWELL | Open-Meteo primary/secondary swell height, period, direction | Provider-returned model grid, otherwise explicitly labeled requested query reference | Points only; no local shadowing, nearshore transformation, or interference model |
| WIND | Open-Meteo 10 m speed/direction/gust forecasts | Provider-returned weather grid, otherwise labeled query reference | Vectors only at supported points; no synthetic flow field or unsupported shore relationship |
| WAVES | Open-Meteo offshore significant height | Provider-returned marine grid | Offshore sea state is not surf face height. Breaking-estimate selection explicitly shows unavailable for real spots |
| TIDE | NOAA CO-OPS 9414290 hourly MLLW station predictions | One real San Francisco station: 37.806305, -122.46589 | One regional station marker/curve, never a continuous sea surface or measurement at each beach |

Station coordinate source: https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations/9414290.json
Spot reference coordinates remain the previously documented representative query locations, not claims of precise surf peak positions. Surf ratings on real markers are neutral UNRATED. Observed buoy/gauge records retain their own timestamps on the full forecast; they are not grafted onto future map frames.

Demonstration mode uses explicitly labeled fixed sample points at the initial three documented reference locations. Those measurements are illustrative, not actual forecasts. No genuine station-tide values are invented for the demonstration map. The other seven demonstration spots remain available in the list/full forecast; no unverified coordinates were added for them. Map data always uses original retrieved or demo records, not experiment edits.

## Regional grids investigated, not integrated
NOAA NCEP publishes GFS Wave model grids in GRIB2, including global/west-coast products. Sources:
- https://www.nco.ncep.noaa.gov/pmb/products/wave/
- https://www.nco.ncep.noaa.gov/pmb/products/gfs/
- https://www.cpc.ncep.noaa.gov/products/tools/scripting_grib_filter.html

These are not a ready integrated browser forecast-tile service here. Reliable run/lead-time selection, geographic decoding, cached server-side subsetting/tiling, missing-cell handling, resampling/vector conventions and verification against native grids still need engineering. No gridded forecast overlay is claimed. No proxy or secret service was added merely to hide this missing pipeline.

## Basemap and software
- Leaflet **1.9.4**, BSD-2-Clause, lazy loaded only when the map opens. License copied to `docs/licenses/leaflet.txt`. Official API reference: https://leafletjs.com/reference.html ; quick start: https://leafletjs.com/examples/quick-start/
- OpenStreetMap standard raster basemap, visible © OpenStreetMap contributors attribution linked to https://www.openstreetmap.org/copyright . Geographic data is ODbL; review the copyright page for the separate cartography/tile terms.
- Follow https://operations.osmfoundation.org/policies/tiles/ : standard HTTPS tile URL, ordinary browser User-Agent/referrer, HTTP caching, visible attribution, no bulk/offline downloads or prefetch. The map uses `updateWhenIdle`, no keep-buffer tile prefetch, and no no-cache headers. This is a best-effort preview basemap, not an unlimited hosted-tile service or an SLA.
- Optional public `VITE_MAP_TILE_URL` and `VITE_MAP_ATTRIBUTION` configure an appropriately licensed replacement basemap. Restart/rebuild after changing them. Never embed secret keys in VITE variables. Preserve correct attribution if changing the provider. No API key is required by the default map.

## Forecast provider terms
- Open-Meteo API data: CC BY 4.0 attribution to Open-Meteo and relevant upstream model providers. Public free API access is for non-commercial uses and has request limits (current terms list 600/min, 5,000/hour, 10,000/day); commercial deployment needs an appropriate access plan. https://open-meteo.com/en/terms ; https://open-meteo.com/en/licence ; https://open-meteo.com/en/docs/marine-weather-api
- NOAA public station forecasts/observations remain attributed to NOAA CO-OPS/NDBC. Provider quality flags, timestamps and regional limitations are preserved. No third-party proprietary Surfline data is used. NOAA disclaimers apply: https://www.noaa.gov/disclaimer
- The packaged NOAA NDBC snapshot is a dated real saved observation from the existing project, not a current live feed.

Terms and provider availability can change. No paid provider, account, token, database or authentication dependency was introduced. For a larger public/commercial launch, select basemap and forecast service access appropriate to expected traffic and license requirements before scaling.
