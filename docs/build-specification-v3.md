# MASTER BUILD PROMPT — NEXT-GENERATION SURF FORECAST PLATFORM
## Version 3.0 — Full Surfline Alternative, Original Rating System, and Smart Quiver

You are acting as a senior product architect, full-stack engineer, surf forecasting specialist, and interaction designer.

Your task is to create a functional prototype for a new surfing forecast platform designed to improve upon the limitations of existing surf forecasting applications, particularly Surfline.

This is not merely a surfboard recommendation application.

**The primary product is a comprehensive surf forecasting platform.**

The Smart Quiver and personalized recommendations are additional differentiating features that make the platform more useful.

The application must be valuable even to surfers who never create a quiver or use personalization.

## 1. Core product objectives

Build a platform that allows users to:

1. View detailed surf forecasts for individual breaks.
2. Understand current and future swell, wind, tide, and wave conditions.
3. Explore forecast changes across hours and days.
4. Compare different surf spots.
5. Understand why surf conditions are rated positively or negatively.
6. Choose between Hawaiian and face-height wave measurements.
7. View a transparent, original surf quality rating.
8. Receive personalized spot recommendations based on experience and preferences.
9. Create and manage a personal surfboard quiver.
10. Receive board recommendations based on conditions.
11. Understand how reliable the forecast information is.
12. Save favorite spots and personal preferences.

The forecasting experience must stand independently from the recommendation features.

---

# PART A — DESIGN PHILOSOPHY

## 2. Functional first, minimal presentation

The current development stage is a functional prototype.

Do not spend substantial resources on:

- Photography
- Generated images
- Videos
- Elaborate branding
- Complex animations
- Decorative effects
- Advanced visual polish

However, the application must still have a thoughtfully designed interaction structure.

Avoid conventional dropdown-heavy dashboards.

Prefer:

- Horizontal forecast timelines
- Interactive charts
- Segmented controls
- Swipeable spot cards
- Expandable forecast details
- Tap-to-select conditions
- Compact comparison interfaces
- Sliders for numerical inputs
- Clear bottom navigation

The eventual visual identity will be developed separately.

For now, prioritize speed, usability, clarity, and working interactions.

## 3. Information hierarchy

The interface should prioritize:

1. Surf spot name and forecast time
2. Estimated breaking-wave height
3. Surf quality rating
4. Swell conditions
5. Wind conditions
6. Tide conditions
7. Hourly forecast timeline
8. Multi-day outlook
9. Detailed forecast components
10. Personalized recommendations, when enabled

Avoid requiring users to create an account or configure a quiver before viewing forecasts.

---

# PART B — APPLICATION STRUCTURE

## 4. Main navigation

Create five sections:

**Today**
A regional overview with current sample conditions, favorite spots, and the best-rated surfing opportunities.

**Explore**
Browse, search, filter, and compare surf breaks.

**Forecast**
The primary detailed forecasting interface for a selected surf spot.

**Quiver**
Manage surfboards and receive optional equipment recommendations.

**Profile**
Preferences, experience level, saved locations, and measurement settings.

The Forecast screen should be one of the most developed parts of the application.

---

# PART C — COMPLETE SURF FORECAST

## 5. Spot forecast overview

Every surf spot should have its own forecast page.

Display:

- Spot name
- Region
- Break type
- Estimated breaking-wave face height
- Surf quality score
- Wave character
- Primary swell
- Secondary swell
- Wind speed
- Wind direction
- Wind relationship to the break
- Tide height
- Tide trend
- Water temperature, if available
- Forecast valid time
- Forecast source
- Data freshness

Do not confuse offshore swell height with breaking-wave height.

All prototype conditions must be labeled as demonstration data.

## 6. Hourly forecasting

Create a shared interactive forecast timeline.

Users should be able to drag or tap through available forecast hours.

Updating the selected hour should immediately update:

- Breaking-wave height
- Swell components
- Wind
- Tide
- Surf quality rating
- Forecast explanations
- Board recommendations
- Spot suitability

Use deterministic sample data.

