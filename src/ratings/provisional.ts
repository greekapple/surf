import type {OceanRecord,SpotEvidence} from '../ocean/types.ts';
import type {QualityFactor} from '../models/index.ts';
import type {SurfRating} from './types.ts';
import {categoryForScore} from './engine.ts';
import {angle} from '../utils/units.ts';
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
/** Offshore-potential heuristics, not a nearshore transformation or fitted surfing model. */
export const provisionalRules={weights:{potential:.4,wind:.3,organization:.3},unknownLocalCap:74,unvalidatedCap:94,lowPotentialCap:39,severeWindCap:39};
export function provisionalRating(s:SpotEvidence,r:OceanRecord,now=Date.now()):SurfRating {
 const required=[['Offshore significant wave height',r.offshore],['Primary swell height',r.primary.height],['Primary swell period',r.primary.period],['Primary swell direction',r.primary.direction],['Wind speed',r.windSpeed],['Wind direction',r.windDirection]] as const;
 const missing=required.filter(([,m])=>m.value===null||!Number.isFinite(m.value)||m.source.validAt!==r.timestamp).map(([n])=>n as string);
 const [hs,h,t,dir,ws,wd]=required.map(([,m])=>m.value??NaN);
 if(!Number.isFinite(Date.parse(r.timestamp)))missing.push('Valid forecast timestamp');
 if(hs<0||h<0||t<=0||ws<0||dir<0||dir>360||wd<0||wd>360)missing.push('Physically valid offshore inputs');
 const sources=required.map(([,m])=>m.source),sim=r.mode==='simulation';
 const limited=['Offshore surf potential only; no breaking-wave height, sandbar, sheltering or local rideability prediction.',...(s.orientation===null?['Coastline orientation is unverified; shore-relative wind and swell alignment are not scored.']:[]),'Local tide compatibility is unknown; the regional station level is shown without a favorable-tide assumption.','No observed spot-specific performance record; this rating is not calibrated.'];
 const fresh=sources.every(a=>a.delivery!=='saved'&&Number.isFinite(Date.parse(a.retrievedAt))&&now-Date.parse(a.retrievedAt)<=7200000&&Date.parse(a.retrievedAt)<=now+300000);
 const reliability={category:missing.length?'INSUFFICIENT' as const:'LIMITED' as const,reasons:missing.length?['Essential contemporaneous offshore inputs are missing.']:[sim?'Hypothetical inputs — not actual forecast reliability.':fresh?'Required model measurements were recently retrieved; model issue time and local validation remain unavailable.':'Some required sources are saved or their retrieval is stale; inspect measurement timestamps.',...limited],horizonHours:null,assessedAt:new Date(now).toISOString()};
 const factors:QualityFactor[]=[];
 const common={tier:'Provisional' as const,validAt:r.timestamp,mode:sim?'simulation' as const:'retrieved' as const,sources,experimental:true as const,reliability,missing,factors,positive:[] as string[],negative:[] as string[]};
 if(missing.length)return {...common,score:null,baseScore:null,label:'UNRATED',category:'UNRATED',constraints:limited,explanation:'Essential swell and wind inputs are required at this exact forecast time. Missing values do not mean Flat.'};
 // Modest offshore energy rises, then excessive offshore energy is penalized. Units: feet and seconds.
 const heightPotential=clamp(h*25),periodPotential=clamp((t-4)*10);
 const potential=clamp(.65*heightPotential+.35*periodPotential-Math.max(0,hs-10)*8);
 const relative=s.orientation!==null;
 const relation=relative?(angle(wd,s.orientation!+180)<45?'offshore':angle(wd,s.orientation!)<45?'onshore':'cross-shore'):'unknown';
 const excess=r.gusts.value===null?0:Math.max(0,r.gusts.value-ws-5)*1.5;
 const wind=relative?clamp(100-ws*(relation==='offshore'?1.6:relation==='onshore'?4:2.8)-excess):clamp(70-ws*2-excess);
 // Ratio and period are bulk-model coherence proxies, explicitly not observed breaking-wave organization.
 const fraction=hs>0?Math.min(1,h*h/(hs*hs)):0;
 const cross=r.secondary?.height.value!=null&&r.secondary.direction.value!==null&&r.secondary.period.value!==null?Math.min(25,25*Math.min(1,r.secondary.height.value/Math.max(h,.01))*angle(dir,r.secondary.direction.value)/180):0;
 const organization=clamp(35+fraction*35+Math.min(30,Math.max(0,t-6)*3)-cross);
 const w=provisionalRules.weights;
 factors.push({name:'Offshore wave potential',score:potential,weight:w.potential,reason:`Primary ${h.toFixed(1)} ft at ${t.toFixed(1)} s; combined Hs ${hs.toFixed(1)} ft. Heuristic rewards moderate swell energy and period, penalizes Hs above 10 ft. This is not breaking-wave height.`},{name:'Wind influence',score:wind,weight:w.wind,reason:relative?`${relation} using documented approximate coastline orientation; speed and excess gusts penalized.`:`Shore relationship unknown. Speed-only penalty 70 − 2 × mph, less excess gust penalty; no offshore bonus.${r.gusts.value===null?' Gusts unavailable; gust penalty not assessed.':''}`},{name:'Offshore organization indicators',score:organization,weight:w.organization,reason:`Primary/combined height-squared ratio ${fraction.toFixed(2)}, primary period and available secondary crossing angle. A bulk-model proxy, not local wave shape.${!r.secondary?' Secondary swell unavailable; crossing penalty not assessed.':''}`},{name:'Swell alignment',score:s.idealSwell===null?null:clamp(100-angle(dir,s.idealSwell)*.85),weight:0,reason:'Not included in this reduced offshore model. Local exposure and sheltering are uncalibrated.'},{name:'Tide compatibility',score:null,weight:0,reason:`${r.tide.value===null?'Regional tide unavailable.':'Regional station tide is available.'} No verified local tide response; excluded, never treated as ideal.`});
 const baseScore=Math.round(factors.reduce((n,f)=>n+(f.score??0)*f.weight,0));let score=baseScore;
 const constraints=[...limited];
 if(!relative||s.idealSwell===null){score=Math.min(score,provisionalRules.unknownLocalCap);constraints.push('Unknown local alignment/exposure caps offshore potential at SOLID (74).');}
 if(potential<25){score=Math.min(score,39);constraints.push('Low offshore potential caps the rating at WEAK; this does not establish Flat.');}
 if(wind<25){score=Math.min(score,39);constraints.push('Severe wind penalty caps the rating at WEAK.');}
 if(h===0&&hs===0){score=Math.min(score,24);constraints.push('Zero model offshore energy means POOR offshore potential, not observed Flat surf.');}
 score=Math.min(score,provisionalRules.unvalidatedCap);const category=categoryForScore(score);
 return {...common,score,baseScore,label:category,category,constraints,positive:factors.filter(f=>f.weight>0&&f.score!==null&&f.score>=65).map(f=>f.name),negative:factors.filter(f=>f.weight>0&&f.score!==null&&f.score<50).map(f=>f.name),explanation:`${s.name}: provisional offshore surf potential from supplied swell and wind forecasts. Local breaking conditions remain uncalibrated. ${constraints.at(-1)}`};
}
