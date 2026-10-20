import {useState} from 'react';
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
 const ocean=useOceanData(dataMode==='Retrieved');
 const records=ocean.bundle?.records??[];const spotRecords=records.filter(r=>r.spotId===selected);
 const realOriginal=spotRecords.find(r=>r.timestamp===instant)??spotRecords.find(r=>Date.parse(r.timestamp)>=Date.now())??spotRecords[0]??null;
 const realRecord=realOriginal&&simulation?experimentRecord(realOriginal,patch):realOriginal;
 const demoOriginal=selectRecord(forecasts,selected,day,hour)!;
 // The legacy projection carries explicit missing flags. It never converts offshore height to surf height.
 const original=dataMode==='Retrieved'&&realOriginal?toLegacy(realOriginal):dataMode==='Retrieved'?{...demoOriginal,face:NaN,offshore:NaN,character:'Unknown',availability:{face:false,swell:false,wind:false,tide:false,organization:false}}:demoOriginal;
 const change=(fn:()=>void)=>{fn();setSimulation(false);setPatch({})};
 const dates=[...new Set(spotRecords.map(r=>pacificDate(r.timestamp)))];
 return {dataMode,setDataMode:(v:'Retrieved'|'Demonstration')=>change(()=>{setMode(v);setInstant(null);if(v==='Retrieved'&&!evidenceSpots.some(s=>s.id===selected))setSelected('spot-2')}),ocean,records,realOriginal,realRecord,dates,
 selected,day:dataMode==='Retrieved'&&realOriginal?dates.indexOf(pacificDate(realOriginal.timestamp)):day,hour:dataMode==='Retrieved'&&realOriginal?pacificHour(realOriginal.timestamp):hour,spot:spots.find(s=>s.id===selected)!,original,forecast:dataMode==='Retrieved'&&realRecord?toLegacy(realRecord):simulation?simulateForecast(original,patch):original,simulation,patch,
 selectSpot:(id:string)=>change(()=>setSelected(id)),selectDay:(d:number)=>change(()=>{if(dataMode==='Retrieved'){const date=dates[d];const next=spotRecords.find(r=>pacificDate(r.timestamp)===date&&pacificHour(r.timestamp)===(realOriginal?pacificHour(realOriginal.timestamp):9))??spotRecords.find(r=>pacificDate(r.timestamp)===date);setInstant(next?.timestamp??null)}else setDay(d)}),selectHour:(h:number)=>change(()=>{if(dataMode==='Retrieved'){const date=realOriginal?pacificDate(realOriginal.timestamp):dates[0];const next=spotRecords.find(r=>pacificDate(r.timestamp)===date&&pacificHour(r.timestamp)===h);if(next)setInstant(next.timestamp)}else setHour(h)}),selectInstant:(t:string)=>change(()=>setInstant(t)),setSimulation:(v:boolean)=>{setSimulation(v);setPatch({})},setPatch,resetSimulation:()=>setPatch({})};
}
export type ForecastState=ReturnType<typeof useForecast>;
