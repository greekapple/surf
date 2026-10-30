import {test} from 'node:test';
import assert from 'node:assert/strict';
import {windowRanges,WINDOW_MIN_SCORE} from '../services/windows.ts';
const H=3600000,t0=Date.parse('2026-11-01T18:00:00Z');
const iso=(i:number)=>new Date(t0+i*H).toISOString();
const hr=(i:number,score:number|null)=>({timestamp:iso(i),score});
const run=(hs:ReturnType<typeof hr>[])=>windowRanges(hs,h=>h);
test('contiguous qualifying hours form one range with the peak',()=>{
 const r=run([hr(0,50),hr(1,60),hr(2,72),hr(3,58),hr(4,40)]);
 assert.equal(r.length,1);assert.equal(r[0].start.timestamp,iso(1));assert.equal(r[0].end.timestamp,iso(3));
 assert.equal(r[0].peak.timestamp,iso(2));assert.equal(r[0].peakScore,72);assert.equal(r[0].hours,3);
});
test('a gap in supplied hours breaks the range and invents nothing',()=>{
 const r=run([hr(0,60),hr(1,60),hr(3,70),hr(4,70)]);
 assert.deepEqual(r.map(x=>[x.start.timestamp,x.end.timestamp]),[[iso(0),iso(1)],[iso(3),iso(4)]]);
});
test('a single qualifying hour is a one-hour range at the threshold',()=>{
 const r=run([hr(0,40),hr(1,WINDOW_MIN_SCORE),hr(2,54)]);
 assert.equal(r.length,1);assert.equal(r[0].start,r[0].end);assert.equal(r[0].hours,1);assert.equal(r[0].peakScore,WINDOW_MIN_SCORE);
});
test('ranges cross a day boundary when hours stay consecutive',()=>{
 const m=Date.parse('2026-11-02T07:00:00Z')-3*H; // 23:00 PT on the 1st
 const hs=[0,1,2,3].map(i=>({timestamp:new Date(m+i*H).toISOString(),score:60+i}));
 const r=windowRanges(hs,h=>h);
 assert.equal(r.length,1);assert.equal(r[0].hours,4);assert.equal(r[0].peakScore,63);
});
test('a null score breaks the range',()=>{
 const r=run([hr(0,60),hr(1,null),hr(2,60)]);
 assert.equal(r.length,2);assert.ok(r.every(x=>x.hours===1));
});
test('unsorted input is ordered and ties peak at the earliest hour',()=>{
 const r=run([hr(2,70),hr(0,70),hr(1,60)]);
 assert.equal(r.length,1);assert.equal(r[0].peak.timestamp,iso(0));
});
test('no qualifying hours gives no ranges',()=>assert.deepEqual(run([hr(0,10),hr(1,null)]),[]));
