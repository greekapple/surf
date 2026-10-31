import {useCallback, useEffect, useState} from 'react';
import {flushSync} from 'react-dom';
import {allSpots as spots} from '../data/catalog';

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
    {id: '', label: 'My Boards', hint: 'Your collection'},
    {id: 'showroom', label: 'Showroom', hint: 'Inspect one board'},
    {id: 'match', label: 'Board Match', hint: 'Which board for these conditions'},
    {id: 'compare', label: 'Compare Boards', hint: 'Two boards side by side'},
  ]},
  {id: 'personal', label: 'Personal', sections: [
    {id: '', label: 'Personal', hint: 'Profile, favorites, preferences, units and data'},
    {id: 'spots', label: 'Favorite Spots', hint: 'Favourites'},
    {id: 'preferences', label: 'Surf preferences', hint: 'Wave range, swell, period and tide'},
    {id: 'journal', label: 'Surf Journal', hint: 'Your sessions'},
    {id: 'account', label: 'Data & privacy', hint: 'Data source, storage and backup'},
    {id: 'profile', label: 'Edit profile', hint: 'Name, region, photo and ability', hidden: true}, // pages of the grouped Personal list (T-037)
    {id: 'units', label: 'Units', hint: 'Heights, wind and the wave scale', hidden: true},
    {id: 'appearance', label: 'Appearance', hint: 'Theme', hidden: true},
    {id: 'privacy', label: 'Privacy', hint: 'What stays on your device', hidden: true},
    {id: 'terms', label: 'Terms', hint: 'Not a safety service', hidden: true},
  ]},
];

export interface Route {area: Area; section: string}

export function parseRoute(pathname: string): Route {
  const [a, s] = pathname.split('/').filter(Boolean);
  if (a === 'map') return parseRoute(`/explore${s ? `/${s}` : ''}`); // "Map" in the bar (T-022); /explore stays canonical
  if (a === 'scale') return {area: 'forecast', section: 'wave-scale'}; // Wave Scale lives inside Forecast; keep old links working
  if (a === 'forecast' && s === 'compare') return {area: 'explore', section: 'compare'}; // Compare moved to Explore (2026-10-29)
  const def = AREAS.find((x) => x.id === a);
  if (!def) return {area: 'home', section: ''};
  return {area: def.id, section: def.sections.some((x) => x.id === (s ?? '')) ? s ?? '' : ''};
}

export const pathFor = (area: Area, section = '') => `/${area}${section ? `/${section}` : ''}`;

const toSlug = (name: string) => name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const slugFor = (spotId: string) => toSlug(spots.find((s) => s.id === spotId)?.name ?? spotId);
export const spotIdForSlug = (slug: string | null) => (slug ? spots.find((s) => toSlug(s.name) === slug)?.id ?? null : null);

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
