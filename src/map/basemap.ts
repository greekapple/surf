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
  dark: {base: ESRI + 'Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', labels: ESRI + 'Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', attribution: CANVAS_ATTR, labelOpacity: 0.8, ground: '#262a2e'},
  satellite: {base: import.meta.env.VITE_MAP_TILE_URL || ESRI + 'World_Imagery/MapServer/tile/{z}/{y}/{x}', labels: ESRI + 'Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', attribution: import.meta.env.VITE_MAP_ATTRIBUTION || 'Imagery &copy; Esri, Maxar, Earthstar Geographics · Coastline: Natural Earth', labelOpacity: 0.7, ground: '#0a1c29'},
};
/** Tile level up to which these services reliably have tiles over the California coast and sea; above it the tiles are scaled. */
export const MAX_NATIVE_ZOOM = 13;

/** T-115: a tile layer that also loads a ring of tiles around the viewport (40% of its size on every side), so a zoom-out or a pan reveals LOADED tiles instead of the grey ground. Leaflet itself only loads what is visible. */
const PAD_TILES = 0.4;
const PaddedTileLayer = (L.TileLayer as unknown as {extend(o: object): new (url: string, opts: L.TileLayerOptions) => L.TileLayer}).extend({
  _getTiledPixelBounds(this: {_map: L.Map}, center: L.LatLng) {
    const b: L.Bounds = (L.TileLayer.prototype as unknown as {_getTiledPixelBounds(c: L.LatLng): L.Bounds})._getTiledPixelBounds.call(this, center), s = b.getSize().multiplyBy(PAD_TILES);
    return L.bounds(b.min!.subtract(s), b.max!.add(s));
  },
});
export const currentTheme = (): 'light' | 'dark' => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
/** Adds the basemap and follows theme changes. Returns a disposer. */
export function addBasemap(map: L.Map, onKind?: (k: BasemapKind) => void) {
  if (!map.getPane('labels')) { const p = map.createPane('labels'); p.style.zIndex = '450'; p.style.pointerEvents = 'none'; }
  let base: L.TileLayer | null = null, labels: L.TileLayer | null = null, world: L.TileLayer | null = null, shown: BasemapKind | null = null;
  const show = () => {
    // T-115: with the sea-state field on, the light theme gets the Esri DARK grey canvas underneath (Windy draws its ramp on a dark grey base; a light base washes the colours out). The field sets data-heat on the container.
    const heat = map.getContainer().dataset.heat === 'on', pref = readBasemapPref(), kind = pref === 'satellite' ? 'satellite' : heat ? 'dark' : basemapFor(pref, currentTheme());
    if (kind === shown) return;
    base?.remove(); labels?.remove(); world?.remove(); shown = kind;
    const def = BASEMAPS[kind], c = map.getContainer();
    for (const k of ['light', 'dark', 'satellite']) c.classList.toggle('mb-' + k, k === kind);
    // a world-wide coarse layer (tile level 3, 64 tiles) always under the detailed one: a multi-level zoom jump never shows the grey ground or a checkerboard while the new level's tiles load (map review, zoom)
    world = new L.TileLayer(def.base, {className: 'xbase xbase-world', minZoom: 0, maxZoom: 16, minNativeZoom: 3, maxNativeZoom: 3, keepBuffer: 2, updateWhenZooming: false, updateWhenIdle: true, zIndex: 0}).addTo(map);
    base = new PaddedTileLayer(def.base, {className: 'xbase', maxZoom: 16, maxNativeZoom: MAX_NATIVE_ZOOM, attribution: def.attribution, keepBuffer: 8, updateWhenZooming: false, updateWhenIdle: false}).addTo(map); // keep the old-zoom tiles on screen through a zoom, with a wide ring of them loaded
    labels = new PaddedTileLayer(def.labels, {pane: 'labels', maxZoom: 16, maxNativeZoom: MAX_NATIVE_ZOOM, opacity: def.labelOpacity, keepBuffer: 8, updateWhenZooming: false, updateWhenIdle: false}).addTo(map);
    onKind?.(kind);
  };
  show();
  const mo = new MutationObserver(show); mo.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  const mh = new MutationObserver(show); mh.observe(map.getContainer(), {attributes: true, attributeFilter: ['data-heat']});
  window.addEventListener('storage', show);
  return () => { mo.disconnect(); mh.disconnect(); window.removeEventListener('storage', show); base?.remove(); labels?.remove(); world?.remove(); };
}
