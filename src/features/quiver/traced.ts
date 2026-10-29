import {templateTpl, type Tpl} from './studio';
import {halfAt, outlineKey, type Outline} from './outline';
import type {Template} from './looks';

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
