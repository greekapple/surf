# SURF — MASTER DEVELOPMENT PROMPT v0.6
## Real Surf Ratings, Interactive Forecast Maps, and Complete Forecast Experience

You are continuing development of the existing SURF application.

This is an established React + TypeScript + Vite project. You must inspect the existing codebase before making changes.

The goal is to build a powerful, intuitive, data-driven surf forecasting platform that can eventually compete with Surfline while developing its own identity.

This is an expansion and refinement of the existing application, NOT a rebuild.

**The three primary objectives of v0.6 are:**

1. Implement our new surf rating system with transparent, consistent, spot-specific scoring.
2. Build an interactive regional surf forecast map with real forecast layers and synchronized time controls.
3. Integrate all existing forecasting, comparison, personalization, and interface features into a cohesive user experience.

We are not ready for the final visual redesign. Prioritize functionality, accuracy, usability, responsiveness, and code portability.

---

# 1. PRESERVE THE EXISTING APPLICATION

Before modifying anything:

- Inspect the current project structure.
- Identify the existing forecasting services, data types, pages, hooks, scoring algorithms, and UI components.
- Run existing tests and record the baseline.
- Preserve all working functionality and user data.
- Preserve the current hosting configuration.
- Preserve Git history.
- Avoid unnecessary dependencies.
- Make incremental, reversible changes.

Do not regenerate the project.

Do not replace the application with a simplified mockup.

Do not silently remove existing features.

Existing functionality that must remain operational includes:

- Open-Meteo Marine integration
- Open-Meteo Weather integration
- NOAA NDBC buoy observations
- NOAA CO-OPS tide information
- Retrieved forecast mode
- Clearly identified demonstration mode
- Existing Surf Quality Index logic until the replacement is validated
- Personal Match
- Smart Quiver
- Board editing and storage
- Regional spot exploration
- Spot comparison
- Experiment mode
- Wave-height display preferences
- Source attribution
- Import/export
- Local persistence

Preserve compatibility with existing stored board and profile data.

Keep the application portable so the source can later be developed in Cursor, GitHub, and other standard React environments.

Avoid Astra-specific dependencies where practical.

---

# 2. PRODUCT DIRECTION

SURF is primarily a surf forecasting platform.

It should answer:

- Where should I surf?
- When should I surf?
- How big will the waves be?
- What swell is arriving?
- How will wind affect the conditions?
- What is the tide doing?
- How will conditions change throughout the day?
- Which nearby breaks have better conditions?
- How reliable is the forecast?
- Which board from my quiver would suit the conditions?

Users should be able to use the complete forecast platform without creating a profile or entering surfboards.

Personalization is optional.

The general surf rating must never be influenced by an individual's skill level, preferences, or board collection.

---

# 3. OFFICIAL SURF RATING SYSTEM

Replace the previous public-facing rating categories with the following system.

This is the agreed v0.6 rating vocabulary.

## Rating categories

EPIC — 95–100
Rare, outstanding conditions. The best surf a spot can realistically offer.

FIRING — 85–94
Excellent surf with strong wave quality, organization, and favorable conditions.

GOOD — 75–84
Consistently high-quality surf with favorable conditions.

SOLID — 65–74
Reliable, worthwhile surf with some imperfections.

NOT BAD — 55–64
Reasonably enjoyable conditions. Some limitations, but definitely worth considering.

SURFABLE — 40–54
Rideable waves with meaningful compromises.

WEAK — 25–39
Limited wave quality, poor organization, weak energy, or otherwise unfavorable conditions.

POOR — 0–24
Generally undesirable surf conditions.

FLAT — Separate classification
No meaningful rideable breaking waves at the selected spot.

UNRATED — Separate classification
Insufficient reliable information to determine surf quality.

The progression is:

FLAT → POOR → WEAK → SURFABLE → NOT BAD → SOLID → GOOD → FIRING → EPIC

Unrated is not part of the quality progression.

## Important classification rules

Flat is not simply the lowest numerical score.

A location can have ideal wind and tide but no surfable waves.

When reliable spot-specific evidence indicates no meaningful rideable waves, classify the conditions as Flat regardless of favorable environmental factors.

Do not classify a spot as Flat merely because forecast data is missing.

When sufficient information is unavailable, classify it as Unrated.

Epic must be rare.

Do not award Epic simply because wind is offshore or swell period is long.

Require exceptional wave potential, favorable conditions, and sufficiently reliable spot-specific inputs.

These numerical thresholds are an initial product specification, not proof of forecast accuracy.

