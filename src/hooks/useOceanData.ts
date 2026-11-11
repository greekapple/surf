import {useEffect,useMemo,useState} from 'react';
import {loadOcean} from '../ocean/pipeline';
import type {OceanBundle,ConnectionStatus} from '../ocean/types';
import {nextFailed, spotLoaded} from '../services/dataPhase';
import {mergeSpotBundle} from '../ocean/mergeBundle';
/** `scope`: the spot ids to load (ocean/spotScope.ts); a change loads only the spots not loaded before and keeps showing the current bundle meanwhile. Omitted: every spot. */
export function useOceanData(enabled:boolean,scope?:string[]|null){
 const scopeKey=scope?scope.join(','):'*';
 const [bundle,setBundle]=useState<OceanBundle|null>(null),[loading,setLoading]=useState(false),[statuses,setStatuses]=useState<ConnectionStatus[]>([]),[error,setError]=useState(''),[version,setVersion]=useState(0),[failed,setFailed]=useState<Set<string>>(()=>new Set());
 useEffect(()=>{if(!enabled)return;const interval=window.setInterval(()=>{if(!document.hidden)setVersion(v=>v+1)},600000);return()=>window.clearInterval(interval)},[enabled]);
 useEffect(()=>{if(!enabled)return;let active=true;setLoading(true);setError('');(async()=>{const onStatus=(status:ConnectionStatus)=>{if(active)setStatuses(s=>[...s.filter(x=>x.id!==status.id),status])};
  /* B7: the selected spot (scope[0]) is loaded ALONE first and MERGED into the bundle already on screen (the other spots' records and loadedSpotIds stay; nothing is lost if the full load fails), so a spot far from the rest never waits for the whole batch */
  const primary=scope&&scope.length>1?scope[0]:null;
  if(primary){try{const first=await loadOcean(onStatus,new Set([primary]));if(active&&first.records.some(r=>r.offshore.value!==null))setBundle(old=>mergeSpotBundle(old,first,primary))}catch{/* the full load below reports the failure */}}
  return loadOcean(onStatus,scope?new Set(scope):null)})().then(value=>{if(active){const ok=value.records.some(r=>r.offshore.value!==null);setBundle(old=>{setFailed(f=>nextFailed(f,scope??null,value.loadedSpotIds,ok,ok?null:old?.loadedSpotIds?new Set(old.loadedSpotIds):null));return ok?value:old??value});if(!ok)setError('Refresh did not provide usable wave data; any prior retrieval remains visible with its original timestamps.');setStatuses(value.statuses)}}).catch(()=>{if(active){setBundle(old=>{setFailed(f=>nextFailed(f,scope??null,null,false,old?.loadedSpotIds?new Set(old.loadedSpotIds):null));return old});}if(active)setError('The data pipeline could not load. Original demonstration mode is available separately.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[enabled,version,scopeKey]); // eslint-disable-line react-hooks/exhaustive-deps
 const loaded=useMemo(()=>bundle?.loadedSpotIds?new Set(bundle.loadedSpotIds):null,[bundle]);
 /** true once this spot's forecast was asked for in the current bundle (a spot outside the scope, or any spot before the first retrieval has arrived or failed, has NOT loaded: screens show a loading state for it, never a number or "no data") */
 const isSpotLoaded=(id:string)=>spotLoaded({enabled,bundle,error,loading,loaded,failed},id);
 /** review HIGH: the retrieval that should have covered this spot failed (and none is running now): screens show the failure and "Try again" */
 const isSpotFailed=(id:string)=>enabled&&!loading&&failed.has(id)&&!(loaded?.has(id)??false); // A6: no bundle yet and no error = still loading, never "no data"
 return {bundle,loading,statuses,error,reload:()=>setVersion(x=>x+1),isSpotLoaded,isSpotFailed};
}
