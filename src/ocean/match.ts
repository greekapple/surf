import type {OceanRecord,SpotEvidence} from './types.ts';
import type {Surfboard,UserProfile,BoardRecommendation} from '../models/index.ts';
import {evidenceQuality} from './quality.ts';
import {toLegacy} from './bridge.ts';
import {canPresentBreakingEstimate} from '../utils/waveHeight.ts';
import {scoreBoard} from '../recommendation/board.ts';
export function evidenceMatch(spot:SpotEvidence,r:OceanRecord,p:UserProfile,boards:Surfboard[]):{score:number|null;board:BoardRecommendation|null;reason:string;estimate?:true}{
 /* No measured/calibrated face value: an unvalidated estimate range may stand in, and only then. */
 const input=r.face.value===null?r.faceEstimate?.input:undefined,est=input&&canPresentBreakingEstimate(input)?input.rangeFt as [number,number]:null;
 const quality=evidenceQuality(spot,r,undefined,est),missing=[];
 if(r.face.value===null&&!est)missing.push(r.faceEstimate?.refusal?`breaking-wave height (${r.faceEstimate.refusal.replace(/\.$/,'')})`:'breaking-wave height');if(!r.character||r.character==='Unknown')missing.push('local wave character');if(!spot.difficulty)missing.push('verified experience requirement');if(!spot.hazardsComplete||spot.hazards===null)missing.push('complete hazard assessment');if(quality.score===null)missing.push('sufficient SQI inputs');
 if(missing.length)return {score:null,board:null,reason:`Your Match unavailable: missing ${missing.join(', ')}. ${boards.length?'Your saved boards remain available for comparison.':'No quiver is required to inspect the forecast.'}`};
 const [lo,hi]=est??[r.face.value!,r.face.value!],tag=est?` (based on an unvalidated estimate, ${lo}–${hi} ft)`:'';
 const levels={Beginner:0,Intermediate:1,Expert:2};if(levels[p.skill]<levels[spot.difficulty!]||hi>p.comfort||hi>({Beginner:4,Intermediate:8,Expert:20}[p.skill]))return {score:null,board:null,reason:`Conditions are excluded by your experience or comfortable wave-height limit${tag}.`,...(est&&{estimate:true as const})};
 const distance=Math.max(p.minWave-hi,lo-p.maxWave,0);const score=Math.round(quality.score!*.4+Math.max(0,100-distance*25)*.35+(p.breakType==='Any'||p.breakType===spot.breakType?100:35)*.15+(p.character==='Any'||p.character===r.character?100:35)*.1);
 const board=boards.map(b=>scoreBoard(b,toLegacy(r),p,est)).filter(b=>b.eligible&&b.score>=55).sort((a,b)=>b.score-a.score)[0]??null;
 return {score,board,reason:board?`Your Match ${score}/100${tag}; ${board.board.name} has ${board.score}/100 board compatibility.`:`Your Match ${score}/100${tag}. No suitable saved board; this is a spot/time-only match.`,...(est&&{estimate:true as const})};
}
