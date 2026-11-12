import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {surfReadout} from '../features/forecast/chartReadout.ts';
import type {SurfBandPoint} from '../services/surfSeries.ts';

const read = (f: string) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const fmt = (ft: number) => `${ft.toFixed(1)} ft`, fmtR = (lo: number, hi: number) => `${Math.round(lo)}–${Math.round(hi)} ft`;
const fmtM = (ft: number) => `${(ft * 0.3048).toFixed(1)} m`, fmtRM = (lo: number, hi: number) => `${(lo * 0.3048).toFixed(1)}–${(hi * 0.3048).toFixed(1)} m`;
const pt = (o: Partial<SurfBandPoint>): SurfBandPoint => ({t: '2026-11-12T18:00:00Z', lo: null, hi: null, kind: 'none', ...o} as SurfBandPoint);
const est = (o: Partial<SurfBandPoint>) => pt({kind: 'estimate', lo: 3, hi: 4, certainty: 'high', ...o});

test('forecast-charts readout: every surf value says its kind (model estimate, how sure, models differ, offshore not surf size, NWS, demonstration)', () => {
  assert.deepEqual(surfReadout(7.3, est({}), fmt, fmtR), {v: '3–4 ft', kind: 'model estimate', could: undefined});
  assert.equal(surfReadout(7.3, est({certainty: 'medium'}), fmt, fmtR).kind, 'model estimate · medium confidence');
  const w = surfReadout(7.3, est({lo: 8, hi: 12, certainty: 'low', wide: {loFt: 6, hiFt: 15}} as Partial<SurfBandPoint>), fmt, fmtR);
  assert.equal(w.kind, 'model estimate · low confidence · models differ'); assert.equal(w.could, 'models differ; could be 6–15 ft', 'the wider range the models allow is kept');
  assert.deepEqual(surfReadout(0.4, est({lo: 0, hi: 1, flat: true} as Partial<SurfBandPoint>), fmt, fmtR), {v: 'Flat', kind: 'model estimate', could: undefined});
  assert.deepEqual(surfReadout(7.3, pt({kind: 'offshore', lo: 7.3, hi: 7.3}), fmt, fmtR), {v: '7.3 ft', kind: 'offshore · not surf size'}, 'offshore is never a surf estimate');
  assert.deepEqual(surfReadout(7.3, undefined, fmt, fmtR), {v: '7.3 ft', kind: 'offshore · not surf size'}, 'the last hour, past the nearshore run');
  assert.match(surfReadout(5, pt({official: true} as Partial<SurfBandPoint>), fmt, fmtR).kind, /not surf size; the NWS surf forecast for the zone is in the header/);
  assert.equal(surfReadout(5, pt({kind: 'demonstration', lo: 5, hi: 5}), fmt, fmtR).kind, 'demonstration · not live');
  assert.equal(surfReadout(null, undefined, fmt, fmtR).v, '—', 'no height, no number');
});

test('forecast-charts readout (data-honesty review): the Surf card\'s tags, too far out for every kind, metric ranges never collapse', () => {
  assert.equal(surfReadout(7, est({transfer: 'buoy-corrected ×0.8'}), fmt, fmtR).kind, 'model estimate · buoy-corrected ×0.8');
  assert.equal(surfReadout(7, est({tuned: true}), fmt, fmtR).kind, 'model estimate · tuned to your reports');
  assert.equal(surfReadout(7, est({saved: true}), fmt, fmtR).kind, 'model estimate · saved copy, not current');
  assert.deepEqual(surfReadout(7, est({lo: 11, hi: 14, certainty: 'too-far'}), fmt, fmtR), {v: 'too far out', kind: 'to call; the model says 11–14 ft · model estimate', could: undefined}, 'past the horizon the number is not called');
  assert.equal(surfReadout(7, est({lo: 0, hi: 1, flat: true, certainty: 'too-far'} as Partial<SurfBandPoint>), fmt, fmtR).v, 'too far out', 'too far out overrides Flat');
  assert.equal(surfReadout(7.3, pt({kind: 'offshore', lo: 7.3, hi: 7.3, certainty: 'too-far'}), fmt, fmtR).kind, 'offshore · not surf size · too far out', 'offshore heights past the horizon say so too');
  assert.equal(surfReadout(7, est({lo: 2, hi: 3}), fmtM, fmtRM).v, '0.6–0.9 m', 'a 2–3 ft band is two metre values, not "1–1 m"');
  const fc = read('../features/forecast/ForecastCharts.tsx');
  assert.match(fc, /<StaleTag s=\{fr\.wind\} \/>/); assert.match(fc, /<StaleTag s=\{fr\.tide\} \/>/);
  assert.match(fc, /Primary swell/); assert.match(fc, /pk === 'chop' \? ' chop'/, 'chop is called chop, noise is not shown as swell');
  assert.match(fc, /too far out<\/span>/); assert.match(fc, /ratings provisional/);
  assert.match(read('../features/forecast/charts.tsx'), /hourValueText\(h: HourSample, pt: SurfBandPoint \| undefined/, 'the slider speaks the same kind words');
});

test('forecast-charts: one slider and one cursor for the four panels; no floating tooltip; the panels fit a phone screen', () => {
  const fc = read('../features/forecast/ForecastCharts.tsx'), ch = read('../features/forecast/charts.tsx');
  assert.equal((fc.match(/role="slider"/g) ?? []).length, 1, 'one slider spans the panels');
  assert.doesNotMatch(ch, /role="slider"|tl-tip|onPointerDown/, 'a panel only draws; it has no slider or tooltip of its own');
  assert.match(fc, /hoverIndex=\{hover\}/, 'the pointer preview is one line on every panel');
  const m = /CHART_H_PHONE: Record<ChartTab, number> = \{surf: (\d+), swell: (\d+), wind: (\d+), tide: (\d+)\}/.exec(fc)!;
  assert.ok(m.slice(1).map(Number).reduce((x, y) => x + y) <= 460, 'the four phone panels together stay within the screen budget');
  assert.match(fc, /touch-action|pan-y|setPointerCapture/, 'a drag sets the hour');
});

test('forecast-charts: day zoom by a day button, the 7 days button, Escape, Enter/Space and the browser\'s Back', () => {
  const fc = read('../features/forecast/ForecastCharts.tsx');
  assert.match(fc, /className=\{`fc-day/); assert.match(fc, /onClick=\{\(\) => zoomInto\(k\)\}/);
  assert.match(fc, /e\.key === 'Enter' \|\| e\.key === ' '/); assert.match(fc, /e\.key === 'Escape' && mode === 'day'/);
  assert.match(fc, /history\.pushState/); assert.match(fc, /addEventListener\('popstate'/);
  assert.match(fc, /aria-label="Detail view"[\s\S]*7 days[\s\S]*Table/, 'one control row: 7 days, the day, Table');
});

test('forecast-charts: the legend list is gone and each panel names what it draws, every honesty label kept', () => {
  const fc = read('../features/forecast/ForecastCharts.tsx'), fv = read('../features/forecast/ForecastView.tsx');
  assert.doesNotMatch(fv, /className="legend"/);
  for (const w of ['surf est. (model)', 'offshore Hs', 'offshore Hs · not surf size', 'fainter = less sure', 'models differ', 'above MLLW', 'gusts', 'Arrows 0 to']) assert.ok(fc.includes(w), `panel key names "${w}"`);
  assert.match(read('../features/forecast/charts.tsx'), /too far out to call/, 'the hatched horizon keeps its words in the plot');
  assert.match(fc, /MLLW\{td\.trend/, 'the readout tide says MLLW');
});
