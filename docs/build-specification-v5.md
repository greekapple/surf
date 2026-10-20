# SURF FORECAST LAB — VERSION 0.5
## Comprehensive Interface, Interaction, and Usability Improvement Pass

You are continuing development of the existing Surf Forecast Lab v0.4 application.

This is an established React + TypeScript + Vite application, not a new project.

Your assignment is to substantially improve the entire user experience, interface behavior, information architecture, interactions, responsiveness, and presentation of forecasting information.

This is NOT a full visual redesign.

The objective is to transform the current functional prototype from a technical development dashboard into a more intuitive, responsive, polished surf forecasting application while preserving its existing architecture and capabilities.

## CRITICAL — PRESERVE THE EXISTING PROJECT

Before making changes, inspect the existing source code.

Important existing files include:

- src/App.tsx
- src/style.css
- src/pages/OceanForecastPage.tsx
- src/pages/OceanRegionalPage.tsx
- src/pages/ForecastPage.tsx
- src/pages/RegionalPage.tsx
- src/pages/QuiverPage.tsx
- src/pages/ProfilePage.tsx
- src/components/ForecastControls.tsx
- src/components/SourceMeasurement.tsx
- src/components/ConnectionPanel.tsx
- src/components/TideChart.tsx
- src/hooks/useForecast.ts
- src/hooks/useOceanData.ts
- src/ocean/
- src/recommendation/
- src/utils/storage.ts

Preserve:

- All existing working pages
- Retrieved forecast mode
- Demonstration mode
- Open-Meteo integrations
- NOAA integrations
- NOAA buoy fallback labeling
- Surf Quality Index
- Personal Match calculations
- Smart Quiver
- Spot comparison
- Experiment mode
- Wave-height settings
- User preferences
- Saved user data
- Import/export functionality
- Existing test coverage
- Current hosting configuration

Do not regenerate the application.

Do not reset Git history.

Do not change the existing localStorage key or discard stored user information.

Do not change the current site identity or hosting configuration.

Avoid modifying forecasting mathematics, provider adapters, or recommendation algorithms unless necessary to fix a demonstrated defect.

All interface changes must preserve the distinction between real retrieved data, observations, demonstration data, and hypothetical simulations.

---

# PART 1 — THE PRODUCT EXPERIENCE

## 1. Make the application forecast-first

The app's primary purpose is to serve as a comprehensive alternative to Surfline.

Forecasting must remain the central experience.

A user should be able to open the app and immediately:

- See relevant surf spots
- Open a detailed forecast
- Understand current and upcoming conditions
- Scrub through forecast times
- Compare different breaks
- Inspect swell, wind, and tide
- Understand data availability and forecast limitations

Users must not be required to create a profile, enter a quiver, or configure settings to view forecasts.

Personalized features should complement the forecast rather than dominate it.

## 2. Improve the existing navigation

Preserve the five existing primary sections:

Today
Explore
Forecast
Quiver
Profile

Improve the navigation behavior:

- Clearly identify the active section.
- Make switching sections immediate.
- Preserve selected spot and forecast time when navigating.
- Avoid unnecessary resets.
- Avoid jumping the page unexpectedly.
- Preserve relevant scroll position where practical.
- Provide clear navigation back to a selected forecast from regional views.
- Make the Forecast page easily accessible from every relevant screen.

The existing sidebar and mobile navigation may be refined for usability, but do not replace the overall application layout or undertake a major redesign.

## 3. Simplify global controls

The current app exposes several global settings prominently.

These include:

- Retrieved versus Demonstration
- Face Height versus Hawaiian
- Feet versus meters

Keep these settings functional.

However, reduce their visual competition with the actual forecast.

Recommended approach:

- Keep data mode clearly visible.
- Make measurement preferences accessible through compact segmented controls or a small settings surface.
- Preserve immediate updates.
- Keep the current selection easy to understand.

Do not bury the distinction between real and demonstration data.

---

# PART 2 — FORECAST PAGE IMPROVEMENTS

## 4. Reorganize the forecast information hierarchy

The Forecast page should have a clear reading order.

First:

Spot name
Selected date and time
Forecast data status

Second:

Estimated breaking-wave height, when available
Offshore wave height
Surf Quality Index, when available
General conditions

Third:

Primary swell
Secondary swell
Wind
Tide

Fourth:

Interactive hourly and multi-day forecasts

Fifth:

