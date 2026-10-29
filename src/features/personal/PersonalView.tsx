import {useEffect, useMemo, useRef, useState, type KeyboardEvent} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {allSpots as spots} from '../../data/catalog';
import {evidenceSpots} from '../../ocean/spots';
import {ZONES} from '../../data/zones';
import type {Forecast, Skill, UserProfile} from '../../models/index';
import {StateMessage} from '../../ui/common';
import {THEME_PREFS, useThemePref, type ThemePref} from '../../ui/theme';
import {timeLabelPT} from '../forecast/format';
import {heroHeight} from '../forecast/model';
import {rateForecast} from '../../ratings/adapters';
import {compass, heightValue, lengthLabel} from '../../utils/units';
import {BoardOutline} from '../quiver/BoardOutline';
import {PHOTOS} from '../../ui/photos';
import {PIcon, type PName} from './icons';
import {Choice, SpotCover, entryImage, creditText} from './parts';
import {AlertsCard, AlertsManager} from './AlertsPanels';
import {JournalColumn, JournalList, LogForm, type LogInput} from './JournalPanels';
import {evaluateRule, loadRules, saveRules, type AlertRule} from './alerts';
import {AVATAR_KEY, COMPASS8, downscale, loadBoardPrefs, loadExtras, saveBoardPrefs, saveExtras, tideSummary, type BoardPrefs, type JournalExtras} from './journal';
import {pickBoard} from './recommend';
import './personal.css';

const NAV: {id: string; label: string; icon: PName; hash?: string}[] = [
  {id: '', label: 'Profile', icon: 'user'},
  {id: 'spots', label: 'Favorite Spots', icon: 'pin'},
  {id: 'preferences', label: 'Board Preferences', icon: 'board'},
  {id: 'journal', label: 'Surf Journal', icon: 'journal'},
  {id: '', label: 'Alerts', icon: 'bell', hash: '#alerts'},
  {id: 'account', label: 'Account', icon: 'account'},
];

function loadAvatar() { try { return localStorage.getItem(AVATAR_KEY) ?? ''; } catch { return ''; } }
const rangeText = (a: number, b: number, p: UserProfile) => `${Math.round(heightValue(a, p))}–${Math.round(heightValue(b, p))} ${p.heightUnit}`;

