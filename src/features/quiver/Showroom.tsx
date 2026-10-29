import {useCallback, useEffect, useId, useRef, useState, type KeyboardEvent} from 'react';
import {Icon} from '../../ui/Icon';
import type {Surfboard} from '../../models/index';
import {lengthLabel, validDimensions} from '../../utils/units';
import {inches} from './format';
import {SWATCHES, TINTS, loadLook, saveLook, templateFor, type Finish, type FinSet, type Look} from './looks';
import {loadOutline} from './outline';
import {tracedTpl} from './traced';
import {Studio, type BoardEntry, type Mode, type Preset} from './studio';

import {SpecCard, StageArrows, Strip, type Dims} from './Overlay';
export type {Dims};
type Step = 'dims' | 'color' | 'finish' | 'fins' | 'view';
const STEPS: {id: Step; label: string}[] = [{id: 'dims', label: 'Dimensions'}, {id: 'color', label: 'Color'}, {id: 'finish', label: 'Finish'}, {id: 'fins', label: 'Fins'}, {id: 'view', label: 'View'}];
const PRESETS: {id: Preset; label: string}[] = [{id: 'deck', label: 'Deck'}, {id: 'bottom', label: 'Bottom'}, {id: 'rail', label: 'Rail'}, {id: 'tail', label: 'Tail'}, {id: '360', label: '360'}];
const FINISHES: {id: Finish; label: string; hint: string}[] = [{id: 'gloss', label: 'Gloss', hint: 'Polished resin'}, {id: 'matte', label: 'Matte', hint: 'Sanded satin'}, {id: 'clear', label: 'Clear', hint: 'Natural foam'}];
const FIN_SETS: {id: FinSet; label: string; hint: string}[] = [{id: 'single', label: 'Single', hint: '1 fin'}, {id: 'twin', label: 'Twin', hint: '2 fins'}, {id: 'thruster', label: 'Thruster', hint: '3 fins'}, {id: 'none', label: 'None', hint: 'No fins'}];

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const fmt = {
  length: lengthLabel, width: inches, thickness: inches, volume: (v: number) => `${+v.toFixed(1)} L`,
};
const LIMITS: Record<keyof Dims, {label: string; min: number; max: number; step: number}> = {
  length: {label: 'Length', min: 48, max: 132, step: 0.5},
  width: {label: 'Width', min: 16, max: 26, step: 0.125},
  thickness: {label: 'Thickness', min: 1.75, max: 4, step: 0.125},
  volume: {label: 'Volume', min: 15, max: 90, step: 0.1},
};
const pick = (b: Surfboard): Dims => ({length: b.length, width: b.width, thickness: b.thickness, volume: b.volume});

interface Props {
  board: Surfboard;
  boards: Surfboard[];
  onSelect: (id: string) => void;
  onSave: (b: Surfboard) => void;
  onFail: () => void;
}

function Swatches({label, value, onPick}: {label: string; value: string; onPick: (hex: string) => void}) {
  const custom = !SWATCHES.some((s) => s.hex.toLowerCase() === value.toLowerCase());
  return (
    <div className="qv-group" role="group" aria-label={`${label} colour`}>
      <span className="qv-group-l">{label}</span>
      <div className="qv-row-o">
        {SWATCHES.map((s) => (
          <button key={s.hex} type="button" className="qv-sw" style={{'--sw': s.hex} as React.CSSProperties} aria-pressed={s.hex.toLowerCase() === value.toLowerCase()} aria-label={`${label}: ${s.name}`} title={s.name} onClick={() => onPick(s.hex)} />
        ))}
        <label className={`qv-sw custom${custom ? ' on' : ''}`} style={{'--sw': value} as React.CSSProperties} title="Custom colour">
          <span className="sr-only">Custom {label.toLowerCase()} colour</span>
          <input type="color" value={value} onChange={(e) => onPick(e.target.value)} />
        </label>
      </div>
    </div>
  );
}

