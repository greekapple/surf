import type {Forecast,UserProfile} from '../models/index';
import {height,timeLabel} from '../utils/units';
export function TideChart({records,selected,onSelect,p}:{records:Forecast[];selected:number;onSelect:(h:number)=>void;p:UserProfile}){
 const points=records.filter(f=>f.availability.tide);if(!points.length)return <p>Tide data unavailable.</p>;
 const min=Math.min(...points.map(f=>f.tide.height))-1,max=Math.max(...points.map(f=>f.tide.height))+1;
 const x=(h:number)=>30+(h-6)/12*540,y=(v:number)=>120-(v-min)/(max-min)*90;
 return <div className="tide-chart"><svg viewBox="0 0 600 155" role="group" aria-label="Sample tide heights; select a timestamp"><line x1="30" y1="120" x2="570" y2="120" stroke="#cbd2c5"/><polyline points={points.map(f=>`${x(f.hour)},${y(f.tide.height)}`).join(' ')} fill="none" stroke="#3e7365" strokeWidth="2"/>{points.map(f=><g key={f.hour} role="button" tabIndex={0} aria-label={`Tide at ${timeLabel(f.hour)}: ${height(f.tide.height,p,false)}`} onClick={()=>onSelect(f.hour)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect(f.hour)}}}><circle cx={x(f.hour)} cy={y(f.tide.height)} r={selected===f.hour?7:5} fill={selected===f.hour?'#b07d2e':'#3e7365'}/><circle cx={x(f.hour)} cy={y(f.tide.height)} r="16" fill="transparent"/><text x={x(f.hour)} y="146" textAnchor="middle" fontSize="12">{timeLabel(f.hour)}</text></g>)}</svg><p className="small">Connecting lines guide the eye between sample records. High/low tide event times are unavailable; sampled stages do not establish actual extrema.</p></div>
}
