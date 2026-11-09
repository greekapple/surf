/** NWS public forecast zone per spot (T-064), resolved on 2026-11-02 from https://api.weather.gov/points/{lat},{lon} (`properties.forecastZone`) with docs/forecast/data/nws-zones.ts.
 *  Only land/coastal zones (CAZ...) are used: Beach Hazards Statements, High Surf and Rip Current alerts are issued for them. A spot whose point resolves to a marine zone (PZZ...) has no zone here and shows no alerts.
 *  Zones change rarely; re-run the script to refresh. Source: National Weather Service (public domain). */
import {hasUsData} from '../ocean/coverage.ts';
/** An NWS LAND forecast zone id (e.g. CAZ006, ORZ001, WAZ503), not a marine zone (PZZ535, ANZ, GMZ, LSZ...): beach hazard and high surf alerts are issued for the land zones. Any state, not only California. */
const MARINE_PREFIX = /^(AM|AN|GM|LC|LE|LH|LM|LO|LS|PH|PK|PM|PS|PZ|SL)Z\d+$/;
export const isLandZoneId = (z: string): boolean => /^[A-Z]{2}Z\d{3}$/.test(z) && !MARINE_PREFIX.test(z);
export const NWS_ZONES_RESOLVED = '2026-11-02';
export const NWS_ZONE: Record<string, string | null> = {
  'spot-2': "CAZ006",
  'spot-0': "CAZ505",
  'spot-3': "CAZ509",
  'spot-1': "CAZ505",
  'spot-4': "CAZ509",
  'spot-5': null, // marine zone PZZ545: no land beach-hazard zone resolved
  'spot-6': null, // marine zone PZZ535: no land beach-hazard zone resolved
  'spot-7': "CAZ529",
  'spot-8': null, // marine zone PZZ535: no land beach-hazard zone resolved
  'spot-9': "CAZ529",
  'cs-crescent-city': null, // marine zone PZZ450: no land beach-hazard zone resolved
  'cs-moonstone': "CAZ103",
  'cs-north-jetty': null, // marine zone PZZ450: no land beach-hazard zone resolved
  'cs-shelter-cove': "CAZ104",
  'cs-point-arena': null, // marine zone PZZ540: no land beach-hazard zone resolved
  'cs-salmon-creek': null, // marine zone PZZ540: no land beach-hazard zone resolved
  'cs-dillon-beach': null, // marine zone PZZ540: no land beach-hazard zone resolved
  'cs-waddell': null, // marine zone PZZ560: no land beach-hazard zone resolved
  'cs-manresa': null, // marine zone PZZ535: no land beach-hazard zone resolved
  'cs-moss-landing': null, // marine zone PZZ535: no land beach-hazard zone resolved
  'cs-asilomar': "CAZ530",
  'cs-carmel': "CAZ530",
  'cs-sand-dollar': null, // marine zone PZZ565: no land beach-hazard zone resolved
  'cs-morro-rock': null, // marine zone PZZ645: no land beach-hazard zone resolved
  'cs-pismo': "CAZ340",
  'cs-jalama': "CAZ349",
  'cs-rincon': "CAZ350",
  'cs-c-street': "CAZ354",
  'cs-county-line': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-zuma': "CAZ362",
  'cs-malibu': "CAZ362",
  'cs-topanga': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-el-porto': "CAZ366",
  'cs-hermosa': "CAZ366",
  'cs-huntington': "CAZ552", // the beach point resolves to marine zone PZZ655; CAZ552 (Orange County Coastal) is api.weather.gov/points about 0.8 km inland, checked 2026-11-09
  'cs-wedge': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-salt-creek': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-trestles': "CAZ043",
  'cs-oceanside': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-swamis': "CAZ043",
  'cs-cardiff': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-blacks': "CAZ043",
  'cs-windansea': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-ob-sd': "CAZ043",
  'cs-imperial': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-rodeo-beach': "CAZ505",
  'cs-kellys-cove': null, // marine zone PZZ545: no land beach-hazard zone resolved
  'cs-sloat': "CAZ006",
  'cs-sharp-park': "CAZ509",
  'cs-rockaway': "CAZ509",
  'cs-princeton-jetty': null, // marine zone PZZ545: no land beach-hazard zone resolved
  'cs-half-moon-bay': "CAZ509",
  'cs-pescadero': null, // marine zone PZZ545: no land beach-hazard zone resolved
  'cs-pigeon-point': "CAZ509",
  'cs-scott-creek': "CAZ509",
  'cs-capitola': null, // marine zone PZZ535: no land beach-hazard zone resolved
  'cs-natural-bridges': "CAZ529",
  'cs-marina': "CAZ530",
  'cs-andrew-molera': null, // marine zone PZZ565: no land beach-hazard zone resolved
  'cs-cayucos': null, // marine zone PZZ645: no land beach-hazard zone resolved
  'cs-shell-beach': null, // marine zone PZZ645: no land beach-hazard zone resolved
  'cs-hammonds': null, // marine zone PZZ650: no land beach-hazard zone resolved
  'cs-sands': null, // marine zone PZZ650: no land beach-hazard zone resolved
  'cs-campus-point': "CAZ350",
  'cs-leadbetter': "CAZ350",
  'cs-mondos': null, // marine zone PZZ650: no land beach-hazard zone resolved
  'cs-emma-wood': "CAZ354",
  'cs-silver-strand': null, // marine zone PZZ650: no land beach-hazard zone resolved
  'cs-leo-carrillo': "CAZ362",
  'cs-sunset-point': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-venice-breakwater': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-manhattan-beach': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-redondo-breakwater': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-bolsa-chica': "CAZ552",
  'cs-blackies': null, // marine zone PZZ655: no land beach-hazard zone resolved
  'cs-doheny': "CAZ552", // the beach point resolves to marine zone PZZ655; CAZ552 (Orange County Coastal) is api.weather.gov/points about 0.8 km inland, checked 2026-11-09
  'cs-san-clemente-pier': "CAZ552", // the beach point resolves to marine zone PZZ655; CAZ552 (Orange County Coastal) is api.weather.gov/points about 0.8 km inland, checked 2026-11-09
  'cs-t-street': "CAZ552", // the beach point resolves to marine zone PZZ655; CAZ552 (Orange County Coastal) is api.weather.gov/points about 0.8 km inland, checked 2026-11-09
  'cs-san-onofre': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-oceanside-harbor': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-tamarack': "CAZ043",
  'cs-ponto': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-beacons': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-seaside-reef': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-torrey-pines': "CAZ043",
  'cs-scripps': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-pacific-beach': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-sunset-cliffs': null, // marine zone PZZ740: no land beach-hazard zone resolved
  'cs-neah-bay': "WAZ330", // resolved 0.8 km inland: the beach point is in marine zone PZZ150
  'cs-la-push': "WAZ330", // resolved 0.8 km inland: the beach point is in marine zone PZZ153
  'cs-westport': "WAZ331", // resolved 0.8 km inland: the beach point is in marine zone PZZ110
  'cs-long-beach-wa': "WAZ201", // resolved 0.8 km inland: the beach point is in marine zone PZZ251
  'cs-seaside-or': "ORZ101", // resolved 0.8 km inland: the beach point is in marine zone PZZ251
  'cs-cannon-beach': "ORZ101", // resolved 0.8 km inland: the beach point is in marine zone PZZ251
  'cs-short-sands': "ORZ102", // resolved 0.8 km inland: the beach point is in marine zone PZZ252
  'cs-pacific-city': "ORZ102", // resolved 0.8 km inland: the beach point is in marine zone PZZ252
  'cs-otter-rock': "ORZ103", // resolved 0.8 km inland: the beach point is in marine zone PZZ253
  'cs-agate-beach': "ORZ103", // resolved 0.8 km inland: the beach point is in marine zone PZZ253
  'cs-bastendorff': "ORZ021", // resolved 0.8 km inland: the beach point is in marine zone PZZ350
  'cs-gold-beach': "ORZ022", // resolved 0.8 km inland: the beach point is in marine zone PZZ356
  'cs-brookings': "ORZ022", // resolved 0.8 km inland: the beach point is in marine zone PZZ356
  'cs-florence': "ORZ103", // resolved 2 km inland: the beach point is in marine zone PZZ350
  'w-hawaii-turtle-bay-west': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-velzyland': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-backyards': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-sunset': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-rocky-point': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-chambers': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-ehukai': "HIZ007",
  'w-hawaii-pipeline-backdoor': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-off-the-wall': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-rockpile': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-log-cabins': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-waimea-bay': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-marijuanas': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-chuns': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-jockos': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-hultins': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-himalayas': "HIZ007", // resolved 2 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-laniakea': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-puaena-point': "HIZ007",
  'w-hawaii-avalanche': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-haleiwa': "HIZ007",
  'w-hawaii-mokuleia': "HIZ007", // resolved 0.8 km inland: the beach point is in marine zone PHZ114
  'w-hawaii-ewa-beach-park': "HIZ034", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-coves': "HIZ034", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-ewa-beach': "HIZ034", // resolved 2 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-white-plains-beach': "HIZ034", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-sand-island': "HIZ033", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-barbers-point': "HIZ034", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-kewalos': "HIZ033", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-south-shore-ala-moana-park': "HIZ033", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-tennis-courts': "HIZ033", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-ala-moana-bowls': "HIZ033", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-kaisers': "HIZ033", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-waikiki-beach': "HIZ033", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-threes-and-fours': "HIZ033", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-queens': "HIZ033", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-secrets-toes': "HIZ032", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-queens-canoes': "HIZ033", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-populars': "HIZ033", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-publics': "HIZ033", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-tonggs': "HIZ033", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-black-point': "HIZ032", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-cliffs': "HIZ032", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-hawaii-diamond-head': "HIZ032", // resolved 0.8 km inland: the beach point is in marine zone PHZ115
  'w-us-long-beach': "MAZ007", // resolved 0.8 km inland: the beach point is in marine zone ANZ251
  'w-us-good-harbour-beach': "MAZ007", // resolved 0.8 km inland: the beach point is in marine zone ANZ251
  'w-us-mansion-beach': "RIZ008",
  'w-us-black-rock-point': "RIZ008", // resolved 0.8 km inland: the beach point is in marine zone ANZ237
  'w-us-davis-park': null, // marine zone ANZ353: no land beach-hazard zone resolved
  'w-us-point-o-woods': null, // marine zone ANZ353: no land beach-hazard zone resolved
  'w-us-ocean-bay-park': "NYZ080",
  'w-us-fire-island-new-york': "NYZ080",
  'w-us-atlantique-beach': "NYZ080",
  'w-us-fair-harbor': null, // marine zone ANZ353: no land beach-hazard zone resolved
  'w-us-jones-beach-state-park': "NYZ080", // resolved 0.8 km inland: the beach point is in marine zone ANZ355
  'w-us-robert-moses': null, // marine zone ANZ353: no land beach-hazard zone resolved
  'w-us-robert-moses-state-park': "NYZ080", // resolved 2 km inland: the beach point is in marine zone ANZ353
  'w-us-gilgo-beach': "NYZ080",
  'w-us-tobay-beach': "NYZ080",
  'w-us-jones-beach-state-park-2': "NYZ179", // resolved 0.8 km inland: the beach point is in marine zone ANZ355
  'w-us-west-end-jones-beach': null, // marine zone ANZ355: no land beach-hazard zone resolved
  'w-us-16th-ave-belmar': "NJZ014",
  'w-us-belmar-to-sea-girt': "NJZ014", // resolved 0.8 km inland: the beach point is in marine zone ANZ450
  'w-us-spring-lake': "NJZ014",
  'w-us-sea-girt': "NJZ014",
  'w-us-manasquan-inlet': "NJZ014", // resolved 0.8 km inland: the beach point is in marine zone ANZ450
  'w-us-manasquan': null, // marine zone ANZ450: no land beach-hazard zone resolved
  'w-us-jenkinsons-point-pleasant': "NJZ026", // resolved 0.8 km inland: the beach point is in marine zone ANZ451
  'w-us-jenkinsons': "NJZ026", // resolved 0.8 km inland: the beach point is in marine zone ANZ451
  'w-us-bay-head': "NJZ026", // resolved 0.8 km inland: the beach point is in marine zone ANZ451
  'w-us-mantoloking': "NJZ026", // resolved 0.8 km inland: the beach point is in marine zone ANZ451
  'w-us-lavallette-new-jersey': "NJZ026",
  'w-us-lavallette': "NJZ026", // resolved 0.8 km inland: the beach point is in marine zone ANZ451
  'w-us-ortley-beach': "NJZ026", // resolved 0.8 km inland: the beach point is in marine zone ANZ451
  'w-us-seaside-heights-casino-pier': "NJZ026", // resolved 0.8 km inland: the beach point is in marine zone ANZ451
  'w-us-meters': "NJZ026", // resolved 0.8 km inland: the beach point is in marine zone ANZ451
  'w-us-seaside-park': null, // marine zone ANZ451: no land beach-hazard zone resolved
  'w-us-island-beach-state-park': null, // marine zone ANZ451: no land beach-hazard zone resolved
  'w-us-island-beach-state-park-new-jersey': "NJZ026",
  'w-us-barnegat-light': "NJZ026", // resolved 0.8 km inland: the beach point is in marine zone ANZ451
  'w-us-harvey-cedars': null, // marine zone ANZ451: no land beach-hazard zone resolved
  'w-us-surf-city': "NJZ026",
  'w-us-ship-bottom': "NJZ026",
  'w-us-711': "NJZ026", // resolved 0.8 km inland: the beach point is in marine zone ANZ451
  'w-us-30th-street-ship-bottom': "NJZ026",
  'w-us-long-beach-township': "NJZ026",
  'w-us-beach-haven': "NJZ026", // resolved 0.8 km inland: the beach point is in marine zone ANZ451
  'w-us-holyoke': "NJZ026", // resolved 0.8 km inland: the beach point is in marine zone ANZ451
  'w-us-hollyoake': null, // marine zone ANZ451: no land beach-hazard zone resolved
  'w-us-virginia-beach': "VAZ098", // resolved 0.8 km inland: the beach point is in marine zone ANZ656
  'w-us-south-end-virginia': "VAZ098", // resolved 0.8 km inland: the beach point is in marine zone ANZ656
  'w-us-1st-street-jetty': "VAZ098", // resolved 0.8 km inland: the beach point is in marine zone ANZ656
  'w-us-croatan': "VAZ098", // resolved 0.8 km inland: the beach point is in marine zone ANZ656
  'w-us-croatan-to-pendleton': "VAZ098",
  'w-us-camp-pendleton-virginia': "VAZ098", // resolved 0.8 km inland: the beach point is in marine zone ANZ656
  'w-us-camp-pendleton': "VAZ098", // resolved 0.8 km inland: the beach point is in marine zone ANZ656
  'w-us-sandbridge-beach': "VAZ098", // resolved 2 km inland: the beach point is in marine zone ANZ656
  'w-us-little-island-fishing-pier': "VAZ098",
  'w-us-corolla-lighthouse': "NCZ102", // resolved 0.8 km inland: the beach point is in marine zone ANZ658
  'w-us-duck-pier': null, // marine zone AMZ150: no land beach-hazard zone resolved
  'w-us-southern-duck': "NCZ203",
  'w-us-kitty-hawk-pier': "NCZ203", // resolved 0.8 km inland: the beach point is in marine zone AMZ150
  'w-us-eckner-street': "NCZ203", // resolved 0.8 km inland: the beach point is in marine zone AMZ150
  'w-us-laundromats': "NCZ203", // resolved 0.8 km inland: the beach point is in marine zone AMZ150
  'w-us-avalon-pier': "NCZ203", // resolved 0.8 km inland: the beach point is in marine zone AMZ150
  'w-us-avalon-pier-north-carolina': "NCZ203", // resolved 0.8 km inland: the beach point is in marine zone AMZ150
  'w-us-third-street': "NCZ203",
  'w-us-1st-street': "NCZ203", // resolved 0.8 km inland: the beach point is in marine zone AMZ150
  'w-us-bath-house': "NCZ203", // resolved 0.8 km inland: the beach point is in marine zone AMZ150
  'w-us-martin-st': "NCZ203", // resolved 0.8 km inland: the beach point is in marine zone AMZ150
  'w-us-eighth-street': "NCZ203", // resolved 0.8 km inland: the beach point is in marine zone AMZ150
  'w-us-abalone-st': "NCZ203", // resolved 0.8 km inland: the beach point is in marine zone AMZ150
  'w-us-nags-head-pier': "NCZ203", // resolved 0.8 km inland: the beach point is in marine zone AMZ150
  'w-us-loggerhead-st': "NCZ203", // resolved 0.8 km inland: the beach point is in marine zone AMZ150
  'w-us-jennettes-pier': null, // marine zone AMZ150: no land beach-hazard zone resolved
  'w-us-outer-banks-pier': "NCZ203", // resolved 0.8 km inland: the beach point is in marine zone AMZ150
  'w-us-boilers-ranger-station': "NCZ205",
  'w-us-s-turns-north-carolina': null, // marine zone AMZ152: no land beach-hazard zone resolved
  'w-us-rodanthe-pier': "NCZ205", // resolved 0.8 km inland: the beach point is in marine zone AMZ152
  'w-us-k-o-a': "NCZ205", // resolved 0.8 km inland: the beach point is in marine zone AMZ152
  'w-us-waves-and-salvo': "NCZ205",
  'w-us-avon-pier': "NCZ205", // resolved 0.8 km inland: the beach point is in marine zone AMZ152
  'w-us-askins-creek': "NCZ205", // resolved 0.8 km inland: the beach point is in marine zone AMZ152
  'w-us-north-buxton': "NCZ205",
  'w-us-cape-hatteras-lighthouse': "NCZ205",
  'w-us-the-lighthouse': "NCZ205", // resolved 0.8 km inland: the beach point is in marine zone AMZ152
  'w-us-frisco': "NCZ205",
  'w-us-frisco-pier': null, // marine zone AMZ154: no land beach-hazard zone resolved
  'w-us-hatteras-ferry-docks': "NCZ205",
  'w-us-the-point-north-carolina': "NCZ195", // resolved 0.8 km inland: the beach point is in marine zone AMZ158
  'w-us-camp-lejeune': "NCZ199", // resolved 0.8 km inland: the beach point is in marine zone AMZ158
  'w-us-onslow-beach': "NCZ199", // resolved 0.8 km inland: the beach point is in marine zone AMZ158
  'w-us-seaview-pier': "NCZ199", // resolved 0.8 km inland: the beach point is in marine zone AMZ158
  'w-us-topsail-beach': "NCZ199",
  'w-us-topsail-island': "NCZ199", // resolved 2 km inland: the beach point is in marine zone AMZ158
  'w-us-surf-city-pier': "NCZ106",
  'w-us-jolly-roger-pier': "NCZ106", // resolved 0.8 km inland: the beach point is in marine zone AMZ250
  'w-us-figure-eight-and-shell-islands': "NCZ108", // resolved 0.8 km inland: the beach point is in marine zone AMZ250
  'w-us-north-end-wrightsville-beach': "NCZ108", // resolved 0.8 km inland: the beach point is in marine zone AMZ250
  'w-us-c-street-wrightsville-beach': "NCZ108",
  'w-us-columbia-street': "NCZ108", // resolved 0.8 km inland: the beach point is in marine zone AMZ250
  'w-us-crystal-pier': "NCZ108", // resolved 0.8 km inland: the beach point is in marine zone AMZ250
  'w-us-oceanic-pier': "NCZ108", // resolved 0.8 km inland: the beach point is in marine zone AMZ250
  'w-us-masonboro-inlet': "NCZ108", // resolved 2 km inland: the beach point is in marine zone AMZ250
  'w-us-carolina-beach-pier': "NCZ108",
  'w-us-pelican-watch': "NCZ108", // resolved 0.8 km inland: the beach point is in marine zone AMZ250
  'w-us-alabama-ave-kure-beach': "NCZ108", // resolved 0.8 km inland: the beach point is in marine zone AMZ250
  'w-us-fort-fisher': "NCZ108", // resolved 0.8 km inland: the beach point is in marine zone AMZ250
  'w-us-holden-beach': "NCZ110", // resolved 0.8 km inland: the beach point is in marine zone AMZ252
  'w-us-longbeach': "NCZ110", // resolved 0.8 km inland: the beach point is in marine zone AMZ252
  'w-us-oak-island': "NCZ110",
  'w-us-ocean-isle-beach-pier': "NCZ110", // resolved 0.8 km inland: the beach point is in marine zone AMZ252
  'w-us-cape-romain': "SCZ150", // resolved 2 km inland: the beach point is in marine zone AMZ360
  'w-us-bull-island': "SCZ150", // resolved 0.8 km inland: the beach point is in marine zone AMZ360
  'w-us-dewees-island': "SCZ150", // resolved 0.8 km inland: the beach point is in marine zone AMZ360
  'w-us-wild-dunes': "SCZ150", // resolved 0.8 km inland: the beach point is in marine zone AMZ360
  'w-us-isle-of-palms-pier': "SCZ150", // resolved 0.8 km inland: the beach point is in marine zone AMZ360
  'w-us-berts-bar': "SCZ150", // resolved 0.8 km inland: the beach point is in marine zone AMZ360
  'w-us-the-washout': "SCZ150", // resolved 0.8 km inland: the beach point is in marine zone AMZ360
  'w-us-10th-street': "SCZ150", // resolved 0.8 km inland: the beach point is in marine zone AMZ360
  'w-us-folly-beach-pier': "SCZ150", // resolved 0.8 km inland: the beach point is in marine zone AMZ360
  'w-us-kiawah-island-seabrook-island': "SCZ150", // resolved 0.8 km inland: the beach point is in marine zone AMZ360
  'w-us-edisto-beach': "SCZ149", // resolved 0.8 km inland: the beach point is in marine zone AMZ360
  'w-us-hunting-island': "SCZ148", // resolved 0.8 km inland: the beach point is in marine zone AMZ362
  'w-us-fripp-island': "SCZ148", // resolved 0.8 km inland: the beach point is in marine zone AMZ362
  'w-us-burkes-beach': "SCZ148", // resolved 0.8 km inland: the beach point is in marine zone AMZ362
  'w-us-hilton-head-island': "SCZ148",
  'w-us-north-jetty-georgia': "GAZ219", // resolved 0.8 km inland: the beach point is in marine zone AMZ362
  'w-us-sugar-shack': "GAZ219", // resolved 0.8 km inland: the beach point is in marine zone AMZ362
  'w-us-coastguard-st-simons': "GAZ154",
  'w-us-st-simons-island': "GAZ154",
  'w-us-5th-street-7th-street': "GAZ154",
  'w-us-jekyll-island': "GAZ154",
  'w-us-comfort-inn-jeckyll-island': "GAZ154", // resolved 0.8 km inland: the beach point is in marine zone AMZ450
  'w-us-cumberland-island': "GAZ166", // resolved 0.8 km inland: the beach point is in marine zone AMZ450
  'w-us-ft-clinch-state-park': "FLZ124", // resolved 0.8 km inland: the beach point is in marine zone AMZ450
  'w-us-hooks': "FLZ124", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-main-beach-florida': "FLZ124", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-fernandina-beach-pier': "FLZ124", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-amelia-pier': "FLZ124", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-peters-point': "FLZ124",
  'w-us-american-beach': "FLZ124",
  'w-us-talbot-island': "FLZ125",
  'w-us-little-talbot-island': "FLZ125",
  'w-us-north-jetty-florida': "FLZ125", // resolved 2 km inland: the beach point is in marine zone AMZ452
  'w-us-hannah-park-mayport-poles': "FLZ125", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-mayport-poles': "FLZ125",
  'w-us-18th-street': "FLZ125", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-atlantic-beach': "FLZ125", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-neptune-beach': "FLZ125", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-jacksonville-beach-pier': "FLZ125", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-jax-beach-pier': "FLZ125", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-8th-ave-south': "FLZ125", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-sawgrass': "FLZ233", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-ponte-vedra': "FLZ233", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-gate-station': "FLZ233", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-vilano-jetty': "FLZ333", // resolved 0.8 km inland: the beach point is in marine zone AMZ452
  'w-us-middles-florida': "FLZ333", // resolved 0.8 km inland: the beach point is in marine zone AMZ454
  'w-us-blowhole': "FLZ333", // resolved 0.8 km inland: the beach point is in marine zone AMZ454
  'w-us-f-as': "FLZ333",
  'w-us-st-augustine-pier': "FLZ333", // resolved 0.8 km inland: the beach point is in marine zone AMZ454
  'w-us-a-st': "FLZ333", // resolved 0.8 km inland: the beach point is in marine zone AMZ454
  'w-us-a-street': "FLZ333", // resolved 0.8 km inland: the beach point is in marine zone AMZ454
  'w-us-crescent-beach': "FLZ333", // resolved 2 km inland: the beach point is in marine zone AMZ454
  'w-us-matanzas-inlet': "FLZ333", // resolved 2 km inland: the beach point is in marine zone AMZ454
  'w-us-flagler-beach-pier': "FLZ138", // resolved 0.8 km inland: the beach point is in marine zone AMZ454
  'w-us-flagler-pier': "FLZ138", // resolved 0.8 km inland: the beach point is in marine zone AMZ454
  'w-us-bicentennial-park': "FLZ141", // resolved 0.8 km inland: the beach point is in marine zone AMZ550
  'w-us-ormond-beach-pier': "FLZ141", // resolved 0.8 km inland: the beach point is in marine zone AMZ550
  'w-us-main-street-pier': "FLZ141", // resolved 0.8 km inland: the beach point is in marine zone AMZ550
  'w-us-daytona-beach': "FLZ141", // resolved 0.8 km inland: the beach point is in marine zone AMZ550
  'w-us-sunglow-pier': null, // marine zone AMZ550: no land beach-hazard zone resolved
  'w-us-wilbur-by-the-sea': null, // marine zone AMZ550: no land beach-hazard zone resolved
  'w-us-ponce-inlet': null, // marine zone AMZ550: no land beach-hazard zone resolved
  'w-us-the-inlet-new-smyrna': "FLZ141", // resolved 0.8 km inland: the beach point is in marine zone AMZ550
  'w-us-new-smyrna-beach': "FLZ141", // resolved 0.8 km inland: the beach point is in marine zone AMZ550
  'w-us-flager-avenue': "FLZ141", // resolved 0.8 km inland: the beach point is in marine zone AMZ550
  'w-us-bethune': "FLZ141", // resolved 0.8 km inland: the beach point is in marine zone AMZ550
  'w-us-apollo-beach': "FLZ141", // resolved 0.8 km inland: the beach point is in marine zone AMZ550
  'w-us-playalinda-florida': "FLZ447", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-jetty-park': "FLZ447", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-cocoa-beach': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-shepard-park': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-lori-wilson-park': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-minuteman': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-16th-st-south': null, // marine zone AMZ552: no land beach-hazard zone resolved
  'w-us-picnic-tables': null, // marine zone AMZ552: no land beach-hazard zone resolved
  'w-us-2nd-light': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-patrick-air-force-base': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-perkins': "FLZ747",
  'w-us-hightower-beach': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-satellite-beach-r-cs': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-pelican-beach-park': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-bicentennial-beach-park': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-canova-beach': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-the-radisson': "FLZ747",
  'w-us-paradise-beach': "FLZ747",
  'w-us-the-boardwalk': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-melbourne-beach': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-spessard-holland': null, // marine zone AMZ552: no land beach-hazard zone resolved
  'w-us-coconut-point-park': null, // marine zone AMZ552: no land beach-hazard zone resolved
  'w-us-ponce-de-leon-park': null, // marine zone AMZ552: no land beach-hazard zone resolved
  'w-us-bonsteel-park': "FLZ747",
  'w-us-spanish-house': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-chernobyl': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-sebastian-inlet': "FLZ747", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-monster-hole': "FLZ154", // resolved 0.8 km inland: the beach point is in marine zone AMZ552
  'w-us-wabasso': "FLZ154", // resolved 0.8 km inland: the beach point is in marine zone AMZ555
  'w-us-vero-pier': "FLZ154", // resolved 0.8 km inland: the beach point is in marine zone AMZ555
  'w-us-vero-beach-pier': "FLZ154", // resolved 0.8 km inland: the beach point is in marine zone AMZ555
  'w-us-riomar-reef': "FLZ154", // resolved 0.8 km inland: the beach point is in marine zone AMZ555
  'w-us-p-v-martins': "FLZ159", // resolved 0.8 km inland: the beach point is in marine zone AMZ555
  'w-us-fort-pierce-north-jetty': null, // marine zone AMZ555: no land beach-hazard zone resolved
  'w-us-blue-heron-beach': "FLZ159",
  'w-us-blind-creek-park': "FLZ159",
  'w-us-walton-rocks-2': null, // marine zone AMZ555: no land beach-hazard zone resolved
  'w-us-walton-rocks': null, // marine zone AMZ555: no land beach-hazard zone resolved
  'w-us-jensen-beach-florida': "FLZ164", // resolved 2 km inland: the beach point is in marine zone AMZ555
  'w-us-stuart-public-beach': "FLZ164", // resolved 0.8 km inland: the beach point is in marine zone AMZ555
  'w-us-fletchers': "FLZ164", // resolved 0.8 km inland: the beach point is in marine zone AMZ555
  'w-us-stuart-rocks': null, // marine zone AMZ555: no land beach-hazard zone resolved
  'w-us-40th-street': "FLZ168", // resolved 0.8 km inland: the beach point is in marine zone AMZ650
  'w-us-japanese-rock': "FLZ168", // resolved 0.8 km inland: the beach point is in marine zone AMZ650
  'w-us-red-reef-park': "FLZ168", // resolved 0.8 km inland: the beach point is in marine zone AMZ650
  'w-us-south-beach-pavillion': "FLZ168", // resolved 0.8 km inland: the beach point is in marine zone AMZ650
  'w-us-boca-raton-inlet': "FLZ168", // resolved 2 km inland: the beach point is in marine zone AMZ650
  'w-us-deerfield-beach-pier': "FLZ172", // resolved 0.8 km inland: the beach point is in marine zone AMZ650
  'w-us-deerfield-park-pier': "FLZ172", // resolved 0.8 km inland: the beach point is in marine zone AMZ650
  'w-us-hillsboro-beach': "FLZ172", // resolved 0.8 km inland: the beach point is in marine zone AMZ651
  'w-us-hillsboro-inlet': "FLZ172", // resolved 0.8 km inland: the beach point is in marine zone AMZ651
  'w-us-pompano-pier': "FLZ172", // resolved 0.8 km inland: the beach point is in marine zone AMZ651
  'w-us-commercial-pier': "FLZ172", // resolved 0.8 km inland: the beach point is in marine zone AMZ651
  'w-us-ne-14th-ct': "FLZ172", // resolved 0.8 km inland: the beach point is in marine zone AMZ651
  'w-us-spoils': "FLZ172", // resolved 0.8 km inland: the beach point is in marine zone AMZ651
  'w-us-dania-pier': "FLZ172", // resolved 0.8 km inland: the beach point is in marine zone AMZ651
  'w-us-franklin-street': "FLZ172", // resolved 0.8 km inland: the beach point is in marine zone AMZ651
  'w-us-haulover': "FLZ173", // resolved 2 km inland: the beach point is in marine zone AMZ651
  'w-us-surfside-2': "FLZ173", // resolved 2 km inland: the beach point is in marine zone AMZ651
  'w-us-dunes-hotel': "FLZ173", // resolved 0.8 km inland: the beach point is in marine zone AMZ651
  'w-us-21st-street': "FLZ173", // resolved 0.8 km inland: the beach point is in marine zone AMZ651
  'w-us-5th-street-florida': "FLZ173", // resolved 0.8 km inland: the beach point is in marine zone AMZ651
  'w-us-south-beach-florida': "FLZ173", // resolved 0.8 km inland: the beach point is in marine zone AMZ651
};

