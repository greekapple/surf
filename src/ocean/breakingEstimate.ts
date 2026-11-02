import type {WaveHeightInput} from '../utils/waveHeight.ts';
/** Unvalidated breaking-wave estimate (T-008). Pure: swell inputs + a spot profile give a labelled range or a refusal reason. Never a measurement. */
export const BREAKING_METHOD_VERSION='v1';
export const BREAKING_METHOD=`Komar-Gaughan breaker height from primary swell with cos-shoaling-direction factor and fixed 0.7–1.4 face factors, unvalidated ${BREAKING_METHOD_VERSION}`;
const G=9.81,FT=1/0.3048;
export interface BreakingProfile {window:[number,number]|null;minPeriod:number|null;shelter:number|null;faceFactors:[number,number]|null}
export interface BreakingInputs {swellHsFt:number|null;periodS:number|null;directionDeg:number|null;combinedHsFt:number|null;secondaryHsFt?:number|null}
export type RefusalCode='no-profile'|'no-orientation'|'null-input'|'short-period'|'outside-window'|'wind-sea-dominant'|'no-shelter';
export type BreakingResult={ok:true;input:WaveHeightInput;centralFt:number;kd:number}|{ok:false;code:RefusalCode;reason:string};
const refuse=(code:RefusalCode,reason:string):BreakingResult=>({ok:false,code,reason});
const num=(v:number|null|undefined):v is number=>typeof v==='number'&&Number.isFinite(v);
/** Smallest angle between two compass bearings, 0–180. */
export const angleDiff=(a:number,b:number)=>{const d=Math.abs(((a-b)%360+360)%360);return d>180?360-d:d};
/** Bearing inside [from, to] clockwise, wrapping through north when from > to. */
export const inWindow=(deg:number,[from,to]:[number,number])=>{const d=((deg%360)+360)%360,f=((from%360)+360)%360,t=((to%360)+360)%360;return f<=t?d>=f&&d<=t:d>=f||d<=t};
/** Outward-rounded range around the central height, minimum width 2 ft, never below 0. */
export function faceRange(centralFt:number,[fLo,fHi]:[number,number]):[number,number]{
 let lo=Math.max(0,Math.floor(centralFt*fLo)),hi=Math.ceil(centralFt*fHi);
 if(hi-lo<2){const extra=2-(hi-lo);lo=Math.max(0,lo-Math.floor(extra/2));hi=Math.max(hi,lo+2)}
 return [lo,hi];
}
export function estimateBreaking(i:BreakingInputs,p:BreakingProfile|null,normalFromSpot:number|null):BreakingResult{
 if(normalFromSpot===null||!Number.isFinite(normalFromSpot))return refuse('no-orientation','Beach orientation is not established for this spot.');
 if(!p||!p.window||!p.faceFactors||p.minPeriod===null)return refuse('no-profile','No reviewed face factors and swell window for this spot.');
 if(p.shelter===null||!Number.isFinite(p.shelter)||p.shelter<=0)return refuse('no-shelter','No reviewed shelter factor for this spot.');
 if(!num(i.swellHsFt)||!num(i.periodS)||!num(i.directionDeg)||i.swellHsFt<=0||i.periodS<=0)return refuse('null-input','Primary swell height, period or direction is missing.');
 if(i.periodS<p.minPeriod)return refuse('short-period',`Swell period ${i.periodS.toFixed(1)} s is under the ${p.minPeriod} s minimum.`);
 if(!inWindow(i.directionDeg,p.window))return refuse('outside-window','Swell direction is outside this spot’s swell window.');
 if(num(i.combinedHsFt)){const wind=Math.sqrt(Math.max(0,i.combinedHsFt**2-i.swellHsFt**2-(num(i.secondaryHsFt)?i.secondaryHsFt**2:0)));if(wind>i.swellHsFt)return refuse('wind-sea-dominant','Wind sea is larger than the primary swell.');}
 const kd=Math.sqrt(Math.max(0,Math.cos(angleDiff(i.directionDeg,normalFromSpot)*Math.PI/180)));
 if(kd<=0)return refuse('outside-window','Swell arrives parallel to or away from the beach normal.');
 const hsM=i.swellHsFt/FT;
 const centralFt=0.39*G**0.2*(i.periodS*(hsM*kd*p.shelter)**2)**0.4*FT;
 return {ok:true,kd,centralFt,input:{kind:'breaking-estimate',valueFt:null,rangeFt:faceRange(centralFt,p.faceFactors),rangeMethod:BREAKING_METHOD}};
}

