import {sourceStatus} from '../services/measurementStatus.ts';
import type {Measurement} from '../ocean/types.ts';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {waveGeometry,waveReference,wavePresets,waveLengthLabel} from '../education/waveScale.ts';
import {homeFrame,homeBoardAdvice} from '../services/homeDecision.ts';
import {groupWindows} from '../services/windowModel.ts';
import {forecasts,spots,demoBoards,defaultProfile} from '../data/demo.ts';
import {rateForecast} from '../ratings/adapters.ts';
test('Wave Scale has exact metric trough-to-crest dimensions at every slider step',()=>{
 for(let ft=1;ft<=10;ft+=.5){const g=waveGeometry(ft);assert.ok(Math.abs(g.troughY-g.crestY-ft*.3048*112)<1e-10);assert.equal(g.troughY,390);assert.equal(g.reference,waveReference);}
});
test('Wave Scale reference and framing stay fixed across all preset endpoints',()=>{
 for(const [lo,hi] of wavePresets){assert.equal(waveGeometry(lo).reference,waveGeometry(hi).reference);assert.ok(waveGeometry(lo).crestY>waveGeometry(hi).crestY);}
 assert.equal(waveReference.proneLengthM,1.75);assert.equal(waveReference.boardLengthM,2.13);assert.ok(Object.isFrozen(waveReference));
});
test('Wave Scale rejects invalid sizes and keeps unit formatting independent of geometry',()=>{
 for(const ft of [NaN,Infinity,-1,0,10.5])assert.throws(()=>waveGeometry(ft),RangeError);
 const before=waveGeometry(4);assert.equal(waveLengthLabel(4,'m'),'1.22 m');assert.equal(waveLengthLabel(4,'ft'),'4 ft');assert.deepEqual(waveGeometry(4),before);
});
const now=Date.parse('2026-10-20T19:20:00Z'),f=forecasts[0],at=(id:string,time:number)=>({...f,spotId:id,timestamp:new Date(time).toISOString()});
test('Home selects current supplied hour, keeps favorite preference, and never falls back to history',()=>{
 const current=Math.floor(now/3600000)*3600000,records=[at('a',current-3600000),at('a',current+3600000),at('b',current)];
 const original=structuredClone(records),choice=homeFrame(records,now,'a',['a','b']);assert.equal(choice.featured?.spotId,'a');assert.equal(choice.next,true);assert.equal(choice.frame.length,1);assert.deepEqual(records,original);
 assert.equal(homeFrame([records[0]],now,'a',['a']).featured,undefined);assert.equal(homeFrame(records,now,'unknown',['b']).featured?.timestamp,new Date(current).toISOString());
});
test('Home never promotes demo boards to owned-board advice or substitutes offshore height for face',()=>{
 const owned={...demoBoards[0],id:'owned',demo:false},supported={...f,face:3,character:'Soft',availability:{...f.availability,face:true}};
 assert.equal(homeBoardAdvice(demoBoards,supported,defaultProfile).board,null);
 assert.equal(homeBoardAdvice([owned],{...supported,availability:{...supported.availability,face:false}},defaultProfile).board,null);
 assert.equal(homeBoardAdvice([owned],{...supported,character:'Unknown'},defaultProfile).board,null);
 assert.equal(homeBoardAdvice([owned],supported,defaultProfile).board?.id,'owned');
 assert.match(homeBoardAdvice([owned],supported,defaultProfile).reason,/Demonstration/);
});
test('Window timelines split at Pacific midnight without inventing daylight or tide suitability',()=>{
 const q=rateForecast(spots.find(s=>s.id===f.spotId)!,f,now),start=Date.parse('2026-10-21T05:00:00Z');
 const rows=[0,1,2,3].map(i=>({forecast:{...f,timestamp:new Date(start+i*3600000).toISOString()},rating:{...q,score:70}}));
 const out=groupWindows(rows);assert.equal(out.length,2);assert.deepEqual(out.map(w=>w.samples.length),[2,2]);assert.ok(out.every(w=>w.limitations.some(x=>x.includes('Daylight'))));assert.ok(out.every(w=>w.changes.some(x=>x.includes('tide'))));
});

test('Forecast freshness labels never call future or invalid retrieval clocks live data',()=>{
 const m={value:2,source:{kind:'forecast',validAt:new Date(now+3600000).toISOString(),retrievedAt:new Date(now).toISOString()}} as Measurement;
 assert.equal(sourceStatus(m,now),'Recently retrieved forecast');
 assert.match(sourceStatus({...m,source:{...m.source,retrievedAt:'invalid'}},now),/unavailable/);
 assert.match(sourceStatus({...m,source:{...m.source,retrievedAt:new Date(now+3600000).toISOString()}},now),/future/);
 assert.equal(sourceStatus({...m,source:{...m.source,delivery:'saved'}},now),'Saved forecast');
});
