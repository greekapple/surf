import {OWNER_TOOLS, PREVIEW_SETUP_EVENT} from '../../services/profileFields';

/** Owner tools (private build only: VITE_OWNER_TOOLS=true). One item for now: open the first-run setup once, without touching the stored `setupState`
 *  (app/App.tsx listens for the event). Other owner items can be added as siblings inside this section. */
export function OwnerTools() {
  if (!OWNER_TOOLS) return null;
  return <section className="pz-panel" aria-labelledby="owner-tools-h">
    <h2 id="owner-tools-h">Owner tools</h2>
    <p className="fine">Only in the private build. The first-run setup does not open by itself here.</p>
    <div className="pzl-actions"><button type="button" className="btn" onClick={() => window.dispatchEvent(new Event(PREVIEW_SETUP_EVENT))}>Preview the first-run setup</button></div>
  </section>;
}
