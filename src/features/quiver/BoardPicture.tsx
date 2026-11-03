import {useEffect, useId, useState} from 'react';
import type {BoardType, Surfboard} from '../../models/index';
import {lengthLabel} from '../../utils/units';
import {BoardOutline} from './BoardOutline';
import {loadLook} from './looks';
import {STATIONS, type Outline} from './outline';
import {cutout, type Cut} from './cutout';

/** A board standing on its tail, nose up. A traced board uses its own outline (and deck photo when scanned); any other board is the category outline in the board's colour. Never an exact scan unless the person scanned it. */
function Upright({b, px, outline}: {b: Surfboard; px: number; outline: Outline | null}) {
  const id = useId().replace(/:/g, '');
  const look = loadLook(b);
  if (!outline) return <BoardOutline b={b} scale={px} look={look} />;
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

/** AI board illustrations by board type (lead, T-032 addition). 'Other' has none and keeps the drawn outline. */
const ILLUSTRATION: Partial<Record<BoardType, [file: string, word: string]>> = {
  'Performance shortboard': ['shortboard', 'shortboard'], 'Everyday shortboard': ['shortboard', 'shortboard'], Groveler: ['shortboard', 'shortboard'],
  Fish: ['fish', 'fish'], Hybrid: ['midlength', 'midlength'], Midlength: ['midlength', 'midlength'], Funboard: ['midlength', 'midlength'],
  Longboard: ['longboard', 'longboard'], 'Step-up': ['stepup', 'step-up'], Gun: ['stepup', 'step-up'], 'Soft-top': ['softtop', 'soft-top'],
};
/** The illustration used for this board, or null when its own traced/scanned outline exists (the person's shape wins) or the type has none. */
export function illustrationFor(b: Surfboard, outline: Outline | null) {
  const hit = outline ? undefined : ILLUSTRATION[b.type];
  return hit ? {src: `/media/ai/ai-board-${hit[0]}`, caption: `Illustration of a ${hit[1]} · AI-generated, not your board`} : null;
}

/** The one slot that draws a board picture (rack, annotated stage, phone strip). The person's traced outline or scanned photo first; otherwise
 *  an AI illustration of the board's type, cut out of its white seamless and scaled so its height is the board's real length, labelled as not
 *  their board; otherwise the category outline. `drawn` forces the outline (dark theme stage). */
/** The one slot that draws a board picture (wall, phone strip). T-094: the person's traced outline or scanned photo first; otherwise the shared
 *  2D renderer in the board's own look, the same colour the 3D showroom uses. (The generic AI illustrations by board type are no longer used:
 *  they showed a type, not the person's board, and did not match the showroom.) */
export function BoardPicture({b, px, outline}: {b: Surfboard; px: number; outline: Outline | null; drawn?: boolean}) {
  return <Upright b={b} px={px} outline={outline} />;
}
