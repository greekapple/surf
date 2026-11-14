import {useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode} from 'react';
import type {Surfboard} from '../../models/index';
import {Icon} from '../../ui/Icon';
import {lengthLabel, validDimensions} from '../../utils/units';
import {useSwello} from '../../app/store';
import {inches} from './format';
import {SWATCHES, finsFromText, loadLook, resolvedLook, saveLook, templateFor, trimFor, type Finish, type FinSet, type Look} from './looks';
import {loadOutline} from './outline';
import {referenceTpl, tracedTpl} from './traced';
import {referenceFor} from '../../data/referenceBoards';
import {Studio, type BoardEntry, type Preset} from './studio';
import {BoardOutline} from './BoardOutline';

/* T-035 board room, rebuilt in quiver-lock (2026-11-14, docs/specs/2026-11-14-quiver-polish.md section 4): ONE interactive 3D stage for the selected board.
 * Drag turns the board freely on both axes with inertia, the wheel or a pinch zooms, a double tap resets, the arrow keys turn it; the view shortcuts (Deck, Bottom, Rail, Tail, Nose) are a
 * secondary row; no step counter, no auto-spin, no hotspots. The model is built from the board's own numbers and outline (traced, example or category). In Edit the options change the
 * model live as a draft; only Save writes them to the board. */

type Dims = {length: number; width: number; thickness: number; volume: number};
const ANGLES: {id: Preset; label: string}[] = [
  {id: 'three', label: '¾ view'}, {id: 'deck', label: 'Deck'}, {id: 'bottom', label: 'Bottom'}, {id: 'rail', label: 'Rail'}, {id: 'tail', label: 'Tail'}, {id: 'nose', label: 'Nose'},
];
const FIN_SETS: {id: FinSet; label: string}[] = [{id: 'single', label: 'Single'}, {id: 'twin', label: 'Twin'}, {id: 'thruster', label: 'Thruster'}, {id: 'quad', label: 'Quad'}, {id: 'none', label: 'None'}];
const TAILS = ['Squash', 'Round', 'Pin', 'Swallow', 'Square'];
const BUILDS: {id: string; label: string; finish: Finish}[] = [{id: 'PU', label: 'PU / polyester', finish: 'gloss'}, {id: 'Epoxy', label: 'Epoxy', finish: 'clear'}, {id: 'Soft-top', label: 'Soft-top', finish: 'matte'}];
const STEP: Record<keyof Dims, number> = {length: 1, width: 0.25, thickness: 0.125, volume: 0.5};
const FMT: Record<keyof Dims, (v: number) => string> = {length: lengthLabel, width: inches, thickness: inches, volume: (v) => `${+v.toFixed(1)} L`};
const LABEL: Record<keyof Dims, string> = {length: 'Length', width: 'Width', thickness: 'Thickness', volume: 'Volume'};
const pickDims = (b: Surfboard): Dims => ({length: b.length, width: b.width, thickness: b.thickness, volume: b.volume});
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const said = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
const finWord = (f: FinSet) => FIN_SETS.find((x) => x.id === f)!.label;

