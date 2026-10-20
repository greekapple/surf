import type {SurfSpot,Forecast} from '../models/index.ts';
import type {SpotEvidence,OceanRecord} from '../ocean/types.ts';
import {calculateSQI} from '../recommendation/sqi.ts';
import {evidenceQuality} from '../ocean/quality.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {calibrationForSpot} from '../ocean/calibration.ts';
import {rateQuality,unverifiedCalibration} from './engine.ts';
export function rateOcean(s:SpotEvidence,r:OceanRecord,now=Date.now()){
 const required=[['Offshore wave height',r.offshore],['Primary swell height',r.primary.height],['Primary swell period',r.primary.period],['Primary swell direction',r.primary.direction],['Wind speed',r.windSpeed],['Wind direction',r.windDirection],['Regional tide',r.tide],['Breaking-wave estimate',r.face],['Local organization',r.organization]] as const;
 return rateQuality(evidenceQuality(s,r),{mode:r.mode==='simulation'?'simulation':'retrieved',validAt:r.timestamp,now,breakingHeightFt:r.face.value,calibration:calibrationForSpot(s),sources:required.map(([,m])=>m.source),missingInputs:required.filter(([,m])=>m.value===null).map(([label])=>label)});
}
export function rateForecast(s:SurfSpot,f:Forecast,now=Date.now()){
 if(f.evidence)return rateOcean(evidenceSpot(f.evidence.spotId),f.evidence,now);
 return rateQuality(calculateSQI(s,f),{mode:f.source.includes('Simulation')?'simulation':'demonstration',validAt:f.timestamp,now,breakingHeightFt:f.availability.face?f.face:null,calibration:unverifiedCalibration,sources:[]});
}
