import {Component, useState, type ReactNode} from 'react';
import {GENERIC_PHOTOS, PHOTOS, SPOT_PHOTOS} from './photos';
import {Icon} from './Icon';

/** Credited location photo. Only photos that genuinely show the spot are used; otherwise a generic image labelled as such. */
export function SpotPhoto({spotId, index = 0, className = '', children, height}: {spotId: string; index?: number; className?: string; children?: ReactNode; height?: number}) {
  const list = SPOT_PHOTOS[spotId];
  const id = list ? list[index % list.length] : GENERIC_PHOTOS[index % GENERIC_PHOTOS.length];
  const p = PHOTOS[id];
  const [ready, setReady] = useState(false);
  return (
    <figure className={`photo ${className}`} style={height ? {height} : undefined}>
      <img
        src={`/photos/${id}-1600.jpg`}
        srcSet={`/photos/${id}-800.jpg 800w, /photos/${id}-1600.jpg 1600w`}
        sizes="(max-width: 860px) 100vw, 60vw"
        alt={p.generic ? 'Generic ocean photograph (not this spot)' : `${p.location}`}
        className={ready ? 'ready' : ''}
        onLoad={() => setReady(true)}
        loading="lazy"
        decoding="async"
      />
      <figcaption className="credit">
        {p.generic ? 'Generic photo, not this spot · ' : ''}
        <a href={p.source} target="_blank" rel="noreferrer">{p.photographer || 'Wikimedia Commons'}</a> · <a href={p.licenseUrl} target="_blank" rel="noreferrer">{p.license}</a>
      </figcaption>
      {children && <div className="photo-body">{children}</div>}
    </figure>
  );
}

export function StateMessage({title, children, action}: {title: string; children?: ReactNode; action?: ReactNode}) {
  return <div className="state" role="status"><b>{title}</b>{children && <span>{children}</span>}{action}</div>;
}

/** Camera foundation: honest states only. No feed is shown unless an authorised source exists. */
export function CameraPanel({spotName}: {spotName: string}) {
  return (
    <section className="card" aria-label="Surf camera">
      <div className="card-h"><h3>Surf camera</h3><span className="chip">Planned</span></div>
      <div className="cam">
        <div className="screen" aria-hidden="true"><Icon name="camera" size={22} /></div>
        <div>
          <p><b>No authorised camera for {spotName} yet.</b></p>
          <p className="fine">Live cameras and AI-assisted wave observations are a future feature. SWELLO never shows a demo as a live stream and does not use restricted camera feeds.</p>
        </div>
      </div>
    </section>
  );
}

export class ErrorBoundary extends Component<{children: ReactNode; label: string}, {failed: boolean}> {
  state = {failed: false};
  static getDerivedStateFromError() { return {failed: true}; }
  render() {
    return this.state.failed
      ? <StateMessage title={`${this.props.label} could not load`} action={<button className="btn" onClick={() => this.setState({failed: false})}>Try again</button>}>Your saved data is unchanged.</StateMessage>
      : this.props.children;
  }
}
