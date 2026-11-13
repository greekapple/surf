import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {hourFromParam} from '../services/sharePlan';
import {useAppData, type DataStore} from '../hooks/useAppData';
import {useForecast, type ForecastState} from '../hooks/useForecast';
import {useNow} from '../hooks/useNow';
import {spots} from '../data/demo';
import {allSpots} from '../data/catalog';
import {previewActive, visibleEvidence, visibleSpot, hiddenSpotId, hiddenOnChoose, type GateSpot} from '../ocean/regionGate';
import type {SpotEvidence} from '../ocean/types';
import {useArchive} from '../hooks/useArchive';
import {useModelSpread} from '../hooks/useModelSpread';
import type {SurfSpot} from '../models/index';
import {hourlySeries, type HourSample} from '../features/forecast/model';
import {matchSpotSlug, slugFor, spotIdForSlug} from './routes';
import {labelZoneFor, setMapZone, timeZoneOf} from '../ocean/spotZone';

/** Device-only UI preferences that are not part of the backed-up AppState. */
interface LocalPrefs {selectedBoardId: string | null; scaleFt: number; scaleMode: 'ride' | 'paddle'}
const PREF_KEY = 'swello-ui-v1';
function loadPrefs(): LocalPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(PREF_KEY) ?? '{}');
    return {selectedBoardId: v.selectedBoardId ?? null, scaleFt: Number(v.scaleFt) || 6, scaleMode: v.scaleMode === 'paddle' ? 'paddle' : 'ride'};
  } catch {
    return {selectedBoardId: null, scaleFt: 6, scaleMode: 'ride'};
  }
}

export interface Swello {
  data: DataStore;
  view: ForecastState;
  now: number;
  /** Changes when a wave-model spread arrives (T-073), so ranges can be recomputed. */
  spreadV: number;
  spot: SurfSpot;
  spotOptions: SurfSpot[];
  /** ca-only: the one region gate (ocean/regionGate.ts). `evidence` is the spot list every screen reads (California; everything when the owner's preview is on); `visible` tests a spot or a catalogue row. */
  gate: {preview: boolean; evidence: SpotEvidence[]; visible: (spot: GateSpot) => boolean};
  /** ca-only: a shared ?spot= link names a spot in a region that is not open yet (id), so Forecast says so and links to California instead of showing the spot or "not found". */
  hiddenSpot: string | null;
  /** ca-only: forget the hidden-spot state and drop ?spot= from the URL; the shell calls it when Forecast is left so the region page does not come back on the next visit. */
  clearHiddenSpot: () => void;
  series: HourSample[];
  selected: HourSample | null;
  live: boolean;
  setSpot: (id: string) => void;
  prefs: LocalPrefs;
  setPrefs: (patch: Partial<LocalPrefs>) => void;
  /** The Explore map reports the spots whose pins are on screen (debounced there); they load with the next scope. */
  reportVisible: (ids: string[]) => void;
  /** Set when a shared link's hour is no longer in the forecast: "That shared hour has passed; showing now." */
  shareNote: string;
  /** A screen that lists spots (Compare, Find spots, the spot picker) asks for the ones it shows: they load on demand. */
  requestSpots: (ids: string[]) => void;
  /** map-fill (lead, 2026-11-11): the map's background list, lowest priority: every region of the seaboard in view, loaded one region at a time after the
   *  spots in view, so the pills go live without panning. Replaces the list; [] clears it (the map clears it when it closes). */
  fillSpots: (ids: string[]) => void;
  /** Spec 2026-11-09 1B: whether the map has a spot focused. False = "no spot focused": the map highlights nothing and its clocks use the viewer's
   *  zone, while the app's selected spot (`spot`) stays, so Forecast still opens it. Picking a spot anywhere focuses it again. ?focus=none in the URL. */
  mapFocused: boolean;
  setMapFocused: (on: boolean) => void;
  /** Spec 2026-11-09 1A: the zone of the global clock labels for the current view (ocean/spotZone.ts labelZoneFor). */
  labelZone: string;
  /** Audit B2: the ?spot= slug in the URL names no spot (ids empty) or several (ids = the candidates). Forecast then says so instead of
   *  silently showing another spot; choosing a spot clears it. */
  missingSpot: {slug: string; ids: string[]} | null;
}
const Ctx = createContext<Swello | null>(null);
export const useSwello = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSwello outside provider');
  return v;
};

