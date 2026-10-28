import {useEffect, useRef, type MouseEvent} from 'react';
import {useAppData} from '../hooks/useAppData';
import {useForecast} from '../hooks/useForecast';
import {useNow} from '../hooks/useNow';
import {evidenceSpots} from '../ocean/spots';
import {ErrorBoundary} from '../components/ErrorBoundary';
import {Icon} from '../ui/Icon';
import {ForecastView} from '../features/forecast/ForecastView';
import {Settings} from './Settings';
import {Pending} from './Pending';
import {destinations, slugFor, spotIdForSlug, useRoute} from './routes';
import './shell.css';

export default function App() {
  const data = useAppData();
  const view = useForecast();
  const now = useNow();
  const {route, navigate} = useRoute();
  const settings = useRef<HTMLDialogElement>(null);

  // The URL owns the spot; the forecast state follows it. Unknown or mode-incompatible spots
  // are replaced in the URL rather than silently switching data mode.
  useEffect(() => {
    if (route.name !== 'forecast') return;
    const allowed = (id: string) => view.dataMode === 'Demonstration' || evidenceSpots.some(s => s.id === id);
    const requested = route.spotSlug ? spotIdForSlug(route.spotSlug) : null;
    if (!requested || !allowed(requested)) {
      const fallback = allowed(view.selected) ? view.selected : 'spot-2';
      navigate(`/forecast/${slugFor(fallback)}`, {replace: true});
    } else if (requested !== view.selected) {
      view.selectSpot(requested);
    }
  }, [route, view.dataMode, view.selected]); // eslint-disable-line react-hooks/exhaustive-deps

  const link = (path: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    navigate(path);
  };
  const pathFor = (name: string, path: string) => (name === 'forecast' ? `/forecast/${slugFor(view.selected)}` : path);
  const live = view.dataMode === 'Retrieved';

  const nav = (variant: 'top' | 'tab') => (
    <nav className={variant === 'top' ? 'topnav' : 'tabbar'} aria-label="Primary">
      {destinations.map(d => (
        <a
          key={d.name}
          href={pathFor(d.name, d.path)}
          aria-current={route.name === d.name ? 'page' : undefined}
          onClick={link(pathFor(d.name, d.path))}
        >
          {variant === 'tab' && <Icon name={d.name} />}
          <span>{d.label}</span>
        </a>
      ))}
    </nav>
  );

  return (
    <div className="shell">
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <a className="brand" href={pathFor('forecast', '/forecast')} onClick={link(pathFor('forecast', '/forecast'))}>
          SURF
        </a>
        {nav('top')}
        <div className="topbar-end">
          <button
            className="mode"
            data-live={live || undefined}
            onClick={() => settings.current?.showModal()}
            aria-label={`Data source: ${live ? 'live public data, experimental' : 'demonstration, not live'}. Change in settings.`}
          >
            <span className="mode-mark" aria-hidden="true" />
            {live ? 'Live data · experimental' : 'Demonstration · not live'}
          </button>
          <button className="icon-btn" onClick={() => settings.current?.showModal()} aria-label="Settings">
            <Icon name="settings" />
          </button>
        </div>
      </header>

      {data.error && (
        <div className="notice" role="alert">
          {data.error}{' '}
          <button className="btn btn-small" onClick={data.exportData}>
            Export backup
          </button>
        </div>
      )}

      <main id="main" className="main">
        <ErrorBoundary key={route.name} label="This view could not load">
          {route.name === 'forecast' && (
            <ForecastView
              view={view}
              data={data}
              now={now}
              onSelectSpot={id => navigate(`/forecast/${slugFor(id)}`)}
            />
          )}
          {route.name === 'explore' && <Pending title="Explore" checkpoint={4} />}
          {route.name === 'quiver' && <Pending title="Quiver" checkpoint={5} />}
          {route.name === 'scale' && <Pending title="Scale" checkpoint={5} />}
        </ErrorBoundary>
      </main>

      {nav('tab')}
      <Settings ref={settings} data={data} view={view} />
    </div>
  );
}
