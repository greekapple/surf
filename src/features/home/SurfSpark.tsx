import type {Forecast} from '../../models/index';
import type {OceanBundle} from '../../ocean/types';
import {headlineSurf} from '../../services/headlineSurf';
import {monotonePath} from '../forecast/helpers';
import {ht} from '../forecast/helpers';
import type {UserProfile} from '../../models/index';

/** T-119: the 7-day surf-height points for a spot card: the middle of the hour's surf estimate every 3 hours from now (offshore-only and missing
 *  hours are gaps, never surf). Pure enough to test; the same headline the card's number uses. */
export function sparkPoints(spotId: string, records: Forecast[], nowMs: number, bundle: Pick<OceanBundle, 'nearshore' | 'mop'> | null | undefined): {t: number; ft: number | null}[] {
  const from = Math.floor(nowMs / 36e5) * 36e5;
  return records.filter((f) => f.spotId === spotId && Date.parse(f.timestamp) >= from && Date.parse(f.timestamp) < from + 7 * 864e5)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp)).filter((_, i) => i % 3 === 0)
    .map((f) => { const h = headlineSurf(spotId, f, {bundle, nowMs}); return {t: Date.parse(f.timestamp), ft: h.kind === 'estimate' ? (h.loFt + h.hiFt) / 2 : null}; });
}

/** A small undulating line of the next 7 days' surf estimate (Surfline-style), a soft fill under it and a dot at now. */
export function SurfSpark({points, p}: {points: {t: number; ft: number | null}[]; p: UserProfile}) {
  const W = 120, H = 52, D = 40 /* drawing height; the caption runs under it */, vals = points.map((x) => x.ft).filter((v): v is number => v !== null);
  if (vals.length < 2) return null;
  const top = Math.max(2, ...vals) * 1.15, x = (i: number) => 2 + (i / Math.max(1, points.length - 1)) * (W - 4), y = (v: number) => D - 2 - (v / top) * (D - 6);
  const runs: [number, number][][] = []; let cur: [number, number][] = [];
  points.forEach((pt, i) => { if (pt.ft !== null) cur.push([x(i), y(pt.ft)]); else if (cur.length) { runs.push(cur); cur = []; } }); if (cur.length) runs.push(cur);
  const lo = Math.min(...vals), hi = Math.max(...vals), first = points.find((q) => q.ft !== null)!;
  const label = `Surf estimate over the next 7 days, middle of the range from about ${ht(lo, p, 0)} to ${ht(hi, p, 0)} ${p.heightUnit}`;
  return (
    <svg className="dc-spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
      {runs.map((r) => r.length > 1 && <g key={r[0][0]}>
        <path className="dc-spark-a" d={`${monotonePath(r)} L${r[r.length - 1][0].toFixed(1)},${D} L${r[0][0].toFixed(1)},${D}Z`} />
        <path className="dc-spark-l" d={monotonePath(r)} />
      </g>)}
      <circle className="dc-spark-now" cx={x(points.indexOf(first))} cy={y(first.ft!)} r={2.6} />
      <text className="dc-spark-t" x={2} y={H - 1}>now</text><text className="dc-spark-t" x={W - 2} y={H - 1} textAnchor="end">+7 days</text>
    </svg>
  );
}
