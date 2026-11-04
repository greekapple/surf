import {useEffect, useState} from 'react';
import {type DevOverrides, SKILL_VALUES} from './sceneDev';
import type {GlitchCounts} from './glitchMonitor';

/** Dev-only panel under the 3D view: force face, skill, stance, direction, seed; toggle the scale pole; watch the glitch monitor. */
export function SceneDevPanel({value, onChange}: {value: DevOverrides; onChange: (o: DevOverrides) => void}) {
  const [g, setG] = useState<GlitchCounts | null>(null), [fps, setFps] = useState('');
  useEffect(() => {
    const id = setInterval(() => {
      const w = (window as unknown as {__wave?: {glitches?: () => GlitchCounts}}).__wave; try { setG(w?.glitches ? {...w.glitches(), events: w.glitches().events.slice(-3)} : null); } catch { setG(null); }
      const h = document.querySelector<HTMLElement>('.live-host'); setFps(h ? `${h.dataset.fps ?? '–'} fps · worst ${h.dataset.worstMs ?? '–'} ms · ${h.dataset.skill ?? ''} ${h.dataset.stance ?? ''} ${h.dataset.frontside === '1' ? 'frontside' : h.dataset.frontside === '0' ? 'backside' : ''}` : '');
    }, 500);
    return () => clearInterval(id);
  }, []);
  const set = (patch: Partial<DevOverrides>) => onChange({...value, ...patch});
  return (
    <details className="sc-dev" open>
      <summary>3D dev: force inputs (never in production)</summary>
      <div className="sc-dev-row">
        <label>face ft <input type="number" step="0.5" min="0.5" max="40" value={value.faceFt ?? ''} onChange={(e) => set({faceFt: e.target.value === '' ? null : Number(e.target.value)})} /></label>
        <label>skill <select value={value.skill ?? ''} onChange={(e) => set({skill: (e.target.value || null) as DevOverrides['skill']})}><option value="">profile</option>{SKILL_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
        <label>stance <select value={value.stance ?? ''} onChange={(e) => set({stance: (e.target.value || null) as DevOverrides['stance']})}><option value="">seeded</option><option value="regular">regular</option><option value="goofy">goofy</option></select></label>
        <label>dir <select value={value.dir ?? ''} onChange={(e) => set({dir: (e.target.value || null) as DevOverrides['dir']})}><option value="">toggle</option><option value="left">left</option><option value="right">right</option></select></label>
        <label>seed <input type="number" step="1" value={value.seed ?? ''} onChange={(e) => set({seed: e.target.value === '' ? null : Number(e.target.value)})} /></label>
        <label><input type="checkbox" checked={value.pole} onChange={(e) => set({pole: e.target.checked})} /> 6 ft pole</label>
      </div>
      <p className="fine">{fps}{g ? ` · glitches ${g.total} (joint ${g.joint}, board ${g.board}, float ${g.float}, clip ${g.clip}) over ${g.frames} frames · worst joint ${g.worstJointDeg.toFixed(1)} deg, board ${g.worstBoardDeg.toFixed(1)} deg` : ' · monitor not running'}</p>
    </details>
  );
}
