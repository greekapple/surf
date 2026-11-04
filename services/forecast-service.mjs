import {retryAfterMs,failureCategory,forecastRange,clippedGridURL} from './provider-policy.mjs';
/** Public ocean data only. Fixed providers and spot IDs; no arbitrary URL forwarding. */
/** California coast spots (generated from src/data/coast.ts; kept in sync by src/tests/coast.test.ts). */
export const coastServiceSpots=[{id:'spot-1',lat:37.9,lon:-122.644,mlat:37.839,mlon:-122.709},{id:'spot-4',lat:37.545,lon:-122.515,mlat:37.545,mlon:-122.616},{id:'spot-5',lat:37.495,lon:-122.5,mlat:37.468,mlon:-122.595},{id:'spot-6',lat:36.951,lon:-122.026,mlat:36.876,mlon:-122.06},{id:'spot-7',lat:36.962,lon:-122.023,mlat:36.883,mlon:-122.04},{id:'spot-8',lat:36.955,lon:-121.971,mlat:36.88,mlon:-122.005},{id:'spot-9',lat:37.011,lon:-122.196,mlat:36.984,mlon:-122.29},{id:'cs-crescent-city',lat:41.745,lon:-124.188,mlat:41.67,mlon:-124.225},{id:'cs-moonstone',lat:41.033,lon:-124.113,mlat:41.006,mlon:-124.213},{id:'cs-north-jetty',lat:40.768,lon:-124.236,mlat:40.789,mlon:-124.338},{id:'cs-shelter-cove',lat:40.024,lon:-124.07,mlat:39.949,mlon:-124.106},{id:'cs-point-arena',lat:38.914,lon:-123.712,mlat:38.874,mlon:-123.801},{id:'cs-salmon-creek',lat:38.354,lon:-123.068,mlat:38.34,mlon:-123.168},{id:'cs-dillon-beach',lat:38.25,lon:-122.969,mlat:38.264,mlon:-123.069},{id:'cs-waddell',lat:37.096,lon:-122.278,mlat:37.056,mlon:-122.365},{id:'cs-manresa',lat:36.93,lon:-121.864,mlat:36.89,mlon:-121.951},{id:'cs-moss-landing',lat:36.804,lon:-121.79,mlat:36.804,mlon:-121.89},{id:'cs-asilomar',lat:36.619,lon:-121.94,mlat:36.633,mlon:-122.038},{id:'cs-carmel',lat:36.553,lon:-121.928,mlat:36.539,mlon:-122.026},{id:'cs-sand-dollar',lat:35.924,lon:-121.469,mlat:35.863,mlon:-121.533},{id:'cs-morro-rock',lat:35.372,lon:-120.866,mlat:35.386,mlon:-120.963},{id:'cs-pismo',lat:35.138,lon:-120.644,mlat:35.098,mlon:-120.729},{id:'cs-jalama',lat:34.511,lon:-120.502,mlat:34.46,mlon:-120.576},{id:'cs-rincon',lat:34.373,lon:-119.478,mlat:34.312,mlon:-119.54},{id:'cs-c-street',lat:34.274,lon:-119.3,mlat:34.213,mlon:-119.362},{id:'cs-county-line',lat:34.051,lon:-118.964,mlat:33.976,mlon:-118.997},{id:'cs-zuma',lat:34.015,lon:-118.822,mlat:33.94,mlon:-118.855},{id:'cs-malibu',lat:34.036,lon:-118.678,mlat:33.956,mlon:-118.678},{id:'cs-topanga',lat:34.038,lon:-118.582,mlat:33.959,mlon:-118.599},{id:'cs-el-porto',lat:33.901,lon:-118.421,mlat:33.88,mlon:-118.514},{id:'cs-hermosa',lat:33.862,lon:-118.402,mlat:33.848,mlon:-118.497},{id:'cs-huntington',lat:33.655,lon:-118.003,mlat:33.589,mlon:-118.058},{id:'cs-wedge',lat:33.593,lon:-117.882,mlat:33.514,mlon:-117.899},{id:'cs-salt-creek',lat:33.479,lon:-117.729,mlat:33.439,mlon:-117.812},{id:'cs-trestles',lat:33.384,lon:-117.589,mlat:33.323,mlon:-117.651},{id:'cs-oceanside',lat:33.193,lon:-117.387,mlat:33.166,mlon:-117.477},{id:'cs-swamis',lat:33.035,lon:-117.293,mlat:33.021,mlon:-117.387},{id:'cs-cardiff',lat:33.014,lon:-117.282,mlat:32.987,mlon:-117.372},{id:'cs-blacks',lat:32.889,lon:-117.253,mlat:32.889,mlon:-117.348},{id:'cs-windansea',lat:32.83,lon:-117.281,mlat:32.816,mlon:-117.375},{id:'cs-ob-sd',lat:32.749,lon:-117.253,mlat:32.735,mlon:-117.347},{id:'cs-imperial',lat:32.579,lon:-117.134,mlat:32.552,mlon:-117.223}];
/** Extra buoys for the buoy-context card (kept in sync with src/ocean/buoys.ts by a test): NDBC text files and the CDIP 029 realtime CSV. */
export const contextBuoyKeys=['ndbc-46012','ndbc-46214','cdip-029'];
/** CDIP MOP transects the service ingests (assigned points only; kept in sync with src/ocean/mop.ts by a test). */
export const mopServiceIds=['SF023','SM375','MA121','SM340','SC149','SC117','SC255','DN194','HU708','HU541','M0151','SN080','MA563','SC319','SC049','MO893','MO716','MO646','MO111','SL347','SL091','B1084','VE466','VE019','L1059','L0904','L0809','L0577','L0530','OC517','OC379','OC177','D1206','D0905','D0704','D0681','D0541','D0457','D0352','D0054','SM306','HU029','B0001','MA137'];
/** Extra CO-OPS stations whose tide predictions are ingested (kept in sync with src/ocean/tideStations.ts by a test). */
export const tideServiceStationIds=['9414131','9415020'];
/** T-082: the nearest CO-OPS prediction station of every covered spot, high/low only (kept in sync with src/ocean/tideStations.ts by a test). */
export const tideHiloServiceStationIds=['9410120',  '9410230',  '9410580',  '9410599',  '9410738',  '9410777',  '9410840',  '9411189',  '9411270',  '9412110',  '9412802',  '9413375',  '9413450',  '9413616',  '9413663',  '9413745',  '9413878',  '9414275',  '9414958',  '9415469',  '9415625',  '9416841',  '9418024',  '9418767',  '9419059',  '9419750',  'TWC0413',  'TWC0419',  'TWC0445',  'TWC0473'];
export const serviceSpots=[{id:'spot-2',lat:37.759,lon:-122.51,mlat:37.75,mlon:-122.6},{id:'spot-0',lat:37.90835046,lon:-122.682137,mlat:37.88,mlon:-122.73},{id:'spot-3',lat:37.6,lon:-122.5,mlat:37.6,mlon:-122.57},...coastServiceSpots];
const waveFields=['wave_height','swell_wave_height','swell_wave_direction','swell_wave_period','secondary_swell_wave_height','secondary_swell_wave_direction','secondary_swell_wave_period','sea_surface_temperature'];
const regionalFields=['Thgt','Tper','Tdir','shgt','sper','sdir','ugrd10m','vgrd10m'];
/** Point forecast bounds: the northeast Pacific. Coordinates are rounded to 0.1 degree (about 11 km), the model's own resolution. */
export const POINT_BOUNDS={latMin:0,latMax:60,lonMin:-170,lonMax:-110};
export function validatePoint(latRaw,lonRaw){
 const blank=v=>v===null||v===undefined||String(v).trim()==='';
 const lat=blank(latRaw)?NaN:Number(latRaw),lon0=blank(lonRaw)?NaN:Number(lonRaw);
 if(!Number.isFinite(lat)||!Number.isFinite(lon0))return {ok:false,error:'lat and lon must be numbers'};
 const lon=lon0>180?lon0-360:lon0;
 const b=POINT_BOUNDS;if(lat<b.latMin||lat>b.latMax||lon<b.lonMin||lon>b.lonMax)return {ok:false,error:'Point forecasts cover the northeast Pacific: 0 to 60 N, 170 to 110 W'};
 const r=v=>Math.round(v*10)/10+0;return {ok:true,lat:r(lat),lon:r(lon)};
}
export function ingestionTargets(now=Date.now()){
 const date=new Date(now),start=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()));const from=start.toISOString().slice(0,10).replaceAll('-','');const end=new Date(start.getTime()+168*3600000).toISOString().replace('.000Z','Z');
 const targets=[];
 const spreadModels=['meteofrance_wave','ncep_gfswave016','gwam','ecmwf_wam025']; // T-114: same request as src/ocean/openMeteo.ts modelSpreadURL, so the browser never calls Open-Meteo directly for the spread. TTL 90 min: within the 2 h freshness rule (T-084), a third of the upstream load of 30 min (the spread changes with each model run, about 6 h)
 for(const s of serviceSpots){targets.push({key:'spread-'+s.id,ttl:5400000,url:'https://marine-api.open-meteo.com/v1/marine?'+new URLSearchParams({latitude:String(s.mlat),longitude:String(s.mlon),hourly:['wave_height','swell_wave_height','swell_wave_period','swell_wave_direction'].join(','),models:spreadModels.join(','),forecast_days:'7',timezone:'GMT',timeformat:'unixtime'})});}
 for(const s of serviceSpots){targets.push({key:'marine-'+s.id,ttl:1800000,url:'https://marine-api.open-meteo.com/v1/marine?'+new URLSearchParams({latitude:String(s.mlat),longitude:String(s.mlon),hourly:waveFields.join(','),timezone:'GMT',timeformat:'unixtime',forecast_days:'7'})},{key:'weather-'+s.id,ttl:1800000,url:'https://api.open-meteo.com/v1/forecast?'+new URLSearchParams({latitude:String(s.lat),longitude:String(s.lon),hourly:'wind_speed_10m,wind_direction_10m,wind_gusts_10m',wind_speed_unit:'mph',timezone:'GMT',timeformat:'unixtime',forecast_days:'7'})});}
 const noaa={station:'9414290',datum:'MLLW',time_zone:'gmt',units:'english',format:'json',application:'SURF'};
 targets.push({key:'tides',ttl:21600000,url:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+new URLSearchParams({...noaa,product:'predictions',begin_date:from,range:'192',interval:'h'})},{key:'tide-extrema',ttl:21600000,url:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+new URLSearchParams({...noaa,product:'predictions',begin_date:from,range:'192',interval:'hilo'})},{key:'level',ttl:600000,url:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+new URLSearchParams({...noaa,product:'water_level',date:'latest'})},{key:'buoy',ttl:600000,text:true,url:'https://www.ndbc.noaa.gov/data/realtime2/46026.txt'});
