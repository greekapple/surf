import type {SurfQuality} from '../models/index.ts';
import type {SourceInfo} from '../ocean/types.ts';
export type RatingCategory='EPIC'|'FIRING'|'GOOD'|'SOLID'|'NOT BAD'|'SURFABLE'|'WEAK'|'POOR'|'FLAT'|'UNRATED';
export type ReliabilityCategory='HIGH'|'MODERATE'|'LIMITED'|'INSUFFICIENT';
export interface Calibration {
 status:'unverified'|'documented'|'validated';
 localInputsVerified:boolean;
 nearshoreMethod:string|null;
 validation:{sampleCount:number;maxHorizonHours:number;source:string}|null;
 limitations:string[];
 sources:string[];
}
/** Future evidence contract. No present provider supplies local rideability observations. */
export interface BreakingEvidence {rideable:boolean;basis:'observation'|'calibrated-model';validAt:string;reliable:boolean;source:string}
export interface RatingContext {
 mode:'retrieved'|'demonstration'|'simulation';validAt:string;now:number;sources:SourceInfo[];
 calibration:Calibration;missingInputs?:string[];breakingEvidence?:BreakingEvidence;
 matchedObservationAt?:string;breakingHeightFt?:number|null;
}
export interface Reliability {category:ReliabilityCategory;reasons:string[];horizonHours:number|null;assessedAt:string}
export interface SurfRating extends SurfQuality {
 category:RatingCategory;baseScore:number|null;explanation:string;constraints:string[];
 reliability:Reliability;mode:RatingContext['mode'];sources:SourceInfo[];experimental:true;
}
