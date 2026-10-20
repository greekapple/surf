import {useLayoutEffect,useRef,useState} from 'react';
import {navigationTarget} from '../utils/interaction';
export const pages=['Today','Explore','Forecast','Quiver','Profile'] as const;
export type Page=typeof pages[number];
export function usePageNavigation(){
 const [page,setPage]=useState<Page>('Forecast'),[visited,setVisited]=useState<Page[]>(['Forecast']);
 const positions=useRef<Partial<Record<Page,number>>>({}),pending=useRef<number|null>(null);
 const navigate=(next:Page,top=false)=>{const target=navigationTarget(page,next,positions.current,window.scrollY,top);positions.current=target.positions;pending.current=target.scroll;setVisited(v=>v.includes(next)?v:[...v,next]);if(next===page){window.scrollTo({top:pending.current,behavior:'instant'});pending.current=null;}else setPage(next);};
 useLayoutEffect(()=>{if(pending.current!==null){window.scrollTo({top:pending.current,behavior:'instant'});pending.current=null;}},[page]);
 return {page,visited,navigate};
}
