import {useMemo, useState, type FormEvent} from 'react';
import type {ViewProps} from '../../app/routes';
import {useSwello} from '../../app/store';
import {boardTypes, type BoardType, type Surfboard} from '../../models/index';
import {scoreBoard} from '../../recommendation/board';
import {lengthLabel, parseDimension, validDimensions} from '../../utils/units';
import {Icon} from '../../ui/Icon';
import {StateMessage} from '../../ui/common';
import {titleCase} from '../forecast/model';

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
    <form className="card span-12" onSubmit={submit} aria-label={initial ? 'Edit board' : 'Add board'}>
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

  if (editing) return <div className="grid"><BoardForm initial={editing === 'new' ? undefined : editing} onCancel={() => setEditing(null)} onSave={(b) => { data.saveBoard(b); select(b.id); setEditing(null); }} /></div>;
  if (!boards.length) return <StateMessage title="Your quiver is empty" action={<button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} />Add your first board</button>} />;

  return (
    <div className="grid">
      {(section === '' || section === 'showroom') && sel && (
        <div className="showroom span-12">
          <div className="stage" aria-label="Board showroom"><BoardOutline b={sel} scale={Math.min(5.2, 420 / sel.length)} /></div>
          <section className="card" aria-label="Board details">
            <div className="card-h"><h2>{sel.name}</h2>{sel.demo ? <span className="chip demo">Example board</span> : <span className="fine">{sel.specificationSource ?? ''}</span>}</div>
            <p className="fine">{[sel.manufacturer, sel.model].filter(Boolean).join(' · ') || 'Shaper not recorded'} · {sel.type}</p>
            <dl className="kv" style={{margin: '12px 0'}}>
              <dt>Length</dt><dd>{lengthLabel(sel.length)}</dd><dt>Width</dt><dd>{inches(sel.width)}</dd><dt>Thickness</dt><dd>{inches(sel.thickness)}</dd><dt>Volume</dt><dd>{sel.volume} L</dd>
              {sel.fins && <><dt>Fins</dt><dd>{sel.fins}</dd></>}{sel.tail && <><dt>Tail</dt><dd>{sel.tail}</dd></>}{sel.notes && <><dt>Notes</dt><dd>{sel.notes}</dd></>}
            </dl>
            <p className="fine">The outline is a {sel.type.toLowerCase()} category shape drawn to these dimensions, not this exact board. Photoreal boards need production 3D models.</p>
            <div style={{display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap'}}>
              <button className="btn" onClick={() => setEditing(sel)}><Icon name="edit" size={16} />Edit</button>
              {!confirmDel ? <button className="btn danger" onClick={() => setConfirmDel(true)}><Icon name="trash" size={16} />Delete</button>
                : <button className="btn danger" onClick={() => { data.deleteBoard(sel.id); setConfirmDel(false); }}>Confirm delete {sel.name}</button>}
              <button className="btn" onClick={() => go('quiver', 'match')}>Board Match</button>
            </div>
          </section>
        </div>
      )}
      {section === '' && (
        <section className="span-12" aria-label="My boards">
          <div className="card-h"><h2>My boards · {boards.length}</h2><button className="btn primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} />Add board</button></div>
          <div className="boards">{boards.map((b) => (
            <button key={b.id} className="board" aria-pressed={b.id === sel?.id} onClick={() => select(b.id)} aria-label={`${b.name}, ${lengthLabel(b.length)}`}>
              <span className="stage"><span style={{transform: 'rotate(90deg)'}}><BoardOutline b={b} scale={180 / 120} /></span></span>
              <span className="meta"><b>{b.name}</b><span>{lengthLabel(b.length)} × {inches(b.width)} · {b.volume} L{b.demo ? ' · example' : ''}</span></span>
            </button>
          ))}</div>
        </section>
      )}
      {section === 'match' && (
        <section className="card span-12" aria-label="Board match">
          <div className="card-h"><h2>Board Match</h2><span>{view.spot.name} at the selected hour · {p.skill}</span></div>
          {!faceOk ? (
            <StateMessage title="Board Match needs a breaking-wave estimate" action={view.dataMode === 'Retrieved' ? <button className="btn" onClick={() => view.setDataMode('Demonstration')}>Try the demonstration week</button> : undefined}>
              Live data has offshore wave height only, and offshore height is not the size of the waves a board will ride. SWELLO withholds a recommendation rather than guess.
            </StateMessage>
          ) : (
            <>
              {view.dataMode === 'Demonstration' && <p style={{marginBottom: 10}}><span className="chip demo">Demonstration week · illustrative</span></p>}
              <ul className="journal">{matches.map((m, k) => (
                <li key={m.board.id}><b>{k + 1}. {m.board.name} · {Math.round(m.score)}/100{m.eligible ? '' : ' · outside your ability or range'}{m.limited ? ' · limited board data' : ''}</b>
                  <ul className="factors">{m.factors.map((fc) => <li key={fc.name}><span>{fc.name} <span className="fine">· weight {Math.round(fc.weight * 100)}%</span></span><span>{Math.round(fc.score)}</span><span className="bar"><i style={{width: `${fc.score}%`}} /></span><span className="fine" style={{gridColumn: '1 / -1'}}>{fc.reason}</span></li>)}</ul>
                </li>
              ))}</ul>
              <p className="fine" style={{marginTop: 8}}>Documented heuristics (size 30%, character 25%, type 20%, ability 15%, preferences 10%); not validated against real sessions.</p>
            </>
          )}
        </section>
      )}
      {section === 'compare' && (
        <section className="card span-12" aria-label="Compare boards">
          <div className="card-h"><h2>Compare boards</h2><span>drawn to the same scale</span></div>
          <div className="form-grid">{[0, 1].map((k) => (
            <label key={k} className="field"><span>Board {k + 1}</span><select value={cmp[k]} onChange={(e) => setCmp(k ? [cmp[0], e.target.value] : [e.target.value, cmp[1]])}>{boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          ))}</div>
          <div style={{display: 'flex', gap: 32, justifyContent: 'center', alignItems: 'flex-end', padding: '20px 0', overflowX: 'auto'}}>
            {cmp.map((id, k) => { const b = boards.find((x) => x.id === id); return b ? <div key={k} style={{textAlign: 'center'}}><BoardOutline b={b} scale={3.2} color={k ? 'var(--hs-hi)' : 'var(--board-a)'} /><p><b>{b.name}</b></p></div> : null; })}
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
