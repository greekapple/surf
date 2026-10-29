import {useState, type FormEvent, type KeyboardEvent, type ReactNode} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {allSpots as spots} from '../../data/catalog';
import {evidenceSpots} from '../../ocean/spots';
import {ZONES} from '../../data/zones';
import type {Skill, UserProfile} from '../../models/index';
import {Icon} from '../../ui/Icon';
import {StateMessage} from '../../ui/common';
import {THEME_PREFS, useThemePref, type ThemePref} from '../../ui/theme';
import {timeLabelPT, weekdayPT, dayNumPT} from '../forecast/format';
import {GENERIC_PHOTOS, PHOTOS, SPOT_PHOTOS} from '../../ui/photos';
import './personal.css';

function Choice<T extends string>({label, value, options, onChange}: {label: string; value: T; options: readonly T[]; onChange: (v: T) => void}) {
  return (
    <div className="field pz-choice"><span>{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => <button key={o} role="radio" aria-checked={o === value} onClick={() => onChange(o)}>{o}</button>)}
      </div>
    </div>
  );
}

const NAV = [
  {id: '', label: 'Profile', icon: 'personal'},
  {id: 'spots', label: 'Favorite Spots', icon: 'star'},
  {id: 'preferences', label: 'Preferences', icon: 'layers'},
  {id: 'journal', label: 'Surf Journal', icon: 'waves'},
  {id: 'account', label: 'Account', icon: 'locate'},
] as const;

/** Credited spot photo: spot-specific when one exists, otherwise a generic image labelled as such. */
function SpotCover({spotId, index = 0, className = '', children}: {spotId: string; index?: number; className?: string; children?: ReactNode}) {
  const list = SPOT_PHOTOS[spotId];
  const id = list ? list[0] : GENERIC_PHOTOS[index % GENERIC_PHOTOS.length];
  const ph = PHOTOS[id];
  return (
    <div className={`pz-cover ${className}`} style={{backgroundImage: `url(/photos/${id}-800.jpg)`}}>
      <div className="pz-cover-body">{children}</div>
      <small className="pz-credit">{ph?.generic ? 'Generic photo, not this spot · ' : ''}{ph?.photographer ?? 'Wikimedia Commons'} · {ph?.license}</small>
    </div>
  );
}

