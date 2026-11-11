/** The four example boards are real production models (spec docs/specs/2026-11-05-quiver-real-boards.md): the Sharp Eye Inferno 72 (C1
 *  Carbon), the Firewire Seaside (Helium), the Wavestorm 8' Classic and the Pyzel Ghost. Their dimensions are the published ones; their
 *  outlines were traced from each model's top-down deck product photo (locally, the photos are never committed) and scaled to the published
 *  length and width; the Wavestorm's rocker was measured from its side-profile product photo. Everything else (foil, rails, concaves, the
 *  other boards' rocker) is the category's typical value. These are approximations of the models, never exact replicas.
 *
 *  Only numbers live here: 40 half-widths per board (fractions of the length, nose to tail, as `Outline.hw`), the measured rocker, the
 *  soft-top flag, and a look in the spirit of each board (colours and a procedural pattern; no logos, brand graphics or text). */
import type {Surfboard} from '../models/index.ts';
import {demoBoards} from './demo.ts';

export type DeckPattern = 'carbon' | 'stripes';
export interface ReferenceBoard {
  /** the record's model, so an example board the person has re-purposed (another model typed in) loses the reference shape */
  model: string;
  /** traced half-widths, 40 stations nose to tail, fractions of the length (source: the deck photo) */
  hw: number[];
  /** measured from the side-profile photo, inches over the flat spot; the flat spot as a fraction of the length from the tail */
  rocker?: {noseIn: number; tailIn: number; flatFromTail: number};
  softTop?: boolean;
  /** quiver-polish: measured on the deck photo where the 40-station trace is too coarse: the nose tip's radius and a swallow's notch depth (inches) */
  tipRIn?: number; notchIn?: number;
  /** where a published number comes from when it is not the maker's: shown beside the volume (the Seaside's is read off a retailer photo) */
  volumeNote?: string;
  look: {deck: string; bottom: string; fade: number; finish: 'gloss' | 'matte'; pattern?: DeckPattern};
}

export const MODELLED_NOTE = 'Modelled from published specs and product photos · approximate';

export const REFERENCE_BOARDS: Record<string, ReferenceBoard> = {
  // Sharp Eye Inferno 72, C1 Carbon, 5'10" x 19 1/4" x 2 5/8", 29.4 L. Deck photo: sharpeyesurfboards.com.au. A carbon deck inside white rails.
  'demo-short': {
    model: 'Inferno 72 C1 Carbon',
    hw: [0.0048, 0.0256, 0.0405, 0.0541, 0.0655, 0.0762, 0.085, 0.0938, 0.1012, 0.1075, 0.1137, 0.1194, 0.1228, 0.1273, 0.1301, 0.1324, 0.1347, 0.1358, 0.1358, 0.1375,
      0.1364, 0.1364, 0.1364, 0.1364, 0.1352, 0.1347, 0.133, 0.1313, 0.1284, 0.1245, 0.1211, 0.116, 0.1109, 0.1046, 0.0982, 0.0893, 0.0802, 0.0695, 0.0559, 0.0196],
    look: {deck: '#f3f1ec', bottom: '#1d1f23', fade: 0.35, finish: 'gloss', pattern: 'carbon'},
  },
  // Firewire Seaside (Helium), 5'11" x 22 3/4" x 2 3/4"; 41.1 L as written on the stringer in the retailer's photo (cleanlinesurf.com). White.
  'demo-fish': {
    model: 'Seaside (Helium)',
    hw: [0.0114, 0.035, 0.0569, 0.0735, 0.0883, 0.1007, 0.1112, 0.1199, 0.1285, 0.1346, 0.141, 0.1451, 0.1497, 0.1515, 0.155, 0.1585, 0.1599, 0.1602, 0.1602, 0.1602,
      0.1602, 0.1585, 0.1585, 0.1567, 0.155, 0.1515, 0.1497, 0.1462, 0.1433, 0.1396, 0.1359, 0.1322, 0.1287, 0.1234, 0.1182, 0.1112, 0.105, 0.0972, 0.081, 0.067],
    // quiver-polish: the last two stations re-measured on the deck photo (the first trace dipped into the notch, which rounded the lobes off);
    // the tip's radius (about 3 cm) and the notch depth (about 2.1", 3% of the length) measured on the deck and bottom photos.
    tipRIn: 1.2, notchIn: 2.1,
    volumeNote: 'read from the stringer photo',   // audit R15: "(retailer photo)" was unclear
    look: {deck: '#f4f3ef', bottom: '#f4f3ef', fade: 0.35, finish: 'gloss'},
  },
  // Wavestorm 8' Classic, 8'0" x 22 1/2" x 3 1/4", 86 L (ridershack.com, costco.co.uk). Soft-top: blue stripes on a white foam deck, blue rails,
  // a white slick bottom. Rocker measured on the side-profile photo (fit rms 0.2"): about 5" nose, 2.3" tail, the flat spot near the middle.
  'demo-long': {
    model: "8' Classic",
    hw: [0.0132, 0.0608, 0.0748, 0.0856, 0.0935, 0.0981, 0.102, 0.106, 0.1086, 0.1113, 0.114, 0.1152, 0.1165, 0.1165, 0.1165, 0.1165, 0.1172, 0.1165, 0.1165, 0.1152,
      0.1152, 0.1139, 0.1124, 0.1106, 0.1086, 0.1073, 0.1051, 0.103, 0.1007, 0.0974, 0.0952, 0.0915, 0.0869, 0.081, 0.0753, 0.0704, 0.0625, 0.054, 0.0436, 0.0263],
    rocker: {noseIn: 5.05, tailIn: 2.3, flatFromTail: 0.48},
    softTop: true,
    look: {deck: '#1d3f8f', bottom: '#f2f3f4', fade: 0.3, finish: 'matte', pattern: 'stripes'},   // quiver-polish: the rail band in the photo's deep navy
  },
  // Pyzel Ghost, 6'6" x 20 1/2" x 3", 40.1 L (cleanlinesurf.com; the spec card in the retailer's photo). White.
  'demo-step': {
    model: 'Ghost',
    hw: [0.0078, 0.0233, 0.0374, 0.0513, 0.0635, 0.074, 0.0827, 0.0914, 0.0983, 0.1036, 0.1088, 0.114, 0.1175, 0.121, 0.1244, 0.1262, 0.1279, 0.1297, 0.1314, 0.1314,
      0.1314, 0.1314, 0.1297, 0.1279, 0.1279, 0.1262, 0.1227, 0.1192, 0.1175, 0.114, 0.1088, 0.1036, 0.0983, 0.0931, 0.0853, 0.0775, 0.0682, 0.0566, 0.0409, 0.02],
    look: {deck: '#f4f3f6', bottom: '#f4f3f6', fade: 0.35, finish: 'gloss'},
  },
};

