/** Coast zones, north to south, for browsing and comparing spots by place (Zone › County › Spot). */
export const ZONES: [string, string[]][] = [
  ['Washington Coast', ['Clallam', 'Grays Harbor', 'Pacific']],
  ['Oregon North Coast', ['Clatsop', 'Tillamook', 'Lincoln']],
  ['Oregon South Coast', ['Lane', 'Coos', 'Curry']],
  ['North Coast', ['Del Norte', 'Humboldt', 'Mendocino', 'Sonoma']],
  ['Bay Area', ['Marin', 'San Francisco', 'San Mateo']],
  ['Santa Cruz & Monterey', ['Santa Cruz', 'Monterey', 'Big Sur']],
  ['Central Coast', ['San Luis Obispo', 'Santa Barbara', 'Ventura']],
  ['Southern California', ['Los Angeles', 'Orange County', 'San Diego']],
];
/** The state of a zone, for the breadcrumb (Zone › County › Spot sits under a state, not always California). */
export const stateOfZone = (zone: string) => (zone.startsWith('Washington') ? 'Washington' : zone.startsWith('Oregon') ? 'Oregon' : 'California');
export const zoneOf = (region: string) => ZONES.find(([, rs]) => rs.includes(region))?.[0] ?? 'Other';
