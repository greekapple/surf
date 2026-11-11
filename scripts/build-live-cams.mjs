#!/usr/bin/env node
// The "Live cam" panel's data (bayarea-cams-wire): the usable-now Bay Area cameras of docs/forecast/data/camera-sources.json (the rows merged with docs/forecast/BAYAREA-CAMERAS.md), wired to the spots the research
// says each one sees. DISPLAY ONLY: no frame is analysed, stored or fetched by SWELLO's server (the still is loaded by the visitor's browser from the owner's host; a YouTube player loads only on a click).
//   node scripts/build-live-cams.mjs > src/data/liveCamsSourced.ts        (a test checks the committed file equals this output)
// A row is used only when it says: permissionClass display-only or display+analysis, embedAllowed yes, uptime live on the check date, and its host is not an excluded one (Surfline and its partners).
// What comes from the row: the owner, the attribution text, the page and embed URLs, the licence, the refresh note, the check date, the distance of each spot (nearestSpots[].km). The short "view" notes are the research's own
// words for what each camera shows (BAYAREA-CAMERAS.md "View" column and each row's viewsSurfEvidence), written here once per camera; a spot with no row has no camera.
import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync(new URL('../docs/forecast/data/camera-sources.json', import.meta.url), 'utf8')).rows, byId = new Map(rows.map((r) => [r.id, r]));
const USGS = 'usgs-coastcam-santa-cruz-dream-inn', STILL_C2 = 'https://cmgp-coastcam.s3-us-west-2.amazonaws.com/cameras/dreaminn/latest/c2_snap.jpg';
/** `credit: 'USGS'` = the row's own attribution text. One entry per (spot, camera), in display order (the Chamberlin west view first). `tab` = the short name of the view on the selector (the owner's own view words: west, pier north, close-up, Mori Point south). */
const WIRING = [
  {spotId: 'spot-7', row: USGS, kind: 'still', metaId: 'usgs-dream-inn-c2', stillUrl: STILL_C2, view: 'Cowells Beach, looking southward: the cove and the break (camera 2 of the USGS Dream Inn station)',
    credit: 'USGS', offline: 'USGS collects images in daylight only; an old frame means the camera system may be offline (USGS page).'},
  {spotId: 'spot-6', row: USGS, kind: 'still', metaId: 'usgs-dream-inn-c2', stillUrl: STILL_C2, view: 'Partial view: West Cliff point; the Lane is mostly out of frame (the Cowells camera)',
    credit: 'USGS', offline: 'USGS collects images in daylight only; an old frame means the camera system may be offline (USGS page).'},
  {spotId: 'cs-sharp-park', row: 'chamberlin-sharp-park-west', tab: 'West', kind: 'youtube', view: 'Sharp Park beach break, looking west', credit: 'Chamberlin Nature (pacificaview.net), live cam via YouTube'},
  {spotId: 'cs-sharp-park', row: 'chamberlin-pacifica-pier-north', tab: 'Pier, north', kind: 'youtube', view: 'Sharp Park break with Pacifica Municipal Pier on the right, looking north', credit: 'Chamberlin Nature (pacificaview.net), live cam via YouTube'},
  {spotId: 'cs-sharp-park', row: 'chamberlin-pacifica-pier-closeup', tab: 'Pier, close-up', kind: 'youtube', view: 'Pacifica Pier, zoomed in, looking north', ownerDescribed: true, credit: 'Chamberlin Nature (pacificaview.net), live cam via YouTube'},
  {spotId: 'cs-sharp-park', row: 'chamberlin-mori-point-south', tab: 'Mori Point, south', kind: 'youtube', view: 'Sharp Park shorebreak running south to Mori Point; Rockaway and Linda Mar are hidden behind the point', credit: 'Chamberlin Nature (pacificaview.net), live cam via YouTube'},
  {spotId: 'spot-3', row: 'linda-mar-beach-cam-youtube', kind: 'youtube', view: 'The whole Linda Mar crescent from an elevated hillside, distant (the beach, not a close view of the lineup)', credit: 'Linda Mar Beach Cam, live cam via YouTube',
    operatorNote: 'Operator not named (the channel does not name them; it joined YouTube on 2026-08-25). Re-checked by hand on 2026-11-10: YouTube oEmbed for the stream still answers for the channel called Linda Mar Beach Cam, with embedding on.'},
  {spotId: 'cs-huntington', row: 'hb-city-pier-youtube', tab: 'Pier', kind: 'youtube', view: 'Huntington Beach Pier: looking down the pier deck, surf breaking on both sides', credit: 'City of Huntington Beach, live cam via YouTube'},
  {spotId: 'cs-huntington', row: 'hb-city-lifeguard-hq-youtube', tab: 'Lifeguard HQ', kind: 'youtube', view: 'The beach south of the pier from Lifeguard HQ; the surf is small in frame', credit: 'City of Huntington Beach, live cam via YouTube'},
  // A NEIGHBORING beach, never presented as this spot: the words say so ("about 2.5 km south (a neighboring beach)").
  {spotId: 'cs-hermosa', row: 'redondo-city-pier-south-youtube', kind: 'youtube', neighbour: 'south', view: 'City of Redondo Beach pier cam: the beach south of Redondo Pier', credit: 'City of Redondo Beach, live cam via YouTube'},
  {spotId: 'cs-venice-breakwater', row: 'explore-santa-monica-beach-pier', kind: 'youtube', neighbour: 'north', view: 'Santa Monica Beach and Pier (explore.org)', credit: 'explore.org (Annenberg Foundation), live cam via YouTube'},
];
/** KILL SWITCH. To switch ONE camera off, add its id ('<row id>@<spot id>') here with the reason, and rerun this script (see docs/forecast/LIVE-CAM-PANEL.md). A disabled camera renders nothing in the panel. */
export const DISABLED = {/* 'chamberlin-sharp-park-west@cs-sharp-park': 'removed at the owner\'s request, 2026-MM-DD', */};
const EXCLUDED = /surfline|swell ?magnet|magicseaweed|surf-forecast/i;
const out = [];
for (const w of WIRING) {
  const r = byId.get(w.row); if (!r) throw new Error('no camera row ' + w.row);
  const near = r.nearestSpots.find((n) => n.id === w.spotId); if (!near) throw new Error(`${w.row}: no distance to ${w.spotId}`);
  if (!['display-only', 'display+analysis'].includes(r.permissionClass) || (r.embedAllowed?.value ?? r.embedAllowed) !== 'yes' || r.uptime?.status !== 'live' || EXCLUDED.test(`${r.host} ${r.owner} ${r.hostTermsRef}`)) throw new Error(`${w.row} is not usable now`);
  const videoId = w.kind === 'youtube' ? /embed\/([\w-]{11})/.exec(r.embedUrl ?? r.streamType ?? "")?.[1] : undefined; if (w.kind === 'youtube' && !videoId) throw new Error(w.row + ': no video id');
  const channel = /UC[\w-]{22}/.exec(r.owner)?.[0];
  const approx = /^approx/i.test(r.coordsSource ?? ''), unknown = /exact mount unknown/i.test(r.coordsSource ?? '');
  out.push({id: `${w.row}@${w.spotId}`, enabled: !(`${w.row}@${w.spotId}` in DISABLED), ...(`${w.row}@${w.spotId}` in DISABLED ? {disabledReason: DISABLED[`${w.row}@${w.spotId}`]} : {}), rowId: w.row, spotId: w.spotId, kind: w.kind, ...(w.tab ? {tab: w.tab} : {}), ...(w.neighbour ? {neighbour: w.neighbour} : {}), title: r.name, owner: r.owner, credit: w.credit === 'USGS' ? r.attribution : w.credit, ...(r.attribution && w.kind === 'youtube' ? {creditPublished: r.attribution} : {}), pageUrl: r.pageUrl,
    ...(channel ? {channelUrl: `https://www.youtube.com/channel/${channel}`} : {}), ...(videoId ? {videoId} : {}), ...(w.stillUrl ? {stillUrl: w.stillUrl, metaId: w.metaId} : {}), km: near.km, ...(unknown ? {kmUnknown: true, position: 'on the hillside above the beach (exact position unknown)'} : approx ? {kmApprox: true} : {}), view: w.view, ...(w.ownerDescribed ? {ownerDescribed: true} : {}), refresh: r.refresh, licence: r.licence, checked: r.uptime.checked,
    ...(w.offline ? {offlineNote: w.offline} : {}), ...(w.operatorNote ? {operatorNote: w.operatorNote} : {})});
}

