import {useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {allSpots as spots} from '../../data/catalog';
import {zoneOf, regionWithState} from '../../data/zones';
import {zonesWithSpots} from '../../ocean/regionGate';
import type {Forecast, SurfSpot, UserProfile} from '../../models/index';
import {StateMessage} from '../../ui/common';
import {SkelInline} from '../../ui/Skeleton';
import {spotPhase} from '../../services/dataPhase';
import {readBasemapPref, saveBasemapPref, type BasemapPref} from '../../map/basemapPref';
import {THEME_PREFS, useThemePref, type ThemePref} from '../../ui/theme';
import {timeLabelPT} from '../forecast/format';
import {heroHeight} from '../forecast/model';
import {spotHourOf} from '../../services/spotHour';
import {isFlat} from '../../services/flatSurf';
import {rateForecast} from '../../ratings/adapters';
import {compass, heightRange} from '../../utils/units';
import {PIcon, type PName} from './icons';
import {Choice, SpotCover, Toggle, entryDate} from './parts';
import {AlertsManager} from './AlertsPanels';
import {parseRestore, type AppState, type RestorePreview} from '../../utils/storage';
import {JournalList, LogForm, type LogInput} from './JournalPanels';
import {SawList} from './SawList';
import {addObservation, checkObservation, downloadText, loadLog, logToCsv, logToJson, removeObservation, saveLog, type ObservationContext} from '../../services/sessionLog';
import {pickMop, nowcastFor} from '../../services/nearshoreSelect';
import {assignmentFor} from '../../ocean/mop';
import {orderSpots, pageWindow, SPOTS_PER_PAGE} from './spotList';
import {headlineSurf} from '../../services/headlineSurf';
import {evaluateRule, loadRules, saveRules, type AlertRule} from './alerts';
import {AVATAR_KEY, COMPASS8, downscale, loadBoardPrefs, loadExtras, saveBoardPrefs, saveExtras, swellSummary, tideSummary, type BoardPrefs, type JournalExtras} from './journal';
import {boardPickFor} from '../quiver/fit';
import {AgeQuestion, HeightField, SexQuestion, Why, LevelPicker, RegionField, SizeField, UnitNumber, UnitsField, VolumeHint, WeightField} from './ProfileFields';
import {deletedProfile, levelSource} from '../../services/profileFields';
import {levelInfo, levelOf} from '../../services/skillLevels';
import {OwnerTools} from './OwnerTools';
import './personal.css';

function loadAvatar() { try { return localStorage.getItem(AVATAR_KEY) ?? ''; } catch { return ''; } }
const rangeText = (a: number, b: number, p: UserProfile) => heightRange(a, b, p); // B12: one decimal in m (2–6 ft is 0.6–1.8 m, not 1–2 m)
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);

/** A grouped list like iOS Settings: a small heading over one rounded card of rows. */
function Group({title, children, note}: {title: string; children: ReactNode; note?: string}) {
  return (
    <section className="pzl-group" aria-label={title}>
      <h2 className="pzl-gh">{title}</h2>
      <ul className="pzl-card">{children}</ul>
      {note && <p className="pzl-note">{note}</p>}
    </section>
  );
}
/** One row: label on the left, current value and a chevron on the right; the whole row opens its page. */
function Row({icon, label, value, onClick, sub}: {icon?: PName; label: string; value?: ReactNode; onClick: () => void; sub?: ReactNode}) {
  return (
    <li>
      <button type="button" className="pzl-row" onClick={onClick}>
        {icon && <span className="pzl-ic"><PIcon name={icon} size={18} /></span>}
        <span className="pzl-t"><b>{label}</b>{sub && <small>{sub}</small>}</span>
        {value && <span className="pzl-v">{value}</span>}
        <PIcon name="next" size={16} className="pzl-chev" />
      </button>
    </li>
  );
}
/** A detail page: back control, title, then its content. */
function Page({title, onBack, children, action}: {title: string; onBack: () => void; children: ReactNode; action?: ReactNode}) {
  return (
    <div className="pzl-page">
      <div className="pzl-bar"><button type="button" className="pzl-back" onClick={onBack} aria-label="Back to Personal"><PIcon name="prev" size={18} />Personal</button>{action}</div>
      <h1 className="pzl-title">{title}</h1>
      {children}
    </div>
  );
}

