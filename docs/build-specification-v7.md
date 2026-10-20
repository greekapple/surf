# SURF — MASTER DEVELOPMENT PROMPT v0.7
## Real Surf Ratings + Fully Interactive Ocean Forecast Map 2.0

You are continuing development of the existing SURF v0.6 React + TypeScript + Vite application.

This is an improvement to the existing project, NOT a rebuild.

The objective is to create a substantially better surf forecasting experience centered around two major priorities:

1. Make the surf rating system operational using real forecast data.
2. Build a Windy-style interactive ocean forecast map with independently toggleable colored heatmaps, directional overlays, and forecast playback.

Continue improving usability, performance, data transparency, and the overall forecasting experience.

Do not undertake the final visual redesign yet.

---

# 1. PRESERVE THE EXISTING APPLICATION

Before modifying anything:

- Inspect the current codebase.
- Run the existing tests.
- Identify the forecast providers, rating engine, map implementation, spot metadata, and shared application state.
- Preserve all working functionality.
- Preserve Git history and saved user data.
- Maintain existing localStorage compatibility.
- Keep the project portable outside Astra.

Preserve:

- Today
- Explore
- Forecast
- Quiver
- Profile
- Open-Meteo integrations
- NOAA integrations
- Retrieved-data mode
- Demonstration mode
- Experiment mode
- Smart Quiver
- Personal Match
- Spot comparison
- Forecast timelines
- Tide chart
- Source attribution
- Measurement preferences
- JSON import/export

Retain the existing Leaflet implementation unless there is a clear technical reason to change it.

Do not regenerate the application or replace functioning components unnecessarily.

---

# 2. OPERATIONAL REAL-DATA SURF RATINGS

The current rating engine is too restrictive for the available real forecast data.

The application needs to provide useful surf ratings when enough genuine information exists.

Do not invent observations, local calibration data, or breaking-wave measurements.

## 2.1 Two rating tiers

Introduce:

**Provisional Rating**

A surf-potential assessment using real forecast measurements, documented heuristics, and available verified spot characteristics.

**Calibrated Rating**

A rating supported by spot-specific nearshore information and demonstrated forecast performance.

Never label a score calibrated without evidence.

## 2.2 Official rating categories

Use these exact names:

| Rating | Score |
|---|---|
| Epic | 95–100 |
| Firing | 85–94 |
| Good | 75–84 |
| Solid | 65–74 |
| Not Bad | 55–64 |
| Surfable | 40–54 |
| Weak | 25–39 |
| Poor | 0–24 |
| Flat | Separate override |
| Unrated | Insufficient data |

The progression is:

Flat → Poor → Weak → Surfable → Not Bad → Solid → Good → Firing → Epic

Flat means reliable evidence indicates no meaningful rideable breaking waves.

Unrated means insufficient information.

Never treat missing information as Flat.

Epic should be genuinely rare.

## 2.3 Provisional scoring engine

Use available real inputs such as:

- Primary swell height, period, and direction
- Secondary swell information
- Combined offshore wave height
- Wind speed, direction, and gusts
- Verified spot orientation and exposure
- Available tide measurements
- Verified local spot characteristics

Build a documented, deterministic model evaluating:

- Wave potential
- Swell alignment
- Wind influence
- Wave organization indicators
- Tide influence, where supported
- Spot-specific limitations

Do not require unavailable breaking-wave face-height estimates for an explicitly provisional offshore-based assessment.

Do not use an arbitrary universal offshore-to-breaking-wave multiplier.

Do not silently treat missing factors as ideal.

If sufficient inputs exist, produce a provisional score with its limitations.

If essential inputs are missing, return Unrated.

Prioritize operational provisional ratings for:

- Ocean Beach, San Francisco
- Bolinas
- Linda Mar, Pacifica

Do not force ratings for these spots if essential evidence genuinely remains unavailable.

## 2.4 Rating explanations

Show:

- Numerical score
- Rating category
- Provisional/Calibrated status
- Positive factors
- Negative factors
- Missing inputs
- Forecast reliability
- Valid time

Separate rating quality from forecast reliability.

Use reliability categories:

High
Moderate
Limited
Insufficient

Do not invent confidence percentages.

---

# 3. MAP 2.0 — CORE EXPERIENCE

The map should become a major interactive feature of SURF.

It must support:

