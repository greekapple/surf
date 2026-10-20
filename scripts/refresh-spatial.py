#!/usr/bin/env python3
"""Download bounded real ERDDAP grids for a dated static fallback. No credentials/dependencies.
Usage: python3 scripts/refresh-spatial.py [--hours 72] [--fields Thgt,Tdir,...]
Only complete successful fields replace prior files. No interpolation or fabricated cells.
"""
import argparse, concurrent.futures, datetime as dt, json, pathlib, urllib.request, urllib.parse
parser=argparse.ArgumentParser();parser.add_argument('--hours',type=int,default=72);parser.add_argument('--fields',default='Thgt,Tper,Tdir,shgt,sper,sdir,ugrd10m,vgrd10m');args=parser.parse_args()
if not 3<=args.hours<=120:parser.error('hours must be 3–120')
root=pathlib.Path(__file__).resolve().parents[1];out=root/'public'/'spatial';out.mkdir(exist_ok=True)
start=dt.datetime.now(dt.timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0);end=start+dt.timedelta(hours=args.hours)
iso=lambda t:t.isoformat().replace('+00:00','Z')
allowed={'Thgt','Tper','Tdir','shgt','sper','sdir','ugrd10m','vgrd10m'}
fields=args.fields.split(',')
if not set(fields)<=allowed:parser.error('unsupported fields')
def download(field):
 wind=field in {'ugrd10m','vgrd10m'};dataset='NCEP_Global_Best' if wind else 'NWW3_Global_Best'
 # These datasets already use their native hourly / 3-hourly time axes. A stride of 1 retains actual records.
 query=f'{field}[({iso(start)}):1:({iso(end)})]'+('' if wind else '[(0)]')+'[(36):1:(40)][(234):1:(238)]'
 url='https://upwell.pfeg.noaa.gov/erddap/griddap/'+dataset+'.json?'+query.replace('[','%5B').replace(']','%5D')
 try:
  with urllib.request.urlopen(url,timeout=45) as r:data=json.load(r)
  table=data['table'];names=table['columnNames'];rows=table['rows'];ti=names.index('time');vi=names.index(field)
  if not rows or len(rows)>12000 or not any(isinstance(row[vi],(float,int)) for row in rows):raise ValueError('No usable bounded grid rows')
  times=sorted(set(row[ti] for row in rows));retrieved=iso(dt.datetime.now(dt.timezone.utc));filename=dataset+'-'+field+'.json'
  payload={'table':table,'snapshot':{'retrievedAt':retrieved,'url':url,'dataset':dataset,'field':field,'delivery':'saved'}}
  temp=out/(filename+'.tmp');temp.write_text(json.dumps(payload,separators=(',',':')));temp.replace(out/filename)
  print(field,len(rows),'rows',len(times),'actual timestamps',flush=True)
  return filename,{'retrievedAt':retrieved,'url':url,'times':times,'unit':table['columnUnits'][vi]}
 except Exception as e:print(field,'UNAVAILABLE:',e,flush=True);return None
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(download,fields))
manifest_path=out/'manifest.json'
manifest=json.loads(manifest_path.read_text()) if manifest_path.exists() else {'files':{}}
for result in results:
 if result:manifest['files'][result[0]]=result[1]
manifest.update({'generatedAt':iso(dt.datetime.now(dt.timezone.utc)),'coverage':'36–40°N, 126–122°W','resolutionDegrees':.5,'note':'Genuine saved model snapshots, not a live browser connection. Retain per-file retrieval and valid times. Model issue time unavailable.'})
manifest_path.write_text(json.dumps(manifest,indent=2)+'\n')
if not any(results):raise SystemExit('No grid connections succeeded; previous snapshots retained.')
