#!/usr/bin/env python3
"""Batch 3 tide classes: reads the 7-day timing review (docs/forecast/data/tide-review-batch3.ts output, JSON lines) and rewrites the EAST3_REVIEWED block of src/ocean/tideStations.ts.
Usage: python3 scripts/tide-classes-batch3.py <tide-review.jsonl>
Rules (documented in the block's comment): OPEN = an ocean-side gauge by name (pier, "(ocean)", light, listed points) that agrees with its open neighbour within 25 min (sd 20, range ratio 0.8-1.25);
CLOSED-IF-ALTERNATIVE = an inlet, pass, entrance, jetty, harbour or river-mouth gauge, or an open-named one whose timing is off, that agrees with the open coast within 30 min (sd 20, range ratio 0.9-1.15; 45 min and 0.75+ for inlet names);
everything else on the East and Gulf coasts stays CLOSED by the East rule. Hand decisions (the judgement calls) are in OVERRIDES below, each with its reason."""
import json, re, sys
rows = {json.loads(l)['id']: json.loads(l) for l in open(sys.argv[1]) if l.startswith('{')}
OPEN = re.compile(r"\bpier\b|\(ocean\)|\(coastal\)|\blight\b|beach pier|ocean pier|Cape Lookout|Gay Head|Great Point|Wasque|Watch Hill Point|Ponquoque|Eel Point|Mobile Point|Chandeleur|Bob Hall|Cape Neddick", re.I)
INLET = re.compile(r"entrance|inlet|jetty|\bpass\b|breakwater", re.I)
UPWATER = re.compile(r"\b(creek|canal|bridge|icw+|channel|thorofare|sound|lake|lagoon|bay|marina|basin|cove|narrows|yacht|inside|airport|causeway|slough|bayou|park|hydro|narrow)\b", re.I)
RIVER = re.compile(r"\briver\b", re.I)
HAND = {  # id -> (class, why this judgement)
 '8512354': ('open', 'the ocean-side gauge at Shinnecock Inlet: 7-day mean offset -1 min (sd 7, range ratio 1.08) from Moriches Inlet (8513398), 23 km east, the two ocean-side gauges of the Long Island south shore agreeing'), '8513398': ('open', 'Moriches Inlet, on the ocean side: 7-day mean offset 1 min (sd 7, range ratio 0.92) from the Shinnecock Inlet ocean gauge (8512354), 23 km west'),
 '8449062': ('closed-if-alternative', 'Eel Point is on the Nantucket Sound side (range ratio 0.75 to Great Point)'), '8448566': ('closed-if-alternative', 'Great Point is the tip where Nantucket Sound meets the ocean (range ratio 1.33 to Eel Point)'),
 '8458694': ('closed-if-alternative', 'Watch Hill Point is at the Block Island Sound entrance, 44 min behind Newport'), '8448733': ('closed-if-alternative', 'Gay Head sits at a fixed +43 min from Squibnocket Point (sd 4), a different regime from the south shore'),
 '8448683': ('closed-if-alternative', 'Wasque Point is a shoal tip with a range ratio 0.37 to the Martha\'s Vineyard buoy'), '8726282': ('closed-if-alternative', 'Anna Maria city pier is on the Tampa Bay mouth side, not the open Gulf beach'),
 '8734635': ('closed-if-alternative', 'Mobile Point (Fort Morgan) is the Mobile Bay entrance'), '8726601': ('open', 'a coastal gauge on the Gulf side of the Pinellas barrier island; the Gulf tide is mixed so its highs and lows pair unreliably (-96 min, sd 34 against a Tampa Bay mouth pier): classed by name and position'),
 '8731269': ('open', 'a pier on the Gulf beach at Gulf Shores; the Gulf tide is mostly diurnal so its timing against Mobile Point (132 min, sd 18, a bay-mouth gauge) is not a test: classed by name and position'),
 '8418557': ('open', 'Old Orchard Beach, on the open Maine coast: agrees with Portland Head Light within 2 min (sd 3)'), '8418031': ('open', 'Portland Head Light, on the exposed Cape Elizabeth coast; no reviewed open gauge within 150 km to compare with'),
 '8418606': ('closed-if-alternative', 'Camp Ellis is at the Saco River entrance'), '8419399': ('open', 'Cape Neddick, on the open coast: agrees with Portland Head Light within 7 min (sd 2)'),
}
NOTM = {'8512354', '8513398'}   # their reasons carry their own timing (the review's yardstick for them was Ponquogue Point, inside Shinnecock Bay)
DROPPED = {'8534836', '8725889', '8516402', '8512451'}   # (inside) and marina gauges stay closed by name; Ponquogue Point (8512451) is inside Shinnecock Bay: +33 min (sd 25) from the Shinnecock Inlet ocean gauge, so closed   # "(inside)" and marina gauges stay closed by name
cls = {}
for i, r in rows.items():
    t = r['refs'][0] if r['refs'] else None; ok = t and t['meanMin'] is not None
    rrok = lambda lo, hi: t['rangeRatio'] is None or lo <= t['rangeRatio'] <= hi   # a missing range ratio (too few days with three extrema) does not fail a gauge
    nm = r['name']
    if i in HAND: cls[i] = HAND[i][0]; continue
    if i in DROPPED: continue
    if OPEN.search(nm) and not re.search(r"inside|bridge|river|\bbay\b", nm, re.I):
        if ok and abs(t['meanMin']) <= 25 and t['sdMin'] <= 20 and rrok(0.8, 1.25): cls[i] = 'open'
        elif ok: cls[i] = 'closed-if-alternative' if abs(t['meanMin']) <= 45 else None
        elif not ok: cls[i] = 'open'   # no neighbour to compare with: by name
    elif INLET.search(nm) and not re.search(r"\b(river|creek|icw+|bridge|canal)\b", nm, re.I) and ok and abs(t['meanMin']) <= 45 and rrok(0.75, 9): cls[i] = 'closed-if-alternative'
    elif INLET.search(nm) and RIVER.search(nm) or INLET.search(nm) and re.search(r"creek", nm, re.I):
        if ok and abs(t['meanMin']) <= 25 and rrok(0.9, 1.15) and t['sdMin'] <= 15: cls[i] = 'closed-if-alternative'
    elif not UPWATER.search(nm) and ok and abs(t['meanMin']) <= 30 and t['sdMin'] <= 20 and rrok(0.9, 1.15) and re.search(r"harbou?r|point|island|river|head|cape|isles", nm, re.I): cls[i] = 'closed-if-alternative'
