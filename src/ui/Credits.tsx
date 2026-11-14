import type {Go} from '../app/routes';
import {LIVE_CAMS} from '../data/liveCamsSourced';
import {HDONTAP_LINKS} from '../data/hdontapLinksSourced';
import {HDONTAP_ATTRIBUTION, HDONTAP_CAMS, HDONTAP_LOGO_LINK} from '../ocean/hdontapCams';
import {CAMS} from '../data/cams';
import {PHOTOS} from './photos';
import {SPREAD_MODELS} from '../ocean/openMeteo';
import {WQ_AGENCIES} from '../data/waterQualitySourced';

/** Audit R4 / A10: every data source the app uses, what it supplies, its licence and the credit its owner asks for. Licences and credit wording come
 *  from the repo's source notes (docs/map-data-sources-v6.md, docs/research/NEARSHORE-MODELS.md, docs/forecast/RATING-V2-PLAN.md,
 *  docs/forecast/data/world-sources.json, docs/forecast/LIVE-CAM-PANEL.md). Add the Marine Institute (Ireland, CC BY 4.0) and AODN / IMOS
 *  (Australia, CC BY 4.0) here when their adapters are wired into the app; they are not used yet. */
interface Source {name: string; supplies: string; licence: string; credit?: string; links: [string, string][]}
const MODEL_NAMES: Record<string, string> = {meteofrance_wave: 'Météo-France MFWAM', ncep_gfswave016: 'NOAA GFS-Wave', gwam: 'DWD GWAM', ecmwf_wam025: 'ECMWF WAM'};

