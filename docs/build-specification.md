# PROJECT: Intelligent Surf Forecast & Quiver Recommendation App
## Functional Prototype — Complete Build Specification

You are developing a functional prototype for a next-generation surfing application intended to eventually compete with established surf forecasting platforms such as Surfline.

This is not simply another surf forecast website.

The central concept is to combine surf forecasting, personalized surf spot recommendations, surfboard equipment management, and understandable ocean-condition analysis into one cohesive application.

The application should help users answer four questions:

1. Where should I surf today?
2. What time should I surf?
3. Which surfboard from my personal quiver should I bring?
4. Why is that combination appropriate for the conditions and my ability?

The long-term vision is a reliable, intelligent surfing assistant that understands ocean conditions, individual surf breaks, surfboard characteristics, and user preferences.

**IMPORTANT: This first version is strictly a functional prototype.**

Do not attempt to build the complete commercial platform yet.

Do not prioritize visual design, elaborate aesthetics, photographs, videos, animations, maps, or unnecessary complexity.

Focus on functionality, data structures, navigation, persistence, recommendation algorithms, and demonstrating how the application would work.

All forecast data in this version will be simulated and clearly identified as sample data.

---

# 1. DEVELOPMENT PHILOSOPHY

Follow these principles throughout the project.

### Functional before visual

Use a minimal, responsive interface with simple typography, basic buttons, standard forms, and clear sections.

Do not generate surf photography, decorative backgrounds, animations, complex charts, or elaborate styling.

Astra should spend its effort implementing features rather than producing a visually impressive but nonfunctional demonstration.

### Modular architecture

Every major feature should have its own components, data structures, and logic.

Keep the recommendation algorithms independent from the user interface.

Do not place all functionality inside a single enormous React component.

### Lightweight implementation

Use:

- React
- TypeScript
- Simple CSS or existing lightweight styling utilities
- Browser localStorage for persistence
- Static demonstration datasets
- Deterministic TypeScript recommendation functions

Do not use:

- External forecast APIs
- Supabase or other databases
- Authentication services
- Paid APIs
- External AI models
- Image generation
- Video generation
- Complex animation libraries
- Map rendering libraries
- Unnecessary packages

### Preserve working functionality

Implement features incrementally.

Do not repeatedly regenerate the entire application.

Maintain existing components and functionality when making improvements.

All features should work with one another, not exist as disconnected demonstrations.

---

# 2. APPLICATION STRUCTURE

Create five main navigation sections.

1. Today
2. Explore
3. Forecast
4. My Quiver
5. Profile & Settings

Use simple bottom navigation on mobile and an appropriate navigation layout on desktop.

Navigation must be functional.

All sections should share user preferences, saved surfboards, saved spots, and selected forecast conditions.

Changes made in one section should immediately affect relevant information elsewhere.

---

# 3. TODAY — PERSONALIZED SURF DASHBOARD

This should eventually become the application's primary experience.

The purpose is to provide an immediate personalized answer about the best surfing opportunities.

For the prototype, create a dashboard that includes:

### A. Daily surf overview

Display:

- Selected region
- Current sample date and forecast time
- General surf outlook
- Best recommended surf spot
- Best recommended surfing time
- Recommended surfboard
- Forecast confidence indicator
- Brief explanation of the recommendation

The interface should answer the user's main questions without requiring navigation to several different pages.

### B. Best spot recommendation

Show the highest-ranked suitable surf spot.

Include:

- Spot name
- Estimated breaking-wave face height
- Primary swell direction
- Primary swell period
- Wind direction
- Wind speed
- Tide condition
- Spot suitability score
- User experience compatibility

Add a button to view the detailed forecast and explanation.

### C. Recommended board

Identify the most suitable board from the user's saved quiver.

Display:

- Manufacturer
- Model
- Length
- Volume
- Board type
- Recommendation score
- Short explanation

Example:

Recommended board: 5'10" Performance Shortboard

