// Licence-cleared photography (Wikimedia Commons). Credits must stay visible wherever a photo is shown.
// Generated from swello-design-references/07-ocean-photography/manifest.json (Phase 10B); the last three entries
// added from candidates-v2/manifest.json.
export interface Photo {id: string; location: string; photographer: string; license: string; licenseUrl: string; source: string; generic: boolean}
export const PHOTOS: Record<string, Photo> = {
 "ob-sunset-negative-tide": {
  "id": "ob-sunset-negative-tide",
  "location": "Ocean Beach, San Francisco",
  "photographer": "Brocken Inaglory",
  "license": "CC BY-SA 3.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
  "source": "https://commons.wikimedia.org/wiki/File:Sunset_at_Ocean_Beach_in_San_Francisco.jpg",
  "generic": false
 },
 "lm-sunset-surfer": {
  "id": "lm-sunset-surfer",
  "location": "Linda Mar, Pacifica",
  "photographer": "Dave Fayram",
  "license": "CC BY-SA 2.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
  "source": "https://commons.wikimedia.org/wiki/File:Sunset_Surfer_in_pacifica_california.jpg",
  "generic": false
 },
 "gen-surfer-under-wave": {
  "id": "gen-surfer-under-wave",
  "location": "Northern California (generic for SWELLO)",
  "photographer": "Brocken Inaglory",
  "license": "CC BY-SA 3.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
  "source": "https://commons.wikimedia.org/wiki/File:A_surfer_under_wave.jpg",
  "generic": true
 },
 "ocean-beach-seal-rocks": {
  "id": "ocean-beach-seal-rocks",
  "location": "Ocean Beach, San Francisco (Seal Rocks)",
  "photographer": "Radomianin",
  "license": "CC BY-SA 4.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0",
  "source": "https://commons.wikimedia.org/wiki/File:Seal_Rocks,_Ocean_Beach,_San_Francisco.jpg",
  "generic": false
 },
 "ocean-beach-fog-clearing": {
  "id": "ocean-beach-fog-clearing",
  "location": "Ocean Beach, San Francisco",
  "photographer": "Brocken Inaglory",
  "license": "CC BY-SA 3.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
  "source": "https://commons.wikimedia.org/wiki/File:Fog_ot_Ocean_Beach_in_San_Francisco_is_clearing_up.jpg",
  "generic": false
 },
 "ocean-beach-low-tide-sun": {
  "id": "ocean-beach-low-tide-sun",
  "location": "Ocean Beach, San Francisco",
  "photographer": "Brocken Inaglory",
  "license": "CC BY-SA 3.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
  "source": "https://commons.wikimedia.org/wiki/File:Ocean_beach_at_low_tide_against_the_sun.jpg",
  "generic": false
 },
 "bolinas-beach-wide": {
  "id": "bolinas-beach-wide",
  "location": "Bolinas, Marin",
  "photographer": "flamenc",
  "license": "CC BY-SA 3.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
  "source": "https://commons.wikimedia.org/wiki/File:Platja_de_Bolinas_-_Bolinas_Beach.jpg",
  "generic": false
 },
 "bolinas-beach": {
  "id": "bolinas-beach",
  "location": "Bolinas, Marin",
  "photographer": "philosophygeek from San Francisco, US",
  "license": "CC BY-SA 2.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
  "source": "https://commons.wikimedia.org/wiki/File:Bolinas_Beach_(2006).jpg",
  "generic": false
 },
 "linda-mar-sunset": {
  "id": "linda-mar-sunset",
  "location": "Linda Mar, Pacifica",
  "photographer": "Bob n Renee",
  "license": "CC BY 2.0",
  "licenseUrl": "https://creativecommons.org/licenses/by/2.0",
  "source": "https://commons.wikimedia.org/wiki/File:Linda_Mar_at_Sunset.jpg",
  "generic": false
 },
 "pacifica-linda-mar": {
  "id": "pacifica-linda-mar",
  "location": "Linda Mar, Pacifica",
  "photographer": "Zachary Smith",
  "license": "CC BY-SA 2.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/2.0",
  "source": "https://commons.wikimedia.org/wiki/File:Pacifica_Linda_Mar.jpg",
  "generic": false
 },
 "pacifica-state-beach-surfer": {
  "id": "pacifica-state-beach-surfer",
  "location": "Pacifica State Beach (Linda Mar)",
  "photographer": "BrokenSphere",
  "license": "CC BY 3.0",
  "licenseUrl": "https://creativecommons.org/licenses/by/3.0",
  "source": "https://commons.wikimedia.org/wiki/File:Surfer_at_Pacifica_State_Beach_1.JPG",
  "generic": false
 },
 "big-wave-santa-cruz": {
  "id": "big-wave-santa-cruz",
  "location": "Santa Cruz, California (generic for SWELLO)",
  "photographer": "Brocken Inaglory",
  "license": "CC BY-SA 3.0",
  "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0",
  "source": "https://commons.wikimedia.org/wiki/File:Big_wave_breaking_in_Santa_Cruz.jpg",
  "generic": true
 },
 "surfer-wave-cc0": {
  "id": "surfer-wave-cc0",
  "location": "Unknown location (generic)",
  "photographer": "Austin Neill arstyy",
  "license": "CC0",
  "licenseUrl": "http://creativecommons.org/publicdomain/zero/1.0/deed.en",
  "source": "https://commons.wikimedia.org/wiki/File:Surfer_surfing_the_wave_(Unsplash).jpg",
  "generic": true
 }
};
/** Photos that genuinely show each spot, best first. */
export const SPOT_PHOTOS: Record<string, string[]> = {"spot-2": ["ocean-beach-seal-rocks", "ocean-beach-fog-clearing", "ocean-beach-low-tide-sun", "ob-sunset-negative-tide"], "spot-0": ["bolinas-beach-wide", "bolinas-beach"], "spot-3": ["linda-mar-sunset", "pacifica-linda-mar", "pacifica-state-beach-surfer", "lm-sunset-surfer"]};
export const GENERIC_PHOTOS = ["big-wave-santa-cruz", "surfer-wave-cc0", "gen-surfer-under-wave"];
