#!/usr/bin/env python3
"""dedupe-pairs: the same-break pairs of the catalogue, resolved by the rule (docs/forecast/DEDUPE-PAIRS.md). Applied once on 2026-11-11; kept so the decision is reproducible and the removal is idempotent.
   MERGE  = the same break listed twice (normalised names equal, pins within 300 m, equal stated facings): the merged-away row is removed from the service list, the guide facts, the NWS zone table and the water-quality research, and moved to
            `dropped` (dropReason) in world-spots/us-east.json; its id stays as an alias (src/data/spotAliases.ts). The kept row's facts are NOT changed except one note naming the other surfnerd page and its (different) swell window.
   RENAME = two distinct breaks with one name: the second gets the guide's own words (never an invented label).
   REGION = Palos Verdes / San Pedro spots labelled Orange County are in Los Angeles County.
Walton Rocks is NOT merged: surfnerd has two different pages (a sand beach break and a reef).
Then: add-spots --step=rows,mopc,mopids --no-network, build-guide-facts.ts, build-spot-review.ts, build-water-quality.mjs."""
import json, re
MERGES = {'w-us-avalon-pier-north-carolina': 'w-us-avalon-pier', 'w-us-flagler-pier': 'w-us-flagler-beach-pier', 'w-us-a-st': 'w-us-a-street'}
RENAMES = {'w-usw-trails-2': 'Trails (San Onofre State Beach)', 'w-usw-point-dume': 'Point Dume / Little Dume', 'w-usw-haggertys': 'Haggertys and Malaga Cove'}
COUNTY_FIX = {'w-usw-abalone-cove-beach': 'Los Angeles', 'w-usw-palm-point': 'Los Angeles', 'w-usw-royal-palms-the-jetty': 'Los Angeles', 'w-usw-cabrillo-point': 'Los Angeles'}
t = open('src/data/coast.ts').read()
for drop in MERGES: t = re.sub(r"^  \['" + re.escape(drop) + r"',.*\n", '', t, flags=re.M)
for rid, name in RENAMES.items(): t = re.sub(r"(^  \['" + re.escape(rid) + r"', ')((?:[^'\\]|\\.)*)(')", lambda m: m.group(1) + name.replace("'", "\\'") + m.group(3), t, flags=re.M)
for rid, county in COUNTY_FIX.items(): t = re.sub(r"(^  \['" + re.escape(rid) + r"', '(?:[^'\\]|\\.)*', ')Orange County(')", lambda m: m.group(1) + county + m.group(2), t, flags=re.M)
open('src/data/coast.ts', 'w').write(t)
raw = open('docs/forecast/data/guide-facts.json').read(); g = [x for x in json.loads(raw) if x['spotId'] not in MERGES]
for x in g:
    if x['spotId'] in RENAMES: x['name'] = RENAMES[x['spotId']]
open('docs/forecast/data/guide-facts.json', 'w').write(json.dumps(g, indent=1, ensure_ascii=False) + ('\n' if raw.endswith('\n') else ''))
s = open('src/services/nwsZones.ts').read()
for drop in MERGES: s = re.sub(r"^  '%s':.*\n" % re.escape(drop), '', s, flags=re.M)
open('src/services/nwsZones.ts', 'w').write(s)
raw = open('docs/forecast/data/water-quality-sources.json').read(); wq = json.loads(raw); wq['spots'] = [x for x in wq['spots'] if x['id'] not in MERGES]
open('docs/forecast/data/water-quality-sources.json', 'w').write(json.dumps(wq, indent=1, ensure_ascii=False) + ('\n' if raw.endswith('\n') else ''))
ids = json.load(open('docs/forecast/data/world-spots/us-east-batch1-ids.json')); ids2 = [i for i in ids if i not in MERGES]
if ids2 != ids: open('docs/forecast/data/world-spots/us-east-batch1-ids.json', 'w').write(json.dumps(ids2, indent=1, ensure_ascii=False) + '\n')
print('applied')