export function PersonalView({section, go}: ViewProps) {
  const {data, view, setSpot} = useSwello();
  const [themePref, setThemePref] = useThemePref();
  const [editingProfile, setEditingProfile] = useState(false);
  /** Radiogroup keys: arrows move and select (wrapping), Home/End jump; focus follows the selection. */
  const onThemeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = THEME_PREFS.indexOf(themePref), n = THEME_PREFS.length;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setThemePref(THEME_PREFS[next]);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };
  const p = data.state.profile;
  const set = (patch: Partial<UserProfile>) => data.profile(patch);
  const boards = data.state.boards;
  const [entry, setEntry] = useState({spotId: view.selected, boardId: boards[0]?.id ?? '', notes: '', satisfaction: 3});
  const addSession = (e: FormEvent) => {
    e.preventDefault();
    const session = {id: crypto.randomUUID(), spotId: entry.spotId, timestamp: new Date().toISOString(), boardId: entry.boardId || 'none',
      actualConditions: 'Logged in SWELLO', accuracy: 3, performance: 3, satisfaction: entry.satisfaction, notes: entry.notes.trim() || 'No notes'};
    data.replace({...data.state, sessions: [session, ...data.state.sessions]});
    setEntry({...entry, notes: ''});
  };
  const spotName = (id: string) => spots.find((s) => s.id === id)?.name ?? id;
  const favSpots = data.state.favorites.map((id) => spots.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
  const name = p.displayName?.trim() || 'Your profile';
  const initials = p.displayName?.trim() ? p.displayName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '';
  const boardLine = (b: (typeof boards)[number]) => `${b.type} · ${Math.floor(b.length / 12)}′${Math.round(b.length % 12)}″ · ${b.volume} L${b.demo ? ' · example board' : ''}`;
  const sessionRow = (s: (typeof data.state.sessions)[number]) => (
    <li key={s.id} className="pz-entry">
      <div className="pz-entry-h"><span className="pz-date">{weekdayPT(s.timestamp)} {dayNumPT(s.timestamp)} · {timeLabelPT(s.timestamp)}</span>
        <span className="pz-dots" role="img" aria-label={`${s.satisfaction} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= s.satisfaction ? 'on' : ''} />)}</span></div>
      <h3>{spotName(s.spotId)}</h3>
      <p>{s.notes}</p>
      <span className="fine">{boards.find((b) => b.id === s.boardId)?.name ?? 'No board'}</span>
    </li>
  );
  const spotCard = (s: (typeof spots)[number], i: number, actions: boolean) => {
    const live = evidenceSpots.some((e) => e.id === s.id), fav = data.state.favorites.includes(s.id);
    const canForecast = live || view.dataMode === 'Demonstration';
    return (
      <li key={s.id} className="pz-spot">
        <SpotCover spotId={s.id} index={i}>
          <button className="star pz-star" aria-pressed={fav} aria-label={`${fav ? 'Remove' : 'Save'} ${s.name}`} onClick={() => data.favorite(s.id)}><Icon name="star" size={20} /></button>
          <h3>{s.name}</h3>
          <span>{s.region}</span>
        </SpotCover>
        {actions && (
          <div className="pz-spot-f">
            {live ? <span className="chip off">Live model data</span> : <span className="chip demo">Demonstration only</span>}
            {canForecast && <button className="btn" onClick={() => { setSpot(s.id); go('forecast'); }}>Forecast</button>}
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="pz">
      <nav className="pz-side" aria-label="Personal sections">
        {NAV.map((n) => (
          <button key={n.id} aria-current={section === n.id ? 'page' : undefined} onClick={() => go('personal', n.id)}>
            <Icon name={n.icon} size={18} /><span>{n.label}</span>
          </button>
        ))}
        <p className="fine pz-side-note">Everything here is stored on this device only.</p>
      </nav>

      <div className="pz-main">
        {section === '' && (
          <>
            <header className="pz-head">
              <div className="pz-avatar" aria-hidden="true">{initials || <Icon name="personal" size={34} />}</div>
              <div className="pz-id">
                <h1>{name}</h1>
                <p>{p.region}</p>
                <p className="fine">{p.skill} · {p.minWave}–{p.maxWave} ft preferred · {p.heightUnit}, {p.windUnit}</p>
              </div>
              <button className="btn" aria-expanded={editingProfile} onClick={() => setEditingProfile((v) => !v)}><Icon name="edit" size={16} />{editingProfile ? 'Done' : 'Edit profile'}</button>
            </header>
            {editingProfile && (
              <section className="pz-card" aria-labelledby="pf">
                <h2 id="pf">Edit profile</h2>
                <div className="form-grid">
                  <label className="field"><span>Display name</span>
                    <input value={p.displayName ?? ''} maxLength={40} onChange={(e) => set({displayName: e.target.value})} placeholder="Optional" />
                  </label>
                  <label className="field"><span>Home region</span>
                    <select value={p.region} onChange={(e) => set({region: e.target.value})}>
                      <option value="All regions">Not set (use my location)</option>
                      {ZONES.map(([z, counties]) => <optgroup key={z} label={z}>{counties.filter((c) => spots.some((x) => x.region === c)).map((c) => <option key={c} value={c}>{c}</option>)}</optgroup>)}
                    </select>
                  </label>
                </div>
                <div style={{marginTop: 14, display: 'grid', gap: 14}}>
                  <Choice<Skill> label="Surfing ability" value={p.skill} options={['Beginner', 'Intermediate', 'Expert']} onChange={(skill) => set({skill})} />
                  <p className="fine">Ability shapes Board Match and spot suitability. It is never a safety rating.</p>
                </div>
              </section>
            )}
            <section aria-labelledby="pfs">
              <div className="pz-sh"><h2 id="pfs">Favorite spots</h2><button className="btn" onClick={() => go('personal', 'spots')}>Manage spots</button></div>
              {favSpots.length ? <ul className="pz-spots">{favSpots.slice(0, 3).map((s, i) => spotCard(s, i, false))}</ul>
                : <StateMessage title="No favorite spots yet">Star a spot to keep it on Home.</StateMessage>}
            </section>
            <section aria-labelledby="pbs">
              <div className="pz-sh"><h2 id="pbs">Saved boards</h2><button className="btn" onClick={() => go('quiver')}>Open Quiver</button></div>
              {boards.length ? <ul className="pz-boards">{boards.slice(0, 6).map((b) => <li key={b.id}><b>{b.name}</b><span className="fine">{boardLine(b)}</span></li>)}</ul>
                : <StateMessage title="No boards yet">Add boards in Quiver to get Board Match.</StateMessage>}
            </section>
            <section aria-labelledby="prs">
              <div className="pz-sh"><h2 id="prs">Recent sessions</h2><button className="btn" onClick={() => go('personal', 'journal')}>View journal</button></div>
              {data.state.sessions.length ? <ul className="pz-entries">{data.state.sessions.slice(0, 3).map(sessionRow)}</ul> : <StateMessage title="No sessions logged yet" />}
            </section>
          </>
        )}

        {section === 'spots' && (
          <section aria-labelledby="ss">
            <div className="pz-sh"><div><h1 id="ss">Favorite spots</h1><p className="fine">Star a spot to keep it on Home. {data.state.favorites.length} saved.</p></div></div>
            <ul className="pz-spots pz-spots-all">{spots.map((s, i) => spotCard(s, i, true))}</ul>
          </section>
        )}

        {section === 'preferences' && (
          <section aria-labelledby="pr">
            <div className="pz-sh"><div><h1 id="pr">Preferences</h1><p className="fine">Applied everywhere immediately.</p></div></div>
            <div className="pz-cards">
              <div className="pz-card"><h2>Units</h2>
                <Choice label="Heights" value={p.heightUnit} options={['ft', 'm'] as const} onChange={(heightUnit) => set({heightUnit})} />
                <Choice label="Wind" value={p.windUnit} options={['mph', 'kn', 'km/h'] as const} onChange={(windUnit) => set({windUnit})} />
                <Choice label="Breaking-wave scale" value={p.scale} options={['Face height', 'Hawaiian'] as const} onChange={(scale) => set({scale})} />
              </div>
              <div className="pz-card"><h2>Preferred conditions</h2>
                <label className="field"><span>Wave range (face, ft)</span>
                  <span style={{display: 'flex', gap: 8}}>
                    <input type="number" min={1} max={30} value={p.minWave} onChange={(e) => set({minWave: Number(e.target.value)})} aria-label="Minimum" />
                    <input type="number" min={1} max={40} value={p.maxWave} onChange={(e) => set({maxWave: Number(e.target.value)})} aria-label="Maximum" />
                  </span>
                </label>
                <Choice<Skill> label="Surfing ability" value={p.skill} options={['Beginner', 'Intermediate', 'Expert']} onChange={(skill) => set({skill})} />
              </div>
              <div className="pz-card"><h2>Display and data</h2>
                <div className="field pz-choice"><span aria-hidden="true">Appearance</span>
                  <div className="seg" role="radiogroup" aria-label="Appearance" onKeyDown={onThemeKey}>
                    {THEME_PREFS.map((t: ThemePref) => <button key={t} role="radio" aria-checked={t === themePref} tabIndex={t === themePref ? 0 : -1} onClick={() => setThemePref(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
                  </div>
                </div>
                <Choice label="Data source" value={view.dataMode} options={['Retrieved', 'Demonstration'] as const} onChange={view.setDataMode} />
              </div>
            </div>
            <p className="fine" style={{marginTop: 12}}>Hawaiian scale applies only to breaking-wave (face) heights. These spots have no supported face estimate, so offshore heights are never converted. Demonstration is a fixed illustrative week and is never mixed with live data.</p>
          </section>
        )}

        {section === 'journal' && (
          <section aria-labelledby="jr">
            <div className="pz-sh"><div><h1 id="jr">Surf journal</h1><p className="fine">{data.state.sessions.length} sessions · on this device</p></div></div>
            <div className="pz-journal">
              <form onSubmit={addSession} className="pz-card pz-form" aria-label="Log a session">
                <h2>Log a session</h2>
                <label className="field"><span>Spot</span><select value={entry.spotId} onChange={(e) => setEntry({...entry, spotId: e.target.value})}>{spots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
                <label className="field"><span>Board</span><select value={entry.boardId} onChange={(e) => setEntry({...entry, boardId: e.target.value})}><option value="">No board</option>{boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
                <label className="field"><span>How was it? {entry.satisfaction}/5</span><input type="range" min={1} max={5} value={entry.satisfaction} onChange={(e) => setEntry({...entry, satisfaction: Number(e.target.value)})} /></label>
                <label className="field"><span>Notes</span><textarea value={entry.notes} maxLength={500} onChange={(e) => setEntry({...entry, notes: e.target.value})} placeholder="Crowd, banks, what worked…" /></label>
                <button className="btn primary" type="submit"><Icon name="plus" size={16} />Log session</button>
              </form>
              {data.state.sessions.length ? <ul className="pz-entries">{data.state.sessions.slice(0, 20).map(sessionRow)}</ul> : <StateMessage title="No sessions logged yet" />}
            </div>
          </section>
        )}

        {section === 'account' && (
          <section aria-labelledby="ac">
            <div className="pz-sh"><div><h1 id="ac">Account</h1></div><span className="chip">Local only</span></div>
            <div className="pz-card">
              <h2>Storage and backup</h2>
              <p>There is no SWELLO account yet. Your profile, boards, favourites and journal live in this browser's storage and are not synced to other devices.</p>
              {data.error && <p className="fine" style={{color: 'var(--warn)'}}>{data.error}</p>}
              <div style={{display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap', alignItems: 'center'}}>
                <button className="btn" onClick={data.exportData}>Export backup (JSON)</button>
                {data.lastSaved && <span className="fine">Last saved {timeLabelPT(data.lastSaved)}</span>}
              </div>
              <dl className="kv" style={{marginTop: 16}}>
                <dt>Boards</dt><dd>{boards.length}</dd><dt>Favorite spots</dt><dd>{data.state.favorites.length}</dd><dt>Journal sessions</dt><dd>{data.state.sessions.length}</dd>
              </dl>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