Reason: The selected spot has clean, punchy sample conditions, and this board is suitable for the user's experience level and the expected wave character.

The application must never recommend a board that does not exist in the user's saved quiver.

### D. Alternative recommendations

Show two alternative spots where possible.

Each should include:

- Spot name
- Suitability score
- Basic conditions
- Reason for ranking

Also allow users to compare their top two or three saved boards.

### E. No suitable conditions

If all sample spots are unsuitable for the user's experience level, display an honest message.

Example:

"No suitable surf conditions found in this sample forecast window."

Do not force a positive recommendation.

---

# 4. MY QUIVER — PERSONAL SURFBOARD DATABASE

This is one of the most important features in the entire application.

Users should be able to build and manage a digital collection of the surfboards they own.

### A. Adding a board

Create a functional form with the following fields:

Required:

- Board nickname or name
- Manufacturer
- Model
- Board type
- Length
- Width
- Thickness
- Volume in liters

Optional:

- Tail shape
- Fin configuration
- Construction
- Rocker category
- Rail characteristics
- Preferred wave size
- Preferred wave type
- Personal notes

Board types should include:

- Performance shortboard
- Everyday shortboard
- Groveler
- Fish
- Hybrid
- Midlength
- Funboard
- Longboard
- Step-up
- Gun
- Soft-top
- Other

Allow custom manufacturer and model names.

Do not require every board to be part of an existing catalog.

### B. Dimensions

Allow surfboard measurements in conventional surfboard formats.

For example:

Length: 5'10"

Width: 19 1/2"

Thickness: 2 3/8"

Volume: 27.5 L

Internally normalize dimensions into consistent numeric values for calculations.

Preserve readable surfboard measurement formatting in the interface.

Validate input and reject impossible or invalid dimensions.

### C. Quiver management

Users must be able to:

- Add a board
- Edit a board
- Delete a board
- View board details
- Give boards nicknames
- Mark favorite boards
- Sort boards by type, length, and volume
- Compare boards
- View recommended conditions for each board

All changes must persist using localStorage.

### D. Future catalog architecture

Design the data model so a verified manufacturer/model database can be added later.

Eventually users should be able to search manufacturers and select specific models, automatically populating verified specifications.

Do not implement a large catalog yet.

For the prototype, include a small set of clearly labeled fictional demonstration boards.

Do not invent specifications for actual commercial surfboard models.

---

# 5. SURFBOARD RECOMMENDATION ENGINE

Create an actual deterministic scoring algorithm.

Do not generate arbitrary scores.

The engine should evaluate the compatibility of each saved board with the selected spot, forecast conditions, and user profile.

### Input variables

Board characteristics:

- Board category
- Length
- Width
- Thickness
- Volume
- Tail type
- Fin configuration
- Rocker category, when available
- User-specified preferred conditions

Surf conditions:

- Estimated breaking-wave face height
- Wave character
- Swell direction
- Swell period
- Wind quality
- Tide suitability
- Spot type

User information:

- Experience level
- Preferred surfing style
- Comfort with larger waves
- Personal board preferences

### Scoring categories

Create a configurable scoring model using these initial weights:

- Wave-size compatibility: 30%
- Wave-character compatibility: 25%
- Board type and intended use: 20%
- User experience compatibility: 15%
- Personal preferences: 10%

These are initial prototype heuristics, not scientifically validated weights.

Ensure scores are normalized to a 0–100 scale.

Document how every category is calculated.

Do not use random scoring.

### Recommendation explanations

For every recommended board, generate an explanation from the actual scoring factors.

Examples:

- This board is better suited to smaller, weaker waves.
- The additional volume may help with paddling and catching softer waves.
- This board is intended for steeper, more powerful surf.
- This board is less suitable for the current wave size.
- Your preferred board has a lower match score than another board in your quiver.

Explanations should be created using simple rule-based templates.

Do not use an external language model.

