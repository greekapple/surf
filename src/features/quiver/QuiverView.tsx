import {lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode} from 'react';
import {levelInfo, levelOf, suggestedVolume} from '../../services/skillLevels';
import {levelSource} from '../../services/profileFields';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {boardTypes, type BoardType, type Surfboard} from '../../models/index';
import {scoreBoard} from '../../recommendation/board';
import {headlineSurf, headlineText} from '../../services/headlineSurf';
import {isFlat, FLAT_ESTIMATE_TEXT} from '../../services/flatSurf';
import {boardPickFor, orderScored, outOfRange, pickHeading, rangeSourceText, sizeFit} from './fit';
import {boardVerdict} from '../../services/boardVerdict';
import {estimateVolume as boxVolume, TYPICAL, volumeNote} from '../../services/boardVolume';
import {lengthLabel, parseDimension, surfRange, validDimensions} from '../../utils/units';
import {Icon} from '../../ui/Icon';
import {StateMessage} from '../../ui/common';
import {Skeleton, SkelInline} from '../../ui/Skeleton';
import {spotPhase} from '../../services/dataPhase';
import {titleCase} from '../forecast/model';
import {inches} from './format';
import {estimateVolume, loadOutline, saveOutline, widthFromTrace} from './outline';
import {MODELLED_NOTE, exampleLabel, isVolumeEstimate, referenceFor, volumeLabel} from '../../data/referenceBoards';
import {BoardOutline} from './BoardOutline';
import {Rack} from './Rack';
import {Strip} from './Overlay';
import {ScanPanel, type Scan} from './ScanPanel';
import {emptyForm, missingBoardFields, PLACEHOLDER} from './boardForm';
import './quiver.css';

// three.js and the board models load only when the Showroom opens.
const BoardRoom = lazy(() => import('./BoardRoom'));

type Path = 'dims' | 'scan';
const eighth = (n: number) => String(Math.round(n * 8) / 8);

