import {validBoardPhoto} from './boardPhoto.ts';
import {defaultProfile,demoBoards} from '../data/demo.ts';
import {allSpots as spots} from '../data/catalog.ts';
import {boardTypes,type UserProfile,type Surfboard,type SurfSession} from '../models/index.ts';
import {validDimensions} from './units.ts';
export interface AppState {version:1;profile:UserProfile;boards:Surfboard[];favorites:string[];sessions:SurfSession[]}
export const freshState=():AppState=>({version:1,profile:{...defaultProfile,preferredBoards:[]},boards:structuredClone(demoBoards),favorites:[],sessions:[]});
export const storageKey='surf-prototype-v1';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=2000)=>typeof v==='string'&&v.length<=max;
const number=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateState(raw:unknown):AppState{
 const fail=(message:string):never=>{throw new Error(message)};
 if(!object(raw)||raw.version!==1||!object(raw.profile)||!Array.isArray(raw.boards)||!Array.isArray(raw.favorites)||!Array.isArray(raw.sessions))return fail('Expected a version 1 Surf backup with profile, boards, favorites and sessions.');
 if(raw.boards.length>500||raw.favorites.length>100||raw.sessions.length>10000)return fail('Backup exceeds supported limits.');
 const p={...defaultProfile,...raw.profile} as UserProfile;
 for(const [key,values] of Object.entries({skill:['Beginner','Intermediate','Expert'],region:['All regions',...new Set(spots.map(s=>s.region))],scale:['Face height','Hawaiian'],heightUnit:['ft','m'],windUnit:['mph','kn','km/h'],style:['All-around','Performance surfing','Cruising','Longboarding','Small-wave surfing'],breakType:['Any','Beach','Point','Reef'],character:['Any','Soft','Peaky','Steep','Powerful']}))if(!values.includes(String(p[key as keyof UserProfile])))return fail(`Invalid profile field: ${key}.`);
 if(![p.minWave,p.maxWave,p.comfort].every(v=>number(v,0,40))||p.minWave>p.maxWave)return fail('Invalid wave preferences.');
 if(typeof p.onboarded!=='boolean'||typeof p.personalization!=='boolean'||!Array.isArray(p.preferredBoards)||!p.preferredBoards.every(v=>boardTypes.includes(v)))return fail('Invalid personalization settings.');
 if(p.displayName!==undefined&&!text(p.displayName,60))return fail('Invalid display name.');
 const ids=new Set<string>();
 for(const value of raw.boards){if(!object(value))return fail('Invalid board.');const b=value as unknown as Surfboard;
 if(![b.id,b.name].every(v=>text(v,100)&&v.trim().length>0)||![b.manufacturer,b.model].every(v=>text(v,100))||ids.has(b.id)||!boardTypes.includes(b.type)||typeof b.favorite!=='boolean'||!validDimensions(b.length,b.width,b.thickness,b.volume))return fail('Invalid board identity, type, or dimensions.');ids.add(b.id);
 for(const key of ['tail','fins','construction','rocker','rails','character','notes','catalogId','specificationSource'] as const)if(b[key]!==undefined&&!text(b[key]))return fail(`Invalid board ${key}.`);
 for(const v of [b.minWave,b.maxWave])if(v!==undefined&&!number(v,0,40))return fail('Invalid board wave range.');
 if(b.minWave!==undefined&&b.maxWave!==undefined&&b.minWave>b.maxWave)return fail('Board wave range is reversed.');
 if([b.photoDataURL,b.backPhotoDataURL].some(v=>v!==undefined&&!validBoardPhoto(v)))return fail('Invalid board photo; only bounded local JPEG, PNG and WebP images are supported.');
 if(b.demo!==undefined&&typeof b.demo!=='boolean')return fail('Invalid demo marker.');
 }
 if(!raw.favorites.every(v=>typeof v==='string'&&spots.some(s=>s.id===v)))return fail('Unknown favorite spot.');
 for(const s of raw.sessions){if(!object(s)||!['id','spotId','timestamp','boardId','actualConditions','notes'].every(k=>text(s[k]))||!['accuracy','performance','satisfaction'].every(k=>number(s[k],0,10)))return fail('Invalid session log.');}
 return {version:1,profile:p,boards:raw.boards as Surfboard[],favorites:[...new Set(raw.favorites as string[])],sessions:raw.sessions as SurfSession[]};
}
export function parseBackup(value:string){if(value.length>5_000_000)throw new Error('Backup must be smaller than 5 MB.');return validateState(JSON.parse(value))}
export function loadState(storage:Pick<Storage,'getItem'>):{state:AppState;error:string}{try{const raw=storage.getItem(storageKey);return {state:raw?parseBackup(raw):freshState(),error:''}}catch{return {state:freshState(),error:'Saved data could not be loaded. It has not been overwritten. Export recovery data or explicitly import or reset to continue saving.'}}}
export function saveState(storage:Pick<Storage,'setItem'>,state:AppState){try{storage.setItem(storageKey,JSON.stringify(state));return ''}catch{return 'Changes could not be saved in this browser. Keep this tab open and export a backup.'}}
