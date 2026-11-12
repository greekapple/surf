import {regionNote} from '../../ocean/coverage';
import {windowPhrase} from '../../services/homeDash';
import {ShareWindow} from './ShareWindow';
import type {ShareCard} from '../../services/shareCard';
import {fmtIn, dateIn, dateInMs, addDaysKey} from '../../ocean/time';
import {activeZone, differsFromViewer, timeZoneOf, viewerTag} from '../../ocean/spotZone';
import {Icon} from '../../ui/Icon';
import {useEffect, useId, useState} from 'react';
import {useObservations} from './Observe';
import './trust.css';
import {getFelt} from '../../services/observationStore';
import {activeAlerts, feltForHour, firstNewReason, uniqueReasons} from './trustRules';
import {alertsFor, logFeltRight, WINDOW_DAYS, type Call, type Felt, type NwsAlert, type Verdict} from './trustApi';

/* T-065 forecast trust, screen side: the Call, daylight, the NWS banner and the one-tap "Felt right?". Logic is T-064's (trustApi seam). */

// an alert's times in the zone of the spot it is shown for (Home may show a spot other than the open one), named where that clock is not the viewer's
const when = (iso: string, tz: string = activeZone()) => fmtIn(tz, {weekday: 'short', hour: 'numeric', minute: '2-digit'}).format(new Date(iso)) + viewerTag(tz, iso);
const VCLASS: Record<Call['verdict'], string> = {Go: 'go', 'Worth a look': 'look', Skip: 'nogo', Dark: 'dark'}; // audit B14: never 'skip', which is the skip-to-content link's class (it pushed the Skip verdict off-screen and inverted its colors)

/** The Call: one answer you can act on (verdict, best window, the first reason); tap for every reason and what it is computed from. */
/** `tz`: the zone of the spot the call is for (default: the page's spot); its window says the zone where that clock is not the viewer's. */
export function CallBar({call, compact = false, tz, share}: {call: Call; compact?: boolean; tz?: string; share?: ShareCard | null}) {
  const [open, setOpen] = useState(false), id = useId();
  const w = call.verdict === 'Dark' || !call.window ? call.nextWindow : call.window;
  const z = tz ?? activeZone(), wTag = w ? viewerTag(z, w.start) : '';
  const wText = w ? (call.verdict === 'Dark' || !call.window ? `next window ${windowPhrase(w, Date.now())}${wTag}${sameDay(w.start, z) ? '' : ` ${dayWord(w.start, z)}`}` : `${windowPhrase(w, Date.now())}${wTag}`) : call.verdict === 'Dark' ? `${call.nextDay ? `${call.nextDay.when}: ${call.nextDay.verdict}; ` : ''}no window in the next ${WINDOW_DAYS} days` : null;   // audit F5 / B15: after dark, tomorrow's own answer
  // T-069: the line under the verdict is the first reason that ADDS something; one that only restates the verdict and window is left to the tap-open list.
  // after dark the rating stays visible: "After dark · fair conditions · next window 7–10 AM" (user, 2026-11-08)
  const label = call.verdict === 'Dark' ? 'After dark' : call.verdict, cond = call.verdict === 'Dark' && call.lit ? `${call.lit.conditions} conditions` : null;
  // signature A / lead triage (Call hierarchy): the full Call leads with the verdict you can act on, then the window in its OWN verdict, then the hour's state.
  // Daylight: the hour's verdict, and the day's window says its verdict when it differs ("Worth a look" now, "Go window 6:20–8 AM").
  // After dark: the next window's verdict ("Go · Next window 1–5 PM today"), else the next day's ("Skip · Today: no window in the next 4 days"); "After dark now · solid conditions" is the small line.
  const dark = call.verdict === 'Dark', head: Verdict = dark ? (call.nextWindow?.verdict ?? (call.nextWindow ? 'Dark' : call.nextDay?.verdict ?? 'Dark')) : call.verdict;
  // data-honesty review: after dark the heading says WHAT its verdict is for ("Next: Go", "Today: Skip"), never a bare green "Go" at night
  const capW = (s: string) => s.replace(/^\w/, (c) => c.toUpperCase());
  const headLabel = !dark ? head : call.nextWindow ? (call.nextWindow.verdict ? `Next: ${call.nextWindow.verdict}` : 'Next window') : call.nextDay ? `${capW(call.nextDay.when)}: ${call.nextDay.verdict}` : 'After dark';
  const later = dark || !call.window, wv = w?.verdict;
  const winLine = w ? `${wv && (later || wv !== call.verdict) ? `${wv} window` : later ? 'Next window' : 'Window'} ${windowPhrase(w, Date.now())}${wTag}${later && !sameDay(w.start, z) ? ` ${dayWord(w.start, z)}` : later ? ' today' : ''}`
    : `No window in the next ${WINDOW_DAYS} days`;
  const meta = dark ? `After dark now${cond ? ` · ${cond}` : ''}` : null;
  // after dark with no window ahead, the next day's own answer ("Today at 6 AM: Skip. The estimated …") always shows: it names the hour the heading's verdict is for
  const why2 = dark && !call.nextWindow && call.nextDay ? call.why[0] : firstNewReason(call.why, `${headLabel} ${winLine}`);
  if (compact) return <p className={`call-c ${VCLASS[call.verdict]}`}><b>{label}</b>{cond && <span> · {cond}</span>}{wText && <span> · {wText}</span>}</p>;
  return (
    <section className={`call ${VCLASS[head]}`} aria-label="The call">
      <button type="button" className="call-b" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
        <span className="call-v"><i aria-hidden="true" />{headLabel}</span>
        <span className="call-wl">{winLine}</span>
        {meta && <span className="call-meta">{meta}</span>}
        {why2 && <span className="call-why">{why2}</span>}
        <span className="call-more" aria-hidden="true">{open ? 'Less' : 'Why'}</span>
      </button>
      {share && <div className="call-share"><ShareWindow card={share} /></div>}
      {open && (
        <div id={id} className="call-d">
          <ul>{uniqueReasons(call.why).map((r) => <li key={r}>{r}</li>)}</ul>
          <p className="call-basis">{call.basis}</p>
        </div>
      )}
    </section>
  );
}
// where the spot's clock is not the viewer's, 'today'/'tomorrow' are not said: the weekday is (round 3 data-honesty)
const sameDay = (iso: string, z: string = activeZone()) => !differsFromViewer(z, iso) && dateIn(z, iso) === dateInMs(z, Date.now());
const dayWord = (iso: string, z: string = activeZone()) => !differsFromViewer(z, iso) && dateIn(z, iso) === addDaysKey(dateInMs(z, Date.now()), 1) ? 'tomorrow' : fmtIn(z, {weekday: 'short'}).format(new Date(iso));


