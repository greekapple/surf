#!/usr/bin/env node
// Water quality (spec item 4): the RULE-CHECKED (distance and name; 19 by hand) spot -> station mapping, from docs/forecast/data/water-quality-sources.json (the research's nearest station of each source for each app spot).
//   node scripts/build-water-quality.mjs > src/data/waterQualitySourced.ts        (a test checks the committed file equals this output)
// Nearest-by-distance is NOT enough: a station must sample the same OPEN beach as the spot, not a harbour, bay, lagoon, creek mouth, inlet or outfall. Every pick within 3 km (411 of them) gets a decision and a reason
// in STATION_REVIEW: reviewed (used) or rejected (never used). Rules, in order, then the hand-made overrides (OVERRIDES). If unsure, reject.
//   R1 distance: more than 1.0 km along the coast is not the same stretch of beach (Georgia's polygons: 0 = inside).
//   R2 water: the station's own name says harbour, marina, lagoon, creek, stream, river, gulch, pond, embayment, outfall, outflow, drain, canal, slough, wharf, ferry, landing, ramp (Hawaii: boat ramps), inlet, jetty (Florida), sewer, point zero,
//      offshore, facility, golf course, or (Hawaii only) pier (harbour piers): not the surf-zone water of an open beach.
//   R3 identity: the dataset gives the station no name (only its code): it cannot be confirmed to be this beach.
//   R4 name (Hawaii, 0.6-1.0 km): the station must be named for the spot's own place (a distinctive word of the spot's name is in the station's name), else it is another beach.
import fs from 'node:fs';
const J = JSON.parse(fs.readFileSync(new URL('../docs/forecast/data/water-quality-sources.json', import.meta.url), 'utf8'));
const WORDS = /\b(harbou?r|marina|lagoon|creek|stream|river|gulch|pond|embayment|outfall|outflow|drain pipe|storm drain|canal|slough|wharf|ferry|landing|inlet|sewers?|point zero|offshore|facility|golf course)\b/i;
const HI_ONLY = /\b(pier|ramp|boat)\b/i, FL_ONLY = /\b(jetty)\b/i;
const GENERIC = new Set(['beach', 'park', 'point', 'bay', 'island', 'state', 'street', 'shoreline', 'access', 'the', 'and']);
const OVERRIDES = {   // `${spotId}|${source}` -> [decision, reason]: the judgement calls, each said in words
  'spot-5|ca-beachwatch-fib': ['rejected', 'Mavericks: the nearest station, Pillar Point #8, is INSIDE Pillar Point Harbor (the harbour water, not the open surf zone)'],
  'cs-princeton-jetty|ca-beachwatch-fib': ['rejected', 'Surfers Beach is in the lee of the Pillar Point Harbor breakwater, not the open beach the Princeton Jetty spot is on; unsure, so rejected'],
  'cs-morro-rock|ca-beachwatch-fib': ['rejected', 'the station is on San Leandro Bay inside Morro Bay (Garretson Point), not the open ocean at Morro Rock'],
  'cs-blackies|ca-beachwatch-fib': ['rejected', 'the station is in Newport Bay (the bay water), not the open ocean at Blackie\'s'],
  'spot-9|ca-beachwatch-fib': ['rejected', 'the station is San Vicente Beach, a different beach from Davenport Landing; unsure, so rejected'],
  'cs-leo-carrillo|ca-beachwatch-fib': ['rejected', 'the county names the station "Malibu Beach"; it is not confirmed to be the Leo Carrillo beach; unsure, so rejected'],
  'cs-zuma|ca-beachwatch-fib': ['rejected', 'the county names the station "Malibu Beach"; it is not confirmed to be Zuma Beach; unsure, so rejected'],
  'cs-redondo-breakwater|ca-beachwatch-fib': ['rejected', 'the station\'s code (DHS115B) and its name (DHS113B Hermosa Beach) disagree and it is at Hermosa, not the Redondo breakwater; unsure, so rejected'],
  'w-us-masonboro-inlet|nc-deq-rwq': ['rejected', 'the station is the north end of Masonboro Island, the estuary side of the inlet, not the open beach'],
  'w-us-hatteras-ferry-docks|nc-deq-rwq': ['rejected', 'the spot is the Hatteras ferry docks (inlet and sound water); the station is an ocean beach ramp 0.13 km away; unsure, so rejected'],
  'w-us-onslow-beach|nc-deq-rwq': ['rejected', '"Hurst Beach Swimming Area" is not confirmed to be on the ocean side of Onslow Beach (it may be on New River water); unsure, so rejected'],
  'w-us-manasquan-inlet|nj-dep-ccmp': ['rejected', 'the spot is at the inlet; the station (East Main) is on the open beach 0.42 km away: not the same water'],
  'w-us-north-jetty-florida|fl-doh-healthy-beaches': ['rejected', 'Huguenot Park is at the St. Johns River mouth; not confirmed to be the open beach of the North Jetty spot; unsure, so rejected'],
  'w-us-ponce-inlet|fl-doh-healthy-beaches': ['rejected', 'Lighthouse Point Park sits at Ponce Inlet; not confirmed to be open-beach water; unsure, so rejected'],
};
OVERRIDES['cs-moss-landing|ca-beachwatch-fib'] = ['reviewed', '0.45 km, Moss Landing State Beach: "Landing" is part of the beach\'s name; it is the open ocean beach north of the harbour entrance, the same beach as the spot'];
OVERRIDES['cs-marina|ca-beachwatch-fib'] = ['reviewed', '0.11 km, Marina State Beach: "Marina" is the town\'s name; it is the open ocean beach, the same beach as the spot'];
OVERRIDES['w-us-onslow-beach|nc-deq-rwq'] = ['reviewed', 'NC DEQ lists station C11 (Hurst Beach Swimming Area) with LOCATION = OCEAN, 0.1 km from the spot: the ocean side of Onslow Beach'];
OVERRIDES['w-us-seaview-pier|nc-deq-rwq'] = ['reviewed', 'NC DEQ lists station S30F (Sea Dunes, North Topsail Beach) with LOCATION = OCEAN, 0.84 km from the spot; "New River Inlet Rd" is a road name, not the water'];
OVERRIDES['w-us-the-point-north-carolina|nc-deq-rwq'] = ['rejected', 'the spot is the point at the inlet; the station (Inlet Road in Emerald Isle, 0.63 km) is not confirmed to be the same water; unsure, so rejected'];
const norm = (s) => String(s ?? '').toLowerCase();
const distinctive = (n) => norm(n).replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length >= 3 && !GENERIC.has(w));
const out = [];
for (const s of J.spots) for (const n of s.nearest) {
  if (n.km > 3) continue; const st = n.station, source = n.source, name = String(st.name ?? '').replace(/\\/g, '').trim(), key = `${s.id}|${source}`;
  const pick = {spotId: s.id, spot: s.name.replace(/\\/g, ''), source, stationId: String(st.id), station: name, km: n.km, lat: st.lat, lon: st.lon, ...(st.link ? {link: st.link} : {}), ...(st.latestSample ? {latestSample: st.latestSample} : {})};
  let decision, reason;
  const nm = (source === 'fl-doh-healthy-beaches' ? name.replace(/\s*\([^)]*\)\s*$/, '') : name)   // Florida appends the county in brackets: not part of the station's own name
    .replace(/,\s*[A-Z][\w. ]*\b(?:Borough|Township|City|Town|Village)\b/g, '')   // NJ: "4th Ave, Toms River Township": the municipality is not the water
    .replace(/\b(?:[A-Z][\w.']*\s+){0,3}(?:Rd|Road|Dr|Drive|St|Street|Ave|Avenue|Blvd|Hwy|Lane)\b\.?/g, '');   // a road's name ("New River Inlet Rd") is not the water
  if (OVERRIDES[key]) [decision, reason] = OVERRIDES[key];
  else if (n.km > 1.0) [decision, reason] = ['rejected', `${n.km} km from the spot: more than 1 km along the coast is not the same stretch of beach`];
  else if (!name || name === String(st.id) || /^[A-Za-z0-9_.-]+$/.test(name) && source === 'ca-beachwatch-fib' && name.length < 8 && !/ /.test(name)) [decision, reason] = ['rejected', 'the dataset gives this station no name (only its code), so it cannot be confirmed to be this beach'];
  else if (WORDS.test(nm) || (source === 'hi-doh-cwb' && HI_ONLY.test(nm)) || (source === 'fl-doh-healthy-beaches' && FL_ONLY.test(nm))) [decision, reason] = ['rejected', `the station's name ("${name}") says ${(WORDS.exec(nm) ?? HI_ONLY.exec(nm) ?? FL_ONLY.exec(nm))[0].toLowerCase()}: not the water of an open beach`];
  else if (source === 'hi-doh-cwb' && n.km > 0.6 && !distinctive(s.name).some((w) => norm(name).includes(w))) [decision, reason] = ['rejected', `${n.km} km away and named for another place ("${name}"), not for ${s.name}`];
  else [decision, reason] = ['reviewed', `${n.km} km, ${name}: the station's own name places it on the same open-coast beach; no harbour, inlet, stream, outfall or bay-inside word`];
  out.push({...pick, decision, reason});
}
const reviewed = out.filter((r) => r.decision === 'reviewed');
const SOURCES = {
  'hi-doh-cwb': {agency: 'Hawaiʻi Department of Health, Clean Water Branch', url: 'https://eha-cloud.doh.hawaii.gov/cwb/', licence: 'The agency states no licence on the app (health.hawaii.gov: "All rights reserved"); its PacIOOS data mirror says the data may be used and redistributed for free but is not for legal use. SWELLO shows facts only (advisory type, status, date) with a link back. Display terms to be confirmed with the Clean Water Branch before any public launch.'},
  'nc-deq-rwq': {agency: 'NC DEQ Division of Marine Fisheries, Recreational Water Quality Program', url: 'https://www.deq.nc.gov/about/divisions/marine-fisheries/shellfish-sanitation-and-recreational-water-quality/recreational-water-quality', licence: 'No terms on the ArcGIS item; a state agency public view. Facts with a link and attribution; to be confirmed with DEQ before any public launch.'},
  'nj-dep-ccmp': {agency: 'NJDEP Cooperative Coastal Monitoring Program', url: 'https://njbeaches.org/', licence: 'No licence text read (the disclaimer page is a client-side redirect). Treated as state public information: facts with a link; to be confirmed with NJDEP before any public launch.'},
  'sc-des-beach': {agency: 'SC Department of Environmental Services, Beach Monitoring', url: 'https://des.sc.gov/programs/bureau-water/aquatic-science/beach-monitoring', licence: 'No licence text found on the service or des.sc.gov. Facts with a link; to be confirmed with SC DES before any public launch.'},
  'ga-dnr-healthy-beaches': {agency: 'Georgia DNR Coastal Resources Division and Coastal Health District, Healthy Beaches', url: 'https://coastalgadnr.org/HealthyBeaches', licence: 'No terms on the ArcGIS item. Facts with a link; to be confirmed with Georgia DNR before any public launch. The DNR says the program never closes beaches; it issues advisories only.'},
  'ca-beachwatch-fib': {agency: 'California State Water Resources Control Board, BeachWatch (data.ca.gov)', url: 'https://data.ca.gov/dataset/surface-water-fecal-indicator-bacteria-results', licence: 'Water Boards conditions of use: information on the site, unless otherwise indicated, is in the public domain (waterboards.ca.gov/conditions_of_use.html). The sibling BeachWatch data is ODC-BY: attributed either way, with the county agency named. These are bacteria RESULTS, not current postings or closures.'},
  'wa-ecy-beach': {agency: 'Washington State Department of Ecology, BEACH Program', url: 'https://ecology.wa.gov/beach', licence: 'A public state map service; terms not read beyond the service. Facts with a link and attribution.'},
  'fl-doh-healthy-beaches': {agency: 'Florida Department of Health, Healthy Beaches Program', url: 'https://www.floridahealth.gov/environmental-health/beach-water-quality/', licence: 'Link only: the sampling-point item says it is for reference only and "not to be construed as a legal document"; no result data is fetched or shown.'},
};
const body = (x) => JSON.stringify(x, null, 1).replace(/"([a-zA-Z]+)":/g, '$1:').replace(/'/g, "\\'").replace(/"/g, "'");
console.log(`// GENERATED by scripts/build-water-quality.mjs from docs/forecast/data/water-quality-sources.json. Do not edit: change the rules or OVERRIDES in the script and rerun.
// STATION_REVIEW: every research pick within 3 km of a spot (408), each REVIEWED (used) or REJECTED (never used) with its reason. A spot with no reviewed station shows no water-quality line.
export type WqSource = 'hi-doh-cwb' | 'nc-deq-rwq' | 'nj-dep-ccmp' | 'sc-des-beach' | 'ga-dnr-healthy-beaches' | 'ca-beachwatch-fib' | 'wa-ecy-beach' | 'fl-doh-healthy-beaches';
export interface StationReview {spotId: string; spot: string; source: WqSource; stationId: string; station: string; km: number; lat?: number; lon?: number; link?: string; latestSample?: string; decision: 'reviewed' | 'rejected'; reason: string}
export const STATION_REVIEW: readonly StationReview[] = ${body(out)};
export interface WqAgency {agency: string; url: string; licence: string}
export const WQ_AGENCIES: Readonly<Record<WqSource, WqAgency>> = ${body(SOURCES)};
/** The reviewed station of a spot (one per source; a spot can have more than one source in reach, the nearest reviewed one wins). */
export const wqStationFor = (spotId: string): StationReview | null => STATION_REVIEW.filter((r) => r.spotId === spotId && r.decision === 'reviewed').sort((a, b) => a.km - b.km)[0] ?? null;`);
console.error(`reviewed ${reviewed.length}, rejected ${out.length - reviewed.length}, of ${out.length}`);
