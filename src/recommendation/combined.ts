import type {SurfSpot,Surfboard,Forecast,UserProfile,Combination} from '../models/index.ts';
import {personalMatch} from './personal.ts';
import {scoreBoard} from './board.ts';
export function rankCombinations(spots:SurfSpot[],forecasts:Forecast[],boards:Surfboard[],p:UserProfile):Combination[]{
 return forecasts.flatMap<Combination>(f=>{const s=spots.find(s=>s.id===f.spotId);if(!s||p.region!=='All regions'&&s.region!==p.region)return [];
 const spot=personalMatch(s,f,p);if(!spot.eligible)return [];
 const matches=boards.map(b=>scoreBoard(b,f,p)).filter(b=>b.eligible&&b.score>=55);
 return matches.length?matches.map(board=>({spot,board,score:Math.round(spot.score*.65+board.score*.35)})):[{spot,board:null,score:spot.score}];
 }).sort((a,b)=>b.score-a.score||a.spot.forecast.hour-b.spot.forecast.hour||a.spot.spot.id.localeCompare(b.spot.spot.id));
}
