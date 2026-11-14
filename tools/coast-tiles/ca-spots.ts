// forecast-visuals: the California spots (the app's own list and gate) as JSON for build-coast-tiles.py: id, name, pin, the beach's facing (open-water direction) if known.
// node --experimental-strip-types tools/coast-tiles/ca-spots.ts > <file>
import {evidenceSpots} from '../../src/ocean/spots.ts';
import {isCaliforniaSpot} from '../../src/ocean/regionGate.ts';
const out = evidenceSpots.filter((s) => isCaliforniaSpot(s)).map((s) => ({id: s.id, name: s.name, lat: s.latitude, lon: s.longitude, facing: s.orientation}));
process.stdout.write(JSON.stringify(out));
