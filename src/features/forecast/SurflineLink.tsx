import {surflineFor} from '../../data/cams';

/** A link to Surfline's own page for the spot, where Surfline lists a cam (surfline-links). LINK ONLY: an <a> that opens surfline.com in a new tab; no iframe, no embed, no thumbnail, no preview, nothing of Surfline is loaded
 *  by this page. Labelled as Surfline's, and honest that it may need a Surfline subscription. Under the Camera panel where there is one, as an extra. */
export function SurflineLink({spotId}: {spotId: string}) {
  const c = surflineFor(spotId); if (!c) return null;
  return <p className="sp-surfline">
    <a className="btn sp-surfline-a" href={c.url} target="_blank" rel="noopener noreferrer" aria-label={`Surfline cam for ${c.camName}: opens Surfline in a new tab. It is Surfline's camera and may need a Surfline subscription.`}>Surfline cam ↗</a>
    <small>Surfline's camera page for {c.camName} (Surfline's, not ours) · may need a Surfline subscription · opens surfline.com in a new tab</small>
  </p>;
}
