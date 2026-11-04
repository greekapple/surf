// The MapLibre basemap style, branded to Swello's grey look (map-maplibre). Base = OpenFreeMap "positron" (free vector tiles, no key; attribution required),
// recoloured by layer category for the light and dark themes, each with the sea-state field on (mid-grey land under the ramp) or off (pale land).
// Order of layers (the same ids in light and dark): background (= LAND colour) → `water` (OCEAN polygons only, in the SEA colour) → `swello-field-slot` → [sea-state field layers, added beforeId this slot]
// → `water_inland` (lakes, rivers) → OSM landcover/landuse/roads/boundaries → labels. The field is drawn over the sea only: its shader reads the pixels already drawn (land vs sea colour) and
// repaints exactly the sea pixels, anti-aliased coast included, so the vector coastline, bays and every label, road and boundary above it stay crisp (no raster land mask, no second coastline).
import type {Theme} from './types.ts';

export const STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
export const FIELD_SLOT_ID = 'swello-field-slot'; // the field layers are added `beforeId` this id; identical in light and dark
export const ATTRIBUTION = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
export const ATTRIBUTION_TEXT = 'OpenFreeMap © OpenMapTiles Data from OpenStreetMap';

export interface Palette {land: string; sea: string; /** lakes and rivers: with the field on this must NOT read as sea to the shader (it repaints exactly the sea-coloured pixels), so it is lighter than the land; with the field off it is the sea colour */ lake: string; landAlt: string; landAlt2: string; road: string; roadCase: string; boundary: string; label: string; labelHalo: string; seaLabel: string; seaLabelHalo: string}
/** heat = the sea-state field is on: the land goes to a mid grey so the ramp reads true (the same idea as the Leaflet map's dark canvas under the field). */
export const palette = (theme: Theme, heat: boolean): Palette => theme === 'dark'
  ? heat ? {land: '#3b3b3f', sea: '#1d2733', lake: '#56606c', landAlt: '#414146', landAlt2: '#46464b', road: '#4a4a50', roadCase: '#3b3b3f', boundary: '#6c6c72', label: '#ececee', labelHalo: 'rgba(30,30,34,0.7)', seaLabel: '#b9bfc9', seaLabelHalo: 'rgba(30,30,34,0.6)'}
         : {land: '#26292d', sea: '#151b22', lake: '#3c4550', landAlt: '#2b2e33', landAlt2: '#30343a', road: '#383c42', roadCase: '#26292d', boundary: '#4d5259', label: '#cfd2d6', labelHalo: 'rgba(27,29,32,0.85)', seaLabel: '#7e8794', seaLabelHalo: 'rgba(27,29,32,0.6)'}
  : heat ? {land: '#7a7a7d', sea: '#55606b', lake: '#98a2ae', landAlt: '#838386', landAlt2: '#8b8b8e', road: '#909094', roadCase: '#7a7a7d', boundary: '#5c5c60', label: '#f4f4f5', labelHalo: 'rgba(40,40,44,0.65)', seaLabel: '#e4e8ee', seaLabelHalo: 'rgba(40,40,44,0.55)'}
         : {land: '#f2f3f0', sea: '#c2c8ca', lake: '#c2c8ca', landAlt: '#e9eae6', landAlt2: '#dde0dc', road: '#ffffff', roadCase: '#d5d5d5', boundary: '#b3b3b3', label: '#2b2b2b', labelHalo: 'rgba(255,255,255,0.9)', seaLabel: '#7b8189', seaLabelHalo: 'rgba(255,255,255,0.7)'};

