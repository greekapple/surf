# Launch gate: what must be true before anything goes public

The user, 2026-11-12: run the multi-agent ultra review before publishing anything, once every launch dependency is gone and the app is basically there, and work through the legal checklist from the saved reels. The app's name may change before launch, so nothing here depends on the name "SWELLO".

**Order:** (1) clear the dependencies → (2) work through the legal checklist → (3) the user runs `/code-review ultra` (user-triggered and billed; Claude can't start it) → (4) fix its findings → (5) publish.

## 1. Dependencies that must be gone first
- ~~**Open-Meteo:** the free API is non-commercial.~~ **Done 2026-11-12:** Standard commercial plan bought; the key lives in the Worker secret `OPEN_METEO_KEY` (never in a file); `/api/health` shows `openMeteo.plan`.
- **Owner tools off (ca-only, 2026-11-13):** with the flag off the app lists California only and ignores a stored `previewRegions` (the "Preview regions not open yet" switch lives in the Owner tools section, which also does not exist then). Check the launch `dist` has no "Preview regions" text and that a profile with `previewRegions: true` still shows California only. The flag rule itself is the next item.
- **Licensed 3D assets:** the clean-room wave is now the default. Remove the TurboSquid-derived atlas and meshes from the public build (`public/media/scale3d-atlas`, `scale3d-live`), and anything else built from them (surfer.glb provenance included).
- **Duck FRF:** private use only. Hide it from public builds.
- **Data licences:** re-check every source on the Credits page for commercial use (CDIP, PacIOOS, NOAA, OSM/OpenFreeMap attribution, guide facts as cited facts only).
- **Cameras:** HDOnTap snapshot terms only (attribution, logo link, per-camera links). No analysis until HDOnTap agrees in writing.
- **Accounts:** email sign-up becomes the first setup step; needs the data inventory, COPPA age gate, privacy update. (Code: `STEPS` in `src/features/personal/ProfileSetup.tsx` is where an `account` step slots in first.)
- **Owner tools off:** the launch build must not set `VITE_OWNER_TOOLS` (only `build:cf:private` and `.env.development` do). Check no "Owner tools" section and no other regions in the launch bundle.
- **Name:** if the name changes, check trademark availability (USPTO search, app stores, domains) before buying anything or printing it anywhere.

## 2. Legal checklist (from the saved reels: Alex Yates Dc7PlCYMzpW, Adilet DdyqycEINNe)
Status as of 2026-11-12. "n/a" means the app doesn't have the feature yet; re-check when it does.

| Item | Why it matters | Status |
|---|---|---|
| Privacy policy | required wherever personal data is touched | **Have** (`src/ui/Legal.tsx`): local storage, third-party services, HDOnTap image loads show the visitor's IP to HDOnTap. Re-check at launch. |
| Terms and conditions | limits liability; forecasts are not safety advice | **Have**. Add an explicit "forecasts can be wrong; surf at your own risk" line before launch. |
| Cookie policy and consent | consent needed if non-essential cookies or trackers are used | No cookies, no analytics today. Local storage is for the person's own settings only. If analytics is ever added: consent first, and **no session replay** (Adilet: in California, recording keystrokes can count as wiretapping under CIPA, $5K per session). |
| Fonts from Google's servers | a German court fined a site €100 per visitor for leaking IPs to Google (GDPR) | **OK:** self-hosted, no `fonts.googleapis` in the code. |
| Third-party embeds | each one sees the visitor's IP | Basemap tiles, HDOnTap snapshots and data APIs are listed on the Privacy page. Keep that list current. |
| Only necessary data | data minimisation | No accounts and no server-side personal data yet. Accounts at launch need a data inventory. |
| Age (COPPA) | under-13 sign-ups: up to $53K per child | n/a (no sign-up). At launch: an age gate or 13+ terms, no data from under-13s. |
| Marketing email (CAN-SPAM) | up to $53K per email without an unsubscribe link and postal address | n/a. The waitlist/launch email must have both. |
| Subscription and refund terms | California auto-renewal law: renewal terms next to the buy button, easy cancel, otherwise renewals are refundable | n/a until payments. Stripe or the app store, renewal terms shown at checkout, a refund policy page. |
| Form consent | say what a form's data is for | n/a (no forms send data yet). |
| User uploads / DMCA agent | without a registered DMCA agent ($6 at the Copyright Office), you're liable for users' stolen images | n/a. Register one before users can upload anything (photos, session clips). |
| Accessibility | alt text, contrast, keyboard use, clear button labels | Mostly in place (journeys, t034 tap targets, alt text on cameras and photos). The ultra review and an axe pass before launch. |
| No fake reviews or unsupported claims | FTC; "more accurate" must be proven | The data-honesty rules already apply. Any "more accurate than X" claim needs the published scorecard behind it. Creator promos need #ad / "paid partnership" (FTC). |
| Business details | who runs the service, how to contact | Add an operator name, contact email and location to Terms/Credits at launch. The user is a minor, so a parent or guardian may need to be the legal party for contracts and payments. Check this before charging. |
| Image copyright | every photo licensed or credited | CC photos credited. Keep the photo provenance list current; no AI imagery on condition surfaces. |
| Local law | California (CCPA/CPRA, auto-renewal, CIPA), US federal, EU/UK if open there | California-first launch. Keep other regions hidden until each is reviewed. |

## 3. The ultra review
When 1 and 2 are done, the user runs `/code-review ultra` on the launch branch. Fix all P0/P1 findings before publishing.