/** The reference model behind a board record: only for an example (demo) board that still carries the published record's model, length,
 *  width and thickness. An edited example board loses the "published specs" label and the stretched reference outline. */
export function referenceFor(b: Pick<Surfboard, 'id'> & Partial<Pick<Surfboard, 'model' | 'demo' | 'length' | 'width' | 'thickness'>>): ReferenceBoard | null {
  const r = REFERENCE_BOARDS[b.id], pub = demoBoards.find((d) => d.id === b.id);
  return r && pub && b.demo === true && b.model === r.model && b.length === pub.length && b.width === pub.width && b.thickness === pub.thickness ? r : null;
}

/** The volume as displayed: a number from a retailer photo carries that qualifier while the record is still the published one. */
export function volumeLabel(b: Parameters<typeof referenceFor>[0] & {volume?: number}, v: number | undefined = b.volume): string {
  const note = referenceFor(b)?.volumeNote;
  return typeof v === 'number' && Number.isFinite(v) ? `${+v.toFixed(1)} L${note && v === b.volume ? ` (${note})` : ''}` : 'Not recorded';
}

/** The four fictional records the app shipped before the real models (git history: the 'Demo Workshop' examples), frozen. A saved board
 *  migrates only while EVERY one of these fields is still as shipped; an edited board (showroom saves keep demo:true) is left alone. */
const OLD_DEMO: Record<string, {name: string; manufacturer: string; model: string; type: string; length: number; width: number; thickness: number; volume: number; tail?: string; fins?: string; rocker: string; character: string}> = {
  'demo-fish': {name: 'Small-day fish', manufacturer: 'Demo Workshop', model: 'Drift (fictional)', type: 'Fish', length: 70, width: 21, thickness: 2.625, volume: 36, tail: 'Swallow', fins: 'Twin', rocker: 'Low', character: 'Soft'},
  'demo-short': {name: 'Everyday driver', manufacturer: 'Demo Workshop', model: 'Arc (fictional)', type: 'Performance shortboard', length: 72, width: 19.5, thickness: 2.5, volume: 30, tail: 'Squash', fins: 'Thruster', rocker: 'High', character: 'Steep'},
  'demo-long': {name: 'Easy cruiser', manufacturer: 'Demo Workshop', model: 'Glide (fictional)', type: 'Longboard', length: 108, width: 22.5, thickness: 3, volume: 72, tail: 'Round', fins: 'Single', rocker: 'Low', character: 'Soft'},
  'demo-step': {name: 'Bigger-day option', manufacturer: 'Demo Workshop', model: 'Reach (fictional)', type: 'Step-up', length: 78, width: 19.5, thickness: 2.75, volume: 35, rocker: 'High', character: 'Powerful'},
};
const isOldRecord = (b: Surfboard) => { const o = OLD_DEMO[b.id]; return !!o && (Object.keys(o) as (keyof typeof o)[]).every((k) => (b as unknown as Record<string, unknown>)[k] === o[k]) && b.tail === o.tail && b.fins === o.fins
  && [b.construction, b.notes, b.specificationSource, b.photoDataURL, b.backPhotoDataURL].every((v) => v === undefined); };

/** Saved example boards from before the real models become the new records (the favourite flag is kept) only while they are still exactly the
 *  old shipped record. Anything else (edited examples, the person's own boards) is untouched. */
export function migrateDemoBoards(boards: Surfboard[]): Surfboard[] {
  return boards.map((b) => {
    if (!b.demo || !isOldRecord(b)) return b;
    const next = demoBoards.find((d) => d.id === b.id);
    return next ? {...structuredClone(next), favorite: b.favorite} : b;
  });
}
