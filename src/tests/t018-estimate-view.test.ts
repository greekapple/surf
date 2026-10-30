import {test} from 'node:test';
import assert from 'node:assert/strict';
import {faceEstimateView} from '../features/forecast/estimate.ts';
import {defaultProfile} from '../data/demo.ts';
const p={...defaultProfile,heightUnit:'ft' as const,scale:'Face height' as const};
const fc=(evidence:unknown)=>({evidence}) as any;
const input={kind:'breaking-estimate' as const,valueFt:null,rangeFt:[4,6] as [number,number],rangeMethod:'test estimate v1'};
test('a presentable estimate becomes a range with its midpoint and a ft label',()=>{
 const v=faceEstimateView(fc({faceEstimate:{input}}),p);assert.equal(v?.state,'range');
 if(v?.state==='range'){assert.equal(v.midFt,5);assert.match(v.text,/^4–6 ft$/)}
});
test('metres are converted by the shared formatter, not locally',()=>{
 const v=faceEstimateView(fc({faceEstimate:{input}}),{...p,heightUnit:'m'});assert.equal(v?.state,'range');if(v?.state==='range')assert.match(v.text,/m$/);
});
test('a refusal keeps its reason; a range failing the guard is refused too',()=>{
 assert.deepEqual(faceEstimateView(fc({faceEstimate:{refusal:'Beach orientation is not established for this spot.'}}),p),{state:'none',reason:'Beach orientation is not established for this spot.'});
 const bad=faceEstimateView(fc({faceEstimate:{input:{...input,rangeFt:[4,4.5]}}}),p);assert.equal(bad?.state,'none');
 assert.equal(faceEstimateView(fc({faceEstimate:{input:{...input,rangeMethod:'no version'}}}),p)?.state,'none');
});
test('evidence without an estimate says none; demonstration data (no evidence) has no estimate concept',()=>{
 assert.equal(faceEstimateView(fc({}),p)?.state,'none');assert.equal(faceEstimateView({} as any,p),null);
});