function BoardForm({initial, onSave, onCancel, onDirty, onDelete, presetType}: {initial?: Surfboard; onSave: (b: Surfboard) => void; onCancel: () => void; onDirty?: (dirty: boolean) => void; onDelete?: () => void; presetType?: BoardType}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [f, setF] = useState(() => initial ? {name: initial.name, manufacturer: initial.manufacturer, model: initial.model, type: initial.type,
    length: `${Math.floor(initial.length / 12)}'${+(initial.length % 12).toFixed(2)}"`, width: String(initial.width), thickness: String(initial.thickness),
    volume: String(initial.volume), fins: initial.fins ?? '', tail: initial.tail ?? '', notes: initial.notes ?? ''} : {...emptyForm, ...(presetType ? {type: presetType} : {})});
  const [err, setErr] = useState('');
  const saved = initial ? loadOutline(initial.id) : null;
  const [path, setPath] = useState<Path>(saved ? 'scan' : 'dims');
  // aspect 0 marks an outline loaded from storage: its width and volume are the saved numbers, not re-derived.
  const [scan, setScan] = useState<Scan | null>(saved ? {outline: saved, aspect: 0} : null);
  const [touched, setTouched] = useState({width: !!initial, volume: !!initial});
  // Unsaved changes: any field, the photo scan, or the entry path differs from what the form opened with.
  const start = useRef({f: JSON.stringify(f), path, scan: scan}).current;
  const dirty = JSON.stringify(f) !== start.f || path !== start.path || scan !== start.scan || touched.width !== !!initial || touched.volume !== !!initial;
  useEffect(() => { onDirty?.(dirty); }, [dirty]); // eslint-disable-line react-hooks/exhaustive-deps
  const lengthIn = parseDimension(f.length, true), derive = path === 'scan' && !!scan && scan.aspect > 0;
  const width = derive && !touched.width && Number.isFinite(lengthIn) ? eighth(widthFromTrace(lengthIn, scan.aspect)) : f.width;
  const estimating = derive && !touched.volume && Number.isFinite(lengthIn);
  const photoVolume = estimating ? String(estimateVolume(scan.outline, lengthIn, parseDimension(f.thickness))) : null;
  // quiver-lock: a blank volume is estimated from length x width x thickness by type (our rough rule, services/boardVolume.ts), saved as an estimate and shown as one
  const boxEst = boxVolume(lengthIn, parseDimension(width), parseDimension(f.thickness), f.type);
  const volumeBlank = !f.volume.trim() && !estimating, volume = photoVolume ?? (volumeBlank && boxEst !== null ? String(boxEst) : f.volume);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const length = parseDimension(f.length, true), w = parseDimension(width), thickness = parseDimension(f.thickness), vol = Number(volume);
    const missing = missingBoardFields({...f, width, volume});
    setTried(true);
    if (missing.length) return setErr(`Add the board's ${missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}` : missing[0]}. Volume is optional: leave it blank and it is estimated.`);
    if (!validDimensions(length, w, thickness, vol)) return setErr(`Check the dimensions: length like 6'0", width and thickness in inches (fractions allowed), volume in litres that fits those dimensions.`);
    const id = initial?.id ?? crypto.randomUUID(), o = path === 'scan' ? scan?.outline ?? null : null;
    if (!saveOutline(id, o) && o?.tex) saveOutline(id, {v: 1, hw: o.hw});
    onSave({...(initial ?? {favorite: false}), id, name: f.name.trim() || f.type, manufacturer: f.manufacturer.trim(), model: f.model.trim(), type: f.type,
      length, width: w, thickness, volume: vol, volumeEstimated: estimating || volumeBlank || (!!initial && isVolumeEstimate(initial) && vol === initial.volume), fins: f.fins || undefined, tail: f.tail || undefined, notes: f.notes || undefined, demo: false,
      specificationSource: path === 'scan' && scan ? (estimating ? 'From your photo (volume estimated)' : 'From your photo') : volumeBlank ? 'Entered by you (volume estimated)' : 'Entered by you'});
  };
  const [tried, setTried] = useState(false);
  const blank = tried ? new Set(missingBoardFields({...f, width, volume})) : new Set<string>();
  const req = <i className="qv-req">Required</i>;
  const field = (k: keyof typeof f, label: string, extra = {}, required = false) => <label className="field"><span>{label}{required && req}</span><input value={f[k]} placeholder={k === 'length' || k === 'thickness' ? TYPICAL[f.type][k] : PLACEHOLDER[k]} aria-required={required || undefined} aria-invalid={blank.has(k) || undefined} onChange={(e) => setF({...f, [k]: e.target.value})} {...extra} /></label>;
  return (
    <form className="card qv-form" onSubmit={submit} noValidate aria-label={initial ? 'Edit board' : 'Add board'}>
      <div className="card-h"><h2>{initial ? `Edit ${initial.name}` : 'Add a board'}</h2></div>
      <div className="qv-paths" role="radiogroup" aria-label="How to add the board">
        <button type="button" role="radio" aria-checked={path === 'scan'} onClick={() => setPath('scan')}><b>Scan a board photo</b><span>Your board's real outline and deck</span></button>
        <button type="button" role="radio" aria-checked={path === 'dims'} onClick={() => setPath('dims')}><b>Enter dimensions</b><span>From the stringer or the shaper</span></button>
      </div>
      <div className="form-grid">
        <label className="field"><span>Type</span><select value={f.type} onChange={(e) => setF({...f, type: e.target.value as BoardType})}>{boardTypes.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label className="field"><span>Name <i className="qv-req">Optional</i></span><input value={f.name} maxLength={40} placeholder={f.type} onChange={(e) => setF({...f, name: e.target.value})} /></label>
        {field('manufacturer', 'Shaper / brand')}{field('model', 'Model')}
        <div className="qv-typical" style={{gridColumn: '1 / -1'}}><button type="button" className="qv-link" onClick={() => { setF({...f, length: TYPICAL[f.type].length, width: TYPICAL[f.type].width, thickness: TYPICAL[f.type].thickness}); setTouched({...touched, width: true}); }}>Use typical {f.type.toLowerCase()} sizes: {TYPICAL[f.type].length} × {TYPICAL[f.type].width}″ × {TYPICAL[f.type].thickness}″</button> <span className="fine">Round numbers for the type: replace them with your board's.</span></div>
        {field('length', 'Length (ft and in)', {}, true)}
        <label className="field"><span>Width (in){derive && !touched.width ? ' · from photo' : ''}{req}</span><input value={width} placeholder={TYPICAL[f.type].width} aria-required aria-invalid={blank.has('width') || undefined} onChange={(e) => { setF({...f, width: e.target.value}); setTouched({...touched, width: true}); }} /></label>
        {field('thickness', 'Thickness (in)', {}, true)}
        <label className="field"><span>{estimating ? 'Volume (L) · estimate' : 'Volume (L)'}<i className="qv-req">Optional</i></span><input value={estimating ? (photoVolume ?? '') : f.volume} placeholder={boxEst !== null ? `≈ ${boxEst} (estimate)` : PLACEHOLDER.volume} inputMode="decimal" aria-invalid={blank.has('volume') || undefined} onChange={(e) => { setF({...f, volume: e.target.value}); setTouched({...touched, volume: true}); }} /></label>
        {field('fins', 'Fins')}{field('tail', 'Tail')}
      </div>
      {path === 'scan' && <ScanPanel lengthText={f.length} value={scan} onChange={(s) => { setScan(s); if (s) setTouched({width: false, volume: false}); }} />}
      {estimating && <p className="fine">Volume is an estimate from the outline and thickness. Replace it with the number on the board if you have it.</p>}
      {volumeBlank && boxEst !== null && <p className="fine">Volume left blank: about {boxEst} L, estimated from length × width × thickness for a {f.type.toLowerCase()} (our rough rule; it is saved and shown as an estimate). Type the number printed on the stringer to replace it.</p>}
      <label className="field" style={{marginTop: 12}}><span>Notes</span><textarea value={f.notes} onChange={(e) => setF({...f, notes: e.target.value})} /></label>
      {err && <p role="alert" style={{color: 'var(--warn)', marginTop: 8}}>{err}</p>}
      <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12}}><button className="btn primary" type="submit">Save board</button><button className="btn" type="button" onClick={onCancel}>Cancel</button>
        {/* T-109: Delete lives in Edit (not on the wall), still behind a confirmation. */}
        {initial && onDelete && (!confirmDel ? <button className="btn danger" type="button" style={{marginLeft: 'auto'}} onClick={() => setConfirmDel(true)}><Icon name="trash" size={16} />Delete board</button>
          : <button className="btn danger" type="button" style={{marginLeft: 'auto'}} onClick={onDelete}>Confirm delete {initial.name}</button>)}</div>
    </form>
  );
}

