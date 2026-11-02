import L from 'leaflet';
import './basemap.css';
import {readBasemapPref, basemapFor, type BasemapKind} from './basemapPref';

/** Basemaps for the Explore map (T-042). Light and dark are quiet Esri Canvas styles (pale land, soft water, restrained labels);
 *  satellite stays an option. Every layer sets `maxNativeZoom`, so past the last real tile level the tiles are upscaled instead of going blank,
 *  and the container ground is pale in the light theme, so even a missing tile never shows a dark hole. */

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/';
const CANVAS_ATTR = 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap contributors';
export const BASEMAPS: Record<BasemapKind, {base: string; labels: string; attribution: string; labelOpacity: number; ground: string}> = {
  light: {base: ESRI + 'Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', labels: ESRI + 'Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', attribution: CANVAS_ATTR, labelOpacity: 0.85, ground: '#e4eaee'},
  dark: {base: ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', labels: ESRI + 'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', attribution: CANVAS_ATTR, labelOpacity: 0.8, ground: '#10212d'},
  satellite: {base: import.meta.env.VITE_MAP_TILE_URL || ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', labels: ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', attribution: import.meta.env.VITE_MAP_ATTRIBUTION || 'Imagery &copy; Esri, Maxar, Earthstar Geographics · Coastline: Natural Earth', labelOpacity: 0.7, ground: '#0a1c29'},
};
/** Tile level up to which these services reliably have tiles over the California coast and sea; above it the tiles are scaled. */
export const MAX_NATIVE_ZOOM = 13;

export const currentTheme = (): 'light' | 'dark' => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
/** Adds the basemap and follows theme changes. Returns a disposer. */
export function addBasemap(map: L.Map, onKind?: (k: BasemapKind) => void) {
  if (!map.getPane('labels')) { const p = map.createPane('labels'); p.style.zIndex = '450'; p.style.pointerEvents = 'none'; }
  let base: L.TileLayer | null = null, labels: L.TileLayer | null = null, shown: BasemapKind | null = null;
  const show = () => {
    const kind = basemapFor(readBasemapPref(), currentTheme());
    if (kind === shown) return;
    base?.remove(); labels?.remove(); shown = kind;
    const def = BASEMAPS[kind], c = map.getContainer();
    for (const k of ['light', 'dark', 'satellite']) c.classList.toggle('mb-' + k, k === kind);
    base = L.tileLayer(def.base, {className: 'xbase', maxZoom: 16, maxNativeZoom: MAX_NATIVE_ZOOM, attribution: def.attribution, keepBuffer: 4}).addTo(map);
    labels = L.tileLayer(def.labels, {pane: 'labels', maxZoom: 16, maxNativeZoom: MAX_NATIVE_ZOOM, opacity: def.labelOpacity}).addTo(map);
    onKind?.(kind);
  };
  show();
  const mo = new MutationObserver(show); mo.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  window.addEventListener('storage', show);
  return () => { mo.disconnect(); window.removeEventListener('storage', show); base?.remove(); labels?.remove(); };
}
