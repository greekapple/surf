/** hdontap-snaps (HDOnTap offer of 2026-11-12; terms in docs/forecast/CAMS.md, "HDOnTap live-updating snapshots"): the HDOnTap cameras whose live-updating
 *  SNAPSHOT (a still image HDOnTap refreshes about once a minute) the spot page shows. The terms, all enforced here and in HdontapSnaps.tsx:
 *  - the line "Live Streaming Cams Provided by HDOnTap.com" and the HDOnTap logo linking to HDONTAP_LOGO_LINK, once per camera block;
 *  - each snapshot is a link to its own HDOnTap camera page, with the referral link HDOnTap supplies (`linkUrl`; until it arrives, the plain page URL);
 *  - their image URL is used as given, loaded by the visitor's browser from HDOnTap: never proxied, copied, cached (R2 or anywhere) or recorded;
 *  - refreshed about every 60 s while the page is visible, never faster (a per-minute cache-bust).
 *  A camera with `snapshotUrl: null` (HDOnTap has not sent it yet) shows NOTHING: no tile, no placeholder.
 *  Spots: the app spot the camera shows, from its HDOnTap pin (docs/forecast/data/camera-sources.json) and the nearest spot, checked 2026-11-12. Two are not the
 *  nearest spot: La Jolla Shores (nearest is La Jolla Cove, a different break; the camera shows the Shores beach, the same beach as Scripps) and Dana Point Harbor
 *  (nearest is Strands, behind the headland; the camera shows the harbor and its beach, by Doheny). */
export interface HdontapCam {
  /** HDOnTap's stream number (the page URL's first part) */
  stream: string; slug: string;
  /** the camera's name, as HDOnTap gives it */
  name: string;
  /** the switcher's label (a few words) */
  short: string;
  spotId: string;
  /** distance from the spot's pin to the camera's pin, km (rounded) */
  km: number;
  /** HDOnTap's snapshot URL for SWELLO, exactly as HDOnTap sent it; null until they send it (then the camera shows nothing) */
  snapshotUrl: string | null;
  /** HDOnTap's referral link to the camera page; null until they send it (the page URL is used instead) */
  linkUrl: string | null;
  /** who runs the camera, from the camera list (HDOnTap streams it); null when the list names nobody */
  owner: string | null;
  /** the camera is at a neighboring beach or harbor, not this spot: said with the distance ("2 km away, at Dana Point Harbor (a neighboring beach, not this spot)") */
  neighbour?: string;
  /** the camera list says it shows only part of the break or the beach */
  partial?: boolean;
  /** cam-hero (user, 2026-11-13: "on Venice, the cam replaces the little diagram at the top"): this camera's snapshot is the spot page's header band, the first thing on the page.
   *  Opt-in per camera; at most one per spot (the first wins). The camera section lower down then leaves it out, so it never shows twice. */
  hero?: true;
  /** the camera list's last status, when it said the stream was down: such a camera is not shown until it is checked again and this is cleared */
  status?: {word: 'down'; checked: string};
}

/** The attribution HDOnTap's terms require, word for word. */
export const HDONTAP_ATTRIBUTION = 'Live Streaming Cams Provided by HDOnTap.com';
/** The logo's link, exactly as HDOnTap gave it. */
export const HDONTAP_LOGO_LINK = 'https://hdontap.com/?utm_source=swello&utm_medium=referral&utm_campaign=logo+swello';
/** The logo, HDOnTap's own files (sent with their offer; user OK to keep them in the public repo, 2026-11-12), 360x121: colour on the light theme, white on the dark. */
export const HDONTAP_LOGO = {light: '/media/hdontap/hdontap-logo.png', dark: '/media/hdontap/hdontap-logo-white.png', alt: 'HDOnTap', w: 360, h: 121} as const;