/** Audit R15: a note's URLs become links named by their site ("cleanlinesurf.com ↗"), never a raw retailer URL printed as text. */
function linkify(text: string): ReactNode[] {
  return text.split(/(https?:\/\/\S+)/).map((part, i) => {
    if (i % 2 === 0) return part.replace(/\s+;/g, ';');
    const url = part.replace(/[.,;)]+$/, ''), host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'link'; } })();
    return <a key={i} href={url} target="_blank" rel="noreferrer">{host} ↗</a>;
  });
}

const okN = (n: number | undefined): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0;
/** The stored numbers, as recorded (never filled in). */
function specRows(b: Surfboard): [string, string][] {
  return [['Length', okN(b.length) ? lengthLabel(b.length) : 'Not recorded'], ['Width', okN(b.width) ? inches(b.width) : 'Not recorded'],
    ['Thickness', okN(b.thickness) ? inches(b.thickness) : 'Not recorded'], ['Volume', okN(b.volume) ? volumeLabel(b) : 'Not recorded'],
    ['Fins', b.fins?.trim() || 'Not recorded'], ['Tail', b.tail?.trim() || 'Not recorded']];
}

const TITLES: Record<string, {h: string; sub: string}> = {
  '': {h: 'Quiver', sub: ''},
  showroom: {h: 'Quiver', sub: ''},   // legacy link: opens the Quiver in 3D
  match: {h: 'Board match', sub: 'Which board for these conditions'},
  compare: {h: 'Compare boards', sub: 'Two boards side by side, same scale'},
};
/** "3 boards", "4 example boards" (nothing of the person's own yet), "2 boards · 4 examples" (examples are not counted among the person's boards). */
const countText = (boards: Surfboard[]) => { const own = boards.filter((b) => !b.demo).length, ex = boards.length - own;
  return own === 0 ? `${ex} example ${ex === 1 ? 'board' : 'boards'}` : `${own} ${own === 1 ? 'board' : 'boards'}${ex ? ` · ${ex} ${ex === 1 ? 'example' : 'examples'}` : ''}`; };
