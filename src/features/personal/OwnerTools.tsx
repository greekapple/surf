import {OWNER_TOOLS, PREVIEW_SETUP_EVENT} from '../../services/profileFields';
import {useSwello} from '../../app/store';
import {Toggle} from './parts';

/** Owner tools (private build only: VITE_OWNER_TOOLS=true). Items: the region preview (ca-only: the app lists California only; this lists every region the app has data for; the stored
 *  `previewRegions`, ignored when the flag is off) and opening the first-run setup once, without touching the stored `setupState` (app/App.tsx listens for the event).
 *  Other owner items can be added as siblings inside this section. */
export function OwnerTools() {
  const {data} = useSwello();
  if (!OWNER_TOOLS) return null;
  const on = data.state.profile.previewRegions === true;
  return <section className="pz-panel" aria-labelledby="owner-tools-h">
    <h2 id="owner-tools-h">Owner tools</h2>
    <p className="fine">Only in the private build. The first-run setup does not open by itself here.</p>
    <div className="pzl-actions" style={{alignItems: 'center', gap: 12}}>
      <Toggle on={on} label="Preview regions not open yet" onChange={(v) => data.profile({previewRegions: v})} />
      <span><b>Preview regions not open yet</b><br /><small>{on ? 'On: every region the app has data for is listed.' : 'Off: only California is listed.'}</small></span>
    </div>
    <div className="pzl-actions"><button type="button" className="btn" onClick={() => window.dispatchEvent(new Event(PREVIEW_SETUP_EVENT))}>Preview the first-run setup</button></div>
  </section>;
}