export function SwelloProvider({children, area = 'home', section = ''}: {children: ReactNode; area?: string; section?: string}) {
  const data = useAppData();
  // subset loading (ocean/spotScope.ts): the selected spot, favourites, the spots near them, the pins on the map and whatever a screen asks for load; the rest on demand
  const [visibleSpots, setVisibleSpots] = useState<string[]>([]), [requestedSpots, setRequestedSpots] = useState<string[]>([]);
  const [fillList, setFillList] = useState<string[]>([]);
  // the background list goes last in the scope (spotScope.ts computeScope `fill`, its own allowance SCOPE_FILL_MAX): everything else stays ahead of it
  const profile = data.state.profile, preview = previewActive(profile);
  const gate = useMemo(() => ({preview, evidence: visibleEvidence(profile), visible: (s: GateSpot) => visibleSpot(s, profile)}), [preview]); // eslint-disable-line react-hooks/exhaustive-deps
  const view = useForecast({favorites: data.state.favorites, visible: visibleSpots, requested: requestedSpots, fill: fillList, spots: gate.evidence});   // ca-only: the load scope draws from the gated list only
  const fillSpots = useCallback((ids: string[]) => setFillList((old) => (old.length === ids.length && old.every((x, i) => x === ids[i]) ? old : ids)), []);
  const reportVisible = useCallback((ids: string[]) => setVisibleSpots((old) => (old.length === ids.length && old.every((x, i) => x === ids[i]) ? old : ids.slice(0, 60))), []);
  const requestSpots = useCallback((ids: string[]) => setRequestedSpots((old) => { const add = ids.filter((id) => !old.includes(id)); return add.length ? [...old, ...add].slice(-250) : old; }), []);
  const now = useNow();
  const [prefs, setPrefsState] = useState(loadPrefs);
  const setPrefs = (patch: Partial<LocalPrefs>) => setPrefsState((p) => ({...p, ...patch}));
  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable: preferences stay in memory */ }
  }, [prefs]);

  const live = view.dataMode === 'Retrieved';
  const spotOptions = useMemo(() => (live ? gate.evidence.map((e) => allSpots.find((s) => s.id === e.id)!).filter(Boolean) : spots.filter(gate.visible)), [live, gate]);

  const [sharedT, setSharedT] = useState<string | null>(null), [shareNote, setShareNote] = useState('');
  // Spot deep link: ?spot=ocean-beach (one-way on load; afterwards the store owns the spot).
  const shown = (x: string) => spotOptions.some((s) => s.id === x);
  useEffect(() => {
    const id = spotIdForSlug(new URLSearchParams(location.search).get('spot'), shown);
    if (id && shown(id) && id !== view.selected) view.selectSpot(id);
    const t = hourFromParam(new URLSearchParams(location.search).get('t'));   // a shared plan: /forecast?spot=<slug>&t=<ISO hour> opens that spot at that hour
    if (id && t) { view.selectTime(t); setSharedT(t); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ca-only: a slug that names a spot in a hidden region is "not open yet", not "not found"
  const hiddenOf = (slug: string | null) => { if (!slug) return null; const m = matchSpotSlug(slug); return m.kind === 'spot' ? hiddenSpotId(m.id, profile) : null; };
  const [hiddenSpot, setHiddenSpot] = useState<string | null>(() => (typeof location === 'undefined' ? null : hiddenOf(new URLSearchParams(location.search).get('spot'))));
  const [missingSpot, setMissingSpot] = useState<Swello['missingSpot']>(() => {
    const slug = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('spot');
    if (!slug || hiddenOf(slug)) return null;
    const m = matchSpotSlug(slug, shown);
    return m.kind === 'spot' ? null : {slug, ids: m.kind === 'ambiguous' ? m.ids : []};
  });
  // review fix: when ?spot= leaves the URL (back/forward), the "not found" state goes with it; a new unknown slug brings it back
  useEffect(() => {
    const onPop = () => { const slug = new URLSearchParams(location.search).get('spot'), hid = hiddenOf(slug), m = slug && !hid ? matchSpotSlug(slug, shown) : null;
      setHiddenSpot(hid); setMissingSpot(!slug || !m || m.kind === 'spot' ? null : {slug, ids: m.kind === 'ambiguous' ? m.ids : []}); };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // An expired shared link: when the spot's forecast has loaded and the shared hour is no longer in it, say so and show now (never silently a different hour).
  useEffect(() => {
    if (!sharedT) return;
    const mine = view.mapRecords.filter((f) => f.spotId === view.selected); if (!mine.length) return;
    setSharedT(null);
    if (!mine.some((f) => f.timestamp === sharedT)) { view.selectTime(new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString()); setShareNote('That shared hour has passed; showing now.'); }
  }, [sharedT, view.mapRecords, view.selected]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!shareNote) return; const h = window.setTimeout(() => setShareNote(''), 12000); return () => window.clearTimeout(h); }, [shareNote]);

  const [mapFocused, setMapFocused] = useState(() => typeof location === 'undefined' || new URLSearchParams(location.search).get('focus') !== 'none');
  const clearHiddenSpot = () => { setHiddenSpot(null); const q = new URLSearchParams(location.search); if (q.has('spot')) { q.delete('spot'); const s = q.toString(); history.replaceState(null, '', location.pathname + (s ? `?${s}` : '')); } };
  const setSpot = (id: string) => {
    // ca-only: a link from the journal, an alert or a saved spot to a spot the gate hides says "not open yet" and never opens it
    const hid = hiddenOnChoose(id, profile); if (hid) { setHiddenSpot(hid); setMissingSpot(null); const hq = new URLSearchParams(location.search); hq.set('spot', slugFor(id)); history.replaceState(null, '', `${location.pathname}?${hq}`); return; }   // the URL names the hidden spot, so a reload shows the same page, not the previous spot
    setMapFocused(true);   // choosing a spot (pin, list, search, Home, the strip) focuses it on the map again
    if (missingSpot) setMissingSpot(null);
    if (hiddenSpot) setHiddenSpot(null);
    const q = new URLSearchParams(location.search);
    if (id === view.selected && (!q.has('spot') || q.get('spot') === slugFor(id))) return;   // a wrong ?spot= slug is replaced even when the spot is unchanged
    if (id !== view.selected) view.selectSpot(id);
    q.set('spot', slugFor(id));
    history.replaceState(null, '', `${location.pathname}?${q}`);
  };

  useArchive(view.selected, view.mapRecords, view.ocean.bundle, live);
  const spreadV = useModelSpread([view.selected, ...data.state.favorites], live, !!view.ocean.bundle);
  const series = useMemo(() => hourlySeries(view.spot, view.mapRecords, now), [view.spot, view.mapRecords, now]);
  const selected = series.find((h) => h.timestamp === view.selectedTime) ?? null;

  // 1A: set before the children render (the map's time helpers read it), like setActiveZone in useForecast
  const labelZone = setMapZone(labelZoneFor(area, section, timeZoneOf(view.spot), mapFocused));

  const value: Swello = {data, view, now, spreadV, spot: view.spot, spotOptions, gate, hiddenSpot, clearHiddenSpot, series, selected, live, setSpot, prefs, setPrefs, reportVisible, shareNote, requestSpots, fillSpots, mapFocused, setMapFocused, labelZone, missingSpot};
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
