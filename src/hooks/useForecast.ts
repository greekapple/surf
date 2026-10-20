import {useState} from 'react';
import {forecasts,spots} from '../data/demo';
import {selectRecord} from '../services/forecast';
import {simulateForecast,type SimulationPatch} from '../services/simulation';
export function useForecast(){
 const [selected,setSelected]=useState(spots[0].id),[day,setDay]=useState(0),[hour,setHour]=useState(9),[simulation,setSimulation]=useState(false),[patch,setPatch]=useState<SimulationPatch>({});
 const original=selectRecord(forecasts,selected,day,hour)!;
 const change=(fn:()=>void)=>{fn();setSimulation(false);setPatch({})};
 return {selected,day,hour,spot:spots.find(s=>s.id===selected)!,original,forecast:simulation?simulateForecast(original,patch):original,simulation,patch,
 selectSpot:(id:string)=>change(()=>setSelected(id)),selectDay:(d:number)=>change(()=>setDay(d)),selectHour:(h:number)=>change(()=>setHour(h)),setSimulation:(v:boolean)=>{setSimulation(v);setPatch({})},setPatch,resetSimulation:()=>setPatch({})};
}
export type ForecastState=ReturnType<typeof useForecast>;
