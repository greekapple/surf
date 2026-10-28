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
import '../ui/app.css';

// Three.js loads only when the Wave Scale area opens.
const ScaleView = lazy(() => import('../features/scale/ScaleView').then((m) => ({default: m.ScaleView})));

export default function App() {
  const {route, navigate} = useRoute();
  const {area, section} = route;
  const label = {home: 'Home', forecast: 'Forecast', explore: 'Explore', quiver: 'Quiver', scale: 'Wave Scale', personal: 'Personal'}[area];
  return (
    <SwelloProvider>
      <div className="shell">
        <a className="skip" href="#main">Skip to content</a>
        <TopNav area={area} section={section} go={navigate} />
        <main id="main" className="page">
          <SubNav area={area} section={section} go={navigate} />
          <ErrorBoundary key={area} label={label}>
            {area === 'home' && <HomeView section={section} go={navigate} />}
            {area === 'forecast' && <ForecastView section={section} go={navigate} />}
            {area === 'explore' && <ExploreView section={section} go={navigate} />}
            {area === 'quiver' && <QuiverView section={section} go={navigate} />}
            {area === 'scale' && (
              <Suspense fallback={<StateMessage title="Loading 3D viewer…" />}>
                <ScaleView section={section} go={navigate} />
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
