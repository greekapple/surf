/** T-063 "Live cam" links (the owner's page, opened in a new tab). The camera rule (amended 2026-11-10, user decision): SHOWING a camera is allowed when it is public domain, when the owner's terms allow embedding, or when the owner turned
 *  embedding on for their own YouTube stream; it must be credited, load only when the visitor taps (a video) and say honestly whether it is live (src/data/liveCamsSourced.ts, the Camera panel on the spot page). Analysing a camera's frames
 *  (AI, scraping, measuring) still needs written permission or public domain. SECOND AMENDMENT (2026-11-10, user decision and accepted risk while they email the host): a camera with UNKNOWN terms may also be embedded when its host
 *  offers an embeddable player; it must credit the host and the owner, load only on a tap, be removable on request and have a per-camera kill switch (`enabled` in src/data/liveCamsSourced.ts, scripts/build-live-cams.mjs). A host that forbids embedding
 *  (Surfline, and HDOnTap's player while it only allows sites it approves) stays link-only: never the raw stream, never a proxy, never a stripped header. The entries below are links only.
 *  A spot gets a link only when its owner's page was opened in a real browser and showed a working live camera. Every entry records who runs it,
 *  what it shows and when it was checked. The log of checked and skipped candidates is docs/forecast/CAMS.md. */