for(const id of ['46012','46214'])targets.push({key:'ndbc-'+id,ttl:900000,text:true,model:'NOAA NDBC '+id,url:'https://www.ndbc.noaa.gov/data/realtime2/'+id+'.txt'});
 targets.push({key:'cdip-029',ttl:900000,text:true,csv:true,model:'CDIP 029p1 realtime buoy',url:'https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/realtime/029p1_rt.nc?'+new URLSearchParams({var:'waveHs,waveTp,waveDp',time_start:new Date(now-86400000).toISOString(),time_end:new Date(now+3600000).toISOString(),accept:'csv'})});
for(const st of tideHiloServiceStationIds){const q={...noaa,station:st,product:'predictions',begin_date:from,range:'192'};targets.push({key:'tide-extrema-'+st,ttl:21600000,url:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+new URLSearchParams({...q,interval:'hilo'})});}
for(const st of tideServiceStationIds){const q={...noaa,station:st,product:'predictions',begin_date:from,range:'192'};targets.push({key:'tides-'+st,ttl:21600000,url:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+new URLSearchParams({...q,interval:'h'})},{key:'tide-extrema-'+st,ttl:21600000,url:'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?'+new URLSearchParams({...q,interval:'hilo'})});}
 for(const id of mopServiceIds){targets.push({key:'nearshore-'+id+'-forecast',ttl:3600000,text:true,csv:true,model:'CDIP MOP '+id+' forecast',url:'https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/model/MOP_alongshore/'+id+'_forecast.nc?'+new URLSearchParams({var:'waveHs,waveTp,waveDp,waveFlagPrimary',time_start:new Date(now-86400000).toISOString(),time_end:new Date(now+11*86400000).toISOString(),accept:'csv'})},{key:'nearshore-'+id+'-das',ttl:3600000,text:true,das:true,model:'CDIP MOP '+id+' forecast file attributes',url:'https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/'+id+'_forecast.nc.das'});}
 targets.push({key:'nearshore-SF023',ttl:1800000,text:true,csv:true,url:'https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/model/MOP_alongshore/SF023_nowcast.nc?'+new URLSearchParams({var:'waveHs,waveTp,waveDp,waveFlagPrimary',time_start:new Date(now-86400000).toISOString(),time_end:new Date(now+86400000).toISOString(),accept:'csv'})});
 for(const field of regionalFields){const wind=field.endsWith('10m'),dataset=wind?'NCEP_Global_Best':'NWW3_Global_Best';const query=`${field}[(${start.toISOString().replace('.000Z','Z')}):${wind?1:3}:(${end})]${wind?'':'[(0)]'}[(32):1:(42.5)][(233):1:(243)]`;targets.push({key:'grid-'+field,ttl:21600000,field,dataset,url:'https://upwell.pfeg.noaa.gov/erddap/griddap/'+dataset+'.json?'+query.replaceAll('[','%5B').replaceAll(']','%5D')});}
 return targets;
}
/** Map-seamless Stage 2a: a NATIVE 0.5-degree global frame. ERDDAP serves the grid as OPeNDAP binary (.dods): a text header, "Data:", then for each variable two big-endian uint32 element counts and the values (Float32 for the array, Float32/64 for the maps).
 *  `parseDodsGrid` reads one 2-D (lat x lon) float array plus its latitude and longitude maps. Pure, so it is unit-tested with a hand-built file. */
