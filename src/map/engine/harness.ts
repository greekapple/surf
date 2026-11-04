// Dev-only harness for the engine seam (QA scripts: t128-engine.mjs). Not part of the app. /engine-harness.html?engine=leaflet|maplibre
import 'leaflet/dist/leaflet.css';
import {createEngine, engineKind} from './index.ts';
const el = document.getElementById('map')!, log: string[] = [];
(window as unknown as {__log: string[]}).__log = log;
const eng = await createEngine(engineKind(), el, {view: {lat: 37.5, lon: -122.4, zoom: 8}, minZoom: 2, maxZoom: 14, theme: 'light'});
(window as unknown as {__eng: unknown}).__eng = eng;
for (const e of ['movestart', 'moveend', 'zoomend', 'resize'] as const) eng.on(e, () => log.push(e));
eng.on('click', (c) => log.push(`click ${c?.lat.toFixed(2)},${c?.lon.toFixed(2)}`));
const pin = document.createElement('div'); pin.className = 'pin'; const popup = document.createElement('div'); popup.setAttribute('data-map-overlay', ''); popup.style.cssText = 'position:absolute;left:300px;top:300px;width:80px;height:40px;background:#fff;z-index:900'; popup.textContent = 'popup'; el.appendChild(popup);
eng.addMarker({lat: 37.7, lon: -122.5, element: pin, size: [20, 20], title: 'Pin', keyboard: true, onClick: () => log.push('marker click')});
document.body.dataset.ready = '1';

// ?field=WAVES|SWELL|WIND|PERIOD : paint the real sea-state field through the engine's FieldController (what ExploreView does), and expose a switcher for QA.
const q = new URLSearchParams(location.search), which = q.get('field');
if (which) {
  const {spatialSpec, loadGlobe} = await import('../spatial.ts'); const {buildField} = await import('../fieldData.ts');
  const VAR: Record<string, string> = {WAVES: 'Offshore Hs', SWELL: 'Height', WIND: 'Speed', PERIOD: 'Period'};
  const show = async (layer: string, hours = 0, flow = true, reduced = false, arrows = q.get('arrows') === '1') => {
    const t = new Date(Math.floor((Date.now() + hours * 3600000) / 10800000) * 10800000).toISOString(), spec = spatialSpec((layer === 'PERIOD' ? 'WAVES' : layer) as never, VAR[layer] as never, t, false)!;
    const frame = await loadGlobe(spec, new AbortController().signal), field = buildField(frame, layer === 'WIND')!, fields = [field];
    if (q.get('nest') === '1') { const {loadSpatial} = await import('../spatial.ts'); const rf = await loadSpatial(spec, new AbortController().signal); fields.unshift(buildField(rf, layer === 'WIND')!); } // regional nest first, global second: the shader blends them
    (window as unknown as {__fields: unknown[]}).__fields = fields;
    eng.field.update(fields, {heat: true, flow, arrows, opacity: 1, reducedMotion: reduced, onFrame: (s) => log.push(`frame ${s.state} ${s.state === 'ready' ? s.key : ''}`)});
    return {provider: frame.provider, validAt: frame.validAt};
  };
  (window as unknown as {__show: typeof show}).__show = show;
  await show(which);
}

// QA: the colour the ramp gives for the value the pin label reads at a point, and where that point is on screen (t132: painted colour == label colour).
if (which) {
  const {layerColor, scaleKeyOf} = await import('../ramps.ts'); const {sampleField, buildField: _b} = await import('../field.ts'); void _b;
  (window as unknown as {__probe: unknown}).__probe = (lat: number, lon: number, fields: unknown[]) => {
    const pv = sampleField(fields as never, lat, lon); if (!pv || pv.value === null) return null; const key = scaleKeyOf(pv.layer); if (!key) return null; const p = eng.project(lat, lon);
    return {x: p.x, y: p.y, value: pv.value, rgb: layerColor(key, pv.value, 'light')};
  };
}