Do not generate random conditions on each refresh.

## 7. Multi-day forecasting

Support a seven-day sample forecast.

Display a compact overview for each day.

Include:

- Estimated wave-height range
- Best-rated time
- Average or representative wind conditions
- Primary swell direction
- Quality outlook

Allow users to select a day and inspect its hourly data.

Use actual records from the sample dataset rather than inventing values for missing hours.

## 8. Swell breakdown

Include separate displays for:

- Primary swell height
- Primary swell period
- Primary swell direction
- Secondary swell height
- Secondary swell period
- Secondary swell direction
- Combined offshore wave conditions, if supplied

Support optional tertiary swell components in the data model.

Allow users to select swell components interactively.

Explain how each swell interacts with the configured spot exposure.

Do not mathematically add swell heights to estimate breaking-wave height.

## 9. Wind analysis

Display:

- Wind speed
- Wind direction
- Wind gusts, when available
- Offshore/onshore/cross-shore relationship
- Wind quality indicator
- Hourly wind changes

Use each break's shoreline orientation to determine wind relationships.

Use meteorological wind direction conventions consistently.

Do not assume all offshore wind is automatically favorable.

## 10. Tide information

Display:

- Tide height
- Tide stage
- Rising/falling trend
- High and low tide times, when available
- Spot-specific tide compatibility

Create a simple interactive tide curve or equivalent lightweight visualization.

Selecting a forecast time should update the corresponding tide marker.

Do not invent tide extrema from incomplete data.

## 11. Wave height conventions

Create a global setting:

Face Height | Hawaiian

Face Height represents estimated breaking-wave face height.

Hawaiian scale is a surfing convention, often approximately half the face-height estimate, but not universally standardized.

Use a clearly labeled approximate conversion for the prototype.

Changing the setting must affect only breaking-wave height displays.

It must not change underlying forecast data, rating calculations, or recommendations.

Support feet and meters as separate display-unit preferences.

---

# PART D — ORIGINAL SURF QUALITY RATING

## 12. Create a new rating system

Do not copy Surfline's proprietary rating algorithm or reproduce its rating labels as the central product identity.

Develop a transparent original scoring system called:

**Surf Quality Index (SQI)**

SQI ranges from 0 to 100.

It evaluates how favorable the surf conditions are for a specific break at a specific time.

SQI is independent of the user's skill level or personal equipment.

## 13. Initial SQI factors

Use these initial configurable weights:

- Swell alignment and exposure: 25%
- Wind conditions: 25%
- Tide compatibility: 15%
- Wave-size suitability for the break: 15%
- Expected wave organization and shape: 20%

These weights are prototype heuristics and are not scientifically validated.

Calculate each factor deterministically.

Normalize the combined result to 0–100.

Do not invent scores independently from the factor calculations.

## 14. Spot-specific scoring

A wave that is excellent at one break may be poor at another.

Use each spot's configured characteristics to evaluate:

- Ideal swell direction
- Suitable wave-size range
- Preferred tide conditions
- Wind exposure
- Break type
- Wave character

Do not reward wave height simply for being larger.

For example, a clean small-wave longboard break may receive a higher SQI than a blown-out overhead beach break.

## 15. Rating presentation

Display:

- Numerical SQI score
- Simple quality description
- Contributing factors
- Positive conditions
- Negative conditions
- Explanation of the score

Suggested prototype descriptions:

- 0–19: Very Poor
- 20–39: Poor
- 40–59: Mixed
- 60–79: Good
- 80–100: Excellent

These labels are illustrative and can be revised.

The numerical score should remain the primary representation.

## 16. Rating transparency

Add an expandable "Why this rating?" section.

Show the actual calculated factor scores.

Example:

SQI: 82/100

Swell alignment: 90
Wind quality: 85
Tide compatibility: 70
Wave-size suitability: 80
Wave organization: 80

All displayed values must come from the scoring engine.

## 17. Missing data

Do not interpret missing measurements as ideal conditions.

If essential scoring inputs are missing, show the rating as unavailable or provisional.