- Panning
- Zooming
- Spot selection
- Surf ratings on markers
- Forecast information previews
- Multiple forecast visualization modes
- Independent colored heatmap toggles
- Direction arrows
- Optional animated flow
- Forecast time scrubbing
- Playback
- Map-to-forecast navigation

The map should occupy most of its available screen space.

Use compact floating controls rather than surrounding the map with large panels.

Keep the overall website navigation recognizable.

---

# 4. CRITICAL REQUIREMENT — INDEPENDENT HEATMAP AND OVERLAY TOGGLES

This is the most important clarification.

**The user must be able to independently enable and disable the colored geographic heatmap, directional vectors, and optional animation.**

Do not build a system where selecting "Wind" or "Swell" automatically forces a permanent colored heatmap.

Do not make the heatmap and direction arrows inseparable.

The user must have control over what is visible.

## 4.1 Map visualization layers

Implement these independent display elements:

**A. Colored Forecast Heatmap**

An actual geographically distributed color field representing the selected forecast variable.

**B. Direction Arrows**

Geographically positioned arrows representing actual wind, swell, or wave direction.

**C. Animated Flow**

Optional particle or streamline animation representing available forecast vectors.

**D. Surf Spot Markers**

Surf spot locations and ratings.

These elements must be independently toggleable where applicable.

For example:

- Heatmap ON + Arrows ON
- Heatmap ON + Arrows OFF
- Heatmap OFF + Arrows ON
- Heatmap OFF + Arrows OFF
- Heatmap ON + Animated Flow ON
- Plain map + Surf Spot Markers ON

Surf spot markers must remain available independently of the colored forecast visualization.

If a selected variable has no valid vector data, disable its direction controls rather than drawing invented arrows.

---

# 5. FORECAST VARIABLE SELECTION

Provide a primary forecast category selector:

SWELL
WIND
WAVES
TIDE

Within each category, provide the appropriate forecast variables.

## Swell

- Swell height
- Swell period
- Swell direction
- Primary swell
- Secondary swell, when available

## Wind

- Wind speed
- Wind gusts
- Wind direction

## Waves

- Combined significant wave height
- Wave period
- Wave direction

## Tide

- Tide station information
- Tide height
- Tide trend
- High/low predictions

A category selection must not be confused with visibility settings.

**Category selection chooses the data. Visibility toggles choose how that data is displayed.**

For example:

Selecting WIND + WIND SPEED chooses the wind-speed forecast variable.

Turning HEATMAP ON displays the colored wind-speed field.

Turning ARROWS ON displays wind-direction vectors.

Turning HEATMAP OFF removes the colors while keeping arrows visible.

The controls must behave consistently.

---

# 6. WINDY-STYLE COLORED FORECAST MAP

The colored forecast map is a central product feature.

We want a genuine interactive geographic forecast visualization similar in functionality to Windy, without copying its branding or exact interface.

The ocean or map region should display geographically meaningful color gradients.

Examples:

### Swell-height mode

The ocean is colored according to swell height.

Higher swell areas use different colors from lower swell areas.

Users can enable swell-direction arrows.

### Swell-period mode

The ocean colors change to represent swell period in seconds.

Users can keep swell-direction arrows visible.

### Wind-speed mode

The map displays a colored wind-speed forecast.

Users can enable wind-direction arrows or optional wind-flow particles.

### Wind-gust mode

The colored map represents gust speeds.

### Combined-wave-height mode

The ocean is colored according to modeled significant wave height.

Each visualization must use its own accurate legend and units.

The map must change when the selected forecast variable changes.

Do not simply recolor spot markers.

Do not apply one generic color gradient to every variable without adjusting its numerical scale.

---

# 7. HEATMAP DISPLAY CONTROLS

Create a compact floating control panel with:

- Forecast category selector
- Forecast variable selector
- Colored Heatmap ON/OFF
- Heatmap opacity slider
- Direction Arrows ON/OFF
- Animated Flow ON/OFF, where supported
- Surf Spot Markers ON/OFF
- Color legend
- Forecast-valid time
- Source attribution

When Heatmap is OFF, the geographic color layer must disappear completely.

When Heatmap is ON, it must reappear without resetting the map position or selected time.

When opacity changes, the geographic forecast layer must become more or less transparent.

When Arrows are OFF, directional arrows must disappear without affecting the heatmap.

When animation is OFF, particles must stop while other selected layers remain visible.

When spot markers are OFF, markers should disappear without affecting forecast data.

Every control must actually work.

Do not create decorative toggles.

## Remember visualization preferences