// ---- HDOnTap (hdontap-embeds, hdontap-auto, hdontap-licence). Basis: "HDOnTap: embedding needs a paid licence (HDOnTap email, 2026-11-10); link only". HDOnTap replied (support, lead #10098) that it offers no free third-party
// embedding and will not whitelist external domains: a monthly content licence plus a streaming fee, per camera. So EVERY HDOnTap camera is DISABLED here (the panel never draws one; each keeps its "HDOnTap cam ↗" link). The auto switch-on
// plumbing stays (services/embed-allowed.mjs, useEmbedAllowed): if a licence is ever bought for a camera, add its row id to HDONTAP_ENABLED and rerun, and the panel will draw it only when HDOnTap's own headers allow our origin.
// The raw HLS (m3u8) and any proxy are never used; only HDOnTap's own player page, in an iframe, after a tap.
export const HDONTAP_ENABLED = new Set([]);
export const HDONTAP_BASIS = 'HDOnTap: embedding needs a paid licence (HDOnTap email, 2026-11-10); link only';
const HDONTAP_REASON = 'HDOnTap requires a paid licence for embedding (email 2026-11-10)';
/** The player id of each stream, read from its public stream page on 2026-11-10 (the page's customer-embed id); streams with no id in their page have none. */
const HDONTAP_EMBED_IDS = {
 'hdontap-seascape-beach-resort': 'seascape_ttv-HDOT',
 'hdontap-carmel-tickle-pink': 'ticklepink_ttv-HDOT',
 'swellmagnet-hermosa-pier-north': 'swellmagnet_hermosa-fixed_north-HDOT',
 'swellmagnet-hermosa-pier-south': 'swellmagnet_hermosa-fixed_south-HDOT',
 'swellmagnet-hermosa-south-ptz': 'swellmagnet_hermosa_south-ptz-HDOT',
 'swellmagnet-malibu-point': 'swellmagnet_malibu-hikvision-HDOT',
 'swellmagnet-el-porto-rosecrans': 'el-porto_rosecrans_swellmagnet-HDOT',
 'swellmagnet-malibu-pier': 'swellmagnet_malibu-axis_fixed-HDOT',
 'swellmagnet-santa-monica-bay': 'swellmagnet_easton_north-bay-overview-HDOT',
 'swellmagnet-el-porto-overlook': 'easton-ep-multicam-HDOT',
 'swellmagnet-hermosa-north': 'swellmagnet_hermosa_north-ptz-HDOT',
 'swellmagnet-venice-roaming': 'venice_ptz_swellmagnet-HDOT',
 'swellmagnet-venice-wide': 'venice_swellmagnet-HDOT',
 'seashore-carlsbad-surf': 'carlsbad_seashoreonthesand-HDOT',
 'hdontap-la-jolla-shores-surf': 'hdontap-la_jolla_shores_surf-HDOT',
 'hotel-la-jolla-overlook': 'hotel-la-jolla_ptz-cam-HDOT',
 'laguna-cliffs-dana-point-harbor': 'danapoint-harbor_lgm-HDOT'
};
const hdRows = JSON.parse(fs.readFileSync(new URL('../docs/forecast/data/camera-sources.json', import.meta.url), 'utf8')).rows.filter((r) => r.hostTermsRef === 'hdontap');
const ownerShort = (o) => { const x = String(o).replace(/\s*\(.*$/, '').trim(); return /^unknown|not named|^\?/i.test(x) ? 'Owner not named' : x; };
const viaLabel = (o) => (ownerShort(o) === 'HDOnTap' ? 'HDOnTap (its own camera)' : `${ownerShort(o)} via HDOnTap`);
const viewNote = (r) => (r.viewsSurf === 'yes' ? 'The camera list says it shows the break or the beach' : 'The camera list says it shows only part of the break or the beach');
const hdCandidates = hdRows.filter((r) => (r.nearestSpots?.[0]?.km ?? 99) <= 5 && ['yes', 'partial'].includes(r.viewsSurf));
for (const r of hdCandidates) {
  const near = r.nearestSpots[0], embedId = HDONTAP_EMBED_IDS[r.id]; if (!embedId) continue;
  const id = `${r.id}@${near.id}`, on = HDONTAP_ENABLED.has(r.id) && !(id in DISABLED);
  out.push({id, enabled: on, ...(on ? {} : {disabledReason: DISABLED[id] ?? HDONTAP_REASON}), rowId: r.id, spotId: near.id, kind: 'hdontap', title: r.name, owner: r.owner, credit: ownerShort(r.owner) === 'Swell Magnet' ? 'Swell Magnet via HDOnTap' : `HDOnTap / ${ownerShort(r.owner)}`, pageUrl: r.pageUrl, embedUrl: `https://portal.hdontap.com/s/embed/?stream=${embedId}&ratio=16:9`, embedId,
    km: near.km, kmApprox: true, view: viewNote(r), refresh: r.refresh, licence: HDONTAP_BASIS, checked: r.uptime?.checked ?? ''});
}
if (process.argv.includes('--links')) {
  const links = hdCandidates.map((r) => ({id: r.id, spotId: r.nearestSpots[0].id, owner: ownerShort(r.owner), label: viaLabel(r.owner), name: r.name, url: r.pageUrl, km: r.nearestSpots[0].km, view: viewNote(r), partial: r.viewsSurf === 'partial', ...(['down', 'stale'].includes(r.uptime?.status) ? {status: r.uptime.status, statusChecked: r.uptime.checked} : {}), embedId: HDONTAP_EMBED_IDS[r.id] ?? null}));
  console.log(`// GENERATED by scripts/build-live-cams.mjs --links from docs/forecast/data/camera-sources.json (HDOnTap rows within about 5 km of an app spot whose view shows the break or the beach). Do not edit.
// LINK ONLY: each entry is shown as an <a> to the camera's own stream page; HDOnTap's player cannot be framed by our site (frame-ancestors), so nothing is embedded. Swell Magnet cams stay link-only for now.
export interface HdontapLink {id: string; spotId: string; owner: string; label: string; name: string; url: string; km: number; view: string; partial: boolean; status?: 'down' | 'stale'; statusChecked?: string; embedId: string | null}
export const HDONTAP_LINKS: readonly HdontapLink[] = ${JSON.stringify(links, null, 1).replace(/"([a-zA-Z]+)":/g, '$1:').replace(/'/g, "\\'").replace(/"/g, "'")};
export const hdontapLinksFor = (spotId: string): HdontapLink[] => HDONTAP_LINKS.filter((l) => l.spotId === spotId);`);
  process.exit(0);
}
const body = JSON.stringify(out, null, 1);
console.log(`// GENERATED by scripts/build-live-cams.mjs from docs/forecast/data/camera-sources.json (the usable-now Bay Area cameras, docs/forecast/BAYAREA-CAMERAS.md). Do not edit: change the wiring in the script and rerun.
// DISPLAY ONLY. A spot with no entry has no camera.
export interface LiveCam {
  id: string; rowId: string; spotId: string; kind: 'still' | 'youtube' | 'hdontap'; /** the kill switch: false = the panel renders nothing for this camera */ enabled: boolean; disabledReason?: string; embedUrl?: string; embedId?: string; /** short name of the view, for the selector */ tab?: string; title: string; owner: string; credit: string; /** the credit as the camera row publishes it */ creditPublished?: string; pageUrl: string; channelUrl?: string;
  videoId?: string; stillUrl?: string; /** the id the Worker's /api/cam-meta knows the still by */ metaId?: string; /** km from the camera to this spot (the row's own figure) */ km: number; /** the camera is at a NEIGHBORING beach, this many km in this direction ("south"): say so, never present it as this spot */ neighbour?: string; /** the camera's position is approximate: say "about" */ kmApprox?: boolean; /** the camera's position is not known: say where it is, not how far */ kmUnknown?: boolean; position?: string; view: string; /** the owner's own description, not checked by SWELLO */ ownerDescribed?: boolean; refresh: string; licence: string; checked: string; offlineNote?: string; operatorNote?: string;
}
export const LIVE_CAMS: readonly LiveCam[] = ${body.replace(/"([a-zA-Z]+)":/g, '$1:').replace(/'/g, "\\'").replace(/"/g, "'")};
export const liveCamsFor = (spotId: string): LiveCam[] => LIVE_CAMS.filter((c) => c.spotId === spotId && c.enabled);\n/** Cameras wired but switched off (kill switch), for the record and the tests; never rendered. */\nexport const disabledLiveCamsFor = (spotId: string): LiveCam[] => LIVE_CAMS.filter((c) => c.spotId === spotId && !c.enabled);`);
