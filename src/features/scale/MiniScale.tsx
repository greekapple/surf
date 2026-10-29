import {useEffect, useState} from 'react';
import type {Forecast} from '../../models/index';
import {useSwello} from '../../app/store';

const PX = 9, BASE = 132; // 1 ft = 9 px in this compact elevation
const wave = (H: number) => `M0,${BASE} C110,${BASE} 160,${BASE} 190,${BASE - H * 0.12} C220,${BASE - H * 0.5} 245,${BASE - H * 0.96} 282,${BASE - H} C315,${BASE - H * 1.02} 335,${BASE - H * 0.8} 330,${BASE - H * 0.6} C350,${BASE - H * 0.72} 390,${BASE - H * 0.42} 420,${BASE - H * 0.3} L420,150 L0,150Z`;

/** Compact surfer-to-wave elevation. Uses a breaking-face value only when the data supplies one. */
export function MiniScale({forecast}: {forecast: Forecast}) {
  const {prefs, setPrefs, data} = useSwello();
  const supplied = forecast.availability.face && Number.isFinite(forecast.face) ? Math.round(forecast.face * 2) / 2 : null;
  const [ft, setFt] = useState(supplied ?? prefs.scaleFt);
  useEffect(() => { if (supplied !== null) setFt(supplied); }, [supplied]);
  const H = ft * PX, m = data.state.profile.heightUnit === 'm';
  return (
    <div className="mini-scale">
      <svg viewBox="0 0 420 150" role="img" aria-label={`${ft} foot wave face next to a 5 foot 10 surfer`}>
        <line x1={0} x2={420} y1={BASE} y2={BASE} stroke="var(--ch-div)" strokeDasharray="3 3" />
        <path d={wave(H)} fill="var(--hs-hi)" fillOpacity={0.3} stroke="var(--hs-hi)" strokeWidth={1.5} style={{transition: 'd 320ms cubic-bezier(.2,.8,.2,1)'}} />
        <g transform={`translate(${216 + H * 0.03},${BASE - H * 0.42}) rotate(-22)`} stroke="var(--text)" strokeWidth={3.4} strokeLinecap="round" fill="none">
          <path d="M-7,-3 L-4,-17 L-1,-27 M7,-3 L4,-15 L2,-27 M0,-27 L-1,-41 M-1,-38 L-13,-34 M-1,-38 L11,-44" />
          <circle cx={-3} cy={-47} r={4.3} fill="var(--text)" stroke="none" /><rect x={-27} y={-3} width={54} height={3} rx={1.5} fill="var(--fair)" stroke="none" />
        </g>
        <line x1={395} x2={395} y1={BASE} y2={BASE - H} stroke="var(--text)" /><text x={390} y={BASE - H - 5} fontSize={11} fill="var(--text)" textAnchor="end" fontWeight={600}>{m ? `${(ft * 0.3048).toFixed(1)} m` : `${ft} ft`} face</text>
      </svg>
      <label className="sr-only" htmlFor="mini-face">Wave face height</label>
      <input id="mini-face" type="range" min={2} max={20} step={0.5} value={ft} disabled={supplied !== null}
        onChange={(e) => { const v = Number(e.target.value); setFt(v); setPrefs({scaleFt: v}); }} />
      <p className="fine">{supplied !== null ? <span className="chip demo">Demonstration face estimate</span> : <span className="chip ill">Illustrative</span>} {supplied !== null ? 'from the demonstration week.' : 'No breaking-wave estimate exists for this spot, so the scale is not tied to the forecast. Drag to explore sizes.'} Surfer 5′10″.</p>
    </div>
  );
}
