import {useEffect, useRef, useState} from 'react';
import type {UserProfile} from '../../models/index';
import {formatHeight, parseHeight, userHeight} from '../../services/heightMath';
import {fromUnit, toUnit} from '../../utils/units';
import {WHY, ageAnswer, levelSource} from '../../services/profileFields';
import {LEVELS, levelInfo, levelOf, pickLevel, suggestLevel, suggestedVolume, validKg, type SkillLevel} from '../../services/skillLevels';
import {WaveGlyph} from '../../ui/WaveGlyph';
import {ZONES} from '../../data/zones';
import {allSpots} from '../../data/catalog';
import {AVATAR_KEY} from './journal';
import './profile.css';

/** Your height (T-052): saved on the profile in inches, typed as ft/in or cm by the unit preference. The Wave scale draws you at this height; until it is set a labelled 5'10" default is drawn. */
// T-103: a MODULE-level component. It used to be declared inside PersonalView, so every PersonalView render created a new component type and REMOUNTED the field (losing the person's text and focus)
// when a save landed.
export function HeightField({p, set}: {p: UserProfile; set: (v: Partial<UserProfile>) => void}) {
  const me = userHeight(p), unit = p.heightUnit === 'm' ? 'm' : 'ft';
  const [text, setText] = useState(me.isDefault ? '' : formatHeight(me.inches, unit)), [err, setErr] = useState('');
  // T-103: the text follows the saved height only while the person is not editing: a late echo of an earlier save must not overwrite what they are typing (or an invalid entry that is still showing its message).
  const dirty = useRef(false);
  useEffect(() => { if (dirty.current) return; setText(userHeight(p).isDefault ? '' : formatHeight(userHeight(p).inches, unit)); }, [p.heightIn, unit]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = () => {
    if (!text.trim()) { dirty.current = false; setErr(''); if (p.heightIn != null) set({heightIn: null}); return; }
    const v = parseHeight(text, unit);
    if (v === null) { setErr(unit === 'm' ? 'Enter your height in centimetres, 100 to 230, like 178.' : `Enter your height like 5'10" (3'4" to 7'6").`); return; }
    dirty.current = false; setErr(''); set({heightIn: v});
  };
  return (
    <>
      <label className="field"><span>Height ({unit === 'm' ? 'cm' : 'ft and in'})</span>
        <input value={text} inputMode={unit === 'm' ? 'numeric' : 'text'} placeholder={unit === 'm' ? '178' : `5'10"`} aria-invalid={!!err} aria-describedby="height-help" onChange={(e) => { dirty.current = true; setText(e.target.value); }} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
      </label>
      <p id="height-help" className={err ? 'pz-err' : 'fine'} role={err ? 'alert' : undefined}>{err || (me.isDefault ? `Not set: the Wave scale draws you at ${formatHeight(me.inches, unit)} (default). Used only to draw you to scale on this device.` : `The Wave scale draws you at ${formatHeight(me.inches, unit)}. Saved on this device.`)}</p>
      {!me.isDefault && <button type="button" className="btn" onClick={() => { setText(''); setErr(''); set({heightIn: null}); }}>Use the default</button>}
    </>
  );
}

/** Review LOW: a height typed in the user's unit is a draft until blur or Enter; empty or non-numbers are dropped (the saved value returns), and the
 *  stored feet are clamped to the field's range. */
export function UnitNumber({ft, unit, min, max, label, onCommit}: {ft: number; unit: string; min: number; max: number; label: string; onCommit: (ft: number) => void}) {
  const [text, setText] = useState<string | null>(null);
  const commit = () => {
    if (text === null) return;
    const v = parseFloat(text.replace(',', '.')); setText(null);
    if (!text.trim() || !Number.isFinite(v)) return;
    onCommit(Math.min(max, Math.max(min, fromUnit(v, unit))));
  };
  return <input type="number" inputMode="decimal" min={toUnit(min, unit)} max={toUnit(max, unit)} step={unit === 'm' ? 0.1 : 1} value={text ?? toUnit(ft, unit)} aria-label={label}
    onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />;
}

// ---------------- profile-setup (spec docs/specs/2026-11-12-profile-setup.md): the questions, each with its "Why we ask" ----------------

type Set = (v: Partial<UserProfile>) => void;
/** The one line under every question: what the answer changes, in so many words. */
export const Why = ({k, id}: {k: keyof typeof WHY; id?: string}) => <p className="pf-why" id={id}><b>Why we ask:</b> {WHY[k]}</p>;

/** The age question (required in setup). Under 13: nothing personal is saved on this device, and setup ends. The answer is a band, never a birth date. */
export function AgeQuestion({p, set, onUnder13}: {p: UserProfile; set: Set; onUnder13?: () => void}) {
  const cur = p.personalData === false ? 'under-13' : p.ageBand ?? null;
  const pick = (a: 'under-13' | '13-17' | '18+') => { set(ageAnswer(a)); if (a === 'under-13') { try { localStorage.removeItem(AVATAR_KEY); } catch { /* storage off */ } onUnder13?.(); } };   // the profile photo is personal too
  return <div className="field pf-q">
    <span id="pf-age-l">Your age</span>
    <div className="seg" role="radiogroup" aria-labelledby="pf-age-l" aria-describedby="pf-age-why">
      {([['under-13', 'Under 13'], ['13-17', '13–17'], ['18+', '18 or over']] as const).map(([v, t]) => <button key={v} type="button" role="radio" aria-checked={cur === v} onClick={() => pick(v)}>{t}</button>)}
    </div>
    <Why k="age" id="pf-age-why" />
  </div>;
}

/** Weight, in kg (metric heights) or lb; empty clears it. Used only for Board Match's suggested volume. */
export function WeightField({p, set}: {p: UserProfile; set: Set}) {
  const kgUnit = p.heightUnit === 'm', toShow = (kg: number) => String(Math.round(kgUnit ? kg : kg / 0.45359237));
  const [text, setText] = useState<string | null>(null), [err, setErr] = useState('');
  const commit = () => {
    if (text === null) return;
    const t = text.trim(); setText(null);
    if (!t) { setErr(''); set({weightKg: null}); return; }
    const v = Number(t.replace(',', '.')), kg = kgUnit ? v : v * 0.45359237;
    if (!validKg(kg)) { setErr(kgUnit ? 'Enter your weight in kg, 20 to 250.' : 'Enter your weight in lb, 44 to 550.'); return; }
    setErr(''); set({weightKg: Math.round(kg * 10) / 10});
  };
  return <div className="field pf-q">
    <label htmlFor="pf-weight">Weight ({kgUnit ? 'kg' : 'lb'}, optional)</label>
    <input id="pf-weight" inputMode="decimal" value={text ?? (validKg(p.weightKg) ? toShow(p.weightKg) : '')} placeholder="Skip" aria-invalid={!!err} aria-describedby="pf-weight-why"
      onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }} />
    {err && <p className="pz-err" role="alert">{err}</p>}
    <Why k="weight" id="pf-weight-why" />
  </div>;
}

