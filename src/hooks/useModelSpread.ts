import {useEffect, useState} from 'react';
import {evidenceSpots} from '../ocean/spots';
import {request} from '../ocean/request';
import {loadModelSpread, subscribeSpread, SPREAD_TTL_MS} from '../services/modelSpread';
import {breakingProfile} from '../ocean/localCalibration';

/** Loads the wave-model spread (T-073) for the viewed spot and the saved spots (at most 12), one request each, after the main forecast has arrived. Silent on failure.
 *  Returns a counter that changes when a spread arrives, so consumers can recompute their ranges. */
export function useModelSpread(spotIds: string[], live: boolean, ready: boolean): number {
  const key = spotIds.join('|'), [version, setVersion] = useState(0), [tick, setTick] = useState(0);
  useEffect(() => subscribeSpread(() => setVersion((v) => v + 1)), []);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 60000); return () => clearInterval(id); }, []); // renew with the forecast: the cache TTL (10 min, checked each minute) expires while the app stays open
  useEffect(() => {
    if (!live || !ready) return;
    for (const id of [...new Set(spotIds)].slice(0, 12)) {
      const s = evidenceSpots.find((e) => e.id === id);
      if (s && s.orientation !== null && breakingProfile(id)) void loadModelSpread(s, (u) => request(u, 'json', 600000)).catch(() => { /* optional */ });
    }
  }, [key, live, ready, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return version;
}
