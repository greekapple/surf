import type {Measurement} from '../ocean/types.ts';
export function sourceStatus(m:Measurement,now=Date.now()){
 if(m.value===null)return 'Data unavailable';
 if(m.source.kind==='simulation')return 'Simulation — Not Actual Forecast';
 if(m.source.delivery==='saved')return m.source.kind==='observation'?'Saved observation':'Saved forecast';
 const valid=Date.parse(m.source.validAt),retrieved=Date.parse(m.source.retrievedAt);
 if(!Number.isFinite(valid)||!Number.isFinite(retrieved))return 'Timestamp unavailable';
 if(retrieved>now+300000)return 'Retrieval timestamp is in the future';
 if(m.source.kind==='observation'){const age=now-valid;return age>=-300000&&age<=7200000?'Recent observation':'Older observation'}
 if(valid<now-3600000)return 'Forecast · past valid time';
 return now-retrieved<3600000?'Recently retrieved forecast':'Older forecast retrieval';
}
