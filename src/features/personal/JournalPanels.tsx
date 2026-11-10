import {useRef, useState, type FormEvent} from 'react';
import type {Surfboard, SurfSession} from '../../models/index';
import {Condition, conditionWord} from '../../ui/Condition';
import {PIcon} from './icons';
import {creditText, entryDate, entryImage} from './parts';
import {ClipPanel} from './Clip';
import {PHOTO_MAX_BYTES, downscale, type JournalExtra, type JournalExtras} from './journal';

interface Common {sessions: SurfSession[]; extras: JournalExtras; spotName: (id: string) => string}

const titleOf = (s: SurfSession, x: JournalExtra | undefined, spotName: (id: string) => string) => x?.title?.trim() || spotName(s.spotId);
const notesOf = (s: SurfSession) => (s.notes === 'No notes' ? '' : s.notes);

function Tags({x}: {x: JournalExtra | undefined}) {
  if (!x) return null;
  const free = x.tags ?? [];
  if (!x.height && !x.cond && !x.swell && !free.length) return null;
  return (
    <ul className="pz-tags" aria-label="Tags">
      {x.height && <li>{x.height}</li>}
      {x.cond && <li><Condition category={x.cond} chip /></li>}
      {x.swell && <li>{x.swell}</li>}
      {free.map((t) => <li key={t}>{t}</li>)}
    </ul>
  );
}

export function Featured({s, x, spotName}: {s: SurfSession; x: JournalExtra | undefined; spotName: (id: string) => string}) {
  const img = entryImage(x, s.spotId);
  return (
    <article className="pz-feat">
      <div className="pz-feat-img" style={{backgroundImage: `url(${img.src})`}} role="img" aria-label={img.own ? 'Your photo' : `Photo of ${spotName(s.spotId)}`}>
        {!img.own && img.id && <small className="pz-credit">{creditText(img.id)}</small>}
      </div>
      <div className="pz-feat-b">
        <span className="pz-date">{entryDate(s.timestamp, s.spotId)} · {spotName(s.spotId)}</span>
        <h3>{titleOf(s, x, spotName)}</h3>
        {notesOf(s) && <p>{notesOf(s)}</p>}
        <Tags x={x} />
      </div>
    </article>
  );
}

function Row({s, x, spotName, i, onRemove}: {s: SurfSession; x: JournalExtra | undefined; spotName: (id: string) => string; i: number; onRemove?: () => void}) {
  const img = entryImage(x, s.spotId, i + 1);
  const meta = [x?.height, x?.cond ? conditionWord(x.cond) : null].filter(Boolean).join(' · ');
  const [clip, setClip] = useState(false);
  return (
    <li className="pz-row">
      <div className="pz-thumb" style={{backgroundImage: `url(${img.src})`}} role="img" aria-label={img.own ? 'Your photo' : `Photo of ${spotName(s.spotId)}`} title={img.id ? creditText(img.id) : undefined} />
      <div>
        <span className="pz-date">{entryDate(s.timestamp, s.spotId)} · {spotName(s.spotId)}</span>
        <b>{titleOf(s, x, spotName)}</b>
        {meta && <span className="pz-date">{meta}</span>}
        {notesOf(s) && !meta && <span className="pz-date pz-clip">{notesOf(s)}</span>}
      </div>
      <span className="pz-row-a">
        <button type="button" className="pz-clip-t" aria-expanded={clip} onClick={() => setClip(!clip)}>{clip ? 'Hide clip' : 'Add a clip'}</button>
        {onRemove && <button className="btn pz-icon-btn" aria-label={`Delete entry ${titleOf(s, x, spotName)}`} onClick={onRemove}><PIcon name="trash" size={16} /></button>}
      </span>
      {clip && <div className="pz-row-clip"><ClipPanel sessionId={s.id} title={titleOf(s, x, spotName)} /></div>}
    </li>
  );
}

