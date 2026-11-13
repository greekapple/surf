import {validBoardPhoto} from './boardPhoto.ts';
import {defaultProfile,demoBoards} from '../data/demo.ts';
import {allSpots as spots} from '../data/catalog.ts';
import {boardTypes,type UserProfile,type Surfboard,type SurfSession} from '../models/index.ts';
import {validDimensions} from './units.ts';
import {migrateDemoBoards} from '../data/referenceBoards.ts';
import {canonicalSpotId,canonicalIds} from '../data/spotAliases.ts';
import {validHeightIn} from '../services/heightMath.ts';
export interface AppState {version:1;profile:UserProfile;boards:Surfboard[];favorites:string[];sessions:SurfSession[]}
export const freshState=():AppState=>({version:1,profile:{...defaultProfile,preferredBoards:[]},boards:structuredClone(demoBoards),favorites:[],sessions:[]});
import {isLevel, validKg} from '../services/skillLevels.ts';
export const storageKey='surf-prototype-v1';
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const text=(v:unknown,max=2000)=>typeof v==='string'&&v.length<=max;
const number=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validateState(raw:unknown):AppState{
 const fail=(message:string):never=>{throw new Error(message)};
 if(!object(raw)||raw.version!==1||!object(raw.profile)||!Array.isArray(raw.boards)||!Array.isArray(raw.favorites)||!Array.isArray(raw.sessions))return fail('Expected a version 1 Surf backup with profile, boards, favorites and sessions.');
 if(raw.boards.length>500||raw.favorites.length>100||raw.sessions.length>10000)return fail('Backup exceeds supported limits.');
 const p={...defaultProfile,...raw.profile} as UserProfile;
 if(raw.profile.setupState===undefined||(raw.profile.setupState==='new'&&raw.profile.onboarded===true))p.setupState=raw.profile.onboarded===true?'done':'new';   // first-run migration: finished before this field existed = done (also a hand-set onboarded: true, as the QA scripts do); otherwise setup is still to be shown
 if(!['new','skipped','done'].includes(p.setupState))return fail('Invalid setup state.');
 if(p.setupReminderDismissed!==undefined&&typeof p.setupReminderDismissed!=='boolean')return fail('Invalid setup reminder setting.');
 if(typeof p.onboarded==='boolean')p.onboarded=p.setupState!=='new';   // `onboarded` follows setupState for anything else that reads it
 for(const [key,values] of Object.entries({skill:['Beginner','Intermediate','Expert'],region:['All regions',...new Set(spots.map(s=>s.region))],scale:['Face height','Hawaiian'],heightUnit:['ft','m'],windUnit:['mph','kn','km/h'],style:['All-around','Performance surfing','Cruising','Longboarding','Small-wave surfing'],breakType:['Any','Beach','Point','Reef'],character:['Any','Soft','Peaky','Steep','Powerful']}))if(!values.includes(String(p[key as keyof UserProfile])))return fail(`Invalid profile field: ${key}.`);
 if(![p.minWave,p.maxWave,p.comfort].every(v=>number(v,0,40))||p.minWave>p.maxWave)return fail('Invalid wave preferences.');
 if(typeof p.onboarded!=='boolean'||typeof p.personalization!=='boolean'||!Array.isArray(p.preferredBoards)||!p.preferredBoards.every(v=>boardTypes.includes(v)))return fail('Invalid personalization settings.');
 if(p.displayName!==undefined&&!text(p.displayName,60))return fail('Invalid display name.');
 if(p.skillLevel!==undefined&&!isLevel(p.skillLevel))return fail('Invalid skill level.');
 if(p.weightKg!==undefined&&p.weightKg!==null&&!validKg(p.weightKg))return fail('Invalid weight.');
 if(p.ageBand!==undefined&&p.ageBand!==null&&p.ageBand!=='13-17'&&p.ageBand!=='18+')return fail('Invalid age answer.');
 if(p.personalData!==undefined&&typeof p.personalData!=='boolean')return fail('Invalid personal-data setting.');
 if(p.sex!==undefined&&p.sex!==null&&!['female','male','prefer-not'].includes(p.sex))return fail('Invalid sex answer.');
 const ids=new Set<string>();
 for(const value of raw.boards){if(!object(value))return fail('Invalid board.');const b=value as unknown as Surfboard;
 if(![b.id,b.name].every(v=>text(v,100)&&v.trim().length>0)||![b.manufacturer,b.model].every(v=>text(v,100))||ids.has(b.id)||!boardTypes.includes(b.type)||typeof b.favorite!=='boolean'||!validDimensions(b.length,b.width,b.thickness,b.volume))return fail('Invalid board identity, type, or dimensions.');ids.add(b.id);
 for(const key of ['tail','fins','construction','rocker','rails','character','notes','catalogId','specificationSource'] as const)if(b[key]!==undefined&&!text(b[key]))return fail(`Invalid board ${key}.`);
 for(const v of [b.minWave,b.maxWave])if(v!==undefined&&!number(v,0,40))return fail('Invalid board wave range.');
 if(b.minWave!==undefined&&b.maxWave!==undefined&&b.minWave>b.maxWave)return fail('Board wave range is reversed.');
 if([b.photoDataURL,b.backPhotoDataURL].some(v=>v!==undefined&&!validBoardPhoto(v)))return fail('Invalid board photo; only bounded local JPEG, PNG and WebP images are supported.');
 if(b.demo!==undefined&&typeof b.demo!=='boolean')return fail('Invalid demo marker.');
 }
 if(!raw.favorites.every(v=>typeof v==='string'&&spots.some(s=>s.id===canonicalSpotId(v))))return fail('Unknown favorite spot.');   // a spot merged into another (spotAliases.ts) is still a valid saved favourite
 for(const s of raw.sessions){if(!object(s)||!['id','spotId','timestamp','boardId','actualConditions','notes'].every(k=>text(s[k]))||!['accuracy','performance','satisfaction'].every(k=>number(s[k],0,10)))return fail('Invalid session log.');}
 return {version:1,profile:p,boards:migrateDemoBoards(raw.boards as Surfboard[]),favorites:canonicalIds(raw.favorites as string[]),sessions:(raw.sessions as SurfSession[]).map(x=>({...x,spotId:canonicalSpotId(x.spotId)}))};
}
export function parseBackup(value:string){if(value.length>5_000_000)throw new Error('Backup must be smaller than 5 MB.');return validateState(JSON.parse(value))}
export function loadState(storage:Pick<Storage,'getItem'>):{state:AppState;error:string}{try{const raw=storage.getItem(storageKey);return {state:raw?parseBackup(raw):freshState(),error:''}}catch{return {state:freshState(),error:'Saved data could not be loaded. It has not been overwritten. Export recovery data or explicitly import or reset to continue saving.'}}}
export function saveState(storage:Pick<Storage,'setItem'>,state:AppState){try{storage.setItem(storageKey,JSON.stringify(state));return ''}catch{return 'Changes could not be saved in this browser. Keep this tab open and export a backup.'}}
/** Restore from backup (user decision 2026-11-11): a strict read of an exported backup file. Stricter than loading this browser's own storage:
 *  the file must be exactly the export's shape (the five top-level keys, known profile keys only, version 1), so a foreign or hand-edited JSON
 *  file is rejected rather than half-read. Throws a message for the person; nothing is changed until the caller replaces the state. */