type Paint = Record<string, unknown>;
/** The recolouring: layer → paint overrides, by id and kind. Pure (no map): used for the initial style and for theme or heat changes. */
export function paintFor(layer: {id: string; type: string}, p: Palette): Paint | null {
  const {id, type} = layer;
  if (id === 'background') return {'background-color': p.land}; // land; the ocean polygons are drawn on top in the sea colour
  if (type === 'fill') {
    if (id === 'water') return {'fill-color': p.sea, 'fill-antialias': true};
    if (id === 'water_inland') return {'fill-color': p.lake};
    if (id.startsWith('landcover_ice') || id.startsWith('landcover_glacier')) return {'fill-color': p.landAlt2};
    if (id === 'park' || id.startsWith('landcover') || id.startsWith('landuse')) return {'fill-color': p.landAlt};
    if (id === 'building') return {'fill-color': p.landAlt2};
    if (id.startsWith('aeroway') || id.startsWith('road_area')) return {'fill-color': p.road};
    return null;
  }
  if (type === 'line') {
    if (id.startsWith('boundary')) return {'line-color': p.boundary};
    if (id === 'waterway') return {'line-color': p.lake};
    if (id.includes('casing')) return {'line-color': p.roadCase};
    if (id.startsWith('highway') || id.startsWith('tunnel') || id.startsWith('railway') || id.startsWith('aeroway') || id.startsWith('road_')) return {'line-color': p.road};
    return null;
  }
  if (type === 'symbol') {
    if (id.startsWith('water_name') || id.startsWith('waterway')) return {'text-color': p.seaLabel, 'text-halo-color': p.seaLabelHalo};
    return {'text-color': p.label, 'text-halo-color': p.labelHalo};
  }
  return null;
}

let baseP: Promise<StyleSpec> | null = null;
export interface StyleSpec {version: number; sources: Record<string, unknown>; layers: Layer[]; glyphs?: string; sprite?: string; [k: string]: unknown}
interface Layer {id: string; type: string; source?: string; 'source-layer'?: string; filter?: unknown; paint?: Paint; layout?: Record<string, unknown>; [k: string]: unknown}
export const loadBaseStyle = (): Promise<StyleSpec> => (baseP ??= fetch(STYLE_URL).then(async (r) => { if (!r.ok) throw new Error('Map style unavailable.'); return (await r.json()) as StyleSpec; }).catch((e) => { baseP = null; throw e; }));

/** The branded style: positron's layers recoloured; `water` keeps only the ocean (the sea colour the field shader looks for), lakes and rivers move after the field slot; the slot is an empty layer the field layers are added before. */
export function brandedStyle(base: StyleSpec, theme: Theme, heat: boolean): StyleSpec {
  const p = palette(theme, heat), layers: Layer[] = [];
  for (const l of base.layers) {
    if (l.source === 'ne2_shaded') continue;
    const o = paintFor(l, p), nl: Layer = {...l, paint: {...(l.paint ?? {}), ...(o ?? {})}};
    // Sea and river names: upright and quieter than positron's italic blue (the Esri-era look), so the field stays the focus. Product, map-maplibre.
    if (l.type === 'symbol' && (l.id.startsWith('water_name') || l.id.startsWith('waterway'))) {
      nl.layout = {...(l.layout ?? {}), 'text-font': ['Noto Sans Regular'], 'text-letter-spacing': 0.08,
        ...(l.id === 'water_name_point_label' ? {'text-size': ['interpolate', ['linear'], ['zoom'], 0, 9, 8, 12]} : {'text-size': 12})};
      nl.paint = {...nl.paint, 'text-opacity': 0.8};
    }
    if (l.id === 'water') {
      nl.filter = ['all', l.filter, ['==', ['get', 'class'], 'ocean']];
      layers.push(nl, {id: FIELD_SLOT_ID, type: 'fill', source: FIELD_SLOT_ID, paint: {'fill-opacity': 0}}, {...l, id: 'water_inland', filter: ['all', l.filter, ['!=', ['get', 'class'], 'ocean']], paint: {...(l.paint ?? {}), 'fill-color': p.lake}});
      continue;
    }
    layers.push(nl);
  }
  const sources = {...base.sources}; delete (sources as Record<string, unknown>).ne2_shaded;
  return {...base, sources: {...sources, [FIELD_SLOT_ID]: {type: 'geojson', data: {type: 'FeatureCollection', features: []}}}, layers};
}
