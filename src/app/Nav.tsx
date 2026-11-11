import {zoneAbbr} from '../ocean/spotZone';
import {canonicalSpotId} from '../data/spotAliases';
import {useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode} from 'react';
import {AREAS, pathFor, type Area} from './routes';
import {useSwello} from './store';
import {Icon} from '../ui/Icon';
import {BAND_COLOR, band, bandOf as bandOfCat} from '../features/forecast/model';
import {timeLabelPT} from '../features/forecast/format';
import {ht} from '../features/forecast/helpers';
import {resolveTheme, useThemePref} from '../ui/theme';
import {ZONES, zoneOf, stateOfZone} from '../data/zones';
import {spotStrip} from '../services/spotStrip';
import {limitedText} from '../services/sourceStatus';
import {AutofillInput} from '../ui/AutofillInput';
import {completion, recentSpots, rememberSpot, searchSpots} from '../services/spotSearch';
import {conditionWord} from '../ui/Condition';

type Go = (area: Area, section?: string) => void;
const linkProps = (go: Go, area: Area, section = '') => ({
  href: pathFor(area, section),
  onClick: (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    go(area, section);
  },
});

/** A bar item (Surfline / Apple pattern): the link always navigates; hovering it, ArrowDown or the small chevron button opens its
 *  panel. Forecast opens the place browser; other areas open a flyout with one large lead link and smaller secondary links. */
