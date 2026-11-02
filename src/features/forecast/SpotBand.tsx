import {useEffect, useState, type ReactNode} from 'react';
import {SpotPhoto} from '../../ui/common';
import {SPOT_PHOTOS} from '../../ui/photos';
import {evidenceSpots} from '../../ocean/spots';

type Ring = [number, number][];
let coast: Promise<Ring[]> | null = null;
/** Natural Earth 10 m land (public domain), clipped to California; loaded once, only for spots without a photo. */
const loadCoast = () => (coast ??= import('../../map/coast.json').then((m) => (m.default as unknown as {rings: Ring[]}).rings));

/** T-050 slim header band: the spot's own credited photograph, or a plan drawn from real coastline geometry when it has none.
 *  The page heading and controls sit over a soft scrim. Nothing is decorative stock or AI. */
export function SpotBand({spotId, children}: {spotId: string; children: ReactNode}) {
  const photo = !!SPOT_PHOTOS[spotId]?.length;
  return (
    <header className={`sp-band ${photo ? 'is-photo' : 'is-plan'}`}>
      {photo ? <SpotPhoto spotId={spotId} className="sp-band-img" /> : <SpotPlan spotId={spotId} />}
      <div className="sp-band-in">{children}</div>
    </header>
  );
}

/** A plan of the coast around the spot: land, sea, the spot, north; the shore normal only where it has been surveyed. */
function SpotPlan({spotId}: {spotId: string}) {
  const e = evidenceSpots.find((x) => x.id === spotId);
  const [rings, setRings] = useState<Ring[] | null>(null);
  useEffect(() => { let on = true; loadCoast().then((r) => on && setRings(r)).catch(() => on && setRings([])); return () => { on = false; }; }, []);
  if (!e) return <div className="sp-plan" aria-hidden="true" />;
  // Equirectangular around the spot; ±0.11° of latitude fills the band height, the width follows the viewBox.
  const W = 1200, H = 220, k = Math.cos((e.latitude * Math.PI) / 180), span = 0.11, s = H / (2 * span);
  const X = (lon: number) => W * 0.62 + (lon - e.longitude) * k * s, Y = (lat: number) => H / 2 - (lat - e.latitude) * s;
  const near = (rings ?? []).filter((r) => r.some(([lo, la]) => Math.abs(la - e.latitude) < 0.6 && Math.abs(lo - e.longitude) < 0.9));
  const d = near.map((r) => `M${r.map(([lo, la]) => `${X(lo).toFixed(1)},${Y(la).toFixed(1)}`).join('L')}Z`).join('');
  const sx = X(e.longitude), sy = Y(e.latitude), o = e.orientation;
  return (
    <figure className="sp-plan">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={`Plan of the coast around ${e.name}${o !== null ? `; the beach faces ${Math.round(o)}°` : ''}`}>
        <rect width={W} height={H} fill="var(--plan-sea, #cfe3ef)" />
        {Array.from({length: 7}, (_, i) => <path key={i} d={`M0 ${30 + i * 28} Q ${W / 4} ${22 + i * 28} ${W / 2} ${30 + i * 28} T ${W} ${30 + i * 28}`} fill="none" stroke="var(--plan-swell, #b9d5e6)" strokeWidth={1} />)}
        <path d={d} fill="var(--plan-land, #ece4d3)" stroke="var(--plan-shore, #b9a684)" strokeWidth={1.4} fillRule="evenodd" />
        {o !== null && <g transform={`translate(${sx} ${sy}) rotate(${o})`}><line x1={0} y1={0} x2={0} y2={-46} stroke="var(--accent)" strokeWidth={2} strokeDasharray="4 3" /><path d="M-5 -40 L0 -50 L5 -40" fill="none" stroke="var(--accent)" strokeWidth={2} /></g>}
        <circle cx={sx} cy={sy} r={7} fill="#fff" stroke="var(--text)" strokeWidth={2} /><circle cx={sx} cy={sy} r={2.5} fill="var(--text)" />
        <g transform={`translate(${W - 40} ${H / 2 - 6})`} fill="var(--muted)"><path d="M0 -14 L6 6 L0 2 L-6 6Z" /><text y={22} fontSize={12} textAnchor="middle">N</text></g>
      </svg>
      <figcaption className="credit">Coastline: Natural Earth 10 m (public domain), approximate{o !== null ? ` · dashed arrow: surveyed shore normal ${Math.round(o)}°` : ''}</figcaption>
    </figure>
  );
}
