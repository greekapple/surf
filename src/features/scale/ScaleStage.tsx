import {lazy, Suspense, useEffect, useMemo, useRef, useState} from 'react';
import type {Surfboard} from '../../models/index';
import {useSwello} from '../../app/store';
import {Media} from '../../ui/Media';
import {pacificDate} from '../../ocean/time';
import {headlineSurf, headlineText} from '../../services/headlineSurf';
import {bodyWords, BODY_WORDS_NOTE} from '../../services/bodyWords';
import {formatHeight, userHeight} from '../../services/heightMath';
import {axisTicks, axisTop, bandRange, bodyTicks, faceRange, lerp, timesYourHeight, wavePath, yFor} from '../../services/scaleMath';
import {SCALE_BANDS} from '../../services/waveScale';
import {framePaths, posterPath, spinCaption} from '../../services/scaleFrames';
import {timeLabelPT, weekdayPT} from '../forecast/format';
import {feetInches} from '../forecast/SpotPage';
import {Spin360} from './Spin360';
import {hasWebGL} from './webgl';
import {lightingAt} from './solar';
import {breakerType} from '../../services/breaker';
import {windOf} from '../../services/spotHour';
import {LIVE_CAPTION, type WaveSpec} from './waveSpec';
import {defaultPeel, PEEL_NOTE, peelDirectionFor} from './peelDirection';
const WaveLive = lazy(() => import('./WaveLive'));
import {useHasSpin} from './useHasSpin';

const BOARD_KEY = 'swello-scale-board';
const W = 600, BASE = 330, H = 292, X0 = 24, X1 = 104, WAVE_X = 70, WAVE_K = 2.6;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const dayKey = (iso: string) => pacificDate(iso);

/** Animates a number toward its target (200–450 ms), or jumps there under reduced motion (or when `jump` is set). */
function useTween(target: number, ms = 420, jump = false): number {
  const [v, setV] = useState(target), from = useRef(target), raf = useRef(0);
  useEffect(() => {
    if (jump || reduced() || !Number.isFinite(target)) { setV(target); from.current = target; return; }
    const a = from.current, t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 3; const x = lerp(a, target, e); setV(x); from.current = x; if (k < 1) raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step); return () => cancelAnimationFrame(raf.current);
  }, [target, ms, jump]);
  return v;
}

/** A number that follows its target, or null: a jump when either side is null (no wave growing out of nothing), a tween otherwise. */
function useFaceTween(target: number | null): number | null {
  const last = useRef(target), jump = target === null || last.current === null;
  useEffect(() => { last.current = target; }, [target]);
  const v = useTween(target ?? 0, 420, jump);
  return target === null ? null : jump ? target : v;
}

/** The Wave scale (T-052): a big, to-scale drawing of the hour's estimated face range beside you at your height and a board from your quiver, with body-word ticks,
 *  an hour scrubber, and (in the Diagram) a browser for the size bands. The 3D view is the hour's own forecast (face height, breaker type, period, wind, light) with a
 *  left/right control; it has no size browser. The AI picture is an optional example, never the default. Nothing here is a measurement. */