### Important safeguards

If a board lacks optional specifications, do not fabricate them.

Use available information and indicate when a recommendation has limited detail.

If no board is appropriate, say so.

A high board score must never override an unsuitable or hazardous surf-spot recommendation.

---

# 6. EXPLORE — SURF SPOT DISCOVERY

Create a functional surf-spot discovery interface.

Use a small static database of approximately 8–12 demonstration surf spots.

Initially focus on a Northern and Central California sample region.

Include a mixture of beach breaks, point breaks, and reef breaks.

Real spot names may be used for identification, but any unverified spot characteristics or conditions must be explicitly labeled as illustrative.

### Spot information

Each spot should contain:

- Unique ID
- Name
- Region
- Break type
- General difficulty level
- Ideal swell directions
- Suitable swell-period ranges
- Preferred tide conditions
- Wind exposure
- Typical wave character
- Hazard notes
- Sample conditions for multiple forecast times

### Discovery filters

Users should be able to filter by:

- Experience level
- Break type
- Wave-size range
- Wind conditions
- Preferred wave character
- Favorites
- Recommended spots

### Spot ranking

Display spots in order of suitability for the selected user and forecast time.

Include a numerical match score and an explanation.

A spot with larger waves should not automatically receive a higher score.

Consider skill compatibility, wind, swell exposure, tide, and wave character.

### Safety considerations

Some breaks have hazards unrelated to wave size.

The data model should support:

- Strong currents
- Rocks
- Shallow reef
- Shorebreak
- Restricted access
- Local access warnings
- Other hazards

The app should not present a spot as safe solely because its numerical match score is high.

Unknown hazard information should be labeled unknown, not safe.

---

# 7. EXPERIENCE LEVEL & SURFER PROFILE

During initial setup, ask users to choose:

- Beginner
- Intermediate
- Expert

Allow users to change this at any time.

Provide brief descriptions of each level.

Beginner:

Learning to catch waves, stand up consistently, and develop basic control.

Intermediate:

Comfortable catching unbroken waves, turning, and navigating a broader range of conditions.

Expert:

Experienced in challenging waves, positioning, wave selection, and advanced maneuvers.

These categories are broad approximations and should not be treated as certifications of safety.

### Additional optional preferences

Allow users to specify:

- Preferred wave-size range
- Maximum comfortable wave size
- Preferred break type
- Preferred wave character
- Preferred surfing style
- Preferred board types

Surfing style examples:

- Performance surfing
- Cruising
- Longboarding
- Small-wave surfing
- All-around

Save these preferences.

Changes should immediately update recommendations.

---

# 8. FORECAST — UNDERSTANDABLE OCEAN DATA

Create a simple forecast interface that displays essential ocean conditions clearly.

Do not build elaborate visualizations yet.

Use basic tables, numerical values, and simple charts only if existing lightweight components are available.

### Forecast information

Include:

- Estimated breaking-wave face height
- Offshore significant wave height
- Primary swell height
- Primary swell direction
- Primary swell period
- Secondary swell height
- Secondary swell direction
- Secondary swell period
- Wind speed
- Wind direction
- Wind relationship to shore
- Tide height
- Tide stage
- General wave character
- Forecast confidence
- Forecast timestamp

Keep offshore swell measurements separate from breaking-wave height estimates.

Do not assume they are interchangeable.

### Forecast time selection

Provide sample forecasts at several times throughout the day.

For example:

6 AM, 9 AM, 12 PM, 3 PM, and 6 PM.

Allow the user to select a time.

Changing the time should update:

- Displayed forecast
- Spot rankings
- Recommended surfboard
- Suggested surf session time
- Recommendation explanations

Use a consistent demonstration dataset so the results are reproducible.

### Multiple-day forecast

Include sample data for three days.

Allow users to switch between days.

This demonstrates how the app could eventually recommend the best surfing windows throughout the week.

---