export const HDONTAP_CAMS: readonly HdontapCam[] = [
  {stream: '255678', slug: 'huntington-beach-pier-live-cam', name: 'Huntington Beach Pier', short: 'Pier', spotId: 'cs-huntington', km: 0, snapshotUrl: null, linkUrl: null, owner: null, status: {word: 'down', checked: '2026-11-09'}},
  {stream: '190972', slug: 'malibu-point-live-surf-cam', name: 'Malibu Point', short: 'Point', spotId: 'cs-malibu', km: 0.2, snapshotUrl: null, linkUrl: null, owner: 'Swell Magnet'},
  {stream: '204757', slug: 'malibu-pier-live-webcam', name: 'Malibu Pier', short: 'Pier', spotId: 'cs-malibu', km: 0.3, snapshotUrl: null, linkUrl: null, owner: 'Swell Magnet'},
  {stream: '565350', slug: 'topanga-beach-surf-cam', name: 'Topanga Beach', short: 'Topanga', spotId: 'cs-topanga', km: 0.1, snapshotUrl: null, linkUrl: null, owner: null},
  {stream: '322247', slug: 'venice-beach-roaming-live-surf-cam', name: 'Venice Roaming Surf Cam', short: 'Roaming', spotId: 'cs-venice-breakwater', km: 0.5, hero: true,
    snapshotUrl: 'https://portal.hdontap.com/snapshot/venice_ptz_swellmagnet-SWELLO-REFERRAL?overlay=yes&position=ll&size=640x360&overlay_image=upload_46c1859aba858d1cb3d8ba7e97166bf9.png&padx=7&pady=7', linkUrl: null, owner: 'Swell Magnet'},
  {stream: '956353', slug: 'venice-beach-wide-view-live-webcam', name: 'Venice Wide View', short: 'Wide', spotId: 'cs-venice-breakwater', km: 0.5, snapshotUrl: null, linkUrl: null, owner: 'Swell Magnet'},
  {stream: '567567', slug: 'hermosa-beach-pier-north-live-webcam', name: 'Hermosa Pier North', short: 'Pier N', spotId: 'cs-hermosa', km: 0, snapshotUrl: null, linkUrl: null, owner: 'Swell Magnet'},
  {stream: '732858', slug: 'hermosa-beach-pier-south-live-webcam', name: 'Hermosa Pier South', short: 'Pier S', spotId: 'cs-hermosa', km: 0, snapshotUrl: null, linkUrl: null, owner: 'Swell Magnet'},
  {stream: '199895', slug: 'hermosa-beach-north-live-webcam', name: 'Hermosa North', short: 'North', spotId: 'cs-hermosa', km: 0.5, snapshotUrl: null, linkUrl: null, owner: 'Swell Magnet'},
  {stream: '417105', slug: 'hermosa-beach-south-live-surf-cam', name: 'Hermosa South', short: 'South', spotId: 'cs-hermosa', km: 0, snapshotUrl: null, linkUrl: null, owner: 'Swell Magnet'},
  {stream: '451277', slug: 'el-porto-overlook-live-surf-camera', name: 'El Porto Overlook', short: 'Overlook', spotId: 'cs-el-porto', km: 0.3, snapshotUrl: null, linkUrl: null, owner: 'Swell Magnet'},
  {stream: '471422', slug: 'el-porto-rosecrans-overlook-live-cam', name: 'El Porto Rosecrans Overlook', short: 'Rosecrans', spotId: 'cs-el-porto', km: 0.2, snapshotUrl: null, linkUrl: null, owner: 'Swell Magnet'},
  {stream: '532541', slug: 'la-jolla-shores-live-surf-cam', name: 'La Jolla Shores Surf Cam', short: 'Surf cam', spotId: 'cs-scripps', km: 1.5, snapshotUrl: null, linkUrl: null, owner: 'HDOnTap'},
  {stream: '449923', slug: 'la-jolla-shores-overlook-live-webcam', name: 'La Jolla Shores Overlook', short: 'Overlook', spotId: 'cs-scripps', km: 1.7, snapshotUrl: null, linkUrl: null, owner: 'Hotel La Jolla'},
  {stream: '155380', slug: 'carlsbad-beach-surf-live-webcam', name: 'Carlsbad Beach', short: 'Carlsbad', spotId: 'cs-tamarack', km: 1, snapshotUrl: null, linkUrl: null, owner: 'Seashore on the Sand'},
  {stream: '994481', slug: 'dana-point-harbor-laguna-cliffs-resort-live-webcam', name: 'Dana Point Harbor (Laguna Cliffs)', short: 'Harbor', spotId: 'cs-doheny', km: 2, snapshotUrl: null, linkUrl: null, owner: 'Laguna Cliffs Resort & Spa', neighbour: 'at Dana Point Harbor', partial: true},
  {stream: '257733', slug: 'monterey-bays-seascape-beach-resort-live-webcam', name: 'Seascape (Monterey Bay)', short: 'Seascape', spotId: 'cs-manresa', km: 2.6, snapshotUrl: null, linkUrl: null, owner: 'Seascape Beach Resort', neighbour: 'at Seascape', partial: true},
];

/** The camera's HDOnTap page. */
export const hdontapPage = (c: HdontapCam) => `https://hdontap.com/stream/${c.stream}/${c.slug}/`;
/** Where the snapshot links: HDOnTap's referral link when they have sent it, else the camera page. */
export const hdontapLink = (c: HdontapCam) => c.linkUrl ?? hdontapPage(c);
/** The spot's cameras that have a snapshot (only these are shown), in registry order. */
export const snapshotCamsFor = (spotId: string): HdontapCam[] => HDONTAP_CAMS.filter((c) => c.spotId === spotId && c.snapshotUrl !== null && !c.status);
/** The snapshot's URL for minute `nowMs`: HDOnTap's URL as given plus a per-minute cache-bust, so the browser asks at most once a minute (HDOnTap caches about 60 s). */
export const snapshotSrc = (url: string, nowMs: number) => `${url}${url.includes('?') ? '&' : '?'}t=${Math.floor(nowMs / 60000)}`;
export const SNAPSHOT_REFRESH_MS = 60000;
/** True when, on spot `spotId`, the snapshot block shows the camera at this HDOnTap page URL (any form: /about, a trailing slash): there it replaces that camera's older link or embed.
 *  On any other spot (e.g. the Hotel La Jolla camera, linked from Black's but mapped to Scripps here) the old link stays. */
export const hasSnapshot = (url: string, spotId: string): boolean => { const m = /hdontap\.com\/stream\/(\d+)\//.exec(url); return !!m && snapshotCamsFor(spotId).some((c) => c.stream === m[1]); };
/** "Swell Magnet camera via HDOnTap"; HDOnTap's own camera; or, when the list names nobody, "camera streamed on HDOnTap (owner not named)". */
export const ownerWords = (c: HdontapCam) => (c.owner === 'HDOnTap' ? 'HDOnTap\'s own camera' : c.owner ? `${c.owner} camera via HDOnTap` : 'camera streamed on HDOnTap (owner not named)');
/** cam-hero: the spot's header camera (a snapshot camera marked `hero`), or null: every other spot keeps its photo, drawn wave or plan. */
export const heroCamFor = (spotId: string): HdontapCam | null => snapshotCamsFor(spotId).find((c) => c.hero) ?? null;
/** The snapshot cameras the camera SECTION shows: all but the header's (one camera is never shown twice). */
export const sectionCamsFor = (spotId: string): HdontapCam[] => snapshotCamsFor(spotId).filter((c) => !c.hero);