/** T-108: the stored value stays 'Face height' (saved profiles), but every label in the app says "surf height" (the surfer convention: about the nearshore wave height, as reports quote it), so this setting says it too.
 *  Hawaiian is about half of that and applies to surf-height estimates only. */
const SCALE_NAMES = {'Face height': 'Surf height (as reports quote it)', Hawaiian: 'Hawaiian (about half)'} as const;


export function PersonalView({section, go}: ViewProps) {
  const {data, view, setSpot, now, spotOptions, gate} = useSwello();
  const evidenceSpots = gate.evidence;   // ca-only: the gated list
  const [themePref, setThemePref] = useThemePref();
  const [mapStyle, setMapStyle] = useState<BasemapPref>(() => readBasemapPref());
  // Restore from backup: the file is read and checked first; nothing changes until the person confirms the replace.
  const [restore, setRestore] = useState<{file: string; state: AppState; preview: RestorePreview} | null>(null);
  const [restoreMsg, setRestoreMsg] = useState<{ok: boolean; text: string} | null>(null);
  const pickBackup = async (f: File | undefined, input: HTMLInputElement) => {
    input.value = '';   // the same file can be picked again
    if (!f) return;
    setRestore(null);
    try { const r = parseRestore(await f.text()); setRestore({file: f.name, ...r}); setRestoreMsg(null); }
    catch (e) { setRestoreMsg({ok: false, text: `${f.name} can't be restored. ${e instanceof Error ? e.message : 'The file could not be read.'} Your current data has not been changed.`}); }
  };
  const confirmRestore = () => { if (!restore) return; data.replace(restore.state); setRestoreMsg({ok: true, text: `Restored from ${restore.file}.`}); setRestore(null); };
  const [hash, setHash] = useState(() => location.hash);
  // Favorite spots page: search, region chips, favourites and spots near the selected spot first, and 40 cards at a time (a window, never the whole catalogue in the DOM).
  const [spotQ, setSpotQ] = useState(''), [spotZone, setSpotZone] = useState('All'), [spotPage, setSpotPage] = useState(0);
  const orderedSpots = useMemo(() => orderSpots(spotOptions, evidenceSpots, view.selected, data.state.favorites, spotQ, spotZone), [spotOptions, spotQ, spotZone, view.selected, data.state.favorites]); // eslint-disable-line react-hooks/exhaustive-deps
  const [rules, setRulesState] = useState<AlertRule[]>(loadRules);
  const [extras, setExtras] = useState<JournalExtras>(loadExtras);
  const [prefs, setPrefsState] = useState<BoardPrefs>(loadBoardPrefs);
  const [avatar, setAvatar] = useState(loadAvatar), [confirmDel, setConfirmDel] = useState(false);
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
  const sessionTarget = hash.startsWith('#session-') ? decodeURIComponent(hash.slice(9)) : null;   // a link from "similar forecast to your session": show the whole list and bring that session into view
  useEffect(() => { if (sessionTarget && section === 'account') document.getElementById(`session-${sessionTarget}`)?.scrollIntoView({block: 'center'}); }, [sessionTarget, section]);

  const setRules = (next: AlertRule[]) => { setRulesState(next); if (!saveRules(next)) setNote('Alerts could not be saved in this browser.'); };
  const setBoardPrefs = (next: BoardPrefs) => { setPrefsState(next); saveBoardPrefs(next); };
  const spotName = (id: string) => spots.find((s) => s.id === id)?.name ?? id;
  const sessions = useMemo(() => [...data.state.sessions].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)), [data.state.sessions]);
  const results = useMemo(() => rules.map((r) => evaluateRule(r, spots.find((s) => s.id === r.spotId), view.mapRecords, now)), [rules, view.mapRecords, now]);

  /** Audit A12: a favorite row's height is the same surf estimate as Home and the spot page (spotHourOf), labeled by its kind; never "face". */
  const surfRowText = (spot: SurfSpot, f: Forecast) => {
    const sh = spotHourOf(spot, f, now, p, {bundle: view.ocean.bundle}).surf, k = sh.headline.kind;
    return k === 'official' ? `${sh.value} NWS` : k === 'offshore' ? `${sh.value} offshore` : k === 'demonstration' ? `${sh.value} demo` : k === 'estimate' ? (isFlat(sh.headline) ? sh.value : `${sh.value} est.`) : null;
  };
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

  const favSpots = data.state.favorites.map((id) => spotOptions.find((s) => s.id === id)).filter((s): s is NonNullable<typeof s> => !!s);
  const name = p.displayName?.trim() || 'Your profile';
  const initials = p.displayName?.trim() ? p.displayName.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() : '';
  const onThemeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = THEME_PREFS.indexOf(themePref), n = THEME_PREFS.length;
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? (i + 1) % n : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? (i + n - 1) % n : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setThemePref(THEME_PREFS[next]);
    (e.currentTarget.children[next] as HTMLElement | undefined)?.focus();
  };