export function ScaleStage() {
  const {data, now, spot, view} = useSwello();
  const p = data.state.profile, me = userHeight(p), boards = data.state.boards, bundle = view.ocean.bundle;
  const hours = useMemo(() => {
    const sel = view.selectedTime ?? view.forecast?.timestamp, key = sel ? dayKey(sel) : null;
    return view.mapRecords.filter((f) => f.spotId === spot.id && key !== null && dayKey(f.timestamp) === key).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  }, [view.mapRecords, view.selectedTime, view.forecast, spot.id]);
  const idx = Math.max(0, hours.findIndex((f) => f.timestamp === (view.selectedTime ?? view.forecast?.timestamp)));
  const hour = hours[idx] ?? view.forecast;
  const hs = useMemo(() => (hour ? headlineSurf(spot.id, hour, {bundle, nowMs: now}) : null), [hour, spot.id, bundle, now]);
  const [band, setBand] = useState<number | null>(null);
  useEffect(() => { setBand(null); }, [spot.id, hour?.timestamp]);
  // 3D: the peel direction, defaulting to what the published guides say for this spot (both -> a left), flippable
  const peel = peelDirectionFor(spot.id), [dirPick, setDirPick] = useState<'left' | 'right' | null>(null);
  useEffect(() => { setDirPick(null); }, [spot.id]);
  const direction = dirPick ?? defaultPeel(peel);
  const [boardId, setBoardId] = useState<string>(() => { try { return localStorage.getItem(BOARD_KEY) ?? ''; } catch { return ''; } });
  const board: Surfboard | null = boards.find((b) => b.id === boardId) ?? boards[0] ?? null;
  const [photo, setPhoto] = useState(false), [play, setPlay] = useState(false);
  const range = band !== null ? bandRange(SCALE_BANDS[band]) : faceRange(hs);
  const lo = useTween(range ? range[0] : 0), hi = useTween(range ? range[1] : 0);
  const boardFt = board ? board.length / 12 : null;
  const top = axisTop([range ? range[1] : null, me.feet, boardFt]);
  const m = p.heightUnit === 'm', k = m ? 1 / 0.3048 : 1, y = (ft: number) => yFor(ft, top, BASE, H);
  const words = range ? bodyWords(range[0], range[1]) : null, times = range ? timesYourHeight(range, me.feet) : null;
  const text = hs ? headlineText(hs, p) : null;
  // the 3D wave is THIS hour's forecast: the estimate's centre (never a band), the estimated breaker type, the swell period, the wind relation
  const estRange = faceRange(hs), faceFt = estRange ? (estRange[0] + estRange[1]) / 2 : null, faceM = useFaceTween(faceFt === null ? null : faceFt * 0.3048);
  const wave = useMemo<WaveSpec>(() => {
    const bt = hour ? breakerType(spot, hour).type : 'unknown', w = hour ? windOf(spot, hour, p) : null, T = hour?.primary?.period;
    return {faceM, breaker: bt === 'spilling' || bt === 'plunging' ? bt : null, periodS: typeof T === 'number' && Number.isFinite(T) && T > 0 ? T : null,
      wind: w ? {relation: w.relation, mph: w.mph} : null, offshoreM: hs?.kind === 'offshore' ? hs.ft * 0.3048 : null, direction};
  }, [faceM, hour, spot, p, hs, direction]);
  const activeBand = band ?? (range ? Math.max(0, SCALE_BANDS.findIndex((b) => (range[0] + range[1]) / 2 >= b.lo && (range[0] + range[1]) / 2 < b.hi)) : 3);
  const faceText = faceFt === null ? null : p.heightUnit === 'm' ? `${(faceFt * 0.3048).toFixed(1)} m` : `${Math.round(faceFt * 10) / 10} ft`;
  // the 3D stage's own label: what is drawn and what it is (the estimate's centre; or offshore swell, which is not surf size)
  const liveLabel = text && estRange ? `Est. ${text.value} · drawn at ${faceText} face · surfer ${p.heightUnit === 'm' ? '1.75 m' : '5′9″'}`
    : hs?.kind === 'offshore' && text ? `No breaking-wave estimate · ${text.value} offshore swell drawn unbroken, not surf size` : 'No breaking-wave estimate for this hour · nothing drawn as surf';
  const spinOk = useHasSpin(SCALE_BANDS[activeBand]);
  // 3D is the main view when renders exist for the band (T-054); the drawn diagram stays one tap away
  const [mode, setModeRaw] = useState<'3d' | 'diagram'>('3d');
  const setMode = (m: '3d' | 'diagram') => { setModeRaw(m); if (m === '3d') setBand(null); }; // the band browser is a Diagram-only comparison
  // Real-time 3D when WebGL is available and motion is allowed (T-062); otherwise the pre-rendered spin, as before.
  const [liveFailed, setLiveFailed] = useState(false);
  const liveOk = useMemo(() => hasWebGL() && !reduced(), []) && !liveFailed;
  const show3d = (liveOk || spinOk) && mode === '3d';
  // the 3D light follows the hour (sun position at the spot); after sunset it is twilight, after dark it is kept dim but brightened to stay readable
  const phase = hour ? lightingAt(spot.id, hour.timestamp)?.phase : undefined, lightNote = phase === 'twilight' ? ' · twilight' : phase === 'night' ? ' · after dark, brightened' : '';
  // play: step through the day's hours
  useEffect(() => {
    if (!play || reduced() || hours.length < 2) { if (play && reduced()) setPlay(false); return; }
    const id = setInterval(() => { const next = (idx + 1) % hours.length; view.selectTime(hours[next].timestamp); }, 900);
    return () => clearInterval(id);
  }, [play, idx, hours, view]);
  const pickBoard = (id: string) => { setBoardId(id); try { localStorage.setItem(BOARD_KEY, id); } catch { /* per session */ } };
  const ph = (me.feet / top) * H, pw = ph * 0.3, px = 372, bx = px + pw + 26;
  const when = hour ? `${weekdayPT(hour.timestamp)} ${timeLabelPT(hour.timestamp)}` : '';
  const liveAlt = estRange ? `3D wave of this hour's estimate, ${text?.value ?? ''} ${p.heightUnit}, drawn at ${faceText} face, a ${direction}, with a 1.75 m surfer for scale` : hs?.kind === 'offshore' ? `No breaking-wave estimate; offshore swell drawn unbroken, not surf size` : 'No breaking-wave estimate for this hour';
  const alt = range ? `Estimated face ${Math.round(range[0] * k * 10) / 10} to ${Math.round(range[1] * k * 10) / 10} ${p.heightUnit} beside you at ${formatHeight(me.inches, p.heightUnit)}${board ? ` and a ${feetInches(board.length)} board` : ''}` : `No face estimate for this hour; you at ${formatHeight(me.inches, p.heightUnit)}${board ? ` and a ${feetInches(board.length)} board` : ''}`;
  return (
    <section className="sc" aria-label="Wave scale">
      <div className="sc-head">
        <div><h1>Wave scale</h1><p className="fine">{spot.name}{when ? ` · ${when}` : ''}</p></div>
        {text && <p className="sc-read" aria-live="polite">{band !== null && mode === 'diagram' ? <><b>{SCALE_BANDS[band].label}</b> band <span className="sc-tag">comparing</span></> : <><b>{text.value}</b> {words && <span title={BODY_WORDS_NOTE}>{words} ~</span>} <span className="sc-tag">{text.tag}</span></>}</p>}
      </div>

      {(spinOk || liveOk) && <div className="sc-mode" role="radiogroup" aria-label="View">
        <button type="button" role="radio" aria-checked={mode === '3d'} onClick={() => setMode('3d')}>3D</button>
        <button type="button" role="radio" aria-checked={mode === 'diagram'} onClick={() => setMode('diagram')}>Diagram</button>
      </div>}
      {show3d && <figure className="sc-spin"><div className="sc-spin-stage">
        {liveOk
          ? <Suspense fallback={<img className="live-poster-only" src={posterPath(SCALE_BANDS[activeBand])} alt="" />}>
              <WaveLive wave={wave} poster={posterPath(SCALE_BANDS[activeBand])} alt={liveAlt} onFail={() => setLiveFailed(true)} board={board} light={hour ? {spotId: spot.id, iso: hour.timestamp} : null} />
              <p className="spin-cap">{LIVE_CAPTION}</p>
              {hour && <p className="spin-light">Lighting for {when}{lightNote}</p>}
            </Suspense>
          : <Spin360 key={SCALE_BANDS[activeBand].id} frames={framePaths(SCALE_BANDS[activeBand])} poster={posterPath(SCALE_BANDS[activeBand])} alt={`${SCALE_BANDS[activeBand].label} wave with a 1.75 m surfer for scale`} still={reduced()} intro />}
        <p className="sc-spin-band">{liveOk ? liveLabel : spinCaption(SCALE_BANDS[activeBand], p.heightUnit)}</p>
      </div></figure>}
      <figure className="sc-fig" hidden={show3d}>
        <svg viewBox={`0 0 ${W} 360`} role="img" aria-label={alt} className="sc-svg">
          {axisTicks(top, p.heightUnit).map((t) => <g key={t}><line x1={40} x2={W - 96} y1={y(t / k)} y2={y(t / k)} stroke="var(--line)" strokeWidth={1} /><text x={34} y={y(t / k) + 4} fontSize={11} textAnchor="end" fill="var(--dim)">{t}</text></g>)}
          <text x={34} y={14} fontSize={11} textAnchor="end" fill="var(--dim)">{p.heightUnit}</text>
          <line x1={40} x2={W - 96} y1={BASE} y2={BASE} stroke="var(--line-2)" strokeWidth={1.4} />
          {/* body words, positioned by the convention's face heights */}
          {bodyTicks(top).map(([w, ft]) => <g key={w}><line x1={W - 96} x2={W - 90} y1={y(ft)} y2={y(ft)} stroke="var(--muted)" /><text x={W - 86} y={y(ft) + 4} fontSize={11} fill="var(--muted)">{w}</text></g>)}
          {range && [[hi, 0], [lo, 1]].map(([v, i]) => { const t = y(v as number); return (
            <path key={i as number} transform={`translate(${WAVE_X - X0 * WAVE_K} 0) scale(${WAVE_K} 1)`} vectorEffect="non-scaling-stroke" d={wavePath(X0, X1, BASE, t)} fill={i === 0 ? 'color-mix(in srgb, var(--hs-hi) 26%, transparent)' : 'color-mix(in srgb, var(--hs-hi) 55%, transparent)'} stroke={i === 0 ? 'var(--hs-hi)' : 'none'} strokeWidth={1.6} />
          ); })}
          {range && <><line x1={WAVE_X} x2={px - 14} y1={y(hi)} y2={y(hi)} stroke="var(--hs-hi)" strokeDasharray="4 4" strokeWidth={1} /><text x={WAVE_X + 4} y={y(hi) - 6} fontSize={12} fontWeight={600} fill="var(--text)">{Math.round(hi * k * 10) / 10} {p.heightUnit}</text><text x={WAVE_X + 4} y={y(lo) + 14} fontSize={12} fill="var(--text)">{Math.round(lo * k * 10) / 10} {p.heightUnit}</text></>}
          <g transform={`translate(${px} ${BASE - ph}) scale(${ph / 100})`} fill="var(--text)" opacity={0.85}>
            <circle cx={15} cy={7} r={6.4} />
            <path d="M9 15 h12 q5 1 5.5 6 l1.8 27 q.2 2.4-1.8 2.4 h-.6 q-1.2 0-1.4-1.6 l-2.2-21 v31 l-.6 41 h-5.2 l-1.2-38 h-1 l-1.2 38 h-5.2 l-.6-41 v-31 l-2.2 21 q-.2 1.6-1.4 1.6 h-.6 q-2 0-1.8-2.4 l1.8-27 q.5-5 5.5-6z" />
          </g>
          {board && boardFt && <rect x={bx} y={y(boardFt)} width={14} height={(boardFt / top) * H} rx={7} fill="var(--s3, #e8ecef)" stroke="var(--muted)" strokeWidth={1} />}
          <text x={WAVE_X + 70} y={350} fontSize={12} textAnchor="middle" fill="var(--muted)">{range ? (band !== null ? 'band, illustrative' : 'est. face') : 'no face estimate'}</text>
          <text x={px + pw / 2} y={350} fontSize={12} textAnchor="middle" fill="var(--muted)">you {formatHeight(me.inches, p.heightUnit)}</text>
          {board && boardFt && <text x={bx + 7} y={350} fontSize={12} textAnchor="middle" fill="var(--muted)">board</text>}
        </svg>
        <figcaption className="sc-cap">
          {range ? <>Drawn to scale: the outer shape is the high end, the darker inner shape the low end{times ? `; about ${times[0]}–${times[1]}× your height` : ''}.</> : <>This hour has no breaking-wave estimate{hs?.kind === 'offshore' ? ` (offshore ${text?.value} ${p.heightUnit}, not surf size)` : ''}, so only you{board ? ' and your board' : ''} are drawn. Pick a size band below to compare.</>}
          {' '}{me.isDefault ? <>You are drawn at {formatHeight(me.inches, p.heightUnit)} (default). Set your height in Personal › Surf preferences.</> : <>You are drawn at your height, {formatHeight(me.inches, p.heightUnit)}.</>} Body words are an informal convention for face height, approximate.
        </figcaption>
      </figure>

      <div className="sc-controls">
        <div className="sc-row">
          <span className="sc-l" id="sc-hour-l">Hour</span>
          <button type="button" className="btn" aria-pressed={play} onClick={() => setPlay((v) => !v)} disabled={hours.length < 2 || reduced()} title={reduced() ? 'Playback is off because reduced motion is on' : undefined}>{play ? 'Pause' : 'Play day'}</button>
          <input type="range" aria-labelledby="sc-hour-l" min={0} max={Math.max(0, hours.length - 1)} step={1} value={idx} disabled={hours.length < 2} onChange={(e) => { setPlay(false); const h = hours[Number(e.target.value)]; if (h) view.selectTime(h.timestamp); }}
            aria-valuetext={hour ? `${timeLabelPT(hour.timestamp)}${range ? `, est. ${Math.round(range[0] * k * 10) / 10} to ${Math.round(range[1] * k * 10) / 10} ${p.heightUnit}` : ', no estimate'}` : undefined} />
          <output className="sc-out">{hour ? timeLabelPT(hour.timestamp) : '—'}</output>
        </div>
        <div className="sc-row">
          <span className="sc-l" id="sc-board-l">Board</span>
          {boards.length === 0 ? <span className="fine">No boards in your quiver yet.</span> : <div className="sc-chips" role="radiogroup" aria-labelledby="sc-board-l">{boards.map((b) => <button key={b.id} type="button" role="radio" aria-checked={b.id === board?.id} onClick={() => pickBoard(b.id)}>{b.name} <small>{feetInches(b.length)}</small></button>)}</div>}
        </div>
        {show3d && liveOk && wave.faceM !== null && <div className="sc-row">
          <span className="sc-l" id="sc-dir-l">Breaks</span>
          <div className="sc-chips" role="radiogroup" aria-labelledby="sc-dir-l">
            <button type="button" role="radio" aria-checked={direction === 'left'} onClick={() => setDirPick('left')}>Left</button>
            <button type="button" role="radio" aria-checked={direction === 'right'} onClick={() => setDirPick('right')}>Right</button>
          </div>
          <span className="fine">{PEEL_NOTE[peel]}; a left breaks to the surfer's left as they ride</span>
        </div>}
        {!show3d && <div className="sc-row">
          <span className="sc-l" id="sc-band-l">Compare a size</span>
          <div className="sc-chips" role="radiogroup" aria-labelledby="sc-band-l">{SCALE_BANDS.map((b, i) => <button key={b.id} type="button" role="radio" aria-checked={band === i} onClick={() => setBand(i)}>{b.short}</button>)}</div>
          {band !== null && <button type="button" className="btn" onClick={() => setBand(null)}>Back to this hour</button>}
        </div>}
      </div>

      <div className="sc-photo">
        <button type="button" className="btn" aria-pressed={photo} aria-expanded={photo} onClick={() => setPhoto((v) => !v)}>{photo ? 'Hide example photo' : 'Show example photo (AI illustration)'}</button>
        {photo && <div className="sc-photo-stage"><Media key={SCALE_BANDS[activeBand].media} id={SCALE_BANDS[activeBand].media} className="sc-photo-media" eager sizes="(max-width: 860px) 100vw, 70vw" still /></div>}
      </div>
    </section>
  );
}
