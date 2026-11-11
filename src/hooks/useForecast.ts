import {computeScope} from '../ocean/spotScope';
import {spotIdForSlug} from '../app/routes';
/** B7: a deep link (?spot=<slug>) opens on THAT spot's own data: the first load is scoped to it, not to the default Ocean Beach and its NorCal neighbours. */
const initialSpot=():string=>{try{const id=spotIdForSlug(new URLSearchParams(location.search).get('spot'));return id&&evidenceSpots.some(s=>s.id===id)?id:'spot-2'}catch{return 'spot-2'}};
import {useEffect,useMemo,useRef,useState,type SetStateAction} from 'react';
import type {MapCamera,MapLayer,MapVariable} from '../map/types';
import {mapVariables} from '../map/model';
import {loadMapPreferences,saveMapPreferences,type MapPreferences} from '../map/preferences';
import {selectedRecord,recordOnDay} from '../utils/interaction';
import {forecasts} from '../data/demo';
import {allSpots as spots} from '../data/catalog';
import {placeholderRecord,recordOrPlaceholder} from '../services/forecast';
import {simulateForecast,type SimulationPatch} from '../services/simulation';
import {useOceanData} from './useOceanData';
import {evidenceSpots} from '../ocean/spots';
import {dateIn,hourIn} from '../ocean/time';
import {timeZoneOf,setActiveZone} from '../ocean/spotZone';
import {toLegacy} from '../ocean/bridge';
import {experimentRecord} from '../ocean/experiment';
export interface ScopeInput{favorites:string[];visible:string[];requested:string[]}
const NO_SCOPE:ScopeInput={favorites:[],visible:[],requested:[]};
export function useForecast(scopeInput:ScopeInput=NO_SCOPE){
 const [dataMode,setMode]=useState<'Retrieved'|'Demonstration'>('Retrieved');
 const [selected,setSelected]=useState(initialSpot),[day,setDay]=useState(0),[hour,setHour]=useState(9),[simulation,setSimulation]=useState(false),[patch,setPatch]=useState<SimulationPatch>({}),[instant,setInstant]=useState<string|null>(null);
 const [comparisonSets,setComparisonSets]=useState<Record<string,string[]>>({Retrieved:[],Demonstration:[]});
 const [mapPreferences,setMapPreferences]=useState<MapPreferences>(()=>loadMapPreferences(localStorage));
 const [mapPreferenceError,setMapPreferenceError]=useState('');
 useEffect(()=>{if(!saveMapPreferences(localStorage,mapPreferences))setMapPreferenceError('Map display preferences could not be saved on this device.');else setMapPreferenceError('')},[mapPreferences]);
 const mapLayer=mapPreferences.layer,mapVariable=mapPreferences.variable,mapComponent=mapPreferences.component;
 const setMapDisplay=(patch:Partial<MapPreferences>)=>setMapPreferences(old=>({...old,...patch}));
 const mapCamera=useRef<MapCamera>({lat:37.7,lng:-124,zoom:7});
 const scope=useMemo(()=>computeScope(selected,scopeInput.favorites,scopeInput.visible,scopeInput.requested),[selected,scopeInput.favorites.join(','),scopeInput.visible.join(','),scopeInput.requested.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
 const ocean=useOceanData(dataMode==='Retrieved',scope);
 const records=ocean.bundle?.records??[];const spotRecords=records.filter(r=>r.spotId===selected);
 const realOriginal=selectedRecord(records,selected,instant);
 const realRecord=realOriginal&&simulation?experimentRecord(realOriginal,patch):realOriginal;
 const demoOriginal=recordOrPlaceholder(forecasts,selected,day,hour); // B4: never undefined (a catalogue spot has no demonstration record)
 // The legacy projection carries explicit missing flags. It never converts offshore height to surf height.
 const original=dataMode==='Retrieved'&&realOriginal?toLegacy(realOriginal):dataMode==='Retrieved'?placeholderRecord(selected,day,hour):demoOriginal; // review MEDIUM: an explicit placeholder, never a demonstration record's time
 const change=(fn:()=>void)=>{fn();setSimulation(false);setPatch({})};
 const zone=setActiveZone(timeZoneOf(selected)),dates=[...new Set(spotRecords.map(r=>dateIn(zone,r.timestamp)))]; // the screens of this spot format their clocks in its zone (ocean/spotZone.ts)
 const mapRecords=useMemo(()=>dataMode==='Retrieved'?records.map(toLegacy):forecasts,[dataMode,records]);
 const timeline=useMemo(()=>[...new Set(mapRecords.map(f=>f.timestamp))].sort((a,b)=>Date.parse(a)-Date.parse(b)),[mapRecords]);
 const selectedTime=dataMode==='Retrieved'?(instant??realOriginal?.timestamp??timeline.find(t=>Date.parse(t)>=Math.floor(Date.now()/3600000)*3600000)??timeline[0]??null):demoOriginal.timestamp;
 return {mapPreferences,mapPreferenceError,setMapDisplay,mapLayer,mapVariable,mapComponent,setMapComponent:(component:'Primary'|'Secondary')=>setMapDisplay({component}),setMapVariable:(variable:MapVariable)=>setMapDisplay({variable}),setMapLayer:(layer:MapLayer)=>setMapDisplay({layer,variable:mapVariables[layer][0]}),mapCamera,mapRecords,timeline,selectedTime,compared:comparisonSets[dataMode],setCompared:(next:SetStateAction<string[]>)=>setComparisonSets(s=>({...s,[dataMode]:typeof next==='function'?next(s[dataMode]):next})),selectTime:(t:string)=>change(()=>{if(dataMode==='Retrieved')setInstant(t);else{const f=forecasts.find(f=>f.timestamp===t);if(f){setDay(f.day);setHour(f.hour)}}}),dataMode,setDataMode:(v:'Retrieved'|'Demonstration')=>change(()=>{setMode(v);if(v==='Retrieved'&&!evidenceSpots.some(s=>s.id===selected))setSelected('spot-2')}),ocean,records,realOriginal,realRecord,dates,
 selected,day:dataMode==='Retrieved'&&realOriginal?dates.indexOf(dateIn(zone,realOriginal.timestamp)):day,hour:dataMode==='Retrieved'&&realOriginal?hourIn(zone,realOriginal.timestamp):hour,spot:spots.find(s=>s.id===selected)!,original,forecast:dataMode==='Retrieved'&&realRecord?toLegacy(realRecord):simulation?simulateForecast(original,patch):original,simulation,patch,
 selectSpot:(id:string)=>change(()=>{setInstant(realOriginal?.timestamp??instant);setSelected(id)}),selectDay:(d:number)=>change(()=>{if(dataMode==='Retrieved'){const date=dates[d];const next=recordOnDay(spotRecords,date,realOriginal?hourIn(zone,realOriginal.timestamp):9);setInstant(next?.timestamp??null)}else setDay(d)}),selectHour:(h:number)=>change(()=>{if(dataMode==='Retrieved'){const date=realOriginal?dateIn(zone,realOriginal.timestamp):dates[0];const next=spotRecords.find(r=>dateIn(zone,r.timestamp)===date&&hourIn(zone,r.timestamp)===h);if(next)setInstant(next.timestamp)}else setHour(h)}),selectInstant:(t:string)=>change(()=>setInstant(t)),setSimulation:(v:boolean)=>{setSimulation(v);setPatch({})},setPatch,resetSimulation:()=>setPatch({})};
}
export type ForecastState=ReturnType<typeof useForecast>;
