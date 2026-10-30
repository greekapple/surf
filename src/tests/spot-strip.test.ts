import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spotStrip} from '../services/spotStrip.ts';
import {normalizeOpenMeteo} from '../ocean/openMeteo.ts';
import {evidenceSpot} from '../ocean/spots.ts';
import {toLegacy} from '../ocean/bridge.ts';
import {allSpots} from '../data/catalog.ts';
import {defaultProfile,forecasts,spots as demoSpots} from '../data/demo.ts';
const profile={...defaultProfile,heightUnit:'ft' as const,scale:'Face height' as const};
const t=1792454400,now=t*1000+600000; // 10 min into the hour of the first record
const marine=(swellDir:number,hs=1.5,combined=1.6)=>({latitude:37.75,longitude:-122.6,hourly_units:{wave_height:'m',swell_wave_height:'m',swell_wave_direction:'°',swell_wave_period:'s',secondary_swell_wave_height:'m',secondary_swell_wave_direction:'°',secondary_swell_wave_period:'s',sea_surface_temperature:'°C'},hourly:{time:[t-3600,t,t+3600],wave_height:[combined,combined,combined],swell_wave_height:[hs,hs,hs],swell_wave_direction:[swellDir,swellDir,swellDir],swell_wave_period:[14,14,14],secondary_swell_wave_height:[null,null,null],secondary_swell_wave_direction:[null,null,null],secondary_swell_wave_period:[null,null,null],sea_surface_temperature:[15,15,15]}});
const weather={hourly_units:{wind_speed_10m:'mp/h',wind_direction_10m:'°',wind_gusts_10m:'mp/h'},hourly:{time:[t-3600,t,t+3600],wind_speed_10m:[5,5,5],wind_direction_10m:[90,90,90],wind_gusts_10m:[8,8,8]}};
const recs=(id:string,dir:number)=>normalizeOpenMeteo(evidenceSpot(id),marine(dir),weather,new Date(now).toISOString()).map(toLegacy);
const strip=(ids:string[],records:ReturnType<typeof recs>)=>spotStrip(allSpots,records,ids,now,profile);

test('estimate present: label is "Est. X–Y ft" and uses the current-hour record',()=>{
 const [s]=strip(['spot-2'],recs('spot-2',270));
 assert.equal(s.heightKind,'estimate');assert.match(s.heightLabel,/^Est\. \d+–\d+ ft$/);
 assert.equal(s.validTime,new Date(t*1000).toISOString());assert.equal(s.name,'Ocean Beach');assert.ok(s.category.length>0);assert.equal(s.demo,false);
});
test('estimate refused: falls back to a labelled offshore height, never a bare number',()=>{
 const [s]=strip(['spot-2'],recs('spot-2',180)); // swell from the south, outside the window
 assert.equal(s.heightKind,'offshore');assert.match(s.heightLabel,/^\d+\.\d ft offshore$/);assert.doesNotMatch(s.heightLabel,/Est\./);
 const [other]=strip(['spot-3'],recs('spot-3',270)); // no profile for Linda Mar
 assert.equal(other.heightKind,'offshore');
});
test('missing data: no record, or no offshore height, says so',()=>{
 const [none]=strip(['spot-2'],[]);assert.equal(none.heightKind,'none');assert.equal(none.validTime,null);assert.equal(none.category,'UNRATED');assert.equal(none.heightLabel,'No forecast data');
 const r=recs('spot-2',180).map(f=>({...f,offshore:NaN})); // estimate refused and no offshore heightconst [s]=strip(['spot-2'],r);assert.equal(s.heightKind,'none');assert.equal(s.heightLabel,'No offshore height');
 const past=recs('spot-2',270).filter(f=>Date.parse(f.timestamp)<t*1000);assert.equal(strip(['spot-2'],past)[0].heightKind,'none'); // a stale hour is not shown as current
});
test('demo spot: labelled offshore, flagged demo',()=>{
 const demo=forecasts.filter(f=>f.spotId==='spot-5').map(f=>({...f,timestamp:new Date(t*1000).toISOString()})).slice(0,1);
 assert.ok(demo.length===1&&!demo[0].evidence);
 const [s]=spotStrip(demoSpots,demo,['spot-5'],now,profile);
 assert.equal(s.demo,true);assert.equal(s.name,'Mavericks');assert.match(s.heightLabel,/ft offshore$/);
});
test('saved order is kept, duplicates and unknown ids are dropped, units follow the profile',()=>{
 const r=[...recs('spot-2',270),...recs('spot-3',270)];
 assert.deepEqual(strip(['spot-3','nope','spot-2','spot-3'],r).map(s=>s.id),['spot-3','spot-2']);
 const [m]=spotStrip(allSpots,recs('spot-3',270),['spot-3'],now,{...profile,heightUnit:'m'});assert.match(m.heightLabel,/ m offshore$/);
});
