import {useState} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {timeLabelPT} from '../forecast/format';
import {WaveBands} from './WaveBands';

const FT = 0.3048, SURFER_M = 1.78; // metres per foot; the 5′10″ surfer used by the 2D comparison

/** Wave Scale page (T-033): the AI illustration of the band that contains the selected hour's height, with all eight bands to browse. */
function Page({go, onSpin}: {go: ViewProps['go']; onSpin: (has: boolean) => void}) {
  const {view, spot} = useSwello();
  return (
    <section className="scale-page" aria-label="Wave scale">
      <div className="scale-head"><h1>Wave scale</h1><span className="fine">{spot.name}{view.selectedTime ? ` · ${timeLabelPT(view.selectedTime)}` : ''}</span></div>
      <WaveBands forecast={view.forecast} onSpin={onSpin} />
      <div><button className="btn primary" onClick={() => go('forecast')}>Back to {spot.name} forecast</button></div>
    </section>
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
        <svg viewBox={`0 0 ${n * COL} 320`} style={{width: '100%', minWidth: Math.min(560, n * COL), height: 'auto', maxHeight: 300, display: 'block'}} preserveAspectRatio="xMidYMax meet" role="img" aria-label={`Wave faces of ${pick.map(label).join(', ')} beside a surfer`}>
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
  // When 3D frames exist for the shown band the 2D blob comparison and the AI photo are replaced by the spin viewer (T-044).
  const [spin, setSpin] = useState(false);
  return <div className="grid">{section === 'compare' ? <Comparison /> : <><div className="span-12"><Page go={go} onSpin={setSpin} /></div>{!spin && <Comparison />}</>}</div>;
}
