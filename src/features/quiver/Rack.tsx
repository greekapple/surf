import {useEffect, useId, useMemo, useRef, useState, type KeyboardEvent} from 'react';
import type {Surfboard} from '../../models/index';
import {lengthLabel} from '../../utils/units';
import {BoardOutline} from './BoardOutline';
import {loadLook} from './looks';
import {loadOutline, STATIONS, type Outline} from './outline';
import {SpecCard, StageArrows, Strip} from './Overlay';

/** A board standing on its tail, nose up. A traced board uses its own outline (and deck photo when scanned); any other board is the category outline in the board's colour. Never an exact scan unless the person scanned it. */
function Upright({b, px, outline}: {b: Surfboard; px: number; outline: Outline | null}) {
  const id = useId().replace(/:/g, '');
  const look = loadLook(b);
  if (!outline) return <BoardOutline b={b} scale={px} color={look.deck} />;
  const L = b.length * px, W = b.width * px, cx = W / 2;
  const half = outline.hw.map((h) => h * L), maxHalf = Math.max(...half), k = maxHalf > 0 ? W / 2 / maxHalf : 1; // stored halves are fractions of length; the typed width wins
  const pts = half.map((h, i) => [(i / (STATIONS - 1)) * L, h * k] as const);
  const d = `M${cx},0 ` + pts.map(([y, h]) => `L${cx + h},${y}`).join(' ') + ' ' + [...pts].reverse().map(([y, h]) => `L${cx - h},${y}`).join(' ') + 'Z';
  return (
    <svg className="outline-svg" width={W + 2} height={L + 2} viewBox={`-1 -1 ${W + 2} ${L + 2}`} role="img" aria-label={`${b.name}, traced from your photo, ${lengthLabel(b.length)} by ${b.width} inches`}>
      <defs><clipPath id={`rk-${id}`}><path d={d} /></clipPath></defs>
      {outline.tex
        ? <g clipPath={`url(#rk-${id})`}><g transform={`translate(${cx},0) rotate(90)`}><image href={outline.tex} x={0} y={-W / 2} width={L} height={W} preserveAspectRatio="none" /></g></g>
        : <path d={d} fill={look.deck} fillOpacity={0.92} />}
      <path d={d} fill="none" stroke="var(--board-line)" />
    </svg>
  );
}

/** My Boards: boards standing in a rack in front of the showroom backplate, the selected one larger, with the spec card and a thumbnail strip.
 *  Phones show one board at a time and swipe between them. Left/Right arrow keys step; the change is announced. */
export function Rack({boards, selected, onSelect, onOpen3D}: {boards: Surfboard[]; selected: Surfboard; onSelect: (id: string) => void; onOpen3D: () => void}) {
  const row = useRef<HTMLUListElement>(null), items = useRef(new Map<string, HTMLLIElement>());
  const programmatic = useRef(0), settle = useRef<number>(0), first = useRef(true);
  const [avail, setAvail] = useState(380);
  const [phone, setPhone] = useState(() => matchMedia('(max-width: 860px)').matches);
  const [said, setSaid] = useState('');
  const idx = Math.max(0, boards.findIndex((b) => b.id === selected.id)), n = boards.length;
  const maxLen = Math.max(...boards.map((b) => b.length));
  const outlines = useMemo(() => new Map(boards.map((b) => [b.id, loadOutline(b.id)])), [boards]);

  useEffect(() => { const m = matchMedia('(max-width: 860px)'), f = () => setPhone(m.matches); m.addEventListener('change', f); return () => m.removeEventListener('change', f); }, []);
  useEffect(() => {
    const el = row.current; if (!el) return;
    const ro = new ResizeObserver(() => setAvail(Math.max(220, el.clientHeight - 28))); ro.observe(el); setAvail(Math.max(220, el.clientHeight - 28));
    return () => ro.disconnect();
  }, []);
  const step = (d: number) => onSelect(boards[(idx + d + n) % n].id);
  const center = (id: string, smooth: boolean) => {
    const c = row.current, li = items.current.get(id); if (!c || !li) return;
    const left = li.offsetLeft - (c.clientWidth - li.clientWidth) / 2;
    programmatic.current = Date.now();
    c.scrollTo({left, behavior: smooth && !matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto'});
  };
  useEffect(() => { center(selected.id, !first.current); }, [selected.id, phone, avail]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (first.current) { first.current = false; return; } setSaid(`${selected.name}, board ${idx + 1} of ${n}`); }, [selected.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => window.clearTimeout(settle.current), []);

  // Swiping on a phone scrolls the row; once it settles, the board nearest the middle becomes the selected one.
  const onScroll = () => {
    if (!phone) return;
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      if (Date.now() - programmatic.current < 700) return;
      const c = row.current; if (!c) return;
      const mid = c.scrollLeft + c.clientWidth / 2; let best = selected.id, bd = Infinity;
      items.current.forEach((li, id) => { const dist = Math.abs(li.offsetLeft + li.clientWidth / 2 - mid); if (dist < bd) { bd = dist; best = id; } });
      if (best !== selected.id) onSelect(best);
    }, 140);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select')) return;
    const next = e.key === 'ArrowLeft' ? boards[(idx - 1 + n) % n] : e.key === 'ArrowRight' ? boards[(idx + 1) % n] : e.key === 'Home' ? boards[0] : e.key === 'End' ? boards[n - 1] : null;
    if (!next) return;
    e.preventDefault(); onSelect(next.id);
    // Keep the keyboard on the board row when that is where it was.
    if (e.target instanceof HTMLElement && row.current?.contains(e.target)) requestAnimationFrame(() => items.current.get(next.id)?.querySelector('button')?.focus({preventScroll: true}));
  };

  const base = Math.min(avail * 0.9 / maxLen, 7), emph = (b: Surfboard) => Math.min(base * 1.2, (avail * 0.99) / b.length);
  return (
    <div className="qv-studio qv-rackwrap">
      <div className="qv-stagewrap" onKeyDown={onKey}>
        <div className="qv-stage qv-room">
          <ul className="qv-rackrow" ref={row} onScroll={onScroll} aria-label={`Your boards, ${n} in the rack. Left and right arrow keys change the selected board.`}>
            {boards.map((b, i) => (
              <li key={b.id} ref={(el) => { if (el) items.current.set(b.id, el); else items.current.delete(b.id); }} className={b.id === selected.id ? 'on' : ''}>
                <button type="button" className="qv-rack-b" aria-pressed={b.id === selected.id} tabIndex={b.id === selected.id ? 0 : -1} aria-label={`${b.name}, ${lengthLabel(b.length)}, board ${i + 1} of ${n}${b.demo ? ', example board' : ''}`} onClick={() => onSelect(b.id)}>
                  <Upright b={b} px={b.id === selected.id ? emph(b) : base} outline={outlines.get(b.id) ?? null} />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <StageArrows onStep={step} />
        <SpecCard board={selected} dims={selected} action={<button type="button" className="qv-cta" onClick={onOpen3D}>View in 3D <span aria-hidden="true">→</span></button>} />
      </div>
      <Strip boards={boards} selectedId={selected.id} onSelect={onSelect} />
      <p className="sr-only" role="status" aria-live="polite">{said}</p>
    </div>
  );
}
