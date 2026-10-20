import {useEffect,useState} from 'react';
// Display freshness ages; does not poll providers or run while the app is closed.
export function useNow(){const [now,setNow]=useState(Date.now);useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(timer)},[]);return now}