const usePhone = () => { const [m, setM] = useState(() => typeof matchMedia === 'function' && matchMedia('(max-width: 860px)').matches);
  useEffect(() => { const q = matchMedia('(max-width: 860px)'), f = () => setM(q.matches); q.addEventListener('change', f); return () => q.removeEventListener('change', f); }, []); return m; };

export function QuiverView({section, go}: ViewProps) {
  const {data, view, prefs, setPrefs, now} = useSwello();
  const boards = data.state.boards, p = data.state.profile;
  const [editing, setEditing] = useState<Surfboard | 'new' | null>(null);
  const [flat, setFlat] = useState(false);
  const phone = usePhone();
  // one page, two stages: the 2D picture or the 3D viewer (deep link ?board=<id>&view=3d); a phone starts in 2D (no WebGL until asked), a desktop in 3D
  const [view3d, setView3d] = useState(() => { const v = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('view'); return v === '3d' ? true : v === '2d' ? false : typeof matchMedia === 'function' && !matchMedia('(max-width: 860px)').matches; });
  const [stepEdit, setStepEdit] = useState(false);
  const replacing = useRef<string | null>(null);   // an example board the person is replacing with their own
  const [cmp, setCmp] = useState<[string, string]>([boards[0]?.id ?? '', boards[1]?.id ?? boards[0]?.id ?? '']);
  const sel = boards.find((b) => b.id === prefs.selectedBoardId) ?? boards[0];
  const select = (id: string) => { setPrefs({selectedBoardId: id}); };
  const f = view.forecast;
  // The same headline estimate as the spot page and Home (T-046): Board Match uses its range when the record has no face value.
  const hs = headlineSurf(view.spot.id, f, {bundle: view.ocean.bundle, nowMs: now});
  const est: [number, number] | null = hs.kind === 'estimate' ? [hs.loFt, hs.hiFt] : null;
  // A6: while this spot's forecast is still loading nothing below may say the estimate is missing: skeletons until it arrives or the load fails.
  const phase = spotPhase(view.ocean, view.selected, view.dataMode === 'Retrieved'), pending = phase === 'loading', failed = phase === 'failed';
  // T-099: the one board pick (fit.ts boardPickFor), shared with Home's quiver pick and Personal, so one spot-hour gives one answer everywhere.
  const choice = useMemo(() => boardPickFor(boards, view.spot, f, now, p, {bundle: view.ocean.bundle}), [boards, view.spot, f, now, p, view.ocean.bundle]);
  const matches = useMemo(() => (choice.mode === 'score' ? choice.scored : boards.map((b) => scoreBoard(b, f, p, est)).sort((a, b) => b.score - a.score)), [choice, boards, f, p, est?.[0], est?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const sizeOk = (f.availability.face && Number.isFinite(f.face)) || !!est, charOk = !!f.character && f.character !== 'Unknown';
  const faceOk = sizeOk && charOk;
  // Today's size fit per board (real numbers: the board's range vs the estimate), shown on the rack and in the board room.
  const fits = useMemo(() => new Map(pending ? [] : boards.map((b) => [b.id, sizeFit(b, est)])), [boards, pending, est?.[0], est?.[1]]); // eslint-disable-line react-hooks/exhaustive-deps
  const estText = pending ? null : isFlat(hs) ? `${FLAT_ESTIMATE_TEXT} at ${view.spot.name}` : est ? `est. ${headlineText(hs, p).value} at ${view.spot.name}` : null; // review P1-1: the spot page's own text (rounding, unit, Hawaiian) // T-130

  // The form belongs to the section it was opened in. Any route change (pills, menu, back button) leaves it: close it,
  // or if fields were edited keep it and ask first. (Delete lives in the form, T-109, so closing it drops a pending confirmation.)
  const formSection = useRef(section), dirty = useRef(false), seen = useRef(section);
  const [leaving, setLeaving] = useState<string | null>(null);
  const openForm = (b: Surfboard | 'new') => { formSection.current = section; dirty.current = false; setLeaving(null); setEditing(b); };
  const closeForm = () => { setEditing(null); setLeaving(null); dirty.current = false; };
  useEffect(() => {
    if (seen.current === section) return;
    seen.current = section;
    if (!editing) return;
    if (dirty.current) setLeaving(section); else closeForm();
  }, [section]); // eslint-disable-line react-hooks/exhaustive-deps

  // the old Showroom link opens the Quiver in 3D; the board and the stage are kept in the URL (?board=<id>&view=3d) so a reload or a shared link restores them
  useEffect(() => { if (section === 'showroom') { setView3d(true); go('quiver', ''); } }, [section]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const id = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('board'); if (id && id !== sel?.id && boards.some((b) => b.id === id)) select(id); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (section !== '' || typeof location === 'undefined') return;
    const q = new URLSearchParams(location.search); if (sel) q.set('board', sel.id); q.set('view', view3d ? '3d' : '2d');
    history.replaceState(null, '', `${location.pathname}?${q}`);
  }, [sel?.id, view3d, section]); // eslint-disable-line react-hooks/exhaustive-deps
  if (editing) return (
    <div className="qv">
      {leaving !== null && (
        <div className="card qv-leave" role="alertdialog" aria-label="Unsaved changes" style={{marginBottom: 12}}>
          <p><b>Discard your changes to this board?</b> You opened {TITLES[leaving]?.h ?? 'another section'}, but the board form has unsaved edits.</p>
          <div style={{display: 'flex', gap: 8, marginTop: 8}}>
            <button className="btn danger" onClick={closeForm}>Discard changes</button>
            <button className="btn" onClick={() => { setLeaving(null); go('quiver', formSection.current); }}>Keep editing</button>
          </div>
        </div>
      )}
      <BoardForm initial={editing === 'new' ? undefined : editing} presetType={editing === 'new' && replacing.current ? boards.find((x) => x.id === replacing.current)?.type : undefined} onCancel={() => { replacing.current = null; closeForm(); }} onDirty={(d) => { dirty.current = d; }} onSave={(b) => { data.saveBoard(b); select(b.id); if (replacing.current && replacing.current !== b.id) { data.deleteBoard(replacing.current); replacing.current = null; } closeForm(); }}
        onDelete={editing && editing !== 'new' ? () => { data.deleteBoard(editing.id); closeForm(); } : undefined} />
    </div>
  );
  if (!boards.length) return <StateMessage title="Your quiver is empty" action={<button className="btn primary" onClick={() => openForm('new')}><Icon name="plus" size={16} />Add your first board</button>}>Add a board and Swello says which one to take for the surf at your spot, by size and swell period.</StateMessage>;

  const t = TITLES[section] ?? TITLES[''];
  const outline = sel ? loadOutline(sel.id) : null, traced = !!outline;
  const maxLen = Math.max(...boards.map((b) => b.length));
  const idx = sel ? boards.findIndex((b) => b.id === sel.id) : 0;
  const step = (d: number) => select(boards[(idx + d + boards.length) % boards.length].id);
  // One honest line from Board Match for the selected board: its score and rank at the selected hour, or why there is none.
  const mi = sel ? matches.findIndex((m) => m.board.id === sel.id) : -1, mm = mi >= 0 ? matches[mi] : null;
  const period = f.primary && Number.isFinite(f.primary.period) ? f.primary.period : null;
  const picks = choice.ranked; // the same ranking Home and Personal use (boardPickFor)
  // review MEDIUM: score mode orders and labels like size mode (out-of-range boards last, by distance); the size verdict uses the estimate, else the record's face value
  const scoreEst: [number, number] | null = est ?? (Number.isFinite(f.face) && f.availability.face ? [f.face, f.face] : null);
  const scoredRows = orderScored(matches, scoreEst);
  const selPick = sel ? picks.find((x) => x.board.id === sel.id) ?? null : null;
  const matchLine = pending ? <SkelInline label={`Loading Board Match for ${view.spot.name}`} width="16em" />
    : failed ? <><b>Board Match:</b> the forecast did not load, so there is nothing to match against.</>
    : !sizeOk ? <><b>Board Match:</b> no surf estimate for {view.spot.name} at this hour (offshore height only).</>
    : charOk && mm ? <><b>Board Match at {view.spot.name}:</b> {Math.round(mm.score)}/100, #{mi + 1} of {matches.length}{mm.eligible ? '' : ' · outside your ability or range'}{mm.limited ? ' · limited board data' : ''}{view.dataMode === 'Demonstration' ? ' · demonstration week' : ''} · provisional</>
    : selPick ? <><b>Board Match:</b> {({in: `${estText} is in its range`, edge: `${estText} is at the edge of its range`, big: `${estText} is above its range`, small: `${estText} is below its range`} as Record<string, string>)[selPick.size.state] ?? selPick.size.label}{period !== null ? ` · ${Math.round(period)} s ${selPick.period?.fit === 'ok' ? 'period suits it' : `period (${selPick.period?.note ?? ''})`}` : ''}. Wave shape unknown.</> : null;
  const A = (b: Surfboard) => (
    <div className="qv-actions">
      <button className="btn" onClick={() => openForm(b)}><Icon name="edit" size={16} />Edit</button>
    </div>
  );
  // volume against the weight and level (display only, ours): shown with the board's own volume
  const vnote = sel ? volumeNote(sel.volume, p.weightKg, levelOf(p), isVolumeEstimate(sel)) : null;
  const fitOf = sel ? fits.get(sel.id) : undefined;
  const fitsDiffer = new Set([...fits.values()].map((x) => x.state)).size > 1;   // identical chips on every board say nothing: the verdict band says it once
  const estShort = pending || !est ? null : isFlat(hs) ? FLAT_ESTIMATE_TEXT : headlineText(hs, p).value;
  const verdict = boardVerdict({choice, boards, spotName: view.spot.name, estText: estShort, pending, failed, fmtRange: (lo, hi) => surfRange(lo, hi, p), profile: p});
  const eyebrow = `Board Match · ${view.spot.name}${estShort ? ` · est. ${estShort}` : ''}${period !== null ? ` · ${Math.round(period)} s` : ''}`;
  const readSide = sel && (
    <section className="qv-side" aria-label={`${sel.name}, selected board`}>
      <header className="qv-side-h">
        <h2>{sel.name}</h2>
        <p className="fine">{[sel.type, sel.demo ? 'Example' : [sel.manufacturer, sel.model].filter(Boolean).join(' ') || null].filter(Boolean).join(' · ')}</p>
        {sel.demo && <p className="fine">{exampleLabel(sel)}: example dimensions for its type. <button type="button" className="qv-link" onClick={() => { replacing.current = sel.id; openForm('new'); }}>Replace with your board</button></p>}
      </header>
      <dl className="qv-spec-l">{specRows(sel).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      {fitOf && fitOf.state !== 'none' && !pending && <p className="qv-fitline">Today: <em className={`qv-fit ${fitOf.state}`}>{fitOf.label}</em> <span className="fine">· {surfRange(fitOf.board[0], fitOf.board[1], p)} ({rangeSourceText(fitOf, sel.type)})</span></p>}
      {vnote && <p className="fine qv-vol">{vnote.text}</p>}
      {sel.notes && !sel.demo && <p className="fine">{linkify(sel.notes)}</p>}
      <div className="qv-actions"><button className="btn" onClick={() => go('quiver', 'compare')}>Compare</button><button className="btn primary" onClick={() => { setView3d(true); setStepEdit(true); }}><Icon name="edit" size={16} />Edit</button></div>
    </section>
  );
  const stage2d = sel && (
    <div className="br"><div className="br-stagecol">
      <div className="br-stage br-flat"><div className="br-flat-b"><BoardOutline b={sel} scale={Math.min(6.4, (phone ? 330 : 430) / sel.length)} /></div></div>
      {phone && <Strip boards={boards} selectedId={sel.id} onSelect={select} />}
    </div><div className="br-side">{readSide}</div></div>
  );
  return (
    <div className="qv">
      <header className="qv-head">
        <div><h1>{t.h}</h1><p className="fine">{section === '' || section === 'showroom' ? countText(boards) : `${t.sub} · ${countText(boards)}`}</p></div>
        <button className="btn primary" onClick={() => openForm('new')}><Icon name="plus" size={16} />Add board</button>
      </header>

      {(section === '' || section === 'showroom') && sel && (
        <>
          <section className={`qv-verdict ${verdict.tone}`} aria-label="Board Match for the selected hour">
            <p className="qv-v-k">{eyebrow}</p>
            <p className="qv-v-s">{verdict.tone === 'loading' ? <SkelInline label={`Loading Board Match for ${view.spot.name}`} width="18em" /> : verdict.sentence}</p>
            {verdict.caveat && <p className="fine">{verdict.caveat}</p>}
            <div className="qv-v-a"><button type="button" className="qv-link" onClick={() => go('quiver', 'match')}>How it was decided</button><button type="button" className="qv-link" onClick={() => go('forecast')}>Change spot or hour</button></div>
          </section>
          {!phone && <Rack boards={boards} selected={sel} onSelect={select} fits={fitsDiffer ? fits : undefined} estText={fitsDiffer ? estText : null} />}
          <div className="qv-tools" role="group" aria-label="Board view">
            <div className="qv-seg" role="radiogroup" aria-label="Stage">
              <button type="button" role="radio" aria-checked={!view3d && !stepEdit} onClick={() => { setView3d(false); setStepEdit(false); }}>2D</button>
              <button type="button" role="radio" aria-checked={view3d || stepEdit} onClick={() => setView3d(true)}>3D</button>
            </div>
          </div>
          {(view3d || stepEdit) && !flat ? (
            <Suspense fallback={stage2d}>
              <BoardRoom board={sel} onSave={data.saveBoard} onFail={() => setFlat(true)} side={readSide} editing={stepEdit} onDone={() => setStepEdit(false)} onDetails={() => { setStepEdit(false); openForm(sel); }}
                under={phone ? <Strip boards={boards} selectedId={sel.id} onSelect={select} /> : null} />
            </Suspense>
          ) : <>{flat && <p className="fine qv-flat-note" role="status">3D is not available on this device.</p>}{stage2d}</>}
        </>
      )}

      {section === 'match' && (
        <section className="qv-panel" aria-label="Board match">
          <p className="fine">{view.spot.name} at the selected hour · level {levelOf(p)}, {levelInfo(levelOf(p)).name.toLowerCase()}{levelSource(p)}</p>
          {/* profile-setup: weight × the level's litres per kg (our rule of thumb, services/skillLevels.ts); only with a weight saved in Personal › Profile */}
          {(() => { const lv = levelOf(p), v = suggestedVolume(p.weightKg, lv); return v !== null ? <p className="fine qv-vol">Suggested volume for you: about {v} L ({p.heightUnit === 'm' ? '' : `${Math.round(p.weightKg! / 0.45359237)} lb = `}{Math.round(p.weightKg!)} kg × {levelInfo(lv).litresPerKg} L/kg for level {lv}, {levelInfo(lv).name.toLowerCase()}; our rule of thumb, not fitted to data). {boards.some((b) => Number.isFinite(b.volume)) ? `Your boards: ${boards.filter((b) => Number.isFinite(b.volume)).map((b) => `${b.name} ${Math.round(b.volume!)} L`).join(', ')}.` : ''}</p> : null; })()}
          {pending ? <Skeleton label={`Loading Board Match for ${view.spot.name}`} /> : !faceOk ? (
            sizeOk ? (
              <>
                <p className="qv-shape">Ranked on size and period for {estText}. Wave shape is unknown, so it isn't weighed.</p>
                {!choice.pick && <p className="qv-nofit" role="status"><b>None of your boards suit {estText}.</b> They are listed by how close their range is.</p>}
                <ol className="qv-ranks qv-ranks-sp">{picks.map((x, k) => (
                  <li key={x.board.id} className={x.board.id === choice.pick?.id ? 'top' : ''}>
                    <div className="qv-rank-b"><BoardOutline b={x.board} scale={(x.board.id === choice.pick?.id ? 150 : 90) / maxLen} /></div>
                    <div className="qv-rank-t">
                      <span className="qv-rank-n">{x.board.id === choice.pick?.id ? pickHeading(x.size, est, 'Best for this size') : outOfRange(x) ? 'Not for this size' : `#${k + 1}`}</span>
                      <h2>{x.board.name}</h2>
                      <p className="fine">{x.board.type} · {lengthLabel(x.board.length)} · {volumeLabel(x.board)}</p>
                      <p><em className={`qv-fit ${x.size.state}`}>{x.size.label}</em>{x.size.state !== 'none' && <span className="fine"> · {x.size.source === 'board' ? 'your range' : `${x.board.type.toLowerCase()} range`} {surfRange(x.size.board[0], x.size.board[1], p)}</span>}</p>
                      {x.period && period !== null && <p className="fine">{Math.round(period)} s period: {x.period.note}.</p>}
                    </div>
                  </li>
                ))}</ol>
              </>
            ) : failed ? <StateMessage title="The forecast did not load" action={<button className="btn" onClick={view.ocean.reload}>Try again</button>}>Board Match needs the forecast for {view.spot.name}. {view.ocean.error}</StateMessage>
            : <StateMessage title="Board Match needs a surf estimate" action={view.dataMode === 'Retrieved' ? <button className="btn" onClick={() => view.setDataMode('Demonstration')}>Try the demonstration week</button> : undefined}>
              Live data has offshore wave height only here, and offshore height is not the size of the waves a board will ride.
            </StateMessage>
          ) : (
            <>
              {view.dataMode === 'Demonstration' && <p><span className="chip demo">Demonstration week · illustrative</span></p>}
              {!choice.pick && <p className="qv-nofit" role="status"><b>None of your boards suit {estText ?? `the surf at ${view.spot.name}`}.</b> They are listed by how close their range is.</p>}
              <ol className="qv-ranks">{scoredRows.map((m, k) => (
                <li key={m.board.id} className={m.board.id === choice.pick?.id ? 'top' : ''}>
                  <div className="qv-rank-b"><BoardOutline b={m.board} scale={(m.board.id === choice.pick?.id ? 150 : 90) / maxLen} /></div>
                  <div className="qv-rank-t">
                    <span className="qv-rank-n">{m.board.id === choice.pick?.id ? pickHeading(m.size, scoreEst, 'Best match') : m.size.state === 'big' || m.size.state === 'small' ? 'Not for this size' : !m.eligible ? 'Not for your ability' : `#${k + 1}`}</span>
                    <h2>{m.board.name}</h2>
                    <p className="fine">{m.board.type} · {lengthLabel(m.board.length)} · {volumeLabel(m.board)}{m.eligible ? '' : ' · outside your ability or range'}{m.limited ? ' · limited board data' : ''}</p>
                    <ul className="factors">{m.factors.map((fc) => <li key={fc.name}><span>{fc.name} <span className="fine">· weight {Math.round(fc.weight * 100)}%</span></span><span>{Math.round(fc.score)}</span><span className="bar"><i style={{width: `${fc.score}%`}} /></span><span className="fine" style={{gridColumn: '1 / -1'}}>{fc.reason}</span></li>)}</ul>
                  </div>
                  <div className="qv-score" aria-label={`Score ${Math.round(m.score)} out of 100`}><b>{Math.round(m.score)}</b><span>/100</span></div>
                </li>
              ))}</ol>
              <p className="fine">Documented heuristics (size 30%, character 25%, type 20%, ability 15%, preferences 10%); provisional and not validated against real sessions.</p>
            </>
          )}
        </section>
      )}

      {section === 'compare' && (
        <section className="qv-panel" aria-label="Compare boards">
          <div className="form-grid">{[0, 1].map((k) => (
            <label key={k} className="field"><span>Board {k + 1}</span><select value={cmp[k]} onChange={(e) => setCmp(k ? [cmp[0], e.target.value] : [e.target.value, cmp[1]])}>{boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          ))}</div>
          <div className="qv-duel">
            {cmp.map((id, k) => { const b = boards.find((x) => x.id === id); return b ? <figure key={k}><BoardOutline b={b} scale={Math.min(4.2, 330 / Math.max(...cmp.map((c) => boards.find((x) => x.id === c)?.length ?? 1)))} /><figcaption><b>{b.name}</b><span className="fine">{b.type} · <span className="nw">{lengthLabel(b.length)}</span></span></figcaption></figure> : null; })}
          </div>
          <div className="tscroll" role="region" tabIndex={0} aria-label="Board comparison (scrolls sideways)"><table className="cmp"><thead><tr><th>Spec</th>{cmp.map((id, k) => <th key={k}>{boards.find((b) => b.id === id)?.name ?? '—'}</th>)}</tr></thead><tbody>
            {(['type', 'length', 'width', 'thickness', 'volume', 'fins'] as const).map((key) => <tr key={key}><td>{titleCase(key)}</td>{cmp.map((id, j) => { const v = boards.find((x) => x.id === id)?.[key];
              return <td key={j}>{v === undefined ? '—' : key === 'length' ? lengthLabel(v as number) : key === 'width' || key === 'thickness' ? inches(v as number) : key === 'volume' ? volumeLabel(boards.find((x) => x.id === id)!) : String(v)}</td>; })}</tr>)}
          </tbody></table></div>
        </section>
      )}
    </div>
  );
}
