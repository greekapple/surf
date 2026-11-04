# SWELLO design rules (2026-10-29)

Sources: the user's reference videos ("30 reasons your site looks vibecoded", Apple HIG and web-motion skills, Vercel web design guidelines; transcripts and frame text in `ai-system-setup/research/video-analysis-2026-10-29/`), Vercel Web Interface Guidelines (`ai-system-setup/research/web-guidelines/`), and benchmarks Windy and Surfline (`ai-system-setup/research/benchmarks/`). Every agent and change follows these.

## Do not (reads as AI-generated)
- Glass/blur panels ("liquid glass") except a nav over photography; frosted cards everywhere.
- Big soft radii on everything. Radius scale is 4 / 8 / 12 px; photos and the 3D stage may use 12; pills only for true toggles.
- Decorative drop shadows; gradients as decoration; radial orbs; dot grids; sparkle icons.
- Rows of 3-4 identical feature cards; bento grids; coloured left/top stripes on cards.
- Kicker/eyebrow labels in spaced caps above every heading; "It's not X, it's Y" copy; em dashes in UI copy; emoji.
- Explaining the UI with paragraphs. One short honest note per data source, placed where the number is.
- Loading text instead of skeletons. Dead hover states. Animations nobody asked for.
- Generic hover lifts/zooms (cards that `translateY(-4px) scale(1.05)` on hover; list item 28). Hover raises contrast or shows information; it does not float the element.

## Verified source list (frame v2-239 of `~/Downloads/2(1).MP4`, read 2026-10-29)
"30 reasons your site looks vibecoded": 1 harsh gradients, 2 lucide icons, 3 pure white background, 4 rainbow colouring, 5 drop shadows, 6 three feature cards in a row, 7 emojis, 8 liquid glass, 9 em dashes, 10 Inter/Geist/Space Grotesk, 11 coloured left stripe, 12 fake testimonials, 13 bento grids, 14 terminal window, 15 "it's not x, it's y", 16 checkmark bullets, 17 three pricing tiers, 18 no real product demos, 19 soft corner radius, 20 purple and black, 21 no skeleton loaders, 22 radial orbs, 23 dot grids, 24 sparkle icons, 25 animated arrows, 26 no TOS, 27 no privacy policy, 28 hover animations (29-30 blank in the source).
Also from the user's saved reels (`ScreenRecording_10-28-2026 10-05-00_1.MP4`): two Apple-based Claude skills (HIG rules for layout/type sizes; WWDC motion rules: respond instantly, interruptible animations), shared privately by their author, not public; their principles are folded into the Do list above.

## Do
- Data first, like Windy/Surfline: dense, aligned, tabular numbers; one condition colour scale used everywhere (same chip, same dot, same words).
- Hierarchy through size and weight, not boxes. Prefer rules (1px lines) and whitespace to cards.
- Real interaction: every control responds within 100 ms (pressed state, `:active` scale 0.98), hover raises contrast, focus rings visible, URL holds state (deep-link tabs, spot, hour).
- Motion only to explain change (route transitions, selection glides); CSS transform/opacity; interruptible; `prefers-reduced-motion` honoured; never `transition: all`.
- Skeletons with ~200 ms show-delay for anything that loads.
- Touch targets >= 44 px on phones; inputs >= 16 px font on mobile.
- Privacy and Terms pages linked from every page footer.
- Verify in a real browser at 1440 and 390, and look at the screenshots.

## Map colours: Windy's colours for wave and swell height, Swello's own ramps for wind and period (user decision, 2026-11-04, docs/specs/2026-11-04-map-review.md)
- **Wave height and swell height use Windy's colours** (user: "model the map closely on Windy, use Windy's colour scheme for wave height"): ONE fixed absolute scale, breakpoints 0 1.6 3.3 5 6.6 10 13 20 30+ ft (Windy's legend ticks 1.6 / 3.3 / 5 / 6.6 / 20 / 30), one explicit colour stop per breakpoint (`mapConfig.scales.WAVES.stops`, the same for Swell): deep blue, steel blue, blue, indigo, violet, magenta, crimson, salmon, pale salmon, joined in RGB and evenly spaced like the ticks; the same in light and dark. The stops were sampled from Windy overlay captures (the overlay colours, not the muted legend strip): the overlay's colour at each Swello GFS-Wave height was registered against our coastline and binned (docs/map-pipeline.md has the method note in the commit). The scale never changes with zoom, viewport, region or time.
- **Swell height has no holes** (Windy has none): where the model leaves the swell partition empty (the sea is all wind sea; measured: total height equals wind-wave height to the centimetre in those cells) the map paints 0 ft, the calm end, and says so in the legend ("0 = no swell (wind sea only)") and in the pin ("swell: no swell partition: wind sea only"). No hatch.
- **Wind and period keep Swello's own ramps** (below) for now.

### Swello's own ramps (wind and period; wave and swell height were this until 2026-11-04)
- **The map's sea-state field uses Swello's own ramps, one FIXED absolute scale per layer** (`src/map/mapConfig.ts` `scales`, built in `src/map/ramps.ts`): waves and swell height 0 1 2 3 4 6 8 10 15 20 30+ ft, period 4 to 20+ s, wind 0 to 50+ kt with the emphasis on 0 to 25. The scale never changes with zoom, viewport, region or time; the legend shows the same breakpoints. This replaces the "no rainbow" rule and the Windy ramps of T-115/T-117 **for the map's sea-state field only**; every other surface keeps the rule.
- Built in CIE LCH so that **lightness rises steadily** (calm = darkest, so a calm sea is never pale like ice or "no data"), each layer has its own hue family, no colour is confusable with the land grey, and every adjacent breakpoint stays distinguishable in greyscale and under deuteranopia, protanopia and tritanopia. These properties are unit-tested (`src/tests/map-ramps.test.ts`); strips are rendered by the toolkit's `t121-ramps.mjs`.
- The map keeps the honesty rules: the legend says "Offshore wave height · not surf size", land is never painted, no value is invented where the model has none. WCAG AA contrast holds for every map control in both themes (`t120-contrast-probe.mjs`).
