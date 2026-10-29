import type {ReactNode} from 'react';
import type {Surfboard} from '../../models/index';
import {Icon} from '../../ui/Icon';
import {lengthLabel} from '../../utils/units';
import {inches} from './format';
import {loadLook} from './looks';
import {loadOutline} from './outline';
import {BoardOutline} from './BoardOutline';

export interface Dims {length: number; width: number; thickness: number; volume: number}

/** Round previous and next buttons at the left and right edges of the stage. */
export function StageArrows({onStep}: {onStep: (d: -1 | 1) => void}) {
  return (
    <>
      <button type="button" className="qv-arrow l" aria-label="Previous board" onClick={() => onStep(-1)}><Icon name="chevron" size={22} /></button>
      <button type="button" className="qv-arrow r" aria-label="Next board" onClick={() => onStep(1)}><Icon name="chevron" size={22} /></button>
    </>
  );
}

/** Board name, tags, the four numbers and the call to action, along the bottom of the stage. */
export function SpecCard({board, dims, action}: {board: Surfboard; dims: Dims; action: ReactNode}) {
  const scanned = !!loadOutline(board.id)?.tex, traced = !!loadOutline(board.id);
  const maker = [board.manufacturer, board.model].filter(Boolean).join(' · ');
  return (
    <section className="qv-card-spec" aria-label={`${board.name} specifications`}>
      <div className="qv-card-id">
        <h2>{board.name}</h2>
        <p className="fine">{maker || 'Shaper not recorded'}</p>
        <div className="qv-tags">
          <span className="chip">{board.type}</span>{board.fins && <span className="chip">{board.fins}</span>}{board.tail && <span className="chip">{board.tail} tail</span>}
          {board.demo ? <span className="chip demo">Example board</span> : scanned ? <span className="chip">From your photo</span> : traced ? <span className="chip">Traced from your photo</span> : null}
        </div>
      </div>
      <dl className="qv-specs">
        <div><dt>Length</dt><dd>{lengthLabel(dims.length)}</dd></div><div><dt>Width</dt><dd>{inches(dims.width)}</dd></div>
        <div><dt>Thickness</dt><dd>{inches(dims.thickness)}</dd></div><div><dt>Volume</dt><dd>{+dims.volume.toFixed(1)} L</dd></div>
      </dl>
      {action}
    </section>
  );
}

/** Every board as a small thumbnail; click selects. */
export function Strip({boards, selectedId, onSelect}: {boards: Surfboard[]; selectedId: string; onSelect: (id: string) => void}) {
  const maxLen = Math.max(...boards.map((b) => b.length));
  return (
    <ul className="qv-strip" aria-label="Choose a board">{boards.map((b) => (
      <li key={b.id}><button type="button" aria-pressed={b.id === selectedId} aria-label={`${b.name}, ${lengthLabel(b.length)}`} title={b.name} onClick={() => onSelect(b.id)}>
        <BoardOutline b={b} scale={72 / maxLen} color={loadLook(b).deck} />
      </button></li>
    ))}</ul>
  );
}