The underlying scoring model must be calibrated and verified against observations before its scores are presented as scientifically validated.

---

# 4. BUILD THE SURF CONDITIONS ENGINE

Create a maintainable scoring engine that separates:

1. Data sufficiency
2. Wave potential
3. Environmental conditions
4. Spot-specific characteristics
5. Score calculation
6. Public rating classification
7. Explanation generation
8. Reliability assessment

Do not mix this logic directly into React UI components.

## Wave potential

Use available information such as:

- Offshore wave height
- Primary swell height
- Primary swell period
- Primary swell direction
- Secondary swell characteristics
- Combined sea state
- Verified spot exposure
- Verified breaking-wave estimates, where available

Do not use a universal offshore-to-breaking-wave multiplier.

Do not assume swell height equals breaking-wave face height.

Do not assume two swell components can be added directly to calculate surf height.

If essential nearshore information is missing, retain an Unrated result rather than manufacturing precision.

## Environmental conditions

Evaluate supported factors including:

- Wind speed
- Wind direction
- Wind gusts
- Offshore/onshore/cross-shore relationship
- Tide stage
- Tide height
- Tide trend
- Swell interference
- Wave organization indicators, when available

Do not assign favorable or unfavorable conditions without the required local context.

For example, offshore wind classification requires a verified spot orientation.

Tide suitability requires actual spot-specific knowledge or calibration.

## Spot-specific calibration

Create an extensible spot metadata system that can store:

- Spot coordinates
- Region
- Break type
- Exposure
- Orientation
- Relevant swell windows
- Preferred wind directions
- Tide sensitivities
- Known limitations
- Calibration status
- Data sources

Distinguish verified metadata from assumptions.

Do not invent local bathymetry, preferred tide windows, or ideal swell directions.

Create a structure that allows future incorporation of:

- Historical forecast verification
- Observed breaking-wave heights
- Buoy observations
- User-submitted surf reports
- Spot-specific model corrections
- Nearshore wave transformation models

Do not claim these future capabilities already exist.

## Scoring approach

Use a documented and deterministic provisional model where adequate inputs exist.

The model should account for interacting factors rather than blindly averaging independent scores.

For example:

- Strong swell potential can be degraded by unfavorable wind.
- Good wind cannot create waves when no meaningful swell reaches the break.
- Favorable swell direction matters differently at different breaks.
- Multiple swell components may affect organization.
- Tide suitability varies by location.

Avoid inventing precision through unsupported weights.

Any provisional coefficients must be clearly documented and marked as unvalidated.

If adequate inputs do not exist, return Unrated.

---

# 5. RATING EXPLANATIONS

Every rating should be explainable.

A user should be able to tap the rating and see:

- Overall numerical score
- Rating category
- Main positive factors
- Main negative factors
- Available component contributions
- Missing information
- Forecast reliability
- Data sources

Example of interface language:

GOOD — 79/100

"Favorable swell direction and light wind. Tide may reduce consistency later in the morning."

Only generate explanations from actual available inputs and documented rules.

Do not fabricate observations or qualitative judgments.

The rating breakdown should be readable by an ordinary surfer, with technical details available through expansion.

---

# 6. FORECAST RELIABILITY

Separate surf quality from forecast reliability.

A high surf-quality score does not necessarily mean a highly reliable forecast.

Use reliability categories:

HIGH
MODERATE
LIMITED
INSUFFICIENT

Base these classifications on measurable evidence such as:

- Input completeness
- Provider freshness
- Forecast horizon
- Local calibration coverage
- Observation availability
- Verified forecast performance, when available

Do not create arbitrary confidence percentages.

Do not equate a functioning API response with a highly reliable surf forecast.

If reliability cannot be assessed, display the limitation.

---

# 7. INTERACTIVE SURF FORECAST MAP

Build a real, interactive map experience.

The map should become a central part of Explore and be accessible from Forecast.

## Map capabilities

Users must be able to:

- Open and close the map
- Pan
- Zoom
- Select surf spots
- Inspect forecast summaries
- Change forecast time
- Switch forecast layers
- Open a spot's detailed forecast
- Compare nearby spots

Use a suitable lightweight mapping library, such as MapLibre GL JS, if compatible with the existing project.

Do not use a static screenshot as the map.

Do not require users to leave SURF to inspect forecast conditions.

## Map presentation

Use a clean basemap emphasizing:

- Coastline
- Ocean
- Geographic orientation
- Surf spot locations
- Relevant forecast information

