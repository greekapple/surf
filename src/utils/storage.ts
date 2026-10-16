import {defaultProfile,demoBoards} from '../data/demo.ts';
import type {UserProfile,Surfboard,SurfSession} from '../models/index.ts';
export interface AppState {version:1;profile:UserProfile;boards:Surfboard[];favorites:string[];sessions:SurfSession[]}
export const freshState=():AppState=>({version:1,profile:{...defaultProfile,preferredBoards:[]},boards:structuredClone(demoBoards),favorites:[],sessions:[]});
export const storageKey='surf-prototype-v1';
export function loadState(storage:Pick<Storage,'getItem'>):{state:AppState;error:string}{try{const raw=storage.getItem(storageKey);if(!raw)return {state:freshState(),error:''};const s=JSON.parse(raw);if(s.version!==1||!Array.isArray(s.boards)||!s.profile||!Array.isArray(s.favorites)||!Array.isArray(s.sessions))throw new Error();return {state:{...s,profile:{...defaultProfile,...s.profile}},error:''}}catch{return {state:freshState(),error:'Saved data could not be loaded. It has not been overwritten. Export recovery data or explicitly reset to continue saving.'}}}
export function saveState(storage:Pick<Storage,'setItem'>,state:AppState){try{storage.setItem(storageKey,JSON.stringify(state));return ''}catch{return 'Changes could not be saved in this browser. Keep this tab open and export a backup.'}}
