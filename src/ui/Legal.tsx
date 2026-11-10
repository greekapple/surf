import type {Go} from '../app/routes';

/** Plain-language privacy and terms for what SWELLO actually does today. Review with a lawyer before any public launch. */
export function Legal({page, go}: {page: 'privacy' | 'terms'; go: Go}) {
  return page === 'privacy' ? (
    <article className="legal">
      <h1>Privacy</h1>
      <p>Last updated November 2, 2026.</p>
      <h2>What stays on your device</h2>
      <p>There is no account and nothing you enter is uploaded to us. Everything below is kept in this browser's own storage on this device. Clearing the site's data removes all of it.</p>
      <ul>
        <li>Profile, favourite spots, boards, journal sessions and settings (local storage <code>surf-prototype-v1</code>, <code>swello-ui-v1</code>, <code>swello-theme</code>, <code>swello-basemap</code>, <code>swello-recent</code>).</li>
        <li>Board looks, traced outlines, Board Room drafts and the board used on the wave scale (<code>swello-board-looks</code>, <code>swello-board-outlines</code>, <code>swello-boardroom-drafts</code>, <code>swello-board-prefs</code>, <code>swello-scale-board</code>). Board photos you trace are processed in your browser and never sent anywhere.</li>
        <li>What you saw, "Felt right?" answers and older forecast checks (<code>swello-session-log</code>, <code>swello-felt-right</code>). They calibrate the surf estimate on this device only.</li>
        <li>The forecasts you viewed, about two weeks, so your observations are compared with what was predicted (<code>swello-forecast-archive</code>).</li>
        <li>Journal photos and tags, your profile photo and alert rules (<code>swello-journal-extras</code>, <code>swello-avatar</code>, <code>swello-alerts</code>).</li>
        <li>Session clips you add and the rides you mark (IndexedDB <code>swello-clips</code>, local storage <code>swello-clip-rides</code>). Video never leaves the device.</li>
        <li>A feature switch for the nearshore estimate (<code>swello-flag-breaking-v2</code>).</li>
      </ul>
      <h2>Location</h2>
      <p>Find Spots asks for your location only when you press "Use my location". It is used in the page to sort spots by distance and is not stored or sent to anyone.</p>
      <h2>Services the app contacts</h2>
      <p>These public data services are contacted to show forecasts. None of them receives anything you entered; as with any website, a service your browser contacts directly sees your IP address.</p>
      <ul>
        <li>Forecast models: Open-Meteo (marine and weather), NOAA CO-OPS (tides), NOAA NDBC (buoys), NOAA GFS-Wave; PacIOOS / University of Hawaiʻi WaveWatch III and NOAA/NCEP GFS, via PacIOOS ERDDAP (map layers) and CDIP (nearshore points), fetched through SWELLO's own server.</li>
        <li>Hazard alerts: the National Weather Service alerts API (api.weather.gov), loaded directly by your browser for the spot you open.</li>
        <li>Map tiles: Esri basemaps (light, dark or satellite, server.arcgisonline.com), loaded directly by your browser.</li>
        <li>Live cam links open the camera owner's own page in a new tab; nothing is embedded here.</li>
      </ul>
      <h2>Cookies and tracking</h2>
      <p>No cookies, analytics or advertising trackers are used.</p>
      <h2>Deleting your data</h2>
      <p>Clear this site's data in your browser, or export it first from <a href="/personal/account" onClick={(e) => { e.preventDefault(); go('personal', 'account'); }}>Personal › Account</a>.</p>
    </article>
  ) : (
    <article className="legal">
      <h1>Terms</h1>
      <p>Last updated October 29, 2026.</p>
      <h2>Not a safety service</h2>
      <p>SWELLO shows model forecasts, provisional ratings and illustrations. Conditions at the beach can be very different. Always judge the ocean yourself, know your limits and follow lifeguards and local rules.</p>
      <h2>Data</h2>
      <p>Heights are offshore model values unless labelled otherwise; ratings are uncalibrated estimates; tides come from one regional station near San Francisco. Data is provided as is, without any warranty of accuracy or availability.</p>
      <h2>3D and boards</h2>
      <p>Board shapes and the wave scene are approximations for comparison, not manufacturing data or measurements.</p>
      <h2>Attribution</h2>
      <p>Photographs from Wikimedia Commons contributors under their stated licences; coastline from Natural Earth; map imagery © Esri, Maxar, Earthstar Geographics.</p>
    </article>
  );
}

export function Footer({go}: {go: Go}) {
  const link = (section: 'privacy' | 'terms', label: string) => <a href={`/personal/${section}`} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); go('personal', section); }}>{label}</a>;
  return <footer className="foot"><span>Swello · forecasts from public ocean models · ratings are provisional</span>{link('privacy', 'Privacy')}{link('terms', 'Terms')}</footer>;
}
