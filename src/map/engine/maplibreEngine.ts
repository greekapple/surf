// The MapLibre engine behind the MapEngine seam (map-maplibre): vector basemap (style.ts), WebGL sea-state field + particles (glField.ts),
// DOM markers, the same camera API as the Leaflet adapter. Zoom numbers are LEAFLET-equivalent at the seam (MapLibre's 512 px world = Leaflet zoom - 1),
// so the URL state, the thresholds (far 9, world 5) and mapConfig.view mean the same thing on both engines.
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {mapConfig} from '../mapConfig.ts';
import {minZoomFor} from '../mapConfig.ts';
import {ATTRIBUTION_TEXT, brandedStyle, loadBaseStyle, paintFor, palette} from './style.ts';
import {createGLFieldController} from './glField.ts';
import type {EngineClick, EngineEvent, EngineOptions, MapEngine, MarkerHandle, MarkerOptions, Theme} from './types.ts';

const ZOFF = 1; // Leaflet zoom = MapLibre zoom + 1
const wrapLon = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;
const themeNow = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export async function createMaplibreEngine(el: HTMLElement, o: EngineOptions): Promise<MapEngine> {
  const base = await loadBaseStyle();
  let theme: Theme = o.theme, heat = el.dataset.heat === 'on';
  const map = new maplibregl.Map({
    container: el, style: brandedStyle(base, theme, heat) as unknown as maplibregl.StyleSpecification, center: [o.view.lon, o.view.lat], zoom: o.view.zoom - ZOFF,
    minZoom: o.minZoom - ZOFF, maxZoom: o.maxZoom - ZOFF, maxPitch: 0, dragRotate: false, pitchWithRotate: false, attributionControl: false, renderWorldCopies: true, fadeDuration: 150, canvasContextAttributes: {antialias: false},
  } as maplibregl.MapOptions);
  map.touchZoomRotate.disableRotation(); map.keyboard.disableRotation?.();
  map.addControl(new maplibregl.AttributionControl({compact: true}), 'bottom-left');
  const lod = () => { const z = map.getZoom() + ZOFF; el.classList.toggle('far', z < mapConfig.zoom.far); el.classList.toggle('world', z < mapConfig.zoom.world); };
  map.on('zoom', lod); map.on('zoomend', lod); lod();
  map.on('resize', () => map.setMinZoom(minZoomFor(el.clientWidth) - ZOFF)); // the world always fills the width
  const brand = () => { const p = palette(theme, heat); for (const l of map.getStyle().layers) { const ov = paintFor(l, p); if (ov) for (const [k, v] of Object.entries(ov)) { try { map.setPaintProperty(l.id, k, v as never); } catch { /* property not on this layer */ } } } };
  const mo = new MutationObserver(() => { const h = el.dataset.heat === 'on'; if (h !== heat) { heat = h; if (map.isStyleLoaded()) brand(); else map.once('idle', brand); } }); mo.observe(el, {attributes: true, attributeFilter: ['data-heat']});
  const to = new MutationObserver(() => api.setTheme(themeNow())); to.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  const field = createGLFieldController(map, el);
  const offs: (() => void)[] = [];
  // QA hook (dev only): the native map with Leaflet-equivalent zoom numbers, so one script drives both engines.
  if (import.meta.env.DEV) {
    const z = (v: number) => v - ZOFF, zo = (opt?: Record<string, unknown>) => (opt && typeof opt.zoom === 'number' ? {...opt, zoom: z(opt.zoom)} : opt);
    (window as unknown as {__xmap?: unknown}).__xmap = new Proxy(map, {get(t, k) {
      if (k === 'getZoom') return () => t.getZoom() + ZOFF; if (k === 'setZoom') return (v: number, e?: unknown) => t.setZoom(z(v), e as never);
      if (k === 'jumpTo') return (opt: Record<string, unknown>) => t.jumpTo(zo(opt) as never); if (k === 'easeTo') return (opt: Record<string, unknown>) => t.easeTo(zo(opt) as never); if (k === 'flyTo') return (opt: Record<string, unknown>) => t.flyTo(zo(opt) as never);
      const v = (t as unknown as Record<string | symbol, unknown>)[k]; return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(t) : v;
    }});
  }
  const isOverlay = (t: EventTarget | null) => t instanceof Element && !!t.closest('[data-map-overlay],.maplibregl-marker,.maplibregl-ctrl');
  const api: MapEngine = {
    kind: 'maplibre', container: el, field,
    getView: () => { const c = map.getCenter(); return {lat: c.lat, lon: c.lng, zoom: map.getZoom() + ZOFF}; },
    setView: (v, opt) => { const t = {center: [v.lon, v.lat] as [number, number], zoom: v.zoom - ZOFF}; if (opt?.animate) map.easeTo({...t, duration: 500}); else map.jumpTo(t); },
    flyTo: (v, opt) => { const t = {center: [v.lon, v.lat] as [number, number], zoom: (v.zoom ?? map.getZoom() + ZOFF) - ZOFF}; if (opt?.reducedMotion) map.jumpTo(t); else map.flyTo({...t, duration: opt?.durationMs ?? 1000, essential: true}); },
    fitPoints: (pts, opt) => {
      if (!pts.length) return; const lons = pts.map((p) => p.lon), lats = pts.map((p) => p.lat), r = opt.padRatio ?? 0.15, dx = (Math.max(...lons) - Math.min(...lons)) * r, dy = (Math.max(...lats) - Math.min(...lats)) * r;
      map.fitBounds([[Math.min(...lons) - dx, Math.min(...lats) - dy], [Math.max(...lons) + dx, Math.max(...lats) + dy]], {padding: opt.padding, maxZoom: opt.maxZoom !== undefined ? opt.maxZoom - ZOFF : undefined, duration: opt.animate === false ? 0 : 600});
    },
    panBy: (dx, dy, opt) => { map.panBy([dx, dy], {duration: opt?.animate ? 400 : 0}); },
    zoomBy: (d) => { map.easeTo({zoom: map.getZoom() + d, duration: 300}); },
    setMinZoom: (z) => map.setMinZoom(z - ZOFF),
    getBounds: () => { const b = map.getBounds(); return {south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast()}; },
    getSize: () => ({width: el.clientWidth, height: el.clientHeight}),
    project: (lat, lon) => { const p = map.project([lon, lat]); return {x: p.x, y: p.y}; },
    unproject: (x, y) => { const l = map.unproject([x, y]); return {lat: l.lat, lon: l.lng}; },
    on(e: EngineEvent, cb) {
      const h = (x?: maplibregl.MapMouseEvent) => {
        if (e !== 'click') { cb(); return; }
        if (!x || isOverlay(x.originalEvent?.target ?? null)) return; // MapLibre itself never fires click after a drag
        cb({lat: x.lngLat.lat, lon: wrapLon(x.lngLat.lng), x: x.point.x, y: x.point.y} satisfies EngineClick);
      };
      map.on(e as never, h as never); const off = () => { map.off(e as never, h as never); }; offs.push(off); return off;
    },
    addMarker(mo: MarkerOptions): MarkerHandle {
      const [w, h] = mo.size ?? [0, 0], e = mo.element;
      if (w || h) { e.style.width = w + 'px'; e.style.height = h + 'px'; }
      if (mo.zIndex !== undefined) e.style.zIndex = String(mo.zIndex);
      if (mo.title) { e.title = mo.title; if (!e.getAttribute('aria-label')) e.setAttribute('aria-label', mo.title); }
      if (mo.keyboard) { e.tabIndex = 0; e.addEventListener('keydown', (k) => { if (k.key === 'Enter' || k.key === ' ') { k.preventDefault(); mo.onClick?.(); } }); }
      if (mo.onClick) e.addEventListener('click', () => mo.onClick!());
      if (mo.onHover || mo.riseOnHover) { e.addEventListener('mouseenter', () => { if (mo.riseOnHover) e.style.zIndex = String((mo.zIndex ?? 0) + 250); mo.onHover?.(true); }); e.addEventListener('mouseleave', () => { if (mo.riseOnHover) e.style.zIndex = String(mo.zIndex ?? ''); mo.onHover?.(false); }); }
      const mk = new maplibregl.Marker({element: e, anchor: w || h ? (mo.anchor === 'bottom' ? 'bottom' : 'center') : 'top-left', draggable: !!mo.draggable}).setLngLat([mo.lon, mo.lat]).addTo(map);
      if (mo.onDrag) mk.on('drag', () => { const l = mk.getLngLat(); mo.onDrag!(l.lat, wrapLon(l.lng)); }); if (mo.onDragEnd) mk.on('dragend', () => { const l = mk.getLngLat(); mo.onDragEnd!(l.lat, wrapLon(l.lng)); });
      return {setLatLon: (lat, lon) => { mk.setLngLat([lon, lat]); }, getLatLon: () => { const l = mk.getLngLat(); return {lat: l.lat, lon: l.lng}; }, element: e, remove: () => { mk.remove(); }};
    },
    setTheme: (t) => { theme = t; if (map.isStyleLoaded()) brand(); else map.once('idle', brand); field.setTheme?.(t); },
    attribution: () => ATTRIBUTION_TEXT,
    dispose() { offs.forEach((f) => f()); mo.disconnect(); to.disconnect(); field.dispose(); map.remove(); if (import.meta.env.DEV) { delete (window as unknown as {__xmap?: unknown}).__xmap; } },
  };
  // ready as soon as the style is parsed (layers exist, the camera and markers work); tiles, glyphs and the sprite keep streaming and the field repaints as they arrive, so nothing waits on them
  await new Promise<void>((res) => { if (map.isStyleLoaded()) res(); else map.once('style.load', () => res()); });
  return api;
}