function AreaMenu({def, current, section, go, children, className = '', label}: {def: (typeof AREAS)[number]; current: boolean; section: string; go: Go; children?: ReactNode; className?: string; /** the link's accessible name, when its visible content is not the area's name */ label?: string}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const timer = useRef(0);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener('pointerdown', close);
    return () => removeEventListener('pointerdown', close);
  }, [open]);
  useEffect(() => setOpen(false), [current, section]);
  const items = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('.menu a, .menu button') ?? []);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { if (open) e.preventDefault(); setOpen(false); ref.current?.querySelector<HTMLElement>('.area-link')?.focus(); return; }   // handled: the map keeps its spot (1B)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); requestAnimationFrame(() => items()[0]?.focus()); return; }
      const list = items(), i = list.indexOf(document.activeElement as HTMLElement);
      list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
    }
  };
  const close = () => setOpen(false);
  const secs = def.sections.filter((s) => !s.hidden);
  const menu = def.id === 'forecast' || secs.length > 1;
  return (
    <li ref={ref} className={`area${open ? ' open' : ''} ${className}`} onKeyDown={onKey}
      onPointerEnter={(e) => { if (menu && e.pointerType === 'mouse') { clearTimeout(timer.current); setOpen(true); } }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') timer.current = window.setTimeout(close, 160); }}>
      <a className="area-link" aria-label={label} aria-current={current ? 'page' : undefined} {...linkProps((a, sec) => { go(a, sec); close(); }, def.id)}>{children ?? def.label}</a>
      {menu && <button className="area-more" aria-label={`${def.label} menu`} aria-expanded={open} aria-haspopup="true" onClick={() => setOpen(!open)}><Icon name="chevron" size={12} /></button>}
      {open && def.id === 'forecast' && <SpotMegaMenu section={section} current={current} go={go} close={close} />}
      {open && def.id !== 'forecast' && secs.length > 1 && (
        <ul className="menu fly" aria-label={`${def.label} pages`}>
          {secs.map((s, k) => (
            <li key={s.id}>
              <a className={k === 0 ? 'fly-lead' : undefined} {...linkProps((a, sec) => { go(a, sec); close(); }, def.id, s.id)} aria-current={current && section === s.id ? 'page' : undefined}>
                {s.label}{k === 0 && <small>{s.hint}</small>}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

const RECENT_KEY = 'swello-recent';
const readRecent = (): string[] => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string').map(canonicalSpotId))].slice(0, 5) : []; } catch { return []; } };
/** Remembers the last five spots viewed (this device only). */
function useRecentSpots(id: string) {
  const [recent, setRecent] = useState(readRecent);
  useEffect(() => {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 5);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* storage unavailable: recents last for this session */ }
    setRecent(next);
  }, [id]);
  return recent;
}

/** Forecast menu: a place browser, not a list of tabs. Left rail: forecast pages, recent and favourite spots.
 * Main pane: Region › County › Spot with each spot's live offshore height and provisional rating. */
function SpotMegaMenu({section, current, go, close}: {section: string; current: boolean; go: Go; close: () => void}) {
  const {spot, spotOptions, setSpot, data, view, now, requestSpots} = useSwello();
  const recent = useRecentSpots(spot.id);
  // Same colour and labelled height as the saved-spots strip and search (T-024 selector), never a bare number.
  const info = useMemo(() => new Map(spotStrip(spotOptions, view.mapRecords, spotOptions.map((s) => s.id), now, data.state.profile, {bundle: view.ocean.bundle}).map((x) => [x.id, x])),
    [spotOptions, view.mapRecords, now, data.state.profile]);
  const [zone, setZone] = useState(() => zoneOf(spot.region));
  const [county, setCounty] = useState<string | null>(null);
  const favs = data.state.favorites;
  const zones = ZONES.filter(([, rs]) => spotOptions.some((s) => rs.includes(s.region)));
  const counties = (ZONES.find(([z]) => z === zone)?.[1] ?? []).filter((c) => spotOptions.some((s) => s.region === c));
  const list = spotOptions.filter((s) => zoneOf(s.region) === zone && (!county || s.region === county));
  // subset loading: the picker's heights come from the spots it lists (at most 60 of the zone/county shown)
  useEffect(() => { requestSpots(list.slice(0, 60).map((s) => s.id)); }, [zone, county]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (id: string) => { setSpot(id); go('forecast'); close(); };
  const def = AREAS.find((a) => a.id === 'forecast')!;
  const row = (id: string) => {
    const s = spotOptions.find((x) => x.id === id);
    if (!s) return null;
    const it = info.get(s.id);
    return (
      <button key={s.id} className="mm-spot" aria-current={s.id === spot.id} onClick={() => pick(s.id)}>
        <span className={`qdot${it?.dark ? ' is-dark' : ''}`} title={it?.dark ? 'After dark' : undefined} style={{background: BAND_COLOR[it ? bandOfCat(it.category) : 'none']}} />
        <span className="mm-n">{s.name}<small>{s.region}</small></span>
        <span className="mm-h">{!view.ocean.isSpotLoaded(s.id) ? 'loading…' : it?.heightLabel ?? '—'}</span>
      </button>
    );
  };
  return (
    <div className="menu mega" role="dialog" aria-label="Forecast: pages and spots">
      <div className="mm-rail">
        <p className="mm-k">Forecast</p>
        <ul>{def.sections.filter((s) => !s.hidden).map((s) => (
          <li key={s.id}><a {...linkProps((a, sec) => { go(a, sec); close(); }, 'forecast', s.id)} aria-current={current && section === s.id ? 'page' : undefined}>{s.label}</a></li>
        ))}</ul>
        {recent.length > 0 && <><p className="mm-k">Recently viewed</p><div className="mm-list">{recent.map(row)}</div></>}
        {favs.length > 0 && <><p className="mm-k">Favorites</p><div className="mm-list">{favs.slice(0, 5).map(row)}</div></>}
      </div>
      <div className="mm-main">
        <nav className="mm-crumbs" aria-label="Location">
          <button onClick={() => setCounty(null)}>{stateOfZone(zone)}</button><Icon name="chevron" size={12} style={{transform: 'rotate(-90deg)'}} />
          {stateOfZone(zone) !== zone && <><button onClick={() => setCounty(null)}>{zone}</button></>}
          {county && <><Icon name="chevron" size={12} style={{transform: 'rotate(-90deg)'}} /><span>{county}</span></>}
        </nav>
        <div className="mm-cols">
          <div className="mm-col" role="group" aria-label="Region">{zones.map(([z]) => <button key={z} className="mm-opt" aria-pressed={z === zone} onClick={() => { setZone(z); setCounty(null); }}>{z}<Icon name="chevron" size={12} style={{transform: 'rotate(-90deg)'}} /></button>)}</div>
          <div className="mm-col" role="group" aria-label="County">
            <button className="mm-opt" aria-pressed={county === null} onClick={() => setCounty(null)}>All of {zone}</button>
            {counties.map((c) => <button key={c} className="mm-opt" aria-pressed={c === county} onClick={() => setCounty(c)}>{c}</button>)}
          </div>
          <div className="mm-col mm-spots" role="group" aria-label="Spots">{list.map((s) => row(s.id))}</div>
        </div>
        <p className="mm-foot">Now · dot = provisional rating · <button className="mm-link" onClick={() => { go('explore'); close(); }}>Open the map</button></p>
      </div>
    </div>
  );
}

export function SpotPicker() {
  const {spot, spotOptions, setSpot, data, view} = useSwello();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); } };
    addEventListener('pointerdown', close); addEventListener('keydown', esc);
    return () => { removeEventListener('pointerdown', close); removeEventListener('keydown', esc); };
  }, [open]);
  const fav = data.state.favorites;
  const [q, setQ] = useState('');
  const shown = spotOptions.filter((s) => !q || `${s.name} ${s.region}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="spotpick" ref={ref}>
      <button className="spotbtn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <b>{spot.name}</b><small>{spot.region}</small><Icon name="chevron" size={14} />
      </button>
      {open && (
        <ul className="spotlist" role="listbox" aria-label="Choose a spot">
          <li className="spotsearch"><Icon name="search" size={15} /><input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${spotOptions.length} spots…`} aria-label="Search spots" /></li>
          {shown.length === 0 && <li className="fine" style={{padding: '10px 12px'}}>No spot matches “{q}”.</li>}
          {shown.map((s) => {
            const rec = view.mapRecords.find((r) => r.spotId === s.id && r.timestamp === view.selectedTime);
            return (
              <li key={s.id} style={{display: 'flex', alignItems: 'center'}}>
                <button role="option" aria-selected={s.id === spot.id} onClick={() => { setSpot(s.id); setOpen(false); }}>
                  <span className="qdot" style={{background: rec ? BAND_COLOR[band(rec, s)] : 'var(--poor)'}} />
                  <span><b>{s.name}</b><small>{s.region}</small></span>
                  <span>{rec && Number.isFinite(rec.offshore) ? `${ht(rec.offshore, data.state.profile)} ${data.state.profile.heightUnit} Hs` : '—'}</span>
                </button>
                <button className="star" aria-pressed={fav.includes(s.id)} aria-label={`${fav.includes(s.id) ? 'Remove' : 'Add'} ${s.name} ${fav.includes(s.id) ? 'from' : 'to'} favorites`} onClick={() => data.favorite(s.id)}>
                  <Icon name="star" size={16} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function DataBadge() {
  const {view, live, labelZone} = useSwello();
  const o = view.ocean;
  if (!live) return <span className="badge demo"><i /><span className="lbl">Demonstration · not live</span></span>;
  if (o.loading && !o.bundle) return <span className="badge demo"><i /><span className="lbl">Loading forecast…</span></span>;
  if (!o.bundle) return <span className="badge err"><i /><span className="lbl">Forecast unavailable</span></span>;
  const limited = limitedText(o.statuses); // audit F25: names the limited source (a source still loading is not limited)
  // 1A: the badge is in the zone of the spot in view (the viewer's on Home or an unfocused map), and always says which (PST, HST, EST, GMT)
  const zoneTag = () => ` ${zoneAbbr(labelZone, o.bundle!.loadedAt)}`;
  return <span className={`badge${limited ? ' demo' : ''}`} title={o.statuses.filter((s) => s.state !== 'connected').map((s) => `${s.provider}: ${s.state}${s.message ? ` (${s.message})` : ''}`).join('\n') || 'All sources connected'}><i /><span className="lbl">Model data · {timeLabelPT(o.bundle.loadedAt, labelZone)}{zoneTag()}{limited}</span></span>;
}

/** Top bar (Surfline / Apple): wordmark = Home · Forecast · Map · Quiver · search · status · theme · avatar (Personal). Always solid. */
export function TopNav({area, section, go}: {area: Area; section: string; go: Go}) {
  const {data} = useSwello();
  const first = data.state.profile.displayName?.trim().split(/\s+/)[0] || 'You';
  const def = (id: Area) => AREAS.find((a) => a.id === id)!;
  return (
    <header className="topnav">
      <a className="wordmark" aria-label="Swello home" aria-current={area === 'home' ? 'page' : undefined} {...linkProps(go, 'home')}><svg className="wm-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 17c3.5 0 5-2.2 6.4-5.4C10 8 12 5 16 5c3 0 5 2 5 4.6 0 2-1.5 3.4-3.3 3.4-1.5 0-2.6-1-2.6-2.4 0-1 .6-1.8 1.5-2.1" /><path d="M2 20.5c2.2 0 3.6-.8 5-.8s2.8.8 5 .8 3.6-.8 5-.8 2.8.8 5 .8" /></svg>Swello</a>
      <nav aria-label="Primary"><ul className="areas">
        {(['forecast', 'explore', 'quiver'] as const).map((id) => <AreaMenu key={id} def={def(id)} current={id === area} section={section} go={go} />)}
      </ul></nav>
      {/* Map-seamless Stage 6: one search on the map view. The map has its own (flies to the spot), so the header's is not shown there; "/" focuses the map's. */}
      {area === 'explore' && (section === '' || section === 'wind' || section === 'swell') ? <MapSearchKey /> : <Search go={go} />}
      <div className="nav-end">
        <DataBadge /><ThemeToggle />
        <ul className="areas me-menu">
          <AreaMenu def={def('personal')} current={area === 'personal'} section={section} go={go} className="me-area" label={first === 'You' ? 'Personal' : `Personal (${first})`}>
            <span className="me"><i aria-hidden="true">{first[0]?.toUpperCase()}</i><span className="me-name">{first}</span></span>
          </AreaMenu>
        </ul>
      </div>
    </header>
  );
}

/** Flips between dark and light; the full System / Light / Dark choice lives in Personal › Preferences. */
function ThemeToggle() {
  const [pref, setPref] = useThemePref();
  const dark = resolveTheme(pref) === 'dark';
  return <button className="iconbtn" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'} onClick={() => setPref(dark ? 'light' : 'dark')}><Icon name={dark ? 'sun' : 'moon'} size={18} /></button>;
}

/** One search, everywhere (Surfline's overlay): spots grouped by county, each with its condition colour and labelled height.
 *  "/" opens it; arrow keys move; Enter opens the spot's forecast; Escape closes. */
function Search({go}: {go: Go}) {
  const {spotOptions, setSpot, view, now, data} = useSwello();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [at, setAt] = useState(0);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !open && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); setOpen(true); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [open]);
  const info = useMemo(() => new Map(spotStrip(spotOptions, view.mapRecords, spotOptions.map((s) => s.id), now, data.state.profile, {bundle: view.ocean.bundle}).map((x) => [x.id, x])),
    [spotOptions, view.mapRecords, now, data.state.profile]);
  const term = q.trim().toLowerCase();
  const favs = data.state.favorites;
  // §6: the shared matcher (prefix, word starts, region, one typo; accents and apostrophes ignored), favourites and recent picks first among equals;
  // with an empty box, the last 5 picks (this browser only), then the saved spots
  const [recents, setRecents] = useState<string[]>(recentSpots);
  const byId = useMemo(() => new Map(spotOptions.map((s) => [s.id, s] as const)), [spotOptions]);
  const ranked = term ? searchSpots(spotOptions, q, {favorites: favs, recents, limit: 14}) : [];
  const found = term ? ranked.map((h) => byId.get(h.id)!).filter(Boolean) : [...new Set([...recents, ...favs])].map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => !!s).slice(0, 14);
  // One group per county, in first-seen order; the keyboard order follows the groups.
  const byRegion = new Map<string, typeof found>();
  for (const s of found) byRegion.set(s.region, [...(byRegion.get(s.region) ?? []), s]);
  const groups = [...byRegion], hits = groups.flatMap(([, list]) => list);
  const close = () => { setOpen(false); setQ(''); setAt(0); };
  const pick = (id: string) => { setRecents(rememberSpot(id)); setSpot(id); go('forecast'); close(); };
  const ghost = term && at === 0 && hits[0] && ranked[0]?.id === hits[0].id ? completion(q, ranked[0]) : '';
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && hits.length) { e.preventDefault(); setAt((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length); }
    if (e.key === 'Enter' && hits[at]) { e.preventDefault(); pick(hits[at].id); }
  };
  return (
    <div className="search">
      <button className="searchbar" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
        <Icon name="search" size={16} /><span>Search spots</span><kbd aria-hidden="true">/</kbd>
      </button>
      {open && (
        <div className="search-ov" role="dialog" aria-modal="true" aria-label="Search spots" onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div className="search-panel">
            <div className="search-in">
              <Icon name="search" size={18} />
              <AutofillInput autoFocus type="search" value={q} completion={ghost} onAccept={() => setQ(q + ghost)} placeholder={`Search ${spotOptions.length} spots by name or county`} aria-label="Search spots"
                role="combobox" aria-expanded="true" aria-controls="search-results" aria-activedescendant={hits[at] ? `sr-${hits[at].id}` : undefined}
                onChange={(e) => { setQ(e.target.value); setAt(0); }} onKeyDown={onKey} />
              <button className="iconbtn" aria-label="Close search" onClick={close}><Icon name="close" size={18} /></button>
            </div>
            <div id="search-results" role="listbox" aria-label={term ? 'Matching spots' : 'Saved spots'} className="search-res">
              {!term && <p className="search-k">{recents.length ? 'Recent and saved spots' : favs.length ? 'Saved spots' : 'Type a spot or county name'}</p>}
              {/* this search rates the spots for now (the map's search rates its selected hour): say so */}
              {(term ? hits.length > 0 : found.length > 0) && <p className="search-k search-when">Ratings for now</p>}
              {term && hits.length === 0 && <p className="search-k">No spot matches “{q}”.</p>}
              {groups.map(([region, list]) => (
                <div key={region} role="group" aria-label={region}>
                  {term && <p className="search-k">{region}</p>}
                  {list.map((s) => {
                    const it = info.get(s.id), k = hits.indexOf(s);
                    return (
                      <div key={s.id} id={`sr-${s.id}`} role="option" aria-selected={k === at} className="search-hit" onPointerEnter={() => setAt(k)} onClick={() => pick(s.id)}>
                        <i className={`cdot${it?.dark ? ' is-dark' : ''}`} style={{background: BAND_COLOR[it ? bandOfCat(it.category) : 'none']}} aria-hidden="true" />
                        <span><b>{s.name}</b><small>{s.region}</small></span>
                        <small className="search-h">{!view.ocean.isSpotLoaded(s.id) ? 'loading…' : [it?.heightLabel, !it || it.demo || !it.category || it.category === 'UNRATED' ? null : it.dark ? 'After dark' : conditionWord(it.category)].filter(Boolean).join(' · ')}</small>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TabBar({area, go}: {area: Area; go: Go}) {
  return (
    <nav className="tabbar" aria-label="Primary">
      {AREAS.map((def) => (
        <a key={def.id} {...linkProps(go, def.id)} aria-current={def.id === area ? 'page' : undefined}>
          <Icon name={def.id} size={22} /><span>{def.label}</span>
        </a>
      ))}
    </nav>
  );
}

/** On the map view the "/" shortcut focuses the map's own search box (the header search is not shown there). */
function MapSearchKey() {
  useEffect(() => {
    const key = (e: globalThis.KeyboardEvent) => { const t = e.target as HTMLElement; if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) { const i = document.querySelector<HTMLInputElement>(".xtb-search input"); if (i) { e.preventDefault(); i.focus(); } } };
    addEventListener('keydown', key); return () => removeEventListener('keydown', key);
  }, []);
  return <span className="search search-map-gap" aria-hidden="true" />;
}
