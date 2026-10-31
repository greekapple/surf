import {useEffect, useState} from 'react';
import type {Forecast} from '../../models/index';
import {useSwello} from '../../app/store';
import {Media, useMediaEntry, useNarrow} from '../../ui/Media';
import {SCALE_BANDS, selectScaleBand} from '../../services/waveScale';
import {faceEstimateView} from '../forecast/estimate';
import {ht} from '../forecast/helpers';
import './scale.css';

const DEFAULT_BAND = 3; // 4–6 ft, only shown (and labelled as not tied to the forecast) when the hour has no height at all

/** The wave-scale picture (T-033): the AI illustration of the band that contains the selected hour's height, labelled with where that height comes from, plus a way to browse all eight bands. */
export function WaveBands({forecast, compact, onOpen}: {forecast: Forecast; compact?: boolean; onOpen?: () => void}) {
  const {data} = useSwello();
  const profile = data.state.profile, narrow = useNarrow(), [browsed, setBrowsed] = useState<number | null>(null), [loop, setLoop] = useState(false);
  const est = faceEstimateView(forecast, profile);
  const sel = selectScaleBand({
    estimateRangeFt: est?.state === 'range' ? est.rangeFt : null, estimateText: est?.state === 'range' ? est.text : null,
    demoFaceFt: forecast.availability.face && Number.isFinite(forecast.face) ? forecast.face : null, demoText: forecast.availability.face && Number.isFinite(forecast.face) ? `${ht(forecast.face, profile)} ${profile.heightUnit}` : null,
    offshoreFt: Number.isFinite(forecast.offshore) ? forecast.offshore : null, offshoreText: Number.isFinite(forecast.offshore) ? `${ht(forecast.offshore, profile)} ${profile.heightUnit}` : null,
  });
  // A new hour or spot returns to its own band.
  useEffect(() => { setBrowsed(null); }, [forecast.spotId, forecast.timestamp]);
  const idx = browsed ?? sel.band ?? DEFAULT_BAND, band = SCALE_BANDS[idx], following = browsed === null || browsed === sel.band;
  const entry = useMediaEntry(band.media);
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => { setLoop(false); }, [idx]);
  const step = (d: number) => setBrowsed(Math.max(0, Math.min(SCALE_BANDS.length - 1, idx + d)));
  const onKey = (e: React.KeyboardEvent) => {
    const d = ({ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1} as Record<string, number>)[e.key];
    if (d) { e.preventDefault(); step(d); (e.currentTarget.querySelectorAll('button')[Math.max(0, Math.min(SCALE_BANDS.length - 1, idx + d))] as HTMLElement | undefined)?.focus(); }
  };
  return (
    <div className={`wsc${compact ? ' wsc-compact' : ''}`}>
      <div className="wsc-stage">
        <Media key={band.media} id={band.media} className="wsc-media" eager sizes={compact ? '(max-width: 860px) 100vw, 40vw' : '(max-width: 860px) 100vw, 70vw'} still={(compact || narrow) && !loop} />
        <p className="wsc-band" aria-live="polite">{band.label}<small>band</small></p>
        {entry?.video && (compact || narrow) && !reduceMotion && <button type="button" className="wsc-loop" onClick={() => setLoop((v) => !v)} aria-pressed={loop}>{loop ? 'Show still' : 'Play loop'}</button>}
      </div>
      <p className="wsc-src">{following ? <><b>{sel.label}</b>{sel.source !== 'none' && <> · showing the <b>{SCALE_BANDS[sel.band!].label}</b> band</>}</> : <>Browsing the <b>{band.label}</b> band · this hour is {sel.band === null ? 'not tied to a band' : <>in the <b>{SCALE_BANDS[sel.band].label}</b> band ({sel.label})</>}</>}</p>
      {following && sel.note && <p className="fine wsc-note">{sel.note}</p>}
      <div className="wsc-pick" role="radiogroup" aria-label="Wave size band" onKeyDown={onKey}>
        {SCALE_BANDS.map((b, i) => (
          <button key={b.id} type="button" role="radio" aria-checked={i === idx} tabIndex={i === idx ? 0 : -1} data-this-hour={i === sel.band ? 'true' : undefined} onClick={() => setBrowsed(i)} title={`${b.label}${i === sel.band ? ' (this hour)' : ''}`}>{b.short}</button>
        ))}
      </div>
      <div className="wsc-foot">
        {!following && sel.band !== null && <button type="button" className="btn" onClick={() => setBrowsed(null)}>Back to this hour ({SCALE_BANDS[sel.band].label})</button>}
        {onOpen && <button type="button" className="btn" onClick={onOpen}>Open full scale</button>}
        <span className="fine">Sizes are approximate; the surfer is there for scale.</span>
      </div>
    </div>
  );
}
