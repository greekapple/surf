import {useEffect, useRef, useState} from 'react';
import {globeCached, loadGlobeAt, spatialSpec, type SpatialFrame} from '../map/spatial';
import {nearestFrame, saveFrame} from '../map/frameStore';
import type {MapLayer, MapVariable} from '../map/types';

/** Worldwide 2° frame for the same field and hour as the regional grid (display context when zoomed out). */
export function useGlobe(layer: MapLayer, variable: MapVariable, time: string | null, enabled: boolean) {
  const spec = spatialSpec(layer, variable, time, false), key = spec ? JSON.stringify(spec) + '|' + (time ?? '') : ''; // the HOUR is part of the key: between two model steps the frame is a blend (loadGlobeAt)
  const [r, setR] = useState<{key: string; frame: SpatialFrame | null; failed?: boolean}>({key: '', frame: null});
  const firstPaint = useRef(true); // the cache is offered only as the first picture of this map, never while scrubbing hours
  useEffect(() => {
    if (!enabled || !spec) return;
    const c = new AbortController();
    if (firstPaint.current) { firstPaint.current = false; void nearestFrame('globe', spec, time).then((cf) => { if (cf && !c.signal.aborted) setR((p) => (p.key === key && !p.frame?.cached && p.frame ? p : {key, frame: cf})); }); } // the stored picture, labelled by the consumer with its own time; `loading` stays true until the network answers
    const timer = setTimeout(() => { loadGlobeAt(spec, time, c.signal).then((frame) => { if (!c.signal.aborted) { setR({key, frame}); saveFrame('globe', spec, frame); } }).catch(() => { if (!c.signal.aborted) setR((p) => (p.key === key && p.frame?.cached ? {key, frame: p.frame, failed: true} : {key, frame: null})); }); }, spec && (globeCached(spec, time) || !r.key) ? 0 : 250); // no debounce for the very first frame: the network answer starts at mount // frames already in memory (prefetched) are used at once while playing
    return () => { clearTimeout(timer); c.abort(); };
  }, [key, enabled]); // eslint-disable-line react-hooks/exhaustive-deps
  return {frame: enabled && r.key === key ? r.frame : null, loading: enabled && !!spec && (r.key !== key || (!!r.frame?.cached && !r.failed))};
}
