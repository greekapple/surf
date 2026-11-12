// The MapLibre engine behind the MapEngine seam (map-maplibre): vector basemap (style.ts), WebGL sea-state field + particles (glField.ts),
// DOM markers, the same camera API as the Leaflet adapter. Zoom numbers are LEAFLET-equivalent at the seam (MapLibre's 512 px world = Leaflet zoom - 1),
// so the URL state, the thresholds (far 9, world 5) and mapConfig.view mean the same thing on both engines.
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import {mapConfig} from '../mapConfig.ts';
import {minZoomFor} from '../mapConfig.ts';
import {ATTRIBUTION_TEXT, WORLD_SEA_ID, brandedStyle, loadBaseStyle, paintFor, palette} from './style.ts';
import {createGLFieldController} from './glField.ts';
import {warmParents, warmWorld} from './tileWarm.ts';
import type {DotEvent, DotOptions, EngineClick, EngineEvent, EngineOptions, MapDot, MapEngine, MarkerHandle, MarkerOptions, Theme} from './types.ts';
import {DOT_PR, dotKey, drawDot} from './dotIcon.ts';

const ZOFF = 1; // Leaflet zoom = MapLibre zoom + 1
const wrapLon = (lng: number) => ((((lng + 180) % 360) + 360) % 360) - 180;
const themeNow = (): Theme => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export async function createMaplibreEngine(el: HTMLElement, o: EngineOptions): Promise<MapEngine> {
  const base = await loadBaseStyle();
  let theme: Theme = o.theme, heat = el.dataset.heat === 'on';
  const map = new maplibregl.Map({
    container: el, style: brandedStyle(base, theme, heat) as unknown as maplibregl.StyleSpecification, center: [o.view.lon, o.view.lat], zoom: o.view.zoom - ZOFF,
    minZoom: o.minZoom - ZOFF, maxZoom: o.maxZoom - ZOFF, maxPitch: 0, dragRotate: false, pitchWithRotate: false, attributionControl: false, renderWorldCopies: true, fadeDuration: 150, maxTileCacheSize: 300, maxTileCacheZoomLevels: 8, canvasContextAttributes: {antialias: false},
  } as maplibregl.MapOptions);
  map.touchZoomRotate.disableRotation(); map.keyboard.disableRotation?.();
  map.addControl(new maplibregl.AttributionControl({compact: true}), 'bottom-left');
  const lod = () => { const z = map.getZoom() + ZOFF; el.classList.toggle('far', z < mapConfig.zoom.far); el.classList.toggle('world', z < mapConfig.zoom.world); };
  map.on('zoom', lod); map.on('zoomend', lod); lod();
  map.on('resize', () => map.setMinZoom(minZoomFor(el.clientWidth) - ZOFF)); // the world always fills the width
  const brand = () => { const p = palette(theme, heat); for (const l of map.getStyle().layers) { const ov = paintFor(l, p); if (ov) for (const [k, v] of Object.entries(ov)) { try { map.setPaintProperty(l.id, k, v as never); } catch { /* property not on this layer */ } } } };
  const mo = new MutationObserver(() => { const h = el.dataset.heat === 'on'; if (h !== heat) { heat = h; if (map.isStyleLoaded()) brand(); else map.once('idle', brand); } }); mo.observe(el, {attributes: true, attributeFilter: ['data-heat']});
  const to = new MutationObserver(() => api.setTheme(themeNow())); to.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  // While the map moves (below zoom 6.5) the always-loaded world-sea polygon paints the sea under the tiles, so a multi-level zoom-out never shows land-coloured "sea" while the new level's tiles load; hidden again at idle (its coast is coarser than the tiles').
  const worldSea = (on: boolean) => { try { if (map.getLayer(WORLD_SEA_ID)) map.setLayoutProperty(WORLD_SEA_ID, 'visibility', on ? 'visible' : 'none'); } catch { /* style not ready */ } };
  // warm the world-sea polygon once (the worker builds its tile index on first use, which is slower than a zoom animation): shown invisibly at the current zoom, then hidden again
  map.once('idle', () => { try { if (!map.getLayer(WORLD_SEA_ID)) return; map.setLayerZoomRange(WORLD_SEA_ID, 0, 24); map.setPaintProperty(WORLD_SEA_ID, 'fill-opacity', 0); map.setLayoutProperty(WORLD_SEA_ID, 'visibility', 'visible'); map.once('idle', () => { try { map.setLayoutProperty(WORLD_SEA_ID, 'visibility', 'none'); map.setLayerZoomRange(WORLD_SEA_ID, 0, 10); map.setPaintProperty(WORLD_SEA_ID, 'fill-opacity', 1); } catch { /* removed */ } }); } catch { /* style not ready */ } });
  map.on('movestart', () => { if (map.getZoom() < 10) worldSea(true); }); map.on('zoomstart', () => worldSea(true)); map.on('idle', () => worldSea(false));
  // T-128b: coarser tiles are fetched ahead (into the HTTP cache) so a zoom-out finds its parent level ready.
  const tileTpl = (base.sources.openmaptiles as {tiles?: string[]} | undefined)?.tiles?.[0];
  if (tileTpl) { map.once('idle', () => warmWorld(tileTpl)); map.on('moveend', () => { const b = map.getBounds(); warmParents(tileTpl, {west: b.getWest(), east: b.getEast(), south: b.getSouth(), north: b.getNorth()}, map.getZoom()); }); }
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
  // phone pass 3: the page's labels (DOM markers) take priority over the basemap's place names. An invisible symbol layer on top of the style holds one
  // blank icon per label box; MapLibre places the top layer first, so a place name that would collide with a box is left out (the pins never cover a town name
  // and the town never shows through a pin label). Icons are reused by size (rounded up to 4 px).
  const SHIELD = 'swello-label-shield';
  const shieldFc = (boxes: {lat: number; lon: number; w: number; h: number}[]) => ({type: 'FeatureCollection' as const, features: boxes.filter((b) => b.w >= 1 && b.h >= 1).map((b) => {
    const w = Math.min(512, Math.ceil(b.w / 4) * 4), h = Math.min(256, Math.ceil(b.h / 4) * 4), key = `swello-sh-${w}x${h}`;
    if (!map.hasImage(key)) map.addImage(key, {width: w, height: h, data: new Uint8Array(w * h * 4)});
    return {type: 'Feature' as const, properties: {i: key}, geometry: {type: 'Point' as const, coordinates: [b.lon, b.lat]}};
  })});
  const shield = (boxes: {lat: number; lon: number; w: number; h: number}[]) => {
    if (!map.isStyleLoaded()) { map.once('idle', () => shield(boxes)); return; }
    try {
      const data = shieldFc(boxes), src = map.getSource(SHIELD) as maplibregl.GeoJSONSource | undefined;
      if (src) { src.setData(data); return; }
      map.addSource(SHIELD, {type: 'geojson', data});
      map.addLayer({id: SHIELD, type: 'symbol', source: SHIELD, layout: {'icon-image': ['get', 'i'], 'icon-allow-overlap': true, 'icon-ignore-placement': false, 'icon-anchor': 'center'}, paint: {'icon-opacity': 0}});
    } catch { /* style not ready: the next declutter sends the boxes again */ }
  };
  // map-dots: the spot and group dots as symbol layers on top of the style (above the place names, so a name that would collide with a dot gives way).
  // One GeoJSON source; three layers: groups (coast zoom), spots (close zoom), and the selected spot (always placed, with its name). MapLibre collides the
  // dots against each other in priority order (symbol-sort-key), so a lower-rated dot that would overlap is left out until you zoom in.
  const DOT_SRC = 'swello-dots', DOT_LAYERS = ['swello-dots-sel', 'swello-dots-spot', 'swello-dots-group'] as const;
  const dotCbs = new Set<(e: DotEvent) => void>();
  let dotsPending: {dots: MapDot[]; o: DotOptions} | null = null, dotsWaiting = false, dotOpts: DotOptions | null = null;
  const dotLayersHere = () => DOT_LAYERS.filter((l) => map.getLayer(l));
  const applyDots = (dots: MapDot[], o: DotOptions) => {
    const feats = dots.map((d) => {
      const key = dotKey(d.icon);
      if (!map.hasImage(key)) { const img = drawDot(d.icon); if (img) map.addImage(key, img, {pixelRatio: DOT_PR}); }
      return {type: 'Feature' as const, properties: {id: d.id, layer: d.layer, i: key, k: -d.prio, name: d.name, dim: d.dim}, geometry: {type: 'Point' as const, coordinates: [d.lon, d.lat]}};
    });
    const data = {type: 'FeatureCollection' as const, features: feats}, src = map.getSource(DOT_SRC) as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(data); else map.addSource(DOT_SRC, {type: 'geojson', data});
    const same = dotOpts && dotOpts.groupsFrom === o.groupsFrom && dotOpts.spotsFrom === o.spotsFrom && dotOpts.namesFrom === o.namesFrom && dotOpts.pad === o.pad;
    if (!same) for (const l of DOT_LAYERS) if (map.getLayer(l)) map.removeLayer(l);
    const text = {'text-font': ['Noto Sans Regular'], 'text-size': 12, 'text-variable-anchor': ['left', 'right'], 'text-radial-offset': 1.15, 'text-justify': 'auto', 'text-optional': true, 'text-max-width': 9, 'text-padding': 2} as const;
    const paint = {'icon-opacity': ['case', ['get', 'dim'], 0.65, 1], 'text-color': o.text, 'text-halo-color': o.halo, 'text-halo-width': 1.6, 'text-opacity': ['case', ['get', 'dim'], 0.7, 1]};
    const base = {'icon-image': ['get', 'i'], 'icon-anchor': 'center', 'symbol-sort-key': ['get', 'k'], 'icon-padding': o.pad} as const;
    if (!map.getLayer('swello-dots-group')) map.addLayer({id: 'swello-dots-group', type: 'symbol', source: DOT_SRC, filter: ['==', ['get', 'layer'], 'group'], minzoom: o.groupsFrom - ZOFF, maxzoom: o.spotsFrom - ZOFF, layout: {...base, 'icon-allow-overlap': false}, paint: {'icon-opacity': paint['icon-opacity']}} as unknown as maplibregl.AddLayerObject);
    if (!map.getLayer('swello-dots-spot')) map.addLayer({id: 'swello-dots-spot', type: 'symbol', source: DOT_SRC, filter: ['==', ['get', 'layer'], 'spot'], minzoom: o.spotsFrom - ZOFF, layout: {...base, ...text, 'icon-allow-overlap': false, 'text-field': ['step', ['zoom'], '', o.namesFrom - ZOFF, ['get', 'name']]}, paint} as unknown as maplibregl.AddLayerObject);
    if (!map.getLayer('swello-dots-sel')) map.addLayer({id: 'swello-dots-sel', type: 'symbol', source: DOT_SRC, filter: ['==', ['get', 'layer'], 'sel'], minzoom: o.groupsFrom - ZOFF, layout: {...base, ...text, 'icon-allow-overlap': true, 'text-field': ['get', 'name'], 'text-size': 13}, paint} as unknown as maplibregl.AddLayerObject);
    else for (const l of ['swello-dots-spot', 'swello-dots-sel']) { map.setPaintProperty(l, 'text-color', o.text); map.setPaintProperty(l, 'text-halo-color', o.halo); }
    dotOpts = o;
  };
  const setDots = (dots: MapDot[], o: DotOptions) => {
    dotsPending = {dots, o};
    if (!map.isStyleLoaded()) { if (!dotsWaiting) { dotsWaiting = true; map.once('idle', () => { dotsWaiting = false; if (dotsPending) setDots(dotsPending.dots, dotsPending.o); }); } return; }
    try { applyDots(dots, o); dotsPending = null; } catch (err) { console.warn('dots', err); }
  };
  /** the dot under a point (a finger gets a bigger box than a mouse), nearest first */
  const dotAt = (pt: {x: number; y: number}, slop: number) => {
    const ls = dotLayersHere(); if (!ls.length) return null;
    const fs = map.queryRenderedFeatures([[pt.x - slop, pt.y - slop], [pt.x + slop, pt.y + slop]], {layers: ls});
    let best: {id: string; layer: MapDot['layer']; d: number} | null = null;
    for (const f of fs) { const c = (f.geometry as unknown as {coordinates: [number, number]}).coordinates, q = map.project(c), d = Math.hypot(q.x - pt.x, q.y - pt.y), p = f.properties as {id: string; layer: MapDot['layer']}; if (!best || d < best.d || (p.layer === 'sel' && d <= best.d + 4)) best = {id: p.id, layer: p.layer, d}; }
    return best;
  };
  const coarse = () => matchMedia('(pointer: coarse)').matches;
  let hoverId: string | null = null;
  map.on('click', (e) => { const h = dotAt(e.point, coarse() ? 16 : 9); if (h) dotCbs.forEach((cb) => cb({type: 'click', id: h.id, layer: h.layer, x: e.point.x, y: e.point.y})); });
  map.on('mousemove', (e) => {
    if (coarse()) return; const h = dotAt(e.point, 8), id = h ? h.id : null;
    if (id === hoverId) return;
    if (hoverId) { const old = hoverId; dotCbs.forEach((cb) => cb({type: 'leave', id: old, layer: 'spot', x: e.point.x, y: e.point.y})); }
    hoverId = id; map.getCanvas().style.cursor = h ? 'pointer' : '';
    if (h) dotCbs.forEach((cb) => cb({type: 'enter', id: h.id, layer: h.layer, x: e.point.x, y: e.point.y}));
  });
  map.on('mouseout', () => { if (hoverId) { const old = hoverId; hoverId = null; map.getCanvas().style.cursor = ''; dotCbs.forEach((cb) => cb({type: 'leave', id: old, layer: 'spot', x: 0, y: 0})); } });
  const api: MapEngine = {
    shieldLabels: shield,
    setDots,
    onDot: (cb) => { dotCbs.add(cb); return () => { dotCbs.delete(cb); }; },
    placedDots: () => { const ls = dotLayersHere(); if (!ls.length) return []; const seen = new Set<string>(); return map.queryRenderedFeatures({layers: ls}).flatMap((f) => { const p = f.properties as {id: string; layer: MapDot['layer']}, k = p.layer + p.id; if (seen.has(k)) return []; seen.add(k); const q = map.project((f.geometry as unknown as {coordinates: [number, number]}).coordinates); return [{id: p.id, layer: p.layer, x: q.x, y: q.y}]; }); },
    kind: 'maplibre', container: el, field,
    getView: () => { const c = map.getCenter(); return {lat: c.lat, lon: c.lng, zoom: map.getZoom() + ZOFF}; },
    setView: (v, opt) => { const t = {center: [v.lon, v.lat] as [number, number], zoom: v.zoom - ZOFF}; if (opt?.animate) map.easeTo({...t, duration: 500}); else map.jumpTo(t); },
    flyTo: (v, opt) => { const t = {center: [v.lon, v.lat] as [number, number], zoom: (v.zoom ?? map.getZoom() + ZOFF) - ZOFF}; if (opt?.reducedMotion) map.jumpTo(t); else map.flyTo({...t, duration: opt?.durationMs ?? 1000, essential: true}); },
    fitPoints: (pts, opt) => {
      if (!pts.length) return; const lons = pts.map((p) => p.lon), lats = pts.map((p) => p.lat), r = opt.padRatio ?? 0.15, dx = (Math.max(...lons) - Math.min(...lons)) * r, dy = (Math.max(...lats) - Math.min(...lats)) * r;
      map.fitBounds([[Math.min(...lons) - dx, Math.min(...lats) - dy], [Math.max(...lons) + dx, Math.max(...lats) + dy]], {padding: opt.padding, ...(opt.maxZoom !== undefined && {maxZoom: opt.maxZoom - ZOFF}), duration: opt.animate === false ? 0 : 600});   // B1 (audit M4): no explicit maxZoom: undefined (MapLibre made it NaN and the region chips threw)
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
        if (dotAt(x.point, coarse() ? 16 : 9)) return; // map-dots: a tap on a dot is the dot's (onDot), never a tap on the sea
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