cls = {k: v for k, v in cls.items() if v}
GULF = lambda r: r['lon'] < -81.7 and 24 < r['lat'] < 31.1 and r['id'][0] == '8'
esc = lambda s: s.replace("'", "\\'")
lines = []
for i, c in sorted(cls.items(), key=lambda kv: -rows[kv[0]]['lat']):
    r = rows[i]; t = r['refs'][0] if r['refs'] else None
    tm = (f"7-day mean offset {t['meanMin']} min (sd {t['sdMin']}) from {t['refName']} ({t['ref']}), {t['refKm']} km, range ratio {t['rangeRatio']}" if t and t['meanMin'] is not None else "no reviewed open gauge within 150 km to compare with; classed from its name and position")
    if GULF(r) and t: tm += "; Gulf tides are mixed or diurnal, so highs and lows pair unreliably and the timing is only a rough check"
    if i in NOTM: why = f"{r['name']}: {HAND[i][1]}"
    elif i in HAND: why = f"{r['name']}: {HAND[i][1]}; {tm}"
    elif c == 'open': why = f"{r['name']}: a gauge on the ocean side of the coast (its name and position); {tm}"
    else: why = f"{r['name']}: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; {tm}; used only when no open-coast gauge is within range"
    lines.append(f"  ['{i}', '{c}', '{esc(why)}'],")
