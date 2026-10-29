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

## Do
- Data first, like Windy/Surfline: dense, aligned, tabular numbers; one condition colour scale used everywhere (same chip, same dot, same words).
- Hierarchy through size and weight, not boxes. Prefer rules (1px lines) and whitespace to cards.
- Real interaction: every control responds within 100 ms (pressed state, `:active` scale 0.98), hover raises contrast, focus rings visible, URL holds state (deep-link tabs, spot, hour).
- Motion only to explain change (route transitions, selection glides); CSS transform/opacity; interruptible; `prefers-reduced-motion` honoured; never `transition: all`.
- Skeletons with ~200 ms show-delay for anything that loads.
- Touch targets >= 44 px on phones; inputs >= 16 px font on mobile.
- Privacy and Terms pages linked from every page footer.
- Verify in a real browser at 1440 and 390, and look at the screenshots.