/** NWS hazard banner: only when an alert is active for the spot's zone; quotes the event, valid time and source. Nothing when the feed fails. */
export function NwsBanner({spotId}: {spotId: string}) {
  const [alerts, setAlerts] = useState<NwsAlert[]>([]);
  const [tick, setTick] = useState(0), [more, setMore] = useState(false);   // phone pass 1: on a phone the first alert shows, the rest behind "+N more" (every one stays a link)
  // Refetch every 15 minutes (the service's cache TTL) while the page stays open, so a new warning appears and an expired one goes.
  useEffect(() => { const t = window.setInterval(() => setTick((n) => n + 1), 15 * 60e3); return () => window.clearInterval(t); }, []);
  useEffect(() => {
    const ac = new AbortController();
    alertsFor(spotId, ac.signal).then((r) => { if (!ac.signal.aborted) setAlerts(r.status === 'ok' ? r.alerts : []); }).catch(() => { if (!ac.signal.aborted) setAlerts([]); });
    return () => ac.abort();
  }, [spotId, tick]);
  useEffect(() => { setAlerts([]); }, [spotId]);
  const shown = activeAlerts(alerts, Date.now()), outside = regionNote(spotId, 'alerts');
  if (outside) return <p className="nws-none fine" role="note">{outside}</p>;
  if (!shown.length) return null;
  return (
    <section className={`nws${more ? ' open' : ''}`} aria-label="National Weather Service alert" role="note">
      {/* T-109: each alert is one link to its NWS page (a full-height tap target), an icon and the bold title first; it wraps rather than clipping its end time. */}
      {shown.map((a, i) => (   // two alerts can share the event and the point link (two Coastal Flood Advisories, 2026-11-12): the index keeps the keys unique
        <a key={`${a.url}|${a.event}|${i}`} className="nws-a" href={a.url} target="_blank" rel="noopener noreferrer">
          <Icon name="alert" size={18} className="nws-i" aria-hidden="true" />
          <span className="nws-t"><b>{a.event}</b>{a.approxZone && <span> for the nearby coast</span>}
            <span className="nws-w"> · {a.onset ? `from ${when(a.onset, timeZoneOf(spotId))} ` : ''}{a.ends || a.expires ? `until ${when((a.ends ?? a.expires)!, timeZoneOf(spotId))}` : ''}</span>
            <small className="nws-s"> · {a.sender || 'National Weather Service'} ↗</small></span>
        </a>
      ))}
          {shown.length > 1 && <button type="button" className="nws-more" aria-expanded={more} onClick={() => setMore(!more)}>{more ? 'Fewer alerts' : shown.length === 2 ? `+1 more: ${shown[1].event}` : `+${shown.length - 1} more: ${shown[1].event} and ${shown.length - 2} other${shown.length > 3 ? 's' : ''}`}</button>}
    </section>
  );
}

/** One tap: did the forecast for this hour feel right? Feeds calibration as a weak signal (T-064). */
export function FeltRight({spotId, at, env, nowMs: _nowMs}: {spotId: string; at: string; env: unknown; nowMs: number}) {
  useObservations();
  // The answer shown is the one for THIS spot and THIS hour (the displayed hour), newest first; it follows the hour as it changes.
  const stored = feltForHour(getFelt(), spotId, at);
  const [local, setLocal] = useState<{key: string; felt: Felt} | null>(null);
  const [err, setErr] = useState('');
  const key = `${spotId}|${at}`, said = local?.key === key ? local.felt : stored;
  useEffect(() => { setErr(''); }, [key]);
  const tap = (felt: Felt) => { const r = logFeltRight({spotId, at, felt}, env as never); if (r.ok) { setLocal({key, felt}); setErr(''); } else setErr(r.error); };
  const W: Record<Felt, string> = {low: 'Too low', right: 'Right', high: 'Too high'};
  return (
    <div className="felt" role="group" aria-label="Did this forecast feel right?">
      <span className="felt-q">Felt right?</span>
      {(['low', 'right', 'high'] as Felt[]).map((f) => <button key={f} type="button" aria-pressed={said === f} onClick={() => tap(f)}>{W[f]}</button>)}
      {err && <span className="felt-err" role="alert">{err}</span>}
    </div>
  );
}
