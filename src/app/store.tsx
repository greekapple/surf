import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
import {hourFromParam} from '../services/sharePlan';
import {useAppData, type DataStore} from '../hooks/useAppData';
import {useForecast, type ForecastState} from '../hooks/useForecast';
import {useNow} from '../hooks/useNow';
import {spots} from '../data/demo';
import {allSpots} from '../data/catalog';
import {evidenceSpots} from '../ocean/spots';
import {useArchive} from '../hooks/useArchive';
import {useModelSpread} from '../hooks/useModelSpread';
import type {SurfSpot} from '../models/index';
import {hourlySeries, type HourSample} from '../features/forecast/model';
import {slugFor, spotIdForSlug} from './routes';
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
  /** Spec 2026-11-09 1B: whether the map has a spot focused. False = "no spot focused": the map highlights nothing and its clocks use the viewer's
   *  zone, while the app's selected spot (`spot`) stays, so Forecast still opens it. Picking a spot anywhere focuses it again. ?focus=none in the URL. */
  mapFocused: boolean;
  setMapFocused: (on: boolean) => void;
  /** Spec 2026-11-09 1A: the zone of the global clock labels for the current view (ocean/spotZone.ts labelZoneFor). */
  labelZone: string;
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
  const view = useForecast({favorites: data.state.favorites, visible: visibleSpots, requested: requestedSpots});
  const reportVisible = useCallback((ids: string[]) => setVisibleSpots((old) => (old.length === ids.length && old.every((x, i) => x === ids[i]) ? old : ids.slice(0, 60))), []);
  const requestSpots = useCallback((ids: string[]) => setRequestedSpots((old) => { const add = ids.filter((id) => !old.includes(id)); return add.length ? [...old, ...add].slice(-250) : old; }), []);
  const now = useNow();
  const [prefs, setPrefsState] = useState(loadPrefs);
  const setPrefs = (patch: Partial<LocalPrefs>) => setPrefsState((p) => ({...p, ...patch}));
  useEffect(() => {
    try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* storage unavailable: preferences stay in memory */ }
  }, [prefs]);

  const live = view.dataMode === 'Retrieved';
  const spotOptions = useMemo(() => (live ? evidenceSpots.map((e) => allSpots.find((s) => s.id === e.id)!).filter(Boolean) : spots), [live]);

  const [sharedT, setSharedT] = useState<string | null>(null), [shareNote, setShareNote] = useState('');
  // Spot deep link: ?spot=ocean-beach (one-way on load; afterwards the store owns the spot).
  useEffect(() => {
    const id = spotIdForSlug(new URLSearchParams(location.search).get('spot'));
    if (id && spotOptions.some((s) => s.id === id) && id !== view.selected) view.selectSpot(id);
    const t = hourFromParam(new URLSearchParams(location.search).get('t'));   // a shared plan: /forecast?spot=<slug>&t=<ISO hour> opens that spot at that hour
    if (id && t) { view.selectTime(t); setSharedT(t); }
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
  const setSpot = (id: string) => {
    setMapFocused(true);   // choosing a spot (pin, list, search, Home, the strip) focuses it on the map again
    if (id === view.selected) return;
    view.selectSpot(id);
    const q = new URLSearchParams(location.search);
    q.set('spot', slugFor(id));
    history.replaceState(null, '', `${location.pathname}?${q}`);
  };

  useArchive(view.selected, view.mapRecords, view.ocean.bundle, live);
  const spreadV = useModelSpread([view.selected, ...data.state.favorites], live, !!view.ocean.bundle);
  const series = useMemo(() => hourlySeries(view.spot, view.mapRecords, now), [view.spot, view.mapRecords, now]);
  const selected = series.find((h) => h.timestamp === view.selectedTime) ?? null;

  // 1A: set before the children render (the map's time helpers read it), like setActiveZone in useForecast
  const labelZone = setMapZone(labelZoneFor(area, section, timeZoneOf(view.spot), mapFocused));

  const value: Swello = {data, view, now, spreadV, spot: view.spot, spotOptions, series, selected, live, setSpot, prefs, setPrefs, reportVisible, shareNote, requestSpots, mapFocused, setMapFocused, labelZone};
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
