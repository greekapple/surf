#!/usr/bin/env python3
"""Apply the batch 3 MERGES of docs/forecast/data/east-batch.ts: the kept row of each pair gets the dropped row's source pages (by URL, none repeated) in its world-spots facts, and the dropped row is removed from coast.ts, guide-facts.json, nwsZones.ts and marinePoints.ts.
Usage: python3 scripts/merge-batch3-dups.py   (idempotent; run add-spots --step=rows,facts afterwards to regenerate the service list and the facts file)"""
import json, re
MERGES = {'w-us-rockaway': 'w-us-rockaways', 'w-us-matanuck': 'w-us-matunuck', 'w-us-fox-hill': 'w-us-foxhill-point', 'w-carib-wilderness-puerto-rico': 'w-carib-wilderness-aguadilla', 'w-us-fishermans-island-virginia': 'w-us-fishermans-island', 'w-us-san-jose-island': 'w-us-st-joes-island'}
W = 'docs/forecast/data/world-spots/'
files = {f: json.load(open(W + f + '.json')) for f in ('us-east', 'us-gulf', 'caribbean')}
where = {s['id']: f for f, d in files.items() for s in d['spots']}
for drop, keep in MERGES.items():
    d = next(s for s in files[where[drop]]['spots'] if s['id'] == drop); k = next(s for s in files[where[keep]]['spots'] if s['id'] == keep)
    have = {x['url'].split('#')[0] for x in k['facts']['sources']}
    for x in d['facts']['sources']:
        if x['url'].split('#')[0] not in have: k['facts']['sources'].append(x); have.add(x['url'].split('#')[0])
for f, d in files.items(): open(W + f + '.json', 'w').write(json.dumps(d, indent=1, ensure_ascii=False))
t = open('src/data/coast.ts').read()
for drop in MERGES: t = re.sub(r"^  \['" + re.escape(drop) + r"',.*\n", '', t, flags=re.M)
open('src/data/coast.ts', 'w').write(t)
g = json.load(open('docs/forecast/data/guide-facts.json')); g = [x for x in g if x['spotId'] not in MERGES]; open('docs/forecast/data/guide-facts.json', 'w').write(json.dumps(g, indent=1, ensure_ascii=False) + '\n')
n = open('src/services/nwsZones.ts').read()
for drop in MERGES: n = re.sub(r"^  '" + re.escape(drop) + r"':.*\n", '', n, flags=re.M)
open('src/services/nwsZones.ts', 'w').write(n)
m = open('src/data/marinePoints.ts').read()
for drop in MERGES: m = re.sub(r"^  '" + re.escape(drop) + r"':.*\n", '', m, flags=re.M)
open('src/data/marinePoints.ts', 'w').write(m)
print('merged', len(MERGES))