# 9. HAWAIIAN VS. FACE-HEIGHT WAVE MEASUREMENTS

Implement a global wave-height display preference.

Options:

1. Face Height / Traditional
2. Hawaiian Scale

Face height refers to estimated wave height measured along the breaking wave face.

Hawaiian scale is a conventional surfing description that is often approximately half the face-height estimate, although it is not universally standardized.

For this prototype, use an approximate 0.5 multiplier to demonstrate the display difference.

Clearly identify Hawaiian values as approximate.

Example:

Face height: 6 ft

Approximate Hawaiian: 3 ft

### Critical implementation requirements

Store one consistent internal representation of breaking-wave height.

Changing the display preference must not alter:

- Actual forecast inputs
- Board scores
- Spot scores
- Skill compatibility
- Safety filters

Only the displayed wave-height convention should change.

Apply the setting consistently throughout the application.

Include a small explanation of the difference.

Do not apply this conversion to offshore significant wave height or individual swell-component heights.

---

# 10. WIND AND SWELL INTERPRETATION

One of the long-term product goals is making ocean conditions easier to understand.

Create a simple explanation system for swell and wind.

### Swell explanation

Explain:

- Swell direction
- Swell period
- Primary versus secondary swell
- How swell direction interacts with break orientation

Example:

"The sample northwest swell is favorably aligned with this break's configured exposure."

### Wind explanation

Display:

- Wind direction
- Wind speed
- Offshore, onshore, or cross-shore relationship

Do not determine offshore versus onshore based solely on a universal compass direction.

Use each spot's configured shoreline orientation.

### Plain-language interpretation

Generate short explanations from the actual demonstration data.

Examples:

"Light offshore winds may help maintain cleaner wave faces."

"The current swell direction is less favorable for this break."

"The secondary swell may contribute additional wave energy."

Avoid presenting these rules as guarantees.

---

# 11. PERSONALIZED BEST TIME TO SURF

The app should recommend not only where to surf but also when.

For each sample spot, evaluate the available forecast time slots.

Consider:

- Wind conditions
- Swell characteristics
- Estimated wave size
- Tide suitability
- User experience
- Board compatibility

Rank available time slots using deterministic rules.

Display the highest-ranked suitable time.

Example:

Best window: 7–10 AM

Reason: The sample forecast indicates lighter winds and more favorable tide conditions during this period.

Only display a window that is supported by the available time data. If the dataset only supports individual timestamps, recommend the best timestamp rather than inventing a continuous time window.

Allow users to compare morning and afternoon conditions.

---

# 12. SPOT AND BOARD COMBINATION ENGINE

This is the central feature of the application.

Do not independently recommend the best spot and best board without considering how they work together.

Evaluate combinations of:

- User
- Surf spot
- Forecast time
- Saved surfboard

For each combination, calculate:

1. Spot suitability
2. Board suitability
3. User experience compatibility
4. Time-window suitability

First reject combinations that violate configured safety or experience constraints.

Then rank the remaining combinations using a transparent weighted score.

Avoid double-counting the same factors across component scores.

The result should identify the best complete surfing option.

Example output:

Spot: Sample Beach Break

Time: 9 AM

Board: 5'10" Performance Shortboard

Match: 89/100

Reason:

- Favorable swell direction
- Suitable wave size
- Light offshore winds
- Appropriate user experience level
- Good compatibility with the selected board

All scores must come from documented logic.

Include at least two alternative combinations where available.

---

# 13. COMPARISON FEATURE

Allow users to compare:

- Two surf spots
- Two forecast times
- Two surfboards

Use simple side-by-side tables.

For spot comparison, include:

- Wave height
- Swell direction
- Period
- Wind
- Tide
- Skill suitability
- Overall score

For board comparison, include:

- Length
- Width
- Volume
- Board type
- Wave compatibility
- Recommendation score

Keep this feature simple.

Do not implement complicated comparison graphics.

---

