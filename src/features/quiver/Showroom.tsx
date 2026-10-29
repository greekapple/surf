import {useCallback, useEffect, useId, useRef, useState, type KeyboardEvent} from 'react';
import type {Surfboard} from '../../models/index';
import {lengthLabel, validDimensions} from '../../utils/units';
import {inches} from './format';
import {SWATCHES, TINTS, loadLook, saveLook, templateFor, type Finish, type FinSet, type Look} from './looks';
import {Studio, type Preset} from './studio';

export interface Dims {length: number; width: number; thickness: number; volume: number}
type Step = 'board' | 'dims' | 'color' | 'finish' | 'fins' | 'view';
const STEPS: {id: Step; label: string}[] = [{id: 'board', label: 'Board'}, {id: 'dims', label: 'Dimensions'}, {id: 'color', label: 'Color'}, {id: 'finish', label: 'Finish'}, {id: 'fins', label: 'Fins'}, {id: 'view', label: 'View'}];
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
  onLive: (d: (Dims & {id: string}) | null) => void;
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

export default function Showroom({board, boards, onSelect, onSave, onLive, onFail}: Props) {
  const uid = useId();
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), studio = useRef<Studio | null>(null);
  const [state, setState] = useState(() => ({id: board.id, dims: pick(board), look: loadLook(board)}));
  if (state.id !== board.id) setState({id: board.id, dims: pick(board), look: loadLook(board)});
  const {dims, look} = state;
  const [step, setStep] = useState<Step>('board');
  const [preset, setPreset] = useState<Preset>('deck');
  const [spin, setSpin] = useState(!reduced());
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const noMotion = useRef(reduced()).current;

  // The scene lives as long as the showroom does; boards swap inside it.
  useEffect(() => {
    let s: Studio;
    try {
      s = new Studio(canvas.current!, host.current!, {reducedMotion: noMotion, onUserMove: () => { setSpin(false); }, onReady: () => setReady(true), onError: onFail});
    } catch (e) { console.error('showroom', e); onFail(); return; }
    studio.current = s;
    return () => { s.dispose(); studio.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const template = templateFor({type: board.type, length: dims.length});
  useEffect(() => { void studio.current?.setBoard({template, ...dims}); }, [template, dims.length, dims.width, dims.thickness, dims.volume]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { studio.current?.setLook(look); }, [look]);

  // Live numbers for the spec card.
  useEffect(() => { onLive({id: board.id, ...dims}); }, [board.id, dims.length, dims.width, dims.thickness, dims.volume]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => onLive(null), []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const toggleSpin = () => { const on = !spin; setSpin(on); studio.current?.setSpin(on); };
  const onKeys = (e: KeyboardEvent) => {
    const s = studio.current; if (!s) return;
    const k = e.key, map: Record<string, [number, number, number]> = {ArrowLeft: [-0.16, 0, 1], ArrowRight: [0.16, 0, 1], ArrowUp: [0, 0.1, 1], ArrowDown: [0, -0.1, 1], '+': [0, 0, 0.9], '=': [0, 0, 0.9], '-': [0, 0, 1.1]};
    if (map[k]) { e.preventDefault(); s.nudge(...map[k]); setSpin(false); s.setSpin(false); }
  };
  const tabKeys = (e: KeyboardEvent) => {
    const i = STEPS.findIndex((s) => s.id === step);
    const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? STEPS.length - 1 : -1;
    if (n < 0) return;
    e.preventDefault(); const next = STEPS[(n + STEPS.length) % STEPS.length].id; setStep(next);
    document.getElementById(`${uid}-t-${next}`)?.focus();
  };

  return (
    <div className="qv-studio">
      <div className="qv-stage" ref={host}>
        <canvas ref={canvas} tabIndex={0} onKeyDown={onKeys} aria-label={`3D view of ${board.name}, an approximate ${board.type.toLowerCase()} shape. Arrow keys turn the board, plus and minus zoom.`} />
        {!ready && <p className="qv-loading" role="status">Loading the board…</p>}
        <p className="qv-hint" aria-hidden="true">{noMotion ? 'Drag to turn' : 'Drag to turn · scroll to zoom'}</p>
        <p className="sr-only" role="status" aria-live="polite">{status}</p>
      </div>
      <div className="qv-bar">
        <div id={`${uid}-p-${step}`} className="qv-opts" role="tabpanel" aria-labelledby={`${uid}-t-${step}`}>
          {step === 'board' && (
            <div className="qv-row-o" role="group" aria-label="Choose a board">
              {boards.map((b) => (
                <button key={b.id} type="button" className="qv-pick" aria-pressed={b.id === board.id} onClick={() => onSelect(b.id)}>
                  <b>{b.name}</b><span>{b.type} · {lengthLabel(b.length)}{b.demo ? ' · example' : ''}</span>
                </button>
              ))}
            </div>
          )}
          {step === 'dims' && (
            <div className="qv-dims">
              {(Object.keys(LIMITS) as (keyof Dims)[]).map((k) => {
                const L = LIMITS[k];
                return <Slider key={k} id={`${uid}-d-${k}`} label={L.label} value={dims[k]} min={Math.min(L.min, dims[k])} max={Math.max(L.max, dims[k])} step={L.step} text={fmt[k](dims[k])} onChange={(v) => setDim(k, v)} />;
              })}
              <p className={`qv-note${valid ? '' : ' warn'}`} role="status">{valid ? (changed ? 'Saving to this board…' : 'Changes save to this board.') : `Not saved yet: volume has to fit the dimensions (up to ${maxVol.toFixed(1)} L here).`}</p>
            </div>
          )}
          {step === 'color' && (
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
          {step === 'finish' && (
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
          {step === 'fins' && (
            <div className="qv-row-o" role="group" aria-label="Fin setup">
              {FIN_SETS.map((f) => (
                <button key={f.id} type="button" className="qv-pick" aria-pressed={look.fins === f.id} onClick={() => setLook({fins: f.id})}><b>{f.label}</b><span>{f.hint}</span></button>
              ))}
            </div>
          )}
          {step === 'view' && (
            <div className="qv-row-o" role="group" aria-label="Camera view">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className="qv-pick" aria-pressed={preset === p.id} onClick={() => go(p.id)}><b>{p.label}</b></button>
              ))}
              <button type="button" className="qv-pick" aria-pressed={spin} disabled={noMotion} onClick={toggleSpin}><b>Auto-spin</b><span>{noMotion ? 'Off: reduced motion' : spin ? 'On' : 'Off'}</span></button>
            </div>
          )}
        </div>
        <div className="qv-steps" role="tablist" aria-label="Configure your board" onKeyDown={tabKeys}>
          {STEPS.map((s, i) => (
            <button key={s.id} id={`${uid}-t-${s.id}`} type="button" role="tab" aria-selected={step === s.id} aria-controls={`${uid}-p-${s.id}`} tabIndex={step === s.id ? 0 : -1} onClick={() => setStep(s.id)}>
              <span className="qv-n" aria-hidden="true">{i + 1}</span>{s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
