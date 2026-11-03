import {lazy, Suspense, useEffect} from 'react';
import {SwelloProvider} from './store';
import {useRoute} from './routes';
import {TabBar, TopNav} from './Nav';
import {SpotStrip} from '../features/home/SpotStrip';
import {ErrorBoundary, StateMessage} from '../ui/common';
import {HomeView} from '../features/home/HomeView';
import {useThemeSync} from '../ui/theme';
import {Footer, Legal} from '../ui/Legal';
import '../ui/app.css';

// T-091: only Home is in the first bundle. Every other area (and with it Leaflet, the map's land data, Three.js, the quiver studio) loads when it is opened;
// Forecast (the likeliest next tap, ~22 KB gzip) is prefetched when the browser is idle; Map and Quiver load on demand.
const lazyArea = <T,>(load: () => Promise<T>, pick: (m: T) => React.ComponentType<any>) => lazy(() => load().then((m) => ({default: pick(m)})));
const ForecastView = lazyArea(() => import('../features/forecast/ForecastView'), (m) => m.ForecastView);
const ExploreView = lazyArea(() => import('../features/explore/ExploreView'), (m) => m.ExploreView);
const QuiverView = lazyArea(() => import('../features/quiver/QuiverView'), (m) => m.QuiverView);
const PersonalView = lazyArea(() => import('../features/personal/PersonalView'), (m) => m.PersonalView);
const prefetch = [() => import('../features/forecast/ForecastView')]; // the likeliest next tap; Map (Leaflet + land data, ~240 KB gzip) and Quiver load on demand
// Three.js loads only when the Wave Scale section of Forecast opens.
const ScaleView = lazy(() => import('../features/scale/ScaleView').then((m) => ({default: m.ScaleView})));

export default function App() {
  useThemeSync();
  useEffect(() => { // idle prefetch of the other areas (a few hundred ms after first render, when the main thread is free)
    const run = async () => { for (const load of prefetch) { try { await load(); } catch { /* offline: the area loads on demand */ } } };
    const idle = (window as any).requestIdleCallback as ((cb: () => void, o?: {timeout: number}) => number) | undefined;
    const id = idle ? idle(run, {timeout: 4000}) : window.setTimeout(run, 2500);
    return () => { if (!idle) clearTimeout(id); };
  }, []);
  const {route, navigate} = useRoute();
  const {area, section} = route;
  // The ocean map is full-bleed under the bar; its own panels hold its controls. There are no section pills anywhere (T-022):
  // sections are reached from the bar's menus and flyouts.
  const bleed = area === 'explore' && section !== 'discover' && section !== 'compare';
  // Pages that open on a full-bleed photograph start under the fixed header and offset their text by --nav-h.
  const photoTop = (area === 'home' && section === '') || (area === 'forecast' && section === '');
  // The saved-spots strip sits under the bar on Forecast (Surfline's favourites bar); Home is itself the spots dashboard (T-047).
  const strip = area === 'forecast' && section === '';
  const label = {home: 'Home', forecast: 'Forecast', explore: 'Map', quiver: 'Quiver', personal: 'Personal'}[area];
  return (
    <SwelloProvider>
      <div className={`shell${photoTop ? ' photo-top' : ''}${strip ? ' has-strip' : ''}`}>
        <a className="skip" href="#main">Skip to content</a>
        <div className="hdr">
          <TopNav area={area} section={section} go={navigate} />
          {strip && <SpotStrip go={navigate} onForecast={area === 'forecast'} />}
        </div>
        <main id="main" className={area === 'home' ? 'page page-home' : bleed ? 'page page-bleed' : 'page'}>
          <ErrorBoundary key={area} label={label}>
            <Suspense fallback={<StateMessage title={`Loading ${label}…`} />}>
              {area === 'home' && <HomeView section={section} go={navigate} />}
              {area === 'forecast' && section !== 'wave-scale' && <ForecastView section={section} go={navigate} />}
              {area === 'explore' && <ExploreView section={section} go={navigate} />}
              {area === 'quiver' && <QuiverView section={section} go={navigate} />}
            </Suspense>
            {area === 'forecast' && section === 'wave-scale' && (
              <Suspense fallback={<StateMessage title="Loading 3D viewer…" />}>
                <ScaleView section="" go={navigate} />
              </Suspense>
            )}
            {area === 'personal' && (section === 'privacy' || section === 'terms') && <Legal page={section} go={navigate} />}
            {area === 'personal' && section !== 'privacy' && section !== 'terms' && (
              <Suspense fallback={<StateMessage title="Loading Personal…" />}>
                <PersonalView section={section} go={navigate} />
              </Suspense>
            )}
          </ErrorBoundary>
          {!bleed && <Footer go={navigate} />}
        </main>
        <TabBar area={area} go={navigate} />
      </div>
    </SwelloProvider>
  );
}
