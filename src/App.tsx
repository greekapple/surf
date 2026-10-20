import {useState} from 'react';
import {useAppData} from './hooks/useAppData';
import {useForecast} from './hooks/useForecast';
import {ForecastPage} from './pages/ForecastPage';
import {RegionalPage} from './pages/RegionalPage';
import {QuiverPage} from './pages/QuiverPage';
import {ProfilePage} from './pages/ProfilePage';
import {Segments} from './components/Controls';
import {spots} from './data/demo';
import type {UserProfile} from './models/index';
const pages=['Today','Explore','Forecast','Quiver','Profile'];
export default function App(){
 const data=useAppData(),view=useForecast(),[page,setPage]=useState('Forecast');
 const onOpen=(id:string,day?:number,hour?:number)=>{view.selectSpot(id);if(day!==undefined)view.selectDay(day);if(hour!==undefined)view.selectHour(hour);setPage('Forecast');window.scrollTo({top:0,behavior:'instant'})};
 const props={data,view,onOpen};
 return <div className="app"><aside><a className="brand" href="#" onClick={e=>{e.preventDefault();setPage('Today')}}>surf<span> / forecast lab</span></a><p className="aside-copy">Read the conditions.</p><nav aria-label="Main navigation">{pages.map((name,i)=><button key={name} aria-current={page===name?'page':undefined} className={page===name?'active':''} onClick={()=>{setPage(name);window.scrollTo({top:0,behavior:'instant'})}}><span className="nav-index">0{i+1}</span>{name}</button>)}</nav><div className="aside-bottom">NORTHERN & CENTRAL CALIFORNIA<br/>Forecast platform · v0.3</div></aside><main><div className="demo-banner"><span className="dot"/>Demo Data — Not Live Forecast<span className="banner-detail">All break profiles and conditions are illustrative.</span></div>{data.error&&<div className="warning" role="alert">{data.error} <button onClick={data.exportData}>Export recovery data</button></div>}<div className="global-controls"><Segments label="Wave display" options={['Face height','Hawaiian']} value={data.state.profile.scale} onChange={scale=>data.profile({scale:scale as UserProfile['scale']})}/><Segments label="Units" options={['ft','m']} value={data.state.profile.heightUnit} onChange={heightUnit=>data.profile({heightUnit:heightUnit as UserProfile['heightUnit']})}/>{data.state.profile.scale==='Hawaiian'&&<p className="small">≈ Hawaiian: 0.5 × face height; display only.</p>}</div>{page==='Forecast'&&<><div className="spot-switcher" role="group" aria-label="Select surf spot">{spots.map(s=><button key={s.id} aria-pressed={s.id===view.selected} className={s.id===view.selected?'selected':''} onClick={()=>view.selectSpot(s.id)}>{s.name}{data.state.favorites.includes(s.id)?' ★':''}</button>)}</div><ForecastPage {...props}/></>}{page==='Today'&&<RegionalPage {...props}/ >}{page==='Explore'&&<RegionalPage key="explore" {...props} explore/>}{page==='Quiver'&&<QuiverPage {...props}/ >}{page==='Profile'&&<ProfilePage {...props}/ >}<footer>Demo Data — Not Live Forecast · Fixed sample week: October 16–22, 2026 · Pacific time<br/>SQI is a prototype quality heuristic, not an accuracy or safety claim.</footer></main></div>
}
