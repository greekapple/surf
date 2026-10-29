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
      {open && (
        <ul className="menu" aria-label={`${def.label} sections`}>
          {def.sections.map((s) => (
            <li key={s.id}>
              <a {...linkProps((a, sec) => { go(a, sec); setOpen(false); }, def.id, s.id)} aria-current={current && section === s.id ? 'page' : undefined}>
                <b>{s.label}</b><span>{s.hint}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </li>
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
  return (
    <div className="spotpick" ref={ref}>
      <button className="spotbtn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <b>{spot.name}</b><small>{spot.region}</small><Icon name="chevron" size={14} />
      </button>
      {open && (
        <ul className="spotlist" role="listbox" aria-label="Choose a spot">
          {spotOptions.map((s) => {
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
