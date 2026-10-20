import type {Measurement} from './types.ts';
export interface NearshoreRecord {timestamp:string;height:Measurement;period:Measurement;direction:Measurement;qualityFlag:number}
export const nearshoreBase='https://thredds.cdip.ucsd.edu/thredds/ncss/point/cdip/model/MOP_alongshore/SF023_nowcast.nc';
export function nearshoreURL(now=Date.now()){const start=new Date(now-86400000).toISOString(),end=new Date(now+86400000).toISOString();return nearshoreBase+'?'+new URLSearchParams({var:'waveHs,waveTp,waveDp,waveFlagPrimary',time_start:start,time_end:end,accept:'csv'});}
/** NCSS point CSV only; only primary QC=1 (good) is accepted. No time shifting or interpolation. */
export function normalizeNearshore(csv:string,retrievedAt:string,url:string):NearshoreRecord[]{
 const lines=csv.trim().split(/\r?\n/),header=lines.shift()?.split(',')??[];
 const index=(name:string)=>header.findIndex(h=>h===name||h.startsWith(name+'['));
 const ti=index('time'),hs=index('waveHs'),tp=index('waveTp'),dp=index('waveDp'),qc=index('waveFlagPrimary');
 if(!header[hs]?.includes('unit="meter"')||!header[tp]?.includes('unit="second"')||!header[dp]?.includes('unit="degreeT"'))return [];
 if([ti,hs,tp,dp,qc].some(i=>i<0)||!Number.isFinite(Date.parse(retrievedAt)))return [];
 return lines.flatMap(line=>{const cells=line.split(','),rawTime=cells[ti],qualityFlag=Number(cells[qc]);if(!Number.isFinite(Date.parse(rawTime))||qualityFlag!==1)return [];const timestamp=new Date(rawTime).toISOString();
  const measure=(i:number,unit:Measurement['unit'],nativeUnit:string,convert=1):Measurement=>{const n=cells[i]?.trim()?Number(cells[i]):NaN;const valid=Number.isFinite(n)&&n>=0&&n<(unit==='deg'?360:unit==='s'?100:1000);return {value:valid?n*convert:null,unit,source:{provider:'CDIP MOP SF023',kind:'forecast',validAt:timestamp,retrievedAt,issuedAt:null,updatedAt:null,url,nativeUnit,location:'Ocean Beach transect SF023 · 37.74811, −122.51886 · 10 m depth',notes:'Nearshore modeled nowcast, QC primary=1 (good). Not observed surf or breaking-wave height. No local conversion applied.'},...(!valid?{reason:'Missing or invalid CDIP value.'}:{})}};
  return [{timestamp,height:measure(hs,'ft','meter',1/.3048),period:measure(tp,'s','second'),direction:measure(dp,'deg','degreeT'),qualityFlag}];
 }).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
}
