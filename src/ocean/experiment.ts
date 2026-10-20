import type {OceanRecord,Measurement} from './types.ts';
import type {SimulationPatch} from '../services/simulation.ts';
export function experimentRecord(original:OceanRecord,p:SimulationPatch):OceanRecord{
 const r=structuredClone(original);r.mode='simulation';
 const edit=(m:Measurement,v:number|undefined)=>v===undefined?m:{...m,value:v,source:{...m.source,kind:'simulation' as const,provider:'User experiment input',nativeUnit:m.unit,issuedAt:null,updatedAt:null,notes:'Hypothetical input, not an ocean observation or physical wave model.'}};
 r.face=edit(r.face,p.face);r.primary.height=edit(r.primary.height,p.swellHeight);r.primary.direction=edit(r.primary.direction,p.direction);r.primary.period=edit(r.primary.period,p.period);r.windSpeed=edit(r.windSpeed,p.windSpeed);r.windDirection=edit(r.windDirection,p.windDirection);
 if(p.windSpeed!==undefined)r.gusts={...r.gusts,value:null,reason:'Gusts not synthesized for a hypothetical wind change.'};
 if(p.tideStage)r.tideTrend=p.tideStage==='Rising'?'Rising':p.tideStage==='Falling'?'Falling':'Unknown';
 if(p.tideHeight!==undefined)r.tide=edit(r.tide,p.tideHeight);
 if(p.character)r.character=p.character;
 return r;
}