function Slider({id, label, value, min, max, step, text, onChange}: {id: string; label: string; value: number; min: number; max: number; step: number; text: string; onChange: (v: number) => void}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, +v.toFixed(4)));
  return (
    <div className="qv-dim">
      <label htmlFor={id}><span>{label}</span><output htmlFor={id}>{text}</output></label>
      <div className="qv-dim-c">
        <button type="button" className="qv-step-b" aria-label={`Decrease ${label.toLowerCase()}`} onClick={() => onChange(clamp(value - step))}>−</button>
        <input id={id} type="range" min={min} max={max} step={step} value={value} aria-valuetext={text} onChange={(e) => onChange(+e.target.value)} />
        <button type="button" className="qv-step-b" aria-label={`Increase ${label.toLowerCase()}`} onClick={() => onChange(clamp(value + step))}>+</button>
      </div>
    </div>
  );
}

export default function Showroom({board, boards, onSelect, onSave, onFail}: Props) {
  const uid = useId();
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), studio = useRef<Studio | null>(null);
  const [state, setState] = useState(() => ({id: board.id, dims: pick(board), look: loadLook(board)}));
  if (state.id !== board.id) setState({id: board.id, dims: pick(board), look: loadLook(board)});
  const {dims, look} = state;
  const [step, setStep] = useState<Step>('dims');
  const [preset, setPreset] = useState<Preset>('deck');
  const [mode, setModeState] = useState<Mode>('lineup');
  const [room, setRoom] = useState(false);
  const [spin, setSpin] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const noMotion = useRef(reduced()).current;
  const pickRef = useRef(onSelect); pickRef.current = onSelect;

  // The scene lives as long as the showroom does; boards swap inside it.
  useEffect(() => {
    let s: Studio;
    try {
      s = new Studio(canvas.current!, host.current!, {reducedMotion: noMotion, onUserMove: () => { setSpin(false); }, onReady: () => setReady(true), onError: onFail, onPick: (id) => pickRef.current(id)}, 'lineup');
    } catch (e) { console.error('showroom', e); onFail(); return; }
    studio.current = s;
    // The photographed room (Cycles backplate + matching camera); without it the plain gallery stays.
    fetch(`${import.meta.env.BASE_URL ?? '/'}showroom/room.json`).then((r) => (r.ok ? r.json() : null)).then((rm) => { if (rm && studio.current === s) { s.setRoom(rm); setRoom(true); } }).catch(() => {});
    return () => { s.dispose(); studio.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Every board on the rack is built from its saved numbers; the selected one follows the sliders live.
  const template = templateFor({type: board.type, length: dims.length});
  useEffect(() => {
    const entries: BoardEntry[] = boards.map((b) => {
      const mine = b.id === board.id, tpl = mine ? template : templateFor(b), o = loadOutline(b.id), tr = o ? tracedTpl(b.id, tpl, o) : null;
      return {id: b.id, spec: mine ? {template: tpl, ...dims} : {template: tpl, length: b.length, width: b.width, thickness: b.thickness, volume: b.volume}, look: mine ? look : loadLook(b), ...(tr ? {tpl: tr.tpl, tplKey: tr.key} : {}), ...(o?.tex ? {deckTex: o.tex} : {})};
    });
    if (!entries.some((e) => e.id === board.id)) return;
    void studio.current?.setBoards(entries, board.id);
  }, [boards, board.id, template, dims.length, dims.width, dims.thickness, dims.volume, look]);

  // Save dimension edits through the board save path once they settle.
  const maxVol = dims.length * dims.width * dims.thickness * 0.016387;
  const valid = validDimensions(dims.length, dims.width, dims.thickness, dims.volume);
  const changed = dims.length !== board.length || dims.width !== board.width || dims.thickness !== board.thickness || dims.volume !== board.volume;
  const latest = useRef({board, dims, valid, changed, onSave});
  latest.current = {board, dims, valid, changed, onSave};
  useEffect(() => {
    if (!changed || !valid) return;
    const t = setTimeout(() => onSave({...board, ...dims}), 450);
    return () => clearTimeout(t);
  }, [dims.length, dims.width, dims.thickness, dims.volume, valid, changed]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { const c = latest.current; if (c.changed && c.valid) c.onSave({...c.board, ...c.dims}); }, []);

  const setDim = (k: keyof Dims, v: number) => setState((s) => ({...s, dims: {...s.dims, [k]: v}}));
  const setLook = useCallback((patch: Partial<Look>) => setState((s) => { const look = {...s.look, ...patch}; saveLook(s.id, look); return {...s, look}; }), []);

  const go = (p: Preset) => {
    setPreset(p); studio.current?.goTo(p); setSpin(p === '360' && !noMotion);
    setStatus(`${PRESETS.find((x) => x.id === p)!.label} view`);
  };
  const setMode = (m: Mode) => {
    if (m === mode) return;
    setModeState(m); studio.current?.setMode(m); setPreset('deck'); setSpin(m === 'focus' && !noMotion);
    setStatus(m === 'focus' ? `Focus: ${board.name}` : 'Lineup: all boards');
  };
  const steps = STEPS.filter((x) => x.id !== 'view' || mode === 'focus');
  const stepId = steps.some((x) => x.id === step) ? step : 'dims';
  const rack = [...boards].sort((a, b) => a.length - b.length || (a.id < b.id ? -1 : 1));
  const toggleSpin = () => { const on = !spin; setSpin(on); studio.current?.setSpin(on); };
  const stepBoard = (d: -1 | 1) => {
    const i = rack.findIndex((b) => b.id === board.id), n = rack[(i + d + rack.length) % rack.length];
    if (n) { onSelect(n.id); setStatus(`${n.name} selected`); }
  };
  const onKeys = (e: KeyboardEvent) => {
    const s = studio.current; if (!s) return;
    if (mode === 'lineup' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); stepBoard(e.key === 'ArrowRight' ? 1 : -1); return; }
    const k = e.key, map: Record<string, [number, number, number]> = {ArrowLeft: [-0.16, 0, 1], ArrowRight: [0.16, 0, 1], ArrowUp: [0, 0.1, 1], ArrowDown: [0, -0.1, 1], '+': [0, 0, 0.9], '=': [0, 0, 0.9], '-': [0, 0, 1.1]};
    if (map[k]) { e.preventDefault(); s.nudge(...map[k]); setSpin(false); s.setSpin(false); }
  };
  const tabKeys = (e: KeyboardEvent) => {
    const i = steps.findIndex((s) => s.id === stepId);
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? steps.length - 1 : -1;
    if (n < 0) return;
    e.preventDefault(); const next = steps[(n + steps.length) % steps.length].id; setStep(next);
    document.getElementById(`${uid}-t-${next}`)?.focus();
  };

  const toggle = (
    <button type="button" className="qv-cta" onClick={() => setMode(mode === 'lineup' ? 'focus' : 'lineup')}>
      {mode === 'lineup' ? <>View in 3D <Icon name="arrow" size={18} style={{transform: 'rotate(90deg)'}} /></> : <>Back to showroom</>}
    </button>
  );
  return (
    <div className="qv-studio">
      <div className={`qv-stagewrap${mode === 'focus' ? ' focus' : ''}`}>
        <div className={`qv-stage${room && mode === 'lineup' ? ' qv-room' : ''}`} ref={host}>
          <canvas ref={canvas} tabIndex={0} onKeyDown={onKeys} aria-label={mode === 'lineup'
            ? `Showroom rack of ${boards.length} boards at true relative scale. ${board.name} is selected. Left and right arrows choose another board, plus and minus zoom.`
            : `3D view of ${board.name}, an approximate ${board.type.toLowerCase()} shape. Arrow keys turn the board, plus and minus zoom.`} />
          {!ready && <div className="qv-loading skel" aria-hidden="true"><i style={{height: '60%', width: '60%', margin: 'auto'}} /></div>}
          {mode === 'focus' && <p className="qv-hint" aria-hidden="true">{noMotion ? 'Drag to turn' : 'Drag to turn · scroll to zoom'}</p>}
          <p className="sr-only" role="status" aria-live="polite">{status}</p>
        </div>
        <StageArrows onStep={stepBoard} />
        <SpecCard board={board} dims={dims} action={toggle} />
      </div>
      <Strip boards={boards} selectedId={board.id} onSelect={onSelect} />
      <div className="qv-bar">
        <div id={`${uid}-p-${stepId}`} className="qv-opts" role="tabpanel" aria-labelledby={`${uid}-t-${stepId}`}>
          {stepId === 'dims' && (
            <div className="qv-dims">
              {(Object.keys(LIMITS) as (keyof Dims)[]).map((k) => {
                const L = LIMITS[k];
                return <Slider key={k} id={`${uid}-d-${k}`} label={L.label} value={dims[k]} min={Math.min(L.min, dims[k])} max={Math.max(L.max, dims[k])} step={L.step} text={fmt[k](dims[k])} onChange={(v) => setDim(k, v)} />;
              })}
              <p className={`qv-note${valid ? '' : ' warn'}`} role="status">{valid ? (changed ? 'Saving to this board…' : 'Changes save to this board.') : `Not saved yet: volume has to fit the dimensions (up to ${maxVol.toFixed(1)} L here).`}</p>
            </div>
          )}
          {stepId === 'color' && (
            <div className="qv-color">
              <Swatches label="Deck" value={look.deck} onPick={(hex) => setLook({deck: hex, finish: look.finish === 'clear' ? 'gloss' : look.finish})} />
              <Swatches label="Bottom" value={look.bottom} onPick={(hex) => setLook({bottom: hex, finish: look.finish === 'clear' ? 'gloss' : look.finish})} />
              <div className="qv-group">
                <label className="qv-group-l" htmlFor={`${uid}-fade`}>Rail fade <output>{Math.round(look.fade * 100)}%</output></label>
                <input id={`${uid}-fade`} className="qv-range" type="range" min={0} max={1} step={0.01} value={look.fade} onChange={(e) => setLook({fade: +e.target.value})} />
                {look.finish === 'clear' && <span className="qv-note">Clear shows natural foam. Picking a colour switches to Gloss.</span>}
              </div>
            </div>
          )}
          {stepId === 'finish' && (
            <div className="qv-color">
              <div className="qv-group" role="group" aria-label="Finish">
                <span className="qv-group-l">Finish</span>
                <div className="qv-row-o">{FINISHES.map((f) => (
                  <button key={f.id} type="button" className="qv-pick" aria-pressed={look.finish === f.id} onClick={() => setLook({finish: f.id})}><b>{f.label}</b><span>{f.hint}</span></button>
                ))}</div>
              </div>
              <div className="qv-group" role="group" aria-label="Resin tint">
                <span className="qv-group-l">Resin tint</span>
                <div className="qv-row-o">{TINTS.map((t) => (
                  <button key={t.key} type="button" className={`qv-pick tint${t.key === 'none' ? ' none' : ''}`} style={{'--sw': t.hex} as React.CSSProperties} aria-pressed={look.tint === t.key} onClick={() => setLook({tint: t.key})}><i aria-hidden="true" /><b>{t.name}</b></button>
                ))}</div>
              </div>
            </div>
          )}
          {stepId === 'fins' && (
            <div className="qv-row-o" role="group" aria-label="Fin setup">
              {FIN_SETS.map((f) => (
                <button key={f.id} type="button" className="qv-pick" aria-pressed={look.fins === f.id} onClick={() => setLook({fins: f.id})}><b>{f.label}</b><span>{f.hint}</span></button>
              ))}
            </div>
          )}
          {stepId === 'view' && (
            <div className="qv-row-o" role="group" aria-label="Camera view">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className="qv-pick" aria-pressed={preset === p.id} onClick={() => go(p.id)}><b>{p.label}</b></button>
              ))}
              <button type="button" className="qv-pick" aria-pressed={spin} disabled={noMotion} onClick={toggleSpin}><b>Auto-spin</b><span>{noMotion ? 'Off: reduced motion' : spin ? 'On' : 'Off'}</span></button>
            </div>
          )}
        </div>
        <div className="qv-steps" role="tablist" aria-label="Configure your board" onKeyDown={tabKeys}>
          {steps.map((s, i) => (
            <button key={s.id} id={`${uid}-t-${s.id}`} type="button" role="tab" aria-selected={stepId === s.id} aria-controls={`${uid}-p-${s.id}`} tabIndex={stepId === s.id ? 0 : -1} onClick={() => setStep(s.id)}>
              <span className="qv-n" aria-hidden="true">{i + 1}</span>{s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
