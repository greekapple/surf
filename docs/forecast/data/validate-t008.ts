// Run: node --experimental-strip-types docs/forecast/data/validate-t008.ts
// Pairs NDBC 46026 swell (spec file) with CDIP MOP SF023 nowcast Hs at the same hour; runs the T-008 estimator.
import fs from 'node:fs';
import {estimateBreaking} from '../../../src/ocean/breakingEstimate.ts';
import {breakingProfile} from '../../../src/ocean/localCalibration.ts';
const dir=new URL('./',import.meta.url).pathname,FT=1/0.3048;
const DIR:Record<string,number>={N:0,NNE:22.5,NE:45,ENE:67.5,E:90,ESE:112.5,SE:135,SSE:157.5,S:180,SSW:202.5,SW:225,WSW:247.5,W:270,WNW:292.5,NW:315,NNW:337.5};
const mop=new Map<number,number>();
for(const l of fs.readFileSync(dir+'cdip-mop-sf023-nowcast.csv','utf8').trim().split('\n').slice(1)){const c=l.split(',');if(c[7]?.trim()!=='1')continue;const hs=Number(c[4]);if(Number.isFinite(hs))mop.set(Date.parse(c[0]),hs*FT)}
const P=breakingProfile('spot-2')!,rows:string[]=['time,ndbcSwellHsFt,ndbcPeriodS,ndbcSwellDir,ndbcCombinedHsFt,mopHsFt,estimate,central,lo,hi,refusal'];
const buoy=new Map<number,{sw:number;p:number;d:number;comb:number;dt:number}>();
for(const l of fs.readFileSync(dir+'ndbc-46026.spec.txt','utf8').split('\n')){
 if(l.startsWith('#')||!l.trim())continue;const c=l.trim().split(/\s+/);const t=Date.UTC(+c[0],+c[1]-1,+c[2],+c[3],+c[4]);
 const hr=Math.round(t/3600000)*3600000;if(Math.abs(t-hr)>1800000+1||t!==t)continue; // use the :40 / :10 reading nearest the hour
 const sw=+c[6],p=+c[7],d=DIR[c[10]],comb=+c[5];if(![sw,p,d,comb].every(Number.isFinite))continue;
 const prev=buoy.get(hr);if(!prev||Math.abs(t-hr)<prev.dt)buoy.set(hr,{sw:sw*FT,p,d,comb:comb*FT,dt:Math.abs(t-hr)});
}
const bands:[string,number,number][]=[['<10 s',0,10],['10–13 s',10,13],['13–16 s',13,16],['>=16 s',16,99]];
const st:Record<string,{n:number;err:number[];cover:number}>={};for(const [b] of bands)st[b]={n:0,err:[],cover:0};st['all']={n:0,err:[],cover:0};
const refusals:Record<string,number>={};let paired=0;
for(const [t,b] of [...buoy].sort((a,b)=>a[0]-b[0])){
 const m=mop.get(t);if(m===undefined)continue;paired++;
 const r=estimateBreaking({swellHsFt:b.sw,periodS:b.p,directionDeg:b.d,combinedHsFt:b.comb,secondaryHsFt:null},P,263.49);
 if(!r.ok){refusals[r.code]=(refusals[r.code]??0)+1;rows.push(`${new Date(t).toISOString()},${b.sw.toFixed(2)},${b.p},${b.d},${b.comb.toFixed(2)},${m.toFixed(2)},refused,,,,${r.code}`);continue}
 const [lo,hi]=r.input.rangeFt!;rows.push(`${new Date(t).toISOString()},${b.sw.toFixed(2)},${b.p},${b.d},${b.comb.toFixed(2)},${m.toFixed(2)},ok,${r.centralFt.toFixed(2)},${lo},${hi},`);
 for(const k of ['all',...bands.filter(x=>b.p>=x[1]&&b.p<x[2]).map(x=>x[0])]){const s=st[k];s.n++;s.err.push(r.centralFt-m);if(m>=lo&&m<=hi)s.cover++}
}
fs.writeFileSync(dir+'t008-pairs.csv',rows.join('\n')+'\n');
const f=(x:number)=>x.toFixed(2);
console.log(`buoy hours ${buoy.size}, MOP hours ${mop.size}, paired ${paired}, refusals ${JSON.stringify(refusals)}`);
console.log('| Period band | n | Bias (central − MOP Hs, ft) | MAE (ft) | Range covers MOP Hs |\n|---|---|---|---|---|');
for(const k of ['all',...bands.map(b=>b[0])]){const s=st[k];if(!s.n){console.log(`| ${k} | 0 | – | – | – |`);continue}
 console.log(`| ${k} | ${s.n} | ${f(s.err.reduce((a,b)=>a+b,0)/s.n)} | ${f(s.err.reduce((a,b)=>a+Math.abs(b),0)/s.n)} | ${(100*s.cover/s.n).toFixed(0)}% (${s.cover}/${s.n}) |`)}
const ratios=[...buoy].flatMap(([t,b])=>{const m=mop.get(t);if(m===undefined)return[];const r=estimateBreaking({swellHsFt:b.sw,periodS:b.p,directionDeg:b.d,combinedHsFt:b.comb,secondaryHsFt:null},P,263.49);return r.ok?[m/r.centralFt]:[]}).sort((a,b)=>a-b);
if(ratios.length)console.log(`MOP Hs / central ratio: p10 ${f(ratios[Math.floor(ratios.length*.1)])} p50 ${f(ratios[Math.floor(ratios.length*.5)])} p90 ${f(ratios[Math.floor(ratios.length*.9)])} (n=${ratios.length})`);
