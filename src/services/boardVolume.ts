import type {BoardType} from '../models/index.ts';
import {levelInfo, suggestedVolume, type SkillLevel} from './skillLevels.ts';

/** quiver-lock: volume helpers, OUR OWN rules, labelled as ours wherever they are shown.
 *
 *  1. A board's volume from its length x width x thickness: the bounding box (cubic inches x 0.016387 = litres) times a fill factor for the board's type.
 *     The factors are rough: they come from the four example boards in data/demo.ts, whose stated volumes divide by their bounding boxes (a fish 0.56, a shortboard 0.51, a step-up 0.51, a soft-top 0.75) and
 *     set between those for the other types; a real board can sit 10 % either side. It is only ever used when the person leaves the volume blank, and it is
 *     saved as "volume estimated" and shown as an estimate. The number printed on the board always replaces it.
 *  2. A board's volume against the volume Board Match suggests for the surfer (weight x the level's litres per kg, services/skillLevels.ts), as a plain sentence.
 *     Display only: it never changes which board is picked. */
export const BOX_LITRES_PER_CUBIC_INCH = 0.016387;
export const VOLUME_FILL: Record<string, number> = {
  'Performance shortboard': 0.51, 'Everyday shortboard': 0.52, Groveler: 0.53, Fish: 0.56, Hybrid: 0.54, Midlength: 0.55, Funboard: 0.57, Longboard: 0.56,
  'Step-up': 0.51, Gun: 0.50, 'Soft-top': 0.75, Other: 0.54,
};
export const fillFor = (type: string): number => VOLUME_FILL[type] ?? VOLUME_FILL.Other;
const ok = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
/** The estimated volume in litres (one decimal), or null without all three dimensions. */
export function estimateVolume(lengthIn: number, widthIn: number, thicknessIn: number, type: string): number | null {
  if (![lengthIn, widthIn, thicknessIn].every(ok)) return null;
  return Math.round(lengthIn * widthIn * thicknessIn * BOX_LITRES_PER_CUBIC_INCH * fillFor(type) * 10) / 10;
}

/** Typical dimensions per type, offered as one tap in the add-board form (never saved unless the person taps it and then saves). Round numbers for the type, not any maker's model. */
export const TYPICAL: Record<BoardType, {length: string; width: string; thickness: string}> = {
  'Performance shortboard': {length: `6'0"`, width: '19 1/4', thickness: '2 1/2'}, 'Everyday shortboard': {length: `6'0"`, width: '19 3/4', thickness: '2 5/8'},
  Groveler: {length: `5'6"`, width: '20 3/4', thickness: '2 5/8'}, Fish: {length: `5'8"`, width: '21 1/4', thickness: '2 3/8'}, Hybrid: {length: `6'2"`, width: '20 1/2', thickness: '2 5/8'},
  Midlength: {length: `7'2"`, width: '21 3/4', thickness: '2 3/4'}, Funboard: {length: `7'6"`, width: '21 3/4', thickness: '2 7/8'}, Longboard: {length: `9'0"`, width: '22 3/4', thickness: '2 7/8'},
  'Step-up': {length: `6'6"`, width: '19 3/4', thickness: '2 11/16'}, Gun: {length: `8'0"`, width: '20', thickness: '3'}, 'Soft-top': {length: `8'0"`, width: '22', thickness: '3 1/4'}, Other: {length: `6'0"`, width: '20', thickness: '2 1/2'},
} as Record<BoardType, {length: string; width: string; thickness: string}>;

export interface VolumeNote {state: 'near' | 'more' | 'less'; text: string}
/** "This board is 41 L; about 38 L is suggested for you": within 15 % is "near"; otherwise more or less float than suggested. Null without a weight. */
export function volumeNote(boardL: number | undefined, weightKg: number | null | undefined, level: SkillLevel, boardEstimated = false): VolumeNote | null {
  const want = suggestedVolume(weightKg, level); if (want === null || !ok(boardL)) return null;
  const ratio = boardL / want, base = `${Math.round(boardL)} L${boardEstimated ? ' (estimate)' : ''} against about ${want} L suggested for you (${Math.round(weightKg!)} kg x ${levelInfo(level).litresPerKg} L/kg at level ${level}; our rule of thumb)`;
  if (ratio >= 0.85 && ratio <= 1.15) return {state: 'near', text: `${base}: close.`};
  return ratio > 1.15 ? {state: 'more', text: `${base}: more float than suggested, easier to paddle.`} : {state: 'less', text: `${base}: less float than suggested, harder to paddle and catch waves.`};
}