Detailed source information, confidence limitations, and technical explanations

The user should not have to scroll through source diagnostics before reaching essential surf information.

Do not hide important safety or data-availability warnings.

## 5. Improve the forecast hero

Refine the main forecast summary.

It should be easy to understand within a few seconds.

Include:

- Spot name
- Region
- Forecast time
- Main wave measurement
- Surf quality status
- Brief condition summary
- Data source status

Use clear typography and spacing.

Avoid excessive borders, nested cards, and redundant labels.

If breaking-wave height is unavailable, do not replace it with offshore swell height under a misleading label.

Display the actual available measurement with its correct name.

## 6. Improve unavailable-data states

The current retrieved-data mode appropriately identifies missing local breaking-wave estimates and insufficient data.

Preserve this behavior.

However, improve how it is communicated.

Instead of showing an empty-looking section, explain:

- What measurement is unavailable
- Why it cannot currently be calculated
- Which related measurements are available
- Whether the issue is missing local calibration, provider coverage, or another limitation

Keep explanations concise by default.

Allow users to expand for technical details.

Do not create synthetic measurements to fill the interface.

---

# PART 3 — INTERACTIVE FORECAST TIMELINE

## 7. Improve hourly time selection

The forecast timeline should become one of the application's best interactions.

Support:

- Clicking an available hour
- Touch interaction
- Horizontal scrolling
- Keyboard accessibility
- Clear selected state
- Visible date transitions
- Immediate forecast updates

The selected hour must be visually obvious.

Avoid requiring users to scroll through many disconnected buttons.

Use a compact horizontal timeline with clear time markers.

Do not invent intermediate forecast values.

If the underlying data supports only discrete forecast records, selection must snap to those records.

## 8. Add synchronized time selection

The selected forecast time should synchronize across:

- Wave-height display
- Swell measurements
- Wind measurements
- Tide display
- Surf quality
- Source information
- Spot comparison
- Board compatibility

Prevent stale values when the user changes time.

Use shared state rather than duplicating independent time controls.

## 9. Improve multi-day navigation

Create a compact, horizontally navigable daily forecast strip.

Each day should show available summary information, such as:

- Day
- Wave-height range
- Wind outlook
- Surf quality, if available
- Data availability

Selecting a day should update the hourly timeline.

Do not manufacture daily quality ratings when required inputs are missing.

Provide clear loading and unavailable states.

---

# PART 4 — SWELL INTERFACE

## 10. Improve swell presentation

Swell is one of the most important elements of the application.

Present swell components more clearly.

Support:

- Primary swell
- Secondary swell
- Additional components when available
- Offshore combined sea state

For each component, show:

- Height
- Period
- Direction
- Source
- Valid time

Do not visually imply that swell-component heights can simply be added together.

## 11. Interactive swell component selection

Allow users to tap a swell component to focus on it.

The selected component should be emphasized.

Display a short explanation of what it contributes to the forecast.

Where spot exposure information is verified, explain how the swell direction relates to the break.

Where exposure information is unavailable, say so.

Avoid generic claims that a particular swell will definitely produce good waves.

## 12. Direction visualization

Introduce a lightweight compass-style indicator for swell and wind direction.

Requirements:

- Accurate directional conventions
- Clear cardinal directions
- Correct handling of degrees
- No heavy mapping library
- Responsive display

Ensure swell direction and wind direction are interpreted using their correct conventions.

---

# PART 5 — WIND INTERFACE

## 13. Improve wind information

Present:

- Wind speed
- Wind direction
- Gusts, if available
- Wind relationship to the break, if supported
- Hourly wind changes

Wind should be easy to interpret without opening multiple technical panels.

## 14. Interactive wind timeline

Where hourly data is available, show a simple wind trend.

Selecting a time on the wind visualization should synchronize with the universal forecast time.

Avoid maintaining multiple contradictory selected times.

Use simple SVG or lightweight charting.

## 15. Explain wind quality

Provide concise descriptions such as:

- Light offshore wind
- Moderate cross-shore wind
- Strong onshore wind

Only when supported by verified spot orientation and forecast data.

Do not invent a local wind-quality classification where spot orientation is unknown.

---

# PART 6 — TIDE INTERFACE

## 16. Improve the existing tide chart

Preserve the current TideChart component.

Improve:

- Readability
- Axis labeling
- Time labels
- Selected-time marker
- Touch interaction
- Keyboard accessibility
- Responsive sizing
- Tide trend interpretation

