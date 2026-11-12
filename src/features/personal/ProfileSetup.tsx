import {useEffect, useRef, useState} from 'react';
import type {UserProfile} from '../../models/index';
import {AgeQuestion, HeightField, SexQuestion, Why, LevelPicker, RegionField, SizeField, UnitsField, VolumeHint, WeightField} from './ProfileFields';
import {levelInfo, levelOf} from '../../services/skillLevels';
import {levelSource, sizeIsDefault} from '../../services/profileFields';
import {userHeight, formatHeight} from '../../services/heightMath';
import {WaveGlyph} from '../../ui/WaveGlyph';
import {figureOf} from '../../ui/PersonShape';

/** profile-setup: the first-run setup, shown on Home until it is finished or skipped (`onboarded`). Inline on the page, never a modal: the forecast stays one
 *  scroll away. Welcome → About you (age first; under 13 ends setup with nothing personal saved) → How you surf → Done. "Skip for now" on every step; answers are
 *  saved as they are given, on this device only; everything can be changed in Personal › Profile. */
type Step = 'welcome' | 'about' | 'surf' | 'done' | 'child';
export function ProfileSetup({p, set, onEdit}: {p: UserProfile; set: (v: Partial<UserProfile>) => void; onEdit: () => void}) {
  const [step, setStep] = useState<Step>('welcome'), head = useRef<HTMLHeadingElement>(null), first = useRef(true);
  useEffect(() => { if (first.current) { first.current = false; return; } head.current?.focus(); }, [step]);   // each step moves focus to its heading (screen readers hear the new step)
  const finish = () => set({onboarded: true});
  const n = {welcome: 0, about: 1, surf: 2, done: 3, child: 3}[step], me = userHeight(p), lv = levelOf(p), L = levelInfo(lv), unit = p.heightUnit === 'm' ? 'm' : 'ft';
  const ageDone = p.personalData === false || p.ageBand === '13-17' || p.ageBand === '18+';
  const skip = <button type="button" className="btn pf-skip" onClick={finish}>Skip for now</button>;
  return <section className="card pf-setup" aria-labelledby="pf-setup-h">
    {step !== 'welcome' && step !== 'child' && <p className="pf-step" aria-hidden="true">Step {n} of 3</p>}
    {step === 'welcome' && <>
      <h2 id="pf-setup-h" ref={head} tabIndex={-1}>Set up your surf profile</h2>
      <p>About 30 seconds. Every question says why we ask, and your answers stay on this device (there are no accounts yet).</p>
      <div className="pf-actions"><button type="button" className="btn primary" onClick={() => setStep('about')}>Start</button>{skip}</div>
    </>}
    {step === 'about' && <>
      <h2 id="pf-setup-h" ref={head} tabIndex={-1}>About you</h2>
      <AgeQuestion p={p} set={set} onUnder13={() => setStep('child')} />
      {ageDone && p.personalData !== false && <><SexQuestion p={p} set={set} /><div className="pf-q"><HeightField p={p} set={set} /><Why k="height" /></div><WeightField p={p} set={set} /></>}
      <div className="pf-actions"><button type="button" className="btn" onClick={() => setStep('welcome')}>Back</button><button type="button" className="btn primary" disabled={!ageDone} onClick={() => setStep(p.personalData === false ? 'child' : 'surf')}>Next</button>{skip}</div>
      {!ageDone && <p className="fine">Answer the age question to go on, or skip setup for now.</p>}
    </>}
    {step === 'surf' && <>
      <h2 id="pf-setup-h" ref={head} tabIndex={-1}>How you surf</h2>
      <LevelPicker p={p} set={set} />
      <SizeField p={p} set={set} />
      <VolumeHint p={p} />
      <RegionField p={p} set={set} />
      <UnitsField p={p} set={set} />
      <div className="pf-actions"><button type="button" className="btn" onClick={() => setStep('about')}>Back</button><button type="button" className="btn primary" onClick={() => setStep('done')}>Finish</button>{skip}</div>
    </>}
    {step === 'done' && <>
      <h2 id="pf-setup-h" ref={head} tabIndex={-1}>You're set</h2>
      <div className="pf-done">
        <WaveGlyph glyph={{kind: 'surf', midFt: (p.minWave + p.maxWave) / 2, loFt: p.minWave, hiFt: p.maxWave, personFt: me.feet, steep: 0.5, curl: false}} size="lg" personIn={me.inches} unit={unit} figure={figureOf(p)} decorative />
        <p>Your comfortable size{sizeIsDefault(p) ? ' (default)' : ''}, {unit === 'm' ? `${(p.minWave * 0.3048).toFixed(1)}–${(p.maxWave * 0.3048).toFixed(1)} m` : `${p.minWave}–${p.maxWave} ft`}, drawn beside {me.isDefault ? `a ${formatHeight(me.inches, unit)} person (default height)` : `you (${formatHeight(me.inches, unit)})`}. The Call now judges size for level {lv}, {L.name.toLowerCase()}{levelSource(p)}.</p>
      </div>
      <div className="pf-actions"><button type="button" className="btn primary" onClick={finish}>Done</button><button type="button" className="btn" onClick={() => { finish(); onEdit(); }}>Edit anytime in Personal › Profile</button></div>
    </>}
    {step === 'child' && <>
      <h2 id="pf-setup-h" ref={head} tabIndex={-1}>You're all set</h2>
      <p>Swello works without a profile. Because you're under 13, your name, photo, sex, height and weight are not saved on this device.</p>
      <div className="pf-actions"><button type="button" className="btn primary" onClick={finish}>Done</button></div>
    </>}
  </section>;
}
