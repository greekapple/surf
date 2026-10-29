import type {Surfboard} from '../../models/index';

/** The look of a board in the showroom. Kept apart from the backup schema: it is cosmetic, per device. */
export type Finish = 'gloss' | 'matte' | 'clear';
export type FinSet = 'single' | 'twin' | 'thruster' | 'none';
export interface Look {deck: string; bottom: string; fade: number; finish: Finish; tint: string; fins: FinSet}
export type Template = 'shortboard' | 'fish' | 'longboard' | 'gun' | 'midlength';

export const LOOKS_KEY = 'swello-board-looks';

export const SWATCHES: {name: string; hex: string}[] = [
  {name: 'Glassed white', hex: '#f3efe7'}, {name: 'Natural wood', hex: '#c4a17a'}, {name: 'Bone', hex: '#efe9dc'}, {name: 'Sunwash yellow', hex: '#f0c24a'}, {name: 'Coral', hex: '#e8664f'}, {name: 'Sunset orange', hex: '#e2692d'},
  {name: 'Sage', hex: '#87a07d'}, {name: 'Sea glass', hex: '#6fb5a8'}, {name: 'Pacific blue', hex: '#2f78ad'}, {name: 'Deep ocean', hex: '#143a57'},
  {name: 'Plum', hex: '#6d3b62'}, {name: 'Charcoal', hex: '#282c31'},
];
export const TINTS: {key: string; name: string; hex: string}[] = [
  {key: 'none', name: 'None', hex: '#ffffff'}, {key: 'amber', name: 'Amber', hex: '#ffb45c'}, {key: 'rose', name: 'Rose', hex: '#ff8e9c'},
  {key: 'sea', name: 'Sea', hex: '#63c4bd'}, {key: 'smoke', name: 'Smoke', hex: '#8e939d'}, {key: 'lilac', name: 'Lilac', hex: '#b39ae0'},
];

/** Which 3D template approximates this board type (a category shape, never an exact scan). */
export function templateFor(b: Pick<Surfboard, 'type' | 'length'>): Template {
  switch (b.type) {
    case 'Fish': return 'fish';
    case 'Longboard': return 'longboard';
    case 'Midlength': case 'Funboard': return 'midlength';
    case 'Step-up': case 'Gun': return 'gun';
    case 'Soft-top': return b.length >= 96 ? 'longboard' : 'midlength';
    case 'Other': return b.length < 78 ? 'shortboard' : b.length < 96 ? 'midlength' : 'longboard';
    default: return 'shortboard';
  }
}

function finsFromText(b: Pick<Surfboard, 'fins' | 'type'>): FinSet {
  const t = (b.fins ?? '').toLowerCase();
  if (t.includes('single')) return 'single';
  if (t.includes('twin')) return 'twin';
  if (/thruster|tri|quad|2\+1/.test(t)) return 'thruster';
  return b.type === 'Longboard' ? 'single' : b.type === 'Fish' ? 'twin' : 'thruster';
}

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

export function defaultLook(b: Pick<Surfboard, 'id' | 'fins' | 'type'>): Look {
  // Shop-floor defaults (reference: Swello showcase, showroom panel): glassed white, blue resin, natural wood, bone, deep ocean.
  const h = hash(b.id), SHOP = ['#f3efe7', '#2f78ad', '#c4a17a', '#e9e2d3', '#1d4a6b'];
  const deck = SHOP[h % SHOP.length];
  return {deck, bottom: '#efe9dc', fade: 0.35, finish: 'gloss', tint: 'none', fins: finsFromText(b)};
}

const HEX = /^#[0-9a-f]{6}$/i;
const FINISHES: Finish[] = ['gloss', 'matte', 'clear'];
const FIN_SETS: FinSet[] = ['single', 'twin', 'thruster', 'none'];

function sanitise(raw: unknown, fallback: Look): Look {
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  return {
    deck: typeof r.deck === 'string' && HEX.test(r.deck) ? r.deck : fallback.deck,
    bottom: typeof r.bottom === 'string' && HEX.test(r.bottom) ? r.bottom : fallback.bottom,
    fade: typeof r.fade === 'number' && r.fade >= 0 && r.fade <= 1 ? r.fade : fallback.fade,
    finish: FINISHES.includes(r.finish as Finish) ? (r.finish as Finish) : fallback.finish,
    tint: TINTS.some((t) => t.key === r.tint) ? (r.tint as string) : fallback.tint,
    fins: FIN_SETS.includes(r.fins as FinSet) ? (r.fins as FinSet) : fallback.fins,
  };
}

function readAll(): Record<string, unknown> {
  try {
    const v = JSON.parse(localStorage.getItem(LOOKS_KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}

export function loadLook(b: Pick<Surfboard, 'id' | 'fins' | 'type'>): Look {
  return sanitise(readAll()[b.id], defaultLook(b));
}

export function saveLook(id: string, look: Look) {
  try { localStorage.setItem(LOOKS_KEY, JSON.stringify({...readAll(), [id]: look})); } catch { /* storage unavailable: the look stays for this session */ }
}
