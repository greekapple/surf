import {useEffect, useState} from 'react';
import {getMopIssue, loadMopIssue, subscribeMopIssue, syncMopIssueEpoch, type MopIssueInfo} from '../ocean/mopIssue';

/** The MOP file's issue time for one point, fetched when a surface that shows it mounts (T-097). Null until requested. */
export function useMopIssue(mopId: string | null | undefined, bundleKey?: string | null): MopIssueInfo | null {
  const [, setV] = useState(0);
  syncMopIssueEpoch(bundleKey); // a refreshed forecast bundle invalidates every cached issue time (T-100)
  useEffect(() => subscribeMopIssue(() => setV((v) => v + 1)), []);
  useEffect(() => { if (mopId) void loadMopIssue(mopId); }, [mopId, bundleKey]);
  return getMopIssue(mopId);
}
