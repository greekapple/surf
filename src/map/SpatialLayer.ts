import L from 'leaflet';
import type {SpatialFrame} from './spatial';
import type {MapPreferences} from './preferences';
import {forecastColor} from './colors';
/** Native-cell raster and independent vector canvases. No invented sub-grid values. */
export function attachSpatial(map:L.Map,frame:SpatialFrame,prefs:MapPreferences,reducedMotion:boolean){
 const canvases:HTMLCanvasElement[]=[];let raf=0,last=0;
 const make=(name:string)=>{const c=document.createElement('canvas');c.className=`spatial-${name}`;c.dataset.layer=name;c.setAttribute('aria-hidden','true');Object.assign(c.style,{position:'absolute',top:'0',left:'0',pointerEvents:'none',zIndex:name==='heatmap'?'250':'350'});map.getPane('overlayPane')!.append(c);canvases.push(c);return c};
 const heat=prefs.heatmap?make('heatmap'):null,arrows=prefs.arrows?make('arrows'):null,flow=prefs.flow&&!reducedMotion&&frame.cells.some(c=>c.speed!==null)?make('flow'):null;
 if(heat)heat.style.opacity=String(prefs.opacity);
 const setup=(c:HTMLCanvasElement)=>{const s=map.getSize(),dpr=Math.min(2,window.devicePixelRatio||1);c.width=s.x*dpr;c.height=s.y*dpr;c.style.width=s.x+'px';c.style.height=s.y+'px';const ctx=c.getContext('2d');ctx?.scale(dpr,dpr);return ctx};
 const line=(ctx:CanvasRenderingContext2D,x:number,y:number,from:number,length:number)=>{const theta=(from+180)*Math.PI/180,dx=Math.sin(theta),dy=-Math.cos(theta);ctx.moveTo(x-dx*length/2,y-dy*length/2);ctx.lineTo(x+dx*length/2,y+dy*length/2);return {dx,dy}};
 const draw=()=>{for(const c of canvases)L.DomUtil.setPosition(c,map.containerPointToLayerPoint([0,0]));if(heat){const ctx=setup(heat);if(ctx)for(const c of frame.cells){if(c.value===null)continue;const nw=map.latLngToContainerPoint([c.lat+frame.resolution/2,c.lon-frame.resolution/2]),se=map.latLngToContainerPoint([c.lat-frame.resolution/2,c.lon+frame.resolution/2]);ctx.fillStyle=forecastColor(c.value,frame.unit);ctx.fillRect(nw.x,nw.y,se.x-nw.x+.5,se.y-nw.y+.5);}}
 if(arrows){const ctx=setup(arrows);if(ctx){ctx.strokeStyle='#142e3b';ctx.lineWidth=1.8;ctx.shadowColor='white';ctx.shadowBlur=3;ctx.beginPath();for(const c of frame.cells){if(c.direction===null)continue;const p=map.latLngToContainerPoint([c.lat,c.lon]);const {dx,dy}=line(ctx,p.x,p.y,c.direction,22);const x=p.x+dx*11,y=p.y+dy*11;ctx.moveTo(x-dx*5-dy*4,y-dy*5+dx*4);ctx.lineTo(x,y);ctx.lineTo(x-dx*5+dy*4,y-dy*5-dx*4);}ctx.stroke();}}
 if(flow)setup(flow);};
 const tick=(time:number)=>{raf=requestAnimationFrame(tick);if(document.hidden||time-last<40)return;last=time;if(!flow)return;const ctx=flow.getContext('2d');if(!ctx)return;const size=map.getSize();ctx.clearRect(0,0,size.x,size.y);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<frame.cells.length;i++){const c=frame.cells[i];if(c.direction===null||c.speed===null||c.speed<=0)continue;const p=map.latLngToContainerPoint([c.lat,c.lon]),theta=(c.direction+180)*Math.PI/180,phase=((time/1000*Math.min(1.5,.2+c.speed/15)+i*.618)%1-.5)*38;line(ctx,p.x+Math.sin(theta)*phase,p.y-Math.cos(theta)*phase,c.direction,6);}ctx.stroke();};
 map.on('move zoom resize',draw);draw();if(flow)raf=requestAnimationFrame(tick);
 return()=>{cancelAnimationFrame(raf);map.off('move zoom resize',draw);for(const c of canvases)c.remove()};
}
