import {test} from 'node:test';
import assert from 'node:assert/strict';
import {estimateBreaking,faceRange,inWindow,angleDiff} from '../ocean/breakingEstimate.ts';
import {breakingProfile} from '../ocean/localCalibration.ts';
import {faceEstimate} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {canPresentBreakingEstimate} from '../utils/waveHeight.ts';
const P=breakingProfile('spot-2')!,N=263.49;
const ok={swellHsFt:5,periodS:14,directionDeg:270,combinedHsFt:5.3,secondaryHsFt:null};
const est=(o:Partial<typeof ok>={},p:typeof P|null=P,n:number|null=N)=>estimateBreaking({...ok,...o},p,n);
const reason=(r:ReturnType<typeof est>)=>r.ok?'':r.code;
test('Ocean Beach produces a labelled, versioned range',()=>{
 const r=est();assert.ok(r.ok);if(!r.ok)return;
 assert.equal(r.input.kind,'breaking-estimate');assert.equal(r.input.valueFt,null);assert.match(r.input.rangeMethod!,/unvalidated v1/);
 const [lo,hi]=r.input.rangeFt!;assert.ok(lo<r.centralFt&&hi>r.centralFt);assert.equal(canPresentBreakingEstimate(r.input),true);
});
test('direction factor: head-on Kd=1, 30° off Kd<1',()=>{
 const a=est({directionDeg:N}),b=est({directionDeg:N+30});assert.ok(a.ok&&b.ok);
 if(a.ok&&b.ok){assert.equal(a.kd,1);assert.ok(b.kd<1&&b.kd>0.8);assert.ok(b.centralFt<a.centralFt)}
});
test('Ocean Beach window is normal ±60°: a 315° swell yields a range with Kd < 1',()=>{
 assert.deepEqual(P.window,[203,323]);
 const r=est({directionDeg:315});assert.ok(r.ok);
 if(r.ok){assert.ok(r.kd<1&&r.kd>0);assert.ok(r.input.rangeFt![1]-r.input.rangeFt![0]>=2)}
 assert.equal(reason(est({directionDeg:330})),'outside-window');assert.equal(reason(est({directionDeg:195})),'outside-window');
});
test('refuses: no published facing or swell window, or a source calls the spot sheltered (T-071); Linda Mar and Bolinas now estimate',()=>{
 for(const id of ['spot-7','cs-shelter-cove']){const s=evidenceSpot(id);const f=faceEstimate(s,{value:5,unit:'ft'} as any,{height:{value:5},direction:{value:270},period:{value:14}} as any,null);assert.ok(f.refusal&&!f.input,id)}
 for(const [id,dir] of [['spot-3',315],['spot-0',180]] as const){const s=evidenceSpot(id);assert.notEqual(s.orientation,null);const f=faceEstimate(s,{value:5,unit:'ft'} as any,{height:{value:5},direction:{value:dir},period:{value:14}} as any,null);assert.ok(f.input&&!f.refusal,id)}
 assert.equal(reason(est({},null)),'no-profile');assert.equal(reason(est({},P,null)),'no-orientation');
 assert.equal(reason(est({},{...P,shelter:null as any})),'no-shelter');
});
test('refuses on null or non-positive inputs',()=>{
 for(const k of ['swellHsFt','periodS','directionDeg'] as const)assert.equal(reason(est({[k]:null})),'null-input');
 assert.equal(reason(est({swellHsFt:0})),'null-input');
});
test('refuses on short period, outside window and wind-sea dominance',()=>{
 assert.equal(reason(est({periodS:P.minPeriod-0.1})),'short-period');
 assert.equal(est({periodS:P.minPeriod}).ok,true);
 assert.equal(reason(est({directionDeg:200})),'outside-window');assert.equal(reason(est({directionDeg:330})),'outside-window');
 assert.equal(reason(est({swellHsFt:2,combinedHsFt:5})),'wind-sea-dominant');
 assert.equal(est({swellHsFt:4,combinedHsFt:5}).ok,true);
});
test('range width rules: outward rounding, minimum 2 ft, never below 0',()=>{
 assert.deepEqual(faceRange(5,[0.7,1.4]),[3,7]);
 assert.deepEqual(faceRange(1,[0.7,1.4]),[0,2]);
 const [lo,hi]=faceRange(0.4,[0.7,1.4]);assert.ok(lo>=0&&hi-lo>=2);
 for(let c=0.2;c<20;c+=0.37){const [a,b]=faceRange(c,[0.7,1.4]);assert.ok(b-a>=2&&a<=c*0.7&&b>=c*1.4)}
});
test('window wraps through north and angles are shortest-arc',()=>{
 assert.equal(inWindow(350,[330,20]),true);assert.equal(inWindow(10,[330,20]),true);assert.equal(inWindow(100,[330,20]),false);
 assert.equal(angleDiff(10,350),20);
});
test('guard: needs width >= 1 ft and a versioned method',()=>{
 const g=(rangeFt:[number,number],rangeMethod:string)=>canPresentBreakingEstimate({kind:'breaking-estimate',valueFt:null,rangeFt,rangeMethod});
 assert.equal(g([3,5],'method v1'),true);assert.equal(g([3,3.9],'method v1'),false);assert.equal(g([3,5],'method'),false);assert.equal(g([3,5],' '),false);
 assert.equal(canPresentBreakingEstimate({kind:'offshore',valueFt:4,rangeFt:[3,5],rangeMethod:'m v1'}),false);
});
