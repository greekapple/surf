import {useEffect, useRef, useState, useSyncExternalStore} from 'react';
import type {UserProfile} from '../../models/index';
import {BODY_TICKS} from '../../services/bodyWords';
import {calibrationFor, getObservationsSnapshot, latestObservation, logObservation, subscribeObservations, type BodyWord, type Observation, type ObserveEnv, type Quality} from './observeApi';

/* T-060 "What did you see?": two taps (a size in body words, optionally a quality), then Save. Defaults to now; the time is one tap to change.
 * The observation is the surfer's own, always labelled so, and feeds engineering's calibration (T-059). No modal, no form fields. */

export const useObservations = () => useSyncExternalStore(subscribeObservations, getObservationsSnapshot, getObservationsSnapshot);
const SIZES = BODY_TICKS.map(([w, ft]) => ({w: w as BodyWord, ft}));
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
export const sawWords = (w: BodyWord) => (w === 'overhead' || w === 'double overhead' ? w : `${w} high`);
const sizeText = (ft: number, p: UserProfile) => (p.heightUnit === 'm' ? `${(ft * 0.3048).toFixed(1)} m` : `${ft} ft`);
const clock = (ms: number) => new Date(ms).toLocaleTimeString('en-US', {timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit'});
const dayClock = (ms: number) => new Date(ms).toLocaleString('en-US', {timeZone: 'America/Los_Angeles', weekday: 'short', hour: 'numeric', minute: '2-digit'});
const localInput = (ms: number) => { const d = new Date(ms - new Date(ms).getTimezoneOffset() * 6e4); return d.toISOString().slice(0, 16); };
const QWORDS = ['Poor', 'Poor to fair', 'Fair', 'Good', 'Epic'];

export function ObservePanel({spotName, spotId, p, env, onDone}: {spotName: string; spotId: string; p: UserProfile; env: ObserveEnv; onDone: (o: Observation | null) => void}) {
  const [word, setWord] = useState<BodyWord | null>(null);
  const [quality, setQuality] = useState<Quality | null>(null);
  const [at, setAt] = useState<number | null>(null); // null = now
  const [editTime, setEditTime] = useState(false);
  const [err, setErr] = useState('');
  const root = useRef<HTMLElement>(null);
  useEffect(() => { root.current?.scrollIntoView({block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); root.current?.querySelector<HTMLElement>('[role=radio]')?.focus({preventScroll: true}); }, []);
  const save = () => {
    if (!word) return;
    const r = logObservation({spotId, observedAt: new Date(at ?? env.nowMs).toISOString(), word, quality}, env);
    if (!r.ok) { setErr(r.error); return; }
    onDone(r.obs);
  };
  const radioKeys = (e: React.KeyboardEvent, n: number, i: number, pick: (k: number) => void) => {
    const k = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i - 1 + n) % n : -1;
    if (k < 0) return; e.preventDefault(); pick(k); (e.currentTarget.parentElement?.children[k] as HTMLElement | undefined)?.focus();
  };
  const wi = word ? SIZES.findIndex((s) => s.w === word) : -1;
  return (
    <section ref={root} className="ob" aria-label={`What did you see at ${spotName}?`}>
      <header className="ob-h">
        <h2>What did you see?</h2>
        {editTime
          ? <label className="ob-time-in"><span className="sr-only">When</span><input type="datetime-local" value={localInput(at ?? env.nowMs)} max={localInput(env.nowMs)} onChange={(e) => { const t = Date.parse(e.target.value); if (Number.isFinite(t)) setAt(t); }} onBlur={() => setEditTime(false)} autoFocus /></label>
          : <button type="button" className="ob-time" onClick={() => setEditTime(true)} aria-label={`Time: ${at === null ? 'now' : dayClock(at)}. Change`}>{at === null ? `Now · ${clock(env.nowMs)}` : dayClock(at)}</button>}
      </header>
      <div className="ob-sizes" role="radiogroup" aria-label="Wave size, face height">
        {SIZES.map((s, i) => (
          <button key={s.w} type="button" role="radio" aria-checked={word === s.w} tabIndex={word === s.w || (wi < 0 && i === 0) ? 0 : -1}
            onClick={() => { setWord(s.w); setErr(''); }} onKeyDown={(e) => radioKeys(e, SIZES.length, i, (k) => setWord(SIZES[k].w))}>
            <b>{cap(s.w)}</b><small>{sizeText(s.ft, p)}{s.w === 'overhead' ? '+' : ''}</small>
          </button>
        ))}
      </div>
      <div className="ob-q" role="radiogroup" aria-label="How good was it? Optional">
        <span className="ob-q-l" aria-hidden="true">Quality <span>optional</span></span>
        <span className="ob-dots">{[1, 2, 3, 4, 5].map((q, i) => (
          <button key={q} type="button" role="radio" aria-checked={quality === q} aria-label={`${q} of 5, ${QWORDS[i].toLowerCase()}`} tabIndex={quality === q || (quality === null && q === 1) ? 0 : -1}
            className={quality !== null && q <= quality ? 'on' : ''} onClick={() => setQuality(quality === q ? null : (q as Quality))} onKeyDown={(e) => radioKeys(e, 5, i, (k) => setQuality((k + 1) as Quality))}><i /></button>
        ))}</span>
        <span className="ob-q-w">{quality ? QWORDS[quality - 1] : ''}</span>
      </div>
      {err && <p className="ob-err" role="alert">{err}</p>}
      <div className="ob-f">
        <button type="button" className="ob-save" disabled={!word} onClick={save}>{word ? `Save ${sawWords(word)}` : 'Pick a size'}</button>
        <button type="button" className="sp-link" onClick={() => onDone(null)}>Cancel</button>
      </div>
      <p className="ob-note">Your own observation, kept on this device. It calibrates the surf estimate for {spotName} once there are enough.</p>
    </section>
  );
}

/** On the SURF card: what you saw today (labelled as yours) and how far calibration has got. */
export function ObservedLine({spotId, nowMs, onOpen}: {spotId: string; nowMs: number; onOpen: () => void}) {
  useObservations();
  const last = latestObservation(spotId, nowMs), cal = calibrationFor(spotId);
  return (
    <div className="ob-line">
      {last && <p className="ob-saw"><span>You saw ~{sawWords(last.word)} · {clock(Date.parse(last.observedAt))}</span> <span className="ob-own">your observation</span></p>}
      {cal.count > 0 && <p className="ob-cal">{cal.state === 'active' ? `Calibrated with your ${cal.count} observations` : `Calibrating: ${cal.count} of ${cal.needed} observations`}</p>}
      <button type="button" className="sp-link ob-open" onClick={onOpen}>What did you see?</button>
    </div>
  );
}
