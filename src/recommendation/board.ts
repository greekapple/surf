import type {Surfboard,Forecast,UserProfile,BoardRecommendation,Factor} from '../models/index.ts';
import {clamp} from './sqi.ts';
const levels={Beginner:0,Intermediate:1,Expert:2};
const weighted=(f:Factor[])=>Math.round(f.reduce((n,x)=>n+x.score*x.weight,0));
const factor=(name:string,score:number,weight:number,reason:string):Factor=>({name,score:clamp(score),weight,reason});
export const boardRanges:Record<string,[number,number,string[],number]>={
'Performance shortboard':[3,8,['Steep','Peaky','Powerful'],1],'Everyday shortboard':[2,7,['Peaky','Steep'],1],Groveler:[1,4,['Soft','Peaky'],1],Fish:[1,5,['Soft','Peaky'],1],Hybrid:[1,6,['Soft','Peaky'],1],Midlength:[1,6,['Soft','Peaky'],0],Funboard:[1,5,['Soft','Peaky'],0],Longboard:[.5,5,['Soft'],0],'Step-up':[5,12,['Steep','Powerful'],2],Gun:[10,25,['Powerful'],2],'Soft-top':[.5,4,['Soft'],0],Other:[1,6,['Soft','Peaky'],1]};
export function scoreBoard(board:Surfboard,f:Forecast,p:UserProfile):BoardRecommendation {
 if(!boardRanges[board.type]||![board.length,board.width,board.thickness,board.volume].every(v=>Number.isFinite(v)&&v>0)||[board.minWave,board.maxWave].some(v=>v!==undefined&&(!Number.isFinite(v)||v<0))||(board.minWave!==undefined&&board.maxWave!==undefined&&board.minWave>board.maxWave)||f.availability?.face===false||!Number.isFinite(f.face)||!f.character||f.character==='Unknown')return {board,score:0,eligible:false,limited:true,factors:[]};
 const [lo,hi,characters,skill]=boardRanges[board.type];const min=board.minWave??lo,max=board.maxWave??hi;
 const distance=f.face<min?min-f.face:f.face>max?f.face-max:0;
 const size=clamp(100-distance*30);
 const chars=board.character?[board.character]:characters;
 const character=chars.includes(f.character)?100:(f.character==='Peaky'?65:30);
 // Intended use: dimensional proportions + rocker suitability, independent of wave size.
 const aspect=board.length/board.width;const volumeFraction=clamp(board.volume/(board.length*board.width*board.thickness*.016387)*100);
 const rocker=board.rocker==='High'?(['Steep','Powerful'].includes(f.character)?95:50):board.rocker==='Low'?(f.character==='Soft'?95:50):70;
 const use=clamp(rocker*.6+(aspect>=2.5&&aspect<=5.5?90:55)*.2+volumeFraction*.2);
 const exp=levels[p.skill]>=skill?100:25;
 const styleMatch=p.style==='All-around'||(p.style==='Performance surfing'?['Performance shortboard','Step-up','Everyday shortboard'].includes(board.type):p.style==='Longboarding'?board.type==='Longboard':p.style==='Cruising'?['Longboard','Midlength','Funboard'].includes(board.type):['Fish','Groveler','Longboard'].includes(board.type));
 const pref=(styleMatch?60:20)+(p.preferredBoards.length===0||p.preferredBoards.includes(board.type)?30:0)+(board.favorite?10:0);
 const factors=[factor('Wave size',size,.3,`Configured face-height range ${min}–${max} ft; ${distance===0?'within range':'outside range'}`),factor('Wave character',character,.25,`${board.type} preference: ${chars.join(', ')}; forecast: ${f.character}`),factor('Intended use',use,.2,'Rocker and dimensional proportions are limited heuristics; Medium/unknown rocker is neutral. Volume/bounding-box volume is dimensionless, not paddling speed.'),factor('Experience',exp,.15,levels[p.skill]>=skill?'Your selected experience meets the board category heuristic':'Board category is more demanding than your experience setting'),factor('Personal preferences',pref,.1,'Style, preferred board categories, and favorite status')];
 return {board,score:weighted(factors),eligible:distance<=1&&exp>=50,limited:!board.rocker||!board.character,factors};
}
