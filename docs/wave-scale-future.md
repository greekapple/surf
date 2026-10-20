# Wave Scale status in v0.11

The first educational implementation now exists in `src/education/waveScale.ts` and `src/components/WaveScale.tsx`. See `v11-architecture.md` for fixed metric dimensions, conventions and extension boundaries. Preset/units/keyboard interactions were checked on desktop, narrow CSS-viewport layout was inspected, and geometry tests pass. Broader mobile/assistive/reduced-motion acceptance and expert review remain pending. The specification below is retained as the original design intent, not evidence that every future capability is implemented.

---

# WAVE SCALE — future educational feature, not implemented in v0.9

Goal: explain breaking-wave face height using a consistently scaled human reference. Keep this educational surface separate from actual forecasts. Label synthetic geometry and scenarios as illustration, never live surf.

Use a lightweight SVG/canvas side profile with coordinates in meters. Define face height as the vertical distance between the wave trough and crest on the breaking face; explain that Hawaiian convention is approximate and distinct. Use an explicitly disclosed reference stature (for example a selectable 1.75 m standing figure) and a lying surfer/board with stated lengths. Do not vary reference size between frames to make waves look dramatic. Do not imply equal vertical face height means equal power, risk or shape.

Interaction: accessible size slider, numeric input and optional provided surf-height range; pan/zoom framing keeps the physical scale constant, with a visible scale bar. Prefer showing both range endpoints rather than a single perfect wave. On mobile keep the figure large and labels separated; allow keyboard controls and reduced motion. No hardware, camera, board tracking, face recognition or forecast data inference is required.

Acceptance before release: confirm dimensions against a meter grid, verify ft/m and convention changes, test small/large ranges and viewports, provide text alternatives, and review the explanation with a relevant coastal/ocean expert. Any future link to a forecast requires a supported breaking-wave measurement or estimate with source and valid time. Offshore and CDIP nearshore Hs are ineligible substitutes. No unfinished control or navigation item is added in v0.9.
