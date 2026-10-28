import {useCallback, useEffect, useState} from 'react';
import {spots} from '../data/demo';

export type Route =
  | {name: 'forecast'; spotSlug: string | null}
  | {name: 'explore'}
  | {name: 'quiver'; boardId: string | null}
  | {name: 'scale'};

export const destinations = [
  {name: 'forecast', label: 'Forecast', path: '/forecast'},
  {name: 'explore', label: 'Explore', path: '/explore'},
  {name: 'quiver', label: 'Quiver', path: '/quiver'},
  {name: 'scale', label: 'Scale', path: '/scale'},
] as const;

export function slugFor(spotId: string): string {
  const spot = spots.find(s => s.id === spotId);
  return spot ? toSlug(spot.name) : spotId;
}

export function spotIdForSlug(slug: string): string | null {
  return spots.find(s => toSlug(s.name) === slug)?.id ?? null;
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function parseRoute(pathname: string): Route {
  const [first, second] = pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (first === 'explore') return {name: 'explore'};
  if (first === 'quiver') return {name: 'quiver', boardId: second ?? null};
  if (first === 'scale') return {name: 'scale'};
  return {name: 'forecast', spotSlug: first === 'forecast' ? second ?? null : null};
}

/** History API routing; the Worker and Vite both serve index.html for extension-less paths. */
export function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(window.location.pathname));

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(window.location.pathname));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((path: string, options: {replace?: boolean} = {}) => {
    if (path === window.location.pathname) return;
    if (options.replace) window.history.replaceState(null, '', path);
    else window.history.pushState(null, '', path);
    setRoute(parseRoute(path));
    if (!options.replace) window.scrollTo({top: 0});
  }, []);

  return {route, navigate};
}
