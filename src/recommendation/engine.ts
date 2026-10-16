import type {Surfboard,SurfSpot,Forecast,UserProfile,Factor,BoardRecommendation,SpotRecommendation,Combination} from '../models/index.ts';
import {angle} from '../utils/units.ts';
const levels={Beginner:0,Intermediate:1,Expert:2};
export const weighted=(f:Factor[])=>Math.round(f.reduce((sum,x)=>sum+x.score*x.weight,0));
const clamp=(n:number)=>Math.max(0,Math.min(100,n));
export const windRelation=(s:SurfSpot,f:Forecast)=>angle(f.wind.direction,s.seaward+180)<45?'Offshore':angle(f.wind.direction,s.seaward)<45?'Onshore':'Cross-shore';
const factor=(name:string,score:number,weight:number,reason:string):Factor=>({name,score:clamp(score),weight,reason});
export function scoreSpot(spot:SurfSpot,forecast:Forecast,p:UserProfile):SpotRecommendation {
 const exclusions:string[]=[];
 if(levels[spot.skill]>levels[p.skill])exclusions.push(`${spot.skill} experience configured for this break`);
 if(forecast.face>p.comfort)exclusions.push('Above your maximum comfortable face height');
 if(forecast.face>({Beginner:4,Intermediate:8,Expert:20}[p.skill]))exclusions.push('Above the prototype experience limit');
 if(spot.restricted)exclusions.push('Restricted access');
 if(spot.hazards===null)exclusions.push('Hazard information unknown');
 if(p.skill==='Beginner'&&spot.type==='Reef')exclusions.push('Reef breaks excluded for beginners');
 const relation=windRelation(spot,forecast);
 const factors=[factor('Wind',100-forecast.wind.speed*(relation==='Onshore'?4:relation==='Cross-shore'?2.8:1.3),.3,`${relation} wind at ${forecast.wind.speed} mph; lighter wind scores higher`),factor('Swell alignment',100-angle(spot.idealDirection,forecast.primary.direction)*.7,.25,'Direction compared with the illustrative break exposure'),factor('Tide',spot.tides.includes(forecast.tide.stage)?100:40,.2,`${forecast.tide.stage} tide ${spot.tides.includes(forecast.tide.stage)?'matches':'differs from'} configured preference`),factor('Period',forecast.primary.period>=spot.period[0]&&forecast.primary.period<=spot.period[1]?100:45,.15,'Primary period compared with the configured range'),factor('Spot preference',((p.breakType==='Any'||p.breakType===spot.type)?50:15)+((p.character==='Any'||p.character===forecast.character)?50:15),.1,'Break type and wave character compared with profile preferences')];
 return {spot,forecast,eligible:exclusions.length===0,exclusions,score:weighted(factors),factors};
}
export const boardRanges:Record<string,[number,number,string[],number]>={
'Performance shortboard':[3,8,['Steep','Peaky','Powerful'],1],'Everyday shortboard':[2,7,['Peaky','Steep'],1],Groveler:[1,4,['Soft','Peaky'],1],Fish:[1,5,['Soft','Peaky'],1],Hybrid:[1,6,['Soft','Peaky'],1],Midlength:[1,6,['Soft','Peaky'],0],Funboard:[1,5,['Soft','Peaky'],0],Longboard:[.5,5,['Soft'],0],'Step-up':[5,12,['Steep','Powerful'],2],Gun:[10,25,['Powerful'],2],'Soft-top':[.5,4,['Soft'],0],Other:[1,6,['Soft','Peaky'],1]};
export function scoreBoard(board:Surfboard,f:Forecast,p:UserProfile):BoardRecommendation {
 const [lo,hi,characters,skill]=boardRanges[board.type];const min=board.minWave??lo,max=board.maxWave??hi;
 const distance=f.face<min?min-f.face:f.face>max?f.face-max:0;
 const size=clamp(100-distance*30);
 const chars=board.character?[board.character]:characters;
 const character=chars.includes(f.character)?100:(f.character==='Peaky'?65:30);
 // Intended use: dimensional proportions + rocker suitability, independent of wave size.
 const aspect=board.length/board.width;const paddle=clamp(board.volume/(board.length*board.width*board.thickness*.016387)*100);
 const use=clamp((board.rocker?(board.rocker==='High'?['Steep','Powerful'].includes(f.character):f.character==='Soft')?95:50:70)*.6+(aspect>=2.5&&aspect<=5.5?90:55)*.2+paddle*.2);
 const exp=levels[p.skill]>=skill?100:25;
 const styleMatch=p.style==='All-around'||(p.style==='Performance surfing'?['Performance shortboard','Step-up','Everyday shortboard'].includes(board.type):p.style==='Longboarding'?board.type==='Longboard':p.style==='Cruising'?['Longboard','Midlength','Funboard'].includes(board.type):['Fish','Groveler','Longboard'].includes(board.type));
 const pref=(styleMatch?60:20)+(p.preferredBoards.length===0||p.preferredBoards.includes(board.type)?30:0)+(board.favorite?10:0);
 const factors=[factor('Wave size',size,.3,`Configured face-height range ${min}–${max} ft; ${distance===0?'within range':'outside range'}`),factor('Wave character',character,.25,`${board.type} preference: ${chars.join(', ')}; forecast: ${f.character}`),factor('Intended use',use,.2,'Rocker and dimensional proportions provide a limited shape heuristic'),factor('Experience',exp,.15,levels[p.skill]>=skill?'Your selected experience meets the board category heuristic':'Board category is more demanding than your experience setting'),factor('Personal preferences',pref,.1,'Style, preferred board categories, and favorite status')];
 return {board,score:weighted(factors),eligible:distance<=1&&exp>=50,limited:!board.rocker||!board.character,factors};
}
export function rankCombinations(spots:SurfSpot[],forecasts:Forecast[],boards:Surfboard[],p:UserProfile):Combination[]{
 return forecasts.flatMap<Combination>(f=>{const s=spots.find(s=>s.id===f.spotId);if(!s||p.region!=='All regions'&&s.region!==p.region)return [];const spot=scoreSpot(s,f,p);if(!spot.eligible)return [];const ranked=boards.map(b=>scoreBoard(b,f,p)).filter(b=>b.eligible&&b.score>=55);const preference=clamp(100-(f.face<p.minWave?p.minWave-f.face:f.face>p.maxWave?f.face-p.maxWave:0)*25);return boards.length?ranked.map(board=>({spot,board,score:Math.round(spot.score*.5+board.score*.4+preference*.1)})):[{spot,board:null,score:Math.round(spot.score*.9+preference*.1)}]}).sort((a,b)=>b.score-a.score||a.spot.forecast.hour-b.spot.forecast.hour||a.spot.spot.id.localeCompare(b.spot.spot.id));
}
