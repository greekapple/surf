import {useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as RPointerEvent, type ReactNode} from 'react';
import type {Surfboard} from '../../models/index';
import {Icon} from '../../ui/Icon';
import {lengthLabel, validDimensions} from '../../utils/units';
import {inches} from './format';
import {SWATCHES, finsFromText, loadLook, saveLook, templateFor, type Finish, type FinSet, type Look} from './looks';
import {loadOutline} from './outline';
import {tracedTpl} from './traced';
import {Studio, type Anchor, type BoardEntry, type Preset} from './studio';
import {BoardOutline} from './BoardOutline';
import type {SizeFit} from './fit';

/* T-035 board room (reference: the Porsche 911 configurator, docs/design/REFERENCES-2026-10-31.md §1).
 * One board, large, on a light set; real-time three.js from the board's numbers and outline (traced or category).
 * Options change the model live as a draft; only Save writes them to the board. Hotspots show facts from the board record. */

type Dims = {length: number; width: number; thickness: number; volume: number};
const ANGLES: {id: Exclude<Preset, '360'>; label: string}[] = [
  {id: 'three', label: '¾ view'}, {id: 'deck', label: 'Deck'}, {id: 'bottom', label: 'Bottom'}, {id: 'rail', label: 'Rail'}, {id: 'tail', label: 'Tail'}, {id: 'nose', label: 'Nose'},
];
const FIN_SETS: {id: FinSet; label: string}[] = [{id: 'single', label: 'Single'}, {id: 'twin', label: 'Twin'}, {id: 'thruster', label: 'Thruster'}, {id: 'none', label: 'None'}];
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
  const look = loadLook(b);
  return {id: b.id, dims: pickDims(b), look: said(b.fins) ? {...look, fins: finsFromText(b)} : look, tail: said(b.tail) ?? '', construction: said(b.construction) ?? ''};
};
/** Unsaved drafts survive leaving the board room (Edit, Board Match, another board) for this browser session; Save or Discard clears them. */
const DRAFTS = 'swello-boardroom-drafts';
const readDrafts = (): Record<string, Draft> => { try { const v = JSON.parse(sessionStorage.getItem(DRAFTS) ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
const keepDraft = (dr: Draft | null, id: string) => { try { const all = readDrafts(); if (dr) all[id] = dr; else delete all[id]; sessionStorage.setItem(DRAFTS, JSON.stringify(all)); } catch { /* no session storage: the draft lasts while the board room is open */ } };
const fresh = (b: Surfboard): Draft => { const k = readDrafts()[b.id]; return k && k.id === b.id && k.dims && k.look ? k : savedOf(b); };

/** A tiny board drawn from one camera angle, for the angle thumbnails. */
function AngleGlyph({id}: {id: Exclude<Preset, '360'>}) {
  const board = 'M6 20 C 14 10, 44 9, 58 20 C 44 31, 14 30, 6 20 Z';
  const body = id === 'rail' ? <path d="M4 21 C 20 17, 44 17, 60 20 L 60 22 C 44 23, 20 24, 4 22 Z" />
    : id === 'tail' ? <path d="M-10 6 C 20 6, 40 10, 40 20 C 40 30, 20 34, -10 34 Z" />
    : id === 'nose' ? <path d="M74 6 C 44 6, 24 12, 20 20 C 24 28, 44 34, 74 34 Z" />
    : id === 'three' ? <path d={board} transform="rotate(-14 32 20) skewX(-18) translate(6 0)" />
    : <path d={board} />;
  return (
    <svg viewBox="0 0 64 40" aria-hidden="true" className={`br-glyph${id === 'bottom' ? ' bottom' : ''}`}>
      {body}
      {id === 'deck' || id === 'three' ? <line x1="8" y1="20" x2="56" y2="20" className="str" transform={id === 'three' ? 'rotate(-14 32 20) skewX(-18) translate(6 0)' : undefined} /> : null}
      {id === 'bottom' && <><circle cx="13" cy="17" r="1.6" /><circle cx="13" cy="23" r="1.6" /></>}
    </svg>
  );
}

function Swatch({on, label, onClick, children, style}: {on: boolean; label: string; onClick: () => void; children?: ReactNode; style?: CSSProperties}) {
  return <button type="button" className="br-sw" aria-pressed={on} aria-label={label} title={label} onClick={onClick} style={style}>{children}</button>;
}

interface Props {
  board: Surfboard; boards: Surfboard[];
  onSave: (b: Surfboard) => void; onFail: () => void;
  match: ReactNode; matchAction: ReactNode;
  /** T-050: pick another board from the rail (it flies onto the stage); its size fit for the selected spot-hour. */
  onPick?: (id: string) => void; fits?: Map<string, SizeFit>;
}

export default function BoardRoom({board, boards, onSave, onFail, match, matchAction, onPick, fits}: Props) {
  const uid = useId();
  const wrap = useRef<HTMLDivElement>(null), host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), studio = useRef<Studio | null>(null);
  const hot = useRef<Partial<Record<Anchor, HTMLButtonElement | null>>>({});
  const [draft, setDraftState] = useState<Draft>(() => fresh(board));
  const d = draft.id === board.id ? draft : fresh(board);
  if (draft.id !== board.id) setDraftState(d); // another board selected: its own saved values, or its unsaved draft from this session
  const setDraft = (next: Draft) => { setDraftState(next); keepDraft(next, next.id); };
  const [angle, setAngle] = useState(0);
  const angleRef = useRef(0); angleRef.current = angle;
  const [compare, setCompare] = useState<string | null>(null);
  const [spin, setSpin] = useState(false);
  const spinRef = useRef(false); spinRef.current = spin;
  const canFull = typeof document !== 'undefined' && !!document.fullscreenEnabled;
  const [full, setFull] = useState(false);
  const [open, setOpenState] = useState<Anchor | null>(null);
  const setOpen = (k: Anchor | null) => { openRef.current = k; setOpenState(k); };
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('');
  const noMotion = useRef(reduced()).current;

  // Hotspots follow the board every rendered frame (written straight to the DOM, no React re-render per frame).
  const openRef = useRef<Anchor | null>(null);
  const place = () => {
    const a = studio.current?.anchors();
    if (openRef.current && !a?.[openRef.current]?.on) { openRef.current = null; setOpen(null); }
    for (const k of ['nose', 'tail', 'fins', 'rail'] as Anchor[]) {
      const el = hot.current[k]; if (!el) continue;
      const p = a?.[k];
      el.style.transform = p ? `translate(${p.x}px, ${p.y}px)` : '';
      el.dataset.on = p?.on ? '1' : '0';
    }
  };
  useEffect(() => {
    let s: Studio;
    try {
      s = new Studio(canvas.current!, host.current!, {reducedMotion: noMotion, onUserMove: () => { setSpin(false); }, onReady: () => setReady(true), onError: onFail, onPick: () => {}, onFrame: place}, 'focus');
    } catch (e) { console.error('board room', e); onFail(); return; }
    studio.current = s;
    if (import.meta.env.DEV) Object.assign(window, {__studio: s}); // browser QA reads the camera and anchors; stripped from builds
    return () => { s.dispose(); studio.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The selected board follows the draft live; Compare adds a second board at true relative length.
  const other = compare ? boards.find((b) => b.id === compare && b.id !== board.id) ?? null : null;
  const entry = (b: Surfboard, mine: boolean): BoardEntry => {
    const dims = mine ? d.dims : pickDims(b), tpl = templateFor({type: b.type, length: dims.length}), o = loadOutline(b.id), tr = o ? tracedTpl(b.id, tpl, o) : null;
    return {id: b.id, spec: {template: tpl, ...dims, tail: mine ? d.tail : b.tail}, look: mine ? d.look : loadLook(b), ...(tr ? {tpl: tr.tpl, tplKey: tr.key} : {}), ...(o?.tex ? {deckTex: o.tex} : {})};
  };
  const shown = useRef<string | null | undefined>(undefined); // what the stage last showed: undefined (nothing yet), null (one board) or the compared id
  useEffect(() => {
    const s = studio.current; if (!s) return;
    const was = shown.current, now = other?.id ?? null; shown.current = now;
    s.setMode(now ? 'lineup' : 'focus');
    void s.setBoards(now ? [entry(board, true), entry(other!, false)] : [entry(board, true)], board.id).then(() => {
      if (now) { if (was !== now) s.frame('all'); return; }
      // First view, or back from Compare: the chosen angle, still (setMode starts an auto-spin we do not want here).
      if (was !== null) { if (spinRef.current) s.goTo('360'); else { s.setSpin(false); s.goTo(ANGLES[angleRef.current].id); } }
    });
  }, [board.id, other?.id, d.dims.length, d.dims.width, d.dims.thickness, d.dims.volume, d.tail, JSON.stringify(d.look)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const f = () => setFull(document.fullscreenElement === wrap.current);
    document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f);
  }, []);
  useEffect(() => { setOpen(null); }, [board.id, angle, compare]);

  const go = (i: number) => {
    const n = (i + ANGLES.length) % ANGLES.length;
    setAngle(n); setCompare(null); setSpin(false); studio.current?.goTo(ANGLES[n].id); setStatus(`${ANGLES[n].label}`);
  };
  const toggleSpin = () => { if (compare) setCompare(null); const on = !spin; setSpin(on); if (on) studio.current?.goTo('360'); else studio.current?.setSpin(false); setStatus(on ? '360° turning' : '360° stopped'); };
  const reset = () => { setSpin(false); studio.current?.setSpin(false); studio.current?.reset(ANGLES[angle].id); setStatus('View reset'); };
  const toggleFull = () => { (document.fullscreenElement ? document.exitFullscreen() : wrap.current?.requestFullscreen?.())?.catch(() => setStatus('Full screen is not available here')); };
  const startCompare = () => {
    if (compare) { setCompare(null); return; }
    const pick = boards.filter((b) => b.id !== board.id).sort((a, b) => Math.abs(a.length - board.length) - Math.abs(b.length - board.length))[0]; // the closest length first
    if (pick) { setSpin(false); setCompare(pick.id); setStatus(`Comparing with ${pick.name}`); }
  };

  // Phones: a quick sideways flick on the stage steps the angle; slower drags orbit.
  const flick = useRef<{x: number; y: number; t: number} | null>(null);
  const onDown = (e: RPointerEvent) => { if (e.pointerType === 'touch') flick.current = {x: e.clientX, y: e.clientY, t: performance.now()}; };
  const onUp = (e: RPointerEvent) => {
    const f = flick.current; flick.current = null;
    if (!f || compare || performance.now() - f.t > 350) return;
    const dx = e.clientX - f.x, dy = e.clientY - f.y;
    if (Math.abs(dx) > 50 && Math.abs(dy) < 40) go(angle + (dx < 0 ? 1 : -1));
  };
  const onKeys = (e: KeyboardEvent) => {
    const s = studio.current; if (!s) return;
    const map: Record<string, [number, number, number]> = {ArrowLeft: [-0.16, 0, 1], ArrowRight: [0.16, 0, 1], ArrowUp: [0, 0.1, 1], ArrowDown: [0, -0.1, 1], '+': [0, 0, 0.9], '=': [0, 0, 0.9], '-': [0, 0, 1.1]};
    if (map[e.key]) { e.preventDefault(); s.nudge(...map[e.key]); setSpin(false); s.setSpin(false); }
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
    setStatus(lookStored ? 'Saved to this board' : 'Saved the numbers, fins and tail. The colour and finish could not be stored in this browser, so they last only for this visit.');
  };
  const discard = () => { keepDraft(null, board.id); setDraftState(savedOf(board)); setStatus('Changes discarded'); };

  // Hotspot facts come from the saved record; a draft change says so.
  const facts: Record<Anchor, {k: string; v: string; note?: string}> = {
    fins: {k: 'Fins', v: said(board.fins) ?? 'Not recorded', note: d.look.fins !== saved.look.fins ? `Showing ${finWord(d.look.fins).toLowerCase()}, not saved` : undefined},
    tail: {k: 'Tail', v: said(board.tail) ? `${said(board.tail)} tail` : 'Not recorded', note: d.tail !== saved.tail ? `Showing ${d.tail.toLowerCase()}, not saved` : undefined},
    nose: {k: 'Nose and rocker', v: said(board.rocker) ?? 'Not recorded'},
    rail: {k: 'Rails', v: said(board.rails) ?? 'Not recorded'},
  };
  const maker = [board.manufacturer, board.model].filter(Boolean).join(' · ') || 'Shaper not recorded';
  const outline = loadOutline(board.id);
  const shapeNote = outline?.tex ? 'Deck from your photo; outline traced from it.' : outline ? 'Outline traced from your photo.' : `${board.type} category shape scaled to these numbers, not a scan.`;
  const cmpBoard = other;

  const pill = (
    <div className="br-pill" role="toolbar" aria-label="Stage">
      <button type="button" aria-pressed={!compare && !spin} onClick={() => go(angle)}>Angles</button>
      <button type="button" aria-pressed={!!compare} onClick={startCompare} disabled={boards.length < 2}>Compare</button>
      <button type="button" aria-pressed={spin} onClick={toggleSpin} disabled={noMotion} title={noMotion ? 'Off: reduced motion' : undefined}>360°</button>
      <span className="br-sep" aria-hidden="true" />
      <button type="button" className="ic" aria-label="Reset view" onClick={reset}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10a6 6 0 1 0 2-4.5M4 4v3.5h3.5" /></svg></button>
      {canFull && <button type="button" className="ic" aria-label={full ? 'Exit full screen' : 'Full screen'} aria-pressed={full} onClick={toggleFull}><svg viewBox="0 0 20 20" aria-hidden="true"><path d={full ? 'M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5' : 'M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5'} /></svg></button>}
    </div>
  );

  return (
    <div className="br">
      <div className="br-stagecol">
        <div className={`br-stage${full ? ' full' : ''}`} ref={wrap} onPointerDown={onDown} onPointerUp={onUp} onKeyDown={(e) => { if (e.key === 'Escape' && open) setOpen(null); }}>
          <div className="br-canvas" ref={host}>
            <canvas ref={canvas} tabIndex={0} onKeyDown={onKeys} aria-label={cmpBoard ? `${board.name} and ${cmpBoard.name} side by side at true relative length.` : `3D view of ${board.name}. ${shapeNote} Drag or use the arrow keys to turn it, plus and minus to zoom.`} />
          </div>
          {!ready && <div className="br-load skel" aria-hidden="true"><i /></div>}
          {!cmpBoard && (['fins', 'tail', 'nose', 'rail'] as Anchor[]).map((k) => (
            <button key={k} type="button" ref={(el) => { hot.current[k] = el; }} className="br-hot" data-k={k} data-on="0" aria-expanded={open === k} aria-controls={`${uid}-pop`}
              aria-label={`${facts[k].k}: ${facts[k].v}`} onClick={() => setOpen(open === k ? null : k)}><i aria-hidden="true" /></button>
          ))}
          {open && !cmpBoard && (
            <div id={`${uid}-pop`} className="br-pop" role="status" aria-label={facts[open].k}>
              <span className="k">{facts[open].k}</span><b>{facts[open].v}</b>{facts[open].note && <span className="n">{facts[open].note}</span>}
              <button type="button" className="x" aria-label="Close" onClick={() => setOpen(null)}><Icon name="close" size={14} /></button>
            </div>
          )}
          {cmpBoard && (
            <div className="br-cmp" role="group" aria-label="Compare with">
              <span>{board.name} · {lengthLabel(board.length)}</span><span className="vs">vs</span>
              <select aria-label="Compare with" value={cmpBoard.id} onChange={(e) => setCompare(e.target.value)}>
                {boards.filter((b) => b.id !== board.id).map((b) => <option key={b.id} value={b.id}>{b.name} · {lengthLabel(b.length)}</option>)}
              </select>
            </div>
          )}
          {!cmpBoard && <div className="br-count" aria-hidden="true"><button type="button" tabIndex={-1} onClick={() => go(angle - 1)}>‹</button><span>{angle + 1} / {ANGLES.length}</span><button type="button" tabIndex={-1} onClick={() => go(angle + 1)}>›</button></div>}
          {pill}
          <p className="sr-only" role="status" aria-live="polite">{status}</p>
        </div>
        <div className="br-thumbs" role="group" aria-label="Camera angle">
          {ANGLES.map((a, i) => (
            <button key={a.id} type="button" aria-pressed={!compare && !spin && angle === i} onClick={() => go(i)}><AngleGlyph id={a.id} /><span>{a.label}</span></button>
          ))}
        </div>
        {onPick && boards.length > 1 && (
          <nav className="br-rail" aria-label="Your boards">
            {boards.map((b) => { const maxL = Math.max(...boards.map((x) => x.length)), ft = fits?.get(b.id); return (
              <button key={b.id} type="button" className="br-rail-b" aria-pressed={b.id === board.id} onClick={() => onPick(b.id)}
                aria-label={`${b.name}, ${lengthLabel(b.length)}${ft && ft.state !== 'none' ? `, ${ft.label.toLowerCase()} today` : ''}${b.id === board.id ? ', on the stage' : ''}`}>
                <span className="br-rail-o" aria-hidden="true"><BoardOutline b={b} scale={58 / maxL} /></span>
                <span className="br-rail-t"><b>{b.name}</b><small>{lengthLabel(b.length)}</small>{ft && ft.state !== 'none' && <em className={`qv-fit ${ft.state}`}>{ft.label}</em>}</span>
              </button>
            ); })}
          </nav>
        )}
      </div>

      <aside className="br-panel" aria-label={`Configure ${board.name}`}>
        <header className="br-h">
          <h2><span className="br-name">{board.name}</span> <span className="chip">{board.type}</span>{board.demo && <span className="chip demo">Example board</span>}</h2>
          <p>{maker}</p>
          <p className="br-match">{match}</p>
        </header>

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
              <svg viewBox="0 0 40 24" aria-hidden="true" className="br-fin"><path d="M2 12 C 10 3, 30 3, 38 12 C 30 21, 10 21, 2 12 Z" />{f.id === 'single' && <rect x="6" y="11" width="6" height="2" />}{f.id === 'twin' && <><rect x="8" y="7.5" width="6" height="2" /><rect x="8" y="14.5" width="6" height="2" /></>}{f.id === 'thruster' && <><rect x="9" y="7.5" width="5" height="2" /><rect x="9" y="14.5" width="5" height="2" /><rect x="4" y="11" width="5" height="2" /></>}</svg>
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
          <h3 id={`${uid}-g-col`}>Colour <span className="sel">{SWATCHES.find((s) => s.hex.toLowerCase() === d.look.deck.toLowerCase())?.name ?? 'Custom'}</span></h3>
          <div className="br-row col">{SWATCHES.map((s) => (
            <Swatch key={s.hex} on={s.hex.toLowerCase() === d.look.deck.toLowerCase()} label={`Colour: ${s.name}`} style={{'--sw': s.hex} as CSSProperties} onClick={() => setLook({deck: s.hex, finish: d.look.finish === 'clear' ? 'gloss' : d.look.finish})} />
          ))}</div>
        </section>

        <div className="br-save">
          <button type="button" className="btn primary" disabled={!dirty || !valid} onClick={save}>Save to board</button>
          <button type="button" className="btn" disabled={!dirty} onClick={discard}>Discard</button>
          <span className="br-note">{dirty ? 'Unsaved changes: the model shows them, the board does not have them yet.' : 'Changes show on the model first and save only when you press Save.'}</span>
        </div>
        <p className="br-note">{shapeNote}</p>
      </aside>

      <div className="br-bar" role="region" aria-label="Board Match today">
        <p>{match}</p>
        {dirty ? <button type="button" className="btn primary" disabled={!valid} onClick={save}>Save</button> : matchAction}
      </div>
    </div>
  );
}
