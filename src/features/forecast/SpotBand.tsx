import {useCallback, useEffect, useState, type ReactNode} from 'react';
import type {Figure} from '../../ui/PersonShape';
import {SpotPhoto} from '../../ui/common';
import {SPOT_PHOTOS} from '../../ui/photos';
import {evidenceSpots} from '../../ocean/spots';
import {spotMediaFor} from '../home/heroMedia';
import {DRAWN_CAPTION, WaveGlyph} from '../../ui/WaveGlyph';
import type {Glyph} from '../../services/waveGlyph';
import {heroCamFor} from '../../ocean/hdontapCams';
import {HdontapHero} from './HdontapSnaps';

type Ring = [number, number][];
let coast: Promise<Ring[]> | null = null;
/** Natural Earth 10 m land (public domain), clipped to California; loaded once, only for spots without a photo. */
const loadCoast = () => (coast ??= import('../../map/coast.json').then((m) => (m.default as unknown as {rings: Ring[]}).rings));

/** T-050 slim header band. T-111: its media slot, in order (heroMedia.spotMediaFor): a SWELLO live cam (none yet), the spot's credited photograph,
 *  the selected hour's wave drawn to scale beside you, or a plan from real coastline geometry. The heading and controls sit over a soft scrim; the
 *  band keeps one height whatever it shows (no layout jump). Nothing is decorative stock or AI. */
export function SpotBand({spotId, zone, glyph, personIn = 70, unit = 'ft', figure = 'standard', children}: {spotId: string; zone: string; glyph?: Glyph | null; personIn?: number; unit?: 'ft' | 'm'; figure?: Figure; children: ReactNode}) {
  const [camFailed, setCamFailed] = useState(false);
  // cam-hero: a spot with a header camera (hdontapCams.ts `hero`) shows HDOnTap's snapshot once its first picture has loaded; until then, and for good if it fails, the band
  // shows what it would without it (drawn wave, photo or plan): never an empty box.
  const hero = heroCamFor(spotId), [heroState, setHeroState] = useState<'wait' | 'on' | 'off'>('wait');
  useEffect(() => { setHeroState('wait'); }, [spotId]);
  const heroReady = useCallback(() => setHeroState((s) => (s === 'off' ? s : 'on')), []), heroFail = useCallback(() => setHeroState('off'), []);
  const heroOn = !!hero && heroState === 'on';
  const m = camFailed ? {kind: SPOT_PHOTOS[spotId]?.length ? 'photo' as const : glyph ? 'drawn' as const : 'plan' as const} : spotMediaFor(spotId, {photo: !!SPOT_PHOTOS[spotId]?.length, drawn: !!glyph});
  const photoLike = !heroOn && (m.kind === 'photo' || m.kind === 'cam');
  // cam-hero-2 (user, 2026-11-13: "it shouldn't be overlay"): with the camera on, the header is a plain row (page background, normal text, no scrim) and the picture is
  // its own block directly under it, with nothing on top of it. Before it loads, and if it fails, the band is the usual drawn header.
  return (
    <>
      <header className={`sp-band ${heroOn ? 'is-plain' : photoLike ? 'is-photo' : 'is-plan'}${!heroOn && m.kind === 'drawn' ? ' is-drawn' : ''}`}>
        {heroOn ? null
          : m.kind === 'cam' ? <figure className="photo sp-band-cam"><video src={m.cam.src} muted autoPlay playsInline loop onError={() => setCamFailed(true)} aria-label={`${m.cam.label}, live view`} /><figcaption className="credit">{m.cam.label}</figcaption></figure>
          : m.kind === 'photo' ? <SpotPhoto spotId={spotId} className="sp-band-img" />
          : m.kind === 'drawn' && glyph ? <figure className="sp-drawn"><WaveGlyph glyph={glyph} size="lg" personIn={personIn} unit={unit} figure={figure} /><figcaption className="credit">{DRAWN_CAPTION}</figcaption></figure>
          : <SpotPlan spotId={spotId} />}
        <div className="sp-band-in">{children}</div>
      </header>
      {hero && heroState !== 'off' && <HdontapHero cam={hero} zone={zone} hidden={!heroOn} onReady={heroReady} onFail={heroFail} />}
    </>
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
      <figcaption className="credit"><span className="cr-long">Coastline: Natural Earth 10 m (public domain), approximate{o !== null ? ` · dashed arrow: surveyed shore normal ${Math.round(o)}°` : ''}</span><span className="cr-short" aria-hidden="true">Natural Earth coast, approx.</span></figcaption>
    </figure>
  );
}