Where practical, remember the user's most recent:

- Forecast category
- Variable
- Heatmap visibility
- Arrow visibility
- Animation visibility
- Opacity
- Spot-marker visibility

These preferences should persist without interfering with existing stored user data.

---

# 8. REAL SPATIAL FORECAST DATA

A genuine heatmap requires geographically distributed forecast measurements.

Do not create a fake continuous heatmap from only three surf spot forecasts.

Investigate legitimate spatial forecast sources, including:

- NOAA WaveWatch III
- NOAA/NCEP gridded marine forecasts
- NOAA atmospheric forecast grids
- Suitable marine forecast tile providers
- Other legitimate gridded wind and wave products

Evaluate:

- Geographic coverage
- Resolution
- Available variables
- Update frequency
- Forecast timestamps
- Licensing
- Attribution
- CORS
- Performance
- Hosting requirements

Open-Meteo point forecasts may continue to support spot forecasts.

Do not pretend point data is a complete regional forecast grid.

## Preferred architecture

Use:

1. A genuine spatial forecast source
2. A provider adapter
3. A forecast-frame cache
4. A geographic raster or tile renderer
5. A color scale and legend
6. A synchronized time controller

If server-side conversion is necessary, document and implement it where feasible.

Avoid downloading enormous raw forecast grids directly into the browser.

## Fallback behavior

If a real spatial field is unavailable:

- Keep the map functional.
- Keep real spot forecasts functional.
- Keep spot markers visible.
- Show legitimate point measurements and vectors.
- Clearly label the continuous heatmap as unavailable.
- Explain the technical limitation.

Do not display an invented color field as if it came from a numerical forecast model.

---

# 9. FORECAST TIME SLIDER AND PLAYBACK

Add a shared time controller directly beneath or over the bottom of the map.

Support:

- Drag-to-scrub
- Hour selection
- Day markers
- Play/pause
- Previous/next frame
- Local forecast time
- Forecast-valid timestamp

The selected time must synchronize:

- Colored heatmap
- Direction arrows
- Animated flow
- Spot ratings
- Spot previews
- Wind measurements
- Swell measurements
- Wave measurements
- Forecast charts

Use actual available forecast timestamps.

Do not fabricate intermediate frames.

If different providers have different forecast resolutions, clearly identify the valid time for each displayed layer.

Cache loaded frames so scrubbing does not repeatedly download identical data.

---

# 10. MAP INTERFACE REDESIGN

Improve the current map's footprint substantially without redesigning the entire website.

Recommended layout:

**Top-left:** Compact forecast layer and variable controls.

**Top-right:** Map display toggles and settings.

**Center:** Large geographic map.

**Bottom:** Time slider and playback.

**On spot selection:** Floating forecast preview.

**On mobile:** Compact controls and a bottom sheet.

Avoid large surrounding panels.

## Spot markers

Show:

- Spot name
- Rating category or score, when available
- Selected state

Avoid overlapping labels.

Use a readable, consistent marker system.

## Spot preview

When selected, display:

- Spot name
- Forecast time
- Available wave-height measurement
- Primary swell
- Wind
- Surf rating
- Reliability
- Open Forecast action

Preserve map position when previews open and close.

## Map utilities

Add:

- Recenter
- Reset zoom
- Layer legend
- Map data status
- Loading indicator
- Provider error state

Support mouse, trackpad, touch, and keyboard interaction.

---

# 11. FORECAST PAGE INTEGRATION

The map must be connected to the existing Forecast page.

Selecting a spot on the map and opening its forecast should preserve:

- Spot
- Selected time
- Measurement preferences

Returning to the map should preserve relevant state.

Continue improving:

- Main wave-height display
- Surf rating presentation
- Swell components
- Wind
- Tide
- Hourly timeline
- Multi-day outlook
- Source details

The detailed Forecast page must remain fully usable without opening the map.

---

# 12. TODAY AND EXPLORE

Today should summarize regional surf conditions.

Explore should focus on geographic discovery and comparisons.

Explore must include a clear Map/List toggle.

The map should not require users to navigate through multiple unnecessary screens.

Ratings should appear wherever valid:

- Today
- Explore
- Forecast
- Spot comparisons
- Map markers
- Map previews

Unrated must not be treated as Poor.

---

# 13. IMPROVE REAL FORECAST DATA

Continue improving the data foundation.

Prioritize:

- Ocean Beach
- Bolinas
- Linda Mar

