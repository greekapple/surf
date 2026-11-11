/** Coast zones, north to south, for browsing and comparing spots by place (Zone › County › Spot). */
export const ZONES: [string, string[]][] = [
  ['Alaska · Sitka', ['Sitka']],
  ['Washington Coast', ['Clallam', 'Jefferson', 'Island', 'Grays Harbor', 'Pacific']],
  ['Oregon North Coast', ['Clatsop', 'Tillamook', 'Lincoln']],
  ['Oregon South Coast', ['Douglas', 'Lane', 'Coos', 'Curry']],
  ['North Coast', ['Del Norte', 'Humboldt', 'Mendocino', 'Sonoma']],
  ['Bay Area', ['Marin', 'San Francisco', 'San Mateo']],
  ['Santa Cruz & Monterey', ['Santa Cruz', 'Monterey', 'Big Sur']],
  ['Central Coast', ['San Luis Obispo', 'Santa Barbara', 'Ventura']],
  ['Southern California', ['Los Angeles', 'Orange County', 'San Diego']],
  ['Hawaii · Oahu', ['Oahu North Shore', 'Oahu South Shore', 'Oahu East Side', 'Oahu West Side']],
  ['Hawaii · Maui', ['Maui']],
  ['Hawaii · Big Island', ['Big Island']],
  ['Hawaii · Kauai', ['Kauai']],
  ['Hawaii · Molokai, Lanai, Niihau', ['Molokai', 'Lanai', 'Niihau']],
  // US East (Atlantic coast), north to south; the zone is the state, the "county" column the area (single-area states repeat their name, like Maui).
  ['Maine', ['Maine']],
  ['New Hampshire', ['New Hampshire']],
  ['Massachusetts', ['Massachusetts']],
  ['Rhode Island', ['Rhode Island']],
  ['New York', ['New York']],
  ['New Jersey', ['Northern New Jersey', 'Southern New Jersey']],
  ['Delaware', ['Delaware']],
  ['Maryland', ['Maryland']],
  ['Virginia', ['Virginia']],
  ['North Carolina', ['Outer Banks', 'Southern North Carolina']],
  ['South Carolina', ['South Carolina']],
  ['Georgia', ['Georgia']],
  ['Florida', ['Northeast Florida', 'Space Coast', 'Treasure Coast', 'Southeast Florida']],
];
/** The state of a zone, for the breadcrumb (Zone › County › Spot sits under a state, not always California). */
const EAST_STATES = ['Maine', 'New Hampshire', 'Massachusetts', 'Rhode Island', 'New York', 'New Jersey', 'Delaware', 'Maryland', 'Virginia', 'North Carolina', 'South Carolina', 'Georgia', 'Florida'];
export const stateOfZone = (zone: string) => (zone.startsWith('Alaska') ? 'Alaska' : zone.startsWith('Washington') ? 'Washington' : zone.startsWith('Oregon') ? 'Oregon' : zone.startsWith('Hawaii') ? 'Hawaii' : EAST_STATES.includes(zone) ? zone : 'California');
export const zoneOf = (region: string) => ZONES.find(([, rs]) => rs.includes(region))?.[0] ?? 'Other';
