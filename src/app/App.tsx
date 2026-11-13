import {lazy, Suspense, useEffect, useState} from 'react';
import {SwelloProvider, useSwello} from './store';
import {docTitle} from './titles';
import {useRoute, type Go, type Route} from './routes';
import {TabBar, TopNav} from './Nav';
import {SpotStrip} from '../features/home/SpotStrip';
import {ErrorBoundary, StateMessage} from '../ui/common';
import {ProfileSetup} from '../features/personal/ProfileSetup';
import {OWNER_TOOLS, PREVIEW_SETUP_EVENT, showSetupFlow} from '../services/profileFields';
import {HomeView} from '../features/home/HomeView';
import {useThemeSync} from '../ui/theme';
import {Footer, Legal} from '../ui/Legal';
import {NotFound} from '../ui/NotFound';
import '../ui/app.css';

// T-091: only Home is in the first bundle. Every other area (and with it Leaflet, the map's land data, Three.js, the quiver studio) loads when it is opened;
// Forecast (the likeliest next tap, ~22 KB gzip) is prefetched when the browser is idle; Map and Quiver load on demand.
// React caches a rejected lazy import for good, so each area is a holder whose `retry()` makes a NEW lazy component; the error boundary's "Try again" calls it (T-100).
const lazyArea = <T,>(load: () => Promise<T>, pick: (m: T) => React.ComponentType<any>) => {
  const make = () => lazy(() => load().then((m) => ({default: pick(m)})));
  const area = {C: make(), retry() { area.C = make(); }};
  return area;
};
const forecastArea = lazyArea(() => import('../features/forecast/ForecastView'), (m) => m.ForecastView);
const exploreArea = lazyArea(() => import('../features/explore/ExploreView'), (m) => m.ExploreView);
const quiverArea = lazyArea(() => import('../features/quiver/QuiverView'), (m) => m.QuiverView);
const personalArea = lazyArea(() => import('../features/personal/PersonalView'), (m) => m.PersonalView);
const areas = [forecastArea, exploreArea, quiverArea, personalArea];
const prefetch = [() => import('../features/forecast/ForecastView')]; // the likeliest next tap; Map (Leaflet + land data, ~240 KB gzip) and Quiver load on demand
// Three.js loads only when the Wave Scale section of Forecast opens.
const scaleArea = lazyArea(() => import('../features/scale/ScaleView'), (m) => m.ScaleView);
const creditsArea = lazyArea(() => import('../ui/Credits'), (m) => m.Credits); // audit A10: its camera and photo lists stay out of the first bundle // (read-only use of the scale module: its own files are untouched)
const resetAreas = () => { for (const a of [...areas, scaleArea, creditsArea]) a.retry(); };

export default function App() {
  useThemeSync();
  useEffect(() => { // idle prefetch of the other areas (a few hundred ms after first render, when the main thread is free)
    const run = async () => { for (const load of prefetch) { try { await load(); } catch { /* offline: the area loads on demand */ } } };
    const idle = (window as any).requestIdleCallback as ((cb: () => void, o?: {timeout: number}) => number) | undefined;
    const id = idle ? idle(run, {timeout: 4000}) : window.setTimeout(run, 2500);
    return () => { if (!idle) clearTimeout(id); };
  }, []);
  const {route, navigate} = useRoute();
  return (
    <SwelloProvider area={route.area} section={route.section}>
      <Shell route={route} navigate={navigate} />
    </SwelloProvider>
  );
}

