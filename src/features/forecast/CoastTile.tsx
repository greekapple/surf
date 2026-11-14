import {useEffect, useState} from 'react';
import {arrowGeom, compass16, facingShore, landPath, TILE, windowPath} from '../../services/coastTile';

/** forecast-visuals: the coastline tiles (src/data/coastTiles.json, OpenStreetMap; tools/coast-tiles/build-coast-tiles.py), loaded once, on first use (about 130 KB). */
type TileDoc = {source: string; tiles: Record<string, {rings: number[][]; land: number}>};
let doc: Promise<TileDoc> | null = null;
const loadTiles = () => (doc ??= import('../../data/coastTiles.json').then((m) => m.default as unknown as TileDoc));
export const OSM_COPYRIGHT = 'https://www.openstreetmap.org/copyright';

/** the arrow's colour: a swell's period step (the chart key's shades) or a 2nd/3rd swell's line colour; the wind's shore relation */
export interface TileArrow {from: number; tone: 'short' | 'mid' | 'long' | 'sw2' | 'sw3' | 'off' | 'cross' | 'on' | 'unk'}
/** A small square map of the spot's coast (north up, 5 km across, the pin in the middle) with the beach's open-water window and one arrow from where the swell or wind
 *  comes. A schematic: the caption (or, small, the title and the aria text) says the coastline is simplified from OpenStreetMap and credits it. A spot with no coastline
 *  data shows its facing line only, and says that instead. */
export function CoastTile({spotId, facing, arrow, label, size = 64, caption = false}: {spotId: string; facing: number | null; arrow: TileArrow | null; label: string; size?: number; caption?: boolean}) {
  const [tiles, setTiles] = useState<TileDoc | null>(null);
  useEffect(() => { let on = true; loadTiles().then((d) => on && setTiles(d)).catch(() => {}); return () => { on = false; }; }, []);
  const t = tiles?.tiles[spotId], loading = !tiles;
  const what = t ? 'coastline simplified from OpenStreetMap, 5 km across, north up' : loading ? 'coastline loading' : facing !== null ? 'no coastline data for this spot yet: the line is the beach\'s facing, not a mapped shore' : 'no coastline data for this spot yet';
  const aria = `${label}${arrow ? `, from the ${compass16(arrow.from)}` : ''}. Map: ${what}${t ? ' (© OpenStreetMap contributors)' : ''}${facing !== null ? `; shaded: the direction the beach faces (${compass16(facing)}), ±55°, a display, not a measured swell window` : ''}; dot: the spot's pin (approximate); the arrow comes from where it blows and points where it travels.`;
  const a = arrow ? arrowGeom(arrow.from) : null, big = size >= 110;
  return (
    <figure className={`ct${big ? ' ct-big' : ''}`} style={{width: size}}>
      <svg viewBox={`0 0 ${TILE} ${TILE}`} width={size} height={size} role="img" aria-label={aria}>
        <title>{aria}</title>
        <rect width={TILE} height={TILE} fill="var(--tile-sea)" />
        {facing !== null && <path d={windowPath(facing)} fill="var(--tile-window)" />}
        {t && <path d={landPath(t.rings)} fill="var(--tile-land)" fillRule="evenodd" stroke="var(--tile-shore)" strokeWidth={big ? 8 : 12} strokeLinejoin="round" />}
        {!t && !loading && facing !== null && <path d={facingShore(facing)} stroke="var(--tile-shore)" strokeWidth={big ? 12 : 18} strokeDasharray="40 28" strokeLinecap="round" />}
        {a && <g className={`ct-arrow ${['short', 'mid', 'long', 'off', 'cross', 'on', 'unk'].includes(arrow!.tone) ? `ca-${arrow!.tone}` : `ct-${arrow!.tone}`}`}><path d={a.shaft} strokeWidth={big ? 40 : 56} strokeLinecap="round" fill="none" /><path d={a.head} strokeWidth={big ? 22 : 30} strokeLinejoin="round" /></g>}
        <circle cx={500} cy={500} r={big ? 26 : 38} fill="var(--text)" stroke="var(--tile-sea)" strokeWidth={big ? 12 : 16} />
        {big && <text x={500} y={86} textAnchor="middle" fontSize={64} fontWeight={650} fill="var(--muted)">N</text>}
      </svg>
      {caption ? <figcaption className="ct-cap">{t ? <>Coastline simplified from <a href={OSM_COPYRIGHT} target="_blank" rel="noopener noreferrer">© OpenStreetMap</a> contributors · 5 km across, north up</> : loading ? ' ' : facing !== null ? 'No coastline data yet: dashed line = the beach\'s facing' : 'No coastline data yet'}</figcaption>
        : !t && !loading ? <figcaption className="ct-cap">facing only</figcaption> : null /* small tiles: the block they sit in credits OpenStreetMap once (CoastCredit) */}
    </figure>
  );
}

/** The coastline credit for a block of small tiles, shown only when this spot HAS a coastline tile (no OpenStreetMap credit where no OpenStreetMap data is drawn). */
export function CoastCredit({spotId, prefix = ' · the small maps: '}: {spotId: string; prefix?: string}) {
  const [tiles, setTiles] = useState<TileDoc | null>(null);
  useEffect(() => { let on = true; loadTiles().then((d) => on && setTiles(d)).catch(() => {}); return () => { on = false; }; }, []);
  return tiles?.tiles[spotId] ? <>{prefix}coastline simplified from <a href={OSM_COPYRIGHT} target="_blank" rel="noopener noreferrer">© OpenStreetMap</a> contributors</> : null;
}
