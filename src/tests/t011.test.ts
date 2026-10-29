import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadField,spatialSpec} from '../map/spatial.ts';
const spec=spatialSpec('WAVES','Height','2026-10-29T06:00:00Z')!;
const json=(body:unknown,status:number)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});
async function run(api:()=>Response|Promise<Response>,signal=new AbortController().signal){
 const calls:string[]=[],real=globalThis.fetch;
 globalThis.fetch=(async(u:any)=>{const url=String(u);calls.push(url);if(url.startsWith('/api/grid'))return api();return json({error:'x'},404)}) as typeof fetch;
 try{return {calls,error:await loadField(spec,'Thgt',signal,true).then(()=>null,e=>e as Error)}}finally{globalThis.fetch=real}
}
test('no-frame 404 is final: plain message, no browser or snapshot fetch',async()=>{
 const r=await run(()=>json({error:'No exact regional model frame at this valid time',code:'no_frame'},404));
 assert.match(r.error!.message,/no frame/i);assert.deepEqual(r.calls.filter(u=>!u.startsWith('/api/grid')),[]);
});
test('legacy no-frame error text is also final',async()=>{
 const r=await run(()=>json({error:'No exact regional model frame at this valid time'},404));
 assert.match(r.error!.message,/no frame/i);assert.equal(r.calls.length,1);
});
test('unknown-endpoint 404 falls through to the fallback path',async()=>{
 const r=await run(()=>json({error:'Unknown endpoint'},404));
 assert.ok(r.calls.some(u=>u.startsWith('/spatial/')||u.includes('erddap')));assert.doesNotMatch(r.error?.message??'',/no frame for this hour/i);
});
test('HTTP 500 falls through to the fallback path',async()=>{
 const r=await run(()=>json({error:'boom'},500));
 assert.ok(r.calls.some(u=>u.startsWith('/spatial/')||u.includes('erddap')));
});
test('aborted request rejects with AbortError',async()=>{
 const c=new AbortController();c.abort();
 const r=await run(()=>{throw new DOMException('Aborted','AbortError')},c.signal);
 assert.equal(r.error?.name,'AbortError');
});
