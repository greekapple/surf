import type {NearshoreRecord} from '../ocean/nearshore';
import type {UserProfile} from '../models';
import {SourceMeasurement} from './SourceMeasurement';
import {localTime} from '../ocean/time';
export function NearshoreContext({spotId,selected,records=[],p}:{spotId:string;selected:string;records?:NearshoreRecord[];p:UserProfile}){
 if(spotId!=='spot-2')return null;
 const exact=records.find(r=>r.timestamp===selected),latest=records.at(-1),r=exact??latest;
 return <section className="panel"><details><summary>Nearshore model context · Ocean Beach SF023</summary><p>CDIP MOP point nowcast at a 10 m depth transect. This is modeled significant wave height, separate from the offshore forecast and observed breaking waves.</p>{r?<><p className="small">{exact?'Exact selected-hour nowcast.':'Independent nowcast context; no record at the selected forecast hour. This value is not substituted into that forecast.'} Valid {localTime(r.timestamp)} · primary QC flag {r.qualityFlag} (good).</p><div className="forecast-metrics"><SourceMeasurement label="Nearshore modeled significant height · 10 m depth" m={r.height} p={p}/><SourceMeasurement label="Nearshore peak period" m={r.period} p={p}/><SourceMeasurement label="Nearshore direction from" m={r.direction} p={p}/></div></>:<p className="small">Nowcast unavailable or no records pass the primary quality check. Offshore forecasts remain separate.</p>}<p className="small">One transect does not describe every sandbar. No breaking-wave conversion or calibration claim is made. This context does not change the rating or Personal Match.</p></details></section>;
}
