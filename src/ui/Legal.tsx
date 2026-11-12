import type {Go} from '../app/routes';

/** Plain-language privacy and terms for what SWELLO actually does today. Review with a lawyer before any public launch. */
export function Legal({page, go}: {page: 'privacy' | 'terms'; go: Go}) {
  return page === 'privacy' ? (
    <article className="legal">
      <h1>Privacy</h1>
      <p>Last updated November 12, 2026.</p>
      <h2>What stays on your device</h2>
      <p>There is no account and nothing you enter is uploaded to us. Everything below is kept in this browser's own storage on this device. Clearing the site's data removes all of it.</p>
      <ul>
        <li>Profile, favorite spots, boards, journal sessions and settings (local storage <code>surf-prototype-v1</code>, <code>swello-ui-v1</code>, <code>swello-theme</code>, <code>swello-basemap</code>, <code>swello-recent</code>, and the map's layer settings in <code>surf-map-v2</code>).</li>
        <li>Board looks, traced outlines and the board used on the wave scale (<code>swello-board-looks</code>, <code>swello-board-outlines</code>, <code>swello-board-prefs</code>, <code>swello-scale-board</code>); Board Room drafts are kept only for this tab, in session storage (<code>swello-boardroom-drafts</code>), and go when it closes. Board photos you trace are processed in your browser and never sent anywhere.</li>
        <li>What you saw, "Felt right?" answers and older forecast checks (<code>swello-session-log</code>, <code>swello-felt-right</code>). They calibrate the surf estimate on this device only.</li>
        <li>The forecasts you viewed, about two weeks, so your observations are compared with what was predicted (<code>swello-forecast-archive</code>).</li>
        <li>Journal photos and tags, your profile photo and alert rules (<code>swello-journal-extras</code>, <code>swello-avatar</code>, <code>swello-alerts</code>).</li>
        <li>Session clips you add and the rides you mark (IndexedDB <code>swello-clips</code>, local storage <code>swello-clip-rides</code>). Video never leaves the device.</li>
        <li>Recent map forecast frames, so the map opens quickly (IndexedDB <code>swello-map-frames</code>, the last 14 frames). They are public forecast data, nothing about you.</li>
        <li>A feature switch for the nearshore estimate (<code>swello-flag-breaking-v2</code>).</li>
      </ul>
      <h2>Location</h2>
      <p>Find Spots asks for your location only when you press "Use my location". It is used in the page to sort spots by distance and is not stored or sent to anyone.</p>
      <h2>Services the app contacts</h2>
      <p>None of these receives anything you entered. As with any website, a service your browser contacts directly sees your IP address and the page that asked. The full list of sources, with their licenses, is on <a href="/personal/credits" onClick={(e) => { e.preventDefault(); go('personal', 'credits'); }}>Data sources & credits</a>.</p>
      <ul>
        <li>Forecasts, tides, buoys and map layers: Open-Meteo, NOAA (CO-OPS tides, NDBC buoys, GFS-Wave), CDIP and the PacIOOS ERDDAP server are asked through Swello's own server; if the server cannot answer, your browser may ask the source directly.</li>
        <li>Hazard alerts: the National Weather Service (api.weather.gov), asked directly by your browser for the spot you open.</li>
        <li>Map: the default map loads its tiles and style from OpenFreeMap (tiles.openfreemap.org) directly in your browser. Esri (server.arcgisonline.com) is contacted only for the satellite view or when the map falls back to its older engine.</li>
        <li>Cameras: a USGS camera still is loaded by your browser from USGS's own host, and its age is checked through Swello's server. A YouTube stream loads nothing from YouTube or Google until you tap it; then YouTube's player and its script load from youtube.com. HDOnTap cameras are links, unless HDOnTap allows this site, in which case its player loads only when you tap. Where HDOnTap provides a snapshot for Swello, your browser loads that picture from HDOnTap's own host (portal.hdontap.com) when the camera block comes on screen, and again about once a minute while it stays there, so HDOnTap sees your IP address and that the request came from Swello; Swello does not copy or store the picture.</li>
      </ul>
      <h2>Hosting</h2>
      <p>Swello's pages and its server run on Cloudflare, which handles every request to this site (and so sees your IP address and the pages asked for).</p>
      <h2>Cookies and tracking</h2>
      <p>While the site is private, Cloudflare Access asks you to sign in and then sets one authentication cookie, <code>CF_Authorization</code>, which lasts about 24 hours. Swello itself sets no cookies, and no analytics or advertising trackers are used.</p>
      <h2>Deleting your data</h2>
      <p>Clear this site's data in your browser, or export it first from <a href="/personal/account" onClick={(e) => { e.preventDefault(); go('personal', 'account'); }}>Personal › Data & privacy</a>.</p>
    </article>
  ) : (
    <article className="legal">
      <h1>Terms</h1>
      <p>Last updated November 10, 2026.</p>
      <h2>Not a safety service</h2>
      <p>Swello shows model forecasts, provisional ratings and illustrations. Conditions at the beach can be very different. Always judge the ocean yourself, know your limits and follow lifeguards and local rules.</p>
      <h2>Data</h2>
      <p>Surf heights are model estimates, labeled as such, and offshore heights are labeled offshore; none is a measurement. Ratings are uncalibrated estimates. Tides are NOAA CO-OPS predictions at the station each spot names (outside the US, none), not measured at the beach. Data is provided as is, without any warranty of accuracy or availability.</p>
      <h2>3D and boards</h2>
      <p>Board shapes and the wave scene are approximations for comparison, not manufacturing data or measurements.</p>
      <h2>Attribution</h2>
      <p>Forecast data by Open-Meteo.com (CC BY 4.0); NOAA (CO-OPS, NDBC, NWS, GFS-Wave); CDIP; PacIOOS; USGS; map © OpenStreetMap contributors (ODbL), OpenFreeMap and OpenMapTiles; photographs from Wikimedia Commons contributors under their stated licenses. Every source, what it supplies and its licence: <a href="/personal/credits" onClick={(e) => { e.preventDefault(); go('personal', 'credits'); }}>Data sources & credits</a>.</p>
    </article>
  );
}

export function Footer({go}: {go: Go}) {
  const link = (section: 'privacy' | 'terms' | 'credits', label: string) => <a href={`/personal/${section}`} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go('personal', section); }}>{label}</a>;
  return <footer className="foot"><span>Swello · forecasts from public ocean models · ratings are provisional</span>{link('privacy', 'Privacy')}{link('terms', 'Terms')}{link('credits', 'Credits')}</footer>;
}
