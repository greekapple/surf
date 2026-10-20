import type {UserProfile} from '../models';
import type {TidePrediction} from '../ocean/types';
import {localTime} from '../ocean/time';
import {SourceMeasurement} from './SourceMeasurement';
export function StationExtrema({predictions,selected,p}:{predictions:TidePrediction[]|undefined;selected:string|null;p:UserProfile}){
 const next=selected?predictions?.filter(x=>Date.parse(x.timestamp)>=Date.parse(selected)).slice(0,4)??[]:[];
 return <section className="station-extrema"><h3>Next high / low predictions</h3><p className="small">NOAA 9414290 · San Francisco · MLLW. Actual provider event times, separate from hourly forecast selection. Regional station, not local beach tide compatibility.</p>{!next.length?<p className="small">High / low predictions unavailable for this time. No extrema are invented from hourly samples.</p>:<div className="extrema-grid">{next.map(x=><div key={x.timestamp}><strong>{x.type} · {localTime(x.timestamp)}</strong><SourceMeasurement label={`${x.type} tide prediction`} m={x.height} p={p}/></div>)}</div>}</section>;
}
