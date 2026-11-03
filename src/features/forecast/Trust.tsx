import {useEffect, useId, useState} from 'react';
import {useObservations} from './Observe';
import './trust.css';
import {alertsFor, feltRightFor, logFeltRight, type Call, type Daylight, type Felt, type NwsAlert} from './trustApi';

/* T-065 forecast trust, screen side: the Call, daylight, the NWS banner and the one-tap "Felt right?". Logic is T-064's (trustApi seam). */

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit'});
const when = (iso: string) => new Date(iso).toLocaleString('en-US', {timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', minute: '2-digit'});
const VCLASS: Record<Call['verdict'], string> = {Go: 'go', 'Worth a look': 'look', Skip: 'skip', Dark: 'dark'};

/** The Call: one answer you can act on (verdict, best window, the first reason); tap for every reason and what it is computed from. */
export function CallBar({call, compact = false}: {call: Call; compact?: boolean}) {
  const [open, setOpen] = useState(false), id = useId();
  const w = call.verdict === 'Dark' || !call.window ? call.nextWindow : call.window;
  const wText = w ? (call.verdict === 'Dark' || !call.window ? `next window ${w.label}${sameDay(w.start) ? '' : ` ${dayWord(w.start)}`}` : w.label) : call.verdict === 'Dark' ? 'no window in this forecast' : null;
  if (compact) return <p className={`call-c ${VCLASS[call.verdict]}`}><b>{call.verdict}</b>{wText && <span> · {wText}</span>}</p>;
  return (
    <section className={`call ${VCLASS[call.verdict]}`} aria-label="The call">
      <button type="button" className="call-b" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="call-v"><i aria-hidden="true" />{call.verdict}{wText && <span className="call-w"> · {wText}</span>}</span>
        {call.why[0] && <span className="call-why">{call.why[0]}</span>}
        <span className="call-more" aria-hidden="true">{open ? 'Less' : 'Why'}</span>
      </button>
      {open && (
        <div id={id} className="call-d">
          <ul>{call.why.map((r) => <li key={r}>{r}</li>)}</ul>
          <p className="call-basis">{call.basis}</p>
        </div>
      )}
    </section>
  );
}
const sameDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'}) === new Date().toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'});
const dayWord = (iso: string) => { const t = new Date(Date.now() + 864e5).toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'}); return new Date(iso).toLocaleDateString('en-CA', {timeZone: 'America/Los_Angeles'}) === t ? 'tomorrow' : new Date(iso).toLocaleDateString('en-US', {timeZone: 'America/Los_Angeles', weekday: 'short'}); };

/** First light, sunrise, sunset and last light for the selected day. */
export function DaylightRow({d}: {d: Daylight}) {
  return (
    <dl className="daylight" aria-label="Daylight">
      <div><dt>First light</dt><dd>{clock(d.firstLight)}</dd></div>
      <div><dt>Sunrise</dt><dd>{clock(d.sunrise)}</dd></div>
      <div><dt>Sunset</dt><dd>{clock(d.sunset)}</dd></div>
      <div><dt>Last light</dt><dd>{clock(d.lastLight)}</dd></div>
    </dl>
  );
}

/** NWS hazard banner: only when an alert is active for the spot's zone; quotes the event, valid time and source. Nothing when the feed fails. */
export function NwsBanner({spotId}: {spotId: string}) {
  const [alerts, setAlerts] = useState<NwsAlert[]>([]);
  useEffect(() => {
    const ac = new AbortController(); setAlerts([]);
    alertsFor(spotId, ac.signal).then((r) => { if (!ac.signal.aborted && r.status === 'ok') setAlerts(r.alerts); }).catch(() => {});
    return () => ac.abort();
  }, [spotId]);
  if (!alerts.length) return null;
  return (
    <section className="nws" aria-label="National Weather Service alert" role="note">
      {alerts.map((a) => (
        <p key={a.url + a.event}>
          <b>{a.event}</b>{a.approxZone && <span> for the nearby coast</span>}
          <span> · {a.onset ? `from ${when(a.onset)} ` : ''}{a.ends || a.expires ? `until ${when((a.ends ?? a.expires)!)}` : ''}</span>
          <a href={a.url} target="_blank" rel="noopener noreferrer">{a.sender || 'National Weather Service'}</a>
        </p>
      ))}
    </section>
  );
}

/** One tap: did the forecast for this hour feel right? Feeds calibration as a weak signal (T-064). */
export function FeltRight({spotId, at, env, nowMs}: {spotId: string; at: string; env: unknown; nowMs: number}) {
  useObservations();
  const [said, setSaid] = useState<Felt | null>(() => feltRightFor(spotId, nowMs)?.felt ?? null);
  const [err, setErr] = useState('');
  useEffect(() => { setSaid(feltRightFor(spotId, nowMs)?.felt ?? null); }, [spotId]); // eslint-disable-line react-hooks/exhaustive-deps
  const tap = (felt: Felt) => { const r = logFeltRight({spotId, at, felt}, env as never); if (r.ok) { setSaid(felt); setErr(''); } else setErr(r.error); };
  const W: Record<Felt, string> = {low: 'Too low', right: 'Right', high: 'Too high'};
  return (
    <div className="felt" role="group" aria-label="Did this forecast feel right?">
      <span className="felt-q">Felt right?</span>
      {(['low', 'right', 'high'] as Felt[]).map((f) => <button key={f} type="button" aria-pressed={said === f} onClick={() => tap(f)}>{W[f]}</button>)}
      {err && <span className="felt-err" role="alert">{err}</span>}
    </div>
  );
}
