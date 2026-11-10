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
];
const EXCLUDED = /surfline|swell ?magnet|magicseaweed|surf-forecast/i;
const out = [];
for (const w of WIRING) {
  const r = byId.get(w.row); if (!r) throw new Error('no camera row ' + w.row);
  const near = r.nearestSpots.find((n) => n.id === w.spotId); if (!near) throw new Error(`${w.row}: no distance to ${w.spotId}`);
  if (!['display-only', 'display+analysis'].includes(r.permissionClass) || (r.embedAllowed?.value ?? r.embedAllowed) !== 'yes' || r.uptime?.status !== 'live' || EXCLUDED.test(`${r.host} ${r.owner} ${r.hostTermsRef}`)) throw new Error(`${w.row} is not usable now`);
  const videoId = w.kind === 'youtube' ? /embed\/([\w-]{11})/.exec(r.embedUrl)?.[1] : undefined; if (w.kind === 'youtube' && !videoId) throw new Error(w.row + ': no video id');
  const channel = /UC[\w-]{22}/.exec(r.owner)?.[0];
  const approx = /^approx/i.test(r.coordsSource ?? ''), unknown = /exact mount unknown/i.test(r.coordsSource ?? '');
  out.push({id: `${w.row}@${w.spotId}`, rowId: w.row, spotId: w.spotId, kind: w.kind, ...(w.tab ? {tab: w.tab} : {}), title: r.name, owner: r.owner, credit: w.credit === 'USGS' ? r.attribution : w.credit, ...(r.attribution && w.kind === 'youtube' ? {creditPublished: r.attribution} : {}), pageUrl: r.pageUrl,
    ...(channel ? {channelUrl: `https://www.youtube.com/channel/${channel}`} : {}), ...(videoId ? {videoId} : {}), ...(w.stillUrl ? {stillUrl: w.stillUrl, metaId: w.metaId} : {}), km: near.km, ...(unknown ? {kmUnknown: true, position: 'on the hillside above the beach (exact position unknown)'} : approx ? {kmApprox: true} : {}), view: w.view, ...(w.ownerDescribed ? {ownerDescribed: true} : {}), refresh: r.refresh, licence: r.licence, checked: r.uptime.checked,
    ...(w.offline ? {offlineNote: w.offline} : {}), ...(w.operatorNote ? {operatorNote: w.operatorNote} : {})});
}
const body = JSON.stringify(out, null, 1);
console.log(`// GENERATED by scripts/build-live-cams.mjs from docs/forecast/data/camera-sources.json (the usable-now Bay Area cameras, docs/forecast/BAYAREA-CAMERAS.md). Do not edit: change the wiring in the script and rerun.
// DISPLAY ONLY. A spot with no entry has no camera.
export interface LiveCam {
  id: string; rowId: string; spotId: string; kind: 'still' | 'youtube'; /** short name of the view, for the selector */ tab?: string; title: string; owner: string; credit: string; /** the credit as the camera row publishes it */ creditPublished?: string; pageUrl: string; channelUrl?: string;
  videoId?: string; stillUrl?: string; /** the id the Worker's /api/cam-meta knows the still by */ metaId?: string; /** km from the camera to this spot (the row's own figure) */ km: number; /** the camera's position is approximate: say "about" */ kmApprox?: boolean; /** the camera's position is not known: say where it is, not how far */ kmUnknown?: boolean; position?: string; view: string; /** the owner's own description, not checked by SWELLO */ ownerDescribed?: boolean; refresh: string; licence: string; checked: string; offlineNote?: string; operatorNote?: string;
}
export const LIVE_CAMS: readonly LiveCam[] = ${body.replace(/"([a-zA-Z]+)":/g, '$1:').replace(/"/g, "'").replace(/\\'/g, "\\'")};
export const liveCamsFor = (spotId: string): LiveCam[] => LIVE_CAMS.filter((c) => c.spotId === spotId);`);
