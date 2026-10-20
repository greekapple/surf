import type {SurfSpot,Forecast,UserProfile,SpotRecommendation,Factor} from '../models/index.ts';
import {calculateSQI,clamp} from './sqi.ts';
export function personalMatch(spot:SurfSpot,forecast:Forecast,p:UserProfile):SpotRecommendation{
 if(forecast.evidence)return {spot,forecast,score:0,eligible:false,factors:[],exclusions:['Your Match unavailable: breaking-wave calibration, verified local preferences, and complete hazard assessment are required.']};
 const exclusions:string[]=[];const levels={Beginner:0,Intermediate:1,Expert:2};const sqi=calculateSQI(spot,forecast);
 if(levels[spot.skill]>levels[p.skill])exclusions.push(`${spot.skill} experience configured for this break`);
 if(forecast.availability?.face===false||!Number.isFinite(forecast.face))exclusions.push('Wave height unavailable');
 if(forecast.face>p.comfort)exclusions.push('Above your maximum comfortable face height');
 if(forecast.face>({Beginner:4,Intermediate:8,Expert:20}[p.skill]))exclusions.push('Above the prototype experience limit');
 if(spot.restricted)exclusions.push('Restricted access');
 if(!spot.hazards)exclusions.push('Hazard information unknown');
 if(p.skill==='Beginner'&&spot.type==='Reef')exclusions.push('Reef breaks excluded for beginners');
 if(sqi.score===null)exclusions.push('Essential quality inputs unavailable');
 const distance=Number.isFinite(forecast.face)?Math.max(p.minWave-forecast.face,forecast.face-p.maxWave,0):4;
 const factors:Factor[]=[{name:'Surf conditions (SQI)',score:sqi.score??0,weight:.4,reason:sqi.score===null?'Unavailable; personalized ranking excluded.':`Independent Surf Quality Index ${sqi.score}/100.`},{name:'Preferred wave size',score:clamp(100-distance*25),weight:.35,reason:`Face-height preference ${p.minWave}–${p.maxWave} ft.`},{name:'Break preference',score:p.breakType==='Any'||p.breakType===spot.type?100:35,weight:.15,reason:`${spot.type} break versus ${p.breakType} preference.`},{name:'Character preference',score:p.character==='Any'||p.character===forecast.character?100:35,weight:.1,reason:`${forecast.character} waves versus ${p.character} preference.`}];
 return {spot,forecast,eligible:!exclusions.length,exclusions,factors,score:Math.round(factors.reduce((n,x)=>n+x.score*x.weight,0))};
}
