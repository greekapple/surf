/** T-063 "Live cam" links. Links only: SWELLO never embeds, frames or analyses another owner's camera (that needs their permission).
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
