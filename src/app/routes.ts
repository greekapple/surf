import {useCallback, useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {allSpots as spots} from '../data/catalog.ts';

export type Area = 'home' | 'forecast' | 'explore' | 'quiver' | 'personal';
/** `hidden` sections are real routes reached from inside a page (e.g. the 3D viewer from a spot's forecast), not menu entries. */
export interface Section {id: string; label: string; hint: string; hidden?: boolean}
export interface AreaDef {id: Area; label: string; sections: Section[]}

/** Product navigation: every section renders real content (see Obsidian 03-Navigation-Architecture). */
export const AREAS: AreaDef[] = [
  {id: 'home', label: 'Home', sections: [
    {id: '', label: 'Home', hint: 'Your saved spots and where to go next'},
  ]},
  {id: 'forecast', label: 'Forecast', sections: [
    {id: '', label: 'Spot Forecast', hint: 'Swell, wind, tide and the wave scale on one page'},
    {id: 'wave-scale', label: 'Wave scale', hint: 'Illustrated wave sizes for the selected height', hidden: true},
  ]},
  {id: 'explore', label: 'Map', sections: [
    {id: '', label: 'Ocean Map', hint: 'Spots and conditions on the map'},
    {id: 'wind', label: 'Wind Layers', hint: 'Regional wind grid', hidden: true}, // chosen from the map's own layer controls
    {id: 'swell', label: 'Swell Layers', hint: 'Regional wave grid', hidden: true},
    {id: 'compare', label: 'Compare Spots', hint: 'Spots side by side at one hour'},
    {id: 'discover', label: 'Find Spots', hint: 'Spots near you by distance and conditions'},
  ]},
  {id: 'quiver', label: 'Quiver', sections: [
    {id: '', label: 'Quiver', hint: 'Your boards and the one to take today'},
    {id: 'showroom', label: 'Showroom', hint: 'Inspect one board in 3D', hidden: true},   // quiver-lock: the Quiver is one page now; this link opens it in 3D
    {id: 'match', label: 'Board Match', hint: 'Which board for these conditions'},
    {id: 'compare', label: 'Compare Boards', hint: 'Two boards side by side'},
  ]},
  {id: 'personal', label: 'Personal', sections: [
    {id: '', label: 'Personal', hint: 'Profile, favorites, preferences, units and data'},
    {id: 'spots', label: 'Favorite Spots', hint: 'Favorites'},
    {id: 'preferences', label: 'Surf preferences', hint: 'Surf height, swell, period and tide'},
    {id: 'journal', label: 'Surf Journal', hint: 'Your sessions'},
    {id: 'account', label: 'Data & privacy', hint: 'Data source, storage and backup'},
    {id: 'profile', label: 'Edit profile', hint: 'Name, region, photo and ability', hidden: true}, // pages of the grouped Personal list (T-037)
    {id: 'units', label: 'Units', hint: 'Heights, wind and the wave scale', hidden: true},
    {id: 'appearance', label: 'Appearance', hint: 'Theme', hidden: true},
    {id: 'privacy', label: 'Privacy', hint: 'What stays on your device', hidden: true},
    {id: 'terms', label: 'Terms', hint: 'Not a safety service', hidden: true},
    {id: 'credits', label: 'Data sources & credits', hint: 'Every source, its license and credit', hidden: true}, // audit R4 / A10
  ]},
];

/** `notFound`: the path names no page (audit B2); the app shows "Page not found" with search instead of silently showing another page. */
export interface Route {area: Area; section: string; notFound?: boolean}

export function parseRoute(pathname: string): Route {
  const [a, s, ...rest] = pathname.split('/').filter(Boolean);
  if (!a) return {area: 'home', section: ''};
  if (a === 'map') return parseRoute(`/explore${s ? `/${s}` : ''}`); // "Map" in the bar (T-022); /explore stays canonical
  if (a === 'scale' && !s) return {area: 'forecast', section: 'wave-scale'}; // Wave Scale lives inside Forecast; keep old links working
  if (a === 'forecast' && s === 'compare' && !rest.length) return {area: 'explore', section: 'compare'}; // Compare moved to Explore (2026-10-29)
  const def = AREAS.find((x) => x.id === a);
  if (!def) return {area: 'home', section: '', notFound: true};
  if (rest.length || !def.sections.some((x) => x.id === (s ?? ''))) return {area: def.id, section: '', notFound: true};
  return {area: def.id, section: s ?? ''};
}

export const pathFor = (area: Area, section = '') => `/${area}${section ? `/${section}` : ''}`;

// Audit B3 + dedupe-pairs: ONE slug system (app/slugs.ts index, merged-spot aliases applied first), implemented in services/spotSlug.ts.
export {slugFor, spotIdForSlug, matchSpotSlug, toSlug} from '../services/spotSlug.ts';

/** History API routing (the Worker and Vite both serve index.html for extension-less paths). */
export function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(location.pathname));
  useEffect(() => {
    const onPop = () => setRoute(parseRoute(location.pathname));
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);
  const navigate = useCallback((area: Area, section = '', opts: {replace?: boolean} = {}) => {
    const path = pathFor(area, section) + location.search;
    if (path !== location.pathname + location.search) {
      if (opts.replace) history.replaceState(null, '', path);
      else history.pushState(null, '', path);
    }
    // Cross-fade between pages where the browser supports View Transitions (skipped for reduced motion).
    const apply = () => { flushSync(() => setRoute({area, section})); if (!opts.replace) scrollTo({top: 0}); };
    const vt = (document as Document & {startViewTransition?: (cb: () => void) => unknown}).startViewTransition;
    if (vt && !opts.replace && !matchMedia('(prefers-reduced-motion: reduce)').matches) vt.call(document, apply); else apply();
  }, []);
  return {route, navigate};
}

export type Go = (area: Area, section?: string) => void;
export interface ViewProps {section: string; go: Go}