export function parseDodsGrid(buffer){
 const bytes=new Uint8Array(buffer),marker=new TextEncoder().encode('\nData:\n');let at=-1;
 outer:for(let i=0;i<Math.min(bytes.length,4096);i++){for(let j=0;j<marker.length;j++)if(bytes[i+j]!==marker[j])continue outer;at=i+marker.length;break;}
 if(at<0)throw new Error('DODS data marker not found');
 const header=new TextDecoder().decode(bytes.subarray(0,at)),m=/\[latitude = (\d+)\]\[longitude = (\d+)\]/.exec(header);if(!m)throw new Error('DODS grid shape not found');
 const nlat=+m[1],nlon=+m[2],view=new DataView(buffer);let o=at;
 const arr=(n,size,read)=>{if(view.getUint32(o)!==n||view.getUint32(o+4)!==n)throw new Error('DODS length mismatch');o+=8;const out=new Float64Array(n);for(let i=0;i<n;i++){out[i]=read(o+i*size);}o+=n*size;return out;};
 const f32=at=>view.getFloat32(at),f64=at=>view.getFloat64(at);
 const hasDepth=/\bdepth\[depth = 1\]/.test(header),values=arr(nlat*nlon,4,f32);arr(1,8,f64);if(hasDepth)arr(1,4,f32);const wide=/Float64 latitude\[/.test(header),lats=wide?arr(nlat,8,f64):arr(nlat,4,f32),lons=wide?arr(nlon,8,f64):arr(nlon,4,f32); // GFS's coordinate maps are Float64, WW3's Float32
 return {nlat,nlon,values,lats,lons};
}
const GRID_SCALE={Thgt:1000,shgt:1000,Tper:100,sper:100,Tdir:50,sdir:50,ugrd10m:300,vgrd10m:300};
/** Packs a parsed grid for the wire: latitude ascending, Int16 little-endian values scaled per field (NaN = -32768), base64. */
export function packOceanGrid(g,field){
 const scale=GRID_SCALE[field],wind=field.endsWith('10m'),flip=g.lats[0]>g.lats[g.nlat-1],q=new Int16Array(g.nlat*g.nlon);
 for(let y=0;y<g.nlat;y++){const sy=flip?g.nlat-1-y:y;for(let x=0;x<g.nlon;x++){const v=g.values[sy*g.nlon+x];q[y*g.nlon+x]=Number.isFinite(v)&&Math.abs(v*scale)<32760&&(wind||v>=0)?Math.round(v*scale):-32768;}}
 const bytes=new Uint8Array(q.buffer);let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));
 const la=flip?[...g.lats].reverse():[...g.lats];return {lat0:la[0],dlat:(la[la.length-1]-la[0])/(la.length-1),lon0:g.lons[0],dlon:(g.lons[g.lons.length-1]-g.lons[0])/(g.lons.length-1),nlat:g.nlat,nlon:g.nlon,scale,q:btoa(bin)};
}
/** T-129b: how old a stored value may be before the refresh re-fetches it. Visitors (no opts): the target's TTL. The cron: refresh-ahead = min(opts.ahead, 0.3 x TTL), so a value retrieved just now is NOT due on the next run for any TTL class
 *  (an absolute 40-minute lookahead went negative for 10-30 minute TTLs and refetched everything every run), and never earlier than opts.minAgeMs(target): the politeness floor for the quota-limited hosts. */