PR = [('9754986','open','Boca de Cangrejos, on the open north-east coast: 7-day mean offset 12 min (sd 10) from San Juan, range ratio 0.86'),('9753766','open','Luquillo, on the open north-east coast: 7-day mean offset -35 min (sd 22) from San Juan, range ratio 0.96 (a micro-tidal coast, range about 0.3 m: the gauges agree within about 45 min)'),('9757809','open','Arecibo, on the open north coast: -34 min (sd 20) from San Juan, range ratio 1.1'),('9759412','open','Aguadilla, on the open north-west coast: -45 min (sd 19) from San Juan, range ratio 0.88 (the tide progresses west along the coast)'),('9759394','open','Mayaguez, on the open west coast: -18 min (sd 21) from San Juan, range ratio 0.79'),('9755371','closed-if-alternative','San Juan is inside San Juan Bay (La Puntilla): used only when no open-coast gauge is within range'),('9759421','closed','Punta Guanajibo is inside Mayaguez Bay (range ratio 0.7 to San Juan)'),('9756567','closed-if-alternative','Boca del Cibuco is a river mouth on the north coast: -7 min (sd 14) from San Juan, range ratio 1.11; used only when no open-coast gauge is within range'),('9754487','closed-if-alternative','Puerto Maunabo is a small harbour on the south-east coast: no stable pairing with San Juan (sd 104 min over 11 pairs); used only when no open-coast gauge is within range'),('9754228','closed-if-alternative','Yabucoa Harbor is a harbour on the south-east coast: no stable pairing with San Juan (sd 105 min); used only when no open-coast gauge is within range'),('TEC4737','closed-if-alternative','Arroyo is a small harbour on the south coast: no stable pairing with San Juan (sd 119 min); used only when no open-coast gauge is within range')]
for i, c, w in PR: lines.append(f"  ['{i}', '{c}', '{esc(w)}'],")
head = "/** US East, Gulf and Puerto Rico, batch 3 (2026-11-10): the CO-OPS stations that are one of the three nearest to a spot of the batch and are NOT closed by default, each classed from its name and position and from the 7-day NOAA predicted high/low timing against the nearest gauge already reviewed open (docs/forecast/data/tide-review-batch3.ts; metric in tide-timing.ts; generated by scripts/tide-classes-batch3.py). Rules: an ocean-side gauge that agrees with its open neighbour within 25 min (sd 20, range ratio 0.8-1.25) is open; an inlet, pass, entrance, jetty, harbour or river-mouth gauge that agrees with the open coast within 30 min (45 for an inlet name, range ratio 0.9-1.15, or 0.75+ for an inlet) is closed-if-alternative; the rest of the East and Gulf stations (bays, sounds, creeks, the ICWW, bridges, marinas, up-river) stay CLOSED by the East rule above. The Puerto Rico gauges are compared with San Juan (the tide there is micro-tidal, about 0.3 m). */\n"
block = head + "const EAST3_REVIEWED: [string, 'open' | 'closed' | 'closed-if-alternative', string][] = [\n" + "\n".join(lines) + "\n];\nfor (const [id, exposure, reason] of EAST3_REVIEWED) TIDE_EXPOSURE_OVERRIDES[id] = {exposure, reason: `${reason} (${COOPS(id)})`};\n"
p = 'src/ocean/tideStations.ts'; s = open(p).read()
a = s.index('/** US East, Gulf and Puerto Rico, batch 3'); endmark = "TIDE_EXPOSURE_OVERRIDES[id] = {exposure, reason: `${reason} (${COOPS(id)})`};\n"; b = s.index(endmark, s.index('const EAST3_REVIEWED')) + len(endmark)
s = s[:a] + block + s[b:]; open(p, 'w').write(s)
from collections import Counter; print(Counter(l.split("'")[3] for l in lines))
