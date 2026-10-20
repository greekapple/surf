import type {MapLayer,MapVariable} from './types.ts';
import {mapVariables} from './model.ts';
export interface MapPreferences {layer:MapLayer;variable:MapVariable;component:'Primary'|'Secondary';heatmap:boolean;arrows:boolean;flow:boolean;markers:boolean;opacity:number}
export const mapPreferenceKey='surf-map-v2';
export const defaultMapPreferences:MapPreferences={layer:'WAVES',variable:'Offshore Hs',component:'Primary',heatmap:true,arrows:true,flow:false,markers:true,opacity:.62};
export function parseMapPreferences(value:unknown):MapPreferences {
 const v=value&&typeof value==='object'?value as Record<string,unknown>:{};const layer=typeof v.layer==='string'&&v.layer in mapVariables?v.layer as MapLayer:defaultMapPreferences.layer;
 return {layer,variable:mapVariables[layer].includes(v.variable as MapVariable)?v.variable as MapVariable:mapVariables[layer][0],component:v.component==='Secondary'?'Secondary':'Primary',heatmap:typeof v.heatmap==='boolean'?v.heatmap:true,arrows:typeof v.arrows==='boolean'?v.arrows:true,flow:typeof v.flow==='boolean'?v.flow:false,markers:typeof v.markers==='boolean'?v.markers:true,opacity:typeof v.opacity==='number'&&Number.isFinite(v.opacity)?Math.max(0,Math.min(1,v.opacity)):.62};
}
export function loadMapPreferences(storage:Pick<Storage,'getItem'>):MapPreferences {try{return parseMapPreferences(JSON.parse(storage.getItem(mapPreferenceKey)??'null'))}catch{return {...defaultMapPreferences}}}
export function saveMapPreferences(storage:Pick<Storage,'setItem'>,p:MapPreferences){try{storage.setItem(mapPreferenceKey,JSON.stringify(p));return true}catch{return false}}
