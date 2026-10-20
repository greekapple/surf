import type {SpotEvidence} from './types.ts';
import type {Calibration} from '../ratings/types.ts';
/** Extensible evidence contract. Null means unknown, never an assumed local characteristic. */
export interface SpotCalibration extends Calibration {
 spotId:string;swellWindows:{from:number;to:number;minPeriod:number|null;maxPeriod:number|null;source:string}[]|null;
 preferredWindDirections:number[]|null;tideSensitivity:{min:number;max:number;datum:string;source:string}|null;
 futureEvidenceTypes:readonly ['observed-breaking-heights','forecast-verification','buoy-observations','surf-reports','nearshore-model'];
}
export function calibrationForSpot(s:SpotEvidence):SpotCalibration{return {spotId:s.id,status:'unverified',localInputsVerified:false,nearshoreMethod:null,validation:null,swellWindows:null,preferredWindDirections:null,tideSensitivity:null,limitations:['No calibrated nearshore transformation or verified local rating inputs.','Regional offshore forecasts and tide stations cannot establish local breaking-wave quality.'],sources:s.sources.map(x=>x.url),futureEvidenceTypes:['observed-breaking-heights','forecast-verification','buoy-observations','surf-reports','nearshore-model']};}
