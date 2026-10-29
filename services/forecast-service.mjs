import {retryAfterMs,failureCategory,forecastRange,clippedGridURL} from './provider-policy.mjs';
/** Public ocean data only. Fixed providers and spot IDs; no arbitrary URL forwarding. */
/** California coast spots (generated from src/data/coast.ts; kept in sync by src/tests/coast.test.ts). */
export const coastServiceSpots=[{id:'spot-1',lat:37.9,lon:-122.644,mlat:37.839,mlon:-122.709},{id:'spot-4',lat:37.545,lon:-122.515,mlat:37.545,mlon:-122.616},{id:'spot-5',lat:37.495,lon:-122.5,mlat:37.468,mlon:-122.595},{id:'spot-6',lat:36.951,lon:-122.026,mlat:36.876,mlon:-122.06},{id:'spot-7',lat:36.962,lon:-122.023,mlat:36.883,mlon:-122.04},{id:'spot-8',lat:36.955,lon:-121.971,mlat:36.88,mlon:-122.005},{id:'spot-9',lat:37.011,lon:-122.196,mlat:36.984,mlon:-122.29},{id:'cs-crescent-city',lat:41.745,lon:-124.188,mlat:41.67,mlon:-124.225},{id:'cs-moonstone',lat:41.033,lon:-124.113,mlat:41.006,mlon:-124.213},{id:'cs-north-jetty',lat:40.768,lon:-124.236,mlat:40.789,mlon:-124.338},{id:'cs-shelter-cove',lat:40.024,lon:-124.07,mlat:39.949,mlon:-124.106},{id:'cs-point-arena',lat:38.914,lon:-123.712,mlat:38.874,mlon:-123.801},{id:'cs-salmon-creek',lat:38.354,lon:-123.068,mlat:38.34,mlon:-123.168},{id:'cs-dillon-beach',lat:38.25,lon:-122.969,mlat:38.264,mlon:-123.069},{id:'cs-waddell',lat:37.096,lon:-122.278,mlat:37.056,mlon:-122.365},{id:'cs-manresa',lat:36.93,lon:-121.864,mlat:36.89,mlon:-121.951},{id:'cs-moss-landing',lat:36.804,lon:-121.79,mlat:36.804,mlon:-121.89},{id:'cs-asilomar',lat:36.619,lon:-121.94,mlat:36.633,mlon:-122.038},{id:'cs-carmel',lat:36.553,lon:-121.928,mlat:36.539,mlon:-122.026},{id:'cs-sand-dollar',lat:35.924,lon:-121.469,mlat:35.863,mlon:-121.533},{id:'cs-morro-rock',lat:35.372,lon:-120.866,mlat:35.386,mlon:-120.963},{id:'cs-pismo',lat:35.138,lon:-120.644,mlat:35.098,mlon:-120.729},{id:'cs-jalama',lat:34.511,lon:-120.502,mlat:34.46,mlon:-120.576},{id:'cs-rincon',lat:34.373,lon:-119.478,mlat:34.312,mlon:-119.54},{id:'cs-c-street',lat:34.274,lon:-119.3,mlat:34.213,mlon:-119.362},{id:'cs-county-line',lat:34.051,lon:-118.964,mlat:33.976,mlon:-118.997},{id:'cs-zuma',lat:34.015,lon:-118.822,mlat:33.94,mlon:-118.855},{id:'cs-malibu',lat:34.036,lon:-118.678,mlat:33.956,mlon:-118.678},{id:'cs-topanga',lat:34.038,lon:-118.582,mlat:33.959,mlon:-118.599},{id:'cs-el-porto',lat:33.901,lon:-118.421,mlat:33.88,mlon:-118.514},{id:'cs-hermosa',lat:33.862,lon:-118.402,mlat:33.848,mlon:-118.497},{id:'cs-huntington',lat:33.655,lon:-118.003,mlat:33.589,mlon:-118.058},{id:'cs-wedge',lat:33.593,lon:-117.882,mlat:33.514,mlon:-117.899},{id:'cs-salt-creek',lat:33.479,lon:-117.729,mlat:33.439,mlon:-117.812},{id:'cs-trestles',lat:33.384,lon:-117.589,mlat:33.323,mlon:-117.651},{id:'cs-oceanside',lat:33.193,lon:-117.387,mlat:33.166,mlon:-117.477},{id:'cs-swamis',lat:33.035,lon:-117.293,mlat:33.021,mlon:-117.387},{id:'cs-cardiff',lat:33.014,lon:-117.282,mlat:32.987,mlon:-117.372},{id:'cs-blacks',lat:32.889,lon:-117.253,mlat:32.889,mlon:-117.348},{id:'cs-windansea',lat:32.83,lon:-117.281,mlat:32.816,mlon:-117.375},{id:'cs-ob-sd',lat:32.749,lon:-117.253,mlat:32.735,mlon:-117.347},{id:'cs-imperial',lat:32.579,lon:-117.134,mlat:32.552,mlon:-117.223}];
export const serviceSpots=[{id:'spot-2',lat:37.759,lon:-122.51,mlat:37.75,mlon:-122.6},{id:'spot-0',lat:37.90835046,lon:-122.682137,mlat:37.88,mlon:-122.73},{id:'spot-3',lat:37.6,lon:-122.5,mlat:37.6,mlon:-122.57},...coastServiceSpots];
const waveFields=['wave_height','swell_wave_height','swell_wave_direction','swell_wave_period','secondary_swell_wave_height','secondary_swell_wave_direction','secondary_swell_wave_period','sea_surface_temperature'];
const regionalFields=['Thgt','Tper','Tdir','shgt','sper','sdir','ugrd10m','vgrd10m'];
export function ingestionTargets(now=Date.now()){
 const date=new Date(now),start=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));const from=start.toISOString().slice(0,10).replaceAll('-','');const end=new Date(start.getTime()+168*3600000).toISOString().replace('.000Z','Z');
 const targets=[];
 for(const s of serviceSpots){targets.push({key:'marine-'+s.id,ttl:1800000,url:'https://marine-api.open-meteo.com/v1/marine?'+new URLSearchParams({latitude:String(s.mlat),longitude:String(s.mlon),hourly:waveFields.join(','),timezone:'GMT',timeformat:'unixtime',forecast_days:'7'})},{key:'weather-'+s.id,ttl:1800000,url:'https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:String(s.lat),longitude:String(s.lon),hourly:'wind_speed_10m,wind_direction_10m,wind_gusts_10m',wind_speed_unit:'mph',timezone:'GMT',timeformat:'unixtime',forecast_days:'7'})});}
 const noaa={station:'9414290',datum:'MLLW',time_zone:'gmt',units:'english',format:'json',application:'SURF'};
 targets.push({key:'tides',ttl:21600000,url:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+new URLSearchParams({...noaa,product:'predictions',begin_date:from,range:'192',interval:'h'})},{key:'tide-extrema',ttl:21600000,url:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+new URLSearchParams({...noaa,product:'predictions',begin_date:from,range:'192',interval:'hilo'})},{key:'level',ttl:600000,url:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+new URLSearchParams({...noaa,product:'water_level',date:'latest'})},{key:'buoy',ttl:600000,text:true,url:'https://www.ndbc.noaa.gov/data/realtime2/46026.txt'});
 targets.push({key:'nearshore-SF023',ttl:1800000,text:true,csv:true,url:'https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/model/MOP_alongshore/SF023_nowcast.nc?'+new URLSearchParams({var:'waveHs,waveTp,waveDp,waveFlagPrimary',time_start:new Date(now-86400000).toISOString(),time_end:new Date(now+86400000).toISOString(),accept:'csv'})});
 for(const field of regionalFields){const wind=field.endsWith('10m'),dataset=wind?'NCEP_Global_Best':'NWW3_Global_Best';const query=`${field}[(${start.toISOString().replace('.000Z','Z')}):${wind?1:3}:(${end})]${wind?'':'[(0)]'}[(32):1:(42.5)][(233):1:(243)]`;targets.push({key:'grid-'+field,ttl:21600000,field,dataset,url:'https://upwell.pfeg.noaa.gov/erddap/griddap/'+dataset+'.json?'+query.replaceAll('[','%5B').replaceAll(']','%5D')});}
 return targets;
}
export function createForecastService({assets={},fetcher=fetch,now=Date.now,random=Math.random,sleep=ms=>new Promise(r=>setTimeout(r,ms)),timeoutMs=18000}={}){
 const memory=new Map(),inflight=new Map(),failures=new Map(),originFailures=new Map(),metadata=new Map(),metadataJobs=new Map();let manifest=null,refreshJob=null;
 const persistent=env=>!!env?.BUCKET&&!env.LOCAL_PREVIEW;
 const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 const fromBucket=async(env,key)=>{const obj=await env?.BUCKET?.get(key);return obj?obj.json():null;};
 async function read(env,key){if(memory.has(key))return memory.get(key);const data=await fromBucket(env,'forecast/v8/latest/'+key+'.json');if(data)memory.set(key,data);return data;}
 async function save(env,key,value){memory.set(key,value);if(env?.BUCKET)await env.BUCKET.put('forecast/v8/latest/'+key+'.json',JSON.stringify(value),{httpMetadata:{contentType:'application/json'}});}
 async function failure(env,target){if(!failures.has(target.key))failures.set(target.key,await fromBucket(env,'forecast/v10/failures/'+target.key+'.json'));return failures.get(target.key);}
 async function originFailure(env,target){const host=new URL(target.url).hostname;if(!originFailures.has(host))originFailures.set(host,await fromBucket(env,'forecast/v10/origins/'+host+'.json'));return originFailures.get(host);}
 async function datasetMetadata(target,env){
  if(!target.dataset)return null;
  const old=metadata.get(target.dataset)??await fromBucket(env,'forecast/v10/datasets/'+target.dataset+'.json');if(old&&now()-Date.parse(old.checkedAt)<3600000){metadata.set(target.dataset,old);return old;}
  if(metadataJobs.has(target.dataset))return metadataJobs.get(target.dataset);
  const job=(async()=>{try{const r=await fetcher('https://upwell.pfeg.noaa.gov/erddap/info/'+target.dataset+'/index.json',{signal:AbortSignal.timeout(Math.min(timeoutMs,10000))});if(!r.ok)return old??null;const p=await r.json(),rows=p.table?.rows??[],attr=name=>rows.find(x=>x[1]==='NC_GLOBAL'&&x[2]===name)?.[4];const start=attr('time_coverage_start'),end=attr('time_coverage_end');if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end)))return old??null;const value={start,end,checkedAt:new Date(now()).toISOString(),issuedAt:null};metadata.set(target.dataset,value);if(env?.BUCKET)await env.BUCKET.put('forecast/v10/datasets/'+target.dataset+'.json',JSON.stringify(value));return value;}catch{return old??null}finally{metadataJobs.delete(target.dataset)}})();metadataJobs.set(target.dataset,job);return job;
 }
 async function retrieve(target,env){
  if(inflight.has(target.key))return inflight.get(target.key);
  const job=(async()=>{
   const old=await read(env,target.key);if(old&&now()-Date.parse(old.validatedAt??old.retrievedAt)<target.ttl)return {...old,cache:'fresh'};
   const last=await failure(env,target),origin=await originFailure(env,target),cooldown=[last,origin].filter(Boolean).sort((a,b)=>Date.parse(b.retryAt)-Date.parse(a.retryAt))[0];
   if(cooldown&&Date.parse(cooldown.retryAt)>now()){if(old)return {...old,cache:'stale',warning:'Provider cooling period; previous retrieval retained.',errorCategory:cooldown.category,retryAt:cooldown.retryAt};const e=new Error('Provider retry window active. '+cooldown.category);e.category=cooldown.category;e.retryAt=cooldown.retryAt;throw e;}
   let url=target.url;const started=now();let attempts=0;
   try{
    if(target.field)url=clippedGridURL(target,await datasetMetadata(target,env),now());
    let payload,raw,response;
    for(;;){attempts++;
     try{
      response=await fetcher(url,{signal:AbortSignal.timeout(timeoutMs),headers:{Accept:target.csv?'text/csv':target.text?'text/plain':'application/json',...(old?.etag?{'If-None-Match':old.etag}:{}),...(old?.lastModified?{'If-Modified-Since':old.lastModified}:{})}});
      if(response.status===304&&old){const value={...old,validatedAt:new Date(now()).toISOString()};await save(env,target.key,value);return {...value,cache:'fresh'};}
      if(!response.ok){const e=new Error('Provider HTTP '+response.status);e.status=response.status;e.retryAfter=response.headers.get('retry-after');throw e;}
      if(Number(response.headers.get('content-length'))>3000000)throw Object.assign(new Error('Provider payload exceeds bounded size.'),{validation:true});
      raw=await response.text();if(raw.length>3000000)throw Object.assign(new Error('Provider payload exceeds bounded size.'),{validation:true});payload=target.text?raw:JSON.parse(raw);break;
     }catch(e){const category=failureCategory(e),retryDelay=retryAfterMs(e.retryAfter,now());if(attempts<2&&(category==='upstream'||category==='network')&&!target.field&&(retryDelay===null||retryDelay<=1000)){await sleep(retryDelay??(250+Math.floor(random()*500)));continue;}throw e;}
    }
    const invalid=message=>{throw Object.assign(new Error(message),{validation:true})};
    if(payload?.error)invalid('Provider reported unavailable data.');
    if((target.key.startsWith('marine-')||target.key.startsWith('weather-'))&&(!Array.isArray(payload?.hourly?.time)||!payload.hourly.time.length))invalid('Hourly data absent.');
    if(target.field&&(!payload.table?.rows?.length||payload.table.rows.length>60000))invalid('Regional grid absent or oversized.');
    if(target.csv&&!raw.startsWith('time,station,'))invalid('Unexpected nearshore response.');
    if(target.text&&!target.csv&&!raw.startsWith('#YY'))invalid('Unexpected buoy response.');
    const result={payload,retrievedAt:new Date(now()).toISOString(),issuedAt:null,sourceURL:url,model:target.dataset??(target.key.startsWith('marine-')?'Open-Meteo automatic marine model':target.key.startsWith('weather-')?'Open-Meteo automatic weather model':target.csv?'CDIP MOP SF023 nowcast':'NOAA station product'),delivery:'direct',validRange:forecastRange(payload),etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified'),bytes:raw.length,durationMs:Math.max(0,now()-started),attempts};
    await save(env,target.key,result);failures.set(target.key,null);if(env?.BUCKET)await env.BUCKET.put('forecast/v10/failures/'+target.key+'.json','null');return {...result,cache:'updated'};
   }catch(e){
    const category=e.category??failureCategory(e),count=(last?.count??0)+1,delay=retryAfterMs(e.retryAfter,now())??(category==='rate-limited'?60000:category==='not-found'?3600000:Math.min(1800000,30000*2**Math.min(count-1,6))*(.85+random()*.3));
    const record={category,message:e.message,count,attemptedAt:new Date(now()).toISOString(),retryAt:new Date(now()+delay).toISOString(),attempts,durationMs:Math.max(0,now()-started)};failures.set(target.key,record);if(env?.BUCKET)await env.BUCKET.put('forecast/v10/failures/'+target.key+'.json',JSON.stringify(record));
    if(category==='rate-limited'){const host=new URL(target.url).hostname;originFailures.set(host,record);if(env?.BUCKET)await env.BUCKET.put('forecast/v10/origins/'+host+'.json',JSON.stringify(record));}
    if(old)return {...old,cache:'stale',warning:e.message,errorCategory:category,retryAt:record.retryAt};e.category=category;e.retryAt=record.retryAt;throw e;
   }
  })();inflight.set(target.key,job);try{return await job}finally{inflight.delete(target.key)}
 }
 async function diagnostics(env){return Promise.all(ingestionTargets(now()).map(async t=>{const value=await read(env,t.key),error=await failure(env,t)??await originFailure(env,t),age=value?Math.max(0,now()-Date.parse(value.retrievedAt)):null;return {key:t.key,provider:value?.model??new URL(t.url).hostname,retrievedAt:value?.retrievedAt??null,issuedAt:value?.issuedAt??null,validRange:value?.validRange??forecastRange(value?.payload),cacheAgeMs:age,ttlMs:t.ttl,state:!value?'unavailable':now()-Date.parse(value.validatedAt??value.retrievedAt)<=t.ttl&&(!error||Date.parse(error.attemptedAt)<Date.parse(value.retrievedAt))?'fresh':'stale',errorCategory:error?.category??null,error:error?.message??null,retryAt:error?.retryAt??null,bytes:value?.bytes??null,durationMs:value?.durationMs??null};}));}
 async function refresh(env){
  if(refreshJob)return refreshJob;
  refreshJob=(async()=>{const targets=ingestionTargets(now()),results=[];let cursor=0;
   // At most four different provider groups; point-provider origins are serial; regional fields use at most two concurrent requests.
   const byOrigin=new Map();for(const t of targets){const host=new URL(t.url).hostname;if(!byOrigin.has(host))byOrigin.set(host,[]);byOrigin.get(host).push(t);}const groups=[...byOrigin.values()].flatMap(group=>group[0].field?[group.filter((_,i)=>i%2===0),group.filter((_,i)=>i%2===1)]:[group]);
   await Promise.all(Array.from({length:Math.min(4,groups.length)},async()=>{while(cursor<groups.length){const group=groups[cursor++];for(const t of group){try{const d=await retrieve(t,env);results.push({key:t.key,state:d.cache==='stale'?'stale':'available',retrievedAt:d.retrievedAt,issuedAt:d.issuedAt,model:d.model,sourceURL:d.sourceURL,validRange:d.validRange??forecastRange(d.payload),warning:d.warning??null,errorCategory:d.errorCategory??null,retryAt:d.retryAt??null});}catch(e){results.push({key:t.key,state:'unavailable',message:e.message,errorCategory:e.category??failureCategory(e),retryAt:e.retryAt??null});}}}}));
   const report={attemptedAt:new Date(now()).toISOString(),persistent:persistent(env),revision:'0.10',results};manifest=report;
   if(env?.BUCKET){await env.BUCKET.put('forecast/v8/status.json',JSON.stringify(report));
    // New compact manifests reference immutable per-retrieval snapshots. Legacy archives are untouched.
    const records=await Promise.all(targets.map(async t=>{const value=await read(env,t.key);if(!value)return {providerKey:t.key,snapshot:null};const key='forecast/v10/snapshots/'+t.key+'/'+value.retrievedAt+'.json';if(!await env.BUCKET.get(key))await env.BUCKET.put(key,JSON.stringify(value));return {providerKey:t.key,snapshot:key,retrievedAt:value.retrievedAt,issuedAt:value.issuedAt,validRange:value.validRange??forecastRange(value.payload)};}));
    await env.BUCKET.put('forecast/v8/history/'+report.attemptedAt+'.json',JSON.stringify({schema:2,ingestedAt:report.attemptedAt,records}));
   }return report;
  })();try{return await refreshJob}finally{refreshJob=null}
 }
 /** Coarse worldwide frame (2-degree stride of the native 0.5-degree grids) for the zoomed-out map. Fixed fields,
  * 3-hourly valid times within the next 8 days only; cached in memory (no arbitrary URL forwarding). */
 const globeCache=new Map(),globeJobs=new Map();
 async function globeFrame(field,time){
  if(!regionalFields.includes(field))throw Object.assign(new Error('Unknown global field'),{status:400});
  const t=Date.parse(time),day=86400000;if(!Number.isFinite(t)||t%10800000!==0||t<now()-day||t>now()+8*day)throw Object.assign(new Error('Global frames are 3-hourly within the forecast range'),{status:400});
  const wind=field.endsWith('10m'),dataset=wind?'NCEP_Global_Best':'NWW3_Global_Best',iso=new Date(t).toISOString().replace('.000Z','Z');
  const url='https://upwell.pfeg.noaa.gov/erddap/griddap/'+dataset+'.json?'+(`${field}[(${iso})]${wind?'':'[(0)]'}[(-76):4:(76)][(0):4:(358)]`).replaceAll('[','%5B').replaceAll(']','%5D');
  const hit=globeCache.get(url);if(hit&&hit.expires>now())return hit.value;
  if(!globeJobs.has(url))globeJobs.set(url,(async()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs*2);try{const r=await fetcher(url,{signal:c.signal});if(r.status===404)throw Object.assign(new Error('No global model frame at this valid time'),{status:404,code:'no_frame'});if(!r.ok)throw new Error('Global grid HTTP '+r.status);const raw=await r.text();if(raw.length>4000000)throw new Error('Global grid payload exceeds bounded size.');const payload=JSON.parse(raw);if(!payload.table?.rows?.length||payload.table.rows.length>20000)throw new Error('Global grid absent or oversized');const value={payload,retrievedAt:new Date(now()).toISOString(),sourceURL:url,cache:'fresh'};globeCache.set(url,{value,expires:now()+3*3600000});while(globeCache.size>48)globeCache.delete(globeCache.keys().next().value);return value}finally{clearTimeout(timer);globeJobs.delete(url)}})());
  return globeJobs.get(url);
 }
 return async function handle(request,env={},ctx={waitUntil:()=>{}}){const url=new URL(request.url);try{
  if(url.pathname==='/api/health'){const obj=await fromBucket(env,'forecast/v8/status.json');return json({service:'SURF forecast ingestion',version:'0.8',revision:'0.10',persistent:persistent(env),refresh:obj??manifest,scheduler:'Configured/executed status must be verified from the linked automation, separately from this readback.'});}
  if(url.pathname==='/api/diagnostics')return json({checkedAt:new Date(now()).toISOString(),persistent:persistent(env),providers:await diagnostics(env)});
  if(url.pathname==='/api/refresh'){if(request.method!=='POST')return json({error:'POST required'},405);const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Origin rejected'},403);if(env.REFRESH_TOKEN&&request.headers.get('authorization')!=='Bearer '+env.REFRESH_TOKEN)return json({error:'Refresh authorization required'},403);return json(await refresh(env));}
  if(url.pathname==='/api/provider'){const key=url.searchParams.get('key'),target=ingestionTargets(now()).find(t=>t.key===key&&!t.field);if(!target)return json({error:'Unknown fixed provider key'},400);return json(await retrieve(target,env));}
  if(url.pathname==='/api/globe'){try{return json(await globeFrame(url.searchParams.get('field')??'',url.searchParams.get('time')??''))}catch(e){return json({error:e.message,code:e.code},e.status??502)}}
  if(url.pathname==='/api/grid'){const field=url.searchParams.get('field'),time=url.searchParams.get('time'),target=ingestionTargets(now()).find(t=>t.field===field);if(!target||!time||!Number.isFinite(Date.parse(time)))return json({error:'Invalid regional field or timestamp'},400);const value=await retrieve(target,env),table=value.payload.table,ti=table.columnNames.indexOf('time'),rows=table.rows.filter(r=>Date.parse(r[ti])===Date.parse(time));if(!rows.length)return json({error:'No exact regional model frame at this valid time',code:'no_frame'},404);return json({...value,payload:{table:{...table,rows}}});}
  if(url.pathname.startsWith('/api/'))return json({error:'Unknown endpoint'},404);
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  const asset=assets[url.pathname]??(!url.pathname.includes('.')?assets['/index.html']:null);if(!asset)return new Response('Not found',{status:404});const bytes=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'}});
 }catch(e){return json({error:e.message??'Forecast service unavailable',category:e.category??failureCategory(e),retryAt:e.retryAt??null},502)}};
}
