import {useEffect,useState} from 'react';
import type {Surfboard} from '../models';
import type {PageProps} from '../pages/types';
import {activeBoard,adjacentBoard,type BoardTab} from '../services/quiver';
import {scoreBoard} from '../recommendation/board';
import {personalMatch} from '../recommendation/personal';
export function useQuiver({data,view,focusedBoardId}:PageProps){
 const [selected,setSelected]=useState<string|null>(null),[sort,setSort]=useState('Type'),[tab,setTab]=useState<BoardTab>('Overview'),[side,setSide]=useState<'front'|'back'>('front'),[compare,setCompare]=useState<string[]>([]),[editing,setEditing]=useState<Surfboard|'new'|null>(null),[deleting,setDeleting]=useState<string|null>(null);
 const [gallery,setGallery]=useState(()=>{try{return localStorage.getItem('surf-quiver-view')==='Compact'?'Compact':'Showroom'}catch{return 'Showroom'}});
 useEffect(()=>{if(focusedBoardId){setSelected(focusedBoardId);setSide('front')}},[focusedBoardId]);
 const boards=[...data.state.boards].sort((a,b)=>sort==='Type'?a.type.localeCompare(b.type):sort==='Length'?a.length-b.length:a.volume-b.volume),active=activeBoard(boards,selected);
 const choose=(id:string)=>{setSelected(id);setSide('front');setDeleting(null)},move=(step:number)=>{const id=adjacentBoard(boards,active?.id??null,step);if(id)choose(id)};
 const ready=view.forecast.availability.face&&Number.isFinite(view.forecast.face)&&view.forecast.character!=='Unknown',matches=boards.map(b=>scoreBoard(b,view.forecast,data.state.profile)).sort((a,b)=>b.score-a.score),personal=personalMatch(view.spot,view.forecast,data.state.profile),best=data.state.profile.personalization&&personal.eligible?matches.find(b=>b.eligible&&b.score>=55):null;
 return {boards,active,sort,setSort,tab,setTab,side,setSide,compare,setCompare,editing,setEditing,deleting,setDeleting,gallery,setGallery:(v:string)=>{setGallery(v);try{localStorage.setItem('surf-quiver-view',v)}catch{}},choose,move,index:active?boards.indexOf(active):0,ready,matches,personal,best};
}
export type QuiverModel=ReturnType<typeof useQuiver>;
