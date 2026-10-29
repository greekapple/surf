import {test} from 'node:test';
import assert from 'node:assert/strict';
import {formatWaveHeight,canPresentBreakingEstimate,nearestNearshore,nearshoreView} from '../utils/waveHeight.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {defaultProfile} from '../data/demo.ts';
const p=defaultProfile;
test('breaking-estimate without method and range is refused, never shown as a point',()=>{
 assert.equal(canPresentBreakingEstimate({kind:'breaking-estimate',valueFt:4}),false);
 assert.equal(canPresentBreakingEstimate({kind:'breaking-estimate',valueFt:4,rangeFt:[3,5]}),false);
 assert.equal(canPresentBreakingEstimate({kind:'breaking-estimate',valueFt:4,rangeMethod:'x'}),false);
 assert.equal(formatWaveHeight({kind:'breaking-estimate',valueFt:4,rangeFt:[3,5],rangeMethod:'validated method'},p).representation,'range');
 assert.equal(formatWaveHeight({kind:'nearshore',valueFt:3},p).label,'Nearshore modeled significant wave height');
});
const t=(h:number)=>({timestamp:new Date(Date.UTC(2026,9,29,h)).toISOString()});
const recs=[t(0),t(1),t(2)],at=(h:number)=>Date.UTC(2026,9,29,h);
test('nearshore lookup returns the nearest record, never extrapolates',()=>{
 assert.equal(nearestNearshore(recs,at(1),at(1)).record,recs[1]);
 assert.equal(nearestNearshore(recs,at(1)+20*60000,at(1)).record,recs[1]);
 assert.equal(nearestNearshore(recs,at(1)+30*3600000,at(1)).reason,'outside-window');
 assert.equal(nearestNearshore(recs,at(1)+10*3600000,at(1)).reason,'outside-window');
 assert.equal(nearestNearshore([],at(1),at(1)).reason,'no-data');
 assert.equal(nearestNearshore(undefined,at(1),at(1)).record,null);
});
test('retrieved ocean records are not labelled Demo and retrieval time is not the update time',()=>{
 const m=(v:number|null)=>({value:v,unit:'ft' as const,source:{provider:'x',kind:'forecast' as const,validAt:'2026-10-29T00:00:00Z',retrievedAt:'2026-10-29T05:00:00Z',issuedAt:null,updatedAt:null,url:'',nativeUnit:'',location:''}});
 const sw={height:m(1),direction:m(1),period:m(1)};
 const r:any={spotId:'spot-2',timestamp:'2026-10-29T00:00:00Z',offshore:m(3),primary:sw,secondary:null,windSpeed:m(1),windDirection:m(1),gusts:m(1),tide:m(1),tideTrend:'Unknown',temperature:m(55),face:m(null),organization:m(null),mode:'retrieved'};
 const f=toLegacy(r);assert.notEqual(f.confidence,'Demo');assert.notEqual(f.updatedAt,'2026-10-29T05:00:00Z');
});

test('breaking-estimate formats only as a documented range; point values are refused',()=>{
 assert.equal(formatWaveHeight({kind:'breaking-estimate',valueFt:4},p).representation,'unavailable');
 assert.equal(formatWaveHeight({kind:'breaking-estimate',valueFt:4,rangeFt:[5,3],rangeMethod:'m'},p).representation,'unavailable');
 assert.equal(formatWaveHeight({kind:'breaking-estimate',valueFt:null,rangeFt:[3,5],rangeMethod:' '},p).text,'Unavailable');
 assert.equal(nearestNearshore(recs,at(1),NaN).reason,'outside-window');
});
test('nearshore view: exact, latest (never the selected hour), before-first, outside window',()=>{
 assert.equal(nearshoreView(recs,at(1),at(1)).state,'exact');
 const l=nearshoreView(recs,at(4),at(4));assert.equal(l.state,'latest');if(l.state==='latest'){assert.equal(l.record,recs[2]);assert.equal(l.hoursBefore,2)}
 assert.equal(nearshoreView(recs,at(-5),at(-5)).state,'before-first');
 assert.equal(nearshoreView(recs,at(40),at(4)).state,'outside-window');
 assert.equal(nearshoreView([],at(1),at(1)).state,'no-data');
});
