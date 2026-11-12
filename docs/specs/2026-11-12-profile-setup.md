# Spec: surf profile setup, every question explained (user request 2026-11-12)

The user: "when you sign up a lot of the personal info should be there: male, female, height, all that stuff, and an explanation of why you're asking."

There are no accounts yet. Today this is the **first-run setup** (the existing `onboarded` flag) plus a **Profile** section in Personal where every answer can be changed. When accounts arrive, the same screens become sign-up. Answers stay on this device (local storage) until then, and the screen says so.

## Rules
- **Ask only what changes something the person will see.** Each question has a one-line "Why we ask" that names the exact feature it changes ("Your height sets the person drawn next to the wave and words like 'overhead'").
- **Everything is optional except the age question.** A skipped answer uses a labelled default ("you 5'10" (default)"), as today.
- **No free text about health or anything sensitive.**
- **"Prefer not to say" is always offered** where it fits.
- **Short:** 3 steps on a phone, about 30 seconds, and "Skip for now" on every step.

## The questions (each with its "Why we ask")
| Question | Answer | Why we ask / what it changes |
|---|---|---|
| Age | year of birth (or "under 13 / 13–17 / 18+") | **Required.** Under 13: the app works with no personal data saved, and setup ends there (COPPA). 13–17: no marketing, ever. Never shown to anyone. |
| Sex | female · male · prefer not to say | Shapes the figure drawn next to the wave, and (later) wetsuit size suggestions. Nothing else; never used for ratings. |
| Height | ft/in or cm | The person drawn next to the wave, plus "waist / head / overhead" words in your own body heights. Already used (`heightIn`). |
| Weight | lb or kg, or skip | Board Match: the board volume that suits you (volume ≈ weight × a skill factor). |
| Skill | one of the 7 levels below, picked from cards that show what each level can do | The Call (Go / Skip), the wave sizes it treats as yours, and Board Match. Already used (today only 3 levels). |
| Stance | regular · goofy · not sure | Whether a spot's lefts or rights are your frontside, in the spot notes and the 3D view (peel direction). |
| Comfortable wave size | min–max range (prefilled from skill) | The Call: "above the range you prefer". Already used. |
| Home spot / region | pick from the map or search | Home's best bet and "nearby" ranking. |
| Units | ft/m, mph/kn/km/h, face/Hawaiian | Every number on screen. Already used. |
| Boards | add now or later | Board Match and "Take your …". Already used. |

## Skill: 7 levels, each showing what that surfer can do (user request 2026-11-12)
Today `Skill` is 3 values (Beginner / Intermediate / Expert, `src/services/call.ts` SKILL_RANGE_FT). It becomes 7. Each level is a card with:
- a name and a one-line summary;
- **"You can…"**: 3–4 concrete things a surfer at that level does;
- **a picture of the level:** the app's own drawn wave at that level's typical comfortable size, next to the person (the same drawing as the Home hero, using their height if given; no AI imagery);
- its default comfortable size range, which prefills the next question.

Cards sit side by side with arrows (or scroll on a phone), so you can compare the level below and above. A "Not sure?" link asks 3 quick yes/no questions ("Can you duck-dive?", "Do you surf overhead waves?", "Do you ride the barrel?") and suggests a level.

| # | Level | You can… | Typical comfortable size (surf height) |
|---|---|---|---|
| 1 | **First waves** | ride whitewater to the beach; pop up most of the time; you're mostly in a lesson or on a soft-top | 1–2 ft |
| 2 | **Beginner** | catch unbroken (green) waves; ride straight or with a small angle; paddle out through small surf | 1–3 ft |
| 3 | **Improver** | angle along the face on purpose; trim and keep speed; turtle-roll, or push up and let small whitewater pass under you (not yet a duck-dive); pick your own waves | 1–4 ft |
| 4 | **Intermediate** | duck-dive; bottom turn and basic cutback; read sets and get back to the peak; surf most beach breaks | 2–6 ft |
| 5 | **Advanced intermediate** | link turns down the line; surf overhead waves calmly; handle currents and crowds; points and reefs on mellow days | 3–8 ft |
| 6 | **Advanced** | critical turns and the occasional barrel; double-overhead days; heavy reefs and points; long hold-downs | 3–12 ft |
| 7 | **Expert / big wave** | barrels on purpose; big-wave days; you know the risks and the spot | 4–20+ ft |

- **Migration:** today's Beginner → 2, Intermediate → 4, Expert → 7. Nobody's call changes until they pick a new level. A test byte-compares the Call for the three old values.
- **The size ranges are our own rule**, labelled as such and editable in "Comfortable wave size". The descriptions are written fresh (no surf school's wording copied). The data-honesty review checks the Call text names the level and its range.
- **Plunging-wave rule (call.ts):** "experts only" becomes "levels 6–7".

## Screens
1. **Welcome:** "Set up your surf profile: about 30 seconds. Your answers stay on this device." [Start] [Skip for now]
2. **About you:** age (required), sex, height, weight. Each field has a small "Why we ask" line under it; tapping (i) shows the full reason and where it's used.
3. **How you surf:** skill (the 7 level cards with "You can…" and the drawn wave at that size), stance, comfortable size (prefilled from the level), home spot.
4. **Done:** shows one result of the answers straight away (e.g. the wave drawn next to *you* at today's best spot) and an "Edit anytime in Personal → Profile" link.

## Elsewhere
- **Personal → Profile:** the same fields, the same "Why we ask" lines, and "Delete my profile" (clears local storage after a confirm).
- **Privacy page:** list each field, why it's asked, that it stays on the device today, and that under-13s get no saved data.
- **Data honesty:** a default is always labelled as a default. A rating or number never changes because of sex.

## Acceptance
- First run on a clean browser shows setup. Skip works on every step. A returning visitor never sees it again.
- Under 13: nothing personal saved (verify local storage); the app still works.
- Each field changes exactly what its "Why we ask" line says, verified with a test per field; unused fields can't be saved.
- 390 and 1440, light and dark; keyboard-only; labels read by screen readers.
- Gates: tsc, tests, journeys, t034, phone-pass; data-honesty review; a design look at the screens.
