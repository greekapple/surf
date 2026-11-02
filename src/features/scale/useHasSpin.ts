import {useEffect, useState} from 'react';
import {posterPath} from '../../services/scaleFrames';
import type {ScaleBand} from '../../services/waveScale';

/** Whether 3D frames exist for a band: its poster.jpg must load as an image (a missing file is a 404 or an HTML fallback, both fail). Cached per session. */
const known = new Map<string, boolean>();
export function useHasSpin(band: Pick<ScaleBand, 'id'>, enabled = true): boolean {
  const [, bump] = useState(0), url = posterPath(band);
  useEffect(() => {
    if (!enabled || known.has(url)) return;
    let live = true; const im = new Image();
    im.onload = () => { known.set(url, true); if (live) bump((x) => x + 1); };
    im.onerror = () => { known.set(url, false); if (live) bump((x) => x + 1); };
    im.src = url; return () => { live = false; };
  }, [url, enabled]);
  return enabled && known.get(url) === true;
}
