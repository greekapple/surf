import {useState} from 'react';
import type {SurfWindow} from '../services/windowModel';
import type {UserProfile} from '../models';
import {spots} from '../data/demo';
import {localTime,ageLabel} from '../ocean/time';
import {height,wind} from '../utils/units';
import {useNow} from '../hooks/useNow';
export function SurfWindowTimeline({window:w,index,p,onOpen}:{window:SurfWindow;index:number;p:UserProfile;onOpen:(id:string,time:string)=>void}){
 const [selected,setSelected]=useState(w.start),now=useNow(),sample=w.samples.find(f=>f.timestamp===selected)??w.samples[0],rating=w.ratings[w.samples.indexOf(sample)];
 const sources=rating.sources,oldest=sources.map(s=>Date.parse(s.retrievedAt)).filter(Number.isFinite).sort((a,b)=>a-b)[0];
 return <article className="forecast-window"><button onClick={()=>onOpen(w.spotId,w.start)}><span className="window-number">0{index+1}</span><div><small>{localTime(w.start)} – {localTime(w.end)}</small><strong>{spots.find(s=>s.id===w.spotId)?.name}</strong><span>{w.samples.length} supplied records · Daylight unchecked · Reliability {w.reliability.toLowerCase()}</span></div><div className="window-rating"><b>{w.minimumScore}–{w.peakScore}</b><small>Offshore potential</small></div><span>↗</span></button>
 <details><summary>Explore this window</summary><div className="window-timeline" role="group" aria-label={`${spots.find(s=>s.id===w.spotId)?.name} window hours`}>{w.samples.map((f,i)=><button key={f.timestamp} aria-pressed={sample.timestamp===f.timestamp} onClick={()=>setSelected(f.timestamp)}><span>{new Date(f.timestamp).toLocaleTimeString('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',minute:'2-digit'})}</span><strong>{w.ratings[i].category}</strong></button>)}</div>
 <div className="window-sample" aria-live="polite"><strong>{localTime(sample.timestamp)} · {rating.category}</strong><p>Wind {sample.availability.wind?wind(sample.wind.speed,p):'unavailable'} · Primary swell {sample.availability.swell?`${height(sample.primary.height,p,false)} / ${sample.primary.period.toFixed(1)} s`:'unavailable'}</p><p>{sample.evidence?'Regional station tide':'Demo tide'} {sample.availability.tide?`${height(sample.tide.height,p,false)} · ${sample.tide.trend??sample.tide.stage}`:'unavailable'} · Local tide suitability unknown.</p><p>{rating.mode==='demonstration'?'Demonstration records — not live.':oldest?`Oldest contributing retrieval: ${ageLabel(new Date(oldest).toISOString(),now)}. Original provider timestamps retained.`:'Retrieval age unknown.'}</p><button onClick={()=>onOpen(w.spotId,sample.timestamp)}>Read this exact forecast →</button></div>
 {[...w.reasons,...w.changes,...w.limitations].map(t=><p className="small" key={t}>{t}</p>)}<p className="small">User experience and boards are considered separately in Personal Match and Quiver; they do not change this general offshore rating. Tap supplied records; no intermediate values are synthesized.</p></details></article>;
}