Avoid unnecessary map clutter.

Spot markers should be selectable.

When an actual rating is available, markers may display rating colors.

When ratings are unavailable, use a neutral Unrated appearance.

Do not fabricate scores for map markers.

---

# 8. FORECAST MAP LAYERS

Provide an intuitive layer selector.

Initial layer categories:

SWELL
WIND
WAVES
TIDE

Each layer must be backed by appropriate data.

## Swell layer

Where actual spatial forecast data is available, visualize:

- Swell height
- Swell direction
- Swell period

Use directional arrows or vectors where supported.

Allow users to switch between available swell-related variables.

Clearly identify offshore model data versus nearshore estimates.

## Wind layer

Visualize:

- Wind speed
- Wind direction
- Gusts, where available

Use arrows or optional lightweight wind-flow animation.

Do not animate invented wind fields.

## Waves layer

Visualize available modeled wave-height information.

Distinguish:

- Combined offshore sea state
- Swell components
- Estimated breaking waves, only when supported

Never label offshore significant wave height as surf face height.

## Tide layer

Display relevant tide stations and their predictions.

Provide station-specific tide curves and forecast times.

Do not create an invented continuous tide-height surface across the ocean.

## Spatial data requirements

A true regional forecast overlay requires spatially distributed data.

Point forecasts from Open-Meteo must not be stretched into a continuous colored map without a justified interpolation method and clear labeling.

Investigate suitable legitimate gridded marine forecast sources or map-tile providers.

If suitable spatial data is not available, implement an honest fallback:

- Interactive geographic map
- Real spot markers
- Real point-based measurements
- Direction indicators at supported locations
- No fabricated continuous forecast layer

Preserve the map's usability even when full regional overlays are unavailable.

---

# 9. MAP TIME SLIDER AND PLAYBACK

Add a shared forecast-time controller.

The user should be able to:

- Drag a time slider
- Select a forecast hour
- Move forward or backward
- Play a forecast animation
- Pause playback
- Switch forecast days

The selected time should update:

- Map forecast layers
- Spot markers
- Spot preview cards
- Swell information
- Wind information
- Wave measurements
- Surf rating
- Reliability status

Use only actual available forecast timestamps.

Do not fabricate intermediate measurements.

If providers have different time resolutions, align records transparently and avoid silently displaying mismatched times as simultaneous.

Provide a clear forecast-valid timestamp and local time zone.

Pause playback when necessary to prevent excessive network usage.

---

# 10. MAP AND FORECAST SYNCHRONIZATION

The map must be integrated with the rest of SURF.

When a user selects a spot:

- Highlight the spot.
- Open a compact forecast preview.
- Display available wave, swell, wind, and rating information.
- Allow opening the full forecast.

When a user selects a forecast time:

- Update the selected spot's measurements.
- Update the map.
- Update ratings when valid inputs exist.

When navigating between map and forecast:

- Preserve the selected spot.
- Preserve the selected forecast time when supported.
- Preserve relevant unit preferences.

Use shared application state.

Avoid duplicated independent selection logic.

---

# 11. FORECAST PAGE IMPROVEMENTS

Continue the v0.5 interface improvements.

The Forecast page should prioritize:

1. Spot name and forecast time
2. Main wave measurement
3. Surf rating
4. Primary swell
5. Secondary swell
6. Wind
7. Tide
8. Interactive hourly forecast
9. Multi-day outlook
10. Source details and limitations

Do not make technical diagnostics the first thing users see.

## Forecast hero

Provide a clear summary containing:

- Spot
- Selected time
- Wave-height measurement
- Rating category
- Numerical score, if available
- Reliability
- Short conditions explanation
- Data status

## Hourly forecast

Create a synchronized horizontal timeline.

Support:

- Mouse
- Touch
- Keyboard
- Scrolling
- Day transitions
- Selected-time highlighting

## Multi-day forecast

Show available daily outlook information.

Do not create daily scores from incomplete data.

## Forecast graphs

Improve or introduce lightweight graphs for:

- Wave height
- Swell period
- Wind speed
- Tide

Selecting a time in one graph should update the shared forecast selection.

Avoid overly complex chart libraries where simple SVG or existing components suffice.

---

# 12. SWELL INTERACTIONS

Create a more intuitive swell display.

Allow users to inspect:

- Primary swell
- Secondary swell
- Additional swell components, if available
- Combined sea state

For each component, show available:

- Height
- Period
- Direction
- Source
- Valid time

Add a compact direction visualization.

