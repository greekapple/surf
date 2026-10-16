import type {UserProfile} from '../models/index.ts';
export const angle=(a:number,b:number)=>Math.abs(((a-b+540)%360)-180);
export const compass=(d:number)=>['N','NE','E','SE','S','SW','W','NW'][Math.round(d/45)%8];
export const timeLabel=(h:number)=>`${h>12?h-12:h} ${h>=12?'PM':'AM'}`;
export function heightValue(ft:number,p:UserProfile,breaking=true){return ft*(breaking&&p.scale==='Hawaiian'?.5:1)*(p.heightUnit==='m'?.3048:1)}
export const height=(ft:number,p:UserProfile,breaking=true)=>`${heightValue(ft,p,breaking).toFixed(1)} ${p.heightUnit}${breaking&&p.scale==='Hawaiian'?' ≈ Hawaiian':''}`;
export const wind=(mph:number,p:UserProfile)=>`${(mph*(p.windUnit==='kn'?.868976:p.windUnit==='km/h'?1.609344:1)).toFixed(1)} ${p.windUnit}`;
export function parseDimension(raw:string,length=false):number {const s=raw.trim().replace(/[”“″]/g,'"').replace(/[’′]/g,"'");if(length&&s.includes("'")){const m=s.match(/^(\d+)\s*'\s*(\d+(?:\.\d+)?)?\s*"?$/);if(!m||+(m[2]||0)>=12)return NaN;return +m[1]*12+ +(m[2]||0)}const cleaned=s.replace(/"$/,'').trim();const m=cleaned.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);if(m){if(+m[3]===0||+m[2]>=+m[3])return NaN;return +(m[1]||0)+ +m[2]/+m[3]}return /^\d+(\.\d+)?$/.test(cleaned)?+cleaned:NaN}
export const lengthLabel=(v:number)=>`${Math.floor(v/12)}′ ${+(v%12).toFixed(2)}″`;
export function validDimensions(length:number,width:number,thickness:number,volume:number){return [length,width,thickness,volume].every(Number.isFinite)&&length>=36&&length<=180&&width>=12&&width<=36&&thickness>=1&&thickness<=6&&volume>=5&&volume<=200&&volume<length*width*thickness*.016387}