interface Draft {id: string; dims: Dims; look: Look; tail: string; construction: string}
/** The board as saved. Recorded fins win over the stored look, so the model and the fins fact never disagree. */
const savedOf = (b: Surfboard): Draft => {
  return {id: b.id, dims: pickDims(b), look: resolvedLook(b) /* the record's Fins wins (looks.ts, shared with the 2D renderer) */, tail: said(b.tail) ?? '', construction: said(b.construction) ?? ''};
};
/** Unsaved drafts survive leaving the board room (Edit, Board Match, another board) for this browser session; Save or Discard clears them. */
const DRAFTS = 'swello-boardroom-drafts';
const readDrafts = (): Record<string, Draft> => { try { const v = JSON.parse(sessionStorage.getItem(DRAFTS) ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const keepDraft = (dr: Draft | null, id: string) => { try { const all = readDrafts(); if (dr) all[id] = dr; else delete all[id]; sessionStorage.setItem(DRAFTS, JSON.stringify(all)); } catch { /* no session storage: the draft lasts while the board room is open */ } };
const fresh = (b: Surfboard): Draft => { const k = readDrafts()[b.id]; return k && k.id === b.id && k.dims && k.look ? k : savedOf(b); };

function Swatch({on, label, onClick, children, style}: {on: boolean; label: string; onClick: () => void; children?: ReactNode; style?: CSSProperties}) {
  return <button type="button" className="br-sw" aria-pressed={on} aria-label={label} title={label} onClick={onClick} style={style}>{children}</button>;
}

interface Props {
  board: Surfboard;
  onSave: (b: Surfboard) => void; onFail: () => void;
  /** read mode: the spec list (and its actions), shown beside or under the stage */
  side: ReactNode;
  /** Edit: the controls replace the spec list; Save and Discard end it */
  editing: boolean; onDone: () => void; onDetails: () => void;
  /** under the stage (a phone's board strip) */
  under?: ReactNode;
}
const HINT_KEY = 'swello-quiver-turn-hint-v1';
const hintSeen = () => { try { return localStorage.getItem(HINT_KEY) === '1'; } catch { return false; } };

export default function BoardRoom({board, onSave, onFail, side, editing, onDone, onDetails, under}: Props) {
  useSwello();   // the room lives inside the store's provider (ranges and units are read by the parent)
  const uid = useId();
  const wrap = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), studio = useRef<Studio | null>(null);
  const [draft, setDraftState] = useState<Draft>(() => fresh(board));
  const d = draft.id === board.id ? draft : fresh(board);
  if (draft.id !== board.id) setDraftState(d); // another board selected: its own saved values, or its unsaved draft from this session
  const setDraft = (next: Draft) => { setDraftState(next); keepDraft(next, next.id); };
  const [full, setFull] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const [hint, setHint] = useState(() => !hintSeen());
  const noMotion = useRef(reduced()).current;
  const dismissHint = () => { setHint(false); try { localStorage.setItem(HINT_KEY, '1'); } catch { /* remembered for this visit only */ } };

  useEffect(() => {
    let s: Studio;
    try {
      s = new Studio(canvas.current!, host.current!, {reducedMotion: noMotion, onUserMove: () => dismissHint(), onReady: () => setReady(true), onError: onFail, onPick: () => {}}, 'focus');
    } catch (e) { console.error('board room', e); onFail(); return; }
    studio.current = s;
    if (import.meta.env.DEV) Object.assign(window, {__studio: s}); // browser QA reads the camera; stripped from builds
    return () => { s.dispose(); studio.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The selected board follows the draft live.
  const entry = (b: Surfboard): BoardEntry => {
    const dims = d.dims, tpl = templateFor({type: b.type, length: dims.length}), o = loadOutline(b.id), tail = d.tail;
    // an example board (no outline of the person's own): its own hull at its own numbers, its procedural deck pattern along its outline
    const ref = o ? null : referenceFor(b), rt = ref ? referenceTpl(b, dims, tail) : null, tr = rt ?? (o ? tracedTpl(b.id, tpl, o) : null);
    return {id: b.id, spec: {template: tpl, ...dims, tail, ...(rt ? {exact: true, softTop: !!ref?.softTop} : {})}, look: d.look, trim: trimFor(b), ...(tr ? {tpl: tr.tpl, tplKey: tr.key} : {}), ...(o?.tex ? {deckTex: o.tex} : {}), ...(ref ? {patternHw: ref.hw} : {})} as BoardEntry;
  };
  const shown = useRef('');
  useEffect(() => {
    const s = studio.current; if (!s) return;
    const first = shown.current !== board.id; shown.current = board.id;
    void s.setBoards([entry(board)], board.id).then(() => { if (first) s.goTo('three'); });
  }, [board.id, d.dims.length, d.dims.width, d.dims.thickness, d.dims.volume, d.tail, JSON.stringify(d.look)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { studio.current?.setFull(full); }, [full]);
  useEffect(() => { if (!full) return; const k = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setFull(false); }; addEventListener('keydown', k); const o = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { removeEventListener('keydown', k); document.body.style.overflow = o; }; }, [full]);

  const go = (p: Preset, label: string) => { studio.current?.goTo(p); dismissHint(); setStatus(`${label} view`); };
  const reset = () => { studio.current?.reset(); setStatus('View reset'); };
  const onKeys = (e: KeyboardEvent) => {
    const s = studio.current; if (!s) return;
    const map: Record<string, [number, number, number]> = {ArrowLeft: [-0.16, 0, 1], ArrowRight: [0.16, 0, 1], ArrowUp: [0, -0.16, 1], ArrowDown: [0, 0.16, 1], '+': [0, 0, 0.9], '=': [0, 0, 0.9], '-': [0, 0, 1.1], '_': [0, 0, 1.1]};
    if (map[e.key]) { e.preventDefault(); s.nudge(...map[e.key]); dismissHint(); }
    else if (e.key === 'Home') { e.preventDefault(); reset(); }
  };

  // Draft editing; Save writes the board record and the look together.
  const saved = savedOf(board);
  const setDims = (k: keyof Dims, v: number) => setDraft({...d, dims: {...d.dims, [k]: +v.toFixed(3)}});
  const setLook = (p: Partial<Look>) => setDraft({...d, look: {...d.look, ...p}});
  const dirty = JSON.stringify([d.dims, d.look, d.tail, d.construction]) !== JSON.stringify([saved.dims, saved.look, saved.tail, saved.construction]);
  const valid = validDimensions(d.dims.length, d.dims.width, d.dims.thickness, d.dims.volume);
  const save = () => {
    if (!valid) return;
    const finsChanged = d.look.fins !== saved.look.fins;
    onSave({...board, ...d.dims, tail: d.tail || board.tail, construction: d.construction || board.construction, fins: finsChanged ? finWord(d.look.fins) : board.fins});
    const lookStored = saveLook(board.id, d.look); keepDraft(null, board.id);
    setStatus(lookStored ? 'Saved to this board' : 'Saved the numbers, fins and tail. The color and finish could not be stored in this browser, so they last only for this visit.');
    onDone();
  };
  const discard = () => { keepDraft(null, board.id); setDraftState(savedOf(board)); setStatus('Changes discarded'); onDone(); };
  const outline = loadOutline(board.id);
  const shapeNote = outline?.tex ? 'Deck from your photo; outline traced from it.' : outline ? 'Outline traced from your photo.' : 'The 3D shape is approximate, built from this board\'s dimensions.';

  return (
    <div className="br">
      <div className="br-stagecol">
        <div className={`br-stage${full ? ' full' : ''}`} ref={wrap}>
          <div className="br-canvas" ref={host}>
            <canvas ref={canvas} tabIndex={0} onKeyDown={onKeys} aria-label={`3D view of ${board.name}. ${shapeNote} Drag to turn it on any axis, the arrow keys to turn, plus and minus to zoom, Home to reset.`} />
          </div>
          {/* while the model loads, the board's own outline (faded, pulsing) instead of a grey block */}
          {!ready && <div className="br-load" aria-hidden="true"><BoardOutline b={board} scale={4} /></div>}
          {ready && hint && <p className="br-hint" aria-hidden="true">Drag to turn</p>}
          <div className="br-corner" role="toolbar" aria-label="3D view controls">
            <button type="button" className="br-ic" aria-label="Reset the view" title="Reset view (Home)" onClick={reset}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 1 0 2-4.5M4 4v3.5h3.5" /></svg></button>
            <button type="button" className="br-ic" aria-label={full ? 'Close full screen' : 'Full screen'} aria-pressed={full} title={full ? 'Close full screen' : 'Full screen'} onClick={() => setFull(!full)}>
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d={full ? 'M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5' : 'M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5'} /></svg></button>
          </div>
          <p className="sr-only" role="status" aria-live="polite">{status}</p>
        </div>
        <div className="br-views" role="group" aria-label="Jump to a view">
          {ANGLES.map((a) => <button key={a.id} type="button" onClick={() => go(a.id, a.label)}>{a.label}</button>)}
        </div>
        <p className="br-note">{shapeNote}</p>
        {under}
      </div>

      {!editing ? <div className="br-side">{side}</div> : (
      <aside className="br-panel" aria-label={`Edit ${board.name}`}>
        <header className="br-h"><h2><span className="br-name">Edit {board.name}</span></h2>
          <p className="fine">Changes show on the model first and are saved only when you press Save.</p>
          <button type="button" className="btn" onClick={onDetails}>Name, maker, notes or delete…</button></header>

        <section className="br-group" aria-labelledby={`${uid}-g-dims`}>
          <h3 id={`${uid}-g-dims`}>Dimensions</h3>
          <div className="br-dims">{(Object.keys(STEP) as (keyof Dims)[]).map((k) => (
            <div key={k} className="br-dim">
              <span className="k">{LABEL[k]}</span>
              <div className="c">
                <button type="button" aria-label={`Decrease ${LABEL[k].toLowerCase()}`} onClick={() => setDims(k, d.dims[k] - STEP[k])}>−</button>
                <output aria-live="polite">{FMT[k](d.dims[k])}</output>
                <button type="button" aria-label={`Increase ${LABEL[k].toLowerCase()}`} onClick={() => setDims(k, d.dims[k] + STEP[k])}>+</button>
              </div>
            </div>
          ))}</div>
          {!valid && <p className="br-note warn" role="status">These numbers don't fit together (volume up to {(d.dims.length * d.dims.width * d.dims.thickness * 0.016387).toFixed(1)} L here). Save is off until they do.</p>}
        </section>

        <section className="br-group" aria-labelledby={`${uid}-g-fins`}>
          <h3 id={`${uid}-g-fins`}>Fins <span className="sel">{finWord(d.look.fins)}</span></h3>
          <div className="br-row">{FIN_SETS.map((f) => (
            <Swatch key={f.id} on={d.look.fins === f.id} label={`Fins: ${f.label}`} onClick={() => setLook({fins: f.id})}>
              <svg viewBox="0 0 40 24" aria-hidden="true" className="br-fin"><path d="M2 12 C 10 3, 30 3, 38 12 C 30 21, 10 21, 2 12 Z" />{f.id === 'single' && <rect x="6" y="11" width="6" height="2" />}{f.id === 'twin' && <><rect x="8" y="7.5" width="6" height="2" /><rect x="8" y="14.5" width="6" height="2" /></>}{f.id === 'thruster' && <><rect x="9" y="7.5" width="5" height="2" /><rect x="9" y="14.5" width="5" height="2" /><rect x="4" y="11" width="5" height="2" /></>}{f.id === 'quad' && <><rect x="10" y="7.5" width="5" height="2" /><rect x="10" y="14.5" width="5" height="2" /><rect x="4" y="8.5" width="4" height="2" /><rect x="4" y="13.5" width="4" height="2" /></>}</svg>
              <span>{f.label}</span>
            </Swatch>
          ))}</div>
        </section>

        <section className="br-group" aria-labelledby={`${uid}-g-tail`}>
          <h3 id={`${uid}-g-tail`}>Tail <span className="sel">{d.tail || 'Not recorded'}</span></h3>
          <div className="br-row">{TAILS.map((t) => (
            <Swatch key={t} on={d.tail.toLowerCase() === t.toLowerCase()} label={`Tail: ${t}`} onClick={() => setDraft({...d, tail: t})}><span>{t}</span></Swatch>
          ))}</div>
          <p className="br-note">The 3D tail is an approximation of the shape, not your board's exact outline.</p>
        </section>

        <section className="br-group" aria-labelledby={`${uid}-g-build`}>
          <h3 id={`${uid}-g-build`}>Construction <span className="sel">{d.construction || 'Not recorded'}</span></h3>
          <div className="br-row">{BUILDS.map((c) => (
            <Swatch key={c.id} on={d.construction.toLowerCase() === c.id.toLowerCase()} label={`Construction: ${c.label}`} onClick={() => setDraft({...d, construction: c.id, look: {...d.look, finish: c.finish}})}><span>{c.label}</span></Swatch>
          ))}</div>
        </section>

        <section className="br-group" aria-labelledby={`${uid}-g-col`}>
          <h3 id={`${uid}-g-col`}>Color <span className="sel">{d.look.pattern === 'carbon' ? 'Carbon weave' : d.look.pattern === 'stripes' ? 'Blue stripes' : SWATCHES.find((s) => s.hex.toLowerCase() === d.look.deck.toLowerCase())?.name ?? 'Custom'}</span></h3>
          <div className="br-row col">{SWATCHES.map((s) => (
            <Swatch key={s.hex} on={s.hex.toLowerCase() === d.look.deck.toLowerCase()} label={`Colour: ${s.name}`} style={{'--sw': s.hex} as CSSProperties} onClick={() => setLook({deck: s.hex, finish: d.look.finish === 'clear' ? 'gloss' : d.look.finish, pattern: undefined})} />
          ))}</div>
        </section>


        <div className="br-save">
          <button type="button" className="btn primary" disabled={!dirty || !valid} onClick={save}>Save to board</button>
          <button type="button" className="btn" onClick={discard}>{dirty ? 'Discard changes' : 'Done'}</button>
          <span className="br-note">{dirty ? 'Unsaved changes: the model shows them, the board does not have them yet.' : ''}</span>
        </div>
      </aside>
      )}
    </div>
  );
}
