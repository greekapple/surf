// Which map engine runs: `?engine=maplibre` (any build), else the VITE_MAP_ENGINE build flag, else 'leaflet' (the default until the user flips it).
export type EngineKind = 'leaflet' | 'maplibre';
export function engineKind(): EngineKind {
  try {
    const q = new URLSearchParams(location.search).get('engine'); if (q === 'maplibre' || q === 'leaflet') return q;
    const b = (import.meta as unknown as {env?: Record<string, string>}).env?.VITE_MAP_ENGINE; if (b === 'maplibre') return 'maplibre';
  } catch { /* no window or env: default */ }
  return 'leaflet';
}
