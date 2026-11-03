import {useEffect, useState} from 'react';
import {evidenceSpots} from '../ocean/spots';
import {request} from '../ocean/request';
import {loadModelSpread, subscribeSpread} from '../services/modelSpread';
import {breakingProfile} from '../ocean/localCalibration';

/** Loads the wave-model spread (T-073) for the viewed spot and the saved spots, one request each, after the main forecast has arrived. Silent on failure. */
/** Returns a counter that changes when a spread arrives, so consumers can recompute their ranges. */
export function useModelSpread(spotIds: string[], live: boolean, ready: boolean): number {
  const key = spotIds.join('|'), [version, setVersion] = useState(0);
  useEffect(() => subscribeSpread(() => setVersion((v) => v + 1)), []);
  useEffect(() => {
    if (!live || !ready) return;
    let on = true;
    for (const id of [...new Set(spotIds)].slice(0, 12)) {
      const s = evidenceSpots.find((e) => e.id === id);
      if (s && s.orientation !== null && breakingProfile(id)) void loadModelSpread(s, (u) => request(u, 'json', 600000)).catch(() => { /* optional */ }).then(() => { void on; });
    }
    return () => { on = false; };
  }, [key, live, ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return version;
}
