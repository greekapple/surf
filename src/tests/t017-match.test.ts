import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {evidenceMatch} from '../ocean/match.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {scoreBoard} from '../recommendation/board.ts';
import {windowRanges,WINDOW_BAND} from '../services/windows.ts';
import {defaultProfile,demoBoards} from '../data/demo.ts';
import type {OceanRecord} from '../ocean/types.ts';
const OB=evidenceSpot('spot-2'),now='2026-10-20T02:10:00.000Z',t=1792454400;
const marine={latitude:37.75,longitude:-122.6,hourly_units:{wave_height:'m',swell_wave_height:'m',swell_wave_direction:'°',swell_wave_period:'s',secondary_swell_wave_height:'m',secondary_swell_wave_direction:'°',secondary_swell_wave_period:'s',sea_surface_temperature:'°C'},hourly:{time:[t],wave_height:[1.6],swell_wave_height:[1.5],swell_wave_direction:[270],swell_wave_period:[14],secondary_swell_wave_height:[null],secondary_swell_wave_direction:[null],secondary_swell_wave_period:[null],sea_surface_temperature:[15]}};
const real=()=>normalizeOpenMeteo(OB,marine,null,now)[0];
const est=(rangeFt:[number,number]):OceanRecord['faceEstimate']=>({input:{kind:'breaking-estimate',valueFt:null,rangeFt,rangeMethod:'test estimate v1'}});
/** A profile and record with every non-height input present, so only the height path is under test. */
const verified={...OB,idealSwell:270,tidePreferences:['Rising'],faceRange:[2,10] as [number,number],difficulty:'Expert' as const,hazardsComplete:true};
const full=(range:[number,number]|null):OceanRecord=>{const r=real();r.windSpeed={...r.windSpeed,value:5};r.windDirection={...r.windDirection,value:90};r.tide={...r.tide,value:2};r.tideTrend='Rising';r.organization={...r.organization,value:75};r.character='Peaky';r.faceEstimate=range?est(range):{refusal:'no profile'};return r};
const prof=(o={})=>({...defaultProfile,skill:'Expert' as const,minWave:4,maxWave:6,comfort:10,breakType:'Any',character:'Any',...o});
const board={...demoBoards[0],type:'Everyday shortboard' as const,minWave:2,maxWave:7,character:'Peaky',rocker:'Medium'};

test('Ocean Beach real record still shows no match: lists exactly what is missing, even though an estimate exists',()=>{
 const r=real();assert.ok(r.faceEstimate?.input);const m=evidenceMatch(OB,r,prof(),[board]);
 assert.equal(m.score,null);assert.match(m.reason,/missing local wave character, complete hazard assessment, sufficient SQI inputs\./);assert.doesNotMatch(m.reason,/breaking-wave height/);
});
test('spots without an estimate show no match and say why',()=>{
 const m=evidenceMatch(verified,full(null),prof(),[board]);assert.equal(m.score,null);assert.match(m.reason,/breaking-wave height \(no profile\)/);
});
test('a range overlapping the preferred band counts as in range; reason says unvalidated',()=>{
 const inside=evidenceMatch(verified,full([3,5]),prof(),[]),overlap=evidenceMatch(verified,full([2,5]),prof(),[]);
 assert.notEqual(inside.score,null);assert.equal(inside.score,overlap.score);assert.match(inside.reason,/based on an unvalidated estimate, 3–5 ft/);assert.equal(inside.estimate,true);
});
test('a range clear of the preferred band scores lower, by the gap to the nearer end',()=>{
 const near=evidenceMatch(verified,full([3,5]),prof(),[]),far=evidenceMatch(verified,full([1,3]),prof({minWave:5,maxWave:6}),[]);
 assert.ok(far.score!<near.score!);
});
test('comfort and skill caps compare against the range high',()=>{
 const over=evidenceMatch(verified,full([4,11]),prof({comfort:10}),[]);assert.equal(over.score,null);assert.match(over.reason,/excluded.*unvalidated estimate, 4–11 ft/);
 assert.notEqual(evidenceMatch(verified,full([4,10]),prof({comfort:10}),[]).score,null);
 assert.equal(evidenceMatch({...verified,difficulty:'Intermediate' as const},full([3,9]),prof({skill:'Intermediate',comfort:10}),[]).score,null); // 9 > 8 intermediate cap
 assert.notEqual(evidenceMatch({...verified,difficulty:'Intermediate' as const},full([3,8]),prof({skill:'Intermediate',comfort:10}),[]).score,null);
});
test('a measured face value is used as before, never an estimate',()=>{
 const r=full([1,2]);r.face={...r.face,value:5};const m=evidenceMatch(verified,r,prof(),[]);assert.notEqual(m.score,null);assert.doesNotMatch(m.reason,/estimate/);assert.equal(m.estimate,undefined);
});
test('scoreBoard: range overlapping the board range is within range; outside is penalised; no range without face is ineligible',()=>{
 const f=toLegacy(full(null));
 assert.equal(scoreBoard(board as any,f,prof()).eligible,false);
 const inR=scoreBoard(board as any,f,prof(),[3,5]),out=scoreBoard(board as any,f,prof(),[10,14]);
 assert.equal(inR.eligible,true);assert.match(inR.factors[0].reason,/within range.*unvalidated estimate, 3–5 ft/);
 assert.ok(out.factors[0].score<inR.factors[0].score);assert.equal(out.eligible,false);
 assert.equal(scoreBoard(board as any,f,prof(),[5,3]).eligible,false); // malformed range refused
});
test('scoreBoard ignores a range when the forecast has a face value',()=>{
 const r=full(null);r.face={...r.face,value:5};const f=toLegacy(r);
 assert.deepEqual(scoreBoard(board as any,f,prof(),[20,30]).factors[0].reason,scoreBoard(board as any,f,prof()).factors[0].reason);
});

// T-014b
const hr=(i:number,score:number|null)=>({timestamp:new Date(Date.parse('2026-11-01T18:00:00Z')+i*3600000).toISOString(),score});
const win=(hs:ReturnType<typeof hr>[])=>windowRanges(hs,h=>h,55,WINDOW_BAND);
test('T-014b: a window keeps only hours within 10 points of its peak',()=>{
 const r=win([hr(0,56),hr(1,60),hr(2,80),hr(3,74),hr(4,70),hr(5,69),hr(6,57)]);
 const main=r.find(x=>x.peakScore===80)!;assert.equal(main.start.timestamp,hr(2,0).timestamp);assert.equal(main.end.timestamp,hr(4,0).timestamp);assert.equal(main.hours,3);
});
test('T-014b: leftover hours form their own window around their own peak, and every hour stays ≥55',()=>{
 const r=win([hr(0,56),hr(1,60),hr(2,80),hr(3,74),hr(4,60),hr(5,62)]);
 assert.deepEqual(r.map(x=>[x.peakScore,x.hours]),[[60,2],[80,2],[62,2]]);
});
test('T-014b: a null hour or gap still breaks, and the default is unchanged',()=>{
 assert.equal(win([hr(0,70),hr(1,null),hr(2,70)]).length,2);
 assert.equal(windowRanges([hr(0,56),hr(1,80)],h=>h).length,1);
});