# 14. FAVORITES AND SAVED PREFERENCES

Users should be able to:

- Favorite surf spots
- Favorite surfboards
- Save their experience level
- Save wave-height display preference
- Save preferred wave sizes
- Save preferred break types
- Save their preferred region

Use localStorage.

Changes must persist after refreshing the page.

Include a reset demonstration data option with confirmation.

Do not silently delete user-created boards or preferences.

---

# 15. SAMPLE DATA REQUIREMENTS

Create a small but useful demonstration dataset.

Include:

- Approximately 8–12 surf spots
- Three days of sample forecasts
- Several forecast timestamps per day
- Multiple swell directions
- Different wind conditions
- Different tide stages
- Different wave sizes
- Different wave characters
- Several sample board profiles

Ensure the dataset creates meaningful variation.

For example:

- One spot should favor beginners under certain conditions.
- Another should favor experienced surfers.
- A small-wave day should favor a fish or longboard where appropriate.
- A punchier day should favor a performance shortboard.
- A larger day should potentially favor a step-up for an appropriately experienced surfer.
- Some conditions should produce no suitable recommendation.

The sample data must be internally consistent.

Avoid generating random forecast numbers on every refresh.

Use deterministic data.

All sample conditions must be labeled "Demo Data — Not Live Forecast."

---

# 16. FUTURE LIVE-DATA ARCHITECTURE

Although this version uses simulated data, structure the application so live data can eventually replace it.

Create a forecast-provider interface or adapter layer.

It should support normalized data from future providers such as:

- NOAA buoy observations
- NOAA tide predictions
- Open-Meteo marine forecasts
- Wind forecast providers
- Other legally licensed forecast sources

Do not connect these services yet.

Create types and interfaces that separate raw forecast inputs from processed surf-spot estimates.

Support future fields for:

- Data source
- Observation or forecast timestamp
- Last updated
- Forecast horizon
- Model identity
- Confidence
- Missing values
- Data quality indicators

Do not pretend the prototype has achieved superior forecast accuracy.

Forecast accuracy must eventually be evaluated against observations.

---

# 17. FUTURE SESSION FEEDBACK

Prepare a simple structure for eventual surf-session tracking.

The future system should allow users to record:

- Spot surfed
- Date and time
- Board used
- Actual wave conditions
- Forecast accuracy rating
- Board performance rating
- Session satisfaction
- Personal notes

For the prototype, implement a basic optional session log only if it can be done without complicating the core application.

Do not implement machine learning.

The long-term purpose is to collect feedback that could eventually improve personalized recommendations.

---

# 18. PROFILE AND SETTINGS

Create a working settings screen.

Include:

- Experience level
- Preferred region
- Preferred wave-height measurement
- Preferred units
- Preferred wave-size range
- Preferred surfing style
- Favorite spots
- Favorite boards
- Data reset option

Units should support:

- Feet or meters for wave heights
- MPH, knots, or km/h for wind speed

Convert display units consistently without altering internal scoring values.

Persist all settings.

---

# 19. DESIGN REQUIREMENTS — MINIMAL ONLY

This prototype is not a visual design exercise.

Use:

- Simple layout
- Readable typography
- Clear headings
- Basic cards only where useful
- Standard form elements
- Minimal color palette
- Consistent spacing
- Responsive navigation

Do not use:

- Generated photography
- Video backgrounds
- Elaborate gradients
- Glassmorphism
- Complex transitions
- Decorative animations
- Excessive shadows
- Large decorative illustrations
- Unnecessary icons
- Expensive visual components

The finished commercial app will receive its own dedicated visual design process later.

For now, functionality and clarity are the priorities.

---

# 20. CODE ARCHITECTURE

Use a maintainable folder structure.

Suggested organization:

src/
- components/
- pages/ or app/
- features/
- data/
- models/
- services/
- recommendation/
- utils/
- hooks/
- tests/

Keep:

