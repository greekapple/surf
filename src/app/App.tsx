import {lazy, Suspense} from 'react';
import {SwelloProvider} from './store';
import {useRoute} from './routes';
import {TabBar, TopNav} from './Nav';
import {SpotStrip} from '../features/home/SpotStrip';
import {ErrorBoundary, StateMessage} from '../ui/common';
import {HomeView} from '../features/home/HomeView';
import {ForecastView} from '../features/forecast/ForecastView';
import {ExploreView} from '../features/explore/ExploreView';
import {QuiverView} from '../features/quiver/QuiverView';
import {PersonalView} from '../features/personal/PersonalView';
import {useThemeSync} from '../ui/theme';
import {Footer, Legal} from '../ui/Legal';
import '../ui/app.css';

// Three.js loads only when the Wave Scale section of Forecast opens.
const ScaleView = lazy(() => import('../features/scale/ScaleView').then((m) => ({default: m.ScaleView})));

export default function App() {
  useThemeSync();
  const {route, navigate} = useRoute();
  const {area, section} = route;
  // The ocean map is full-bleed under the bar; its own panels hold its controls. There are no section pills anywhere (T-022):
  // sections are reached from the bar's menus and flyouts.
  const bleed = area === 'explore' && section !== 'discover' && section !== 'compare';
  // Pages that open on a full-bleed photograph start under the fixed header and offset their text by --nav-h.
  const photoTop = (area === 'home' && section === '') || (area === 'forecast' && section === '');
  // The saved-spots strip sits under the bar on Home and Forecast (Surfline's favourites bar).
  const strip = photoTop;
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
            {area === 'home' && <HomeView section={section} go={navigate} />}
            {area === 'forecast' && section !== 'wave-scale' && <ForecastView section={section} go={navigate} />}
            {area === 'explore' && <ExploreView section={section} go={navigate} />}
            {area === 'quiver' && <QuiverView section={section} go={navigate} />}
            {area === 'forecast' && section === 'wave-scale' && (
              <Suspense fallback={<StateMessage title="Loading 3D viewer…" />}>
                <ScaleView section="" go={navigate} />
              </Suspense>
            )}
            {area === 'personal' && (section === 'privacy' || section === 'terms') && <Legal page={section} go={navigate} />}
            {area === 'personal' && section !== 'privacy' && section !== 'terms' && <PersonalView section={section} go={navigate} />}
          </ErrorBoundary>
          {!bleed && <Footer go={navigate} />}
        </main>
        <TabBar area={area} go={navigate} />
      </div>
    </SwelloProvider>
  );
}