export function dueAfter(target,opts={}){const lead=Math.min(opts.ahead??0,0.3*target.ttl),floor=opts.minAgeMs?opts.minAgeMs(target):0;return Math.max(target.ttl-lead,floor);}
export function createForecastService({assets={},fetcher=fetch,now=Date.now,random=Math.random,sleep=ms=>new Promise(r=>setTimeout(r,ms)),timeoutMs=18000}={}){
 const memory=new Map(),inflight=new Map(),failures=new Map(),originFailures=new Map(),metadata=new Map(),metadataJobs=new Map();let manifest=null,refreshJob=null,counter=null;
 const dofetch=(...a)=>{if(counter)counter.used++;return fetcher(...a)}; // counts the upstream calls of a budgeted refresh (T-129b)
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
  const job=(async()=>{try{const r=await dofetch('https://upwell.pfeg.noaa.gov/erddap/info/'+target.dataset+'/index.json',{signal:AbortSignal.timeout(Math.min(timeoutMs,10000))});if(!r.ok)return old??null;const p=await r.json(),rows=p.table?.rows??[],attr=name=>rows.find(x=>x[1]==='NC_GLOBAL'&&x[2]===name)?.[4];const start=attr('time_coverage_start'),end=attr('time_coverage_end');if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end)))return old??null;const value={start,end,checkedAt:new Date(now()).toISOString(),issuedAt:null};metadata.set(target.dataset,value);if(env?.BUCKET)await env.BUCKET.put('forecast/v10/datasets/'+target.dataset+'.json',JSON.stringify(value));return value;}catch{return old??null}finally{metadataJobs.delete(target.dataset)}})();metadataJobs.set(target.dataset,job);return job;
 }
 async function retrieve(target,env,opts={}){
  if(inflight.has(target.key))return inflight.get(target.key);
  const job=(async()=>{
   const old=await read(env,target.key);if(old&&now()-Date.parse(old.validatedAt??old.retrievedAt)<dueAfter(target,opts))return {...old,cache:'fresh'};
   const last=await failure(env,target),origin=await originFailure(env,target),cooldown=[last,origin].filter(Boolean).sort((a,b)=>Date.parse(b.retryAt)-Date.parse(a.retryAt))[0];
   if(cooldown&&Date.parse(cooldown.retryAt)>now()){if(old)return {...old,cache:'stale',warning:'Provider cooling period; previous retrieval retained.',errorCategory:cooldown.category,retryAt:cooldown.retryAt};const e=new Error('Provider retry window active. '+cooldown.category);e.category=cooldown.category;e.retryAt=cooldown.retryAt;throw e;}
   let url=target.url;const started=now();let attempts=0;
   try{
    if(target.field)url=clippedGridURL(target,await datasetMetadata(target,env),now());
    let payload,raw,response;
    for(;;){attempts++;
     try{
      response=await dofetch(url,{signal:AbortSignal.timeout(timeoutMs),headers:{Accept:target.csv?'text/csv':target.text?'text/plain':'application/json',...(old?.etag?{'If-None-Match':old.etag}:{}),...(old?.lastModified?{'If-Modified-Since':old.lastModified}:{})}});
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
    if(target.csv&&!raw.startsWith('time,station,'))invalid('Unexpected nearshore response.');if(target.das&&!raw.includes('NC_GLOBAL'))invalid('Unexpected file-attribute response.');
    if(target.text&&!target.csv&&!target.das&&!raw.startsWith('#YY'))invalid('Unexpected buoy response.');
    const result={payload,retrievedAt:new Date(now()).toISOString(),issuedAt:null,sourceURL:url,model:target.model??target.dataset??(target.key.startsWith('marine-')?'Open-Meteo automatic marine model':target.key.startsWith('weather-')?'Open-Meteo automatic weather model':target.csv?'CDIP MOP SF023 nowcast':'NOAA station product'),delivery:'direct',validRange:forecastRange(payload),etag:response.headers.get('etag'),lastModified:response.headers.get('last-modified'),bytes:raw.length,durationMs:Math.max(0,now()-started),attempts};
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
 /** opts (cron path, T-129): {perRun, tick, ahead}. The Workers free plan allows 50 subrequests and 10 ms CPU per invocation, so one cron run refreshes ONE rotating slice of at most `perRun` targets (slice = tick mod ceil(targets/perRun)), and only those that will expire within `ahead` ms. No opts = every target (the token-protected /api/refresh). */
 async function refresh(env,opts={}){
  if(refreshJob)return refreshJob;
  refreshJob=(async()=>{const all=ingestionTargets(now()),count=opts.perRun?Math.ceil(all.length/opts.perRun):1,sliceIndex=count>1?Math.abs(Math.floor(opts.tick??0))%count:0,targets0=count>1?all.filter((_,i)=>i%count===sliceIndex):all,rot=opts.tick!==undefined&&opts.budget&&targets0.length?(Math.abs(Math.floor(opts.tick))*(opts.stride??40))%targets0.length:0,targets=rot?[...targets0.slice(rot),...targets0.slice(0,rot)]:targets0,results=[];let cursor=0,deferred=0,skipped=0;const run=opts.budget?{used:0,limit:opts.budget}:null;counter=run;const renv=run&&env?.BUCKET?{...env,BUCKET:{get:k=>{run.used++;return env.BUCKET.get(k)},put:(k,v,o)=>{run.used++;return env.BUCKET.put(k,v,o)}}}:env;const IDX='forecast/v8/index.json';let idx={};if(run&&renv?.BUCKET){try{const o=await renv.BUCKET.get(IDX);idx=o?await o.json():{};}catch{idx={};}};
   // At most four different provider groups; point-provider origins are serial; regional fields use at most two concurrent requests.
   const byOrigin=new Map();for(const t of targets){const host=new URL(t.url).hostname;if(!byOrigin.has(host))byOrigin.set(host,[]);byOrigin.get(host).push(t);}const groups=[...byOrigin.values()].flatMap(group=>group[0].field?[group.filter((_,i)=>i%2===0),group.filter((_,i)=>i%2===1)]:[group]);
   await Promise.all(Array.from({length:Math.min(4,groups.length)},async()=>{while(cursor<groups.length){const group=groups[cursor++];for(const t of group){if(run&&idx[t.key]&&now()-idx[t.key]<dueAfter(t,opts)){skipped++;continue;}/* fresh by the one index object: no R2 read at all */if(run&&run.used+3*(results.length+1)+8>run.limit){deferred++;continue;}try{const d=await retrieve(t,renv,{ahead:opts.ahead??0,minAgeMs:opts.minAgeMs});if(run&&d.cache!=='stale')idx[t.key]=Date.parse(d.validatedAt??d.retrievedAt)||now();results.push({key:t.key,state:d.cache==='stale'?'stale':'available',retrievedAt:d.retrievedAt,issuedAt:d.issuedAt,model:d.model,sourceURL:d.sourceURL,validRange:d.validRange??forecastRange(d.payload),warning:d.warning??null,errorCategory:d.errorCategory??null,retryAt:d.retryAt??null});}catch(e){results.push({key:t.key,state:'unavailable',message:e.message,errorCategory:e.category??failureCategory(e),retryAt:e.retryAt??null});}}}}));
   const report={attemptedAt:new Date(now()).toISOString(),persistent:persistent(env),revision:'0.10',results,...(run?{budget:{limit:run.limit,usedBeforeReport:run.used,deferred,freshByIndex:skipped,start:rot}}:{}),...(count>1?{slice:{index:sliceIndex,of:count,targets:targets.length,ofTargets:all.length}}:{})};manifest=report;
   counter=null;if(env?.BUCKET){const done=new Set(results.map(r=>r.key));if(run)await renv.BUCKET.put(IDX,JSON.stringify(idx));await renv.BUCKET.put('forecast/v8/status.json',JSON.stringify(report));
    // New compact manifests reference immutable per-retrieval snapshots. Legacy archives are untouched.
    const records=await Promise.all(targets.filter(t=>!run||done.has(t.key)).map(async t=>{const value=await read(renv,t.key);if(!value)return {providerKey:t.key,snapshot:null};const key='forecast/v10/snapshots/'+t.key+'/'+value.retrievedAt+'.json';if(!await env.BUCKET.get(key))await env.BUCKET.put(key,JSON.stringify(value));return {providerKey:t.key,snapshot:key,retrievedAt:value.retrievedAt,issuedAt:value.issuedAt,validRange:value.validRange??forecastRange(value.payload)};}));
    await env.BUCKET.put('forecast/v8/history/'+report.attemptedAt+'.json',JSON.stringify({schema:2,ingestedAt:report.attemptedAt,records}));
   }return report;
  })();try{return await refreshJob}finally{refreshJob=null;counter=null}
 }
 /** Coarse worldwide frame (2-degree stride of the native 0.5-degree grids) for the zoomed-out map. Fixed fields,
  * 3-hourly valid times within the next 8 days only; cached in memory (no arbitrary URL forwarding). */
 const globeCache=new Map(),globeJobs=new Map(),oceanCache=new Map(),oceanJobs=new Map(),rawCache=new Map();
 /** One native 0.5-degree global field at one valid time (map-seamless Stage 2a), packed (see packOceanGrid); cached in memory, bounded, fixed fields and datasets only. */
 async function oceanGrid(field,time){
  if(!regionalFields.includes(field))throw Object.assign(new Error('Unknown global field'),{status:400});
  const t=Date.parse(time),day=86400000;if(!Number.isFinite(t)||t%10800000!==0||t<now()-day||t>now()+8*day)throw Object.assign(new Error('Global frames are 3-hourly within the forecast range'),{status:400});
  const wind=field.endsWith('10m'),dataset=wind?'NCEP_Global_Best':'NWW3_Global_Best',nlat=wind?361:311,iso=new Date(t).toISOString().replace('.000Z','Z');
  const url='https://upwell.pfeg.noaa.gov/erddap/griddap/'+dataset+'.dods?'+(`${field}[(${iso})]${wind?'':'[(0)]'}[0:1:${nlat-1}][0:1:719]`).replaceAll('[','%5B').replaceAll(']','%5D');
  const hit=oceanCache.get(url);if(hit&&hit.expires>now())return hit.value;
  /** One ERDDAP grid, parsed (kept briefly: the swell frame needs the total-height frame of the same hour to tell "no swell partition" from "no data"). */
  const fetchParsed=async(fld,u,signal)=>{const old=rawCache.get(u);if(old&&old.expires>now())return old.g;const r=await fetcher(u,{signal});if(r.status===404)throw Object.assign(new Error('No global model frame at this valid time'),{status:404,code:'no_frame'});if(!r.ok)throw new Error('Global grid HTTP '+r.status);const buf=await r.arrayBuffer();if(buf.byteLength>4000000)throw new Error('Global grid payload exceeds bounded size.');const g=parseDodsGrid(buf);rawCache.set(u,{g,expires:now()+600000});while(rawCache.size>6)rawCache.delete(rawCache.keys().next().value);return g;};
  if(!oceanJobs.has(url))oceanJobs.set(url,(async()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs*2);try{const g=await fetchParsed(field,url,c.signal);
   // WW3 and GFS-Wave leave the swell partition EMPTY (NaN) where the sea is wind sea only; there the total height equals the wind-wave height to the centimetre (measured: median |Hs - Hs_wind| = 0.000 m over 12,303 such WW3 cells). That is "no swell partition", not missing data: the swell HEIGHT is 0 there, marked in the payload (noPartition) so the app can say so. Period and direction stay empty (there is no swell to have one).
   let noPartition=false;if(field==='shgt'){const tu=url.replace(/shgt/g,'Thgt'),tg=await fetchParsed('Thgt',tu,c.signal);if(tg.values.length===g.values.length){for(let i=0;i<g.values.length;i++)if(Number.isNaN(g.values[i])&&Number.isFinite(tg.values[i]))g.values[i]=0;noPartition=true;}}
   const value={...packOceanGrid(g,field),retrievedAt:new Date(now()).toISOString(),url,dataset,field,validAt:iso,...(noPartition?{noPartition:true}:{})};oceanCache.set(url,{value,expires:now()+1800000});while(oceanCache.size>24)oceanCache.delete(oceanCache.keys().next().value);return value;}finally{clearTimeout(timer);oceanJobs.delete(url);}})());
  return oceanJobs.get(url);
 }
 async function globeFrame(field,time){
  if(!regionalFields.includes(field))throw Object.assign(new Error('Unknown global field'),{status:400});
  const t=Date.parse(time),day=86400000;if(!Number.isFinite(t)||t%10800000!==0||t<now()-day||t>now()+8*day)throw Object.assign(new Error('Global frames are 3-hourly within the forecast range'),{status:400});
  const wind=field.endsWith('10m'),dataset=wind?'NCEP_Global_Best':'NWW3_Global_Best',iso=new Date(t).toISOString().replace('.000Z','Z');
  const url='https://upwell.pfeg.noaa.gov/erddap/griddap/'+dataset+'.json?'+(`${field}[(${iso})]${wind?'':'[(0)]'}[(-76):4:(76)][(0):4:(358)]`).replaceAll('[','%5B').replaceAll(']','%5D');
  const hit=globeCache.get(url);if(hit&&hit.expires>now())return hit.value;
  if(!globeJobs.has(url))globeJobs.set(url,(async()=>{const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs*2);try{const r=await fetcher(url,{signal:c.signal});if(r.status===404)throw Object.assign(new Error('No global model frame at this valid time'),{status:404,code:'no_frame'});if(!r.ok)throw new Error('Global grid HTTP '+r.status);const raw=await r.text();if(raw.length>4000000)throw new Error('Global grid payload exceeds bounded size.');const payload=JSON.parse(raw);if(!payload.table?.rows?.length||payload.table.rows.length>20000)throw new Error('Global grid absent or oversized');const value={payload,retrievedAt:new Date(now()).toISOString(),sourceURL:url,cache:'fresh'};globeCache.set(url,{value,expires:now()+3*3600000});while(globeCache.size>48)globeCache.delete(globeCache.keys().next().value);return value}finally{clearTimeout(timer);globeJobs.delete(url)}})());
  return globeJobs.get(url);
 }
  /** Model point forecast (Open-Meteo Marine + Weather) for any validated sea point. Fixed hosts, rounded coordinates, bounded in-memory cache. */
 const pointCache=new Map(),pointJobs=new Map(),POINT_MAX=200,POINT_TTL=1800000;
 async function pointForecast(lat,lon){
  const key=lat+','+lon,hit=pointCache.get(key);if(hit&&hit.expires>now()){pointCache.delete(key);pointCache.set(key,hit);return hit.value;}
  if(pointJobs.has(key))return pointJobs.get(key);
  const job=(async()=>{
   const common={latitude:String(lat),longitude:String(lon),timezone:'GMT',timeformat:'unixtime',forecast_days:'7'};
   const get=async(base,params)=>{const r=await fetcher(base+new URLSearchParams({...common,...params}),{signal:AbortSignal.timeout(timeoutMs)});if(!r.ok)throw Object.assign(new Error('Provider HTTP '+r.status),{status:502});const raw=await r.text();if(raw.length>1000000)throw new Error('Provider payload exceeds bounded size.');return JSON.parse(raw);};
   const [m,w]=await Promise.all([get('https://marine-api.open-meteo.com/v1/marine?',{hourly:'wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_period,swell_wave_direction,secondary_swell_wave_height,secondary_swell_wave_period,secondary_swell_wave_direction'}),get('https://api.open-meteo.com/v1/forecast?',{hourly:'wind_speed_10m,wind_direction_10m,wind_gusts_10m',wind_speed_unit:'ms'})]);
   const time=m?.hourly?.time;if(!Array.isArray(time)||!time.length||!m.hourly.wave_height?.some(v=>Number.isFinite(v)))throw Object.assign(new Error('No marine model data at this point (land or outside model coverage)'),{status:404});
   const align=arr=>{const idx=new Map((w?.hourly?.time??[]).map((t,i)=>[t,i]));return time.map(t=>{const v=arr?.[idx.get(t)];return Number.isFinite(v)?v:null});};
   const col=a=>(a??[]).map(v=>Number.isFinite(v)?v:null);
   /* T-117: wave direction and period (the pin label), secondary swell and gusts (the hourly panel) come in the same two requests; no extra upstream calls. */
   const value={lat,lon,time,waveHeight:col(m.hourly.wave_height),waveDirection:col(m.hourly.wave_direction),wavePeriod:col(m.hourly.wave_period),swell2Height:col(m.hourly.secondary_swell_wave_height),swell2Period:col(m.hourly.secondary_swell_wave_period),swell2Direction:col(m.hourly.secondary_swell_wave_direction),windGust:align(w?.hourly?.wind_gusts_10m),swellHeight:col(m.hourly.swell_wave_height),swellPeriod:col(m.hourly.swell_wave_period),swellDirection:col(m.hourly.swell_wave_direction),windSpeed:align(w?.hourly?.wind_speed_10m),windDirection:align(w?.hourly?.wind_direction_10m),units:{height:'m',period:'s',direction:'deg',wind:'m/s'},source:'Open-Meteo Marine and Weather models',kind:'model point forecast',retrievedAt:new Date(now()).toISOString()};
   pointCache.set(key,{value,expires:now()+POINT_TTL});while(pointCache.size>POINT_MAX)pointCache.delete(pointCache.keys().next().value);
   return value;
  })();pointJobs.set(key,job);try{return await job}finally{pointJobs.delete(key)}
 }
const handle=async function(request,env={},ctx={waitUntil:()=>{}}){const url=new URL(request.url);try{
  if(url.pathname==='/api/health'){const obj=await fromBucket(env,'forecast/v8/status.json');return json({service:'SURF forecast ingestion',version:'0.8',revision:'0.10',persistent:persistent(env),refresh:obj??manifest,scheduler:'Configured/executed status must be verified from the linked automation, separately from this readback.'});}
  if(url.pathname==='/api/diagnostics')return json({checkedAt:new Date(now()).toISOString(),persistent:persistent(env),providers:await diagnostics(env)});
  if(url.pathname==='/api/refresh'){if(request.method!=='POST')return json({error:'POST required'},405);const origin=request.headers.get('origin');if(origin&&origin!==url.origin)return json({error:'Origin rejected'},403);if(env.REFRESH_TOKEN&&request.headers.get('authorization')!=='Bearer '+env.REFRESH_TOKEN)return json({error:'Refresh authorization required'},403);return json(await refresh(env));}
  if(url.pathname==='/api/provider'){const key=url.searchParams.get('key'),target=ingestionTargets(now()).find(t=>t.key===key&&!t.field);if(!target)return json({error:'Unknown fixed provider key'},400);return json(await retrieve(target,env));}
  if(url.pathname==='/api/point'){const v=validatePoint(url.searchParams.get('lat'),url.searchParams.get('lon'));if(!v.ok)return json({error:v.error},400);try{return json(await pointForecast(v.lat,v.lon))}catch(e){return json({error:e.message??'Point forecast unavailable'},e.status??502)}}
  if(url.pathname==='/api/ocean'){try{const g=await oceanGrid(url.searchParams.get('field')??'',url.searchParams.get('time')??'');return Response.json(g,{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=21600'}})}catch(e){return json({error:e.message,code:e.code},e.status??502)}}
  if(url.pathname==='/api/globe'){try{const g=await globeFrame(url.searchParams.get('field')??'',url.searchParams.get('time')??'');return Response.json(g,{headers:{'Cache-Control':'public, max-age=300, stale-while-revalidate=21600'}})}catch(e){return json({error:e.message,code:e.code},e.status??502)}}
  if(url.pathname==='/api/grid'){const field=url.searchParams.get('field'),time=url.searchParams.get('time'),target=ingestionTargets(now()).find(t=>t.field===field);if(!target||!time||!Number.isFinite(Date.parse(time)))return json({error:'Invalid regional field or timestamp'},400);const value=await retrieve(target,env),table=value.payload.table,ti=table.columnNames.indexOf('time'),rows=table.rows.filter(r=>Date.parse(r[ti])===Date.parse(time));if(!rows.length)return json({error:'No exact regional model frame at this valid time',code:'no_frame'},404);return json({...value,payload:{table:{...table,rows}}});}
  if(url.pathname.startsWith('/api/'))return json({error:'Unknown endpoint'},404);
  if(request.method!=='GET'&&request.method!=='HEAD')return new Response('Method not allowed',{status:405});
  const asset=assets[url.pathname]??(!url.pathname.includes('.')?assets['/index.html']:null);if(!asset)return new Response('Not found',{status:404});const bytes=Uint8Array.from(atob(asset.body),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':url.pathname.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'}});
 }catch(e){return json({error:e.message??'Forecast service unavailable',category:e.category??failureCategory(e),retryAt:e.retryAt??null},502)}};
handle.refresh=refresh;return handle;
}