Selecting a valid forecast time should update the tide marker.

Do not fabricate high or low tide times.

## 17. Regional versus local tide data

The current application uses regional NOAA tide information.

Clearly identify the station or reference location.

Do not imply regional tide observations are measurements taken directly at every surf break.

Preserve source transparency.

---

# PART 7 — SURF QUALITY INDEX

## 18. Improve rating presentation

The Surf Quality Index should be understandable without requiring users to inspect technical formulas.

When a score is available, show:

- Score out of 100
- Quality category
- Short explanation
- Key contributing factors

When unavailable, show:

"Insufficient data"

with a concise explanation.

Do not manufacture scores for visual completeness.

## 19. Expandable score breakdown

Create an intuitive explanation panel.

Show:

- Swell contribution
- Wind contribution
- Tide contribution
- Wave-size contribution
- Wave-organization contribution
- Missing inputs
- Data limitations

Only display calculated factors that actually exist in the underlying scoring engine.

Do not introduce new fabricated sub-scores.

## 20. Separate quality and personal match

Surf Quality Index evaluates the surf conditions.

Personal Match evaluates suitability for an individual.

These must remain separate.

Use clear labels and explanatory text.

Avoid ambiguous terminology.

Do not let user preferences alter the general Surf Quality Index.

---

# PART 8 — REGIONAL TODAY SCREEN

## 21. Improve the regional overview

Today should be a useful regional forecasting overview, not simply another copy of Explore.

Prioritize:

- Favorite spots
- Available current forecasts
- Best available conditions
- Regional swell overview
- Wind outlook
- Data freshness

Allow users to open any spot directly.

## 22. Make spot cards more informative

Each spot card should display available information such as:

- Spot name
- Region
- Wave height
- Wind
- Primary swell
- Surf quality status
- Data availability

Use a compact, consistent layout.

Do not crowd each card with every possible measurement.

## 23. Improve sorting

Support relevant sorting options:

- Surf quality
- Wave height
- Wind speed
- Favorites
- Alphabetical
- Personal match, when available

Only enable sorting methods when the necessary data exists.

Unknown scores should not be treated as zero-quality surf.

---

# PART 9 — EXPLORE SCREEN

## 24. Differentiate Explore from Today

Explore should focus on discovery and comparison.

Today should focus on current regional conditions.

Explore should support:

- Spot search
- Region filtering
- Break-type filtering
- Favorites
- Spot selection
- Side-by-side comparison

Avoid duplicating identical page layouts unnecessarily.

Reuse underlying components while providing different information priorities.

## 25. Improve spot switching

Make it easy to switch between spots without losing the selected forecast time.

Use compact selectable spot controls.

On mobile, allow horizontal scrolling.

Avoid giant lists of buttons.

## 26. Improve spot comparison

When comparing spots, use the same valid forecast time whenever possible.

Display:

- Spot name
- Wave-height measurement
- Primary swell
- Wind
- Tide reference
- Surf Quality Index
- Data availability

If one spot lacks a measurement, show unavailable rather than substituting another spot's value.

Clearly distinguish regional shared measurements from spot-specific measurements.

---

# PART 10 — SMART QUIVER INTERFACE

## 27. Improve the quiver overview

Preserve all existing board management functionality.

Make the quiver easier to browse.

Use selectable surfboard cards with:

- Manufacturer
- Model
- Nickname
- Length
- Volume
- Board category

Allow users to select a board for detailed inspection.

Do not generate surfboard images or photography.

Simple CSS silhouettes may be used only if they are lightweight and not misleading representations of actual board shapes.

## 28. Improve board editing

Make adding and editing boards more intuitive.

Group information into:

Basic information
Dimensions
Shape characteristics
Preferred conditions
Personal notes

Use sliders only for values where sliders are genuinely useful.

Keep precise numeric inputs for surfboard dimensions.

Do not replace precise dimension entry with imprecise sliders.

## 29. Improve board comparisons

Allow users to compare two saved boards.

Emphasize differences in:

- Length
- Width
- Thickness
- Volume
- Category
- Intended conditions

Preserve actual stored values.

## 30. Improve board recommendations

When sufficient forecast data exists, display the recommended board clearly.

Explain why it was selected.

When breaking-wave conditions are unavailable, preserve the existing limitation.

