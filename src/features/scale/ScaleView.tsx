import {useEffect, useRef, useState} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {StateMessage} from '../../ui/common';
import {timeLabelPT} from '../forecast/format';
import {FT, SURFER_M, WaveScene, type Mode, type View} from './scene';

const VIEWS: [Exclude<View, 'free'>, string][] = [['front', 'Front'], ['profile', 'Profile'], ['above', 'Above']];

function Viewer({go}: {go: ViewProps['go']}) {
  const {prefs, setPrefs, data, view, spot} = useSwello();
  const rec = view.mapRecords.find((r) => r.spotId === spot.id && r.timestamp === view.selectedTime);
  const hs = rec && Number.isFinite(rec.offshore) ? Math.max(2, Math.min(20, Math.round(rec.offshore * 2) / 2)) : null;
  const stage = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), faceTag = useRef<HTMLSpanElement>(null), personTag = useRef<HTMLSpanElement>(null);
  const sc = useRef<WaveScene | null>(null);
  const [ft, setFt] = useState(hs ?? prefs.scaleFt);
  const [mode, setMode] = useState<Mode>(prefs.scaleMode);
  const [camView, setCamView] = useState<View>('front');
  const [unit, setUnit] = useState<'ft' | 'm'>(data.state.profile.heightUnit === 'm' ? 'm' : 'ft');
  const [failed, setFailed] = useState(false);
  const f = view.forecast, supplied = f.availability.face && Number.isFinite(f.face) ? Math.round(f.face * 2) / 2 : null;

  useEffect(() => {
    let s: WaveScene;
    try {
      s = new WaveScene(stage.current!, canvas.current!, {face: faceTag.current!, person: personTag.current!}, {ft, mode, view: 'front'});
    } catch {
      setFailed(true);
      return;
    }
    s.unit = unit;
    s.onFree = () => setCamView('free');
    sc.current = s;
    return () => { s.dispose(); sc.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow the selected spot and hour: re-open at that spot's offshore Hs whenever either changes.
  useEffect(() => { if (hs !== null) { setFt(hs); sc.current?.set({ft: hs}); } }, [hs, spot.id]);
  const setHeight = (v: number) => { const x = Math.max(2, Math.min(20, v)); setFt(x); sc.current?.set({ft: x}); setPrefs({scaleFt: x}); };
  const pickMode = (m: Mode) => { setMode(m); sc.current?.set({mode: m}); setPrefs({scaleMode: m}); };
  const pickView = (v: Exclude<View, 'free'>) => { setCamView(v); sc.current?.goTo(v); };
  const pickUnit = (u: 'ft' | 'm') => { setUnit(u); if (sc.current) { sc.current.unit = u; sc.current.set({}); } };
  const reset = () => { setHeight(supplied ?? 6); pickView('front'); };
  const backToForecast = () => { if (hs !== null) { setFt(hs); sc.current?.set({ft: hs}); pickView('front'); } };
  const m = ft * FT, ratio = m / SURFER_M;
  const fmt = (x: number) => (unit === 'm' ? `${(x * FT).toFixed(1)} m` : `${Number.isInteger(x) ? x : x.toFixed(1)} ft`);

  if (failed) return <StateMessage title="3D needs WebGL">This browser could not start WebGL. Wave Comparison shows the same scale in 2D.</StateMessage>;
  return (
    <div className="scale-wrap">
      <div className="stage3d on-dark" ref={stage} tabIndex={0} aria-label={`3D wave scale: ${fmt(ft)} face, ${ratio.toFixed(1)} times surfer height. Drag to orbit, scroll to zoom, arrow up and down change height.`}
        onKeyDown={(e) => { const step = ({ArrowUp: 0.5, ArrowDown: -0.5} as Record<string, number>)[e.key]; if (step) { e.preventDefault(); setHeight(ft + step); } }}>
        <canvas ref={canvas} />
        <div className="views" role="group" aria-label="Camera">
          {VIEWS.map(([v, l]) => <button key={v} aria-pressed={camView === v} onClick={() => pickView(v)}>{l}</button>)}
        </div>
        <span className="tag3d" ref={faceTag} aria-hidden="true" /><span className="tag3d" ref={personTag} aria-hidden="true" />
      </div>
      <aside className="side">
        <section className="card" aria-label="Wave scale controls">
          <p className="fine">Breaking-wave face, trough to crest</p>
          <p className="num" style={{fontSize: 56}}>{unit === 'm' ? m.toFixed(1) : ft}<small>{unit} face</small></p>
          <p>{ratio < 1 ? <>Face is <b>{Math.round(ratio * 100)}%</b> of the surfer's standing height</> : <>Face is <b>{ratio.toFixed(1)}×</b> the surfer's standing height</>}</p>
          <label className="field" style={{marginTop: 12}}><span>Face height</span>
            <input type="range" min={2} max={20} step={0.5} value={ft} onChange={(e) => setHeight(Number(e.target.value))} aria-valuetext={`${fmt(ft)} face`} /></label>
          <div style={{display: 'grid', gap: 8, marginTop: 12}}>
            <div className="seg" role="radiogroup" aria-label="Surfer">{(['ride', 'paddle'] as Mode[]).map((x) => <button key={x} role="radio" aria-checked={mode === x} onClick={() => pickMode(x)}>{x === 'ride' ? 'Riding' : 'Paddling'}</button>)}</div>
            <div className="seg" role="radiogroup" aria-label="Units">{(['ft', 'm'] as const).map((x) => <button key={x} role="radio" aria-checked={unit === x} onClick={() => pickUnit(x)}>{x === 'ft' ? 'Feet' : 'Metres'}</button>)}</div>
            <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
              <button className="btn" onClick={reset}>Reset</button>
              {hs !== null && <button className="btn" onClick={backToForecast} disabled={ft === hs}>Reset to forecast height</button>}
              <button className="btn primary" onClick={() => go('forecast')}>Back to {spot.name} forecast</button>
              {supplied !== null && <button className="btn" onClick={() => setHeight(supplied)}>Use demo face {supplied} ft</button>}
            </div>
          </div>
        </section>
        <section className="card">
          {hs !== null ? <p><span className="chip ill">Illustrative</span> Opened at the offshore wave height for {spot.name}: <b>{fmt(Math.round(rec!.offshore * 10) / 10)}</b> at {view.selectedTime ? timeLabelPT(view.selectedTime) : 'the selected hour'} (the 3D wave uses the nearest half foot). Breaking-wave faces at the beach can differ; no calibrated surf-height estimate exists.</p>
          : <p><span className="chip ill">Illustrative</span> {supplied !== null ? 'The demonstration week supplies a face estimate.' : 'Live data has no breaking-wave estimate for these spots, so this viewer is not tied to the forecast.'}</p>}
          <p className="fine" style={{marginTop: 8}}>Surfer 1.78 m (5′10″) on a 6′0″ board. The wave is a generic peeling peak, not a specific break; small sizes spill rather than curl.</p>
        </section>
      </aside>
    </div>
  );
}

const SIZES = [2, 3, 4, 6, 8, 10, 12, 15, 20];
/** 2D side-by-side heights with the same surfer for every size. */
function Comparison() {
  const {data} = useSwello();
  const m = data.state.profile.heightUnit === 'm';
  const [pick, setPick] = useState<number[]>([3, 6, 10, 15]);
  const PX = 13, BASE = 300, COL = 150, n = Math.max(1, pick.length);
  const label = (s: number) => (m ? `${(s * FT).toFixed(1)} m` : `${s} ft`);
  return (
    <section className="card span-12" aria-label="Wave comparison">
      <div className="card-h"><h2>Wave comparison</h2><span>face heights against the same 5′10″ surfer</span></div>
      <div className="seg" role="group" aria-label="Sizes to compare" style={{flexWrap: 'wrap', marginBottom: 12}}>
        {SIZES.map((s) => <button key={s} aria-pressed={pick.includes(s)} onClick={() => setPick(pick.includes(s) ? pick.filter((x) => x !== s) : [...pick, s].sort((a, b) => a - b))}>{label(s)}</button>)}
      </div>
      <div style={{overflowX: 'auto'}}>
        <svg viewBox={`0 0 ${n * COL} 320`} style={{width: '100%', minWidth: Math.min(560, n * COL), height: 'auto', display: 'block'}} role="img" aria-label={`Wave faces of ${pick.map(label).join(', ')} beside a surfer`}>
          <line x1={0} x2={n * COL} y1={BASE} y2={BASE} stroke="var(--ch-div)" />
          {pick.map((s, k) => {
            const H = s * PX, P = 5.83 * PX;
            return <g key={s} transform={`translate(${k * COL},0)`}>
              <path d={`M8,${BASE} C40,${BASE} 60,${BASE - H * 0.4} 82,${BASE - H} C100,${BASE - H} 112,${BASE - H * 0.7} 104,${BASE - H * 0.55} C122,${BASE - H * 0.4} 132,${BASE - H * 0.12} 142,${BASE} Z`} fill="var(--hs-hi)" fillOpacity={0.3} stroke="var(--hs-hi)" strokeWidth={1.4} />
              <g transform={`translate(40,${BASE})`} fill="var(--text)"><rect x={-4} y={-P * 0.52} width={8} height={P * 0.52} rx={4} /><rect x={-6} y={-P * 0.86} width={12} height={P * 0.38} rx={6} /><circle cy={-P * 0.93} r={P * 0.075} /></g>
              <text x={75} y={Math.max(14, BASE - H - 8)} fontSize={13} fontWeight={600} fill="var(--text)" textAnchor="middle">{label(s)}</text>
              <text x={75} y={BASE + 16} fontSize={11} fill="var(--muted)" textAnchor="middle">{((s * FT) / SURFER_M).toFixed(1)}× surfer</text>
            </g>;
          })}
        </svg>
      </div>
      <p className="fine">Face height is trough to crest of a breaking wave. It is not offshore significant wave height, which is what forecast models report.</p>
    </section>
  );
}

export function ScaleView({section, go}: ViewProps) {
  return <div className="grid">{section === 'compare' ? <Comparison /> : <><div className="span-12"><Viewer go={go} /></div><Comparison /></>}</div>;
}