/** Back to the list: also leaves the #alerts hash so the list shows. */
  const toList = () => { if (location.hash) { history.pushState(null, '', location.pathname + location.search); setHash(''); } go('personal', ''); };
  const toPage = (id: string) => { if (location.hash) { history.pushState(null, '', location.pathname + location.search); setHash(''); } go('personal', id); };
  const openAlerts = () => { history.pushState(null, '', location.pathname + location.search + '#alerts'); setHash('#alerts'); if (section !== '') go('personal', ''); };
  const toggleRule = (id: string, enabled: boolean) => setRules(rules.map((r) => (r.id === id ? {...r, enabled} : r)));

  const [obsLog, setObsLog] = useState(() => loadLog());
  const [obsError, setObsError] = useState('');
  /** Ground-truth observation (D-3): validated before anything is written; the app's own numbers are stored beside it, never used to change it. */
  const recordObservation = (v: LogInput): boolean => {
    const o = v.observation;
    if (!o) return true;
    const c = checkObservation({spotId: v.spotId, observedAt: o.observedAt, lo: parseFloat(o.lo), hi: parseFloat(o.hi), unit: p.heightUnit === 'm' ? 'm' : 'ft', quality: o.quality, barNote: o.barNote});
    if (!c.ok) { setObsError(c.error); return false; }
    const context: ObservationContext = {}, t = Date.parse(c.value.observedAt), a = assignmentFor(v.spotId), bundle = view.ocean.bundle;
    if (a && bundle) {
      const pick = pickMop(t, now, nowcastFor(a.mopId, bundle.nearshore), bundle.mop?.[a.mopId]?.records);
      if (pick.state === 'ok') context.mop = {mopId: a.mopId, product: pick.product, validAt: pick.record.timestamp, hsFt: pick.record.height.value, tpS: pick.record.period.value, dpDeg: pick.record.direction.value};
    }
    const f = hourFor(v.spotId);
    if (f && Math.abs(Date.parse(f.timestamp) - t) <= 5400000) {
      const spot = spots.find((s) => s.id === v.spotId), h = heroHeight(f, p, view.dataMode);
      if (h.number !== '—') context.heightLabel = `${h.approx ? '≈ ' : ''}${h.number} ${h.unit} (${h.label})`.trim();
      const hs = spot ? headlineSurf(spot.id, f, {bundle: view.ocean.bundle, nowMs: now}) : null; // the headline's own range (T-081), so the stored estimate is what the user saw
      if (hs?.kind === 'estimate') context.estimateRangeFt = [hs.loFt, hs.hiFt];
    }
    const next = addObservation(obsLog, c, context);
    setObsLog(next);
    setObsError(saveLog(next) ? '' : 'Your observation could not be saved: browser storage is full or blocked.');
    return true;
  };
  const logSession = (v: LogInput) => {
    if (!recordObservation(v)) return false;
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
    return true;
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

  const spotCard = (s: (typeof spots)[number], i: number) => {
    const live = evidenceSpots.some((e) => e.id === s.id), fav = data.state.favorites.includes(s.id);
    const canForecast = live || view.dataMode === 'Demonstration';
    const f = live ? hourFor(s.id) : undefined;
    const rowText = f ? surfRowText(s, f) : null;
    return (
      <li key={s.id} className="pz-spot">
        <SpotCover spotId={s.id} index={i}>
          <button className="star pz-star" aria-pressed={fav} aria-label={`${fav ? 'Remove' : 'Save'} ${s.name}`} onClick={() => data.favorite(s.id)}><PIcon name="star" size={20} /></button>
          <h3>{s.name}</h3>
          <span>{rowText ?? s.region}</span>
        </SpotCover>
        <div className="pz-spot-f">
          {live ? <span className="chip off">Live model data</span> : <span className="chip demo">Demonstration only</span>}
          {canForecast && <button className="btn" onClick={() => { setSpot(s.id); go('forecast'); }}>Forecast</button>}
        </div>
      </li>
    );
  };

  // T-099: the recommended board is THE board pick (fit.ts boardPickFor), the same function as Home's quiver pick and Board Match, for the
  // first favourite (else the selected spot) at the next forecast hour; the row names that spot-hour. No preference-range heuristic.
  const refSpot = favSpots[0]?.id ?? view.selected, refHour = hourFor(refSpot), refSpotObj = spots.find((x) => x.id === refSpot);
  const choice = refSpotObj ? boardPickFor(boards, refSpotObj, refHour, now, p, {bundle: view.ocean.bundle}) : null;
  const at = refHour ? `${spotName(refSpot)}, ${timeLabelPT(refHour.timestamp)}` : spotName(refSpot);
  // A6: until that spot's forecast has arrived (or definitely failed) the row shows a skeleton, never "None suits it · No surf estimate".
  const boardPhase = spotPhase(view.ocean, refSpot, view.dataMode === 'Retrieved'), boardPending = boardPhase === 'loading';
  const boardRow: {value: ReactNode; sub?: ReactNode} = !boards.length ? {value: 'No boards yet', sub: 'Add one in the Quiver'}
    : boardPending ? {value: <SkelInline label={`Loading the board pick for ${spotName(refSpot)}`} width="7em" />}
    : boardPhase === 'failed' ? {value: 'No pick', sub: `The forecast for ${spotName(refSpot)} did not load`}
    : choice?.pick ? {value: choice.pick.name, sub: `Board Match pick for ${at}`}
    : choice?.est ? {value: 'None suits it', sub: `No board suits the estimate at ${at}`} : {value: 'No pick', sub: `No surf estimate at ${at}`};
  const activeAlerts = rules.filter((r) => r.enabled).length;

  const body = (() => {
    if (alertsPage) {
      return (
        <Page title="Alerts" onBack={toList}>
          <AlertsManager rules={rules} results={results} spotName={spotName} p={p} toggle={toggleRule} spots={spotOptions}
            add={(r) => setRules([...rules, {...r, id: crypto.randomUUID()}])} remove={(id) => setRules(rules.filter((r) => r.id !== id))} />
        </Page>
      );
    }
    switch (section) {
      case 'profile':
        return (
          <Page title="Profile" onBack={toList}>
            {/* profile-setup: the setup's questions, each with its "Why we ask"; everything stays on this device */}
            <p className="fine">Your answers stay on this device (there are no accounts yet). Each question says what it changes.</p>
            <div className="pz-panel pf-panel">
              <AgeQuestion p={p} set={set} onUnder13={() => setAvatar('')} />
              {p.personalData === false ? <p className="fine" role="status">Under 13: your name, photo, sex, height and weight are not saved on this device. Your level, wave sizes and units still work.</p> : <>
                <label className="field"><span>Display name</span>
                  <input value={p.displayName ?? ''} maxLength={40} onChange={(e) => set({displayName: e.target.value})} placeholder="Optional" />
                  <small className="fine">Shown in Home's greeting, on this device only.</small>
                </label>
                <div className="field"><span>Profile photo (stays on this device)</span>
                  <span className="pz-file-row">
                    <label className="btn pz-file"><input ref={avatarRef} type="file" accept="image/*" aria-label="Profile photo" onChange={(e) => void pickAvatar(e.target.files?.[0])} /><PIcon name="camera" size={16} />{avatar ? 'Change photo' : 'Add photo'}</label>
                    {avatar && <button type="button" className="btn" onClick={clearAvatar}>Remove photo</button>}
                  </span>
                </div>
                <SexQuestion p={p} set={set} />
                <div className="pf-q"><HeightField p={p} set={set} /><Why k="height" /></div>
                <WeightField p={p} set={set} />
              </>}
            </div>
            <div className="pz-panel pf-panel">
              <LevelPicker p={p} set={set} />
              <SizeField p={p} set={set} />
              <VolumeHint p={p} />
              <RegionField p={p} set={set} />
              <UnitsField p={p} set={set} />
            </div>
            <div className="pz-panel pf-panel">
              <h2>Delete my profile</h2>
              <p className="fine">Clears every answer on this page from this device (back to the labelled defaults). Boards, favorite spots and your journal are kept; they have their own controls.</p>
              {!confirmDel ? <button type="button" className="btn" onClick={() => setConfirmDel(true)}>Delete my profile</button>
                : <p className="pf-actions" role="group" aria-label="Confirm delete"><span>Delete every profile answer?</span><button type="button" className="btn danger" onClick={() => { set(deletedProfile()); clearAvatar(); setConfirmDel(false); }}>Yes, delete</button><button type="button" className="btn" onClick={() => setConfirmDel(false)}>Cancel</button></p>}
            </div>
          </Page>
        );
      case 'spots': {
        const {pages, page, from, to} = pageWindow(orderedSpots.length, spotPage), shown = orderedSpots.slice(from, to);
        const pickZone = (z: string) => { setSpotZone(z); setSpotPage(0); };
        return (
          <Page title="Favorite spots" onBack={toList}>
            <p className="fine">Star a spot to keep it on Home. {data.state.favorites.length} saved. Saved spots come first, then the spots nearest {spotName(view.selected)}.</p>
            <input className="pz-spot-search" type="search" value={spotQ} onChange={(e) => { setSpotQ(e.target.value); setSpotPage(0); }} placeholder="Search spots by name or region" aria-label="Search spots" />
            <div className="pz-spot-chips" role="group" aria-label="Region">
              {['All', ...zonesWithSpots(spotOptions)].map((z) => <button key={z} type="button" aria-pressed={spotZone === z} onClick={() => pickZone(z)}>{z}</button>)}
            </div>
            {!orderedSpots.length ? <p className="fine" role="status">No spot matches{spotQ ? ` “${spotQ}”` : ''}{spotZone !== 'All' ? ` in ${spotZone}` : ''}.</p> : <>
              <p className="fine" role="status">Showing {from + 1}–{from + shown.length} of {orderedSpots.length} spots</p>
              <ul className="pz-spots pz-spots-all">{shown.map((s, i) => spotCard(s, from + i))}</ul>
              {pages > 1 && <div className="pz-spot-pager">
                <button type="button" className="btn" disabled={page === 0} onClick={() => setSpotPage(page - 1)}>Show previous {SPOTS_PER_PAGE}</button>
                <button type="button" className="btn" disabled={page >= pages - 1} onClick={() => setSpotPage(page + 1)}>Show next {SPOTS_PER_PAGE}</button>
              </div>}
            </>}
          </Page>
        );
      }
      case 'preferences':
        return (
          <Page title="Surf preferences" onBack={toList}>
            <p className="fine">Saved on this device. Your ability and preferred surf height shape each spot's Go, Worth a look or Skip call. Board Match ranks boards by each board's own wave range (and your ability in the demonstration week). Swell and tide preferences are for your profile only; forecasts are not filtered by them.</p>
            <div className="pz-cards">
              <div className="pz-panel"><h2>Your height</h2>
                <HeightField p={p} set={set} />
              </div>
              <div className="pz-panel"><h2>Preferred conditions</h2>
                <label className="field"><span>Preferred surf height ({p.heightUnit})</span>
                  <span className="pzl-pair">
                    <UnitNumber ft={p.minWave} unit={p.heightUnit} min={1} max={30} label={`Minimum (${p.heightUnit})`} onCommit={(minWave) => set({minWave})} />
                    <UnitNumber ft={p.maxWave} unit={p.heightUnit} min={1} max={40} label={`Maximum (${p.heightUnit})`} onCommit={(maxWave) => set({maxWave})} />
                  </span>
                </label>
                {/* profile-setup: the level (1–7) is set in one place, Personal › Profile, from its cards */}
                <div className="field"><span>Surfing level</span><span>Level {levelOf(p)}, {levelInfo(levelOf(p)).name}{levelSource(p)} <button type="button" className="btn" onClick={() => toPage('profile')}>Change in Profile</button></span></div>
              </div>
              <div className="pz-panel"><h2>Preferred swell and tide</h2>
                <fieldset className="pz-fs"><legend>Swell direction</legend>
                  <div className="pz-chips">{COMPASS8.map((d) => (
                    <label key={d} className="pz-pick"><input type="checkbox" checked={prefs.swellDirs.includes(d)} onChange={(e) => setBoardPrefs({...prefs, swellDirs: e.target.checked ? [...prefs.swellDirs, d] : prefs.swellDirs.filter((x) => x !== d)})} /><span>{d}</span></label>
                  ))}</div>
                </fieldset>
                <label className="field"><span>Period (seconds)</span>
                  <span className="pzl-pair">
                    <input type="number" min={4} max={25} value={prefs.periodSet ? prefs.periodMin : ''} placeholder="10" onChange={(e) => setBoardPrefs({...prefs, periodMin: Number(e.target.value), periodSet: true})} aria-label="Minimum period" />
                    <input type="number" min={4} max={25} value={prefs.periodSet ? prefs.periodMax : ''} placeholder="16" onChange={(e) => setBoardPrefs({...prefs, periodMax: Number(e.target.value), periodSet: true})} aria-label="Maximum period" />
                  </span>
                </label>
                <fieldset className="pz-fs"><legend>Tide</legend>
                  <div className="pz-chips">{(['Low', 'Mid', 'High'] as const).map((t) => (
                    <label key={t} className="pz-pick"><input type="checkbox" checked={prefs.tides.includes(t)} onChange={(e) => setBoardPrefs({...prefs, tides: e.target.checked ? [...prefs.tides, t] : prefs.tides.filter((x) => x !== t)})} /><span>{t}</span></label>
                  ))}</div>
                </fieldset>
              </div>
            </div>
          </Page>
        );
      case 'units':
        return (
          <Page title="Units" onBack={toList}>
            <div className="pz-panel">
              <Choice label="Heights" value={p.heightUnit} options={['ft', 'm'] as const} onChange={(heightUnit) => set({heightUnit})} />
              <Choice label="Wind" value={p.windUnit} options={['mph', 'kn', 'km/h'] as const} onChange={(windUnit) => set({windUnit})} />
              <Choice label="Surf height scale" value={p.scale} options={['Face height', 'Hawaiian'] as const} names={SCALE_NAMES} onChange={(scale) => set({scale})} />
              <p className="fine">Hawaiian scale (about half the surf height) applies to surf-height estimates only. Offshore heights are never converted.</p>
            </div>
          </Page>
        );
      case 'appearance':
        return (
          <Page title="Appearance" onBack={toList}>
            <div className="pz-panel">
              <div className="field pz-choice"><span aria-hidden="true">Theme</span>
                <div className="seg" role="radiogroup" aria-label="Appearance" onKeyDown={onThemeKey}>
                  {THEME_PREFS.map((t: ThemePref) => <button key={t} role="radio" aria-checked={t === themePref} tabIndex={t === themePref ? 0 : -1} onClick={() => setThemePref(t)}>{cap(t)}</button>)}
                </div>
              </div>
              <p className="fine">White is the default. System follows your device.</p>
            </div>
            <div className="pz-panel">
              <Choice label="Map style" value={mapStyle === 'satellite' ? 'Satellite' : 'Standard'} options={['Standard', 'Satellite'] as const} onChange={(v) => { const n = v === 'Satellite' ? 'satellite' : 'auto'; saveBasemapPref(n); setMapStyle(n); }} />
              <p className="fine">Standard is a light, quiet map that follows your theme. Satellite shows imagery. Takes effect the next time the map opens.</p>
            </div>
          </Page>
        );
      case 'journal':
        return (
          <Page title="Surf journal" onBack={toList}>
            <p className="fine">{sessions.length} sessions · on this device</p>
            <SawList spotName={spotName} />
            <div className="pz-journal">
              <LogForm spots={spotOptions} boards={boards} defaultSpot={view.selected} heightUnit={p.heightUnit === 'm' ? 'm' : 'ft'} onSubmit={logSession} onObserve={() => go('forecast')} error={obsError} />
              <JournalList sessions={sessions} extras={extras} spotName={spotName} onRemove={removeSession} />
            </div>
          </Page>
        );
      case 'account':
        return (
          <Page title="Data & privacy" onBack={toList} action={<span className="chip">Local only</span>}>
            <div className="pz-panel">
              <Choice label="Data source" value={view.dataMode} options={['Retrieved', 'Demonstration'] as const} onChange={view.setDataMode} />
              <p className="fine">Demonstration is a fixed illustrative week and is never mixed with live data.</p>
            </div>
            <div className="pz-panel">
              <h2>Storage and backup</h2>
              <p>There is no SWELLO account yet. Your profile, boards, favorites and journal live in this browser's storage and are not synced to other devices.</p>
              {data.error && <p className="fine" style={{color: 'var(--warn)'}}>{data.error}</p>}
              <div className="pzl-actions">
                <button className="btn" onClick={data.exportData}>Export backup (JSON)</button>
                <label className="btn pz-file"><input type="file" accept="application/json,.json" aria-label="Restore from backup" onChange={(e) => void pickBackup(e.target.files?.[0], e.currentTarget)} /><PIcon name="backup" size={16} />Restore from backup</label>
                <button className="btn" disabled={!obsLog.length} onClick={() => downloadText('swello-session-log.json', logToJson(obsLog), 'application/json')}>Export observations (JSON)</button>
                <button className="btn" disabled={!obsLog.length} onClick={() => downloadText('swello-session-log.csv', logToCsv(obsLog), 'text/csv')}>Export observations (CSV)</button>
                {data.lastSaved && <span className="fine">Last saved {timeLabelPT(data.lastSaved)}</span>}
              </div>
              {restoreMsg && <p className="fine" role={restoreMsg.ok ? 'status' : 'alert'} style={restoreMsg.ok ? undefined : {color: 'var(--warn)'}}>{restoreMsg.text}</p>}
              {restore && (
                <div className="pz-restore" role="group" aria-labelledby="pz-restore-h">
                  <h3 id="pz-restore-h">Replace your data with {restore.file}?</h3>
                  <dl className="kv">
                    <dt>Boards</dt><dd>{restore.preview.boards}{restore.preview.exampleBoards ? ` (${restore.preview.exampleBoards} example)` : ''} · now {boards.length}</dd>
                    <dt>Journal sessions</dt><dd>{restore.preview.sessions} · now {data.state.sessions.length}</dd>
                    <dt>Favorite spots</dt><dd>{restore.preview.favorites} · now {data.state.favorites.length}</dd>
                    <dt>Profile settings</dt><dd>{restore.preview.settings}{restore.state.profile.displayName ? ` · ${restore.state.profile.displayName}` : ''}</dd>
                  </dl>
                  <p className="fine">Everything above replaces the profile, boards, favorites and journal sessions in this browser. Nothing is merged. Export a backup first if you may want the current data back.</p>
                  <div className="pzl-actions">
                    <button className="btn primary" onClick={confirmRestore}>Replace my data</button>
                    <button className="btn" onClick={() => setRestore(null)}>Cancel</button>
                  </div>
                </div>
              )}
              <dl className="kv">
                <dt>Boards</dt><dd>{boards.length}</dd><dt>Favorite spots</dt><dd>{data.state.favorites.length}</dd><dt>Journal sessions</dt><dd>{data.state.sessions.length}</dd><dt>Forecast-check observations</dt><dd>{obsLog.length}</dd><dt>Alerts</dt><dd>{rules.length}</dd>
              </dl>
              {obsLog.length > 0 && (
                <ul className="pzl-obslist" aria-label="Recent forecast-check observations">
                  {(sessionTarget ? obsLog : obsLog.slice(0, 5)).map((o) => (
                    <li key={o.id} id={`session-${o.id}`}><span>{spots.find((s) => s.id === o.spotId)?.name ?? o.spotId} · {entryDate(o.observedAt, o.spotId)} · {p.heightUnit === 'm' ? `${(o.rangeFt[0] * 0.3048).toFixed(1)}–${(o.rangeFt[1] * 0.3048).toFixed(1)} m` : `${o.rangeFt[0]}–${o.rangeFt[1]} ft`} face · quality {o.quality}/5</span>
                      <button className="btn" aria-label={`Remove observation from ${entryDate(o.observedAt, o.spotId)}`} onClick={() => { const n = removeObservation(obsLog, o.id); setObsLog(n); saveLog(n); }}>Remove</button></li>
                  ))}
                </ul>
              )}
              <p className="fine">The backup covers profile, boards, favorites and session text. Journal photos, tags, alerts and the profile photo stay in this browser only.</p>
            </div>
            <Group title="Legal"><Row icon="shield" label="Privacy" onClick={() => go('personal', 'privacy')} /><Row icon="doc" label="Terms" onClick={() => go('personal', 'terms')} /></Group>
          <OwnerTools />
          </Page>
        );
      default:
        return (
          <div className="pzl-list">
            <h1 className="pzl-title">Personal</h1>
            <button type="button" className="pzl-profile" onClick={() => toPage('profile')} aria-label="Edit profile">
              <span className="pz-avatar" style={avatar ? {backgroundImage: `url(${avatar})`} : undefined} role={avatar ? 'img' : undefined} aria-label={avatar ? 'Profile photo' : undefined}>{!avatar && (initials || <PIcon name="user" size={28} />)}</span>
              <span className="pzl-pt"><b>{name}</b>
                <small>{[`Level ${levelOf(p)}, ${levelInfo(levelOf(p)).name}${levelSource(p)}`, `${rangeText(p.minWave, p.maxWave, p)} preferred`, p.region !== 'All regions' && spotOptions.some((x) => x.region === p.region) ? regionWithState(p.region) : ''].filter(Boolean).join(' · ')}</small></span>
              <span className="pzl-pe"><i>Edit profile</i><PIcon name="next" size={16} /></span>
            </button>

            <Group title="Favorite spots">
              {favSpots.slice(0, 3).map((s) => {
                const live = evidenceSpots.some((e) => e.id === s.id), f = live ? hourFor(s.id) : undefined, rowText = f ? surfRowText(s, f) : null;
                const canForecast = live || view.dataMode === 'Demonstration';
                return <Row key={s.id} icon="pin" label={s.name} sub={s.region} value={rowText ?? undefined} onClick={() => (canForecast ? (setSpot(s.id), go('forecast')) : toPage('spots'))} />;
              })}
              {favSpots.length === 0 && <li className="pzl-empty">No favorite spots yet. Star a spot to keep it on Home.</li>}
              <Row icon="star" label={favSpots.length ? 'All favorite spots' : 'Choose favorite spots'} value={favSpots.length ? `${favSpots.length} saved` : undefined} onClick={() => toPage('spots')} />
            </Group>

            <Group title="Sessions and alerts">
              <Row icon="journal" label="Surf journal" value={`${sessions.length} ${sessions.length === 1 ? 'session' : 'sessions'}`} onClick={() => toPage('journal')} />
              <Row icon="bell" label="Alerts" value={rules.length ? `${activeAlerts} on` : 'None'} onClick={openAlerts} />
              <Row icon="board" label="Board pick" value={boardRow.value} sub={boardRow.sub} onClick={() => go('quiver')} />
            </Group>

            <Group title="Surf preferences">
              <Row icon="clock" label="Preferred conditions" value={rangeText(p.minWave, p.maxWave, p)} sub={`Level ${levelOf(p)}, ${levelInfo(levelOf(p)).name}${levelSource(p)}${p.style !== 'All-around' ? ` · ${p.style}` : ''}`} onClick={() => toPage('preferences')} />
              <Row icon="swell" label="Preferred swell" value={swellSummary(prefs).value} sub={swellSummary(prefs).sub} onClick={() => toPage('preferences')} />
              <Row icon="tide" label="Preferred tide" value={tideSummary(prefs.tides)} onClick={() => toPage('preferences')} />
            </Group>

            <Group title="Units">
              <Row icon="wave" label="Heights" value={p.heightUnit} onClick={() => toPage('units')} />
              <Row icon="wind" label="Wind" value={p.windUnit} onClick={() => toPage('units')} />
              <Row icon="swell" label="Height scale" value={SCALE_NAMES[p.scale]} onClick={() => toPage('units')} />
            </Group>

            <Group title="Appearance">
              <Row icon="theme" label="Theme" value={cap(themePref)} onClick={() => toPage('appearance')} />
            </Group>

            <Group title="Data & privacy">
              <Row icon="data" label="Data source" value={view.dataMode} onClick={() => toPage('account')} />
              <Row icon="backup" label="Backup and storage" value="Local only" onClick={() => toPage('account')} />
              <Row icon="shield" label="Privacy" onClick={() => go('personal', 'privacy')} />
              <Row icon="doc" label="Terms" onClick={() => go('personal', 'terms')} />
            </Group>
          </div>
        );
    }
  })();

  return (
    <div className="pz pzl">
      {note && <p className="pz-err" role="alert">{note}</p>}
      {body}
    </div>
  );
}
