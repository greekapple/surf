// Which map engine runs: `?engine=leaflet` or `?engine=maplibre` (any build), else the VITE_MAP_ENGINE build flag, else 'maplibre' (the default since T-128, user-approved 2026-11-04). `?engine=leaflet` stays as a fallback for one release, then the Leaflet painter is deleted.
export type EngineKind = 'leaflet' | 'maplibre';
export function engineKind(): EngineKind {
  try {
    const q = new URLSearchParams(location.search).get('engine'); if (q === 'maplibre' || q === 'leaflet') return q;
    const b = (import.meta as unknown as {env?: Record<string, string>}).env?.VITE_MAP_ENGINE; if (b === 'leaflet') return 'leaflet';
  } catch { /* no window or env: default */ }
  return 'maplibre';
}
