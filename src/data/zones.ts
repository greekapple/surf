/** Coast zones, north to south, for browsing and comparing spots by place (Zone › County › Spot). */
export const ZONES: [string, string[]][] = [
  ['North Coast', ['Del Norte', 'Humboldt', 'Mendocino', 'Sonoma']],
  ['Bay Area', ['Marin', 'San Francisco', 'San Mateo']],
  ['Santa Cruz & Monterey', ['Santa Cruz', 'Monterey', 'Big Sur']],
  ['Central Coast', ['San Luis Obispo', 'Santa Barbara', 'Ventura']],
  ['Southern California', ['Los Angeles', 'Orange County', 'San Diego']],
];
export const zoneOf = (region: string) => ZONES.find(([, rs]) => rs.includes(region))?.[0] ?? 'Other';
