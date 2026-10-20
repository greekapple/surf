import type {SurfQuality} from '../models/index.ts';
import type {Calibration,RatingContext,RatingCategory,Reliability,SurfRating} from './types.ts';
export const ratingBands=[{min:95,label:'EPIC'},{min:85,label:'FIRING'},{min:75,label:'GOOD'},{min:65,label:'SOLID'},{min:55,label:'NOT BAD'},{min:40,label:'SURFABLE'},{min:25,label:'WEAK'},{min:0,label:'POOR'}] as const;
export function categoryForScore(score:number|null):RatingCategory {return score===null||!Number.isFinite(score)||score<0||score>100?'UNRATED':ratingBands.find(b=>score>=b.min)!.label;}
export const unverifiedCalibration:Calibration={status:'unverified',localInputsVerified:false,nearshoreMethod:null,validation:null,limitations:['Local nearshore calibration is unavailable.'],sources:[]};
export function assessReliability(context:RatingContext,missing:string[]):Reliability {
 const {mode,now,calibration,sources}=context,reasons:string[]=[];
 const issued=sources.map(s=>s.issuedAt?Date.parse(s.issuedAt):NaN).filter(Number.isFinite);
 const horizon=issued.length?Math.max(0,(Date.parse(context.validAt)-Math.min(...issued))/3600000):null;
 const base={horizonHours:horizon,assessedAt:new Date(now).toISOString()};
 if(mode!=='retrieved')return {...base,category:'LIMITED',reasons:[mode==='simulation'?'Hypothetical inputs; this is not actual forecast reliability.':'Demonstration inputs; this is not an assessment of real conditions.']};
 if(missing.length||!calibration.localInputsVerified)return {...base,category:'INSUFFICIENT',reasons:[...(missing.length?['Required local or forecast inputs are missing.']:[]),...(!calibration.localInputsVerified?['Spot-specific input coverage is not verified.']:[])]};
 const stale=sources.length===0||sources.some(s=>s.delivery==='saved'||!Number.isFinite(Date.parse(s.retrievedAt))||now-Date.parse(s.retrievedAt)>7200000||Date.parse(s.retrievedAt)>now+300000);
 if(stale)reasons.push('At least one required source is saved, stale or has an invalid retrieval time.');
 if(horizon===null)reasons.push('Model issue time is unavailable; forecast lead time cannot be established.');
 if(horizon!==null&&horizon>72)reasons.push('Forecast lead time exceeds the provisional 72-hour reliability window.');
 if(calibration.status!=='validated'||!calibration.validation||calibration.validation.sampleCount<=0)reasons.push('No verified forecast-performance record is supplied for this spot.');
 if(reasons.length)return {...base,category:'LIMITED',reasons};
 const validation=calibration.validation!;
 if(horizon!==null&&horizon>validation.maxHorizonHours)return {...base,category:'LIMITED',reasons:['This forecast is outside the supplied validation horizon.']};
 const observed=context.matchedObservationAt?Date.parse(context.matchedObservationAt):NaN;
 const recentObservation=Number.isFinite(observed)&&now-observed>=-300000&&now-observed<=7200000;
 if(horizon!==null&&horizon<=24&&recentObservation)return {...base,category:'HIGH',reasons:['Complete locally verified inputs, fresh provider retrievals, a short supported lead time, a matched recent local observation and a supplied performance record.']};
 return {...base,category:'MODERATE',reasons:['Complete locally verified inputs and a performance record within its supported lead time; short-horizon local observation support is incomplete.']};
}
/** Provisional interaction caps. These are product rules, not fitted ocean-physics coefficients. */
export const interactionRules={lowPotential:{below:25,cap:39},limitedPotential:{below:40,cap:54},severeWind:{below:25,cap:39},poorWind:{below:40,cap:64},poorOrganization:{below:40,cap:54},poorTide:{below:25,cap:64}};
export function rateQuality(base:SurfQuality,context:RatingContext):SurfRating {
 // Both preserved SQI engines expose the same five ordered factors: swell, wind, tide, size, organization.
 const values=base.factors.map(f=>f.score),invalid=base.factors.length!==5||values.some(v=>v===null||!Number.isFinite(v)||v<0||v>100);
 const evidence=context.breakingEvidence;
 const evidenceAge=evidence?context.now-Date.parse(evidence.validAt):Infinity;
 const flatSupported=context.mode==='retrieved'&&evidence?.reliable&&evidence.rideable===false&&evidence.validAt===context.validAt&&!!evidence.source&&((evidence.basis==='observation'&&evidenceAge>=-300000&&evidenceAge<=7200000)||(evidence.basis==='calibrated-model'&&context.calibration.status==='validated'&&context.calibration.nearshoreMethod!==null));
 const missing=[...new Set([...base.missing,...(context.missingInputs??[]),...(base.score!==null&&(!Number.isFinite(base.score)||base.score<0||base.score>100)?['Valid provisional baseline']:[]),...(context.breakingHeightFt===0&&!flatSupported?['Reliable rideability evidence for zero breaking-wave input']:[]),...(invalid&&!base.missing.length?['Complete valid factor inputs']:[]),...(context.mode==='retrieved'&&!context.calibration.localInputsVerified?['Verified local calibration inputs']:[])])];
 const reliability=assessReliability(context,missing),constraints:string[]=[];
 const common={...base,missing,baseScore:base.score,mode:context.mode,sources:context.sources,experimental:true as const,reliability,tier:context.mode==='retrieved'&&context.calibration.status==='validated'&&context.calibration.localInputsVerified&&context.calibration.nearshoreMethod!==null&&!!context.calibration.validation&&context.calibration.validation.sampleCount>0?'Calibrated' as const:'Provisional' as const,validAt:context.validAt};
 if(flatSupported)return {...common,score:null,label:'FLAT',category:'FLAT',constraints:['Flat is a separate evidence-based classification, not a zero-quality score.'],explanation:`No meaningful rideable breaking waves according to ${evidence.source}. Wind and tide cannot create wave potential.`};
 if(missing.length||base.score===null||!Number.isFinite(base.score))return {...common,score:null,label:'UNRATED',category:'UNRATED',constraints,explanation:'Not enough reliable local information to rate breaking-wave conditions. Available offshore, wind and station measurements can still be inspected.'};
 const [swell,wind,tide,size,organization]=values as number[];let score=base.score;
 const cap=(condition:boolean,limit:number,reason:string)=>{if(condition&&score>limit){score=limit;constraints.push(reason);}};
 const potential=Math.min(swell,size),rules=interactionRules;
 cap(potential<rules.lowPotential.below,rules.lowPotential.cap,'Weak break-specific wave potential limits the result to WEAK. Favorable wind or tide cannot compensate.');
 cap(potential<rules.limitedPotential.below,rules.limitedPotential.cap,'Limited break-specific wave potential caps the result at SURFABLE.');
 cap(wind<rules.severeWind.below,rules.severeWind.cap,'Severely unfavorable supported wind conditions limit the result to WEAK.');
 cap(wind<rules.poorWind.below,rules.poorWind.cap,'Poor supported wind conditions cap the result at NOT BAD.');
 cap(organization<rules.poorOrganization.below,rules.poorOrganization.cap,'Poor supported organization caps the result at SURFABLE.');
 cap(tide<rules.poorTide.below,rules.poorTide.cap,'Poor spot-specific tide compatibility caps the result at NOT BAD.');
 const epicQualified=context.mode==='retrieved'&&reliability.category==='HIGH'&&swell>=95&&size>=95&&wind>=90&&tide>=85&&organization>=90;
 cap(score>=95&&!epicQualified,94,'EPIC requires exceptional wave potential, favorable factors and HIGH evidence-based reliability.');
 score=Math.max(0,Math.min(100,Math.round(score)));const category=categoryForScore(score);
 const positives=base.positive.length?`Helping: ${base.positive.slice(0,2).join(', ')}.`:'No strong positive factors.';
 const negatives=base.negative.length?`Limiting: ${base.negative.slice(0,2).join(', ')}.`:'';
 return {...common,score,label:category,category,constraints,explanation:[positives,negatives,...constraints.slice(0,1)].filter(Boolean).join(' ')};
}
export function asRating(quality:SurfQuality):SurfRating {return 'category' in quality?quality as SurfRating:rateQuality(quality,{mode:'demonstration',validAt:new Date(0).toISOString(),now:Date.now(),sources:[],calibration:unverifiedCalibration});}
