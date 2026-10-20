// Compatibility exports preserve callers while the scoring concerns stay independent.
export {scoreBoard,boardRanges} from './board.ts';
export {personalMatch as scoreSpot} from './personal.ts';
export {rankCombinations} from './combined.ts';
export {windRelationship as windRelation} from './sqi.ts';
import type {Factor} from '../models/index.ts';
export const weighted=(f:Factor[])=>Math.round(f.reduce((n,x)=>n+x.score*x.weight,0));
