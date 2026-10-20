import {retryAfterMs,failureCategory,forecastRange,clippedGridURL} from './provider-policy.mjs';
/** Public ocean data only. Fixed providers and spot IDs; no arbitrary URL forwarding. */
export const serviceSpots=[{id:'spot-2',lat:37.759,lon:-122.51,mlat:37.75,mlon:-122.6},{id:'spot-0',lat:37.90835046,lon:-122.682137,mlat:37.88,mlon:-122.73},{id:'spot-3',lat:37.6,lon:-122.5,mlat:37.6,mlon:-122.57}];
const waveFields=['wave_height','swell_wave_height','swell_wave_direction','swell_wave_period','secondary_swell_wave_height','secondary_swell_wave_direction','secondary_swell_wave_period','sea_surface_temperature'];
const regionalFields=['Thgt','Tper','Tdir','shgt','sper','sdir','ugrd10m','vgrd10m'];
export function ingestionTargets(now=Date.now()){
 const date=new Date(now),start=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));const from=start.toISOString().slice(0,10).replaceAll('-','');const end=new Date(start.getTime()+96*3600000).toISOString().replace('.000Z','Z');
 const targets=[];
 for(const s of serviceSpots){targets.push({key:'marine-'+s.id,ttl:1800000,url:'https://marine-api.open-meteo.com/v1/marine?'+new URLSearchParams({latitude:String(s.mlat),longitude:String(s.mlon),hourly:waveFields.join(','),timezone:'GMT',timeformat:'unixtime',forecast_days:'7'})},{key:'weather-'+s.id,ttl:1800000,url:'https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:String(s.lat),longitude:String(s.lon),hourly:'wind_speed_10m,wind_direction_10m,wind_gusts_10m',wind_speed_unit:'mph',timezone:'GMT',timeformat:'unixtime',forecast_days:'7'})});}
 const noaa={station:'9414290',datum:'MLLW',time_zone:'gmt',units:'english',format:'json',application:'SURF'};
 targets.push({key:'tides',ttl:21600000,url:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+new URLSearchParams({...noaa,product:'predictions',begin_date:from,range:'192',interval:'h'})},{key:'tide-extrema',ttl:21600000,url:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+new URLSearchParams({...noaa,product:'predictions',begin_date:from,range:'192',interval:'hilo'})},{key:'level',ttl:600000,url:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+new URLSearchParams({...noaa,product:'water_level',date:'latest'})},{key:'buoy',ttl:600000,text:true,url:'https://www.ndbc.noaa.gov/data/realtime2/46026.txt'});
 targets.push({key:'nearshore-SF023',ttl:1800000,text:true,csv:true,url:'https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/model/MOP_alongshore/SF023_nowcast.nc?'+new URLSearchParams({var:'waveHs,waveTp,waveDp,waveFlagPrimary',time_start:new Date(now-86400000).toISOString(),time_end:new Date(now+86400000).toISOString(),accept:'csv'})});
 for(const field of regionalFields){const wind=field.endsWith('10m'),dataset=wind?'NCEP_Global_Best':'NWW3_Global_Best';const query=`${field}[(${start.toISOString().replace('.000Z','Z')}):1:(${end})]${wind?'':'[(0)]'}[(36):1:(40)][(234):1:(238)]`;targets.push({key:'grid-'+field,ttl:21600000,field,dataset,url:'https://upwell.pfeg.noaa.gov/erddap/griddap/'+dataset+'.json?'+query.replaceAll('[','%5B').replaceAll(']','%5D')});}
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
    if(target.field&&(!payload.table?.rows?.length||payload.table.rows.length>14000))invalid('Regional grid absent or oversized.');
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
 return async function handle(request,env={},ctx={waitUntil:()=>{}}){const url=new URL(request.url);try{
  if(url.pathname==='/api/health'){const obj=await fromBucket(env,'forecast/v8/status.json');return json({service:'SURF forecast ingestion',version:'0.8',revision:'0.10',persistent:persistent(env),refresh:obj??manifest,scheduler:'Configured/executed status must be verified from the linked automation, separately from this readback.'});}
  if(url.pathname==='/api/diagnostics')return json({checkedAt:new Date(now()).toISOString(),persistent:persistent(env),providers:await diagnostics(env)});
  if(url.pathname==='/api/refresh'){if(request.method!=='POST')return json({error:'POST required'},405);const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Origin rejected'},403);if(env.REFRESH_TOKEN&&request.headers.get('authorization')!=='Bearer '+env.REFRESH_TOKEN)return json({error:'Refresh authorization required'},403);return json(await refresh(env));}
  if(url.pathname==='/api/provider'){const key=url.searchParams.get('key'),target=ingestionTargets(now()).find(t=>t.key===key&&!t.field);if(!target)return json({error:'Unknown fixed provider key'},400);return json(await retrieve(target,env));}
  if(url.pathname==='/api/grid'){const field=url.searchParams.get('field'),time=url.searchParams.get('time'),target=ingestionTargets(now()).find(t=>t.field===field);if(!target||!time||!Number.isFinite(Date.parse(time)))return json({error:'Invalid regional field or timestamp'},400);const value=await retrieve(target,env),table=value.payload.table,ti=table.columnNames.indexOf('time'),rows=table.rows.filter(r=>Date.parse(r[ti])===Date.parse(time));if(!rows.length)return json({error:'No exact regional model frame at this valid time'},404);return json({...value,payload:{table:{...table,rows}}});}
  if(url.pathname.startsWith('/api/'))return json({error:'Unknown endpoint'},404);
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  const asset=assets[url.pathname]??(!url.pathname.includes('.')?assets['/index.html']:null);if(!asset)return new Response('Not found',{status:404});const bytes=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'}});
 }catch(e){return json({error:e.message??'Forecast service unavailable',category:e.category??failureCategory(e),retryAt:e.retryAt??null},502)}};
}
