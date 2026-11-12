import {useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent} from 'react';
import type {Surfboard} from '../../models/index';
import {surfRange, lengthLabel} from '../../utils/units';
import {useSwello} from '../../app/store';
import {BoardPicture} from './BoardPicture';
import {wallOutline} from './outline';
import {exampleLabel} from '../../data/referenceBoards';
import {StageArrows, Strip} from './Overlay';
import type {SizeFit} from './fit';

/** My Boards (T-050): the rack as a wall, every board at one true scale against a feet ruler, a label under each (name, length, today's size fit),
 *  the selected board lit; the spec card and a thumbnail strip.
 *  Phones show one board at a time and swipe between them. Left/Right arrow keys step; the change is announced. */
export function Rack({boards, selected, onSelect, fits, estText}: {boards: Surfboard[]; selected: Surfboard; onSelect: (id: string) => void; fits?: Map<string, SizeFit>; estText?: string | null}) {
  const profile = useSwello().data.state.profile; // B12: ranges in the user's height unit
  const row = useRef<HTMLUListElement>(null), items = useRef(new Map<string, HTMLLIElement>());
  const programmatic = useRef(0), settle = useRef<number>(0), first = useRef(true);
  const [avail, setAvail] = useState(380);
  const [phone, setPhone] = useState(() => matchMedia('(max-width: 860px)').matches);
  const [said, setSaid] = useState('');
  const idx = Math.max(0, boards.findIndex((b) => b.id === selected.id)), n = boards.length;
  const maxLen = Math.max(...boards.map((b) => b.length));
  const outlines = useMemo(() => new Map(boards.map((b) => [b.id, wallOutline(b)])), [boards]);

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

  // One scale for every board (no enlarged selection), so the wall reads true against the ruler. Room is left for the labels.
  const base = Math.min((avail - 64) * 0.94 / maxLen, 7);
  const feet = Array.from({length: Math.floor(maxLen / 12)}, (_, i) => i + 1);
  // The ruler's zero is where the boards actually stand (the foot of the selected board's picture), measured after layout.
  const [zero, setZero] = useState<number | null>(null);
  useLayoutEffect(() => {
    const st = row.current?.parentElement, pic = items.current.get(selected.id)?.querySelector('.qv-rack-b > :first-child');
    if (st && pic) setZero(st.getBoundingClientRect().bottom - pic.getBoundingClientRect().bottom - 1); // the tick's 1 px line sits on the tail
  }, [selected.id, avail, phone, base]);
  return (
    <div className="qv-studio qv-rackwrap">
      <div className="qv-stagewrap" onKeyDown={onKey}>
        <div className="qv-stage qv-room">
          {zero !== null && <div className="qv-ruler" aria-hidden="true">{[0, ...feet].map((ft) => <i key={ft} style={{bottom: `${zero + ft * 12 * base}px`}}><span>{ft}′</span></i>)}</div>}
          {estText && <p className="qv-today">Size fit for {estText}</p>}
          <ul className="qv-rackrow" ref={row} onScroll={onScroll} aria-label={`Your boards, ${n} in the rack. Left and right arrow keys change the selected board.`}>
            {boards.map((b, i) => (
              <li key={b.id} ref={(el) => { if (el) items.current.set(b.id, el); else items.current.delete(b.id); }} className={b.id === selected.id ? 'on' : ''}>
                <button type="button" className="qv-rack-b" aria-pressed={b.id === selected.id} tabIndex={b.id === selected.id ? 0 : -1} aria-label={`${b.name}, ${lengthLabel(b.length)}, board ${i + 1} of ${n}${b.demo ? `, ${exampleLabel(b).toLowerCase()}` : ''}`} onClick={() => onSelect(b.id)}>
                  <BoardPicture b={b} px={base} outline={outlines.get(b.id) ?? null} />
                  <span className="qv-rl"><b>{b.name}</b><small>{lengthLabel(b.length)} · {b.type.toLowerCase()}</small>
                    {fits && (() => { const ft = fits.get(b.id); return ft ? <em className={`qv-fit ${ft.state}`} title={ft.state !== 'none' ? `${ft.source === 'board' ? 'Your range' : 'Category range'} ${surfRange(ft.board[0], ft.board[1], profile)}` : undefined}>{ft.label}</em> : null; })()}
                    {/* phone pass 12: on a phone the 'size fit for …' line sits under the selected board's fit, not floating in the stage beside the ruler */}
                    {estText && b.id === selected.id && <small className="qv-fit-for">for {estText}</small>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <StageArrows onStep={step} />
      </div>
      {phone && <Strip boards={boards} selectedId={selected.id} onSelect={onSelect} />} {/* phones see one board at a time; the wall shows them all at 1440 */}
      <p className="sr-only" role="status" aria-live="polite">{said}</p>
    </div>
  );
}
