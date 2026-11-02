import type {Measurement} from './types.ts';
import {mopPoint, mopURL, mopBase, type MopProduct} from './mop.ts';
export interface NearshoreRecord {timestamp:string;height:Measurement;period:Measurement;direction:Measurement;qualityFlag:number;product?:MopProduct;mopId?:string}
export const nearshoreBase=mopBase+'SF023_nowcast.nc';
export function nearshoreURL(now=Date.now()){return mopURL('SF023','nowcast',now);}
/** NCSS point CSV only; only primary QC=1 (good) is accepted. No time shifting or interpolation. `product` says whether the file is the hourly nowcast or the 3-hourly forecast. */
export function normalizeNearshore(csv:string,retrievedAt:string,url:string,product:MopProduct='nowcast'):NearshoreRecord[]{
 const lines=csv.trim().split(/\r?\n/),header=lines.shift()?.split(',')??[];
 const index=(name:string)=>header.findIndex(h=>h===name||h.startsWith(name+'['));
 const ti=index('time'),st=index('station'),hs=index('waveHs'),tp=index('waveTp'),dp=index('waveDp'),qc=index('waveFlagPrimary');
 if(!header[hs]?.includes('unit="meter"')||!header[tp]?.includes('unit="second"')||!header[dp]?.includes('unit="degreeT"'))return [];
 if([ti,hs,tp,dp,qc].some(i=>i<0)||!Number.isFinite(Date.parse(retrievedAt)))return [];
 return lines.flatMap(line=>{const cells=line.split(','),rawTime=cells[ti],qualityFlag=Number(cells[qc]);if(!Number.isFinite(Date.parse(rawTime))||qualityFlag!==1)return [];const timestamp=new Date(rawTime).toISOString();
  const mopId=(st>=0&&cells[st]?.trim())||'SF023',pt=mopPoint(mopId),what=product==='forecast'?'forecast':'nowcast';
  const location=pt?`${mopId} transect · ${pt.lat}, ${pt.lon} · ${pt.depthM} m depth`:`${mopId} transect`;
  const measure=(i:number,unit:Measurement['unit'],nativeUnit:string,convert=1):Measurement=>{const n=cells[i]?.trim()?Number(cells[i]):NaN;const valid=Number.isFinite(n)&&n>=0&&n<(unit==='deg'?360:unit==='s'?100:1000);return {value:valid?n*convert:null,unit,source:{provider:'CDIP MOP '+mopId,kind:'forecast',validAt:timestamp,retrievedAt,issuedAt:null,updatedAt:null,url,nativeUnit,location,notes:`Nearshore modeled ${what}, QC primary=1 (good). Not observed surf or breaking-wave height. No local conversion applied.`},...(!valid?{reason:'Missing or invalid CDIP value.'}:{})}};
  return [{timestamp,height:measure(hs,'ft','meter',1/.3048),period:measure(tp,'s','second'),direction:measure(dp,'deg','degreeT'),qualityFlag,product,mopId}];
 }).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
}
