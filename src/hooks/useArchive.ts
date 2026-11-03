import {useEffect} from 'react';
import type {Forecast} from '../models/index';
import type {OceanBundle} from '../ocean/types';
import {archiveHours} from '../services/forecastArchive';

/** Archives the viewed spot's forecast hours (T-064) once data is loaded and whenever the spot changes. Throttled inside the service; storage failures are silent. */
export function useArchive(spotId: string, records: Forecast[], bundle: OceanBundle | null | undefined, live: boolean) {
  useEffect(() => {
    if (!live || !bundle || !records.length) return;
    try { archiveHours(spotId, records, bundle, Date.now()); } catch { /* the archive is best-effort */ }
  }, [spotId, records, bundle, live]);
}
