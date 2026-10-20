import {useMemo,useRef,useState,type SetStateAction} from 'react';
import type {MapCamera,MapLayer,MapVariable} from '../map/types';
import {mapVariables} from '../map/model';
import {selectedRecord,recordOnDay} from '../utils/interaction';
import {forecasts,spots} from '../data/demo';
import {selectRecord} from '../services/forecast';
import {simulateForecast,type SimulationPatch} from '../services/simulation';
import {useOceanData} from './useOceanData';
import {evidenceSpots} from '../ocean/spots';
import {pacificDate,pacificHour} from '../ocean/time';
import {toLegacy} from '../ocean/bridge';
import {experimentRecord} from '../ocean/experiment';
export function useForecast(){
 const [dataMode,setMode]=useState<'Retrieved'|'Demonstration'>('Retrieved');
 const [selected,setSelected]=useState('spot-2'),[day,setDay]=useState(0),[hour,setHour]=useState(9),[simulation,setSimulation]=useState(false),[patch,setPatch]=useState<SimulationPatch>({}),[instant,setInstant]=useState<string|null>(null);
 const [comparisonSets,setComparisonSets]=useState<Record<string,string[]>>({Retrieved:[],Demonstration:[]});
 const [mapLayer,setLayer]=useState<MapLayer>('SWELL'),[mapVariable,setMapVariable]=useState<MapVariable>('Height'),[mapComponent,setMapComponent]=useState<'Primary'|'Secondary'>('Primary');
 const mapCamera=useRef<MapCamera>({lat:37.78,lng:-122.64,zoom:9});
 const ocean=useOceanData(dataMode==='Retrieved');
 const records=ocean.bundle?.records??[];const spotRecords=records.filter(r=>r.spotId===selected);
 const realOriginal=selectedRecord(records,selected,instant);
 const realRecord=realOriginal&&simulation?experimentRecord(realOriginal,patch):realOriginal;
 const demoOriginal=selectRecord(forecasts,selected,day,hour)!;
 // The legacy projection carries explicit missing flags. It never converts offshore height to surf height.
 const original=dataMode==='Retrieved'&&realOriginal?toLegacy(realOriginal):dataMode==='Retrieved'?{...demoOriginal,face:NaN,offshore:NaN,character:'Unknown',availability:{face:false,swell:false,wind:false,tide:false,organization:false}}:demoOriginal;
 const change=(fn:()=>void)=>{fn();setSimulation(false);setPatch({})};
 const dates=[...new Set(spotRecords.map(r=>pacificDate(r.timestamp)))];
 const mapRecords=useMemo(()=>dataMode==='Retrieved'?records.map(toLegacy):forecasts,[dataMode,records]);
 const timeline=useMemo(()=>[...new Set(mapRecords.map(f=>f.timestamp))].sort((a,b)=>Date.parse(a)-Date.parse(b)),[mapRecords]);
 const selectedTime=dataMode==='Retrieved'?(instant??realOriginal?.timestamp??timeline.find(t=>Date.parse(t)>=Date.now())??timeline[0]??null):demoOriginal.timestamp;
 return {mapLayer,mapVariable,mapComponent,setMapComponent,setMapVariable,setMapLayer:(v:MapLayer)=>{setLayer(v);setMapVariable(mapVariables[v][0])},mapCamera,mapRecords,timeline,selectedTime,compared:comparisonSets[dataMode],setCompared:(next:SetStateAction<string[]>)=>setComparisonSets(s=>({...s,[dataMode]:typeof next==='function'?next(s[dataMode]):next})),selectTime:(t:string)=>change(()=>{if(dataMode==='Retrieved')setInstant(t);else{const f=forecasts.find(f=>f.timestamp===t);if(f){setDay(f.day);setHour(f.hour)}}}),dataMode,setDataMode:(v:'Retrieved'|'Demonstration')=>change(()=>{setMode(v);if(v==='Retrieved'&&!evidenceSpots.some(s=>s.id===selected))setSelected('spot-2')}),ocean,records,realOriginal,realRecord,dates,
 selected,day:dataMode==='Retrieved'&&realOriginal?dates.indexOf(pacificDate(realOriginal.timestamp)):day,hour:dataMode==='Retrieved'&&realOriginal?pacificHour(realOriginal.timestamp):hour,spot:spots.find(s=>s.id===selected)!,original,forecast:dataMode==='Retrieved'&&realRecord?toLegacy(realRecord):simulation?simulateForecast(original,patch):original,simulation,patch,
 selectSpot:(id:string)=>change(()=>{setInstant(realOriginal?.timestamp??instant);setSelected(id)}),selectDay:(d:number)=>change(()=>{if(dataMode==='Retrieved'){const date=dates[d];const next=recordOnDay(spotRecords,date,realOriginal?pacificHour(realOriginal.timestamp):9);setInstant(next?.timestamp??null)}else setDay(d)}),selectHour:(h:number)=>change(()=>{if(dataMode==='Retrieved'){const date=realOriginal?pacificDate(realOriginal.timestamp):dates[0];const next=spotRecords.find(r=>pacificDate(r.timestamp)===date&&pacificHour(r.timestamp)===h);if(next)setInstant(next.timestamp)}else setHour(h)}),selectInstant:(t:string)=>change(()=>setInstant(t)),setSimulation:(v:boolean)=>{setSimulation(v);setPatch({})},setPatch,resetSimulation:()=>setPatch({})};
}
export type ForecastState=ReturnType<typeof useForecast>;
