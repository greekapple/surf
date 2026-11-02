/** T-063 "Live cam" links. Links only: SWELLO never embeds, frames or analyses another owner's camera (that needs their permission).
 *  A spot gets a link only when its owner's page was opened in a real browser and showed a working live camera. Every entry records who runs it,
 *  what it shows and when it was checked. The log of checked and skipped candidates is docs/forecast/CAMS.md. */
export interface Cam {
  spotId: string;
  /** Who publishes the page (the link label names them, never SWELLO). */
  owner: string;
  /** Who runs the camera, when it is someone else. */
  operator?: string;
  url: string;
  /** What the camera actually shows, so nobody mistakes it for a surf check it isn't. */
  view: string;
  verified: string;
  how: string;
}

export const CAMS: readonly Cam[] = [
  {spotId: 'cs-morro-rock', owner: 'Morro Bay National Estuary Program', operator: '805 Webcams', url: 'https://mbnep.org/baycam',
    view: 'Morro Rock and the harbour from the bay side, not the surf on the north side of the Rock', verified: '2026-11-02',
    how: 'Page loaded (HTTP 200) in Chrome with a playing YouTube live stream titled "Morro Bay Rock and Harbor Webcam - 805 Webcams"; on-screen clock 2026-11-02 12:27 PM.'},
];

export const camFor = (spotId: string): Cam | null => CAMS.find((c) => c.spotId === spotId) ?? null;
