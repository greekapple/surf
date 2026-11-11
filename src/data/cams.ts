/** T-063 "Live cam" links (the owner's page, opened in a new tab). The camera rule (amended 2026-11-10, user decision): SHOWING a camera is allowed when it is public domain, when the owner's terms allow embedding, or when the owner turned
 *  embedding on for their own YouTube stream; it must be credited, load only when the visitor taps (a video) and say honestly whether it is live (src/data/liveCamsSourced.ts, the Camera panel on the spot page). Analysing a camera's frames
 *  (AI, scraping, measuring) still needs written permission or public domain. SECOND AMENDMENT (2026-11-10, user decision and accepted risk while they email the host): a camera with UNKNOWN terms may also be embedded when its host
 *  offers an embeddable player; it must credit the host and the owner, load only on a tap, be removable on request and have a per-camera kill switch (`enabled` in src/data/liveCamsSourced.ts, scripts/build-live-cams.mjs). A host that forbids embedding
 *  (HDOnTap's player while it only allows sites it approves) stays link-only; Surfline is never used for cameras in any form (user, 2026-11-10: a competitor): never the raw stream, never a proxy, never a stripped header. The entries below are links only.
 *  A spot gets a link only when its owner's page was opened in a real browser and showed a working live camera. Every entry records who runs it,
 *  what it shows and when it was checked. The log of checked and skipped candidates is docs/forecast/CAMS.md. */
export interface Cam {
  spotId: string;
  /** Who publishes the page (the link label names them, never SWELLO). */
  owner: string;
  /** Who runs the camera, when it is someone else. */
  operator?: string;
  url: string;
  /** What the camera actually shows, so nobody mistakes it for a surf check it isn't. */
  view: string;
  verified: string;
  how: string;
}

export const CAMS: readonly Cam[] = [
  {spotId: 'cs-morro-rock', owner: 'Morro Bay National Estuary Program', operator: '805 Webcams', url: 'https://mbnep.org/baycam',
    view: 'Morro Rock and the harbour from the bay side, not the surf on the north side of the Rock', verified: '2026-11-02',
    how: 'Page loaded (HTTP 200) in Chrome with a playing YouTube live stream titled "Morro Bay Rock and Harbor Webcam - 805 Webcams"; on-screen clock 2026-11-02 12:27 PM.'},
  // T-080 (2026-11-02, ~11 PM): each page opened in Chrome (Playwright); a stream counts only if its player received video frames.
  {spotId: 'cs-malibu', owner: 'Swell Magnet', operator: 'Swell Magnet, streamed on HDOnTap', url: 'https://hdontap.com/stream/190972/malibu-point-live-surf-cam/about',
    view: 'Malibu Point and the Surfrider lineup (pan, tilt and zoom)', verified: '2026-11-02',
    how: 'HTTP 200; the page\'s video element received a 1920 px stream; the page names Swell Magnet as the partner running it.'},
  {spotId: 'cs-el-porto', owner: 'Swell Magnet', operator: 'Swell Magnet, streamed on HDOnTap', url: 'https://hdontap.com/stream/471422/el-porto-rosecrans-live-cam/about',
    view: 'El Porto beachfront from the Rosecrans overlook, 38th to 45th Street', verified: '2026-11-02',
    how: 'HTTP 200; the video element received a 2560 px stream; Swell Magnet named as partner.'},
  {spotId: 'cs-hermosa', owner: 'Swell Magnet', operator: 'Swell Magnet, streamed on HDOnTap', url: 'https://hdontap.com/stream/567567/hermosa-beach-pier-north-live-webcam/about',
    view: 'Hermosa Beach north of the pier', verified: '2026-11-02',
    how: 'HTTP 200; the video element received a 2560 px stream; Swell Magnet named as partner.'},
  {spotId: 'cs-blacks', owner: 'Hotel La Jolla', operator: 'Hotel La Jolla, streamed on HDOnTap', url: 'https://hdontap.com/stream/449923/la-jolla-shores-overlook-live-webcam/about',
    view: 'La Jolla Shores from the hotel; the roaming camera pans to Scripps Pier and Black\'s Beach, not a fixed view of Black\'s', verified: '2026-11-02',
    how: 'HTTP 200; the video element received a 2560 px stream; the page says "Brought to you by Hotel La Jolla" and lists Blacks Beach among its views.'},
  {spotId: 'spot-8', owner: 'Santa Cruz Port District', operator: 'Santa Cruz Port District (HDRelay player)', url: 'https://www.santacruzharbor.org/webcams',
    view: 'Santa Cruz Harbor entrance channel and nearby beaches, about 3 km west of Pleasure Point; not the Pleasure Point break', verified: '2026-11-02',
    how: 'HTTP 200; the district\'s own page embeds a live player (HDRelay) that showed the harbor entrance light at night with "Tap to play live".'},
];

export const camFor = (spotId: string): Cam | null => CAMS.find((c) => c.spotId === spotId) ?? null;

/** T-106 SWELLO's OWN live cams (docs/product/CAMS-PLAN.md), the only cams the Home hero may play: none exist yet. The public cams above are
 *  other owners' pages: links, unless a camera qualifies for the Camera panel under the rule at the top of this file. An entry is added only once our camera streams. */
export interface OwnCam {spotId: string; /** A stream the browser plays directly (HLS for Safari, or an MP4/WebM loop). */ src: string; label: 'Live cam · SWELLO'; since: string}
export const OWN_CAMS: readonly OwnCam[] = [];
/** T-111: every verified public cam for a spot (the spot page lists them as links). */
export const camsFor = (spotId: string): readonly Cam[] => CAMS.filter((c) => c.spotId === spotId);
