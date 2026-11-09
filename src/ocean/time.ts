/* T-091: Intl.DateTimeFormat construction is very slow and these run for every hour of every spot (45 spots x ~190 hours, several times per render), so the formatters are built once and the results are memoised per timestamp string (bounded). */
/** The default zone: every spot until the world catalogue (spec 2026-11-09 C1). Spots carry an optional IANA `timeZone`; the zone-aware functions below take it, the pacific* names are the default-zone wrappers. */
export const DEFAULT_TIME_ZONE='America/Los_Angeles';
interface Fmts{date:Intl.DateTimeFormat;hour:Intl.DateTimeFormat;local:Intl.DateTimeFormat}
const fmtCache=new Map<string,Fmts>();
const fmts=(tz:string):Fmts=>{let f=fmtCache.get(tz);if(!f){f={date:new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}),hour:new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',hourCycle:'h23'}),local:new Intl.DateTimeFormat('en-US',{timeZone:tz,month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})};fmtCache.set(tz,f)}return f};
const dateMemo=new Map<string,string>(),hourMemo=new Map<string,number>();
const memo=<T,>(m:Map<string,T>,k:string,f:()=>T)=>{let v=m.get(k);if(v===undefined){if(m.size>20000)m.clear();v=f();m.set(k,v)}return v};
/** Calendar date (YYYY-MM-DD) of an ISO instant in `tz`. */
export function dateIn(tz:string,iso:string){return memo(dateMemo,tz+'|'+iso,()=>fmts(tz).date.format(new Date(iso)))}
/** Hour of day 0..23 of an ISO instant in `tz`. */
export function hourIn(tz:string,iso:string){return memo(hourMemo,tz+'|'+iso,()=>Number(fmts(tz).hour.format(new Date(iso)))%24)}
export const dateInMs=(tz:string,ms:number)=>fmts(tz).date.format(new Date(ms));
export const hourInMs=(tz:string,ms:number)=>Number(fmts(tz).hour.format(new Date(ms)))%24;
export const localTimeIn=(tz:string,iso:string)=>fmts(tz).local.format(new Date(iso));
/** The IANA zone is a real one (Intl accepts it); anything else falls back to the default rather than throwing in a render. */
export const validZone=(tz:string|null|undefined):string=>{if(!tz)return DEFAULT_TIME_ZONE;try{new Intl.DateTimeFormat('en-US',{timeZone:tz});return tz}catch{return DEFAULT_TIME_ZONE}};
/** A date key (YYYY-MM-DD) n calendar days on: pure date arithmetic, so it holds in every zone (the old noon-UTC trick lands on the wrong date east of UTC+11). */
export const addDaysKey=(key:string,n:number)=>new Date(Date.parse(key+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
/** UTC offset (ms, local minus UTC) of a zone at an instant. */
export const tzOffsetMs=(tz:string,ms:number):number=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)-Math.floor(ms/1000)*1000};
/** The instant of 12:00 local time on a local date key in `tz` (a DST day's noon is still noon). */
export const localMiddayMs=(tz:string,key:string):number=>{const guess=Date.parse(key+'T12:00:00Z');if(!Number.isFinite(guess))return NaN;let t=guess-tzOffsetMs(tz,guess);t=guess-tzOffsetMs(tz,t);return t};
const intlCache=new Map<string,Intl.DateTimeFormat>();
/** A cached Intl.DateTimeFormat for (zone, options): constructing one is slow (T-091), the clock labels of every screen go through here. */
export const fmtIn=(tz:string,opts:Intl.DateTimeFormatOptions,locale='en-US'):Intl.DateTimeFormat=>{const k=locale+'|'+tz+'|'+JSON.stringify(opts);let f=intlCache.get(k);if(!f){f=new Intl.DateTimeFormat(locale,{...opts,timeZone:tz});intlCache.set(k,f)}return f};
export function pacificDate(iso:string){return dateIn(DEFAULT_TIME_ZONE,iso)}
export function pacificHour(iso:string){return Number(fmts(DEFAULT_TIME_ZONE).hour.format(new Date(iso)))}
/** Pacific calendar date (YYYY-MM-DD) of an epoch-ms instant, with the cached formatter. */
export const pacificDateMs=(ms:number)=>dateInMs(DEFAULT_TIME_ZONE,ms);
/** Pacific hour of day 0..23 of an epoch-ms instant, with the cached formatter. */
export const pacificHourMs=(ms:number)=>hourInMs(DEFAULT_TIME_ZONE,ms);
export function localTime(iso:string){return localTimeIn(DEFAULT_TIME_ZONE,iso)}
export function utcTime(value:string){const m=value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?Z?$/);if(!m)return null;const [,year,month,day,hour,minute,second='00']=m;const canonical=`${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;const time=Date.parse(canonical);return Number.isFinite(time)&&new Date(time).toISOString()===canonical?canonical:null}
export function ageLabel(iso:string,now=Date.now()){const minutes=Math.floor((now-Date.parse(iso))/60000);if(!Number.isFinite(minutes))return 'Unknown age';if(minutes < -5)return 'Timestamp is in the future';return minutes<1?'Under a minute ago':minutes<60?`${minutes} min ago`:minutes<1440?`${Math.floor(minutes/60)} h ago`:`${Math.floor(minutes/1440)} days ago`}
