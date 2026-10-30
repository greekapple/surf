import {useState} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {PHOTOS} from '../../ui/photos';
import {Icon} from '../../ui/Icon';
import './home.css';

/** Hand-picked, licence-cleared photographs (credits stay visible on each image). */
const WIDE = new Set(['ob-sunset-negative-tide', 'ocean-beach-fog-clearing', 'bolinas-beach-wide', 'pacifica-state-beach-surfer']);

function Shot({id, sizes, eager}: {id: string; sizes: string; eager?: boolean}) {
  const p = PHOTOS[id];
  const [ready, setReady] = useState(false);
  return (
    <>
      <img className={ready ? 'ready' : ''} alt={p.location} src={`/photos/${id}-1600.jpg`} sizes={sizes} loading={eager ? 'eager' : 'lazy'} decoding="async"
        srcSet={`/photos/${id}-800.jpg 800w, /photos/${id}-1600.jpg 1600w${WIDE.has(id) ? `, /photos/${id}-2400.jpg 2400w` : ''}`}
        ref={(el) => { if (el?.complete && el.naturalWidth) setReady(true); }} onLoad={() => setReady(true)} />
      <small className="credit"><a href={p.source} target="_blank" rel="noreferrer">{p.photographer}</a> · <a href={p.licenseUrl} target="_blank" rel="noreferrer">{p.license}</a></small>
    </>
  );
}

const TILES = [
  {area: 'forecast', title: 'Check a spot', line: 'Swell, wind, tide and the wave scale for one spot.', photo: 'ocean-beach-fog-clearing', icon: 'forecast'},
  {area: 'explore', title: 'Open the map', line: 'Wave height and wind along the whole coast.', photo: 'bolinas-beach-wide', icon: 'explore'},
  {area: 'quiver', title: 'Your quiver', line: 'Your boards, and which one suits the day.', photo: 'pacifica-state-beach-surfer', icon: 'quiver'},
] as const;

/** Home is short on purpose (T-022): a greeting and three ways in. Saved spots live in the strip under the bar; no forecast numbers here. */
export function HomeView({go}: ViewProps) {
  const {data, now} = useSwello();
  const name = data.state.profile.displayName?.trim().split(/\s+/)[0];
  const hour = Number(new Intl.DateTimeFormat('en-US', {hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Los_Angeles'}).format(now));
  const greeting = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const link = (area: 'forecast' | 'explore' | 'quiver' | 'personal') => ({href: `/${area}`, onClick: (e: React.MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(area); }});
  return (
    <div className="home">
      <section className="home-hero" aria-labelledby="home-h">
        <figure className="shot hero-shot"><Shot id="ob-sunset-negative-tide" sizes="100vw" eager /></figure>
        <div className="hero-in">
          <p className="greet">{greeting}</p>
          <h1 id="home-h">{name ? <>Hello, {name}.</> : 'Hello.'}</h1>
          <p className="hello-sub">Surf forecasts for Northern and Central California.{!name && <> <a {...link('personal')}>Add your name</a></>}</p>
        </div>
      </section>
      <nav className="tiles-in" aria-label="Where to go">
        {TILES.map((t) => (
          // The title link stretches over the card; the photo credit links sit above it (no nested links).
          <div key={t.area} className="tile-in">
            <figure className="shot"><Shot id={t.photo} sizes="(max-width: 860px) 100vw, 33vw" /></figure>
            <span className="tile-txt"><a className="tile-a" {...link(t.area)}><Icon name={t.icon} size={18} />{t.title}</a><span>{t.line}</span></span>
          </div>
        ))}
      </nav>
    </div>
  );
}
