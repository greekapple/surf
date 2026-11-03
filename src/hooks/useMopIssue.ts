import {useEffect, useState} from 'react';
import {getMopIssue, loadMopIssue, subscribeMopIssue, type MopIssueInfo} from '../ocean/mopIssue';

/** The MOP file's issue time for one point, fetched when a surface that shows it mounts (T-097). Null until requested. */
export function useMopIssue(mopId: string | null | undefined): MopIssueInfo | null {
  const [, setV] = useState(0);
  useEffect(() => subscribeMopIssue(() => setV((v) => v + 1)), []);
  useEffect(() => { if (mopId) void loadMopIssue(mopId); }, [mopId]);
  return getMopIssue(mopId);
}