Improve verified spot metadata.

Investigate NOAA buoy access through a lightweight server-side adapter where browser restrictions interfere with live retrieval.

Preserve:

- Provider
- Station
- Forecast-valid time
- Observation time
- Retrieval time
- Data freshness
- Limitations

Do not label historical observations as live.

Prepare the architecture for additional California spots.

---

# 14. PRESERVE SMART QUIVER

Do not remove or rebuild Smart Quiver.

Preserve:

- Saved boards
- Board dimensions
- Board editing
- Board comparisons
- Personal Match
- User preferences
- JSON backup

General surf ratings must remain independent of user skill and board selection.

Do not manufacture precise board recommendations from unsupported wave-height assumptions.

---

# 15. EXPERIMENT MODE

Preserve Experiment mode.

Clearly label simulations as hypothetical.

Do not mix simulation results into retrieved forecasts.

Keep hypothetical wind, swell, tide, and wave controls separate from actual forecast-map layers.

---

# 16. PERFORMANCE AND RESPONSIVENESS

Prioritize:

- Fast map loading
- Lazy-loaded geographic layers
- Forecast-frame caching
- Request deduplication
- Obsolete-request cancellation
- Efficient raster rendering
- Efficient vector rendering
- Smooth time scrubbing
- Touch-friendly map controls
- Reduced-motion support

Avoid heavy animations or unnecessary dependencies.

The map should remain usable on mobile devices.

---

# 17. TESTING

Run existing tests before and after development.

Add tests for:

- Provisional rating eligibility
- Rating boundaries
- Flat classification
- Unrated handling
- Rating explanation consistency
- Heatmap visibility ON/OFF
- Heatmap opacity
- Direction arrows ON/OFF
- Animated flow ON/OFF
- Spot markers ON/OFF
- Forecast variable switching
- Forecast frame switching
- Time synchronization
- Map-to-forecast navigation
- Provider failures
- Missing spatial data
- User preference persistence

Verify TypeScript compilation and production build.

Do not remove tests to make the build pass.

---

# 18. IMPLEMENTATION ORDER

### Phase 1 — Ratings

Make the provisional rating engine operational using defensible real inputs.

### Phase 2 — Map layout

Improve map size, floating controls, markers, and spot previews.

### Phase 3 — Genuine colored heatmap

Implement one actual geographic forecast heatmap end to end.

Prioritize combined wave height or swell height.

Verify that the color field represents real geographically distributed data.

### Phase 4 — Independent overlay controls

Implement:

- Heatmap toggle
- Opacity
- Direction toggle
- Animation toggle
- Spot-marker toggle

Verify that each control operates independently.

### Phase 5 — Additional forecast variables

Add supported wind, swell, and wave layers using real spatial data.

### Phase 6 — Forecast playback

Implement time slider synchronization, playback, and caching.

### Phase 7 — Data improvements

Improve buoy access, spot metadata, rating explanations, and source reliability.

### Phase 8 — Verification

Run tests, fix regressions, and update the development handoff.

---

# FINAL ACCEPTANCE CRITERIA

Do not consider v0.7 complete unless:

1. Real forecast inputs can produce provisional surf ratings when sufficient evidence exists.
2. Ratings use our agreed Flat-to-Epic vocabulary.
3. The map supports actual interactive geographic navigation.
4. Users can select forecast categories and variables.
5. A genuine colored geographic forecast heatmap works for at least one supported variable, if an accessible spatial provider is available.
6. The heatmap can be independently turned ON and OFF.
7. Direction arrows can be independently turned ON and OFF where vector data exists.
8. The heatmap opacity slider changes the actual map layer.
9. Forecast time selection updates available map data.
10. Spot selection and forecast navigation work.
11. Existing features remain operational.
12. Tests and production build pass.

If a real heatmap cannot be delivered, do not falsely mark it complete. Clearly document the blocker and preserve the working map.

**The fundamental design principle:**

Forecast category determines WHAT DATA we are looking at.

Heatmap, arrows, particles, and markers determine HOW THAT DATA IS DISPLAYED.

These are separate controls.

We want the ability to turn colored wind maps, colored swell maps, and other supported forecast layers on or off at any time.

The user should be able to view a clean map, a colored heatmap, a directional forecast, or a combination of those elements.

The goal is a genuinely useful, interactive ocean forecasting system—not a decorative map.

Begin by preserving the existing application, making real ratings operational, and then improving the map and its independent forecast visualization controls.