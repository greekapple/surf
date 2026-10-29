import {useEffect, useRef, useState, type KeyboardEvent, type MouseEvent} from 'react';
import {AREAS, pathFor, type Area} from './routes';
import {useSwello} from './store';
import {Icon} from '../ui/Icon';
import {BAND_COLOR, band} from '../features/forecast/model';
import {timeLabelPT} from '../features/forecast/format';
import {ht} from '../features/forecast/helpers';
import {resolveTheme, useThemePref} from '../ui/theme';

type Go = (area: Area, section?: string) => void;
const linkProps = (go: Go, area: Area, section = '') => ({
  href: pathFor(area, section),
  onClick: (e: MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    go(area, section);
  },
});

function AreaMenu({def, current, section, go}: {def: (typeof AREAS)[number]; current: boolean; section: string; go: Go}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);
  const timer = useRef(0);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    addEventListener('pointerdown', close);
    return () => removeEventListener('pointerdown', close);
  }, [open]);
  const items = () => Array.from(ref.current?.querySelectorAll<HTMLAnchorElement>('.menu a') ?? []);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) { setOpen(true); requestAnimationFrame(() => items()[0]?.focus()); return; }
      const list = items(), i = list.indexOf(document.activeElement as HTMLAnchorElement);
      list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
    }
  };
  return (
    <li ref={ref} className={`area${open ? ' open' : ''}`} onKeyDown={onKey}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') { clearTimeout(timer.current); setOpen(true); } }}
      onPointerLeave={(e) => { if (e.pointerType === 'mouse') timer.current = window.setTimeout(() => setOpen(false), 160); }}>
      <button aria-current={current ? 'page' : undefined} aria-expanded={open} aria-haspopup="true"
        onClick={() => setOpen(true)}>
        {def.label}<Icon name="chevron" size={14} />
      </button>
      {open && def.id === 'forecast' && <SpotMegaMenu section={section} current={current} go={go} close={() => setOpen(false)} />}
      {open && def.id !== 'forecast' && (
        <ul className="menu" aria-label={`${def.label} sections`}>
          {def.sections.map((s) => (
            <li key={s.id}>
              <a {...linkProps((a, sec) => { go(a, sec); setOpen(false); }, def.id, s.id)} aria-current={current && section === s.id ? 'page' : undefined} title={s.hint}>
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

/** Coast zones, north to south, for browsing spots by place (Region › County › Spot). */
const ZONES: [string, string[]][] = [
  ['North Coast', ['Del Norte', 'Humboldt', 'Mendocino', 'Sonoma']],
  ['Bay Area', ['Marin', 'San Francisco', 'San Mateo']],
  ['Santa Cruz & Monterey', ['Santa Cruz', 'Monterey', 'Big Sur']],
  ['Central Coast', ['San Luis Obispo', 'Santa Barbara', 'Ventura']],
  ['Southern California', ['Los Angeles', 'Orange County', 'San Diego']],
];
const zoneOf = (region: string) => ZONES.find(([, rs]) => rs.includes(region))?.[0] ?? 'Other';
const RECENT_KEY = 'swello-recent';
const readRecent = (): string[] => { try { const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 5) : []; } catch { return []; } };
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
  const {spot, spotOptions, setSpot, data, view} = useSwello();
  const recent = useRecentSpots(spot.id);
  const [zone, setZone] = useState(() => zoneOf(spot.region));
  const [county, setCounty] = useState<string | null>(null);
  const p = data.state.profile, favs = data.state.favorites;
  const zones = ZONES.filter(([, rs]) => spotOptions.some((s) => rs.includes(s.region)));
  const counties = (ZONES.find(([z]) => z === zone)?.[1] ?? []).filter((c) => spotOptions.some((s) => s.region === c));
  const list = spotOptions.filter((s) => zoneOf(s.region) === zone && (!county || s.region === county));
  const pick = (id: string) => { setSpot(id); go('forecast'); close(); };
  const def = AREAS.find((a) => a.id === 'forecast')!;
  const row = (id: string) => {
    const s = spotOptions.find((x) => x.id === id);
    if (!s) return null;
    const rec = view.mapRecords.find((r) => r.spotId === s.id && r.timestamp === view.selectedTime);
    return (
      <button key={s.id} className="mm-spot" aria-current={s.id === spot.id} onClick={() => pick(s.id)}>
        <span className="qdot" style={{background: rec ? BAND_COLOR[band(rec, s)] : 'var(--none)'}} />
        <span className="mm-n">{s.name}<small>{s.region}</small></span>
        <span className="mm-h">{rec && Number.isFinite(rec.offshore) ? `${ht(rec.offshore, p)} ${p.heightUnit}` : '—'}</span>
      </button>
    );
  };
  return (
    <div className="menu mega" role="dialog" aria-label="Forecast: pages and spots">
      <div className="mm-rail">
        <p className="mm-k">Forecast</p>
        <ul>{def.sections.map((s) => (
          <li key={s.id}><a {...linkProps((a, sec) => { go(a, sec); close(); }, 'forecast', s.id)} aria-current={current && section === s.id ? 'page' : undefined}>{s.label}</a></li>
        ))}</ul>
        {recent.length > 0 && <><p className="mm-k">Recently viewed</p><div className="mm-list">{recent.map(row)}</div></>}
        {favs.length > 0 && <><p className="mm-k">Favourites</p><div className="mm-list">{favs.slice(0, 5).map(row)}</div></>}
      </div>
      <div className="mm-main">
        <nav className="mm-crumbs" aria-label="Location">
          <button onClick={() => setCounty(null)}>California</button><Icon name="chevron" size={12} style={{transform: 'rotate(-90deg)'}} />
          <button onClick={() => setCounty(null)}>{zone}</button>
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
        <p className="mm-foot">Offshore height at {view.selectedTime ? timeLabelPT(view.selectedTime) : '—'} · dot = provisional rating · <button className="mm-link" onClick={() => { go('explore'); close(); }}>Open the map</button></p>
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
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
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
                <button className="star" aria-pressed={fav.includes(s.id)} aria-label={`${fav.includes(s.id) ? 'Remove' : 'Add'} ${s.name} ${fav.includes(s.id) ? 'from' : 'to'} favourites`} onClick={() => data.favorite(s.id)}>
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
  const {view, live} = useSwello();
  const o = view.ocean;
  if (!live) return <span className="badge demo"><i /><span className="lbl">Demonstration · not live</span></span>;
  if (o.loading && !o.bundle) return <span className="badge demo"><i /><span className="lbl">Loading forecast…</span></span>;
  if (!o.bundle) return <span className="badge err"><i /><span className="lbl">Forecast unavailable</span></span>;
  const limited = o.statuses.some((s) => s.state !== 'connected');
  return <span className={`badge${limited ? ' demo' : ''}`} title={o.statuses.map((s) => `${s.provider}: ${s.state}`).join('\n')}><i /><span className="lbl">Model data · {timeLabelPT(o.bundle.loadedAt)}{limited ? ' · some sources limited' : ''}</span></span>;
}

export function TopNav({area, section, go}: {area: Area; section: string; go: Go}) {
  return (
    <header className="topnav">
      <a className="wordmark" aria-label="Swello home" {...linkProps(go, 'home')}>Swello</a>
      <nav aria-label="Primary"><ul className="areas">
        {AREAS.map((def) => <AreaMenu key={def.id} def={def} current={def.id === area} section={section} go={go} />)}
      </ul></nav>
      <div className="nav-end"><DataBadge /><SpotPicker /><ThemeToggle /><Me go={go} /></div>
    </header>
  );
}

/** Flips between dark and light; the full System / Light / Dark choice lives in Personal › Preferences. */
function ThemeToggle() {
  const [pref, setPref] = useThemePref();
  const dark = resolveTheme(pref) === 'dark';
  return <button className="iconbtn" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} title={dark ? 'Light theme' : 'Dark theme'} onClick={() => setPref(dark ? 'light' : 'dark')}><Icon name={dark ? 'sun' : 'moon'} size={18} /></button>;
}

function Me({go}: {go: Go}) {
  const {data} = useSwello();
  const first = data.state.profile.displayName?.trim().split(/\s+/)[0] || 'You';
  return <a className="me" aria-label={`${first}: profile`} {...linkProps(go, 'personal')}><i aria-hidden="true">{first[0]?.toUpperCase()}</i><span className="me-name">{first}</span></a>;
}

export function SubNav({area, section, go}: {area: Area; section: string; go: Go}) {
  const def = AREAS.find((a) => a.id === area)!;
  return (
    <nav className="subnav" aria-label={`${def.label} sections`}>
      {def.sections.map((s) => <a key={s.id} {...linkProps(go, area, s.id)} aria-current={s.id === section ? 'page' : undefined}>{s.label}</a>)}
    </nav>
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
