import {useState, type FormEvent} from 'react';
import type {SurfSpot, UserProfile} from '../../models/index';
import {heightValue, wind as windText} from '../../utils/units';
import {PIcon, type PName} from './icons';
import {Toggle, hourText, weekdayShort} from './parts';
import {describeRule, type AlertRule, type RuleResult} from './alerts';

export const resultText = (r: RuleResult) =>
  r.kind === 'match' ? `Matches ${weekdayShort(r.at)} ${hourText(r.at)}` : r.kind === 'none' ? 'No match in 7 days' : 'No forecast loaded';

export const describe = (rule: AlertRule, p: UserProfile) =>
  describeRule(rule, (ft) => `${+heightValue(ft, p, false).toFixed(1)}`, p.heightUnit, (mph) => windText(mph, p).replace('.0 ', ' '));

const ICONS: PName[] = ['wave', 'wind', 'swell'];

interface RowProps {rules: AlertRule[]; results: RuleResult[]; spotName: (id: string) => string; p: UserProfile; toggle: (id: string, on: boolean) => void}

/** Compact card for the dashboard. */
export function AlertsCard({rules, results, spotName, p, toggle, onEdit}: RowProps & {onEdit: () => void}) {
  const shown = rules.slice(0, 4);
  return (
    <section className="pz-panel pz-alerts" aria-labelledby="pz-al-h">
      <div className="pz-ph"><h2 id="pz-al-h">Upcoming Alerts</h2><button className="pz-link" onClick={onEdit}>Edit</button></div>
      {shown.length ? (
        <ul className="pz-arows">
          {shown.map((r, i) => {
            const idx = rules.indexOf(r), res = results[idx];
            return (
              <li key={r.id}>
                <PIcon name={ICONS[i % 3]} size={20} />
                <div><b>{spotName(r.spotId)}</b><span>{describe(r, p)}</span>
                  <em className={res.kind === 'match' && r.enabled ? 'hit' : ''}>{r.enabled ? resultText(res) : 'Off'}</em></div>
                <Toggle on={r.enabled} label={`${spotName(r.spotId)} alert`} onChange={(v) => toggle(r.id, v)} />
              </li>
            );
          })}
        </ul>
      ) : <p className="pz-empty">No alerts yet. Set a rule for a spot and Swello checks it against the forecast.</p>}
      <p className="fine pz-note">Shown when you open Swello. No push notifications.</p>
      {!shown.length && <button className="btn" onClick={onEdit}><PIcon name="plus" size={16} />Create alert</button>}
    </section>
  );
}

const field = (v: string) => (v.trim() === '' ? null : Number(v));

/** Full page: every rule with live results, plus the create form. */
export function AlertsManager({rules, results, spotName, p, toggle, spots, add, remove}: RowProps & {spots: SurfSpot[]; add: (r: Omit<AlertRule, 'id'>) => void; remove: (id: string) => void}) {
  const [f, setF] = useState({spotId: spots[0]?.id ?? '', min: '', max: '', wind: '', offshore: true});
  const [err, setErr] = useState('');
  const hU = p.heightUnit, wU = p.windUnit;
  const toFt = (v: number) => v / (hU === 'm' ? 0.3048 : 1);
  const toMph = (v: number) => v / (wU === 'kn' ? 0.868976 : wU === 'km/h' ? 1.609344 : 1);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const min = field(f.min), max = field(f.max), w = field(f.wind);
    if ([min, max, w].some((v) => v !== null && (!Number.isFinite(v) || v < 0))) return setErr('Use numbers of zero or more.');
    if (min !== null && max !== null && min > max) return setErr('Minimum height is above the maximum.');
    if (!f.spotId) return setErr('Pick a spot.');
    if (min === null && max === null && w === null && !f.offshore) return setErr('Add at least one condition.');
    setErr('');
    add({spotId: f.spotId, minFt: min === null ? null : toFt(min), maxFt: max === null ? null : toFt(max), maxWindMph: w === null ? null : toMph(w), offshoreOnly: f.offshore, enabled: true});
    setF({...f, min: '', max: '', wind: ''});
  };
  return (
    <div className="pz-journal">
      <form onSubmit={submit} className="pz-panel pz-form" aria-label="New alert">
        <h2>New alert</h2>
        <label className="field"><span>Spot</span>
          <select value={f.spotId} onChange={(e) => setF({...f, spotId: e.target.value})}>{spots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </label>
        <div className="pz-two">
          <label className="field"><span>Min height ({hU})</span><input type="number" inputMode="decimal" min={0} step={0.5} value={f.min} onChange={(e) => setF({...f, min: e.target.value})} /></label>
          <label className="field"><span>Max height ({hU})</span><input type="number" inputMode="decimal" min={0} step={0.5} value={f.max} onChange={(e) => setF({...f, max: e.target.value})} /></label>
        </div>
        <label className="field"><span>Wind up to ({wU})</span><input type="number" inputMode="decimal" min={0} step={1} value={f.wind} onChange={(e) => setF({...f, wind: e.target.value})} placeholder="Any" /></label>
        <label className="pz-check"><input type="checkbox" checked={f.offshore} onChange={(e) => setF({...f, offshore: e.target.checked})} />Only when the wind is offshore</label>
        <p className="fine">Height is offshore swell height, not surf size.</p>
        {err && <p className="pz-err" role="alert">{err}</p>}
        <button className="btn primary" type="submit"><PIcon name="plus" size={16} />Add alert</button>
      </form>
      <section className="pz-panel" aria-labelledby="pz-al-list">
        <div className="pz-ph"><h2 id="pz-al-list">Your alerts</h2></div>
        <p className="fine pz-note">Checked against the loaded forecast for the next 7 days. Shown when you open Swello. No push notifications.</p>
        {rules.length ? (
          <ul className="pz-arows pz-arows-lg">
            {rules.map((r, i) => (
              <li key={r.id}>
                <PIcon name={ICONS[i % 3]} size={22} />
                <div><b>{spotName(r.spotId)}</b><span>{describe(r, p)}</span>
                  <em className={results[i].kind === 'match' && r.enabled ? 'hit' : ''}>{r.enabled ? resultText(results[i]) : 'Off'}</em></div>
                <button className="btn pz-icon-btn" aria-label={`Delete ${spotName(r.spotId)} alert`} onClick={() => remove(r.id)}><PIcon name="trash" size={16} /></button>
                <Toggle on={r.enabled} label={`${spotName(r.spotId)} alert`} onChange={(v) => toggle(r.id, v)} />
              </li>
            ))}
          </ul>
        ) : <p className="pz-empty">No alerts yet. Add one on the left.</p>}
      </section>
    </div>
  );
}
