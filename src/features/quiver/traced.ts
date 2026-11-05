import {stationTpl, templateTpl, type Tpl} from './studio';
import {halfAt, loadOutline, outlineKey, type Outline} from './outline';
import type {Template} from './looks';
import type {Surfboard} from '../../models/index';
import {boardParamsFor, type BoardParams} from '../scale/boardMesh';
import {quiverTemplate} from '../scale/boardObject';
import {referenceFor} from '../../data/referenceBoards';

/** The board's `buildBoard` params: its record's numbers, the person's traced outline when there is one, else the example model's traced
 *  outline, measured rocker and soft-top build (src/data/referenceBoards.ts), else the category's. One function for the wave and the showroom. */
export function paramsForBoard(b: Pick<Surfboard, 'id' | 'length' | 'width' | 'thickness' | 'type' | 'tail' | 'fins'> & Partial<Pick<Surfboard, 'model'>>): BoardParams {
  return boardParamsFor(b, loadOutline(b.id)?.hw ?? null, referenceFor(b));
}

const refCache = new Map<string, Promise<Tpl>>();
/** An example model in the showroom: its own `buildBoard` hull at its own numbers (outline, rocker, rails, no stringer on a soft-top), not a
 *  category template re-fitted. Null for any other board. */
export function referenceTpl(b: Surfboard, dims: {length: number; width: number; thickness: number}, tail?: string): {tpl: Promise<Tpl>; key: string} | null {
  if (!referenceFor(b) || loadOutline(b.id)) return null;
  const key = `ref:${b.id}:${dims.length}:${dims.width}:${dims.thickness}:${tail ?? b.tail ?? ''}`;
  let p = refCache.get(key);
  if (!p) {
    p = Promise.resolve().then(() => { const t = quiverTemplate(paramsForBoard({...b, ...dims, tail: tail || b.tail})); return stationTpl(t.resin, t.stringer, t.width, t.thickness); });
    refCache.set(key, p);
  }
  return {tpl: p, key};
}

const cache = new Map<string, Promise<Tpl>>();

/** Loft a traced outline with the category's rocker and thickness: the category model's widths are re-fitted station by station. */
export function tracedTpl(id: string, template: Template, outline: Outline): {tpl: Promise<Tpl>; key: string} {
  const key = `traced:${id}:${template}:${outlineKey(outline)}`;
  let p = cache.get(key);
  if (!p) {
    p = templateTpl(template).then((t) => {
      const n = t.xs.length, hw = new Float32Array(n), ratio = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        hw[i] = halfAt(outline, 0.5 - t.xs[i]);
        ratio[i] = Math.min(4, Math.max(0.2, hw[i] / Math.max(0.004, t.hw[i])));
      }
      const pos0 = new Float32Array(t.resin.pos0);
      for (let i = 0; i < pos0.length / 3; i++) pos0[i * 3 + 2] *= ratio[t.resin.station[i]];
      const maxHw = Math.max(...hw);
      return {...t, resin: {...t.resin, pos0}, hw, width: 2 * maxHw} as Tpl;
    });
    cache.set(key, p);
  }
  return {tpl: p, key};
}