Do not recommend a board based on unsupported assumptions.

Allow users to inspect their quiver even when recommendations are unavailable.

---

# PART 11 — PROFILE AND SETTINGS

## 31. Improve settings organization

Group settings into:

Surf preferences
Experience
Measurement units
Favorite spots
Data management

Avoid presenting one long list of unrelated controls.

## 32. Better selection controls

Use segmented controls for:

- Experience level
- Hawaiian versus face height
- Measurement units where practical

Use sliders for:

- Preferred wave-height range
- Maximum comfortable wave size

Retain precise values and accessible keyboard input.

## 33. Improve import/export usability

Preserve the existing JSON backup system.

Add clear feedback for:

- Successful export
- Successful import
- Invalid file
- Validation failure
- Reset confirmation

Never overwrite stored information without appropriate confirmation.

---

# PART 12 — EXPERIMENT MODE

## 34. Make simulation mode unmistakable

Experiment mode must remain separate from retrieved forecast data.

Display a persistent label:

SIMULATION — NOT ACTUAL FORECAST

Use clear visual distinction.

Do not let simulated conditions silently appear in real forecast comparisons.

## 35. Improve simulation controls

Use interactive sliders for:

- Wind speed
- Swell direction
- Swell period
- Hypothetical wave height
- Tide conditions

Show current values next to controls.

Provide reset functionality.

Changes should update the relevant hypothetical calculations immediately.

## 36. Explain simulation limitations

Make clear that changing a variable does not automatically produce a physically accurate ocean forecast.

If a calculation requires unavailable nearshore modeling, label the result as limited or unavailable.

Do not add fabricated physics.

---

# PART 13 — SOURCE TRANSPARENCY

## 37. Improve data provenance without hiding it

The application already includes detailed source information.

Preserve it.

However, make the default interface easier to read.

Use compact source labels and expandable details.

For each measurement, preserve access to:

- Provider
- Observation or forecast
- Valid time
- Issue or observation time
- Units
- Data freshness
- Relevant limitations

Do not bury critical stale-data or unavailable-data warnings.

## 38. Connection status

Refine the ConnectionPanel presentation.

Keep provider status accessible.

Avoid allowing connection diagnostics to dominate the main forecast screen.

Use clear states:

- Available
- Loading
- Partial
- Unavailable
- Saved historical observation

Do not label the saved NOAA buoy fallback as live.

---

# PART 14 — LOADING, ERRORS, AND EMPTY STATES

## 39. Improve loading behavior

When switching spots or retrieving forecasts:

- Show a clear loading state.
- Avoid unnecessary page flicker.
- Preserve existing data only when clearly labeled as previous or stale data.
- Prevent old measurements from appearing as current for the newly selected spot.

## 40. Improve error messages

Use plain language.

Examples:

"Wind data is temporarily unavailable."

"NOAA tide information could not be retrieved."

"Breaking-wave estimates require additional local data."

Provide retry actions when supported.

Avoid exposing raw technical errors as the primary message.

## 41. Empty states

Create useful empty states for:

- Empty quiver
- No favorite spots
- Missing forecast data
- No comparison selections
- No suitable personal recommendation

Each should explain what the user can do next.

Avoid dead ends.

---

# PART 15 — MOBILE AND RESPONSIVENESS

## 42. Improve mobile usability

Prioritize:

- Touch-friendly controls
- Horizontal scrolling for timelines
- Readable forecast measurements
- Compact spot cards
- Accessible bottom navigation
- Minimal unnecessary vertical scrolling
- No horizontal page overflow

Ensure important controls remain usable on narrow screens.

## 43. Desktop improvements

Use the available screen width more effectively.

Avoid excessive empty space or unnecessarily narrow content.

Maintain readable line lengths.

Improve alignment between related forecast sections.

Do not undertake a full desktop layout redesign yet.

## 44. Accessibility

Ensure:

- Visible focus states
- Keyboard navigation
- Accessible control labels
- Sufficient text contrast
- Proper button semantics
- Screen-reader-friendly status updates
- No color-only meaning
- Reduced-motion support where applicable

Charts must have textual equivalents for essential values.

---

# PART 16 — MICRO-INTERACTIONS

## 45. Immediate feedback

Important controls should respond immediately.

Examples:

- Selecting a spot updates the forecast.
- Selecting a time updates all measurements.
- Favoriting a spot updates the favorites view.
- Changing measurement units updates displayed values.
- Selecting a board updates its details.