/** Spots whose own point falls in a marine zone borrow the coastal zone of the nearest zoned spot, only when it is within 15 km (the same stretch of coast). Marked approximate in the UI text; farther spots have no zone. */
export const NWS_ZONE_APPROX: Record<string, {zone: string; viaSpot: string; km: number}> = {
  'spot-5': {zone: 'CAZ509', viaSpot: 'spot-4', km: 6}, // Mavericks -> Montara
  'spot-6': {zone: 'CAZ529', viaSpot: 'spot-7', km: 1}, // Steamer Lane -> Cowell’s
  'spot-8': {zone: 'CAZ529', viaSpot: 'spot-7', km: 5}, // Pleasure Point -> Cowell’s
  'cs-waddell': {zone: 'CAZ529', viaSpot: 'spot-9', km: 12}, // Waddell Creek -> Davenport
  'cs-manresa': {zone: 'CAZ529', viaSpot: 'spot-7', km: 15}, // Manresa -> Cowell’s
  'cs-county-line': {zone: 'CAZ362', viaSpot: 'cs-zuma', km: 14}, // County Line -> Zuma
  'cs-topanga': {zone: 'CAZ362', viaSpot: 'cs-malibu', km: 9}, // Topanga -> Malibu (Surfrider)
  'cs-cardiff': {zone: 'CAZ043', viaSpot: 'cs-swamis', km: 3}, // Cardiff Reef -> Swami’s
  'cs-windansea': {zone: 'CAZ043', viaSpot: 'cs-blacks', km: 7}, // Windansea -> Black’s Beach
  'cs-kellys-cove': {zone: 'CAZ006', viaSpot: 'spot-2', km: 2}, // Kelly's Cove -> Ocean Beach
  'cs-princeton-jetty': {zone: 'CAZ509', viaSpot: 'cs-half-moon-bay', km: 2.3}, // Princeton Jetty -> Half Moon Bay (Dunes Beach)
  'cs-pescadero': {zone: 'CAZ509', viaSpot: 'cs-pigeon-point', km: 8.8}, // Pescadero State Beach -> Pigeon Point
  'cs-capitola': {zone: 'CAZ529', viaSpot: 'spot-7', km: 6.4}, // Capitola -> Cowell’s
  'cs-shell-beach': {zone: 'CAZ340', viaSpot: 'cs-pismo', km: 5}, // Shell Beach -> Pismo Beach Pier
  'cs-hammonds': {zone: 'CAZ350', viaSpot: 'cs-leadbetter', km: 6.1}, // Hammond's -> Leadbetter
  'cs-sands': {zone: 'CAZ350', viaSpot: 'cs-campus-point', km: 3.5}, // Sands (Isla Vista) -> Campus Point
  'cs-mondos': {zone: 'CAZ354', viaSpot: 'cs-emma-wood', km: 6.4}, // Mondos -> Emma Wood
  'cs-sunset-point': {zone: 'CAZ362', viaSpot: 'cs-malibu', km: 11.5}, // Sunset Point -> Malibu (Surfrider)
  'cs-venice-breakwater': {zone: 'CAZ366', viaSpot: 'cs-el-porto', km: 10.7}, // Venice Breakwater -> El Porto
  'cs-manhattan-beach': {zone: 'CAZ366', viaSpot: 'cs-el-porto', km: 2}, // Manhattan Beach -> El Porto
  'cs-redondo-breakwater': {zone: 'CAZ366', viaSpot: 'cs-hermosa', km: 1.2}, // Redondo Breakwater -> Hermosa Pier
  'cs-san-onofre': {zone: 'CAZ043', viaSpot: 'cs-trestles', km: 2.4}, // San Onofre -> Trestles
  'cs-oceanside-harbor': {zone: 'CAZ043', viaSpot: 'cs-tamarack', km: 7.3}, // Oceanside Harbor -> Tamarack
  'cs-ponto': {zone: 'CAZ043', viaSpot: 'cs-swamis', km: 6.3}, // Ponto -> Swami’s
  'cs-beacons': {zone: 'CAZ043', viaSpot: 'cs-swamis', km: 3.4}, // Beacons -> Swami’s
  'cs-seaside-reef': {zone: 'CAZ043', viaSpot: 'cs-swamis', km: 3.8}, // Seaside Reef -> Swami’s
  'cs-scripps': {zone: 'CAZ043', viaSpot: 'cs-blacks', km: 2.5}, // Scripps -> Black’s Beach
  'cs-pacific-beach': {zone: 'CAZ043', viaSpot: 'cs-ob-sd', km: 5.4}, // Pacific Beach -> Ocean Beach (San Diego)
  'cs-sunset-cliffs': {zone: 'CAZ043', viaSpot: 'cs-ob-sd', km: 2.8}, // Sunset Cliffs -> Ocean Beach (San Diego)
  'w-us-davis-park': {zone: 'NYZ080', viaSpot: 'w-us-ocean-bay-park', km: 12.1}, // Davis Park -> Ocean Bay Park
  'w-us-point-o-woods': {zone: 'NYZ080', viaSpot: 'w-us-ocean-bay-park', km: 0.8}, // Point O’ Woods -> Ocean Bay Park
  'w-us-fair-harbor': {zone: 'NYZ080', viaSpot: 'w-us-atlantique-beach', km: 1.1}, // Fair Harbor -> Atlantique Beach
  'w-us-robert-moses': {zone: 'NYZ080', viaSpot: 'w-us-robert-moses-state-park', km: 2}, // Robert Moses -> Robert Moses State Park
  'w-us-west-end-jones-beach': {zone: 'NYZ179', viaSpot: 'w-us-jones-beach-state-park-2', km: 5.5}, // West End, Jones Beach -> Jones Beach State Park
  'w-us-manasquan': {zone: 'NJZ026', viaSpot: 'w-us-jenkinsons-point-pleasant', km: 0.3}, // Manasquan -> Jenkinsons (Point Pleasant)
  'w-us-seaside-park': {zone: 'NJZ026', viaSpot: 'w-us-meters', km: 2.3}, // Seaside Park -> Meters
  'w-us-island-beach-state-park': {zone: 'NJZ026', viaSpot: 'w-us-island-beach-state-park-new-jersey', km: 4.6}, // Island Beach State Park -> Island Beach State Park
  'w-us-harvey-cedars': {zone: 'NJZ026', viaSpot: 'w-us-surf-city', km: 4.6}, // Harvey Cedars -> Surf City
  'w-us-hollyoake': {zone: 'NJZ026', viaSpot: 'w-us-holyoke', km: 2.8}, // Hollyoake -> Holyoke
  'w-us-duck-pier': {zone: 'NCZ203', viaSpot: 'w-us-southern-duck', km: 2.8}, // Duck Pier -> Southern Duck
  'w-us-jennettes-pier': {zone: 'NCZ203', viaSpot: 'w-us-outer-banks-pier', km: 3}, // Jennette's Pier -> Outer Banks Pier
  'w-us-s-turns-north-carolina': {zone: 'NCZ205', viaSpot: 'w-us-rodanthe-pier', km: 2.6}, // S Turns -> Rodanthe Pier
  'w-us-frisco-pier': {zone: 'NCZ205', viaSpot: 'w-us-frisco', km: 0.2}, // Frisco Pier -> Frisco
  'w-us-sunglow-pier': {zone: 'FLZ141', viaSpot: 'w-us-daytona-beach', km: 9}, // Sunglow Pier -> Daytona Beach
  'w-us-wilbur-by-the-sea': {zone: 'FLZ141', viaSpot: 'w-us-the-inlet-new-smyrna', km: 8.4}, // Wilbur By The Sea -> The Inlet (New Smyrna)
  'w-us-ponce-inlet': {zone: 'FLZ141', viaSpot: 'w-us-the-inlet-new-smyrna', km: 1.4}, // Ponce Inlet -> The Inlet (New Smyrna)
  'w-us-16th-st-south': {zone: 'FLZ747', viaSpot: 'w-us-minuteman', km: 3.1}, // 16th St. South -> Minuteman
  'w-us-picnic-tables': {zone: 'FLZ747', viaSpot: 'w-us-2nd-light', km: 1.6}, // Picnic Tables -> 2nd Light
  'w-us-spessard-holland': {zone: 'FLZ747', viaSpot: 'w-us-melbourne-beach', km: 2.5}, // Spessard Holland -> Melbourne Beach
  'w-us-coconut-point-park': {zone: 'FLZ747', viaSpot: 'w-us-melbourne-beach', km: 5.5}, // Coconut Point Park -> Melbourne Beach
  'w-us-ponce-de-leon-park': {zone: 'FLZ747', viaSpot: 'w-us-melbourne-beach', km: 7}, // Ponce De Leon Park -> Melbourne Beach
  'w-us-fort-pierce-north-jetty': {zone: 'FLZ159', viaSpot: 'w-us-blue-heron-beach', km: 4.8}, // Fort Pierce North Jetty -> Blue Heron Beach
  'w-us-walton-rocks-2': {zone: 'FLZ159', viaSpot: 'w-us-blind-creek-park', km: 3.2}, // Walton Rocks -> Blind Creek Park
  'w-us-walton-rocks': {zone: 'FLZ159', viaSpot: 'w-us-blind-creek-park', km: 3.3}, // Walton Rocks -> Blind Creek Park
  'w-us-stuart-rocks': {zone: 'FLZ164', viaSpot: 'w-us-fletchers', km: 1.8}, // Stuart Rocks -> Fletcher's
};
export interface ZoneInfo {zone: string; approx: boolean; viaSpot?: string}
export function zoneFor(spotId: string): ZoneInfo | null {
  if (!hasUsData(spotId)) return null;   // NWS covers the US only: a spot elsewhere has no alerts zone, never a neighbour country's
  const z = NWS_ZONE[spotId]; if (z) return {zone: z, approx: false};
  const a = NWS_ZONE_APPROX[spotId]; return a ? {zone: a.zone, approx: true, viaSpot: a.viaSpot} : null;
}
