import {spots} from './demo.ts';
import {coastSurfSpots} from './coast.ts';

/** Every spot profile the app can show: the ten original profiles plus the California coast spots (live mode only). */
export const allSpots = [...spots, ...coastSurfSpots];
