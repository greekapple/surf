/** Where the forecast data is (T-055): 'loading' until a retrieval has either produced data or actually failed, so a surface never says
 *  "No forecast data", "none" or "No good daylight window left" while it is still waiting.
 *  The ocean hook starts with loading=false and no error for one render before its effect runs, so "no bundle, no error" is still loading. */
export type DataPhase = 'loading' | 'ready' | 'failed';
export function dataPhase(o: {loading?: boolean; bundle?: unknown; error?: string | null}, live = true): DataPhase {
  if (!live) return 'ready'; // demonstration data is local
  if (o.bundle) return 'ready';
  if (o.loading) return 'loading';
  return o.error ? 'failed' : 'loading';
}