const BACKUP_KEYS=['version','profile','boards','favorites','sessions'];
const PROFILE_KEYS=new Set([...Object.keys(defaultProfile),'displayName','personalization','setupReminderDismissed','heightIn','skillLevel','weightKg','ageBand','personalData','sex']);
export interface RestorePreview {boards:number;exampleBoards:number;sessions:number;favorites:number;settings:number}
export function parseRestore(text:string):{state:AppState;preview:RestorePreview}{
 if(text.length>5_000_000)throw new Error('This file is larger than 5 MB, so it is not a SWELLO backup.');
 let raw:unknown;try{raw=JSON.parse(text)}catch{throw new Error('This file is not valid JSON, so it is not a SWELLO backup.')}
 if(!object(raw)||!BACKUP_KEYS.every(k=>k in raw)||Object.keys(raw).some(k=>!BACKUP_KEYS.includes(k)))throw new Error('This file is not a SWELLO backup: an exported backup has exactly version, profile, boards, favorites and sessions.');
 if(raw.version!==1)throw new Error(`This backup is version ${JSON.stringify(raw.version)}; this app restores version 1 backups only.`);
 if(!object(raw.profile))throw new Error('This file is not a SWELLO backup: the profile is missing.');
 const extra=Object.keys(raw.profile).filter(k=>!PROFILE_KEYS.has(k));
 if(extra.length)throw new Error(`This file is not a SWELLO backup: unknown profile field "${extra[0]}".`);
 if(raw.profile.heightIn!==undefined&&raw.profile.heightIn!==null&&!validHeightIn(raw.profile.heightIn))throw new Error('This backup has an invalid profile height.');
 const state=validateState(raw);
 return {state,preview:{boards:state.boards.length,exampleBoards:state.boards.filter(b=>b.demo).length,sessions:state.sessions.length,favorites:state.favorites.length,settings:Object.keys(state.profile).length}};
}
