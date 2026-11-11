/** Audit F3 / A3: what the tide chart says when a spot has no hourly tide curve. The hourly curve is drawn only from the San Francisco
 *  station (spots near the Bay); a spot with its own nearby CO-OPS station still has that station's highs and lows on the Tide card,
 *  so the chart must not claim there is "no tide station near this spot". Pure, for tests. */
import {tideStationFor, noTideNote} from '../../ocean/tideStations.ts';
import {regionNote} from '../../ocean/coverage.ts';
import {evidenceSpots} from '../../ocean/spots.ts';

export const TIDE_CARD_RANGE_KM = 40; // the Tide card's own range (SpotPage StationTideNext)

export function noTideCurveText(spotId: string): string {
  const region = regionNote(spotId, 'tide');
  if (region) return region;
  const e = evidenceSpots.find((x) => x.id === spotId);
  const st = e ? tideStationFor({id: e.id, latitude: e.latitude, longitude: e.longitude}) : null;
  // review fix: no claim about what the card shows (its highs and lows may not have loaded); only the station, which is a fixed fact
  // audit-eng merge: hourly curves now come from each spot's own station, so the note no longer says "only near San Francisco Bay"
  if (st && st.distanceKm <= TIDE_CARD_RANGE_KM) return `No hourly tide curve loaded for this spot. Nearest tide station: ${st.station.name}, ${st.distanceKm} km away.`;
  return noTideNote(spotId); // the Tide card's own wording for no station (or only closed gauges)
}
