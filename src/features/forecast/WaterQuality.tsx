import {useEffect, useState} from 'react';
import {wqLine, type WqAnswer} from './waterQualityLogic';
import {wqStationFor} from '../../data/waterQualitySourced';

/** The spot page's one "Water quality" line (spec item 4). Nothing at all for a spot with no reviewed station; nothing if the agency does not answer. Loaded on view, from our Worker (which asks the agency). */
export function WaterQuality({spotId}: {spotId: string}) {
  const has = wqStationFor(spotId) !== null, [a, setA] = useState<WqAnswer | null>(null);
  useEffect(() => {
    setA(null); if (!has) return; const c = new AbortController();
    fetch(`/api/water-quality?spot=${encodeURIComponent(spotId)}`, {signal: c.signal}).then((r) => (r.ok ? r.json() : null)).then((j) => setA(j), () => {});
    return () => c.abort();
  }, [spotId, has]);
  const l = wqLine(a); if (!has || !l) return null;
  return <p className="sp-wq" data-testid="water-quality">
    <b>{l.label}</b>
    {l.text && <span className="sp-wq-t">{l.text}{l.date ? ` · ${l.date}` : ''}</span>}
    <a href={l.link} target="_blank" rel="noopener noreferrer">{l.linkText}</a>
    <small>{l.note ? `${l.note} · ` : ''}{l.credit}</small>
  </p>;
}
