import {useMemo, useState, type FormEvent} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {boardTypes, type BoardType, type Surfboard} from '../../models/index';
import {scoreBoard} from '../../recommendation/board';
import {lengthLabel, parseDimension, validDimensions} from '../../utils/units';
import {Icon} from '../../ui/Icon';
import {StateMessage} from '../../ui/common';
import {titleCase} from '../forecast/model';
import './quiver.css';

/** Category outline drawn to the board's real length and width. Not an exact shape. */
export function BoardOutline({b, scale = 3.4, color = 'var(--board-a)'}: {b: Pick<Surfboard, 'length' | 'width' | 'type'>; scale?: number; color?: string}) {
  const L = b.length * scale, W = b.width * scale, t = b.type;
  const nose = t === 'Longboard' || t === 'Funboard' || t === 'Soft-top' ? 0.62 : t === 'Fish' || t === 'Midlength' || t === 'Hybrid' || t === 'Groveler' ? 0.42 : 0.2;
  const tail = t === 'Gun' || t === 'Step-up' ? 0.22 : t === 'Fish' ? 0.68 : 0.5;
  const wide = t === 'Fish' ? 0.55 : t === 'Gun' ? 0.42 : 0.48;
  const hw = W / 2, cx = hw, y = (f: number) => f * L;
  const right = `M${cx},0 C${cx + hw * nose},${y(0.02)} ${cx + hw},${y(wide - 0.22)} ${cx + hw},${y(wide)} C${cx + hw},${y(wide + 0.28)} ${cx + hw * tail * 1.25},${y(0.93)} ${cx + hw * tail},${L}`;
  const swallow = t === 'Fish' ? `L${cx},${L - W * 0.18}` : '';
  const left = `L${cx - hw * tail},${L} C${cx - hw * tail * 1.25},${y(0.93)} ${cx - hw},${y(wide + 0.28)} ${cx - hw},${y(wide)} C${cx - hw},${y(wide - 0.22)} ${cx - hw * nose},${y(0.02)} ${cx},0Z`;
  return (
    <svg className="outline-svg" width={W + 2} height={L + 2} viewBox={`-1 -1 ${W + 2} ${L + 2}`} role="img" aria-label={`${b.type} outline, ${lengthLabel(b.length)} by ${b.width} inches, category approximation`}>
      <path d={`${right} ${swallow} ${left}`} fill={color} fillOpacity={0.92} stroke="var(--board-line)" />
      <line x1={cx} x2={cx} y1={4} y2={L - 4} stroke="var(--board-line)" strokeOpacity={0.6} />
    </svg>
  );
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** Whole inches plus the fraction in lowest sixteenths (2.625 → 2 5/8″). */
const inches = (v: number) => {
  let w = Math.floor(v), n = Math.round((v - w) * 16);
  if (n === 16) { w += 1; n = 0; }
  const g = gcd(n, 16);
  return `${w}${n ? ` ${n / g}/${16 / g}` : ''}″`;
};
const emptyForm = {name: '', manufacturer: '', model: '', type: 'Everyday shortboard' as BoardType, length: `6'0"`, width: '19 1/4', thickness: '2 1/2', volume: '30', fins: 'Thruster', tail: '', notes: ''};

function BoardForm({initial, onSave, onCancel}: {initial?: Surfboard; onSave: (b: Surfboard) => void; onCancel: () => void}) {
  const [f, setF] = useState(() => initial ? {name: initial.name, manufacturer: initial.manufacturer, model: initial.model, type: initial.type,
    length: `${Math.floor(initial.length / 12)}'${+(initial.length % 12).toFixed(2)}"`, width: String(initial.width), thickness: String(initial.thickness),
    volume: String(initial.volume), fins: initial.fins ?? '', tail: initial.tail ?? '', notes: initial.notes ?? ''} : emptyForm);
  const [err, setErr] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const length = parseDimension(f.length, true), width = parseDimension(f.width), thickness = parseDimension(f.thickness), volume = Number(f.volume);
    if (!f.name.trim()) return setErr('Give the board a name.');
    if (!validDimensions(length, width, thickness, volume)) return setErr(`Check the dimensions: length like 6'0", width and thickness in inches (fractions allowed), volume in litres that fits those dimensions.`);
    onSave({...(initial ?? {favorite: false}), id: initial?.id ?? crypto.randomUUID(), name: f.name.trim(), manufacturer: f.manufacturer.trim(), model: f.model.trim(), type: f.type,
      length, width, thickness, volume, fins: f.fins || undefined, tail: f.tail || undefined, notes: f.notes || undefined, demo: false, specificationSource: 'Entered by you'});
  };
  const field = (k: keyof typeof f, label: string, extra = {}) => <label className="field"><span>{label}</span><input value={f[k]} onChange={(e) => setF({...f, [k]: e.target.value})} {...extra} /></label>;
  return (
    <form className="card qv-form" onSubmit={submit} aria-label={initial ? 'Edit board' : 'Add board'}>
      <div className="card-h"><h2>{initial ? `Edit ${initial.name}` : 'Add a board'}</h2><span>Use the numbers on the stringer or from the shaper</span></div>
      <div className="form-grid">
        {field('name', 'Name', {required: true, maxLength: 40})}{field('manufacturer', 'Shaper / brand')}{field('model', 'Model')}
        <label className="field"><span>Type</span><select value={f.type} onChange={(e) => setF({...f, type: e.target.value as BoardType})}>{boardTypes.map((t) => <option key={t}>{t}</option>)}</select></label>
        {field('length', `Length (e.g. 6'0")`)}{field('width', 'Width (in)')}{field('thickness', 'Thickness (in)')}{field('volume', 'Volume (L)', {inputMode: 'decimal'})}{field('fins', 'Fins')}{field('tail', 'Tail')}
      </div>
      <label className="field" style={{marginTop: 12}}><span>Notes</span><textarea value={f.notes} onChange={(e) => setF({...f, notes: e.target.value})} /></label>
      {err && <p role="alert" style={{color: 'var(--warn)', marginTop: 8}}>{err}</p>}
      <div style={{display: 'flex', gap: 8, marginTop: 12}}><button className="btn primary" type="submit">Save board</button><button className="btn" type="button" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

const TITLES: Record<string, {h: string; sub: string}> = {
  '': {h: 'My Boards', sub: 'Your collection'},
  showroom: {h: 'Showroom', sub: 'Boards lined up at one scale'},
  match: {h: 'Board Match', sub: 'Which board for these conditions'},
  compare: {h: 'Compare Boards', sub: 'Two boards side by side, same scale'},
};

export function QuiverView({section, go}: ViewProps) {
  const {data, view, prefs, setPrefs} = useSwello();
  const boards = data.state.boards, p = data.state.profile;
  const [editing, setEditing] = useState<Surfboard | 'new' | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [cmp, setCmp] = useState<[string, string]>([boards[0]?.id ?? '', boards[1]?.id ?? boards[0]?.id ?? '']);
  const sel = boards.find((b) => b.id === prefs.selectedBoardId) ?? boards[0];
  const select = (id: string) => { setPrefs({selectedBoardId: id}); setConfirmDel(false); };
  const f = view.forecast;
  const matches = useMemo(() => boards.map((b) => scoreBoard(b, f, p)).sort((a, b) => b.score - a.score), [boards, f, p]);
  const faceOk = f.availability.face && Number.isFinite(f.face) && !!f.character && f.character !== 'Unknown';

  if (editing) return <div className="qv"><BoardForm initial={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSave={(b) => { data.saveBoard(b); select(b.id); setEditing(null); }} /></div>;
  if (!boards.length) return <StateMessage title="Your quiver is empty" action={<button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} />Add your first board</button>} />;

  const t = TITLES[section] ?? TITLES[''];
  const maxLen = Math.max(...boards.map((b) => b.length));
  const idx = sel ? boards.findIndex((b) => b.id === sel.id) : 0;
  const step = (d: number) => select(boards[(idx + d + boards.length) % boards.length].id);
  const A = (b: Surfboard) => (
    <div className="qv-actions">
      <button className="btn" onClick={() => setEditing(b)}><Icon name="edit" size={16} />Edit</button>
      {!confirmDel ? <button className="btn danger" onClick={() => setConfirmDel(true)}><Icon name="trash" size={16} />Delete</button>
        : <button className="btn danger" onClick={() => { data.deleteBoard(b.id); setConfirmDel(false); }}>Confirm delete {b.name}</button>}
    </div>
  );
  const tag = (b: Surfboard) => b.demo ? <span className="chip demo">Example board</span> : <span className="fine">{b.specificationSource ?? ''}</span>;
  const specs = (b: Surfboard) => (
    <dl className="qv-specs">
      <div><dt>Length</dt><dd>{lengthLabel(b.length)}</dd></div><div><dt>Width</dt><dd>{inches(b.width)}</dd></div>
      <div><dt>Thickness</dt><dd>{inches(b.thickness)}</dd></div><div><dt>Volume</dt><dd>{b.volume} L</dd></div>
    </dl>
  );

  return (
    <div className="qv">
      <header className="qv-head">
        <div><h1>{t.h}</h1><p className="fine">{t.sub} · {boards.length} {boards.length === 1 ? 'board' : 'boards'}</p></div>
        <button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} />Add Board</button>
      </header>

      {section === '' && (
        <>
          <ul className="qv-grid">{boards.map((b) => (
            <li key={b.id}>
              <button className="qv-card" aria-pressed={b.id === sel?.id} onClick={() => select(b.id)} aria-label={`${b.name}, ${lengthLabel(b.length)}`}>
                <span className="qv-card-stage"><BoardOutline b={b} scale={170 / maxLen} /></span>
                <span className="qv-card-meta"><b>{b.name}</b><span>{b.type}</span><span>{lengthLabel(b.length)} × {inches(b.width)} × {inches(b.thickness)}</span><span>{b.volume} L{b.demo ? ' · example' : ''}</span></span>
              </button>
            </li>
          ))}</ul>
          {sel && (
            <section className="qv-selected" aria-label="Selected board">
              <div><h2>{sel.name}</h2><p className="fine">{[sel.manufacturer, sel.model].filter(Boolean).join(' · ') || 'Shaper not recorded'} · {sel.type}</p></div>
              <div className="qv-actions"><button className="btn" onClick={() => go('quiver', 'showroom')}>Open in Showroom</button>{A(sel)}</div>
            </section>
          )}
        </>
      )}

      {section === 'showroom' && sel && (
        <section className="qv-show" aria-label="Board showroom">
          <div className="qv-lineup" role="group" aria-label="Boards lined up at the same scale">
            <button className="qv-arrow l" aria-label="Previous board" onClick={() => step(-1)}><Icon name="chevron" size={22} /></button>
            <div className="qv-row">{boards.map((b) => (
              <button key={b.id} className="qv-stand" aria-pressed={b.id === sel.id} aria-label={`${b.name}, ${lengthLabel(b.length)}`} onClick={() => select(b.id)}>
                <BoardOutline b={b} scale={Math.min(6, 430 / maxLen)} />
              </button>
            ))}</div>
            <button className="qv-arrow r" aria-label="Next board" onClick={() => step(1)}><Icon name="chevron" size={22} /></button>
          </div>
          <div className="qv-info">
            <div className="qv-info-main">
              <h2>{sel.name}</h2>
              <p className="fine">{[sel.manufacturer, sel.model].filter(Boolean).join(' · ') || 'Shaper not recorded'}</p>
              <div className="qv-tags"><span className="chip">{sel.type}</span>{sel.fins && <span className="chip">{sel.fins}</span>}{sel.tail && <span className="chip">{sel.tail} tail</span>}{tag(sel)}</div>
              {sel.notes && <p className="fine">{sel.notes}</p>}
            </div>
            <div className="qv-info-spec">
              {specs(sel)}
              <div className="qv-actions">{A(sel)}<button className="btn" onClick={() => go('quiver', 'match')}>Board Match</button></div>
            </div>
          </div>
          <p className="fine">Outlines are {sel.type.toLowerCase()} category shapes drawn to each board's length and width, not the exact boards. Photoreal boards need production 3D models.</p>
          <ul className="qv-strip" aria-label="Choose a board">{boards.map((b) => (
            <li key={b.id}><button aria-pressed={b.id === sel.id} aria-label={b.name} title={b.name} onClick={() => select(b.id)}><BoardOutline b={b} scale={64 / maxLen} /></button></li>
          ))}</ul>
        </section>
      )}

      {section === 'match' && (
        <section className="qv-panel" aria-label="Board match">
          <p className="fine">{view.spot.name} at the selected hour · {p.skill}</p>
          {!faceOk ? (
            <StateMessage title="Board Match needs a breaking-wave estimate" action={view.dataMode === 'Retrieved' ? <button className="btn" onClick={() => view.setDataMode('Demonstration')}>Try the demonstration week</button> : undefined}>
              Live data has offshore wave height only, and offshore height is not the size of the waves a board will ride. SWELLO withholds a recommendation rather than guess.
            </StateMessage>
          ) : (
            <>
              {view.dataMode === 'Demonstration' && <p><span className="chip demo">Demonstration week · illustrative</span></p>}
              <ol className="qv-ranks">{matches.map((m, k) => (
                <li key={m.board.id} className={k === 0 ? 'top' : ''}>
                  <div className="qv-rank-b"><BoardOutline b={m.board} scale={(k === 0 ? 150 : 90) / maxLen} /></div>
                  <div className="qv-rank-t">
                    <span className="qv-rank-n">{k === 0 ? 'Best match' : `#${k + 1}`}</span>
                    <h2>{m.board.name}</h2>
                    <p className="fine">{m.board.type} · {lengthLabel(m.board.length)} · {m.board.volume} L{m.eligible ? '' : ' · outside your ability or range'}{m.limited ? ' · limited board data' : ''}</p>
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
            {cmp.map((id, k) => { const b = boards.find((x) => x.id === id); return b ? <figure key={k}><BoardOutline b={b} scale={Math.min(4.2, 330 / Math.max(...cmp.map((c) => boards.find((x) => x.id === c)?.length ?? 1)))} color={k ? 'var(--hs-hi)' : 'var(--board-a)'} /><figcaption><b>{b.name}</b><span className="fine">{b.type} · {lengthLabel(b.length)}</span></figcaption></figure> : null; })}
          </div>
          <div className="tscroll" role="region" tabIndex={0} aria-label="Board comparison (scrolls sideways)"><table className="cmp"><thead><tr><th>Spec</th>{cmp.map((id, k) => <th key={k}>{boards.find((b) => b.id === id)?.name ?? '—'}</th>)}</tr></thead><tbody>
            {(['type', 'length', 'width', 'thickness', 'volume', 'fins'] as const).map((key) => <tr key={key}><td>{titleCase(key)}</td>{cmp.map((id, j) => { const v = boards.find((x) => x.id === id)?.[key];
              return <td key={j}>{v === undefined ? '—' : key === 'length' ? lengthLabel(v as number) : key === 'width' || key === 'thickness' ? inches(v as number) : key === 'volume' ? `${v} L` : String(v)}</td>; })}</tr>)}
          </tbody></table></div>
        </section>
      )}
    </div>
  );
}
