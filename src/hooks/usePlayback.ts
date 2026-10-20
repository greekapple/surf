import {useEffect,useRef,useState} from 'react';
import {nextFrameIndex} from '../map/model';
export function usePlayback(times:string[],selected:string|null,onSelect:(time:string)=>void,active:boolean,spotId:string,waiting=false,intervalMs=1800){
 const [playing,setPlaying]=useState(false),latest=useRef({times,selected,onSelect,waiting});latest.current={times,selected,onSelect,waiting};
 useEffect(()=>{setPlaying(false)},[active,spotId]);
 useEffect(()=>{const pause=()=>{if(document.hidden)setPlaying(false)};document.addEventListener('visibilitychange',pause);return()=>document.removeEventListener('visibilitychange',pause)},[]);
 useEffect(()=>{if(!playing||!active)return;let steps=0;const id=setInterval(()=>{if(latest.current.waiting)return;const {times,selected,onSelect}=latest.current,next=selected?nextFrameIndex(times,selected):null;if(next===null||document.hidden||++steps>168){setPlaying(false);return}onSelect(times[next]);if(next===times.length-1)setPlaying(false)},intervalMs);return()=>clearInterval(id)},[playing,active,intervalMs]);
 return {playing,pause:()=>setPlaying(false),toggle:()=>{if(playing){setPlaying(false);return}if(!active||times.length<2)return;const {selected}=latest.current;if(selected===times.at(-1))onSelect(times[0]);setPlaying(true)}};
}
