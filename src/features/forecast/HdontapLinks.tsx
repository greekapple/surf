import {hdontapLinksFor} from '../../data/hdontapLinksSourced';
import {liveCamsFor} from '../../data/liveCamsSourced';
import {useEmbedAllowed} from './embedAllowed';
import {hasSnapshot} from '../../ocean/hdontapCams';

/** "HDOnTap cam ↗" links (hdontap-embeds): LINK for every camera HDOnTap's player cannot yet be framed for (it only allows sites HDOnTap lists; see embedAllowed.ts), so each such camera is a link to its own stream page, in a new tab. Nothing from HDOnTap is
 *  loaded by this page; no iframe, no thumbnail, no preview. Each link says whose camera it is ("Swell Magnet via HDOnTap"), what the camera list says it shows, about how far it is, and "down"/"stale" where the list says so. */
/** Audit F14 / A16: one camera is listed once. `exclude`: camera URLs already linked above (the spot's Cams block); compared without scheme, "www." or a trailing slash. */
const sameUrl = (u: string) => u.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[/?#]+$/, '');
export function HdontapLinks({spotId, exclude = []}: {spotId: string; exclude?: string[]}) {
  const all = hdontapLinksFor(spotId), embedIds = all.filter((l) => l.embedId && liveCamsFor(spotId).some((c) => c.kind === 'hdontap' && c.embedId === l.embedId)).map((l) => l.embedId!), allowed = useEmbedAllowed(embedIds);
  const shown = new Set(exclude.map(sameUrl));
  const links = all.filter((l) => !(l.embedId && allowed[l.embedId] === true) && !shown.has(sameUrl(l.url)) && !hasSnapshot(l.url, spotId));   // hdontap-snaps: a camera with a snapshot is in the snapshot block instead   // a camera the Camera panel shows (HDOnTap allows our site) needs no link; the others keep theirs
  if (!links.length) return null;
  return <section className="sp-hd" aria-label="HDOnTap cameras (links)">
    <ul>{links.map((l) => <li key={l.id}>
      <a className="btn sp-hd-a" href={l.url} target="_blank" rel="noopener noreferrer" aria-label={`HDOnTap cam, ${l.label}: ${l.name}. Opens its page in a new tab.`}>HDOnTap cam ↗</a>
      <small><b>{l.label}</b> · {l.name} · {l.view} · {l.km < 0.1 ? 'at this spot (within about 100 m)' : `about ${l.km} km from this spot`}{l.status ? ` · listed as ${l.status} on ${l.statusChecked}` : ''} · opens their page</small>
    </li>)}</ul>
  </section>;
}
