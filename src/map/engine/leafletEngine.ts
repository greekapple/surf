// The Leaflet adapter behind the MapEngine seam: today's Explore map (Esri raster basemap, canvas-2D field and particles), with NO behaviour change.
import L from 'leaflet';
import {addBasemap, BASEMAPS} from '../basemap.ts';
import {createFieldController} from '../field.ts';
import {mapConfig} from '../mapConfig.ts';
import {minZoomFor} from '../mapConfig.ts';
import type {EngineClick, EngineEvent, EngineOptions, MapEngine, MarkerHandle, MarkerOptions} from './types.ts';

const wrapLon = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;

export function createLeafletEngine(el: HTMLElement, o: EngineOptions): MapEngine {
  const m = L.map(el, {zoomControl: false, attributionControl: false, minZoom: o.minZoom, maxZoom: o.maxZoom, zoomSnap: mapConfig.view.zoomSnap, worldCopyJump: true, maxBounds: [[-mapConfig.view.maxLat, -540], [mapConfig.view.maxLat, 540]], maxBoundsViscosity: mapConfig.view.maxBoundsViscosity}).setView([o.view.lat, o.view.lon], o.view.zoom, {animate: false});
  const lod = () => { m.getContainer().classList.toggle('far', m.getZoom() < mapConfig.zoom.far); m.getContainer().classList.toggle('world', m.getZoom() < mapConfig.zoom.world); };
  m.on('zoomend', lod); lod();
  m.on('resize', () => m.setMinZoom(minZoomFor(m.getSize().x))); // the world always fills the width
  L.control.attribution({position: 'bottomleft', prefix: false}).addTo(m);
  const disposeBase = addBasemap(m);
  const field = createFieldController(m);
  const offs: (() => void)[] = [];
  if (import.meta.env.DEV) { (window as unknown as {__xmap?: L.Map}).__xmap = m; (window as unknown as {__swelloMap?: L.Map}).__swelloMap = m; } // QA hooks (dev only); map-verify drives the native map object
  const isOverlay = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-map-overlay],.leaflet-marker-icon,.leaflet-popup,.leaflet-control');
  const ev = {
    movestart: 'movestart', move: 'move', moveend: 'moveend', zoomend: 'zoomend', resize: 'resize', click: 'click',
  } as const satisfies Record<EngineEvent, string>;
  const api: MapEngine = {
    kind: 'leaflet', container: el, field,
    getView: () => { const c = m.getCenter(); return {lat: c.lat, lon: c.lng, zoom: m.getZoom()}; },
    setView: (v, opt) => { m.setView([v.lat, v.lon], v.zoom, {animate: opt?.animate ?? false}); },
    flyTo: (v, opt) => { m.flyTo([v.lat, v.lon], v.zoom ?? m.getZoom(), {duration: (opt?.durationMs ?? 1000) / 1000, animate: !opt?.reducedMotion}); },
    fitPoints: (pts, opt) => { if (!pts.length) return; m.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lon] as [number, number])).pad(opt.padRatio ?? 0.15), {animate: opt.animate ?? true, maxZoom: opt.maxZoom, paddingTopLeft: [opt.padding.left, opt.padding.top], paddingBottomRight: [opt.padding.right, opt.padding.bottom]}); },
    panBy: (dx, dy, opt) => { m.panBy([dx, dy], {animate: opt?.animate ?? false}); },
    zoomBy: (d) => { if (d > 0) m.zoomIn(d); else if (d < 0) m.zoomOut(-d); },
    setMinZoom: (z) => m.setMinZoom(z),
    getBounds: () => { const b = m.getBounds(); return {south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast()}; },
    getSize: () => { const s = m.getSize(); return {width: s.x, height: s.y}; },
    project: (lat, lon) => { const p = m.latLngToContainerPoint([lat, lon]); return {x: p.x, y: p.y}; },
    unproject: (x, y) => { const l = m.containerPointToLatLng([x, y]); return {lat: l.lat, lon: l.lng}; },
    on(e, cb) {
      const h = (x?: L.LeafletMouseEvent) => {
        if (e !== 'click') { cb(); return; }
        if (!x || isOverlay(x.originalEvent?.target ?? null)) return; // Leaflet itself never fires click after a drag
        cb({lat: x.latlng.lat, lon: wrapLon(x.latlng.lng), x: x.containerPoint.x, y: x.containerPoint.y} satisfies EngineClick);
      };
      m.on(ev[e], h as L.LeafletEventHandlerFn); const off = () => { m.off(ev[e], h as L.LeafletEventHandlerFn); }; offs.push(off); return off;
    },
    addMarker(mo: MarkerOptions): MarkerHandle {
      const [w, h] = mo.size ?? [0, 0], anchor: [number, number] = mo.anchor === 'bottom' ? [w / 2, h] : [w / 2, h / 2];
      // the product's element IS the marker icon (no wrapper): Leaflet positions it and applies size, anchor margins and the element's own classes
      const Icon = L.Icon.extend({createIcon(this: {_setIconStyles(e: HTMLElement, n: string): void}) { this._setIconStyles(mo.element, 'icon'); return mo.element; }, createShadow: () => null});
      const icon = new (Icon as unknown as new (o: L.IconOptions) => L.Icon)({iconUrl: '', iconSize: w || h ? [w, h] : undefined, iconAnchor: anchor, className: mo.element.className});
      const mk = L.marker([mo.lat, mo.lon], {icon, draggable: !!mo.draggable, keyboard: mo.keyboard ?? false, title: mo.title, alt: mo.title, riseOnHover: mo.riseOnHover, zIndexOffset: mo.zIndex ?? 0}).addTo(m);
      if (mo.onClick) mk.on('click', mo.onClick); if (mo.onHover) { mk.on('mouseover', () => mo.onHover!(true)); mk.on('mouseout', () => mo.onHover!(false)); }
      if (mo.onDrag) mk.on('drag', () => { const l = mk.getLatLng(); mo.onDrag!(l.lat, wrapLon(l.lng)); }); if (mo.onDragEnd) mk.on('dragend', () => { const l = mk.getLatLng(); mo.onDragEnd!(l.lat, wrapLon(l.lng)); });
      return {setLatLon: (lat, lon) => { mk.setLatLng([lat, lon]); }, getLatLon: () => { const l = mk.getLatLng(); return {lat: l.lat, lon: l.lng}; }, element: mo.element, remove: () => { mk.remove(); }};
    },
    setTheme: () => { /* the basemap and the field follow data-theme through their own observers */ },
    attribution: () => { for (const k of ['satellite', 'dark', 'light'] as const) if (el.classList.contains('mb-' + k)) return BASEMAPS[k].attribution; return BASEMAPS.light.attribution; },
    dispose() { offs.forEach((f) => f()); field.dispose(); disposeBase(); m.remove(); if (import.meta.env.DEV) { const w = window as unknown as {__xmap?: unknown}; if (w.__xmap === m) delete w.__xmap; } },
  };
  return api;
}