- Surfboard types separate from UI
- Spot data separate from UI
- Forecast data separate from UI
- Recommendation logic in pure functions
- Settings persistence in dedicated utilities
- Unit conversions in dedicated utilities

Use TypeScript interfaces for:

- UserProfile
- Surfboard
- SurfSpot
- SwellComponent
- WindConditions
- TideConditions
- Forecast
- ForecastTimeSlot
- SpotRecommendation
- BoardRecommendation
- SurfSession

Avoid unnecessary abstractions.

---

# 21. TESTING AND VERIFICATION

Implement basic tests for the most important logic.

Verify:

1. Adding, editing, and deleting boards
2. LocalStorage persistence
3. Experience-level changes
4. Face-height/Hawaiian display conversion
5. Unit conversion
6. Forecast time selection
7. Spot ranking
8. Board ranking
9. Combined spot/time/board ranking
10. Empty quiver behavior
11. No suitable conditions behavior
12. Recommendation explanation consistency

Important test:

Switching from face-height to Hawaiian scale must never change the underlying recommendation scores.

Another important test:

A beginner must not receive a high-risk expert-only spot recommendation simply because the forecast looks favorable.

Ensure all displayed scores correspond to actual calculated values.

Do not claim a feature is complete unless its primary interactions work.

---

# 22. BUILD ORDER

Build the project incrementally in the following order.

### Phase 1 — Foundation

- Create the application structure.
- Define data models.
- Create sample datasets.
- Implement navigation.
- Implement basic localStorage utilities.

### Phase 2 — Quiver

- Board creation
- Board editing
- Board deletion
- Board details
- Board persistence

### Phase 3 — Forecast

- Sample forecasts
- Spot selection
- Time selection
- Wave-height display preference
- Wind and swell explanations

### Phase 4 — Recommendation Logic

- Spot suitability scoring
- Board suitability scoring
- Experience compatibility
- Best-time selection
- Combined recommendation engine
- Transparent explanations

### Phase 5 — Personalized Dashboard

- Best spot
- Best time
- Recommended board
- Alternative recommendations
- Overall explanation

### Phase 6 — Explore and Comparison

- Spot filtering
- Favorites
- Spot comparison
- Board comparison

### Phase 7 — Verification

- Test persistence
- Test scoring
- Test settings
- Test navigation
- Test edge cases
- Fix broken interactions

Do not begin unnecessary visual polish until the core features work.

---

# 23. WHAT SUCCESS LOOKS LIKE

The prototype is successful when a user can:

1. Open the application.
2. Select their surfing experience level.
3. Add three real surfboards to their quiver.
4. Browse sample surf spots.
5. Inspect sample swell, wind, tide, and wave-height conditions.
6. Change between face-height and Hawaiian measurements.
7. Select a forecast day and time.
8. Receive a suitable spot recommendation.
9. Receive a suitable board recommendation from their own quiver.
10. Understand why that combination was selected.
11. Compare alternative spots and boards.
12. Refresh the page without losing their saved information.

Everything should be genuinely interactive.

Avoid decorative buttons that do nothing.

Avoid fabricated live-data claims.

Avoid arbitrary recommendation scores.

Avoid implementing features solely for appearance.

---

# 24. FINAL DEVELOPMENT INSTRUCTIONS

Before writing code, briefly outline the proposed architecture and implementation sequence.

Then begin implementing the application.

Do not spend excessive time explaining the plan once implementation can begin.

Prioritize producing a functioning application.

Use the simplest reasonable technical solutions.

Preserve completed work.

Avoid unnecessary dependencies and large generated assets.

If the environment has limited execution resources or context, complete the highest-priority working features first rather than generating incomplete versions of every feature.

Do not sacrifice functionality for aesthetics.

The final objective is a reliable, lightweight, interactive proof of concept demonstrating the central idea:

**A personalized surfing assistant that recommends the right surf spot, the right time, and the right board based on ocean conditions and the individual surfer.**