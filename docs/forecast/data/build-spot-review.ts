// Regenerates docs/forecast/SPOT-FACTS-REVIEW.md from the profile registry.
// Run: node --experimental-strip-types docs/forecast/data/build-spot-review.ts
import fs from 'node:fs';
import {renderSpotReview} from '../../../src/services/spotReview.ts';
fs.writeFileSync(new URL('../SPOT-FACTS-REVIEW.md', import.meta.url), renderSpotReview());
console.log('wrote docs/forecast/SPOT-FACTS-REVIEW.md');