/** ---- v2 (T-041, experimental, behind a flag; v1 above is unchanged and remains the default) ----
 *  Starts from the CDIP MOP point at depth (already refracted over the real bathymetry, so no manual shelter factor) and carries the
 *  significant height to the break by linear theory on straight, parallel contours: energy flux (shoaling) and Snell's law (refraction),
 *  stopping where H reaches GAMMA × depth. Same unvalidated 0.7–1.4 face factors as v1. Not validated against observed breaking heights. */
export const BREAKING_V2_VERSION='v2-experimental';
export const BREAKER_INDEX=0.78;
export const BREAKING_V2_METHOD=`CDIP MOP height at depth carried to the break by linear shoaling and refraction on straight contours (breaker index ${BREAKER_INDEX}), fixed 0.7–1.4 face factors, experimental and unvalidated ${BREAKING_V2_VERSION}`;
export interface MopBreakingInputs {hsFt:number|null;periodS:number|null;directionDeg:number|null;depthM:number|null;shoreNormalDeg:number|null}
export type BreakingResultV2={ok:true;input:WaveHeightInput;centralFt:number;breakDepthM:number;angleAtDepthDeg:number;angleAtBreakDeg:number}|{ok:false;code:RefusalCode|'no-break';reason:string};
const refuse2=(code:RefusalCode|'no-break',reason:string):BreakingResultV2=>({ok:false,code,reason});
/** Wavenumber from the linear dispersion relation ω² = g k tanh(k h), Newton iterations. */
export function wavenumber(periodS:number,depthM:number){const w=2*Math.PI/periodS;let k=w*w/G;for(let i=0;i<40;i++){const t=Math.tanh(k*depthM),f=G*k*t-w*w,df=G*t+G*k*depthM*(1-t*t),next=k-f/df;if(Math.abs(next-k)<1e-12){k=next;break}k=next>0?next:k/2}return k}
const groupSpeed=(w:number,k:number,h:number)=>{const c=w/k,x=2*k*h,n=0.5*(1+x/Math.sinh(x));return c*n};
export function estimateBreakingV2(i:MopBreakingInputs,p:BreakingProfile|null):BreakingResultV2{
 if(!num(i.shoreNormalDeg))return refuse2('no-orientation','The MOP point has no shore normal.');
 if(!p||!p.window||!p.faceFactors||p.minPeriod===null)return refuse2('no-profile','No reviewed face factors and swell window for this spot.');
 if(!num(i.hsFt)||!num(i.periodS)||!num(i.directionDeg)||!num(i.depthM)||i.hsFt<=0||i.periodS<=0||i.depthM<=0)return refuse2('null-input','MOP height, period, direction or depth is missing.');
 if(i.periodS<p.minPeriod)return refuse2('short-period',`Peak period ${i.periodS.toFixed(1)} s is under the ${p.minPeriod} s minimum.`);
 if(!inWindow(i.directionDeg,p.window))return refuse2('outside-window','Wave direction at the MOP point is outside this spot’s swell window.');
 const th0=angleDiff(i.directionDeg,i.shoreNormalDeg)*Math.PI/180;
 if(Math.cos(th0)<=0.17)return refuse2('outside-window','Waves arrive nearly parallel to the shore; linear theory is not usable.');
 const w=2*Math.PI/i.periodS,k0=wavenumber(i.periodS,i.depthM),c0=w/k0,cg0=groupSpeed(w,k0,i.depthM),h0m=i.hsFt/FT;
 for(let h=i.depthM;h>=0.1;h-=0.02){
  const k=wavenumber(i.periodS,h),c=w/k,s=Math.sin(th0)*c/c0;if(s>=1)return refuse2('outside-window','Refraction turns the wave past the contour; linear theory is not usable.');
  const th=Math.asin(s),H=h0m*Math.sqrt(cg0/groupSpeed(w,k,h))*Math.sqrt(Math.cos(th0)/Math.cos(th));
  if(H>=BREAKER_INDEX*h){const centralFt=H*FT;return {ok:true,centralFt,breakDepthM:h,angleAtDepthDeg:th0*180/Math.PI,angleAtBreakDeg:th*180/Math.PI,input:{kind:'breaking-estimate',valueFt:null,rangeFt:faceRange(centralFt,p.faceFactors),rangeMethod:BREAKING_V2_METHOD}}}
 }
 return refuse2('no-break','The wave does not reach the breaker criterion above 0.1 m depth.');
}