Avoid unnecessary save buttons for reversible preferences.

## 46. Subtle motion

Allow only restrained transitions where they improve usability.

Examples:

- Selected-state transitions
- Expand/collapse behavior
- Small chart marker changes
- Hover and focus feedback

Do not add:

- Parallax
- Decorative animations
- Page-intro sequences
- Heavy motion libraries
- Animated backgrounds

Respect reduced-motion preferences.

---

# PART 17 — COMPONENT CONSISTENCY

## 47. Consolidate repeated interface patterns

Review repeated controls and displays.

Create or improve shared components for:

- Metric display
- Source label
- Quality score
- Empty state
- Loading state
- Spot card
- Day selector
- Time selector
- Segmented control
- Expandable detail section

Avoid creating a large design system prematurely.

The goal is consistency and maintainability.

## 48. Preserve domain logic

Keep forecast and recommendation calculations outside UI components.

Do not duplicate scoring logic in presentation components.

Do not introduce new calculations solely to make a chart look better.

---

# PART 18 — TESTING AND VERIFICATION

## 49. Regression testing

Before and after implementation, run the existing test suite.

Verify:

- Retrieved-data mode
- Demonstration mode
- Forecast timeline synchronization
- Spot selection
- Source attribution
- Missing-data handling
- Wave-height conversion
- Surf Quality Index
- Personal Match
- Quiver management
- Experiment isolation
- Import/export
- localStorage persistence

Do not remove or weaken existing tests to make the build pass.

## 50. Interaction tests

Add tests for:

- Navigation state persistence
- Time selection
- Day selection
- Spot switching
- Forecast loading states
- Measurement preferences
- Comparison selection
- Empty states
- Unavailable data
- Simulation mode switching

## 51. Build verification

Run the TypeScript checks and production build.

Fix introduced errors.

Verify the interface at mobile, tablet, and desktop widths.

Check for overflowing controls and broken interactions.

---

# PART 19 — IMPLEMENTATION PRIORITY

Do not attempt every improvement simultaneously.

Implement in this order:

### Phase 1 — Core forecast experience

- Forecast hierarchy
- Forecast hero
- Hourly timeline
- Day selection
- Global controls
- Data status

### Phase 2 — Forecast interpretation

- Swell component interaction
- Wind display
- Tide chart
- Source details
- SQI explanations

### Phase 3 — Regional navigation

- Today
- Explore
- Spot switching
- Favorites
- Comparisons

### Phase 4 — Personal features

- Quiver browsing
- Board editing
- Board comparison
- Profile settings

### Phase 5 — Supporting interactions

- Experiment mode
- Loading states
- Error handling
- Empty states
- Accessibility

### Phase 6 — Verification

- Automated tests
- Build
- Mobile responsiveness
- Regression checks

Prioritize the most noticeable usability improvements first.

If development resources are limited, finish the current phase properly rather than leaving many partially implemented features.

---

# PART 20 — WHAT NOT TO CHANGE

Do not:

- Rebuild the application from scratch.
- Replace the entire layout.
- Change the fundamental visual identity.
- Introduce photography.
- Introduce video.
- Add complex maps.
- Add social features.
- Add authentication.
- Add a new database.
- Replace the forecasting providers.
- Invent new forecast values.
- Invent new rating calculations.
- Change the scoring engine without a verified reason.
- Remove missing-data warnings.
- Discard saved user data.
- Break existing navigation.
- Introduce heavy dependencies.
- Add features unrelated to interface usability.

The future commercial website will receive a dedicated design and product expansion phase.

This pass should improve the existing experience rather than redefine the product.

---

# FINAL OBJECTIVE

Transform Surf Forecast Lab v0.4 into a noticeably more intuitive and enjoyable v0.5 experience.

The application should feel:

- Faster
- Clearer
- More interactive
- More organized
- Easier to navigate
- Easier to understand
- More consistent
- More professional

Most importantly, it should make complex ocean forecasting information easier to interpret without compromising scientific honesty.

Preserve the underlying forecasting architecture and current functionality.

Make substantial usability improvements while keeping the visual footprint broadly recognizable.

After implementation, provide a concise summary of:

1. What changed
2. What was preserved
3. What was tested
4. What remains incomplete
5. Any limitations discovered

Begin by inspecting the current project and implementing the highest-priority forecast interface improvements.