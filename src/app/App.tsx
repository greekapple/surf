import {lazy, Suspense} from 'react';
import {SwelloProvider} from './store';
import {useRoute} from './routes';
import {SubNav, TabBar, TopNav} from './Nav';
import {ErrorBoundary, StateMessage} from '../ui/common';
import {HomeView} from '../features/home/HomeView';
import {ForecastView} from '../features/forecast/ForecastView';
import {ExploreView} from '../features/explore/ExploreView';
import {QuiverView} from '../features/quiver/QuiverView';
import {PersonalView} from '../features/personal/PersonalView';
import {useThemeSync} from '../ui/theme';
import '../ui/app.css';

// Three.js loads only when the Wave Scale section of Forecast opens.
const ScaleView = lazy(() => import('../features/scale/ScaleView').then((m) => ({default: m.ScaleView})));

export default function App() {
  useThemeSync();
  const {route, navigate} = useRoute();
  const {area, section} = route;
  // The ocean map is full-bleed under the nav; its sidebar tabs and layer panel replace the section pills.
  const bleed = area === 'explore' && section !== 'discover' && section !== 'compare';
  const label = {home: 'Home', forecast: 'Forecast', explore: 'Explore', quiver: 'Quiver', personal: 'Personal'}[area];
  return (
    <SwelloProvider>
      <div className="shell">
        <a className="skip" href="#main">Skip to content</a>
        <TopNav area={area} section={section} go={navigate} />
        <main id="main" className={area === 'home' ? 'page page-home' : bleed ? 'page page-bleed' : 'page'}>
          {area !== 'home' && area !== 'personal' && !bleed && <SubNav area={area} section={section} go={navigate} />}
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
            {area === 'personal' && <PersonalView section={section} go={navigate} />}
          </ErrorBoundary>
        </main>
        <TabBar area={area} go={navigate} />
      </div>
    </SwelloProvider>
  );
}
