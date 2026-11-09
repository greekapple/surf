import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpots} from '../ocean/spots.ts';
import {rateOcean} from '../ratings/adapters.ts';
import {experimentRecord} from '../ocean/experiment.ts';
const now=Date.parse('2026-10-20T06:00:00Z');
function record(){return normalizeOpenMeteo(evidenceSpots[0],{hourly_units:{wave_height:'m',swell_wave_height:'m',swell_wave_period:'s',swell_wave_direction:'°'},hourly:{time:[now/1000],wave_height:[2],swell_wave_height:[1.7],swell_wave_period:[13],swell_wave_direction:[280]}},{hourly_units:{wind_speed_10m:'mph',wind_direction_10m:'°'},hourly:{time:[now/1000],wind_speed_10m:[3],wind_direction_10m:[90]}},new Date(now).toISOString())[0];}
test('real offshore inputs produce provisional ratings at each initial spot without breaking estimates',()=>{for(const s of evidenceSpots){const r={...record(),spotId:s.id},before=structuredClone(r),q=rateOcean(s,r,now);assert.notEqual(q.score,null);assert.equal(q.tier,'Provisional');assert.equal(q.reliability.category,'LIMITED');assert.ok(q.score!<=74);assert.equal(r.face.value,null);assert.deepEqual(r,before);assert.equal(q.validAt,r.timestamp);assert.match(q.constraints.join(' '),/alignment|exposure/);assert.equal(q.factors.filter(f=>f.weight>0).reduce((n,f)=>n+f.weight,0),1);}});
test('essential missing and mismatched timestamps return Unrated, optional missing factors stay explicit',()=>{for(const field of ['offshore','windSpeed','windDirection'] as const){const r=record();r[field]={...r[field],value:null};assert.equal(rateOcean(evidenceSpots[0],r,now).category,'UNRATED')}const r=record();r.primary.period.source={...r.primary.period.source,validAt:'2026-10-20T07:00:00Z'};assert.equal(rateOcean(evidenceSpots[0],r,now).category,'UNRATED');const q=rateOcean(evidenceSpots[0],record(),now);assert.match(q.factors.map(f=>f.reason).join(' '),/Gusts unavailable/);assert.match(q.factors.map(f=>f.reason).join(' '),/Secondary swell unavailable/);assert.equal(q.factors.find(f=>f.name==='Tide compatibility')?.score,null)});
test('zero offshore energy is Poor potential and never observational Flat',()=>{const r=record();r.offshore.value=0;r.primary.height.value=0;assert.equal(rateOcean(evidenceSpots[0],r,now).category,'POOR');assert.notEqual(rateOcean(evidenceSpots[0],r,now).category,'FLAT')});
test('severe wind lowers provisional score and simulation remains isolated',()=>{const r=record(),before=structuredClone(r),a=rateOcean(evidenceSpots[0],r,now),simulation=experimentRecord(r,{windSpeed:60}),b=rateOcean(evidenceSpots[0],simulation,now);assert.ok(b.score!<a.score!);assert.ok(b.score!<=39);assert.equal(b.mode,'simulation');assert.deepEqual(r,before);assert.deepEqual(rateOcean(evidenceSpots[0],r,now),a);assert.equal(b.reliability.category,'LIMITED')});
test('provisional explanations reflect weighted factors and stale evidence stays limited',()=>{const r=record(),q=rateOcean(evidenceSpots[0],r,now+86400000);assert.equal(q.baseScore,Math.round(q.factors.reduce((n,f)=>n+(f.score??0)*f.weight,0)));assert.equal(q.reliability.category,'LIMITED');assert.match(q.reliability.reasons.join(' '),/stale/);assert.deepEqual(q.positive,q.factors.filter(f=>f.weight>0&&f.score!==null&&f.score>=65).map(f=>f.name));assert.ok(!q.constraints.join(' ').includes('calibrated-model'))});
// One age rule per source (services/freshness.ts maxAgeFor): Open-Meteo marine inputs are refreshed every 3 h and stay current to 4 h; the wind inputs (hourly) go stale at 2 h.
test('freshness is chosen per source: wind goes stale at 2 h 1 min while marine stays fresh at 3 h 50 min', () => {
  const FRESH = /recently retrieved/, STALE = /saved or their retrieval is stale/, ago = (ms: number) => new Date(now - ms).toISOString(), MIN = 60000;
  const rate = (windAge: number, marineAge: number, order: 'normal' | 'wind-first' = 'normal') => {
    const r = record(); for (const k of ['offshore'] as const) r[k] = {...r[k], source: {...r[k].source, retrievedAt: ago(marineAge)}};
    r.primary = {height: {...r.primary.height, source: {...r.primary.height.source, retrievedAt: ago(marineAge)}}, period: {...r.primary.period, source: {...r.primary.period.source, retrievedAt: ago(marineAge)}}, direction: {...r.primary.direction, source: {...r.primary.direction.source, retrievedAt: ago(marineAge)}}} as any;
    for (const k of ['windSpeed', 'windDirection'] as const) r[k] = {...r[k], source: {...r[k].source, retrievedAt: ago(windAge)}};
    void order; return rateOcean(evidenceSpots[0], r, now).reliability.reasons.join(' | ');
  };
  assert.match(rate(0, 3 * 60 * MIN + 50 * MIN), FRESH, 'marine 3 h 50 min old, wind current: fresh');
  assert.match(rate(2 * 60 * MIN + MIN, 0), STALE, 'wind 2 h 1 min old, marine current: stale');
  assert.match(rate(2 * 60 * MIN - MIN, 0), FRESH, 'wind 1 h 59 min: fresh');
  assert.match(rate(0, 4 * 60 * MIN + MIN), STALE, 'marine 4 h 1 min: stale');
});