export interface Cam {
  spotId: string;
  /** 'surfline' = a link to Surfline's own page for the spot (never embedded, framed, previewed or analysed; it may need a Surfline subscription). The map and the Callout do not use these: `camsFor` leaves them out, `surflineFor` returns them. */
  provider?: 'surfline';
  /** The camera or spot page's name on its owner's site (Surfline). */
  camName?: string;
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
  // surfline-links (2026-11-10, user: "only link for now"): Surfline's public spot pages for the Bay Area spots where Surfline lists a cam. Links only: no iframe, no embed, no thumbnail, no preview.
  {spotId: 'spot-7', provider: 'surfline', camName: 'Cowells', owner: 'Surfline', url: 'https://www.surfline.com/surf-report/cowells/5842041f4e65fad6a7708806',
    view: "Surfline's Cowells page (its title says Surf Cams)", verified: '2026-11-10',
    how: 'Surfline\'s own pages block automated reads (a Cloudflare challenge, HTTP 403), so the page was NOT opened. The URL, the page name and the cam listing were read from public web-search results (several results for the same id; the title of the page says Surf Cam / Surf Cams / Live Surf Cam). Link only.'},
  {spotId: 'spot-6', provider: 'surfline', camName: 'Steamer Lane', owner: 'Surfline', url: 'https://www.surfline.com/surf-report/steamer-lane/5842041f4e65fad6a7708805',
    view: "Surfline's Steamer Lane page (its title says Surf Cams; a separate Steamer Lane Overview page shows the HD cam)", verified: '2026-11-10',
    how: 'Surfline\'s own pages block automated reads (a Cloudflare challenge, HTTP 403), so the page was NOT opened. The URL, the page name and the cam listing were read from public web-search results (several results for the same id; the title of the page says Surf Cam / Surf Cams / Live Surf Cam). Link only.'},
  {spotId: 'spot-8', provider: 'surfline', camName: 'Pleasure Point', owner: 'Surfline', url: 'https://www.surfline.com/surf-report/pleasure-point/5842041f4e65fad6a7708807',
    view: "Surfline's Pleasure Point page (its title says Surf Cams)", verified: '2026-11-10',
    how: 'Surfline\'s own pages block automated reads (a Cloudflare challenge, HTTP 403), so the page was NOT opened. The URL, the page name and the cam listing were read from public web-search results (several results for the same id; the title of the page says Surf Cam / Surf Cams / Live Surf Cam). Link only.'},
  {spotId: 'cs-capitola', provider: 'surfline', camName: 'Capitola', owner: 'Surfline', url: 'https://www.surfline.com/surf-report/capitola/5842041f4e65fad6a7708ddf',
    view: "Surfline's Capitola page (its title says Surf Cams)", verified: '2026-11-10',
    how: 'Surfline\'s own pages block automated reads (a Cloudflare challenge, HTTP 403), so the page was NOT opened. The URL, the page name and the cam listing were read from public web-search results (several results for the same id; the title of the page says Surf Cam / Surf Cams / Live Surf Cam). Link only.'},
  {spotId: 'spot-2', provider: 'surfline', camName: 'Ocean Beach Overview', owner: 'Surfline', url: 'https://www.surfline.com/surf-report/ocean-beach-overview/5842041f4e65fad6a77087f8',
    view: "Surfline's Ocean Beach Overview page (its title says Live Surf Cam; Surfline marks it a premium-only high-resolution cam)", verified: '2026-11-10',
    how: 'Surfline\'s own pages block automated reads (a Cloudflare challenge, HTTP 403), so the page was NOT opened. The URL, the page name and the cam listing were read from public web-search results (several results for the same id; the title of the page says Surf Cam / Surf Cams / Live Surf Cam). Link only.'},
  {spotId: 'spot-5', provider: 'surfline', camName: "Maverick's", owner: 'Surfline', url: 'https://www.surfline.com/surf-report/maverick-s/5842041f4e65fad6a7708801',
    view: "Surfline's Maverick's page (its title says Surf Cams)", verified: '2026-11-10',
    how: 'Surfline\'s own pages block automated reads (a Cloudflare challenge, HTTP 403), so the page was NOT opened. The URL, the page name and the cam listing were read from public web-search results (several results for the same id; the title of the page says Surf Cam / Surf Cams / Live Surf Cam). Link only.'},
  {spotId: 'cs-half-moon-bay', provider: 'surfline', camName: 'Half Moon Bay', owner: 'Surfline', url: 'https://www.surfline.com/surf-report/half-moon-bay/5842041f4e65fad6a770896f',
    view: "Surfline's Half Moon Bay page (its title says Surf Cam)", verified: '2026-11-10',
    how: 'Surfline\'s own pages block automated reads (a Cloudflare challenge, HTTP 403), so the page was NOT opened. The URL, the page name and the cam listing were read from public web-search results (several results for the same id; the title of the page says Surf Cam / Surf Cams / Live Surf Cam). Link only.'},
  {spotId: 'cs-sharp-park', provider: 'surfline', camName: 'Sharp Park', owner: 'Surfline', url: 'https://www.surfline.com/surf-report/sharp-park/5842041f4e65fad6a770897c',
    view: "Surfline's Sharp Park page (its title says Surf Cam)", verified: '2026-11-10',
    how: 'Surfline\'s own pages block automated reads (a Cloudflare challenge, HTTP 403), so the page was NOT opened. The URL, the page name and the cam listing were read from public web-search results (several results for the same id; the title of the page says Surf Cam / Surf Cams / Live Surf Cam). Link only.'},
  {spotId: 'spot-3', provider: 'surfline', camName: 'Linda Mar', owner: 'Surfline', url: 'https://www.surfline.com/surf-report/linda-mar/5842041f4e65fad6a7708976',
    view: "Surfline's Linda Mar page (its title says Surf Cams)", verified: '2026-11-10',
    how: 'Surfline\'s own pages block automated reads (a Cloudflare challenge, HTTP 403), so the page was NOT opened. The URL, the page name and the cam listing were read from public web-search results (several results for the same id; the title of the page says Surf Cam / Surf Cams / Live Surf Cam). Link only.'},
  {spotId: 'spot-1', provider: 'surfline', camName: 'Stinson Beach', owner: 'Surfline', url: 'https://www.surfline.com/surf-report/stinson-beach/5842041f4e65fad6a77089c1',
    view: "Surfline's Stinson Beach page (its title says Surf Cams)", verified: '2026-11-10',
    how: 'Surfline\'s own pages block automated reads (a Cloudflare challenge, HTTP 403), so the page was NOT opened. The URL, the page name and the cam listing were read from public web-search results (several results for the same id; the title of the page says Surf Cam / Surf Cams / Live Surf Cam). Link only.'},
];

export const camFor = (spotId: string): Cam | null => CAMS.find((c) => c.spotId === spotId && c.provider !== 'surfline') ?? null;

/** T-106 SWELLO's OWN live cams (docs/product/CAMS-PLAN.md), the only cams the Home hero may play: none exist yet. The public cams above are
 *  other owners' pages: links, unless a camera qualifies for the Camera panel under the rule at the top of this file. An entry is added only once our camera streams. */
export interface OwnCam {spotId: string; /** A stream the browser plays directly (HLS for Safari, or an MP4/WebM loop). */ src: string; label: 'Live cam · SWELLO'; since: string}
export const OWN_CAMS: readonly OwnCam[] = [];
/** T-111: every verified public cam for a spot (the spot page lists them as links). */
export const camsFor = (spotId: string): readonly Cam[] => CAMS.filter((c) => c.spotId === spotId && c.provider !== 'surfline');
/** Surfline's page for a spot (link only), where Surfline lists a cam. */
export const surflineFor = (spotId: string): Cam | null => CAMS.find((c) => c.spotId === spotId && c.provider === 'surfline') ?? null;