const SOURCES: Source[] = [
  {name: 'Open-Meteo', supplies: `Marine (wave and swell) and weather (wind) forecasts for every spot, and the wave-model spread (${SPREAD_MODELS.map((m) => MODEL_NAMES[m] ?? m).join(', ')}).`,
    licence: 'Data under Creative Commons Attribution 4.0 (CC BY 4.0). Swello\'s server uses Open-Meteo\'s paid commercial API plan; if the server cannot answer, your browser may ask Open-Meteo\'s free public API directly.', credit: 'Weather and marine data by Open-Meteo.com, from the national weather services and model centers it serves.',
    links: [['Open-Meteo', 'https://open-meteo.com/'], ['License', 'https://open-meteo.com/en/licence'], ['Terms', 'https://open-meteo.com/en/terms']]},
  {name: 'NOAA CO-OPS (Tides & Currents)', supplies: 'Tide predictions (highs, lows and hourly) and water-level observations at the station each spot names.',
    licence: 'U.S. Government work: public domain. NOAA disclaimer applies.', links: [['Tides & Currents', 'https://tidesandcurrents.noaa.gov/'], ['NOAA disclaimer', 'https://www.noaa.gov/disclaimer']]},
  {name: 'NOAA National Data Buoy Center (NDBC)', supplies: 'Buoy observations (wave height, period, direction, water temperature) used for the offshore checks.',
    licence: 'U.S. federal public data: public domain. NOAA disclaimer applies.', links: [['NDBC', 'https://www.ndbc.noaa.gov/']]},
  {name: 'NOAA National Weather Service', supplies: 'Hazard alerts (api.weather.gov) for the spot you open.', licence: 'U.S. Government work: public domain.', links: [['weather.gov', 'https://www.weather.gov/']]},
  {name: 'NOAA NCEP GFS-Wave and GFS', supplies: 'The map\'s global swell, period and wind layers.', licence: 'U.S. Government work: public domain.', links: [['NCEP', 'https://www.nco.ncep.noaa.gov/']]},
  {name: 'Swello map frames (GitHub Pages)', supplies: 'The map\'s wave, swell and wind pictures: NOAA GFS-Wave grids that Swello\'s own job converts to images every few hours and publishes on GitHub Pages (greekapple.github.io/surf), which your browser loads directly. When they are missing or older than 18 hours the map uses the PacIOOS grids below and says so.',
    licence: 'The data is NOAA\'s (U.S. Government work: public domain). Hosted by GitHub Pages under GitHub\'s terms.', links: [['GitHub Pages', 'https://pages.github.com/'], ['NCEP', 'https://www.nco.ncep.noaa.gov/']]},
  {name: 'PacIOOS / University of Hawaiʻi', supplies: 'The ERDDAP server the map\'s regional WaveWatch III and GFS grids are read from.',
    licence: '"The data may be used and redistributed for free but is not intended for legal use." No warranty.', credit: 'PacIOOS, funded by NOAA as an IOOS Regional Association, coordinated by the University of Hawaiʻi SOEST.',
    links: [['PacIOOS', 'https://www.pacioos.hawaii.edu/']]},
  {name: 'CDIP (Coastal Data Information Program)', supplies: 'Nearshore wave model points (MOP) behind the surf estimate, and CDIP buoy observations.',
    licence: 'Freely available for public use, provided the data are not altered; web displays link to the CDIP homepage.', credit: 'CDIP, Scripps Institution of Oceanography, UC San Diego; primarily supported by the U.S. Army Corps of Engineers.',
    links: [['CDIP', 'https://cdip.ucsd.edu/']]},
  {name: 'U.S. Geological Survey', supplies: 'CoastCam still images on the spot pages that have one.', licence: 'Public domain (USGS: "Media Sources/Usage: Public Domain").',
    credit: 'U.S. Geological Survey, Pacific Coastal and Marine Science Center.', links: [['USGS CoastCam', 'https://www.usgs.gov/centers/pcmsc']]},
  {name: 'OpenFreeMap, OpenMapTiles and OpenStreetMap', supplies: 'The default map (vector tiles, places and coastline).', licence: 'Map data © OpenStreetMap contributors, Open Database License (ODbL); tiles by OpenFreeMap; schema © OpenMapTiles.',
    links: [['OpenFreeMap', 'https://openfreemap.org/'], ['OpenMapTiles', 'https://www.openmaptiles.org/'], ['OpenStreetMap copyright', 'https://www.openstreetmap.org/copyright']]},
  {name: 'OpenStreetMap land polygons', supplies: 'The small coastline maps beside the swell and wind on spot pages (land within 2.5 km of each pin, simplified), built by Swello\'s own tool.', licence: 'Open Database License (ODbL) 1.0: © OpenStreetMap contributors; the derived coastline file is offered under the same licence.', links: [['OSM land polygons', 'https://osmdata.openstreetmap.de/data/land-polygons.html'], ['OpenStreetMap copyright', 'https://www.openstreetmap.org/copyright']]},
  {name: 'Esri', supplies: 'The base map of the fallback map engine, used only when the default map cannot start.', licence: 'Esri terms of use.', credit: 'Tiles © Esri; Esri, HERE, Garmin, FAO, NOAA, USGS, © OpenStreetMap contributors.', links: [['Esri', 'https://www.esri.com/']]},
  {name: 'Natural Earth', supplies: 'Coastline and land outlines.', licence: 'Public domain.', links: [['Natural Earth', 'https://www.naturalearthdata.com/']]},
  {name: 'Iowa Environmental Mesonet (Iowa State University)', supplies: 'Airport (ASOS) wind observations, used by "How right were we?" to check the wind forecast.', licence: 'Redistributed NWS/FAA observations, provided as is (IEM disclaimer).',
    links: [['IEM', 'https://mesonet.agron.iastate.edu/'], ['Disclaimer', 'https://mesonet.agron.iastate.edu/disclaimer.php']]},
  {name: 'NOAA NCEI ETOPO', supplies: 'Seabed depth, used to cross-check the nearshore slopes.', licence: 'U.S. Government work: public domain.', links: [['ETOPO', 'https://www.ncei.noaa.gov/products/etopo-global-relief-model']]},
];

const uniq = <T,>(xs: readonly T[], key: (x: T) => string) => [...new Map(xs.map((x) => [key(x), x])).values()];