export function JournalList({sessions, extras, spotName, onRemove}: Common & {onRemove: (id: string) => void}) {
  if (!sessions.length) return <p className="pz-empty">No sessions logged yet.</p>;
  const [first, ...rest] = sessions;
  return (
    <div className="pz-jlist">
      <Featured s={first} x={extras[first.id]} spotName={spotName} />
      <ul className="pz-rows">{[first, ...rest].slice(0, 30).map((s, i) => <Row key={s.id} s={s} x={extras[s.id]} spotName={spotName} i={i} onRemove={() => onRemove(s.id)} />)}</ul>
    </div>
  );
}

export interface LogObservation {observedAt: string; lo: string; hi: string; quality: number; barNote: string}
export interface LogInput {spotId: string; boardId: string; notes: string; satisfaction: number; title: string; tags: string[]; photo?: string; observation?: LogObservation}


export function LogForm({spots, boards, defaultSpot, onSubmit, onObserve, error}: {spots: {id: string; name: string}[]; boards: Surfboard[]; defaultSpot: string; heightUnit?: 'ft' | 'm'; onSubmit: (v: LogInput) => boolean | void; onObserve?: () => void; error: string}) {
  const [v, setV] = useState({spotId: defaultSpot, boardId: boards[0]?.id ?? '', notes: '', satisfaction: 3, title: '', tags: ''});
  const [photo, setPhoto] = useState<string | undefined>();
  const [photoErr, setPhotoErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const pick = async (file: File | undefined) => {
    if (!file) return;
    const out = await downscale(file, 1100);
    if (!out) { setPhotoErr('That image could not be read or shrunk under 200 KB.'); return; }
    setPhotoErr(''); setPhoto(out);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const done = onSubmit({...v, tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 6), photo});
    if (done === false) return;
    setV({...v, notes: '', title: '', tags: ''}); setPhoto(undefined); if (fileRef.current) fileRef.current.value = '';
  };
  return (
    <form onSubmit={submit} className="pz-panel pz-form" aria-label="Log a session">
      <h2>Log a session</h2>
      <label className="field"><span>Spot</span><select value={v.spotId} onChange={(e) => setV({...v, spotId: e.target.value})}>{spots.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label className="field"><span>Title (optional)</span><input value={v.title} maxLength={60} onChange={(e) => setV({...v, title: e.target.value})} placeholder="Clean morning at the point" /></label>
      <label className="field"><span>Board</span><select value={v.boardId} onChange={(e) => setV({...v, boardId: e.target.value})}><option value="">No board</option>{boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
      <label className="field"><span>How was it? {v.satisfaction}/5</span><input type="range" min={1} max={5} value={v.satisfaction} onChange={(e) => setV({...v, satisfaction: Number(e.target.value)})} /></label>
      <label className="field"><span>Notes</span><textarea value={v.notes} maxLength={500} onChange={(e) => setV({...v, notes: e.target.value})} placeholder="Crowd, banks, what worked" /></label>
      <label className="field"><span>Tags (comma separated)</span><input value={v.tags} onChange={(e) => setV({...v, tags: e.target.value})} placeholder="dawn patrol, new fins" /></label>
      <div className="field"><span>Photo (optional, saved on this device, under {PHOTO_MAX_BYTES / 1024} KB)</span>
        <input ref={fileRef} type="file" accept="image/*" aria-label="Photo" onChange={(e) => void pick(e.target.files?.[0])} />
        {photo && <div className="pz-prev" style={{backgroundImage: `url(${photo})`}} role="img" aria-label="Chosen photo preview" />}
        {photoErr && <p className="pz-err" role="alert">{photoErr}</p>}
      </div>
      {/* T-061: one way to record what you saw: the two-tap report on the spot page (T-060). Older forecast-check entries still show in Data & privacy and export. */}
      {onObserve && <p className="pzl-see">Saw the waves? <button type="button" className="pzl-see-a" onClick={onObserve}>Log what you saw on the spot page</button></p>}
      <p className="fine">Height, condition and swell tags come from the forecast when you log, if it is loaded.</p>
      {error && <p className="pz-err" role="alert">{error}</p>}
      <button className="btn primary" type="submit"><PIcon name="plus" size={16} />Log session</button>
    </form>
  );
}
