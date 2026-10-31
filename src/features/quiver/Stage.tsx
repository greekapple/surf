import {useEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import type {Surfboard} from '../../models/index';
import {AI_CAPTION} from '../../ui/mediaModel';
import {lengthLabel} from '../../utils/units';
import {inches} from './format';
import {loadOutline} from './outline';
import {Icon} from '../../ui/Icon';
import {BoardPicture, illustrationFor} from './BoardPicture';

/* T-032 cinematic Quiver: the selected board on a dark stage, its length huge behind it, spec callouts on hairline leaders.
 * The board is always the person's own (traced outline or category outline scaled to their numbers). The AI studio still
 * (public/media/ai/ai-board-studio) is used only as concrete backdrop: cropped to its left third so its own board never shows,
 * and captioned, behind the board only (never behind spec text). Function-first rule: every value is visible on load; an IntersectionObserver
 * only adds emphasis (60% to 100% opacity, 8 px, 300 ms); reduced motion = no motion (quiver.css). */

const STUDIO = '/media/ai/ai-board-studio-1600.jpg';
const ok = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
const cm = (inch: number, d = 0) => `${(inch * 2.54).toFixed(d)} cm`;

function Callout({k, v, s, cls}: {k: string; v: ReactNode; s: ReactNode; cls: string}) {
  return <div className={`qc-c rv ${cls}`}><span className="k">{k}</span><span className="v">{v}</span><span className="s">{s}</span></div>;
}
const missing = <span className="qc-miss">Not recorded</span>;

export function BoardStage({board, maxLen, onStep}: {board: Surfboard; maxLen: number; onStep: (d: -1 | 1) => void}) {
  const root = useRef<HTMLElement>(null), slot = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(480);
  useEffect(() => {
    const el = slot.current; if (!el) return;
    const ro = new ResizeObserver(() => setH(el.clientHeight)); ro.observe(el); setH(el.clientHeight);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const el = root.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches || typeof IntersectionObserver === 'undefined') return;
    el.classList.add('io');
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), {rootMargin: '0px 0px -10% 0px'});
    el.querySelectorAll('.rv').forEach((r) => io.observe(r));
    return () => { io.disconnect(); el.classList.remove('io'); };
  }, []);

  const px = Number.isFinite(maxLen) && maxLen > 0 ? Math.max(1, (h * 0.96) / maxLen) : 1;
  const outline = loadOutline(board.id), ill = illustrationFor(board, outline), len = ok(board.length) ? lengthLabel(board.length).replace(' ', '') : '';
  const maker = [board.manufacturer, board.model].filter(Boolean).join(' · ');
  const how = outline?.tex ? 'Deck from your photo, outline traced from it' : outline ? 'Outline traced from your photo' : `${board.type} category outline scaled to these numbers, not a scan`;
  return (
    <section ref={root} className="qv-cine" data-shot="stage" aria-label={`${board.name}, annotated`}>
      <header className="qc-h rv">
        <h2>{board.name}</h2>
        <p>{[maker || 'Shaper not recorded', board.type, board.demo ? 'Example board' : null].filter(Boolean).join(' · ')}</p>
      </header>
      <div className="qc-grid">
        <Callout cls="c-len" k="Length" v={ok(board.length) ? lengthLabel(board.length) : missing} s={ok(board.length) ? `${+board.length.toFixed(1)}″ · ${cm(board.length)}` : ''} />
        <Callout cls="c-wid" k="Width" v={ok(board.width) ? inches(board.width) : missing} s={ok(board.width) ? cm(board.width, 1) : ''} />
        <Callout cls="c-thk" k="Thickness" v={ok(board.thickness) ? inches(board.thickness) : missing} s={ok(board.thickness) ? cm(board.thickness, 1) : ''} />
        <div className="qc-board" ref={slot}>
          <div className="qc-bd" aria-hidden="true" style={{backgroundImage: `url(${STUDIO})`}} />
          {len && <p className="qc-big" aria-hidden="true" style={{'--len': len.length} as CSSProperties}><span key={board.id}>{len}</span></p>}
          {/* Light theme: the AI illustration of this board type (captioned). Dark theme: the drawn outline on the concrete. */}
          <div className="qc-fig" key={board.id}>{ill
            ? <><span className="qc-pic-ill"><BoardPicture b={board} px={px} outline={outline} /></span><span className="qc-pic-draw"><BoardPicture b={board} px={px} outline={outline} drawn /></span></>
            : <BoardPicture b={board} px={px} outline={outline} />}</div>
          {ill && <p className="qc-illcap">{ill.caption}</p>}
        </div>
        <Callout cls="c-vol" k="Volume" v={ok(board.volume) ? <>{+board.volume.toFixed(1)}<small> L</small></> : missing} s={ok(board.volume) ? 'litres' : ''} />
        <Callout cls="c-fin" k="Fins" v={board.fins?.trim() ? board.fins : missing} s="fin setup" />
        <Callout cls="c-tail" k="Tail" v={board.tail?.trim() ? board.tail : missing} s="tail shape" />
      </div>
      <footer className="qc-f">
        <p className={`qc-how${ill ? " qc-how-drawn" : ""}`}>{how}</p>
      </footer>
      <button type="button" className="qc-arrow l" aria-label="Previous board, annotated view" onClick={() => onStep(-1)}><Icon name="chevron" size={22} /></button>
      <button type="button" className="qc-arrow r" aria-label="Next board, annotated view" onClick={() => onStep(1)}><Icon name="chevron" size={22} /></button>
      <p className="qc-cap">Concrete behind the board: {AI_CAPTION}</p>
    </section>
  );
}
