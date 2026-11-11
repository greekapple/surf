import type {SwanPoint} from './swanPointsSourced.ts';
/** The registry the app and the Worker read the SWAN point table through. It is EMPTY unless `swanEnable.ts` has been imported, and nothing imports that while the flag is off, so the 1,700-line table is in neither bundle (a plain tree-shake
 *  cannot drop it from an unminified Worker bundle, which is why the table is not imported by the code that reads it). */
let table: readonly SwanPoint[] = [];
export const registerSwanTable = (t: readonly SwanPoint[]): void => { table = t; };
export const swanTable = (): readonly SwanPoint[] => table;
