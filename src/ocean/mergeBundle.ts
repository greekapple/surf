import type {OceanBundle} from './types.ts';

/** B7: a bundle for ONE spot (the selected spot, loaded first) folded into the bundle already on screen. The other spots' records and `loadedSpotIds` stay, the spot's own records are replaced by the fresh ones, and the tide stations
 *  it brought are added; every other field stays the old bundle's. With no bundle yet, the single-spot bundle IS the bundle. Pure. */
export function mergeSpotBundle(old: OceanBundle | null | undefined, first: OceanBundle, spotId: string): OceanBundle {
  if (!old) return first;
  const loaded = new Set([...(old.loadedSpotIds ?? old.records.map((r) => r.spotId)), ...(first.loadedSpotIds ?? [spotId])]);
  return {...old, records: [...old.records.filter((r) => r.spotId !== spotId), ...first.records.filter((r) => r.spotId === spotId)], loadedSpotIds: [...loaded], stationTides: {...(old.stationTides ?? {}), ...(first.stationTides ?? {})}, ...(old.srf || first.srf ? {srf: {...(old.srf ?? {}), ...(first.srf ?? {})}} : {})};
}
