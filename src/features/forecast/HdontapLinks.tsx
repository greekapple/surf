import {hdontapLinksFor} from '../../data/hdontapLinksSourced';

/** "HDOnTap cam ↗" links (hdontap-embeds): LINK ONLY. HDOnTap's player cannot be framed by our site (it only allows sites HDOnTap approves), so each camera is a link to its own stream page, in a new tab. Nothing from HDOnTap is
 *  loaded by this page; no iframe, no thumbnail, no preview. Each link says whose camera it is ("Swell Magnet via HDOnTap"), what the camera list says it shows, about how far it is, and "down"/"stale" where the list says so. */
export function HdontapLinks({spotId}: {spotId: string}) {
  const links = hdontapLinksFor(spotId); if (!links.length) return null;
  return <section className="sp-hd" aria-label="HDOnTap cameras (links)">
    <ul>{links.map((l) => <li key={l.id}>
      <a className="btn sp-hd-a" href={l.url} target="_blank" rel="noopener noreferrer" aria-label={`HDOnTap cam, ${l.label}: ${l.name}. Opens its page in a new tab.`}>HDOnTap cam ↗</a>
      <small><b>{l.label}</b> · {l.name} · {l.view} · {l.km < 0.1 ? 'at this spot (within about 100 m)' : `about ${l.km} km from this spot`}{l.status ? ` · listed as ${l.status} on ${l.statusChecked}` : ''} · opens their page</small>
    </li>)}</ul>
  </section>;
}
