/* T-091: Intl.DateTimeFormat construction is very slow and these run for every hour of every spot (45 spots x ~190 hours, several times per render), so the formatters are built once and the results are memoised per timestamp string (bounded). */
const dateFmt=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit'}),hourFmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',hourCycle:'h23'}),localFmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/Los_Angeles',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'});
const dateMemo=new Map<string,string>(),hourMemo=new Map<string,number>();
const memo=<T,>(m:Map<string,T>,k:string,f:()=>T)=>{let v=m.get(k);if(v===undefined){if(m.size>20000)m.clear();v=f();m.set(k,v)}return v};
export function pacificDate(iso:string){return memo(dateMemo,iso,()=>dateFmt.format(new Date(iso)))}
export function pacificHour(iso:string){return memo(hourMemo,iso,()=>Number(hourFmt.format(new Date(iso))))}
/** Pacific calendar date (YYYY-MM-DD) of an epoch-ms instant, with the cached formatter. */
export const pacificDateMs=(ms:number)=>dateFmt.format(new Date(ms));
/** Pacific hour of day 0..23 of an epoch-ms instant, with the cached formatter. */
export const pacificHourMs=(ms:number)=>Number(hourFmt.format(new Date(ms)))%24;
export function localTime(iso:string){return localFmt.format(new Date(iso))}
export function utcTime(value:string){const m=value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?Z?$/);if(!m)return null;const [,year,month,day,hour,minute,second='00']=m;const canonical=`${year}-${month}-${day}T${hour}:${minute}:${second}.000Z`;const time=Date.parse(canonical);return Number.isFinite(time)&&new Date(time).toISOString()===canonical?canonical:null}
export function ageLabel(iso:string,now=Date.now()){const minutes=Math.floor((now-Date.parse(iso))/60000);if(!Number.isFinite(minutes))return 'Unknown age';if(minutes < -5)return 'Timestamp is in the future';return minutes<1?'Under a minute ago':minutes<60?`${minutes} min ago`:minutes<1440?`${Math.floor(minutes/60)} h ago`:`${Math.floor(minutes/1440)} days ago`}
