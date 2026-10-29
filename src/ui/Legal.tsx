import type {Go} from '../app/routes';

/** Plain-language privacy and terms for what SWELLO actually does today. Review with a lawyer before any public launch. */
export function Legal({page, go}: {page: 'privacy' | 'terms'; go: Go}) {
  return page === 'privacy' ? (
    <article className="legal">
      <h1>Privacy</h1>
      <p>Last updated October 29, 2026.</p>
      <h2>What stays on your device</h2>
      <p>Your profile, favourite spots, boards, board looks and traced outlines, journal, theme and units are saved in this browser's local storage. There is no account and nothing is uploaded to us. Board photos you trace are processed in your browser and never sent anywhere.</p>
      <h2>Location</h2>
      <p>Find Spots asks for your location only when you press "Use my location". It is used in the page to sort spots by distance and is not stored or sent to anyone.</p>
      <h2>Services the app contacts</h2>
      <ul>
        <li>Forecast data: Open-Meteo, NOAA (CO-OPS, NDBC, ERDDAP) and CDIP, through SWELLO's own server.</li>
        <li>Map imagery: Esri World Imagery tiles, loaded directly by your browser, so Esri receives your IP address as with any website image.</li>
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