Use correct directional conventions.

Allow selecting a swell component to highlight it.

Do not claim a swell component will produce a particular breaking-wave height without appropriate modeling.

---

# 13. WIND INTERACTIONS

Improve the wind interface.

Show:

- Speed
- Direction
- Gusts
- Hourly trend
- Spot-relative wind relationship, when supported

Add an intuitive direction indicator.

Use concise descriptions such as:

- Light offshore
- Moderate cross-shore
- Strong onshore

Only when supported by verified spot orientation.

---

# 14. TIDE INTERACTIONS

Preserve and improve the existing TideChart.

Support:

- Selected-time marker
- Clear time labels
- Tide height
- Rising/falling status
- High/low predictions, when available
- Station attribution

Synchronize the tide chart with forecast time.

Do not imply a regional tide station is located at every surf break.

---

# 15. REGIONAL TODAY EXPERIENCE

Today should provide a quick regional overview.

Prioritize:

- Favorite spots
- Current available conditions
- Surf ratings
- Regional swell information
- Wind outlook
- Data freshness

Use compact spot cards.

Users should be able to open a spot's detailed forecast immediately.

Do not require personalization to use Today.

---

# 16. EXPLORE EXPERIENCE

Explore should focus on discovering and comparing surf breaks.

Include:

- Spot search
- Region filtering
- Break-type filtering
- Favorites
- Map/list toggle
- Spot comparison
- Rating-based sorting, where available

Keep Today and Explore distinct.

Today answers "What's happening?"

Explore answers "Where should I go?"

---

# 17. SPOT COMPARISON

Allow comparison of multiple spots at the same selected forecast time.

Compare:

- Wave-height measurement
- Primary swell
- Wind
- Tide reference
- Rating
- Reliability
- Data availability

Do not rank Unrated spots as if they have zero-quality surf.

When measurements come from shared regional sources, clearly identify that.

Support opening a compared spot directly.

---

# 18. SMART QUIVER

Preserve Smart Quiver as a secondary but valuable part of SURF.

Users should be able to:

- Add boards
- Edit boards
- Delete boards
- View board specifications
- Compare boards
- Save preferences
- Receive supported board recommendations

## Board details

Preserve:

- Manufacturer
- Model
- Nickname
- Length
- Width
- Thickness
- Volume
- Category
- Intended conditions
- Notes

## Recommendations

Personal Match must remain separate from the general surf rating.

A surf rating should not change based on the user's board collection.

When sufficient information exists, explain why a board may suit the conditions.

When critical breaking-wave information is unavailable, do not invent precise compatibility.

Keep the quiver fully usable even when recommendation data is incomplete.

---

# 19. EXPERIMENT MODE

Preserve the existing experimental controls.

Clearly label:

SIMULATION — NOT ACTUAL FORECAST

Allow users to adjust hypothetical:

- Swell height
- Swell direction
- Swell period
- Wind
- Tide
- Wave height

Do not mix simulated results into retrieved forecasts.

Do not present heuristic experiments as physically accurate ocean simulations.

If the rating engine can evaluate a hypothetical scenario, label the result as provisional and simulated.

---

# 20. USER INTERFACE PRINCIPLES

Continue improving the current interface without a full visual redesign.

Prioritize:

- Clear information hierarchy
- Compact controls
- Segmented toggles
- Horizontal sliders
- Swipeable forecast timelines
- Interactive graphs
- Expandable technical details
- Consistent spacing
- Clear selected states
- Responsive navigation
- Fast spot switching

Avoid:

- Dropdown-heavy forms
- Excessive nested cards
- Repeated information
- Decorative animations
- Heavy visual effects
- Large unused whitespace
- Overly technical labels in primary views

Use subtle transitions only where they improve usability.

Preserve accessible keyboard and touch interaction.

Respect reduced-motion preferences.

---

# 21. MEASUREMENT PREFERENCES

Preserve:

- Feet/meters
- Face-height display
- Hawaiian-height display

Important:

The Hawaiian display preference must affect only the relevant breaking-wave-height presentation.

It must not alter:

- Offshore wave measurements
- Swell measurements
- Source data
- Rating calculations
- Underlying forecast values

Any Hawaiian-height conversion must be labeled as an approximation rather than a scientifically universal conversion.

Do not apply it when breaking-wave height is unavailable.

---

# 22. REAL DATA AND HONESTY

This is a core product requirement.

Distinguish:

- Live observations
- Recent observations
- Model forecasts
- Historical observations
- Demonstration values
- Hypothetical simulations
- Missing data

