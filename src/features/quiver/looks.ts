import type {Surfboard} from '../../models/index';
import {referenceFor, type DeckPattern} from '../../data/referenceBoards.ts';

/** The look of a board in the showroom. Kept apart from the backup schema: it is cosmetic, per device. */
export type Finish = 'gloss' | 'matte' | 'clear';
export type FinSet = 'single' | 'twin' | 'thruster' | 'quad' | 'none';
/** `pattern`: a procedural deck pattern of the example models (a carbon weave, a soft-top's stripes); `deck` is then the rail colour. */
export interface Look {deck: string; bottom: string; fade: number; finish: Finish; tint: string; fins: FinSet; pattern?: DeckPattern}
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

export function finsFromText(b: Pick<Surfboard, 'fins' | 'type'>): FinSet {
  const t = (b.fins ?? '').toLowerCase();
  if (t.includes('single')) return 'single';
  if (t.includes('twin')) return 'twin';
  if (t.includes('quad')) return 'quad';
  if (/thruster|tri|2\+1/.test(t)) return 'thruster';
  return b.type === 'Longboard' ? 'single' : b.type === 'Fish' ? 'twin' : 'thruster';
}

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

export function defaultLook(b: Pick<Surfboard, 'id' | 'fins' | 'type'> & Partial<Pick<Surfboard, 'model'>>): Look {
  const ref = referenceFor(b);   // an example model: colours in the spirit of the real board (no logos or graphics)
  if (ref) return {...ref.look, tint: 'none', fins: finsFromText(b), ...(ref.look.pattern ? {pattern: ref.look.pattern} : {})};
  // Shop-floor defaults (reference: Swello showcase, showroom panel): glassed white, blue resin, natural wood, bone, deep ocean.
  const h = hash(b.id), SHOP = ['#f3efe7', '#2f78ad', '#c4a17a', '#e9e2d3', '#1d4a6b'];
  const deck = SHOP[h % SHOP.length];
  return {deck, bottom: '#efe9dc', fade: 0.35, finish: 'gloss', tint: 'none', fins: finsFromText(b)};
}

const HEX = /^#[0-9a-f]{6}$/i;
const FINISHES: Finish[] = ['gloss', 'matte', 'clear'];
const FIN_SETS: FinSet[] = ['single', 'twin', 'thruster', 'quad', 'none'];
const PATTERNS: DeckPattern[] = ['carbon', 'stripes'];

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
    ...(PATTERNS.includes(r.pattern as DeckPattern) ? {pattern: r.pattern as DeckPattern} : !('deck' in r) && fallback.pattern ? {pattern: fallback.pattern} : {}),
  };
}

function readAll(): Record<string, unknown> {
  try {
    const v = JSON.parse(localStorage.getItem(LOOKS_KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}

export function loadLook(b: Pick<Surfboard, 'id' | 'fins' | 'type'> & Partial<Pick<Surfboard, 'model'>>): Look {
  return sanitise(readAll()[b.id], defaultLook(b));
}

/** False when browser storage refused the write (the look then lasts only for this session). */
export function saveLook(id: string, look: Look): boolean {
  try { localStorage.setItem(LOOKS_KEY, JSON.stringify({...readAll(), [id]: look})); return true; } catch { return false; }
}

/** T-098 (Codex P2): the look a board is SHOWN with: the saved cosmetic look, but the board record's own Fins field wins when it says something
 *  (the same precedence the showroom's saved state uses), so editing Fins updates the wall, Compare and the showroom alike. */
export function resolvedLook(b: Pick<Surfboard, 'id' | 'fins' | 'type'> & Partial<Pick<Surfboard, 'model'>>): Look {
  const look = loadLook(b);
  return b.fins && b.fins.trim() ? {...look, fins: finsFromText(b)} : look;
}

/** quiver-look: the trim of an example model, in the spirit of its product photos (colours only): the centre line (null = none shows, as on
 *  the carbon deck and the soft-top's foam) and the fin colour. Boards that are not example models keep the wood stringer and the smoky fins. */
export interface Trim {stringer: string | null; fin: string}
const REF_TRIM: Record<string, Trim> = {
  'Inferno 72 C1 Carbon': {stringer: null, fin: '#17191c'},
  'Seaside (Helium)': {stringer: '#3b3f45', fin: '#17191c'},
  "8' Classic": {stringer: null, fin: '#2b6fd6'},
  Ghost: {stringer: '#55595f', fin: '#17191c'},
};
export function trimFor(b: Parameters<typeof referenceFor>[0]): Trim | null {
  const r = referenceFor(b);
  return r ? REF_TRIM[r.model] ?? null : null;
}
/** The soft-top's deck stripes, centre line out: [up to this fraction of the half-width, colour]. White centre, sky and royal bands, a navy rail
 *  band (the Wavestorm's palette, no graphics). The 3D deck atlas and the 2D wall both draw from this table. */
export const STRIPE_BANDS: [number, string][] = [[0.4, '#f7f8f8'], [0.47, '#7cc3ee'], [0.52, '#f7f8f8'], [0.6, '#2b6fd6'], [0.66, '#7cc3ee'], [0.8, '#2b6fd6'], [9, '#1d3f8f']];
/** The carbon deck's white rail band starts at this fraction of the half-width. */
export const CARBON_RIM = 0.83;

/** The foam colour a clear (epoxy) finish shows instead of the deck colour; the showroom's Studio uses the same value. */
export const FOAM_HEX = '#ece6d6';
const toLin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toSrgb = (v: number) => Math.round(255 * Math.max(0, Math.min(1, v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)));
const rgbLin = (hex: string) => [16, 8, 0].map((s) => toLin((parseInt(hex.slice(1), 16) >> s) & 255));

/** T-098 (Codex P2): the effective deck colour, computed exactly as the showroom renders it (Studio.applyLook): foam for a clear finish, and a resin
 *  tint applied multiplicatively at 78% in linear light (three.js colour management). Returns sRGB hex. */
/** The colour a patterned deck reads as from a distance (the 2D wall, the wave scene): the carbon weave's charcoal, the soft-top's stripes' blue. */
export const PATTERN_HEX: Record<DeckPattern, string> = {carbon: '#24262a', stripes: '#2b6fd6'};
export function effectiveDeck(look: Pick<Look, 'deck' | 'finish' | 'tint'> & {pattern?: DeckPattern}): string {
  const base = rgbLin(look.pattern ? PATTERN_HEX[look.pattern] : look.finish === 'clear' ? FOAM_HEX : look.deck);
  const tint = TINTS.find((t) => t.key === look.tint);
  const out = tint && tint.key !== 'none' ? (() => { const t = rgbLin(tint.hex); return base.map((c, i) => c + (c * t[i] - c) * 0.78); })() : base;
  return '#' + out.map((v) => toSrgb(v).toString(16).padStart(2, '0')).join('');
}

/** The wave scene's board colours from a look: the deck as it reads (the pattern's colour), the bottom for a soft-top's slick skin. */
export function waveColours(look: Look): {deck: number; bottom: number} {
  const hex = (h: string) => parseInt(h.slice(1), 16);
  return {deck: hex(look.pattern ? PATTERN_HEX[look.pattern] : look.deck), bottom: hex(look.bottom)};
}
