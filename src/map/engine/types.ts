// The map engine seam (map-maplibre, agreed with product and lead): ExploreView talks to THIS, never to Leaflet or MapLibre directly,
// so both engines run behind one code path (flag: ./flag.ts, default 'leaflet'). Engineering owns src/map/engine/*; product consumes it.
// Popups, spot pins, labels and the point picker are product's engine-neutral DOM: addMarker + project/unproject + the 'move' events.
import type {FieldController} from '../field.ts';

export type Theme = 'light' | 'dark';
export interface View {lat: number; lon: number; zoom: number}
export interface Insets {top: number; right: number; bottom: number; left: number}
/** `click` is a clean tap only: it never fires after a drag or pan gesture, nor for a click on a marker, or on any element inside the container marked `data-map-overlay` (product's popups, handles, panels). `lon` is wrapped to [-180, 180]. */
export type EngineEvent = 'movestart' | 'move' | 'moveend' | 'zoomend' | 'resize' | 'click';
export interface EngineClick {lat: number; lon: number; x: number; y: number}
export interface MarkerHandle {setLatLon(lat: number, lon: number): void; getLatLon(): {lat: number; lon: number}; readonly element: HTMLElement; remove(): void}
export interface MarkerOptions {
  lat: number; lon: number; element: HTMLElement;
  /** where the element's point sits: 'center' (default) or 'bottom' (the bottom-centre of the element is at the point) */
  anchor?: 'center' | 'bottom';
  /** the element's size in px, used to anchor it (center: size/2 is the point; bottom: bottom-centre). Default [0, 0]: the element's top-left is the point and its own CSS offsets it. */
  size?: [number, number];
  /** accessibility and interaction the engine wires the same way on both engines (tab stop, Enter/Space = click, tooltip/alt text, pointer hover) */
  title?: string; keyboard?: boolean; onClick?: () => void; onHover?: (on: boolean) => void; riseOnHover?: boolean;
  draggable?: boolean; zIndex?: number;
  onDrag?: (lat: number, lon: number) => void; onDragEnd?: (lat: number, lon: number) => void;
}
export interface MapEngine {
  readonly kind: 'leaflet' | 'maplibre';
  /** The element product puts its own overlays in (position: relative). Gets `.far` (zoom < 9) and `.world` (zoom < 5) classes and `data-heat` like the Leaflet container did. */
  readonly container: HTMLElement;
  // view
  getView(): View;
  setView(v: View, o?: {animate?: boolean}): void;
  flyTo(v: {lat: number; lon: number; zoom?: number}, o?: {durationMs?: number; reducedMotion?: boolean}): void;
  fitPoints(pts: {lat: number; lon: number}[], o: {padding: Insets; /** extra margin around the points as a share of their span (default 0.15, as Explore did) */ padRatio?: number; maxZoom?: number; animate?: boolean}): void;
  panBy(dx: number, dy: number, o?: {animate?: boolean}): void;
  zoomBy(delta: number): void;
  setMinZoom(z: number): void;
  getBounds(): {south: number; west: number; north: number; east: number};
  getSize(): {width: number; height: number};
  // screen <-> world, in container pixels
  project(lat: number, lon: number): {x: number; y: number};
  unproject(x: number, y: number): {lat: number; lon: number};
  on(e: EngineEvent, cb: (c?: EngineClick) => void): () => void;
  // markers: DOM elements
  addMarker(o: MarkerOptions): MarkerHandle;
  // the sea-state field (held-frame crossfade, onFrame 'ready', particles)
  field: FieldController;
  /** Re-applies the basemap, the ramp LUT and the particle colour for the theme (also done automatically when `data-theme` changes). */
  setTheme(t: Theme): void;
  /** The attribution text for the basemap in use (the page shows it; the engine draws no attribution control). */
  attribution(): string;
  dispose(): void;
}
export interface EngineOptions {view: View; minZoom: number; maxZoom: number; theme: Theme}
