# Data preview verification — 2026-10-20

Existing source, navigation, demonstration screens, board data key, preferences and all prior working features are retained. Real-data mode is an additive path, selected by default. Changing source mode does not reset saved boards or preferences.

## External providers

Live Node checks completed 2026-10-20T02:16:18Z using `node --experimental-strip-types scripts/check-ocean-providers.mjs`:

- Open-Meteo Marine + Weather: Ocean Beach, Bolinas and Linda Mar each returned 168 exact-timestamp joined records.
- NOAA CO-OPS 9414290 hourly predictions: 193 valid station records for the requested interval.
- NOAA CO-OPS water-level observation: one valid latest station observation.
- NOAA NDBC 46026 standard meteorological feed: seven normalized observation measurements, each preserving its own latest non-missing timestamp within the preceding 24 hours.

Browser preview: six Open-Meteo requests and two NOAA CO-OPS requests succeeded. NDBC does not supply browser cross-origin headers. The client reports that limitation and displays an explicitly saved, timestamped observation captured in the development environment. This is not described as a live buoy connection and does not refresh automatically. No third-party CORS proxy is used.

## Accuracy constraints

No spot-specific offshore-to-breaking-wave method is calibrated. Real-data breaking height stays unavailable. Local swell exposure, coastline orientation, tide compatibility and local organization are not verified for scoring. Real-data SQI and Your Match therefore show insufficient data. Numeric synthetic examples remain confined to Demonstration mode. Experiments can illustrate hypothetical board compatibility, not establish a suitable real surfing session.

All three spots use San Francisco gauge 9414290 as an explicitly regional tide reference. There is no inferred local tide transfer. The offshore buoy is regional context, not a surf-zone observation. Query coordinates are representative API request points, not surveyed takeoff locations; returned provider grid coordinates are exposed.

The NPS Ocean Beach page, California State Parks Pacifica State Beach page, and Marin County Bolinas wastewater page support the limited real-world profile facts. Unknown characteristics stay unknown, and incomplete hazards never imply safety. URLs are retained in `src/ocean/spots.ts`.

## Verification scope

Automated checks cover normalized units, exact UTC joins, Pacific/DST handling, NOAA datum and trends, NDBC missing markers and per-measurement dates, missing SQI inputs, verified-profile scoring fixtures, board exclusions, rate limits, caching, source preservation and experiment isolation, plus all existing quiver, persistence, ranking and display tests.

Browser checks: real provider status, all three spot selection, day/hour synchronization, measurement source/valid/retrieval details, Hawaiian invariance for offshore values, live three-spot comparison at one valid instant, experiment-specific source labels and hypothetical board scores, return to untouched forecast, preserved quiver limits, and original demonstration mode. Desktop layout was visually inspected; separate mobile viewport QA was unavailable.
