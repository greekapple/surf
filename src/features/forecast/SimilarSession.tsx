import type {Forecast, SurfSpot, UserProfile} from '../../models';
import type {OceanBundle} from '../../ocean/types';
import {getObservations} from '../../services/observationStore';
import {closestSession, similarLine, todayInputs} from '../../services/similarSessions';
import {isDark} from '../../services/daylight';
import {useObservations} from './Observe';

/** "Similar size and period at Tue 6 AM to your report on Sat Oct 18, 7 AM (you rated the waves Good). Forecast then: ..." (names only the dimensions compared) (quiver item 3). One line, only with at least 3 logged sessions at the spot and a close forecast match; from the person's own local log; a comparison
 *  of forecasts, not a prediction. Nothing otherwise. */
export function SimilarSession({spot, forecast, profile, bundle, nowMs}: {spot: SurfSpot; forecast: Forecast; profile: UserProfile; bundle?: Pick<OceanBundle, 'nearshore' | 'mop' | 'srf'> | null; nowMs: number}) {
  useObservations();   // re-render when the log changes
  if (isDark(spot.id, forecast.timestamp)) return null;   // a dark hour is not a surf hour: nothing is compared
  const m = closestSession(getObservations(), spot.id, todayInputs(spot, forecast, bundle, nowMs)); if (!m) return null;
  return <p className="sp-similar" data-testid="similar-session">{similarLine(m, spot, profile, forecast.timestamp)} <a href={`/personal/account#session-${encodeURIComponent(m.obs.id)}`}>See that report</a></p>;
}