/** The level cards: name, summary, "You can…", the app's own drawn wave at the level's comfortable size beside the person (their height, or the labelled default),
 *  and the default range. Side by side, scrolling on a phone. Picking a level also sets the comfortable size to its default (editable below). */
export function LevelPicker({p, set}: {p: UserProfile; set: Set}) {
  const cur = p.skillLevel ? levelOf(p) : null, me = userHeight(p), unit = p.heightUnit === 'm' ? 'm' : 'ft';
  const range = (a: number, b: number) => (unit === 'm' ? `${(a * 0.3048).toFixed(1)}–${(b * 0.3048).toFixed(1)} m` : `${a}–${b} ft`);
  const [quiz, setQuiz] = useState<{duckDive: boolean | null; overhead: boolean | null; barrel: boolean | null}>({duckDive: null, overhead: null, barrel: null});
  const done = quiz.duckDive !== null && quiz.overhead !== null && quiz.barrel !== null, sug = done ? suggestLevel(quiz as {duckDive: boolean; overhead: boolean; barrel: boolean}) : null;
  return <div className="field pf-q">
    <span id="pf-level-l">Your level{!p.skillLevel && <small className="fine"> · now {levelInfo(levelOf(p)).name}{levelSource(p)}</small>}</span>
    <div className="pf-levels" role="radiogroup" aria-labelledby="pf-level-l" aria-describedby="pf-level-why">
      {LEVELS.map((L) => <div key={L.n} className={`pf-level${cur === L.n ? ' on' : ''}`} onClick={() => set(pickLevel(L.n))}>
        <label className="pf-lv-h"><input type="radio" name="pf-level" checked={cur === L.n} onChange={() => set(pickLevel(L.n))} /><span><span className="pf-lv-n">Level {L.n}</span> <b>{L.name}</b></span></label>
        <span className="pf-lv-s">{L.summary}</span>
        <WaveGlyph glyph={{kind: 'surf', midFt: (L.comfortFt[0] + L.comfortFt[1]) / 2, loFt: L.comfortFt[0], hiFt: L.comfortFt[1], personFt: me.feet, steep: 0.5, curl: false}} size="md" personIn={me.inches} unit={unit} decorative />
        <span className="pf-lv-r">{range(L.comfortFt[0], L.comfortFt[1])} comfortable; the Call skips above {unit === 'm' ? `${(L.callFt.max * 0.3048).toFixed(1)} m` : `${L.callFt.max} ft`} · drawn beside {me.isDefault ? `a ${formatHeight(me.inches, unit)} person (default)` : `you (${formatHeight(me.inches, unit)})`}</span>
        <span className="pf-lv-can">You can:</span>
        <ul>{L.can.map((c) => <li key={c}>{c}</li>)}</ul>
      </div>)}
    </div>
    <p className="fine">Sizes are surf height, our own rule for each level, not a safety standard; your comfortable size below is yours to change.</p>
    <Why k="skill" id="pf-level-why" />
    <details className="pf-quiz"><summary>Not sure? Answer 3 questions</summary>
      {([['duckDive', 'Can you duck-dive?'], ['overhead', 'Do you surf overhead waves?'], ['barrel', 'Do you ride the barrel?']] as const).map(([k, q]) => <div key={k} className="pf-yn"><span id={`pf-q-${k}`}>{q}</span>
        <div className="seg" role="radiogroup" aria-labelledby={`pf-q-${k}`}>{([true, false] as const).map((v) => <button key={String(v)} type="button" role="radio" aria-checked={quiz[k] === v} onClick={() => setQuiz({...quiz, [k]: v})}>{v ? 'Yes' : 'No'}</button>)}</div></div>)}
      {sug && <p className="pf-sug" role="status">Suggested: level {sug}, {levelInfo(sug).name}. <button type="button" className="btn" onClick={() => set(pickLevel(sug))}>Use level {sug}</button></p>}
    </details>
  </div>;
}

