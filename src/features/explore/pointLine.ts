import type {UserProfile} from '../../models/index.ts';
import type {PointValue} from '../../map/fieldData.ts';
import {heightValue, wind as windText, compass} from '../../utils/units.ts';

// Same formatting as forecast/helpers' ht/windVal (that module isn't loadable by the node test runner).
const ht = (ft: number, p: UserProfile, digits = 1) => (Number.isFinite(ft) ? heightValue(ft, p, false).toFixed(digits) : '—');
const windVal = (mph: number, p: UserProfile) => (Number.isFinite(mph) ? windText(mph, p).split(' ')[0] : '—');

const FT = 1 / 0.3048, MPH = 2.23694;

/** The label line for a sampled value: "12 ft W · 11 s offshore". Period comes from the field when the layer is period, else from the point forecast. */
/** `kind` is the layer the person chose (what the field shows); it names the value, so wording never depends on how the frame was classified. */
/** `windSeaM`: the offshore wave height (the WAVES frame) at the same point and hour, for a no-swell cell: there the whole sea is wind sea and can be
 *  big (median 4.5 m in those cells), so a 0-ft swell must never read as calm water. */
export function pointLine(v: PointValue | null, periodS: number | null, p: UserProfile, kind: 'waves' | 'swell' | 'wind' | 'period', windSeaM?: number | null): {main: string; note: string} | null {
  if (!v || v.value === null) return null;
  const dir = v.dirFrom !== null ? ` ${compass(v.dirFrom)}` : '';
  if (kind === 'wind') return {main: `${windVal(v.value * MPH, p)} ${p.windUnit}${dir}`, note: 'wind at 10 m'};
  if (kind === 'period') return {main: `${Math.round(v.value)} s${dir}`, note: 'peak wave period'};
  // An exact 0 is the model's empty swell partition (NO_SWELL_NOTE): no swell system there, the sea is all wind sea. Said as such, with the wind
  // sea's height when the waves frame has it (all of the sea there is wind sea, so total Hs IS the wind-sea height), never as "0 ft" alone.
  if (v.note) return windSeaM !== null && windSeaM !== undefined && windSeaM > 0
    ? {main: `No swell · wind sea ${ht(windSeaM * FT, p)} ${p.heightUnit}`, note: `${v.note} · offshore, not surf size`}
    : {main: `No swell (0 ${p.heightUnit})`, note: v.note};
  const per = periodS !== null ? ` · ${Math.round(periodS)} s` : '';
  return {main: `${ht(v.value * FT, p)} ${p.heightUnit}${dir}${per}`, note: kind === 'swell' ? 'swell · offshore, not surf size' : 'offshore · not surf size'};
}
