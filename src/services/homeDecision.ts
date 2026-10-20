import type {Forecast,Surfboard,UserProfile} from '../models/index.ts';
import {scoreBoard} from '../recommendation/board.ts';

/** Home has its own present-time anchor; browsing a historical forecast must not make it “today”. */
export function homeFrame(records:Forecast[],now:number,preferred:string,ids:string[]){
 const eligible=records.filter(f=>ids.includes(f.spotId)&&Number.isFinite(Date.parse(f.timestamp))&&Date.parse(f.timestamp)>=Math.floor(now/3600000)*3600000).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
 const featured=eligible.find(f=>f.spotId===preferred)??eligible[0];
 return {featured,frame:featured?eligible.filter(f=>f.timestamp===featured.timestamp):[],next:!!featured&&Date.parse(featured.timestamp)>now};
}
export function homeBoardAdvice(boards:Surfboard[],forecast:Forecast|undefined,profile:UserProfile){
 const owned=boards.filter(b=>!b.demo);
 if(!owned.length)return {board:null,reason:'Add a board you own in Quiver to connect your equipment.'};
 if(!forecast||!forecast.availability.face||!Number.isFinite(forecast.face)||!forecast.character||forecast.character==='Unknown')return {board:null,reason:'Board advice unavailable: supported breaking-face height and local wave character are missing. Offshore Hs is not a substitute.'};
 const choice=owned.map(b=>scoreBoard(b,forecast,profile)).filter(r=>r.eligible).sort((a,b)=>b.score-a.score)[0];
 return choice?{board:choice.board,reason:`${forecast.evidence?'Hypothetical equipment comparison':'Demonstration equipment comparison'} · ${choice.factors.slice(0,2).map(f=>f.reason).join('. ')}. Limited board heuristics; no verified session suitability.`}:{board:null,reason:'None of your saved boards meets the available board-category and experience heuristics.'};
}
