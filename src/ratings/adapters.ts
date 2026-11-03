import type {SurfSpot,Forecast} from '../models/index.ts';
import type {SpotEvidence,OceanRecord} from '../ocean/types.ts';
import {calculateSQI} from '../recommendation/sqi.ts';
import {evidenceQuality} from '../ocean/quality.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {calibrationForSpot} from '../ocean/calibration.ts';
import {rateQuality,unverifiedCalibration} from './engine.ts';
import {provisionalRating} from './provisional.ts';
import {isDark} from '../services/daylight.ts';
export function rateOcean(s:SpotEvidence,r:OceanRecord,now=Date.now()){
 const calibrated=calibrationForSpot(s);
 if(calibrated.status!=='validated'||!calibrated.nearshoreMethod||!calibrated.validation||calibrated.validation.sampleCount<=0)return provisionalRating(s,r,now);
 const required=[['Offshore wave height',r.offshore],['Primary swell height',r.primary.height],['Primary swell period',r.primary.period],['Primary swell direction',r.primary.direction],['Wind speed',r.windSpeed],['Wind direction',r.windDirection],['Regional tide',r.tide],['Breaking-wave estimate',r.face],['Local organization',r.organization]] as const;
 return rateQuality(evidenceQuality(s,r),{mode:r.mode==='simulation'?'simulation':'retrieved',validAt:r.timestamp,now,breakingHeightFt:r.face.value,calibration:calibrationForSpot(s),sources:required.map(([,m])=>m.source),missingInputs:required.filter(([,m])=>m.value===null).map(([label])=>label)});
}
/** Night-aware (T-064): a dark hour (before first light or after last light) is never rated. Score null, category UNRATED, `dark` true. Pass {night:false} to rate it anyway (backtests). */
export function rateForecast(s:SurfSpot,f:Forecast,now=Date.now(),opts:{night?:boolean}={}){
 const rating=rateForecastDay(s,f,now);
 if(opts.night!==false&&isDark(s.id,f.timestamp))return {...rating,score:null,baseScore:rating.baseScore,label:'UNRATED',category:'UNRATED' as const,dark:true,explanation:'Dark: no rating at night. The sun is below first light or last light.',ceilings:undefined};
 return rating;
}
function rateForecastDay(s:SurfSpot,f:Forecast,now:number){
 if(f.evidence)return rateOcean(evidenceSpot(f.evidence.spotId),f.evidence,now);
 return rateQuality(calculateSQI(s,f),{mode:f.source.includes('Simulation')?'simulation':'demonstration',validAt:f.timestamp,now,breakingHeightFt:f.availability.face?f.face:null,calibration:unverifiedCalibration,sources:[]});
}
