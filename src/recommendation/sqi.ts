import type {Forecast,SurfSpot,SurfQuality,QualityFactor} from '../models/index.ts';
import {angle} from '../utils/units.ts';
export const sqiWeights={swell:.25,wind:.25,tide:.15,size:.15,organization:.2};
export const clamp=(n:number)=>Math.max(0,Math.min(100,n));
export function windRelationship(s:SurfSpot,f:Pick<Forecast,'wind'|'availability'>){
 if(f.availability?.wind===false||!Number.isFinite(f.wind?.direction))return 'Unknown';
 return angle(f.wind.direction,s.seaward+180)<45?'Offshore':angle(f.wind.direction,s.seaward)<45?'Onshore':'Cross-shore';
}
export function windQuality(s:SurfSpot,f:Forecast):number|null{
 if(f.availability?.wind===false||!Number.isFinite(f.wind?.speed)||!Number.isFinite(f.wind?.direction))return null;
 const relation=windRelationship(s,f),speed=f.wind.speed;
 // Offshore wind loses quality at high speeds, too. Gusts add a separate penalty.
 const multiplier=relation==='Offshore'?1.6:relation==='Cross-shore'?2.8:4;
 return clamp(100-speed*multiplier*s.windTolerance-Math.max(0,(f.wind.gusts??speed)-speed-5)*1.5);
}
export function qualityLabel(score:number|null){return score===null?'Unavailable':score<20?'Very poor':score<40?'Poor':score<60?'Mixed':score<80?'Good':'Excellent'}
export function calculateSQI(s:SurfSpot,f:Partial<Forecast>):SurfQuality{
 const available=f.availability;
 const factors:QualityFactor[]=[];
 const add=(name:string,score:number|null,weight:number,reason:string)=>factors.push({name,score:score===null?null:clamp(score),weight,reason});
 const hasSwell=available?.swell!==false&&Number.isFinite(f.primary?.direction)&&Number.isFinite(f.primary?.period)&&Number.isFinite(s.idealDirection);
 const alignment=hasSwell?clamp(100-angle(s.idealDirection,f.primary!.direction)*.85):null;
 const period=hasSwell?(f.primary!.period>=s.period[0]&&f.primary!.period<=s.period[1]?100:40):null;
 add('Swell alignment & exposure',alignment===null?null:alignment*.8+period!*.2,sqiWeights.swell,hasSwell?`Primary ${f.primary!.direction}° versus configured exposure ${s.idealDirection}°; period ${f.primary!.period}s versus ${s.period.join('–')}s.`:'Primary swell direction or period unavailable.');
 const wind=windQuality(s,f as Forecast);
 add('Wind conditions',wind,sqiWeights.wind,wind===null?'Wind unavailable.':`${windRelationship(s,f as Forecast)} ${f.wind!.speed} mph; speed, gusts, and configured wind sensitivity reduce quality.`);
 const tide=available?.tide!==false&&f.tide&&Number.isFinite(f.tide.height)&&f.tide.stage?s.tides.includes(f.tide.stage)?100:35:null;
 add('Tide compatibility',tide,sqiWeights.tide,tide===null?'Tide unavailable.':`${f.tide!.stage}; configured preferences: ${s.tides.join(', ')}.`);
 const range=s.waveRange,hasFace=available?.face!==false&&Number.isFinite(f.face);
 const distance=hasFace?Math.max(range[0]-f.face!,f.face!-range[1],0):null;
 add('Wave-size suitability',distance===null?null:100-distance*22,sqiWeights.size,hasFace?`Face height ${f.face} ft compared with the break’s ${range.join('–')} ft range; larger is not automatically better.`:'Breaking-wave estimate unavailable.');
 const hasOrganization=available?.organization!==false&&Number.isFinite(f.organization)&&!!f.character;
 const shapeMatch=f.character===s.character?100:55;
 add('Organization & shape',hasOrganization?f.organization!*.7+shapeMatch*.3:null,sqiWeights.organization,hasOrganization?`Configured organization ${f.organization}/100; ${f.character} wave character versus ${s.character} break profile.`:'Wave organization or character unavailable.');
 const missing=factors.filter(x=>x.score===null).map(x=>x.name);
 const score=missing.length?null:Math.round(factors.reduce((sum,x)=>sum+x.score!*x.weight,0));
 return {score,label:qualityLabel(score),factors,missing,positive:factors.filter(x=>x.score!==null&&x.score>=75).map(x=>x.name),negative:factors.filter(x=>x.score!==null&&x.score<60).map(x=>x.name)};
}
