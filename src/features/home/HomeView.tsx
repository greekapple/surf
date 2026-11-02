import {useEffect, useMemo, useRef} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {GENERIC_PHOTOS, SPOT_PHOTOS} from '../../ui/photos';
import {Media} from '../../ui/Media';
import {SeaState} from '../forecast/SeaState';
import {Icon} from '../../ui/Icon';
import {BAND_COLOR, bandOf} from '../forecast/model';
import {spotStrip} from '../../services/spotStrip';
import './home.css';

/** Spots shown, clearly labelled, when nothing is saved. Chosen only because they have licence-cleared photos; not a personal list. */
const POPULAR = ['spot-2', 'spot-0', 'spot-3'];
/** Image slots live in public/media/manifest.json: replace the entry to swap the picture (e.g. for an AI illustration). */
const PANELS = [
  {area: 'forecast', slot: 'home-panel-forecast', title: 'Forecast', line: 'Swell, wind and tide for one spot.', icon: 'forecast'},
  {area: 'explore', slot: 'home-panel-map', title: 'Map', line: 'The whole coast at a glance.', icon: 'explore'},
  {area: 'quiver', slot: 'home-panel-quiver', title: 'Quiver', line: 'Your boards, and which suits the day.', icon: 'quiver'},
] as const;
const BAND_WORD: Record<string, string> = {good: 'Good', fair: 'Fair', poor: 'Poor', none: 'No rating'};

/** Where CSS scroll-driven animation is missing, mark panels as they pass the reading line. Reduced motion shows final states via CSS. */
function useScrollFallback(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    if (!el || (typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()'))) return;
    const targets = el.querySelectorAll('.home-panel');
    // Neither scroll timelines nor IntersectionObserver: show every panel rather than leave it hidden.
    if (typeof IntersectionObserver !== 'function') { targets.forEach((n) => n.classList.add('on')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.classList.toggle('on', e.isIntersecting || e.boundingClientRect.top < 0)), {rootMargin: '0px 0px -22% 0px'});
    targets.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, [root]);
}

/** Home (T-030): a full-screen greeting, saved spots as swipeable cards, one honest sentence that lights up as you scroll, and three full-bleed ways in. No forecast numbers in the body. */
export function HomeView({go}: ViewProps) {
  const {data, now, spotOptions, view, setSpot, spot, selected} = useSwello();
  const rootRef = useRef<HTMLDivElement>(null);
  useScrollFallback(rootRef);
  const name = data.state.profile.displayName?.trim().split(/\s+/)[0];
  const hour = Number(new Intl.DateTimeFormat('en-US', {hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Los_Angeles'}).format(now));
  const greeting = hour < 5 ? 'Good evening' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const saved = data.state.favorites;
  const personal = saved.length > 0;
  const cards = useMemo(() => spotStrip(spotOptions, view.mapRecords, personal ? saved : POPULAR, now, data.state.profile), [spotOptions, view.mapRecords, saved, personal, now, data.state.profile]);
  const link = (area: 'forecast' | 'explore' | 'quiver' | 'personal') => ({href: `/${area}`, onClick: (e: React.MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); go(area); }});
  const openSpot = (id: string) => (e: React.MouseEvent) => { if (e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); setSpot(id); go('forecast'); };
  return (
    <div className="home" ref={rootRef}>
      <section className="home-hero" aria-labelledby="home-h">
        {/* T-038: the current hour's swell and wind at the selected spot, drawn from the data; no numbers on Home. */}
        {selected ? <SeaState f={selected.forecast} className="hero-media" caption="plain" where={`${spot.name} now`} /> : <div className="hero-media ss" aria-hidden="true" />}
        <div className="hero-in">
          <p className="greet">{greeting}</p>
          <h1 id="home-h">{name ? <>Hello, {name}.</> : 'Hello.'}</h1>
          <p className="hello-sub">Surf forecasts for Northern and Central California.</p>
          <a className="cta" {...link('forecast')}>Check a spot<Icon name="forecast" size={18} /></a>
        </div>
      </section>

      <section className="home-spots" aria-labelledby="spots-h">
        <header className="spots-head">
          <h2 id="spots-h">{personal ? 'Your spots' : 'Popular spots'}</h2>
          {!personal && <p className="spots-note">Not personalised</p>}
        </header>
        <ul className="spot-rail">
          {cards.length === 0 && <li className="spot-empty">None of your saved spots are available right now. Open the forecast to pick another.</li>}
          {cards.map((c, i) => {
            const own = SPOT_PHOTOS[c.id]?.[0], photo = own ?? GENERIC_PHOTOS[i % GENERIC_PHOTOS.length], band = bandOf(c.category);
            // Say what the chip is: demonstration data, no rating, flat, or the model rating.
            const word = c.demo ? 'Demo data' : c.category === 'FLAT' ? 'Flat' : BAND_WORD[band];
            return (
              <li key={c.id} className="spot-card" style={{'--band': BAND_COLOR[band]} as React.CSSProperties}>
                <Media id={photo} className="spot-media" sizes="(max-width: 860px) 80vw, 360px" alt={own ? undefined : ''} />
                <a className="spot-a" {...link('forecast')} onClick={openSpot(c.id)} aria-label={`${c.name}, ${c.region}. ${word}. Open forecast`}>
                  <span className="spot-band"><i aria-hidden="true" />{word}</span>
                  {!own && <em className="spot-note">Illustrative photo, not this spot</em>}
                  <b>{c.name}</b><small>{c.region}</small>
                </a>
              </li>
            );
          })}
        </ul>
      </section>


      <nav className="home-panels" aria-label="Where to go">
        {PANELS.map((t) => (
          <div key={t.area} className="home-panel">
            <Media id={t.slot} className="panel-media plx" sizes="100vw" alt="" />
            <div className="panel-in">
              <a className="panel-a" {...link(t.area)}><h2>{t.title}</h2></a>
              <p>{t.line}</p>
              <span className="panel-go" aria-hidden="true"><Icon name={t.icon} size={20} /></span>
            </div>
          </div>
        ))}
      </nav>
    </div>
  );
}
