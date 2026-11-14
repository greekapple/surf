import type {BoardType} from '../../models/index';

// Audit B11: a new board starts blank. The examples are placeholders only, so saving never stores made-up dimensions that would then drive Board Match.
export const emptyForm = {name: '', manufacturer: '', model: '', type: 'Everyday shortboard' as BoardType, length: '', width: '', thickness: '', volume: '', fins: '', tail: '', notes: ''};
export const PLACEHOLDER: Partial<Record<keyof typeof emptyForm, string>> = {length: `6'0"`, width: '19 1/4', thickness: '2 1/2', volume: '30', fins: 'Thruster', tail: 'Squash'};
/** The required fields still blank, in reading order (the numbers draw the board to scale and feed Board Match). quiver-lock: the name (it defaults to the type) and the volume (it is
 *  estimated from length x width x thickness when left blank, saved and shown as an estimate) are optional. */
export function missingBoardFields(v: {name?: string; length: string; width: string; thickness: string; volume?: string}): string[] {
  return ([['length', 'length'], ['width', 'width'], ['thickness', 'thickness']] as const).filter(([k]) => !v[k].trim()).map(([, l]) => l);
}
