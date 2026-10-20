import {useEffect,useState} from 'react';
import {loadSpatial,spatialSpec,retrySpatialConnection,type SpatialFrame} from '../map/spatial';
import type {MapLayer,MapVariable} from '../map/types';
export function useSpatial(layer:MapLayer,variable:MapVariable,time:string|null,secondary:boolean,enabled:boolean){
 const spec=spatialSpec(layer,variable,time,secondary),key=spec?JSON.stringify(spec):'';
 const [result,setResult]=useState<{key:string;frame:SpatialFrame|null;status:string}>({key:'',frame:null,status:'Spatial field unavailable.'});
 const [retry,setRetry]=useState(0);
 useEffect(()=>{if(!enabled||!spec)return;const controller=new AbortController();setResult({key,frame:null,status:'Loading genuine regional forecast grid…'});const timer=setTimeout(()=>{loadSpatial(spec,controller.signal).then(frame=>{if(!controller.signal.aborted)setResult({key,frame,status:frame.cells.some(c=>c.value!==null)?'Regional model grid available':'All cells are missing in this frame.'})}).catch(e=>{if(!controller.signal.aborted)setResult({key,frame:null,status:`Continuous heatmap unavailable: ${e instanceof Error?e.message:'provider connection failed'} Point forecasts remain available.`})});},160);return()=>{clearTimeout(timer);controller.abort()};},[key,enabled,retry]);
 return {loading:enabled&&!!spec&&(result.key!==key||result.status.startsWith('Loading')),cachedFrame:spec&&result.key===key?result.frame:null,frame:enabled&&spec&&result.key===key?result.frame:null,status:!enabled?'Regional forecast overlays are off.':!spec?'No spatial field for this selection. Tide is a station; secondary swell and gusts remain point measurements.':result.key===key?result.status:'Loading selected forecast frame…',retry:()=>{retrySpatialConnection();setRetry(n=>n+1)}};
}
