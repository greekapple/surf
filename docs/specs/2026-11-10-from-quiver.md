# Ideas from the Quiver survey (2026-11-10)

The user asked: "look at that whole surf app and take anything useful … very barebone, I like ours much more, so only what you think could actually be applied". Survey: `docs/research/QUIVER-SURVEY.md`. These are features only, never their text, design or branding.

## Build (in this order; each gets its own review)
1. **Stable best windows (S).** A spot's best window and its wording must not change between visits unless the data changed. Key the window choice on the model run and the inputs. Ties keep the earlier pick. Owner: product.
2. **Share a plan (S).** A "Share" action on a best window: `navigator.share`, falling back to copying the link, with a deep link to the spot and hour (`/forecast?spot=…&t=…`). The shared text holds only the app's own labelled numbers. Owner: product.
3. **"Looks like your best sessions" (M).** Compare today's forecast at a spot with the user's own logged or felt-right sessions there (swell height, period, direction, wind, tide). Say which past session today most resembles, with that session's date and its numbers. This is local only, never uploaded, and not shown below about 3 logged sessions. Owner: product, then a data-honesty review.
4. **Water quality (M).** Official beach water-quality status where it is public: county or state beach programs (California BeachWatch and county health), and EPA BEACON. Show the agency's own status and date, linked. Where no source covers a spot, show nothing. Start with research (sources, licences, update rate, coverage of our spots), then build. Owner: a research agent, then eng.

## Later (needs the user)
5. **Watch a window + Web Push (L).** Push needs VAPID keys (a secret, stored outside the repo) and a Worker cron. It's production infrastructure, so it needs the user's go.
6. **Custom spot from a map pin (M).** It shows offshore values only, labelled "your pin, not a surf spot; not calibrated". A product decision for the user.

## Don't copy
- offshore swell shown as surf size;
- an unexplained 0–100 confidence;
- Surfline cameras and Google photos used as embeds;
- unsourced crowd notes, or ratings from 2 reviews;
- a social feed, games or badges.
