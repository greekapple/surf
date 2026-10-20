import type {Surfboard,UserProfile} from '../models/index.ts';
export type BoardTab='Overview'|'Dimensions'|'Best Conditions'|'Board Details';
export const boardTabs:BoardTab[]=['Overview','Dimensions','Best Conditions','Board Details'];
export function activeBoard(boards:Surfboard[],id:string|null){return boards.find(b=>b.id===id)??boards[0]}
export function adjacentBoard(boards:Surfboard[],id:string|null,step:number){if(!boards.length)return null;const index=Math.max(0,boards.findIndex(b=>b.id===id));return boards[((index+step)%boards.length+boards.length)%boards.length].id}
export function swipeStep(dx:number,dy:number){return Math.abs(dx)>=45&&Math.abs(dx)>Math.abs(dy)*1.3?(dx<0?1:-1):0}
export function galleryBoards(boards:Surfboard[],id:string,limit=5){if(!boards.length)return [];const count=Math.min(limit,boards.length),index=Math.max(0,boards.findIndex(b=>b.id===id)),start=index-Math.floor((count-1)/2);return Array.from({length:count},(_,i)=>boards[(start+i+boards.length)%boards.length])}
const exact=(v:number)=>Number.isFinite(v)&&v>0?String(+v.toFixed(8)):'Not entered';
export function boardMeasurements(b:Surfboard,p:Pick<UserProfile,'heightUnit'>={heightUnit:'ft'}){
 const metric=p.heightUnit==='m',length=Number.isFinite(b.length)&&b.length>0?(metric?`${exact(b.length*2.54)} cm`:`${Math.floor(b.length/12)}′ ${exact(b.length%12)==='Not entered'?'0':exact(b.length%12)}″`):'Not entered';
 const dim=(v:number)=>!Number.isFinite(v)||v<=0?'Not entered':metric?`${exact(v*2.54)} cm`:`${exact(v)}″`;
 return {length,width:dim(b.width),thickness:dim(b.thickness),volume:Number.isFinite(b.volume)&&b.volume>0?`${exact(b.volume)} L`:'Not entered'};
}
export function boardFamily(type:Surfboard['type']){return type==='Longboard'?'longboard':['Midlength','Funboard'].includes(type)?'midlength':type==='Fish'?'fish':['Gun','Step-up'].includes(type)?'gun':type==='Soft-top'?'softtop':type==='Other'?'neutral':'shortboard'}