Do not renormalize incomplete data in a way that hides major uncertainty.

---

# PART E — FORECAST COMPARISON AND CONSISTENCY

## 18. Compare surf spots

Allow users to select two or three surf spots for comparison.

Display:

- Breaking-wave height
- SQI
- Primary swell
- Wind
- Tide
- Wave character
- Forecast time

Use a compact comparison layout.

Avoid large desktop-style tables on mobile.

## 19. Regional surf overview

The Today screen should display a regional list of surf spots.

Allow sorting by:

- Surf Quality Index
- Wave height
- Wind quality
- Favorite status
- Personalized suitability, if enabled

Include an option to show only favorite spots.

## 20. Forecast timestamps

Every forecast record should support:

- Data source
- Forecast issue time
- Forecast valid time
- Last updated time
- Observation versus prediction
- Data availability

Display a clear demonstration-data label in the prototype.

Never pretend sample data is live.

## 21. Forecast reliability

Create the data structures for eventual forecast accuracy tracking.

Future functionality should compare archived predictions against observations.

Support future analysis of:

- Wave-height errors
- Wind-speed errors
- Wind-direction errors
- Forecast bias
- Forecast horizon
- Model agreement
- Regional performance

Do not claim improved accuracy before validating it.

---

# PART F — SMART QUIVER

## 22. Digital surfboard collection

Users should be able to add, edit, delete, favorite, and compare surfboards.

Store:

- Manufacturer
- Model
- Nickname
- Length
- Width
- Thickness
- Volume
- Board type
- Tail
- Fin configuration
- Construction
- Rocker category
- Preferred wave range
- Notes

Allow manual entry.

Do not require a manufacturer catalog.

## 23. Board selection interface

Use horizontally scrollable board cards.

Allow users to tap a board to inspect details.

Avoid dropdown menus as the primary board-selection method.

## 24. Board compatibility

Create a deterministic board recommendation system.

Evaluate:

- Wave size
- Wave character
- Board category
- Volume
- Intended wave range
- User experience
- Personal preferences

Only recommend boards saved in the user's quiver.

Explain the trade-offs.

Do not treat board volume as the sole determinant of suitability.

---

# PART G — PERSONALIZED SURF RECOMMENDATIONS

## 25. Experience levels

Allow users to choose:

Beginner | Intermediate | Expert

Use a segmented control.

Also allow optional preferences for:

- Preferred wave size
- Maximum comfortable wave size
- Break type
- Surfing style
- Preferred board categories

## 26. Personal Match Score

Create a separate score called:

**Personal Match Score (PMS)**

It should evaluate how well a spot and forecast time suit the individual surfer.

Keep this separate from SQI.

Do not confuse general surf quality with personal suitability.

The app should be useful even when personalization is disabled.

## 27. Personal safety constraints

Before ranking personalized recommendations, exclude combinations that violate configured skill or hazard constraints.

Unknown hazards should not be treated as safe.

A high SQI does not mean a spot is appropriate for every surfer.

## 28. Combined recommendations

When the user has a saved quiver, evaluate:

Spot + Time + Board + User

Recommend the highest-ranked suitable combination.

Display:

- Recommended spot
- Recommended time
- Recommended board
- SQI
- Personal Match Score
- Explanation

If the quiver is empty, still provide spot and time recommendations.

---

# PART H — INTERACTIVE EXPERIMENT MODE

## 29. What-if forecasting

Create an optional simulation mode.

Allow users to adjust:

- Breaking-wave height
- Swell direction
- Swell period
- Wind speed
- Wind direction
- Tide stage

Use sliders and segmented controls.

Recalculate SQI and personalized recommendations.

Clearly label this mode:

"Simulation — Not Actual Forecast"

Do not overwrite the stored sample forecasts.

Allow reset to the original values.

---

# PART I — PROFILE AND PERSISTENCE

## 30. Preferences

Save:

- Experience level
- Favorite spots
- Quiver
- Wave-height convention
- Measurement units
- Preferred region
- Preferred wave sizes
- Surfing style

Use localStorage.

