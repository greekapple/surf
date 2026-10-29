import {useState, type FormEvent, type KeyboardEvent} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {spots} from '../../data/demo';
import {evidenceSpots} from '../../ocean/spots';
import type {Skill, UserProfile} from '../../models/index';
import {Icon} from '../../ui/Icon';
import {StateMessage} from '../../ui/common';
import {THEME_PREFS, useThemePref, type ThemePref} from '../../ui/theme';
import {timeLabelPT, weekdayPT, dayNumPT} from '../forecast/format';

function Choice<T extends string>({label, value, options, onChange}: {label: string; value: T; options: readonly T[]; onChange: (v: T) => void}) {
  return (
    <div className="field"><span>{label}</span>
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => <button key={o} role="radio" aria-checked={o === value} onClick={() => onChange(o)}>{o}</button>)}
      </div>
    </div>
  );
}

export function PersonalView({section, go}: ViewProps) {
  const {data, view, setSpot} = useSwello();
  const [themePref, setThemePref] = useThemePref();
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

  return (
    <div className="grid">
      {(section === '' || section === 'profile') && (
        <section className="card span-7" aria-labelledby="pf">
          <div className="card-h"><h2 id="pf">Profile</h2><span>Stored on this device only</span></div>
          <div className="form-grid">
            <label className="field"><span>Display name</span>
              <input value={p.displayName ?? ''} maxLength={40} onChange={(e) => set({displayName: e.target.value})} placeholder="Optional" />
            </label>
            <label className="field"><span>Home region</span>
              <input value={p.region} onChange={(e) => set({region: e.target.value})} />
            </label>
          </div>
          <div style={{marginTop: 14, display: 'grid', gap: 14}}>
            <Choice<Skill> label="Surfing ability" value={p.skill} options={['Beginner', 'Intermediate', 'Expert']} onChange={(skill) => set({skill})} />
            <p className="fine">Ability shapes Board Match and spot suitability. It is never a safety rating.</p>
          </div>
        </section>
      )}

      {(section === '' || section === 'profile') && (
        <section className="card span-5" aria-labelledby="sb">
          <div className="card-h"><h2 id="sb">Saved boards</h2><button className="btn" onClick={() => go('quiver')}>Open Quiver</button></div>
          {boards.length ? (
            <ul className="journal">{boards.slice(0, 6).map((b) => <li key={b.id}><b>{b.name}</b><span className="fine">{b.type} · {Math.floor(b.length / 12)}′{Math.round(b.length % 12)}″ · {b.volume} L{b.demo ? ' · example board' : ''}</span></li>)}</ul>
          ) : <StateMessage title="No boards yet">Add boards in Quiver to get Board Match.</StateMessage>}
        </section>
      )}

      {(section === '' || section === 'spots') && (
        <section className="card span-12" aria-labelledby="ss">
          <div className="card-h"><h2 id="ss">Saved spots</h2><span>Star a spot to keep it on Home</span></div>
          <div className="tscroll" role="region" tabIndex={0} aria-label="Saved spots (scrolls sideways)"><table className="cmp"><thead><tr><th>Spot</th><th>Region</th><th>Live forecast</th><th>Saved</th><th /></tr></thead>
            <tbody>{spots.map((s) => {
              const live = evidenceSpots.some((e) => e.id === s.id), fav = data.state.favorites.includes(s.id);
              return (
                <tr key={s.id}><td>{s.name}</td><td className="fine">{s.region}</td><td>{live ? <span className="chip off">Live model data</span> : <span className="chip demo">Demonstration only</span>}</td>
                  <td><button className="star" aria-pressed={fav} aria-label={`${fav ? 'Remove' : 'Save'} ${s.name}`} onClick={() => data.favorite(s.id)}><Icon name="star" size={16} /></button></td>
                  <td>{(live || view.dataMode === 'Demonstration') && <button onClick={() => { setSpot(s.id); go('forecast'); }}>Forecast</button>}</td></tr>
              );
            })}</tbody></table></div>
        </section>
      )}

      {(section === '' || section === 'preferences') && (
        <section className="card span-12" aria-labelledby="pr">
          <div className="card-h"><h2 id="pr">Preferences</h2><span>Applied everywhere immediately</span></div>
          <div className="form-grid" style={{alignItems: 'end'}}>
            <Choice label="Heights" value={p.heightUnit} options={['ft', 'm'] as const} onChange={(heightUnit) => set({heightUnit})} />
            <Choice label="Wind" value={p.windUnit} options={['mph', 'kn', 'km/h'] as const} onChange={(windUnit) => set({windUnit})} />
            <Choice label="Breaking-wave scale" value={p.scale} options={['Face height', 'Hawaiian'] as const} onChange={(scale) => set({scale})} />
            <div className="field"><span aria-hidden="true">Appearance</span>
              <div className="seg" role="radiogroup" aria-label="Appearance" onKeyDown={onThemeKey}>
                {THEME_PREFS.map((t: ThemePref) => <button key={t} role="radio" aria-checked={t === themePref} tabIndex={t === themePref ? 0 : -1} onClick={() => setThemePref(t)}>{t[0].toUpperCase() + t.slice(1)}</button>)}
              </div>
            </div>
            <Choice label="Data source" value={view.dataMode} options={['Retrieved', 'Demonstration'] as const} onChange={view.setDataMode} />
            <label className="field"><span>Preferred wave range (face, ft)</span>
              <span style={{display: 'flex', gap: 8}}>
                <input type="number" min={1} max={30} value={p.minWave} onChange={(e) => set({minWave: Number(e.target.value)})} aria-label="Minimum" />
                <input type="number" min={1} max={40} value={p.maxWave} onChange={(e) => set({maxWave: Number(e.target.value)})} aria-label="Maximum" />
              </span>
            </label>
          </div>
          <p className="fine" style={{marginTop: 10}}>Hawaiian scale applies only to breaking-wave (face) heights. These spots have no supported face estimate, so offshore heights are never converted. Demonstration is a fixed illustrative week and is never mixed with live data.</p>
        </section>
      )}

      {(section === '' || section === 'journal') && (
        <section className="card span-12" aria-labelledby="jr">
          <div className="card-h"><h2 id="jr">Surf journal</h2><span>{data.state.sessions.length} sessions · on this device</span></div>
          <form onSubmit={addSession} className="form-grid" style={{alignItems: 'end', marginBottom: 12}}>
            <label className="field"><span>Spot</span><select value={entry.spotId} onChange={(e) => setEntry({...entry, spotId: e.target.value})}>{spots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
            <label className="field"><span>Board</span><select value={entry.boardId} onChange={(e) => setEntry({...entry, boardId: e.target.value})}><option value="">No board</option>{boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label className="field"><span>How was it? {entry.satisfaction}/5</span><input type="range" min={1} max={5} value={entry.satisfaction} onChange={(e) => setEntry({...entry, satisfaction: Number(e.target.value)})} /></label>
            <label className="field" style={{gridColumn: '1 / -1'}}><span>Notes</span><textarea value={entry.notes} maxLength={500} onChange={(e) => setEntry({...entry, notes: e.target.value})} placeholder="Crowd, banks, what worked…" /></label>
            <button className="btn primary" type="submit"><Icon name="plus" size={16} />Log session</button>
          </form>
          {data.state.sessions.length ? (
            <ul className="journal">{data.state.sessions.slice(0, 20).map((s) => (
              <li key={s.id}><b>{spotName(s.spotId)} · {weekdayPT(s.timestamp)} {dayNumPT(s.timestamp)}, {timeLabelPT(s.timestamp)}</b>
                <span className="fine">{boards.find((b) => b.id === s.boardId)?.name ?? 'No board'} · {s.satisfaction}/5</span><span>{s.notes}</span></li>
            ))}</ul>
          ) : <StateMessage title="No sessions logged yet" />}
        </section>
      )}

      {(section === '' || section === 'account') && (
        <section className="card span-12" aria-labelledby="ac">
          <div className="card-h"><h2 id="ac">Account</h2><span className="chip">Local only</span></div>
          <p>There is no SWELLO account yet. Your profile, boards, favourites and journal live in this browser's storage and are not synced to other devices.</p>
          {data.error && <p className="fine" style={{color: 'var(--warn)'}}>{data.error}</p>}
          <div style={{display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap'}}>
            <button className="btn" onClick={data.exportData}>Export backup (JSON)</button>
            {data.lastSaved && <span className="fine" style={{alignSelf: 'center'}}>Last saved {timeLabelPT(data.lastSaved)}</span>}
          </div>
        </section>
      )}
    </div>
  );
}
