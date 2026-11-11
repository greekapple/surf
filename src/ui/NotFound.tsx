import {useState, type ReactNode} from 'react';
import {useSwello} from '../app/store';
import {pathFor, slugFor, type Go} from '../app/routes';
import {suggestSpots} from '../app/slugs';
import {Icon} from './Icon';

/** Audit B2: an unknown page, or a ?spot= slug that names no spot (or several), says so and offers search. Never another spot's forecast under a foreign URL. */
export function NotFound({kind, go}: {kind: 'page' | 'spot'; go: Go}) {
  const {spotOptions, setSpot, missingSpot} = useSwello();
  const [q, setQ] = useState('');
  const open = (id: string) => { setSpot(id); go('forecast'); };
  const slug = missingSpot?.slug ?? '';
  const ambiguous = kind === 'spot' && (missingSpot?.ids.length ?? 0) > 1;
  const candidates = ambiguous ? missingSpot!.ids.map((id) => spotOptions.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s) : [];
  const term = q.trim().toLowerCase();
  const found = term ? spotOptions.filter((s) => `${s.name} ${s.region}`.toLowerCase().includes(term)).slice(0, 8) : [];
  const guesses = kind === 'spot' && !ambiguous && !term ? suggestSpots(slug, spotOptions) : [];
  const list = (spots: typeof spotOptions, label: string): ReactNode => spots.length > 0 && (
    <ul className="nf-list" aria-label={label}>
      {spots.map((s) => <li key={s.id}><a href={`${pathFor('forecast')}?spot=${slugFor(s.id)}`} onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); open(s.id); }}><b>{s.name}</b><small>{s.region}</small></a></li>)}
    </ul>
  );
  const name = candidates[0]?.name;
  return (
    <article className="legal nf">
      <h1>{kind === 'page' ? 'Page not found' : ambiguous ? `Which ${name ?? 'spot'}?` : 'Spot not found'}</h1>
      <p>{kind === 'page' ? <>There is no page at <code>{location.pathname}</code>.</>
        : ambiguous ? <>There are {candidates.length} spots called {name ?? `“${slug}”`}. Pick the one you meant.</>
        : <>We don't know a spot called <code>{slug}</code>, so no forecast is shown.</>}</p>
      {ambiguous && list(candidates, 'Spots with that name')}
      {guesses.length > 0 && <><h2>Did you mean</h2>{list(guesses, 'Spots with a similar name')}</>}
      <label className="nf-search"><Icon name="search" size={16} /><input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search spots" aria-label={`Search ${spotOptions.length} spots by name or county`} /></label>
      {term && (found.length ? list(found, 'Matching spots') : <p>No spot matches “{q}”.</p>)}
      <p className="nf-links"><a href="/" onClick={(e) => { e.preventDefault(); go('home'); }}>Home</a> · <a href="/explore" onClick={(e) => { e.preventDefault(); go('explore'); }}>Open the map</a></p>
    </article>
  );
}