function Shell({route, navigate}: {route: Route; navigate: Go}) {
  const {spot, missingSpot, hiddenSpot, data} = useSwello();
  const {area, section} = route;
  // Audit B2: an unknown path, or a Forecast URL whose ?spot= names no spot (or several), shows "not found" with search, never another page or spot.
  const notFound = route.notFound ? 'page' as const : area === 'forecast' && hiddenSpot ? 'region' as const : area === 'forecast' && missingSpot ? 'spot' as const : null;
  // Audit R20: one document title per route ("Ocean Beach surf forecast · Swello").
  useEffect(() => { document.title = docTitle(area, section, {spotName: spot.name, notFound}); }, [area, section, spot.name, notFound]);
  // The ocean map is full-bleed under the bar; its own panels hold its controls. There are no section pills anywhere (T-022):
  // sections are reached from the bar's menus and flyouts.
  const bleed = !notFound && area === 'explore' && section !== 'discover' && section !== 'compare';
  // Pages that open on a full-bleed photograph start under the fixed header and offset their text by --nav-h.
  const photoTop = !notFound && ((area === 'home' && section === '') || (area === 'forecast' && section === ''));
  // The saved-spots strip sits under the bar on Forecast (Surfline's favourites bar); Home is itself the spots dashboard (T-047).
  const strip = !notFound && area === 'forecast' && section === '';
  const label = {home: 'Home', forecast: 'Forecast', explore: 'Map', quiver: 'Quiver', personal: 'Personal'}[area];
  // First open: the setup flow comes before everything (the privacy, terms and credits pages stay readable). Skipping or finishing carries on to the page asked for.
  const [preview, setPreview] = useState(false);   // Owner tools: "Preview the first-run setup" shows the flow once, setupState untouched
  useEffect(() => { const on = () => setPreview(true); window.addEventListener(PREVIEW_SETUP_EVENT, on); return () => window.removeEventListener(PREVIEW_SETUP_EVENT, on); }, []);
  const legalPage = area === 'personal' && (section === 'privacy' || section === 'terms' || section === 'credits');
  if (preview || (showSetupFlow(data.state.profile, OWNER_TOOLS) && !legalPage)) {
    // a preview only closes the flow; answers still save to the profile like Personal > Profile, but setupState and onboarded are never changed
    const set = preview ? (v: Partial<typeof data.state.profile>) => { if ('setupState' in v) setPreview(false); else data.profile(v); } : data.profile;
    return <ProfileSetup p={data.state.profile} set={set} onEdit={() => { setPreview(false); navigate('personal', 'profile'); }} />;
  }
  return (
    <div className={`shell${photoTop ? ' photo-top' : ''}${strip ? ' has-strip' : ''}${bleed ? ' is-map' : ''}`}>
      <a className="skip-link" href="#main">Skip to content</a>
      <div className="hdr">
        <TopNav area={area} section={section} go={navigate} />
        {strip && <SpotStrip go={navigate} onForecast={area === 'forecast'} />}
      </div>
      <main id="main" className={area === 'home' && !notFound ? 'page page-home' : bleed ? 'page page-bleed' : 'page'}>
        {notFound ? <NotFound kind={notFound} go={navigate} /> : <ErrorBoundary key={area} label={label} onRetry={resetAreas}>
          {/* Map-seamless Stage 1: a cold load of the map shows the map's own gray ground and a small pill, not a white page. */}
          <Suspense fallback={area === 'explore' ? <div className="map-fallback" role="status"><span>Loading map…</span></div> : <StateMessage title={`Loading ${label}…`} />}>
            {area === 'home' && <HomeView section={section} go={navigate} />}
            {area === 'forecast' && section !== 'wave-scale' && <forecastArea.C section={section} go={navigate} />}
            {area === 'explore' && <exploreArea.C section={section} go={navigate} />}
            {area === 'quiver' && <quiverArea.C section={section} go={navigate} />}
          </Suspense>
          {area === 'forecast' && section === 'wave-scale' && (
            <Suspense fallback={<StateMessage title="Loading 3D viewer…" />}>
              <scaleArea.C section="" go={navigate} />
            </Suspense>
          )}
          {area === 'personal' && (section === 'privacy' || section === 'terms') && <Legal page={section} go={navigate} />}
          {area === 'personal' && section === 'credits' && <Suspense fallback={<StateMessage title="Loading credits…" />}><creditsArea.C go={navigate} /></Suspense>}
          {area === 'personal' && section !== 'privacy' && section !== 'terms' && section !== 'credits' && (
            <Suspense fallback={<StateMessage title="Loading Personal…" />}>
              <personalArea.C section={section} go={navigate} />
            </Suspense>
          )}
        </ErrorBoundary>}
        {!bleed && <Footer go={navigate} />}
      </main>
      <TabBar area={area} go={navigate} />
    </div>
  );
}
