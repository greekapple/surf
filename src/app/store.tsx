import {createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode} from 'react';
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
  /** A screen that lists spots (Compare, Find spots, the spot picker) asks for the ones it shows: they load on demand. */
  requestSpots: (ids: string[]) => void;
}
const Ctx = createContext<Swello | null>(null);
export const useSwello = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSwello outside provider');
  return v;
};

export function SwelloProvider({children}: {children: ReactNode}) {
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

  // Spot deep link: ?spot=ocean-beach (one-way on load; afterwards the store owns the spot).
  useEffect(() => {
    const id = spotIdForSlug(new URLSearchParams(location.search).get('spot'));
    if (id && spotOptions.some((s) => s.id === id) && id !== view.selected) view.selectSpot(id);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setSpot = (id: string) => {
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

  const value: Swello = {data, view, now, spreadV, spot: view.spot, spotOptions, series, selected, live, setSpot, prefs, setPrefs, reportVisible, requestSpots};
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