Changes must persist after page refresh.

## 31. Data management

Include:

- JSON export
- JSON import
- Import validation
- Reset confirmation

Do not silently overwrite user data.

---

# PART J — TECHNICAL ARCHITECTURE

## 32. Technology

Use:

- React
- TypeScript
- Simple CSS
- Browser localStorage
- Static deterministic datasets
- Pure recommendation functions

Avoid:

- External APIs
- Paid services
- Authentication
- Complex databases
- AI model calls
- Generated images
- Videos
- Map rendering
- Unnecessary dependencies

## 33. Separation of concerns

Create independent modules for:

- Forecast data
- Surf spot profiles
- Wave-height conversion
- Unit conversion
- Surf Quality Index
- Personal Match Score
- Board compatibility
- Combined recommendations
- Local persistence
- UI state

## 34. Sample dataset

Create approximately 8–12 surf spots in Northern and Central California.

Provide seven days of demonstration forecasts.

Include multiple daily time slots and meaningful variations in:

- Wave height
- Swell direction
- Swell period
- Wind
- Tide
- Wave character

Include conditions where ratings are poor and where no suitable personal recommendation exists.

Do not use random values on every refresh.

---

# PART K — TESTING

## 35. Required tests

Verify:

- SQI calculations
- Rating factor breakdowns
- Missing-data behavior
- Forecast timeline synchronization
- Spot comparisons
- Hawaiian/face-height conversion
- Unit conversion
- Quiver management
- Board compatibility
- Experience-level filtering
- Personal Match Score
- Combined recommendations
- LocalStorage persistence
- Simulation mode isolation

## 36. Critical requirements

1. SQI must be independent of user preferences.
2. Personal Match Score must not overwrite SQI.
3. Wave-height display conventions must not affect calculations.
4. Forecast values must correspond to the selected spot and time.
5. Ratings must derive from actual scoring factors.
6. Missing data must be identified.
7. Simulations must not be represented as real forecasts.
8. Beginners must not be recommended clearly unsuitable expert-only breaks.
9. The app must work without a saved quiver.
10. All interactive controls must perform their intended functions.

---

# PART L — BUILD ORDER

Implement in this sequence:

**Phase 1 — Forecasting foundation**
- Navigation
- Surf spot database
- Seven-day sample forecasts
- Hourly timeline
- Swell, wind, and tide displays

**Phase 2 — Surf Quality Index**
- Factor scoring
- Overall SQI
- Rating explanations
- Spot-specific scoring

**Phase 3 — Forecast exploration**
- Spot search
- Regional overview
- Spot comparison
- Favorites
- Multi-day outlook

**Phase 4 — Personalization**
- Experience levels
- Personal Match Score
- Skill compatibility
- Preferences

**Phase 5 — Smart Quiver**
- Board management
- Board scoring
- Combined recommendations

**Phase 6 — Experiment mode**
- Adjustable conditions
- Live recalculation
- Simulation isolation

**Phase 7 — Verification**
- Test functionality
- Validate calculations
- Confirm persistence
- Fix broken interactions

---

# FINAL INSTRUCTIONS

This application must first succeed as a complete and understandable surf forecasting platform.

Do not make the forecast secondary to the quiver feature.

The user should be able to open the app, select a surf spot, inspect detailed swell, wind, tide, and wave-height forecasts, explore hourly and daily changes, compare breaks, and understand the surf quality rating without entering any personal information.

Personalized spot recommendations and Smart Quiver functionality should enhance this experience rather than replace it.

Keep the prototype minimal, lightweight, responsive, and interactive.

Do not spend resources on elaborate aesthetics or photography.

Do not copy Surfline's proprietary interface, data, or rating algorithms.

Build an original system that offers comparable categories of surf forecasting information while improving transparency, usability, and personalization.

Preserve working code and implement features incrementally.

The ultimate objective is:

**A complete, intuitive, transparent, and personalized surf forecasting platform that improves the everyday surfing experience.**

Begin with the forecasting foundation, then implement the rating system, and proceed through the remaining phases.