export function PersonalView({section, go}: ViewProps) {
  const {data, view, setSpot, now, spotOptions} = useSwello();
  const [themePref, setThemePref] = useThemePref();
  const [editingProfile, setEditingProfile] = useState(false);
  const [hash, setHash] = useState(() => location.hash);
  const [rules, setRulesState] = useState<AlertRule[]>(loadRules);
  const [extras, setExtras] = useState<JournalExtras>(loadExtras);
  const [prefs, setPrefsState] = useState<BoardPrefs>(loadBoardPrefs);
  const [avatar, setAvatar] = useState(loadAvatar);
  const [note, setNote] = useState('');
  const avatarRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const on = () => setHash(location.hash);
    addEventListener('hashchange', on); addEventListener('popstate', on);
    return () => { removeEventListener('hashchange', on); removeEventListener('popstate', on); };
  }, []);

  const p = data.state.profile;
  const set = (patch: Partial<UserProfile>) => data.profile(patch);
  const boards = data.state.boards;
  const alertsPage = section === '' && hash === '#alerts';
  const active = alertsPage ? 'alerts' : section;

  const setRules = (next: AlertRule[]) => { setRulesState(next); if (!saveRules(next)) setNote('Alerts could not be saved in this browser.'); };
  const setBoardPrefs = (next: BoardPrefs) => { setPrefsState(next); saveBoardPrefs(next); };
  const spotName = (id: string) => spots.find((s) => s.id === id)?.name ?? id;
  const sessions = useMemo(() => [...data.state.sessions].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)), [data.state.sessions]);
  const results = useMemo(() => rules.map((r) => evaluateRule(r, spots.find((s) => s.id === r.spotId), view.mapRecords, now)), [rules, view.mapRecords, now]);

  /** Nearest forecast hour at or after now for one spot, from the forecast already loaded. */
  const hourFor = (spotId: string): Forecast | undefined => {
    let best: Forecast | undefined;
    for (const f of view.mapRecords) {
      if (f.spotId !== spotId) continue;
      const t = Date.parse(f.timestamp);
      if (t < now - 1800000) continue;
      if (!best || t < Date.parse(best.timestamp)) best = f;
    }
    return best;
  };

  const favSpots = data.state.favorites.map((id) => spots.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
  const name = p.displayName?.trim() || 'Your profile';
  const initials = p.displayName?.trim() ? p.displayName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '';
  const boardTypes = p.preferredBoards.slice(0, 3).map((t) => t.replace(/ shortboard/, '').replace(/^Performance$/, 'Shortboard')).join(', ');
  const onThemeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = THEME_PREFS.indexOf(themePref), n = THEME_PREFS.length;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setThemePref(THEME_PREFS[next]);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };

  const navTo = (n: (typeof NAV)[number]) => {
    const base = location.pathname + location.search;
    if (n.hash) { history.pushState(null, '', base + n.hash); setHash(n.hash); if (section !== '') go('personal', ''); return; }
    if (location.hash) { history.pushState(null, '', base); setHash(''); }
    go('personal', n.id);
  };

  const toggleRule = (id: string, enabled: boolean) => setRules(rules.map((r) => (r.id === id ? {...r, enabled} : r)));
  const openAlerts = () => navTo(NAV[4]);

  const logSession = (v: LogInput) => {
    const f = hourFor(v.spotId), spot = spots.find((s) => s.id === v.spotId);
    const id = crypto.randomUUID();
    const session = {id, spotId: v.spotId, timestamp: new Date().toISOString(), boardId: v.boardId || 'none', actualConditions: 'Logged in SWELLO', accuracy: 3, performance: 3, satisfaction: v.satisfaction, notes: v.notes.trim() || 'No notes'};
    const x: JournalExtras[string] = {};
    if (v.title.trim()) x.title = v.title.trim();
    if (v.tags.length) x.tags = v.tags;
    if (v.photo) x.photo = v.photo;
    if (f && spot) {
      const h = heroHeight(f, p, view.dataMode);
      if (h.number !== '—') x.height = `${h.approx ? '≈ ' : ''}${h.number} ${h.unit}`.trim();
      const cat = rateForecast(spot, f, now).category;
      if (cat && cat !== 'UNRATED') x.cond = cat;
      if (f.availability.swell && Number.isFinite(f.primary.period)) x.swell = `${compass(f.primary.direction)} ${Math.round(f.primary.period)}s`;
    }
    data.replace({...data.state, sessions: [session, ...data.state.sessions]});
    if (Object.keys(x).length) {
      const next = {...extras, [id]: x};
      setExtras(next);
      setNote(saveExtras(next) ? '' : 'The photo and tags could not be saved: browser storage is full.');
    }
  };
  const removeSession = (id: string) => {
    data.replace({...data.state, sessions: data.state.sessions.filter((s) => s.id !== id)});
    const {[id]: _gone, ...rest} = extras;
    setExtras(rest); saveExtras(rest);
  };

  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    const out = await downscale(file, 256, 60 * 1024);
    if (!out) { setNote('That photo could not be read.'); return; }
    setAvatar(out); setNote('');
    try { localStorage.setItem(AVATAR_KEY, out); } catch { setNote('The photo could not be saved in this browser.'); }
  };
  const clearAvatar = () => { setAvatar(''); try { localStorage.removeItem(AVATAR_KEY); } catch { /* ignore */ } if (avatarRef.current) avatarRef.current.value = ''; };

  const spotCard = (s: (typeof spots)[number], i: number, actions: boolean) => {
    const live = evidenceSpots.some((e) => e.id === s.id), fav = data.state.favorites.includes(s.id);
    const canForecast = live || view.dataMode === 'Demonstration';
    const f = live ? hourFor(s.id) : undefined;
    const h = f ? heroHeight(f, p, view.dataMode) : null;
    return (
      <li key={s.id} className="pz-spot">
        <SpotCover spotId={s.id} index={i}>
          <button className="star pz-star" aria-pressed={fav} aria-label={`${fav ? 'Remove' : 'Save'} ${s.name}`} onClick={() => data.favorite(s.id)}><PIcon name="star" size={20} /></button>
          <h3>{s.name}</h3>
          <span>{h && h.number !== '—' ? `${h.approx ? '≈ ' : ''}${h.number} ${h.unit} ${h.note ? 'offshore' : 'face'}` : s.region}</span>
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

  // Recommended board: existing board scoring when a breaking-wave estimate exists, otherwise a labelled heuristic.
  const refSpot = favSpots[0]?.id ?? view.selected;
  const refHour = hourFor(refSpot);
  const pick = pickBoard(boards, refHour, p);
  const boardCard = (
    <section className="pz-panel pz-board" aria-labelledby="pz-bd-h">
      <div className="pz-ph"><h2 id="pz-bd-h">Recommended Board</h2></div>
      {pick.kind === 'empty' && <div className="pz-empty-box"><p className="pz-empty">No boards in your quiver yet.</p><button className="btn" onClick={() => go('quiver')}>Open Quiver</button></div>}
      {pick.kind === 'none' && <div className="pz-empty-box"><p className="pz-empty">Needs a breaking-wave estimate. None of your boards fit your {rangeText(p.minWave, p.maxWave, p)} range either.</p><button className="btn" onClick={() => go('quiver')}>View in Quiver</button></div>}
      {(pick.kind === 'match' || pick.kind === 'heuristic') && (
        <div className="pz-bd">
          <div className="pz-bd-img">{pick.board.photoDataURL ? <img src={pick.board.photoDataURL} alt={`${pick.board.name}`} /> : <BoardOutline b={pick.board} scale={3.2} />}</div>
          <div className="pz-bd-t">
            <b>{pick.board.name}</b>
            <span>{lengthLabel(pick.board.length)} · {pick.board.volume} L</span>
            <p>{pick.kind === 'match'
              ? `${pick.score}/100 match for ${spotName(refSpot)} at ${timeLabelPT(refHour!.timestamp)}.`
              : `Heuristic: this ${pick.board.type.toLowerCase()} suits your ${rangeText(p.minWave, p.maxWave, p)} range. Needs a breaking-wave estimate for a forecast match.`}</p>
          </div>
          <button className="btn pz-bd-btn" onClick={() => go('quiver')}>View in Quiver <PIcon name="arrow" size={14} /></button>
        </div>
      )}
    </section>
  );

  const creditIds = [...new Set([...favSpots.slice(0, 3).map((s, i) => entryImage(undefined, s.id, i).id), ...sessions.slice(0, 4).map((s, i) => entryImage(extras[s.id], s.spotId, i).id)].filter((x): x is string => !!x))];

  return (
    <div className="pz">
      <nav className="pz-side" aria-label="Personal sections">
        {NAV.map((n) => {
          const isActive = n.hash ? active === 'alerts' : active === n.id && !(n.id === '' && alertsPage);
          return <button key={n.label} aria-current={isActive ? 'page' : undefined} onClick={() => navTo(n)}><PIcon name={n.icon} size={18} /><span>{n.label}</span></button>;
        })}
      </nav>

      <div className="pz-body">
        {note && <p className="pz-err" role="alert">{note}</p>}

        {section === '' && !alertsPage && (
          <div className="pz-dash">
            <div className="pz-panel pz-mainp">
              <header className="pz-head">
                <div className="pz-avatar" style={avatar ? {backgroundImage: `url(${avatar})`} : undefined} role={avatar ? 'img' : undefined} aria-label={avatar ? 'Profile photo' : undefined}>{!avatar && (initials || <PIcon name="user" size={36} />)}</div>
                <div className="pz-id">
                  <h1>{name}</h1>
                  {p.region !== 'All regions' && <p>{p.region}, CA</p>}
                  <p className="pz-sub">{[p.skill, `${rangeText(p.minWave, p.maxWave, p)} preferred`, boardTypes].filter(Boolean).join(' · ')}</p>
                </div>
                <button className="btn pz-edit" aria-expanded={editingProfile} onClick={() => setEditingProfile((v) => !v)}>{editingProfile ? 'Done' : 'Edit Profile'}</button>
              </header>
              {editingProfile && (
                <section className="pz-edit-box" aria-labelledby="pf">
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
                    <div className="field"><span>Profile photo (stays on this device)</span>
                      <input ref={avatarRef} type="file" accept="image/*" aria-label="Profile photo" onChange={(e) => void pickAvatar(e.target.files?.[0])} />
                      {avatar && <button type="button" className="btn" onClick={clearAvatar}>Remove photo</button>}
                    </div>
                  </div>
                  <Choice<Skill> label="Surfing ability" value={p.skill} options={['Beginner', 'Intermediate', 'Expert']} onChange={(skill) => set({skill})} />
                  <p className="fine">Ability shapes Board Match and spot suitability. It is never a safety rating.</p>
                </section>
              )}

              <section aria-labelledby="pfs">
                <div className="pz-ph"><h2 id="pfs">Favorite Spots</h2><button className="btn" onClick={() => go('personal', 'spots')}>Manage Spots</button></div>
                {favSpots.length ? <ul className="pz-spots">{favSpots.slice(0, 3).map((s, i) => spotCard(s, i, false))}</ul>
                  : <StateMessage title="No favorite spots yet">Star a spot to keep it on Home.</StateMessage>}
              </section>

              <section aria-labelledby="pbp">
                <div className="pz-ph"><h2 id="pbp">Board Preferences</h2></div>
                <ul className="pz-tiles">
                  <li><button onClick={() => go('personal', 'preferences')}><PIcon name="clock" size={22} /><span><small>Preferred conditions</small><b>{rangeText(p.minWave, p.maxWave, p)}</b><i>{p.skill}{p.style !== 'All-around' ? ` · ${p.style}` : ''}</i></span></button></li>
                  <li><button onClick={() => go('personal', 'preferences')}><PIcon name="swell" size={22} /><span><small>Preferred swell</small><b>{prefs.swellDirs.length ? prefs.swellDirs.join(', ') : 'Not set'}</b><i>{prefs.swellDirs.length ? `${prefs.periodMin}–${prefs.periodMax} seconds` : 'Set on Preferences'}</i></span></button></li>
                  <li><button onClick={() => go('personal', 'preferences')}><PIcon name="tide" size={22} /><span><small>Preferred tide</small><b>{tideSummary(prefs.tides)}</b><i>{prefs.tides.length ? 'All spots' : 'Set on Preferences'}</i></span></button></li>
                </ul>
              </section>

              <section aria-labelledby="prs">
                <div className="pz-ph"><h2 id="prs">Recent Sessions</h2><button className="pz-link" onClick={() => go('personal', 'journal')}>View All <PIcon name="arrow" size={14} /></button></div>
                {sessions.length ? (
                  <ul className="pz-strip">{sessions.slice(0, 4).map((s, i) => {
                    const img = entryImage(extras[s.id], s.spotId, i);
                    return <li key={s.id}><button onClick={() => go('personal', 'journal')} aria-label={`${spotName(s.spotId)}, open journal`} style={{backgroundImage: `url(${img.src})`}} title={img.id ? creditText(img.id) : undefined} /></li>;
                  })}</ul>
                ) : <p className="pz-empty">No sessions yet. Log one in your journal and it appears here.</p>}
              </section>
              {creditIds.length > 0 && (
                <details className="pz-credits"><summary>Photo credits</summary>
                  <ul>{creditIds.map((id) => <li key={id}>{PHOTOS[id]?.location ?? id}: {creditText(id)}</li>)}</ul>
                </details>
              )}
            </div>

            <JournalColumn sessions={sessions} extras={extras} spotName={spotName} onAll={() => go('personal', 'journal')} onLog={() => go('personal', 'journal')} />
            <div className="pz-right">
              <AlertsCard rules={rules} results={results} spotName={spotName} p={p} toggle={toggleRule} onEdit={openAlerts} />
              {boardCard}
            </div>
          </div>
        )}

        {alertsPage && (
          <section aria-labelledby="al">
            <div className="pz-ph"><h1 id="al">Alerts</h1></div>
            <AlertsManager rules={rules} results={results} spotName={spotName} p={p} toggle={toggleRule} spots={spotOptions}
              add={(r) => setRules([...rules, {...r, id: crypto.randomUUID()}])} remove={(id) => setRules(rules.filter((r) => r.id !== id))} />
          </section>
        )}

        {section === 'spots' && (
          <section aria-labelledby="ss">
            <div className="pz-ph"><div><h1 id="ss">Favorite Spots</h1><p className="fine">Star a spot to keep it on Home. {data.state.favorites.length} saved.</p></div></div>
            <ul className="pz-spots pz-spots-all">{spots.map((s, i) => spotCard(s, i, true))}</ul>
          </section>
        )}

        {section === 'preferences' && (
          <section aria-labelledby="pr">
            <div className="pz-ph"><div><h1 id="pr">Board Preferences</h1><p className="fine">Applied everywhere immediately.</p></div></div>
            <div className="pz-cards">
              <div className="pz-panel"><h2>Units</h2>
                <Choice label="Heights" value={p.heightUnit} options={['ft', 'm'] as const} onChange={(heightUnit) => set({heightUnit})} />
                <Choice label="Wind" value={p.windUnit} options={['mph', 'kn', 'km/h'] as const} onChange={(windUnit) => set({windUnit})} />
                <Choice label="Breaking-wave scale" value={p.scale} options={['Face height', 'Hawaiian'] as const} onChange={(scale) => set({scale})} />
              </div>
              <div className="pz-panel"><h2>Preferred conditions</h2>
                <label className="field"><span>Wave range (face, ft)</span>
                  <span style={{display: 'flex', gap: 8}}>
                    <input type="number" min={1} max={30} value={p.minWave} onChange={(e) => set({minWave: Number(e.target.value)})} aria-label="Minimum" />
                    <input type="number" min={1} max={40} value={p.maxWave} onChange={(e) => set({maxWave: Number(e.target.value)})} aria-label="Maximum" />
                  </span>
                </label>
                <Choice<Skill> label="Surfing ability" value={p.skill} options={['Beginner', 'Intermediate', 'Expert']} onChange={(skill) => set({skill})} />
              </div>
              <div className="pz-panel"><h2>Preferred swell and tide</h2>
                <fieldset className="pz-fs"><legend>Swell direction</legend>
                  <div className="pz-chips">{COMPASS8.map((d) => (
                    <label key={d} className="pz-pick"><input type="checkbox" checked={prefs.swellDirs.includes(d)} onChange={(e) => setBoardPrefs({...prefs, swellDirs: e.target.checked ? [...prefs.swellDirs, d] : prefs.swellDirs.filter((x) => x !== d)})} /><span>{d}</span></label>
                  ))}</div>
                </fieldset>
                <label className="field"><span>Period (seconds)</span>
                  <span style={{display: 'flex', gap: 8}}>
                    <input type="number" min={4} max={25} value={prefs.periodMin} onChange={(e) => setBoardPrefs({...prefs, periodMin: Number(e.target.value)})} aria-label="Minimum period" />
                    <input type="number" min={4} max={25} value={prefs.periodMax} onChange={(e) => setBoardPrefs({...prefs, periodMax: Number(e.target.value)})} aria-label="Maximum period" />
                  </span>
                </label>
                <fieldset className="pz-fs"><legend>Tide</legend>
                  <div className="pz-chips">{(['Low', 'Mid', 'High'] as const).map((t) => (
                    <label key={t} className="pz-pick"><input type="checkbox" checked={prefs.tides.includes(t)} onChange={(e) => setBoardPrefs({...prefs, tides: e.target.checked ? [...prefs.tides, t] : prefs.tides.filter((x) => x !== t)})} /><span>{t}</span></label>
                  ))}</div>
                </fieldset>
                <p className="fine">Saved on this device. Shown on your profile; forecasts are not filtered by them.</p>
              </div>
              <div className="pz-panel"><h2>Display and data</h2>
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
            <div className="pz-ph"><div><h1 id="jr">Surf Journal</h1><p className="fine">{sessions.length} sessions · on this device</p></div></div>
            <div className="pz-journal">
              <LogForm spots={spots} boards={boards} defaultSpot={view.selected} onSubmit={logSession} error="" />
              <JournalList sessions={sessions} extras={extras} spotName={spotName} onRemove={removeSession} />
            </div>
          </section>
        )}

        {section === 'account' && (
          <section aria-labelledby="ac">
            <div className="pz-ph"><h1 id="ac">Account</h1><span className="chip">Local only</span></div>
            <div className="pz-panel">
              <h2>Storage and backup</h2>
              <p>There is no SWELLO account yet. Your profile, boards, favourites and journal live in this browser's storage and are not synced to other devices.</p>
              {data.error && <p className="fine" style={{color: 'var(--warn)'}}>{data.error}</p>}
              <div style={{display: 'flex', gap: 12, marginTop: 14, flexWrap: 'wrap', alignItems: 'center'}}>
                <button className="btn" onClick={data.exportData}>Export backup (JSON)</button>
                {data.lastSaved && <span className="fine">Last saved {timeLabelPT(data.lastSaved)}</span>}
              </div>
              <dl className="kv" style={{marginTop: 16}}>
                <dt>Boards</dt><dd>{boards.length}</dd><dt>Favorite spots</dt><dd>{data.state.favorites.length}</dd><dt>Journal sessions</dt><dd>{data.state.sessions.length}</dd><dt>Alerts</dt><dd>{rules.length}</dd>
              </dl>
              <p className="fine">The backup covers profile, boards, favourites and session text. Journal photos, tags, alerts and the profile photo stay in this browser only.</p>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