/** The comfortable size (the Call names it), prefilled from the level. */
export function SizeField({p, set}: {p: UserProfile; set: Set}) {
  return <div className="field pf-q">
    <span>Comfortable wave size ({p.heightUnit})</span>
    <div className="pf-range">
      <UnitNumber ft={p.minWave} unit={p.heightUnit} min={1} max={40} label={`Comfortable size, from (${p.heightUnit})`} onCommit={(minWave) => set({minWave, maxWave: Math.max(minWave, p.maxWave)})} />
      <span aria-hidden="true">to</span>
      <UnitNumber ft={p.maxWave} unit={p.heightUnit} min={1} max={40} label={`Comfortable size, up to (${p.heightUnit})`} onCommit={(maxWave) => set({maxWave, minWave: Math.min(maxWave, p.minWave)})} />
    </div>
    <Why k="size" />
  </div>;
}

export function RegionField({p, set}: {p: UserProfile; set: Set}) {
  return <label className="field pf-q"><span>Home region</span>
    <select value={p.region} onChange={(e) => set({region: e.target.value})} aria-describedby="pf-region-why">
      <option value="All regions">Not set (use my location)</option>
      {ZONES.map(([z, counties]) => <optgroup key={z} label={z}>{counties.filter((c) => allSpots.some((x) => x.region === c)).map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>)}
    </select>
    <Why k="region" id="pf-region-why" />
  </label>;
}

export function UnitsField({p, set}: {p: UserProfile; set: Set}) {
  return <div className="field pf-q">
    <span>Units</span>
    <div className="pf-units">
      <label><span className="sr-only">Heights</span><select value={p.heightUnit} onChange={(e) => set({heightUnit: e.target.value as UserProfile['heightUnit']})} aria-label="Height unit"><option value="ft">feet</option><option value="m">metres</option></select></label>
      <label><span className="sr-only">Wind</span><select value={p.windUnit} onChange={(e) => set({windUnit: e.target.value as UserProfile['windUnit']})} aria-label="Wind unit"><option value="mph">mph</option><option value="kn">knots</option><option value="km/h">km/h</option></select></label>
    </div>
    <Why k="units" />
  </div>;
}

/** The weight's one visible effect, shown where it is asked: the suggested volume at the chosen level. */
export function VolumeHint({p}: {p: UserProfile}) {
  const lv: SkillLevel = levelOf(p), v = suggestedVolume(p.weightKg, lv);
  return v === null ? null : <p className="fine pf-vol">Board Match will suggest about {v} L for you (level {lv}, our rule of thumb).</p>;
}
