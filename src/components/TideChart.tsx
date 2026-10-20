import type {Forecast,UserProfile} from '../models/index';
import {height,timeLabel} from '../utils/units';
import {SeriesChart,type SeriesPoint} from './SeriesChart';
type Props={p:UserProfile}&({records:Forecast[];selected:number;onSelect:(h:number)=>void;samples?:never}|{samples:SeriesPoint[];selected:string;onSelect:(id:string)=>void;records?:never});
export function TideChart(props:Props){
 const {p}=props;
 if(props.samples)return <SeriesChart points={props.samples} selected={props.selected} onSelect={props.onSelect} label="Regional tide height" unit={p.heightUnit}/>;
 return <><SeriesChart points={props.records.map(f=>({id:String(f.hour),label:timeLabel(f.hour),value:f.availability.tide?(p.heightUnit==='m'?f.tide.height*.3048:f.tide.height):null,text:f.availability.tide?height(f.tide.height,p,false):'Unavailable'}))} selected={String(props.selected)} onSelect={id=>props.onSelect(+id)} label="Sample tide height" unit={p.heightUnit}/><p className="small">High/low event times are unavailable; sampled stages do not establish actual extrema.</p></>;
}
