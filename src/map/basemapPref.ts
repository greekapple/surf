/** Basemap choice, kept free of Leaflet so Settings can read and write it without loading the map. */
export const BASEMAP_KEY = 'swello-basemap';
export type BasemapPref = 'auto' | 'satellite';
export function readBasemapPref(): BasemapPref { try { return localStorage.getItem(BASEMAP_KEY) === 'satellite' ? 'satellite' : 'auto'; } catch { return 'auto'; } }
export function saveBasemapPref(p: BasemapPref) { try { localStorage.setItem(BASEMAP_KEY, p); } catch { /* per-session only */ } }
export type BasemapKind = 'light' | 'dark' | 'satellite';
/** Which basemap to show: the satellite choice, else the one matching the theme. */
export const basemapFor = (pref: BasemapPref, theme: 'light' | 'dark'): BasemapKind => (pref === 'satellite' ? 'satellite' : theme);
