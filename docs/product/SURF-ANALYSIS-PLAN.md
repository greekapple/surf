# Surf analysis: plan and prototype shell (T-063)

Status: **plan plus a prototype shell. No AI, no installs, no paid APIs.** The user approved "plan + prototype shell" on 2026-11-02. Everything beyond the shell needs the user's explicit approval at the points marked **Approval**.
Source: vault note `10-Projects/SWELLO/17-Surf-Analysis-and-Wearable.md` (status there: idea, not approved). Costs below come from that note and are rough estimates, not quotes.

## Goal
Help a surfer learn from their own rides, joined to the conditions they rode in. For example: "best rides at Linda Mar 4–5 ft mid tide on the 6'2". The join with forecast, tide and Quiver is the part only SWELLO can do.

## Phases
| Phase | What | Runs where | Cost | Needs |
|---|---|---|---|---|
| 0 (built now) | **Shell.** In a logged session, "Add a clip" picks a local video. Clean player with frame scrubbing, "Mark ride" start and end set by hand, ride stats (count, longest, average, time riding) from those marks, and an "AI analysis: coming, needs your OK" row | The browser, on the device; the video is kept in IndexedDB and never uploaded | None | Approved (T-063) |
| 1 | **Join.** Rides joined to the session's forecast hour, tide, wind, the board used and the user's own "What did you see?" observation (T-060), giving a per-session summary and "your best rides were in…" across sessions | Device | None | Product decision |
| 2 | **Phone-clip assist** (the note's recommended first step). Suggest ride start and end from motion in the user's own clip; the user confirms every suggestion | Device (on-device model) | None if on-device | **Approval:** pose or motion library (a new runtime dependency) |
| 3 | **Coaching notes.** Pose estimates (pop-up time, stance, compression, gaze) and notes labelled as AI | Device, or a vision API | Per-clip API cost if remote | **Approval:** an AI vision API (paid service; the clip or frames leave the device) or an on-device model |
| 4 | **Fixed cam** (shared with the observed-data strategy, note 16). Wave measurement, surfer detection, ride segmentation, automatic clips | Server | Camera, site, hosting | **Approval:** cam site, legal review (filming in public), storing clips |
| 5 | **Identity.** Match rides to the opted-in user via phone or watch GPS, an "I'm out" check-in, a colour band, or a SWELLO GPS+IMU tag (parts ~$25–45, retail idea $79–129, needs FCC and IP68) | Device plus server | Hardware | **Approval:** hardware; FCC |

## Privacy (required at every phase)
- **Opt-in only.** Nothing runs on a clip unless the user starts it.
- **Blur everyone else.** Any frame shown or kept that includes other people blurs them, before anything leaves the device.
- **No raw footage retained.** Phase 0 keeps the clip only in the user's own browser (removable with "Remove clip"). Later phases keep only derived numbers (ride times, pose metrics), never the video. Server-side footage, if a cam ever exists, is deleted after processing.
- Clips and marks are personal data. They aren't in the backup or export until the user is asked.

## Rule conflict to resolve first
Note 09 (AI Surf Cameras) says **"never identify, track or store individual surfers."** Coaching identifies one person: the opted-in user. Phases 0 and 1 don't conflict, because the user picks their own video and nothing is detected. Phases 2 onward (any detection, tracking or identity) need a **dated change to note 09 approved by the user**. For example: "never identify or track anyone except the opted-in user, on their own request; others are blurred." Until then, nothing past phase 1 is built.

## Needs the user's approval (summary)
1. A pose or motion library (new runtime dependency).
2. An AI vision API (paid, data leaves the device), or an on-device model.
3. Keeping clips beyond the device (any upload or server storage).
4. The note 09 rule change.
5. A fixed cam site, legal review and FCC (cam and tag).

## The shell, as built (phase 0)
- **Where:** Personal › Surf journal, "Add a clip" on a logged session (`src/features/personal/Clip.tsx`).
- **Video:** a local file, kept in IndexedDB on this device. If the browser refuses to store it, the panel says "kept only for this visit… gone after a reload".
- **Player:** Play/Pause, ±1 frame (30 fps assumed, shown as "f"), a scrub bar with time. Keys: Space, comma/period (Shift = 1 s), M marks.
- **Rides:** "Mark ride start" then "Mark ride end". Each ride can be jumped to or deleted. Stats come only from the marks: "nothing is detected automatically".
- **Reload:** the marks are kept (localStorage) and the clip is kept (IndexedDB). If the clip is gone (storage cleared or refused), the marks still show with "the clip itself is no longer on this device".
- **AI row:** "AI analysis · Coming: needs your OK first". Nothing behind it.
