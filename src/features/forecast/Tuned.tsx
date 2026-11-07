import {useId, useState} from 'react';
import type {UserProfile} from '../../models/index';
import type {HeadlineSurf} from '../../services/headlineSurf';
import {MIN_SPREAD, RATIO_LIMITS, SHRINK_K} from '../../services/calibrationMath';
import {transferTag} from '../../services/headlineSurf';
import {formatWaveHeight} from '../../utils/waveHeight';
import {BREAKING_V2_VERSION} from '../../ocean/breakingEstimate';

/* Beyond-Surfline step 3: the personal calibration made visible on the Surf card. When a spot has enough of YOUR reports, the big number is tuned to
 * them; this line says so, puts the model's own band beside it, and one tap explains the difference with the real figures (median, shrinkage, felt
 * taps, the cap, and that our buoy correction never stacks with it). Everything here is computed on this device from data kept on this device. */

type Est = Extract<HeadlineSurf, {kind: 'estimate'}>;
const x2 = (r: number) => `${Number(r.toFixed(2))}×`;

export function TunedLine({hs, p, spotName}: {hs: Est & {calibration: NonNullable<Est['calibration']>}; p: UserProfile; spotName: string}) {
  const [open, setOpen] = useState(false), id = useId(), c = hs.calibration;
  const model = formatWaveHeight({kind: 'breaking-estimate', valueFt: null, rangeFt: c.uncalibratedFt, rangeMethod: hs.method === 'mop-v2' ? `v2 ${BREAKING_V2_VERSION}` : 'v1'}, p).text;
  const net = c.felt.low - c.felt.high, taps = c.felt.low + c.felt.right + c.felt.high, feltPct = Math.round((c.felt.factor - 1) * 100);
  const capped = c.ratio <= RATIO_LIMITS[0] + 1e-9 || c.ratio >= RATIO_LIMITS[1] - 1e-9;
  return (
    <div className="tuned">
      <p className="tuned-l">
        model estimate{transferTag(hs) ? ` · ${transferTag(hs)}` : ''} · <b>tuned to your {c.n} reports at {spotName}</b><span className="tuned-m"> · model alone {model}</span>{' '}
        <button type="button" className="hr-more" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>{open ? 'Less' : 'Why'}</button>
        <span className="sr-only"> {hs.methodLabel}</span>
      </p>
      {open && (
        <div id={id} className="tuned-d">
          <p>Across your {c.n} reports at {spotName}, the waves you saw were about <b>{x2(c.rawRatio)}</b> what the model said (the middle of your reports).</p>
          <p>A few reports should not swing the number, so we move only part of the way toward yours until there are more: {c.n} ÷ ({c.n} + {SHRINK_K}) = {Math.round(c.weight * 100)}% of the way{feltPct ? `, and your ${taps} “felt right?” taps nudge it ${feltPct > 0 ? 'up' : 'down'} ${Math.abs(feltPct)}%` : taps ? `; your ${taps} “felt right?” taps cancel out (${net >= 0 ? '+' : ''}${net})` : ''}. Your number is <b>{x2(c.ratio)}</b> the model{capped ? `, held at our limit (never under ${x2(RATIO_LIMITS[0])} or over ${x2(RATIO_LIMITS[1])})` : ''}.</p>
          <p>The two ranges are different kinds of range. The model's ({model}) runs from the typical wave to the sets. Yours spans the middle half of your own reports, and is never narrower than ±{Math.round(MIN_SPREAD * 100)}% of your number.</p>
          {hs.method === 'v1' && hs.transfer && <p>The model number already carries our buoy correction ({hs.transfer.tag}); your reports are measured against the corrected number, so the two never stack.</p>}
          <p className="hr-src">Your reports and taps stay on this device; nothing is uploaded. The model alone: {model} ({hs.method === 'mop-v2' ? 'CDIP nearshore model' : 'offshore swell carried to 10 m'}, unvalidated).</p>
        </div>
      )}
    </div>
  );
}
