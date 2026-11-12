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
| Skill | beginner · intermediate · advanced · expert | The Call (Go / Skip) and the wave sizes it treats as yours. Already used. |
| Stance | regular · goofy · not sure | Whether a spot's lefts or rights are your frontside, in the spot notes and the 3D view (peel direction). |
| Comfortable wave size | min–max range (prefilled from skill) | The Call: "above the range you prefer". Already used. |
| Home spot / region | pick from the map or search | Home's best bet and "nearby" ranking. |
| Units | ft/m, mph/kn/km/h, face/Hawaiian | Every number on screen. Already used. |
| Boards | add now or later | Board Match and "Take your …". Already used. |

## Screens
1. **Welcome:** "Set up your surf profile: about 30 seconds. Your answers stay on this device." [Start] [Skip for now]
2. **About you:** age (required), sex, height, weight. Each field has a small "Why we ask" line under it; tapping (i) shows the full reason and where it's used.
3. **How you surf:** skill, stance, comfortable size (prefilled from skill), home spot.
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
