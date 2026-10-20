import {useEffect,useState} from 'react';
import {loadOcean} from '../ocean/pipeline';
import type {OceanBundle,ConnectionStatus} from '../ocean/types';
export function useOceanData(enabled:boolean){
 const [bundle,setBundle]=useState<OceanBundle|null>(null),[loading,setLoading]=useState(false),[statuses,setStatuses]=useState<ConnectionStatus[]>([]),[error,setError]=useState(''),[version,setVersion]=useState(0);
 useEffect(()=>{if(!enabled)return;let active=true;setLoading(true);setError('');loadOcean(status=>{if(active)setStatuses(s=>[...s.filter(x=>x.id!==status.id),status])}).then(value=>{if(active){setBundle(value);setStatuses(value.statuses)}}).catch(()=>{if(active)setError('The data pipeline could not load. Original demonstration mode is available separately.')}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[enabled,version]);
 return {bundle,loading,statuses,error,reload:()=>setVersion(x=>x+1)};
}
