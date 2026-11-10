# Draft: SWELLO's own camera at Ocean Beach (pilot; not started)

The user, 2026-11-10: "maybe start with Ocean Beach own cam first, I can try to do that later on."

Status: **DRAFT**. Nothing is bought, mounted or asked. The user does the asking and the spending.

## Why Ocean Beach
- It's the user's home break and the app's busiest spot.
- It has rich references to calibrate against: CDIP San Francisco Bar buoy 142 (46237), NDBC 46026, MOP points along the beach, and NOAA San Francisco tides.
- Its sandbars move, and a camera sees that while models don't.

## What the camera has to do
- **See the surf zone at Kelly's Cove to Sloat** (or one section first), in daylight.
- **Send a still every 5–10 minutes** over cellular or Wi-Fi. A still, not video, keeps data, power and privacy small.
- **Never be used to identify people:**
  - frames are processed server-side for aggregate measures only (breaking or not, set interval, relative height against fixed markers);
  - people are only blurred or excluded;
  - frames are deleted after processing (or kept up to 24 h for calibration);
  - this follows vault `09-AI-Surf-Cameras.md`.
- **Calibrate against the buoys and the How-right archive** before any number shows in the app, labelled "Observed · AI estimate".

## Where it could go (to check, with owners to ask)
Who owns or runs the land along Ocean Beach must be confirmed before anything is asked:
- most of Ocean Beach is managed by the **National Park Service (Golden Gate National Recreation Area)**;
- some adjacent parcels and structures are **City and County of San Francisco**: Recreation and Parks, or Public Works for the seawall and Great Highway;
- private or concession buildings along the Great Highway may offer a rooftop.

The usual paths are a permit (NPS special use, or a city encroachment or permit), a partner who already has a mast or a building (lifeguards, a beachfront business), or an existing camera owner agreeing to share stills. The Bay Area camera inventory (`docs/forecast/BAYAREA-CAMERAS.md`, in progress) may find an existing camera first, which would be the cheapest start.

## Hardware (to quote; no prices guessed here)
- a weatherproof camera with a fixed lens covering the section, and a still-capture API or FTP;
- power: mains on a building, or solar plus battery on a mast;
- a cellular modem plus a data plan, unless a building network is offered;
- a mount that is salt-rated and theft-resistant.

Prices come from real quotes when the user decides to proceed.

## Software (exists or is planned)
- Ingest: the Worker stores stills in R2 with a short retention (like the NDBC archive pattern).
- Phase C inference and calibration: Fable briefing Track 6.
- Display: the spot page shows "Observed · AI estimate" with confidence, only after review by the lead and the user.

## Next steps (when the user says go)
1. Confirm land ownership and permit routes for 2–3 candidate mount points.
2. Get hardware quotes.
3. Draft the ask (for the user to send).
4. Install, then 2–4 weeks of calibration against the buoys before anything shows in the app.
