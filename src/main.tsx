import {createRoot} from 'react-dom/client';
import App from './app/App';
import './ui/tokens.css';
// T-128c: on a direct visit to the map, start the engine chunk, style and connection warm-up now instead of after the Explore chunk has loaded and mounted (the import's side effect is the warm-up).
if (/^\/explore/.test(location.pathname)) void import('./map/engine/index.ts').catch(() => { /* the map surfaces its own error */ });
createRoot(document.getElementById('root')!).render(<App/>);
