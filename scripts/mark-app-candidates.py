#!/usr/bin/env python3
"""Mark the world-spot rows that may become app spots (batch 3: US East, US Gulf, Puerto Rico and the US Virgin Islands), with the SAME rule as the West Coast:
   appCandidate = a facing stated by a guide (facts.facingDeg, not computed from the coastline)
              AND a NOAA CO-OPS tide station (gauge or prediction) within 30 km
              AND a live (WVHT in NDBC latest_obs) NDBC/CDIP wave buoy within 100 km.
Rows already in the app (their id is in src/data/coast.ts) are left untouched. Every row gets `appCandidate`, `appCandidateBasis` (the numbers) and, when false, `appCandidateFailed` (which rules it failed).
Usage: python3 scripts/mark-app-candidates.py   (rewrites docs/forecast/data/world-spots/{us-east,us-gulf,caribbean}.json in place, indent 1, no trailing newline; prints the counts)."""
import json, re, collections, os
ROOT = os.path.join(os.path.dirname(__file__), '..')
coast = open(os.path.join(ROOT, 'src/data/coast.ts')).read()
IN_APP = set(re.findall(r"\['([a-z0-9-]+)',", coast))
FILES = {'us-east': None, 'us-gulf': None, 'caribbean': {'Puerto Rico', 'U.S. Virgin Islands'}}   # None = every row; a set = only these countries
def mark(s):
    f = s['facts'].get('facingDeg')
    tides = sorted(((x['distanceKm'], x['id'], x) for x in s['nearestSources'] if x['kind'] in ('tide gauge', 'tide prediction') and x['id'].startswith('CO-OPS')), key=lambda t: t[:2])
    buoys = sorted(((x['distanceKm'], x['id'], x) for x in s['nearestSources'] if x['kind'] == 'wave buoy' and x.get('live') is True), key=lambda t: t[:2])
    t = tides[0] if tides else None; b = buoys[0] if buoys else None
    failed = []
    if f is None: failed.append('facing')
    if not t or t[0] > 30: failed.append('tide')
    if not b or b[0] > 100: failed.append('buoy')
    basis = '; '.join([
        'facing from a guide (surfnerd "Faces")' if f is not None else 'no guide-stated facing (computed from the coastline or absent)',
        f"nearest CO-OPS tide station {t[0]} km ({'<=30' if t[0] <= 30 else '>30'})" if t else 'no CO-OPS tide station listed',
        f"nearest wave-reporting NDBC/CDIP buoy {b[0]} km ({'<=100' if b[0] <= 100 else '>100'})" if b else 'no live wave buoy listed'])
    s['appCandidate'] = not failed; s['appCandidateBasis'] = basis
    if failed: s['appCandidateFailed'] = failed
    else: s.pop('appCandidateFailed', None)
    return failed
report = {}
for name, countries in FILES.items():
    p = os.path.join(ROOT, f'docs/forecast/data/world-spots/{name}.json'); d = json.load(open(p))
    c = collections.Counter(); n = 0
    for s in d['spots']:
        if s['id'] in IN_APP or (countries and s['country'] not in countries): continue
        n += 1; failed = mark(s); c[','.join(failed) or 'candidate'] += 1
    open(p, 'w').write(json.dumps(d, indent=1, ensure_ascii=False))
    report[name] = (n, dict(c))
for k, v in report.items(): print(k, 'rows considered', v[0], v[1])
