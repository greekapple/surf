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