export function Credits({go}: {go: Go}) {
  const streams = uniq(LIVE_CAMS.filter((c) => c.enabled && c.kind !== 'hdontap'), (c) => c.credit);
  const hd = uniq(HDONTAP_LINKS, (l) => l.label).map((l) => l.label).sort();
  const camLinks = uniq([...CAMS], (c) => c.owner).map((c) => c.owner).sort();
  const photos = Object.values(PHOTOS);
  return (
    <article className="legal credits">
      <p className="fine"><a href="/personal" onClick={(e) => { e.preventDefault(); go('personal'); }}>‹ Personal</a></p>
      <h1>Data sources & credits</h1>
      <p>Last updated November 14, 2026. Swello is built on public data. Each source below is what the app actually uses, with its license and the credit its owner asks for.</p>
      <h2>Forecast, tide, buoy and map data</h2>
      <ul className="cr-list">{SOURCES.map((s) => (
        <li key={s.name}>
          <b>{s.name}</b>
          <span>{s.supplies}</span>
          <span><i>License:</i> {s.licence}</span>
          {s.credit && <span><i>Credit:</i> {s.credit}</span>}
          <span>{s.links.map(([label, url], k) => <span key={url}>{k ? ' · ' : ''}<a href={url} target="_blank" rel="noopener noreferrer">{label} ↗</a></span>)}</span>
        </li>
      ))}</ul>
      <h2>Water quality</h2>
      <p>The water-quality line on a spot page quotes the agency's own result and date for one reviewed station near the spot.</p>
      <ul className="cr-list">{Object.values(WQ_AGENCIES).map((a) => <li key={a.agency}><b>{a.agency}</b><span><i>Terms:</i> {a.licence}</span><span><a href={a.url} target="_blank" rel="noopener noreferrer">Source ↗</a></span></li>)}</ul>
      <h2>Spot guides</h2>
      <p>Each spot fact (facing, swell window, bottom, hazards) cites the guide it came from, with the date it was read: <a href="https://www.surfnerd.com/" target="_blank" rel="noopener noreferrer">Surfnerd ↗</a>, <a href="https://www.surf-forecast.com/" target="_blank" rel="noopener noreferrer">Surf-Forecast.com ↗</a>, <a href="https://www.wannasurf.com/" target="_blank" rel="noopener noreferrer">Wannasurf ↗</a>, <a href="https://thesurfatlas.com/" target="_blank" rel="noopener noreferrer">The Surf Atlas ↗</a> and <a href="https://www.mondo.surf/" target="_blank" rel="noopener noreferrer">Mondo.surf ↗</a>, plus a few park and agency pages (NPS, California State Parks, USGS).</p>
      <h2>Cameras</h2>
      <ul className="cr-list">
        {streams.map((c) => <li key={c.credit}><b>{c.credit}</b><span>{c.kind === 'still' ? 'Still images, loaded from the owner\'s host.' : 'A YouTube stream, loaded only when you tap it.'} {c.licence}</span>
          <span><a href={c.pageUrl} target="_blank" rel="noopener noreferrer">Source page ↗</a>{c.channelUrl && <> · <a href={c.channelUrl} target="_blank" rel="noopener noreferrer">Channel ↗</a></>}</span></li>)}
        {HDONTAP_CAMS.some((c) => c.snapshotUrl) && <li><b>HDOnTap snapshots</b><span>{HDONTAP_ATTRIBUTION}. Live-updating pictures, loaded from HDOnTap's host about once a minute, each linking to its camera page. Cameras: {HDONTAP_CAMS.filter((c) => c.snapshotUrl).map((c) => c.name).join(', ')}.</span><span><a href={HDONTAP_LOGO_LINK} target="_blank" rel="noopener noreferrer">HDOnTap.com ↗</a></span></li>}
        {hd.length > 0 && <li><b>HDOnTap cameras</b><span>Links, unless HDOnTap allows this site, in which case its player loads only when you tap. Owners: {hd.join(', ')}.</span></li>}
        {camLinks.length > 0 && <li><b>Other public cameras</b><span>Links to the owners' own pages: {camLinks.join(', ')}.</span></li>}
      </ul>
      <h2>Photographs</h2>
      <p>{photos.length} photographs from Wikimedia Commons contributors, each credited with its author and license wherever it is shown ({[...new Set(photos.map((x) => x.license))].sort().join(', ')}).</p>
      <h2>Fonts and software</h2>
      <p>Fonts are self-hosted under the SIL Open Font License (Inter, Instrument Sans, Archivo, Syne). The map uses MapLibre GL JS (BSD-3-Clause) and Leaflet (BSD-2-Clause); the 3D views use three.js (MIT).</p>
      <p>A missing or wrong credit is a bug; each source's own terms take precedence over this page.</p>
    </article>
  );
}
