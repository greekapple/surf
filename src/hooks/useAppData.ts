import {useState,useEffect} from 'react';
import {loadState,saveState,freshState,storageKey,type AppState} from '../utils/storage';
import type {UserProfile,Surfboard} from '../models/index';
export function useAppData(){
 const [initial]=useState(()=>{try{return loadState(localStorage)}catch{return {state:freshState(),error:'Browser storage is unavailable. Export a backup before closing this tab.'}}});
 const [state,setState]=useState(initial.state),[error,setError]=useState(initial.error),[blocked,setBlocked]=useState(!!initial.error);
 useEffect(()=>{if(!blocked){try{setError(saveState(localStorage,state))}catch{setError('Browser storage unavailable. Export your data before closing.')}}},[state,blocked]);
 const profile=(patch:Partial<UserProfile>)=>setState(s=>({...s,profile:{...s.profile,...patch}}));
 const saveBoard=(b:Surfboard)=>setState(s=>({...s,boards:s.boards.some(x=>x.id===b.id)?s.boards.map(x=>x.id===b.id?b:x):[...s.boards,b]}));
 const deleteBoard=(id:string)=>setState(s=>({...s,boards:s.boards.filter(b=>b.id!==id)}));
 const favorite=(id:string)=>setState(s=>({...s,favorites:s.favorites.includes(id)?s.favorites.filter(x=>x!==id):[...s.favorites,id]}));
 const replace=(value:AppState)=>{setBlocked(false);setError('');setState(value)};
 const exportData=()=>{let raw=JSON.stringify(state,null,2);if(blocked){try{raw=localStorage.getItem(storageKey)||raw}catch{}}const url=URL.createObjectURL(new Blob([raw],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='surf-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 return {state,error,profile,saveBoard,deleteBoard,favorite,replace,exportData};
}
export type DataStore=ReturnType<typeof useAppData>;