For important measurements, preserve:

- Provider
- Valid time
- Retrieval or observation time
- Units
- Source status
- Relevant limitations

Do not invent measurements to fill interface gaps.

Do not use a fallback demonstration value without identifying it.

Do not label saved buoy data as live.

Do not treat offshore wave forecasts as verified nearshore breaking-wave predictions.

If APIs are unavailable in the development environment, provide a clearly labeled demo mode while keeping the real-data integration architecture intact.

---

# 23. PERFORMANCE AND PORTABILITY

Keep the application lightweight.

Implement appropriate:

- Forecast request caching
- Request deduplication
- Cancellation of obsolete requests
- Lazy loading for map functionality
- Efficient chart rendering
- Reuse of fetched measurements
- Error boundaries
- Responsive loading states

Avoid repeated API requests whenever the user moves a slider between already loaded forecast hours.

Keep external providers isolated behind service adapters.

Do not hardcode API credentials.

Document any required API keys, provider terms, licensing restrictions, attribution requirements, and deployment configuration.

Ensure the application remains runnable as a standard React + TypeScript + Vite project outside Astra.

---

# 24. TESTING REQUIREMENTS

Before making changes, run the existing tests.

After implementation, verify:

- Production build
- TypeScript compilation
- Existing forecast behavior
- Retrieved/demo separation
- Source attribution
- Missing-data behavior
- Rating classification boundaries
- Flat override
- Unrated behavior
- Epic qualification rules
- Rating explanation consistency
- Map spot selection
- Map time synchronization
- Layer switching
- Forecast playback
- Spot comparisons
- Quiver persistence
- Personal Match independence
- Experiment isolation
- Measurement conversions
- Mobile responsiveness
- Keyboard accessibility

Do not remove tests to make the build pass.

Add focused tests for new scoring and map functionality.

---

# 25. IMPLEMENTATION ORDER

Work incrementally.

## Phase 1 — Rating system

- Introduce the new rating vocabulary.
- Implement classification boundaries.
- Preserve Unrated and Flat logic.
- Add rating explanations.
- Separate reliability from quality.
- Add tests.

## Phase 2 — Map foundation

- Implement interactive basemap.
- Add surf spot markers.
- Add spot preview cards.
- Connect map to existing forecast state.
- Add map/list navigation.

## Phase 3 — Map forecast controls

- Add swell/wind/waves/tide selectors.
- Add time slider.
- Add playback.
- Implement actual supported data layers.
- Clearly label unsupported layers.
- Add appropriate caching.

## Phase 4 — Forecast integration

- Synchronize maps and forecast pages.
- Improve hourly and daily timelines.
- Improve swell, wind, and tide visualizations.
- Connect ratings and source explanations.

## Phase 5 — Regional and personal features

- Improve Today and Explore.
- Improve comparisons.
- Refine Smart Quiver interactions.
- Preserve profile settings and saved data.

## Phase 6 — Verification and handoff

- Run tests.
- Fix regressions.
- Verify responsive behavior.
- Update development documentation.
- Export complete source.

If a phase cannot be completed with available data or tooling, preserve the working implementation, document the limitation, and proceed only where doing so will not create misleading functionality.

Do not substitute fake data or decorative visualizations for incomplete engineering.

---

# 26. FINAL DELIVERABLE

Deliver a functional Surf v0.6 application with:

- Our new rating vocabulary
- Transparent scoring behavior
- Honest Flat and Unrated classifications
- Surf-quality explanations
- Separate forecast reliability
- An interactive geographic surf map
- Working spot selection
- Forecast time synchronization
- Supported swell/wind/wave/tide map controls
- Improved forecast timelines
- Better spot comparison
- Preserved Smart Quiver
- Preserved real-data integrations
- Responsive interface
- Passing tests
- Portable source code

Also provide a development handoff documenting:

1. What was implemented
2. What was preserved
3. Which map layers use actual spatial data
4. Which layers are point-based or unavailable
5. Which rating calculations remain provisional
6. What was tested
7. Known limitations
8. External dependencies and data licenses
9. How to run the project outside Astra
10. Recommended next development steps

Do not claim a feature is complete unless it works.

Do not claim forecast accuracy has been validated without supporting evidence.

**Final objective:** Make SURF a more complete, interactive, understandable, and credible surf forecasting platform while preserving the existing codebase and preparing it for future development outside Astra.

Begin by inspecting the current implementation and completing Phase 1 before proceeding to the map.