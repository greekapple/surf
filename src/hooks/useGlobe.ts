import {useEffect, useState} from 'react';
import {loadGlobe, spatialSpec, type SpatialFrame} from '../map/spatial';
import type {MapLayer, MapVariable} from '../map/types';

/** Worldwide 2° frame for the same field and hour as the regional grid (display context when zoomed out). */
export function useGlobe(layer: MapLayer, variable: MapVariable, time: string | null, enabled: boolean) {
  const spec = spatialSpec(layer, variable, time, false), key = spec ? JSON.stringify(spec) : '';
  const [r, setR] = useState<{key: string; frame: SpatialFrame | null}>({key: '', frame: null});
  useEffect(() => {
    if (!enabled || !spec) return;
    const c = new AbortController();
    const timer = setTimeout(() => { loadGlobe(spec, c.signal).then((frame) => { if (!c.signal.aborted) setR({key, frame}); }).catch(() => { if (!c.signal.aborted) setR({key, frame: null}); }); }, 250);
    return () => { clearTimeout(timer); c.abort(); };
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return {frame: enabled && r.key === key ? r.frame : null, loading: enabled && !!spec && r.key !== key};
}
