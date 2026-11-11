/** CO-OPS tide-prediction stations (T-041). A spot may use a station's tide only by a reviewed assignment; labels always say "station tide", never "beach tide".
 *  Positions read from the CO-OPS metadata API (mdapi) on 2026-11-02; predictions verified live for both new stations. */
import {hasUsData} from './coverage.ts';
import {nearSanFrancisco} from '../data/coast.ts';
export interface TideStation {id: string; name: string; lat: number; lon: number; retrievedOn: string; url: string}
export const tideStations: TideStation[] = [
  {id: '9414290', name: 'San Francisco', lat: 37.806305, lon: -122.46589, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9414290'},
  {id: '9414131', name: 'Pillar Point Harbor', lat: 37.5025, lon: -122.48217, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9414131'},
  {id: '9415020', name: 'Point Reyes', lat: 37.994167, lon: -122.97361, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9415020'},
  // T-082 (2026-11-02): the nearest CO-OPS prediction station (reference or subordinate) of every covered spot, from the mdapi station list.
  // High/low predictions only (subordinate stations have no hourly series); used for the 'next tide' line, labelled "<name> station".
  {id: '9410120', name: "Imperial Beach", lat: 32.57830, lon: -117.13500, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410120'},
  {id: '9410230', name: "La Jolla (Scripps Institution Wharf)", lat: 32.86689, lon: -117.25714, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410230'},
  {id: '9410580', name: "Newport Bay Entrance, Corona del Mar", lat: 33.60330, lon: -117.88300, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410580'},
  {id: '9410599', name: "Santa Ana River entrance (inside)", lat: 33.63000, lon: -117.95800, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410599'},
  {id: '9410738', name: "King Harbor, Santa Monica Bay", lat: 33.84670, lon: -118.39800, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410738'},
  {id: '9410777', name: "El Segundo, Santa Monica Bay", lat: 33.90830, lon: -118.43300, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410777'},
  {id: '9410840', name: "Santa Monica, Municipal Pier", lat: 34.00830, lon: -118.50000, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410840'},
  {id: '9411189', name: "Ventura", lat: 34.26670, lon: -119.28300, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9411189'},
  {id: '9411270', name: "Rincon Island, Mussel Shoals", lat: 34.34830, lon: -119.44300, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9411270'},
  {id: '9412110', name: "Port San Luis", lat: 35.16889, lon: -120.75417, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9412110'},
  {id: '9412802', name: "Mansfield Cone", lat: 35.94953, lon: -121.48194, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9412802'},
  {id: '9413375', name: "Carmel Cove, Carmel Bay", lat: 36.52000, lon: -121.94000, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9413375'},
  {id: '9413450', name: "Monterey, Monterey Bay", lat: 36.60889, lon: -121.89139, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9413450'},
  {id: '9413616', name: "Moss Landing, Ocean Pier", lat: 36.80170, lon: -121.79000, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9413616'},
  {id: '9413663', name: "Elkhorn Slough railroad bridge", lat: 36.85667, lon: -121.75500, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9413663'},
  {id: '9413745', name: "Santa Cruz, Monterey Bay", lat: 36.95830, lon: -122.01700, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9413745'},
  {id: '9413878', name: "Ano Nuevo Island", lat: 37.10830, lon: -122.33800, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9413878'},
  {id: '9414275', name: "Ocean Beach, outer coast", lat: 37.77500, lon: -122.51300, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9414275'},
  {id: '9414958', name: "Bolinas Lagoon", lat: 37.90800, lon: -122.67850, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9414958'},
  {id: '9415469', name: "Tomales Bay entrance", lat: 38.22830, lon: -122.97700, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9415469'},
  {id: '9415625', name: "Bodega Harbor entrance", lat: 38.30830, lon: -123.05500, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9415625'},
  {id: '9416841', name: "Arena Cove", lat: 38.91456, lon: -123.71108, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9416841'},
  {id: '9418024', name: "Shelter Cove", lat: 40.02500, lon: -124.05800, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9418024'},
  {id: '9418767', name: "Humboldt Bay (North Spit)", lat: 40.76691, lon: -124.21734, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9418767'},
  {id: '9419059', name: "Trinidad Harbor", lat: 41.05670, lon: -124.14700, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9419059'},
  {id: '9419750', name: "Crescent City", lat: 41.74561, lon: -124.18439, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9419750'},
  {id: 'TWC0413', name: "Quivira Basin, Mission Bay", lat: 32.76667, lon: -117.23333, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0413'},
  {id: 'TWC0419', name: "San Clemente", lat: 33.41667, lon: -117.61667, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0419'},
  {id: 'TWC0445', name: "Mugu Lagoon (ocean pier)", lat: 34.10000, lon: -119.10000, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0445'},
  {id: 'TWC0473', name: "Point Arguello", lat: 34.58333, lon: -120.65000, retrievedOn: '2026-11-02', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0473'},
  {id: '9411340', name: "Santa Barbara", lat: 34.40459, lon: -119.69249, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9411340'},
  {id: '9442861', name: "Makah Bay", lat: 48.29670, lon: -124.67200, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9442861'},
  {id: '9442388', name: "James Island", lat: 47.90670, lon: -124.64700, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9442388'},
  {id: '9441102', name: "Westport, Point Chehalis", lat: 46.90431, lon: -124.10508, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9441102'},
  {id: '9440581', name: "Cape Disappointment", lat: 46.28103, lon: -124.04628, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9440581'},
  {id: 'TWC0881', name: "Point Adams, Oreg.", lat: 46.20000, lon: -123.95000, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0881'},
  {id: 'TWC0857', name: "Nestucca Bay entrance", lat: 45.16667, lon: -123.96667, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0857'},
  {id: '9434132', name: "Siuslaw River Entrance", lat: 44.01670, lon: -124.13000, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9434132'},
  {id: '9431647', name: "Port Orford", lat: 42.73900, lon: -124.49830, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9431647'},
  {id: '9430104', name: "Brookings, Chetco Cove", lat: 42.04330, lon: -124.28500, retrievedOn: '2026-11-08', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9430104'},
  {id: '9437585', name: "North Jetty, Tillamook Bay", lat: 45.57000, lon: -123.96500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9437585'},
  {id: '9435380', name: "Southbeach", lat: 44.62544, lon: -124.04494, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9435380'},
  {id: '9432436', name: "Rink Creek Entrance, Coquille River", lat: 43.15790, lon: -124.18180, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9432436'},
  {id: '1612366', name: "Pearl Harbor Entrance, Bishop Point", lat: 21.33000, lon: -157.96700, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1612366'},
  {id: '1612340', name: "HONOLULU", lat: 21.30333, lon: -157.86453, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1612340'},
  {id: '1612376', name: "Waimanalo", lat: 21.33500, lon: -157.69300, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1612376'},
  {id: '1612668', name: "Haleiwa, Waialua Bay", lat: 21.59830, lon: -158.10800, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1612668'},
  {id: '8459681', name: "Southwest Point, Block Island", lat: 41.16330, lon: -71.61000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8459681'},
  {id: '8515186', name: "Fire Island Coast Guard Station", lat: 40.62670, lon: -73.26000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8515186'},
  {id: '8531680', name: "Sandy Hook, Fort Hancock", lat: 40.46690, lon: -74.00940, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8531680'},
  {id: '8532337', name: "Belmar, Atlantic Ocean", lat: 40.18500, lon: -74.00830, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8532337'},
  {id: '8533071', name: "Seaside Heights, ocean", lat: 39.94330, lon: -74.03500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8533071'},
  {id: '8534720', name: "Atlantic City (Ocean)", lat: 39.35667, lon: -74.41805, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8534720'},
  {id: '8639168', name: "Virginia Beach", lat: 36.84330, lon: -75.97170, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8639168'},
  {id: '8639428', name: "Sandbridge", lat: 36.69170, lon: -75.92000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8639428'},
  {id: '8651370', name: "DUCK PIER", lat: 36.18330, lon: -75.74670, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8651370'},
  {id: '8651605', name: "Kitty Hawk (ocean)", lat: 36.10170, lon: -75.71000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8651605'},
  {id: '8652226', name: "Jennettes Pier, Nags Head (ocean)", lat: 35.91000, lon: -75.59169, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8652226'},
  {id: 'TEC2789', name: "Cape Hatteras", lat: 35.23333, lon: -75.51667, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TEC2789'},
  {id: '8654400', name: "CAPE HATTERAS FISHING PIER", lat: 35.22330, lon: -75.63500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8654400'},
  {id: 'TEC2837', name: "Bogue Inlet", lat: 34.65000, lon: -77.10000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TEC2837'},
  {id: '8657419', name: "Ocean City Beach (fishing pier)", lat: 34.45170, lon: -77.49500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8657419'},
  {id: '8658163', name: "Wrightsville Beach", lat: 34.21331, lon: -77.78669, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8658163'},
  {id: '8658559', name: "Wilmington Beach", lat: 34.03170, lon: -77.89330, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8658559'},
  {id: '8659897', name: "Sunset Beach Pier", lat: 33.86500, lon: -78.50670, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8659897'},
  {id: '8659182', name: "Oak Island, Yaupon Beach", lat: 33.90170, lon: -78.08170, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8659182'},
  {id: '8663101', name: "Cape Romain", lat: 33.02500, lon: -79.34830, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8663101'},
  {id: '8665494', name: "Isle of Palms Pier", lat: 32.78330, lon: -79.78500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8665494'},
  {id: 'TEC3047', name: "Sullivans Island (outer coast)", lat: 32.76667, lon: -79.83333, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TEC3047'},
  {id: 'TEC3127', name: "Folly Island (outer coast)", lat: 32.65000, lon: -79.93333, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TEC3127'},
  {id: '8667630', name: "Edisto Beach, Edisto Island", lat: 32.50170, lon: -80.29670, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8667630'},
  {id: '8669625', name: "Braddock Point, Hilton Head Island", lat: 32.11330, lon: -80.83000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8669625'},
  {id: '8670892', name: "Tybee Light", lat: 32.02830, lon: -80.85500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8670892'},
  {id: '8677344', name: "St. Simons Light", lat: 31.13170, lon: -81.39670, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8677344'},
  {id: '8679997', name: "St. Marys Entrance, North Jetty", lat: 30.72000, lon: -81.44500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8679997'},
  {id: '8720194', name: "Little Talbot Island, ocean", lat: 30.43000, lon: -81.40500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8720194'},
  {id: '8720259', name: "Atlantic Beach", lat: 30.33500, lon: -81.39500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8720259'},
  {id: '8720291', name: "Jacksonville Beach", lat: 30.28330, lon: -81.38670, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8720291'},
  {id: '8720587', name: "St. Augustine Beach", lat: 29.85670, lon: -81.26330, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8720587'},
  {id: '8721120', name: "Daytona Beach Shores, Sunglow Pier", lat: 29.14670, lon: -80.96330, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8721120'},
  {id: 'TEC3693', name: "Cape Canaveral", lat: 28.43333, lon: -80.56667, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TEC3693'},
  {id: '8721604', name: "Port Canaveral (Trident Pier)", lat: 28.41580, lon: -80.59310, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8721604'},
  {id: '8721649', name: "Cocoa Beach", lat: 28.36830, lon: -80.60000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8721649'},
  {id: '8721727', name: "Patrick Air Force Base", lat: 28.24500, lon: -80.60000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8721727'},
  {id: '8721804', name: "Canova Beach", lat: 28.13830, lon: -80.57830, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8721804'},
  {id: '8722105', name: "Vero Beach (ocean)", lat: 27.67000, lon: -80.36000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8722105'},
  {id: '8722212', name: "Fort Pierce Inlet, south jetty", lat: 27.47000, lon: -80.28830, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8722212'},
  {id: '8722366', name: "Seminole Shores", lat: 27.18330, lon: -80.15830, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8722366'},
  {id: '8722862', name: "Hillsboro Inlet (ocean)", lat: 26.25670, lon: -80.08000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8722862'},
  {id: '8722899', name: "Lauderdale-by-the-Sea, Anglin Fishing Pier", lat: 26.18830, lon: -80.09330, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8722899'},
  {id: '8722979', name: "Hollywood Beach", lat: 26.04000, lon: -80.11500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8722979'},
  {id: '8723080', name: "Haulover Pier, N. Miami Beach", lat: 25.90330, lon: -80.12000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8723080'},
  {id: '8723170', name: "Miami Harbor Entrance", lat: 25.76830, lon: -80.13170, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8723170'},
  {id: '8723178', name: "GOVERNMENT CUT, MIAMI HARBOR ENTRANCE", lat: 25.76330, lon: -80.13000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8723178'},
  {id: '1611400', name: "NAWILIWILI", lat: 21.95440, lon: -159.35610, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1611400'},
  {id: '1610367', name: "Nonopapa, Niihau Island", lat: 21.87000, lon: -160.23500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1610367'},
  {id: '1612482', name: "Waianae", lat: 21.44500, lon: -158.19200, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1612482'},
  {id: '1612480', name: "MOKU O LOE", lat: 21.43306, lon: -157.79000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1612480'},
  {id: '1613226', name: "Kolo", lat: 21.09330, lon: -157.19700, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1613226'},
  {id: '1613198', name: "Kaunakakai", lat: 21.08500, lon: -157.03200, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1613198'},
  {id: '1613155', name: "Pukoo Harbor", lat: 21.07170, lon: -156.80000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1613155'},
  {id: 'TPT2799', name: "Lahaina", lat: 20.88333, lon: -156.68333, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TPT2799'},
  {id: '1615680', name: "KAHULUI", lat: 20.89494, lon: -156.46900, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1615680'},
  {id: '1614465', name: "Kaumalapau, Lanai Island", lat: 20.79000, lon: -156.99500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1614465'},
  {id: '1613077', name: "Kamalo Harbor", lat: 21.04830, lon: -156.87700, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1613077'},
  {id: '1615395', name: "Hana", lat: 20.76170, lon: -155.98700, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1615395'},
  {id: '1615202', name: "Makena", lat: 20.65670, lon: -156.44500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1615202'},
  {id: '1617277', name: "Mahukona", lat: 20.18670, lon: -155.90300, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1617277'},
  {id: '1617433', name: "Kawaihae", lat: 20.03660, lon: -155.82940, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1617433'},
  {id: '1617760', name: "HILO", lat: 19.73028, lon: -155.05556, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1617760'},
  {id: '1617846', name: "Kailua Kona", lat: 19.64330, lon: -156.00000, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1617846'},
  {id: '1618578', name: "Honuapo", lat: 19.08830, lon: -155.55300, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1618578'},
  {id: '1611683', name: "Hanalei Bay", lat: 22.21500, lon: -159.50200, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1611683'},
  {id: '1611443', name: "Hanamaulu Bay", lat: 21.99500, lon: -159.33500, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1611443'},
  {id: '1611401', name: "Waimea Bay", lat: 21.95670, lon: -159.67300, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=1611401'},
  {id: 'TPT2779', name: "Laie Bay", lat: 21.65000, lon: -157.93333, retrievedOn: '2026-11-09', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TPT2779'},
  {id: '9417624', name: "Westport", lat: 39.63330, lon: -123.78300, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9417624'},
  {id: '9417426', name: "NOYO HARBOR", lat: 39.42578, lon: -123.80511, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9417426'},
  {id: 'TWC0771', name: "Point Arena", lat: 38.95000, lon: -123.73333, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0771'},
  {id: '9416409', name: "Green Cove", lat: 38.70433, lon: -123.44939, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9416409'},
  {id: '9416024', name: "Fort Ross", lat: 38.51330, lon: -123.24500, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9416024'},
  {id: '9412553', name: "San Simeon", lat: 35.64170, lon: -121.18800, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9412553'},
  {id: '9411399', name: "Gaviota State Park, Pacific Ocean", lat: 34.46939, lon: -120.22831, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9411399'},
  {id: '9411065', name: "Port Hueneme", lat: 34.14830, lon: -119.20300, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9411065'},
  {id: '9410678', name: "Long Beach Fire Boat Pier", lat: 33.74780, lon: -118.21580, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410678'},
  {id: '9410660', name: "LOS ANGELES (Outer Harbor)", lat: 33.72000, lon: -118.27200, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410660'},
  {id: '9410650', name: "Cabrillo Beach", lat: 33.70670, lon: -118.27300, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410650'},
  {id: '9410583', name: "Balboa Pier, Newport Beach", lat: 33.60000, lon: -117.90000, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410583'},
  {id: '9410166', name: "San Diego, Quarantine Station", lat: 32.70330, lon: -117.23500, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410166'},
  {id: 'TWC0405', name: "Point Loma", lat: 32.66667, lon: -117.23333, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0405'},
  {id: '9410170', name: "SAN DIEGO (Broadway)", lat: 32.71556, lon: -117.17667, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9410170'},
  {id: '9443644', name: "Twin Rivers", lat: 48.17500, lon: -123.95000, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9443644'},
  {id: 'TWC0965', name: "Destruction Island", lat: 47.66667, lon: -124.48333, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TWC0965'},
  {id: '9441627', name: "Point Grenville", lat: 47.30330, lon: -124.27000, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9441627'},
  {id: '9441156', name: "Point Brown", lat: 46.95000, lon: -124.12800, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9441156'},
  {id: '9440574', name: "Columbia River entrance (N. Jetty)", lat: 46.27330, lon: -124.07200, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9440574'},
  {id: '9433445', name: "Umpqua River Entrance, Half Moon Bay", lat: 43.67500, lon: -124.19200, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9433445'},
  {id: '9447934', name: "Point Partridge, Whidbey Island", lat: 48.23170, lon: -122.76500, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9447934'},
  {id: '9432780', name: "CHARLESTON", lat: 43.34500, lon: -124.32200, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9432780'},
  {id: '9451802', name: "Scraggy Point", lat: 57.33670, lon: -135.72300, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9451802'},
  {id: '9451741', name: "Whitestone Narrows, Neva Strait", lat: 57.25000, lon: -135.56700, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9451741'},
  {id: '9451600', name: "Sitka", lat: 57.05106, lon: -135.34412, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9451600'},
  {id: '9451725', name: "Olga Point, Olga Strait", lat: 57.22830, lon: -135.53700, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9451725'},
  {id: '9451468', name: "Symonds Bay, Biorka Island", lat: 56.85670, lon: -135.52000, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9451468'},
  {id: '8450768', name: "Sakonnet", lat: 41.46500, lon: -71.19330, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8450768'},
  {id: '8451351', name: "Sachuest, Flint Point", lat: 41.48670, lon: -71.23830, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8451351'},
  {id: '8453999', name: "Beavertail Point", lat: 41.45170, lon: -71.40170, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8453999'},
  {id: '8454658', name: "Narragansett Pier", lat: 41.42170, lon: -71.45500, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8454658'},
  {id: '8448875', name: "Martha\'s Vineyard GPS Buoy", lat: 41.32622, lon: -70.59033, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8448875'},
  {id: '8448942', name: "Squibnocket Point", lat: 41.31170, lon: -70.76830, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8448942'},
  {id: '9759412', name: "Aguadilla", lat: 18.45664, lon: -67.16458, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9759412'},
  {id: '9757809', name: "Arecibo", lat: 18.48053, lon: -66.70236, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9757809'},
  {id: '9754986', name: "Boca de Cangrejos", lat: 18.45660, lon: -65.99150, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9754986'},
  {id: '9754487', name: "Puerto Maunabo", lat: 17.99140, lon: -65.88880, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9754487'},
  {id: '8418031', name: "Portland Head Light", lat: 43.62330, lon: -70.20670, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8418031'},
  {id: '8418557', name: "Old Orchard Beach", lat: 43.51670, lon: -70.36670, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8418557'},
  {id: '8448683', name: "Wasque Point, Chappaquiddick Island", lat: 41.36330, lon: -70.45000, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8448683'},
  {id: '8449062', name: "Eel Point", lat: 41.29170, lon: -70.20830, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8449062'},
  {id: '8458694', name: "Watch Hill Point", lat: 41.30500, lon: -71.86000, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8458694'},
  {id: '8512354', name: "Shinnecock Inlet (ocean)", lat: 40.83670, lon: -72.48000, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8512354'},
  {id: '8513398', name: "Moriches Inlet", lat: 40.76442, lon: -72.75597, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8513398'},
  {id: '8531991', name: "Long Branch (fishing pier)", lat: 40.30330, lon: -73.97670, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8531991'},
  {id: '8534770', name: "Ventnor City, ocean pier", lat: 39.33500, lon: -74.47670, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8534770'},
  {id: '8656937', name: "Cape Lookout (ocean)", lat: 34.60830, lon: -76.52830, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8656937'},
  {id: '8660266', name: "Hog Inlet Pier", lat: 33.83670, lon: -78.60670, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8660266'},
  {id: '8661070', name: "Springmaid Pier, Myrtle beach", lat: 33.65500, lon: -78.91830, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8661070'},
  {id: '8661437', name: "Garden City Pier (ocean)", lat: 33.57500, lon: -78.99670, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8661437'},
  {id: '8662006', name: "Pawleys Island Pier (ocean)", lat: 33.43170, lon: -79.11670, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8662006'},
  {id: '8722670', name: "Lake Worth Pier (ocean)", lat: 26.61278, lon: -80.03417, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8722670'},
  {id: '8731269', name: "Gulf State Park Pier", lat: 30.24830, lon: -87.66830, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8731269'},
  {id: '8760172', name: "Chandeleur Light", lat: 30.04830, lon: -88.87170, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8760172'},
  {id: '8773767', name: "Matagorda Bay Entrance Channel", lat: 28.42690, lon: -96.33010, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8773767'},
  {id: '8726601', name: "Indian Rocks Beach (Coastal)", lat: 27.87330, lon: -82.85170, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8726601'},
  {id: '8775270', name: "Port Aransas (H. Caldwell Pier)", lat: 27.82670, lon: -97.05000, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8775270'},
  {id: '8775870', name: "Corpus Christi, Bob Hall Pier", lat: 27.58000, lon: -97.21670, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8775870'},
  {id: '8726282', name: "Anna Maria Key, city pier", lat: 27.53330, lon: -82.73000, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8726282'},
  {id: '8726034', name: "Siesta Key, Big Sarasota Pass", lat: 27.28390, lon: -82.56500, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8726034'},
  {id: '8725899', name: "Nokomis, Venice Inlet", lat: 27.12330, lon: -82.47000, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8725899'},
  {id: '8419399', name: "Cape Neddick", lat: 43.16670, lon: -70.59330, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8419399'},
  {id: '8429489', name: "Hampton Harbor", lat: 42.89500, lon: -70.81670, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8429489'},
  {id: '8674301', name: "South Newport River (Daymark 135)", lat: 31.57500, lon: -81.19000, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8674301'},
  {id: 'TEC3463', name: "Blackbeard Island", lat: 31.53333, lon: -81.20000, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=TEC3463'},
  {id: '8735180', name: "DAUPHIN ISLAND", lat: 30.25000, lon: -88.07500, retrievedOn: '2026-11-10', url: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=8735180'},
];
export const SF_STATION = '9414290';
/** Stations whose predictions the server ingests in addition to the existing San Francisco feed. Kept in sync with services/forecast-service.mjs by a test. */
export const extraTideStationIds = ['9414131', '9415020'];
/** A2: the hilo-list stations that are HARMONIC (NOAA CO-OPS type "R", reference stations: they publish an hourly prediction). The others are subordinate ("S": highs and lows only, as offsets from a reference station), so their curve is
 *  interpolated between NOAA's own highs and lows and labelled so. Source: api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions, read 2026-11-11 (a test checks every id is in the hilo list; the Worker ingests the hourly series of these and the two extras). */
export const harmonicTideStationIds = ['9410230', '9410580', '9410840', '9411270', '9412110', '9412802', '9413450', '9413663', '9414958', '9416841', '9418024', '9418767', '9419750', '9411340', '9441102', '9440581', '9431647', '9437585', '9435380', '9432436', '1612366', '1612340', '8459681', '8515186', '8531680', '8534720', '8651370', '8654400', '8658163', '8659897', '8659182', '8677344', '8720291', '8720587', '8721604', '8721649', '8722899', '8723080', '8723170', '8723178', '1611400', '1612480', '1613198', '1615680', '1617433', '1617760', '9417426', '9416409', '9411399', '9410678', '9410660', '9410170', '9433445', '9432780', '9451741', '9451600', '8450768', '8448875', '9759412', '9757809', '9754986', '9754487', '8512354', '8513398', '8534770', '8661070', '8661437', '8662006', '8722670', '8731269', '8773767', '8775270', '8775870', '8726034', '8725899', '8674301', '8735180'];
/** Every station whose hourly series the app reads: the two extras and the harmonic ones. Kept in sync with services/forecast-service.mjs (tideHourlyServiceStationIds) by a test. */
export const hourlyTideStationIds = [...extraTideStationIds, ...harmonicTideStationIds];
/** T-082: stations ingested for high/low predictions only (the nearest station of every covered spot). Kept in sync with services/forecast-service.mjs by a test. */
export const hiloTideStationIds = ['9410120', '9410230', '9410580', '9410599', '9410738', '9410777', '9410840', '9411189', '9411270', '9412110', '9412802', '9413375', '9413450', '9413616', '9413663', '9413745', '9413878', '9414275', '9414958', '9415469', '9415625', '9416841', '9418024', '9418767', '9419059', '9419750', 'TWC0413', 'TWC0419', 'TWC0445', 'TWC0473', '9411340', '9442861', '9442388', '9441102', '9440581', 'TWC0881', 'TWC0857', '9434132', '9431647', '9430104', '9437585', '9435380', '9432436', '1612366', '1612340', '1612376', '1612668', '8459681', '8515186', '8531680', '8532337', '8533071', '8534720', '8639168', '8639428', '8651370', '8651605', '8652226', 'TEC2789', '8654400', 'TEC2837', '8657419', '8658163', '8658559', '8659897', '8659182', '8663101', '8665494', 'TEC3047', 'TEC3127', '8667630', '8669625', '8670892', '8677344', '8679997', '8720194', '8720259', '8720291', '8720587', '8721120', 'TEC3693', '8721604', '8721649', '8721727', '8721804', '8722105', '8722212', '8722366', '8722862', '8722899', '8722979', '8723080', '8723170', '8723178', '1611400', '1610367', '1612482', '1612480', '1613226', '1613198', '1613155', 'TPT2799', '1615680', '1614465', '1613077', '1615395', '1615202', '1617277', '1617433', '1617760', '1617846', '1618578', '1611683', '1611443', '1611401', 'TPT2779', '9417624', '9417426', 'TWC0771', '9416409', '9416024', '9412553', '9411399', '9411065', '9410678', '9410660', '9410650', '9410583', '9410166', 'TWC0405', '9410170', '9443644', 'TWC0965', '9441627', '9441156', '9440574', '9433445', '9447934', '9432780', '9451802', '9451741', '9451600', '9451725', '9451468', '8450768', '8451351', '8453999', '8454658', '8448875', '8448942', '9759412', '9757809', '9754986', '9754487', '8418031', '8418557', '8448683', '8449062', '8458694', '8512354', '8513398', '8531991', '8534770', '8656937', '8660266', '8661070', '8661437', '8662006', '8722670', '8731269', '8760172', '8773767', '8726601', '8775270', '8775870', '8726282', '8726034', '8725899', '8419399', '8429489', '8674301', 'TEC3463', '8735180'];
/** Open-coast rule for choosing a tide station for a spot (spot expansion): a CO-OPS station far up a river, slough or lagoon, in an estuary bay or inside a harbour basin, says little about the beach (Seaside's nearest station was Cathcart Landing on Youngs River, 19.8 km;
 *  Pacific Beach's was Quivira Basin in Mission Bay; Blackies' was "Santa Ana River entrance (inside)"; Long Beach WA's was Tarlatt Slough, then "Ilwaco, Baker Bay"). CO-OPS metadata (mdapi) has no open-coast flag, so the rule is explicit and reads the station NAME, in this order:
 *    1. "inside" in the name: closed.
 *    2. a structure or entrance word (entrance, jetty, bar, spit, pier, wharf, ocean, outer coast): open ("Columbia River entrance (N. Jetty)", "Mugu Lagoon (ocean pier)").
 *    3. river, slough, creek, landing, bridge, lagoon, canal, channel, basin, marsh, docks, or a Bay (except the open bays Monterey, Santa Monica, Carmel and Makah): closed. A town name never rescues it ("Gold Beach, Rogue River" is up the Rogue).
 *    4. cape, point, island, head, beach, rock, light, reef: open.
 *    5. anything else (a town or harbour name such as "Nehalem" or "Santa Cruz"): unknown, allowed.
 *  A spot takes the nearest station that is not closed. The enclosed-water mask is NOT used: at 0.01 degrees it also calls harbour-mouth piers (Moss Landing, Monterey) enclosed, and it does not reach north of 43.6 N. */
export type TideExposure = 'open' | 'closed' | 'unknown';
const STRONG_OPEN = /\b(entrance|jetty|jetties|bar|spit|pier|wharf|ocean|outer coast)\b/i;
const WEAK_OPEN = /\b(cape|point|island|head|beach|rock|light|reef)\b/i;
const CLOSED_WORDS = /\b(river|slough|creek|landing|bridge|lagoon|canal|channel|basin|marsh|docks)\b/i;
const ESTUARY_BAY = /\bbay\b/i, OPEN_BAYS = /\b(monterey|santa monica|carmel|makah) bay\b/i;
/** Reviewed per-station overrides, consulted BEFORE the words (the name rule cannot tell an estuary town from an open-coast one; the Oregon/Washington data-honesty review, 2026-11-09). Each entry says why, with the CO-OPS page.
 *  'closed-if-alternative' = a sheltered station that is kept only when no open station is within range. */
export type TideOverride = {exposure: 'open' | 'closed' | 'closed-if-alternative'; reason: string};
const COOPS = (id: string) => `https://tidesandcurrents.noaa.gov/stationhome.html?id=${id}`;
export const TIDE_EXPOSURE_OVERRIDES: Record<string, TideOverride> = {
  '9437908': {exposure: 'closed', reason: `Nehalem is up the Nehalem Bay estuary: its predictions run about +77/+116 min behind Crescent City with damped lows (${COOPS('9437908')})`},
  '9437815': {exposure: 'closed', reason: `Brighton is on Nehalem Bay, the same estuary as Nehalem, a subordinate station of Crescent City (${COOPS('9437815')})`},
  '9435385': {exposure: 'closed', reason: `YAQUINA USCG STA, NEWPORT ran for six weeks in 1982 only: no longer a predicting station to rely on; South Beach 9435380 replaces it (${COOPS('9435385')})`},
  '9435380': {exposure: 'open', reason: `Southbeach, the active reference station at the Yaquina Bay entrance (Newport), replaces the 1982 USCG station (${COOPS('9435380')})`},
  '1612668': {exposure: 'open', reason: `Haleiwa (Waialua Bay) is on the open North Shore of Oahu, exposed to the Pacific, not an estuary: "Bay" in Hawaii does not mean sheltered. There is no other open North Shore station to compare it with (${COOPS('1612668')})`},
  '9432864': {exposure: 'closed', reason: `Empire is inside Coos Bay, the same boat basin and estuary as Charleston (${COOPS('9432864')})`},
  '9432879': {exposure: 'closed', reason: `Sitka Dock is inside Coos Bay (${COOPS('9432879')})`},
  '9432780': {exposure: 'closed-if-alternative', reason: `Charleston is in the Coos Bay boat basin (small lag to the open coast): used only when no open-coast station is within range (${COOPS('9432780')})`},
};
/** US West, Oregon and Washington (2026-11-10, the west-orwa-ak batch): the stations the importer picked, reviewed by TIMING as in 3C and the California review: NOAA predicted high/low times 2026-11-10..16 (docs/forecast/data/tide-timing.ts),
 *  the mean offset of each station against a neighbour on the exposed coast (nearest same-type extremum within 3 h), sd and range ratio. The tide progresses along this coast (Port Orford +10 min after Crescent City, South Beach +37), so a station is judged against
 *  its NEIGHBOURS. Entrance, jetty and cape gauges follow their neighbours within ~35 min and a range ratio of 0.9-1.15 (open); river, bay and strait gauges lag 60-150 min and are damped (0.73-0.76 or longer lows). Brookings is reviewed in the California batch. */
const ORWA_REVIEWED: Record<string, ['open' | 'closed' | 'closed-if-alternative', string]> = {
  '9430104': ['open', 'Brookings (Chetco Cove) on the open south Oregon coast: 7-day mean offset 3 min (sd 2) from Crescent City and 10 min before Port Orford, range ratio 1.00'],
  '9431647': ['open', 'Port Orford (the dock in the open cove): 7-day mean offset 10 min (sd 2) from Crescent City, range ratio 1.07'],
  '9432780': ['open', 'Charleston (Coos Bay boat basin, at the bay mouth): 7-day mean offset 17 min (sd 8) from Port Orford, range ratio 1.03, the same progression as the coast either side (Umpqua 30 min): the small lag the first review feared is not there'],
  '9432436': ['closed-if-alternative', 'Rink Creek Entrance is inside the Coquille River: 7-day mean offset 148 min (sd 19, only 14 of 28 extrema pair) from Port Orford and 149 min from Crescent City, range ratio 0.73-0.78: river water, not the open coast; used only when no open-coast gauge is within range'],
  '9433445': ['open', 'Umpqua River Entrance (Winchester Bay, at the jetties): 7-day mean offset 3 min (sd 3) from South Beach and 30 min from Port Orford, range ratio 0.88'],
  '9434132': ['open', 'Siuslaw River Entrance (Florence, at the jetties): 7-day mean offset -6 min (sd 3) from South Beach, range ratio 0.88'],
  '9437381': ['closed', 'Dick Point is inside Tillamook Bay: 7-day mean offset 105-115 min (sd 28) from Port Orford and Crescent City: bay water'],
  'TWC0857': ['open', 'Nestucca Bay entrance (Pacific City): 7-day mean offset 26 min (sd 15) from South Beach and 25 min from the Tillamook jetty, range ratio 0.92'],
  '9437585': ['open', 'North Jetty, Tillamook Bay: 7-day mean offset 1 min (sd 6) from South Beach, range ratio 0.97'],
  'TWC0881': ['open', 'Point Adams at the Columbia River mouth (Oregon side): 7-day mean offset 34 min (sd 5) from South Beach, range ratio 1.02'],
  '9440581': ['open', 'Cape Disappointment at the Columbia River mouth (Washington side): 7-day mean offset 26 min (sd 6) from South Beach, range ratio 0.96'],
  '9440574': ['open', 'Columbia River entrance (North Jetty): 7-day mean offset 14 min (sd 5) from South Beach, range ratio 0.91'],
  '9440747': ['closed', 'Nahcotta is inside Willapa Bay (the bay side of the Long Beach peninsula): 7-day mean offset 70 min (sd 4) from South Beach, range ratio 1.13'],
  '9441156': ['open', 'Point Brown (Ocean Shores) on the open coast: 7-day mean offset 25 min (sd 7) from South Beach, range ratio 1.14'],
  '9441627': ['open', 'Point Grenville on the open Washington coast: 7-day mean offset 1 min (sd 4) from South Beach and -14 min from Makah Bay, range ratio 0.99'],
  'TWC0965': ['open', 'Destruction Island on the open Washington coast: 7-day mean offset 2 min (sd 4) from South Beach, range ratio 1.05'],
  '9442388': ['open', 'James Island (La Push) on the open coast: 7-day mean offset 6 min (sd 6) from South Beach and -9 min from Makah Bay, range ratio 0.99'],
  '9442861': ['open', 'Makah Bay on the open coast south of Cape Flattery: 7-day mean offset 15 min (sd 4) from South Beach, range ratio 1.06'],
  '9447929': ['closed', 'Coupeville is in Penn Cove, Puget Sound (Whidbey Island): its predictions are a sound tide, no extremum within 3 h of Makah Bay\'s over 7 days (offset more than 3 h) and a range ratio of 1.42'],
  '9440723': ['closed', 'Paradise Point (Long Island) is inside Willapa Bay: 7-day mean offset 84 min (sd 4) from South Beach, range ratio 1.15'],
  '9437540': ['closed-if-alternative', 'Garibaldi is inside Tillamook Bay: 7-day mean offset 25 min (sd 3) from South Beach and 24 min from the bay-mouth North Jetty (1 min), range ratio 1.00: bay water with a modest lag, used only when no open-coast gauge is within range'],
  '9447951': ['closed', 'Sunset Beach on Whidbey Island is on Puget Sound (Saratoga Passage / Skagit Bay side): 7-day mean offset 141 min from South Beach on only 3 of 28 extrema that pair, a sound tide'],
  'TWC0863': ['closed', 'Miami Cove is in the Miami River mouth inside Tillamook Bay: 7-day mean offset 43 min (sd 13) from South Beach, range ratio 0.81: bay water'],
  '9443644': ['closed-if-alternative', 'Twin Rivers is on the Strait of Juan de Fuca: 7-day mean offset 64 min (sd 25) from Makah Bay at the strait mouth, range ratio 0.76: strait water that lags the outer coast, used only when no open-coast gauge is within range (the strait spots have none)'],
  '9447934': ['closed-if-alternative', 'Point Partridge is at the entrance of Admiralty Inlet (Puget Sound): 7-day mean offset 162 min (sd 19, 7 of 28 extrema pair) from Makah Bay: sound water, used only when no open-coast gauge is within range'],
};
for (const [id, [exposure, reason]] of Object.entries(ORWA_REVIEWED)) TIDE_EXPOSURE_OVERRIDES[id] = {exposure, reason: `${reason} (${COOPS(id)})`};
/** Puget Sound (2026-11-10): every CO-OPS tide-prediction station in the box 47.0-49.0 N, 123.1-122.0 W (the CO-OPS station list; Puget Sound, Admiralty Inlet, Whidbey Island, the San Juan waters) is sound water east of the Strait of Juan de Fuca's open mouth:
 *  the ones checked by 7-day timing pair on 3-7 of 28 extrema or not at all against Makah Bay / South Beach (offsets 141-162 min, range ratio 1.4). Closed, so no spot takes a sound gauge. Fort Ebey (Admiralty Inlet) falls back to Point Partridge, labelled. */
const PUGET_SOUND_CLOSED = ['9444555', '9444705', '9444900', '9444971', '9444972', '9445016', '9445017', '9445059', '9445088', '9445133', '9445246', '9445269', '9445272', '9445293', '9445303', '9445326', '9445388', '9445441', '9445478', '9445526', '9445639', '9445683', '9445719', '9445753', '9445832', '9445882', '9445901', '9445913', '9445938', '9445958', '9445993', '9446025', '9446248', '9446254', '9446281', '9446291', '9446366', '9446369', '9446375', '9446451', '9446484', '9446486', '9446489', '9446491', '9446500', '9446583', '9446628', '9446638', '9446666', '9446671', '9446705', '9446714', '9446742', '9446752', '9446800', '9446804', '9446807', '9446828', '9446969', '9447029', '9447110', '9447130', '9447265', '9447427', '9447659', '9447717', '9447773', '9447814', '9447854', '9447855', '9447856', '9447883', '9447905', '9447952', '9447973', '9447985', '9447993', '9447995', '9448009', '9448043', '9448094', '9448558', '9448576', '9448601', '9448614', '9448657', '9448682', '9448683', '9448772', '9448794', '9448876', '9448918', '9449161', '9449184', '9449211', '9449292', '9449424', '9449639', '9449679', '9449704', '9449712', '9449746', '9449771', '9449798', '9449856', '9449880', '9449904', '9449911', '9449932', '9449982', '9449988', '9449994', 'TWC1115', 'TWC1125', 'TWC1131', 'TWC1165', 'TWC1173', 'TWC1189'];
for (const id of PUGET_SOUND_CLOSED) TIDE_EXPOSURE_OVERRIDES[id] = {exposure: 'closed', reason: `inside Puget Sound, Admiralty Inlet or the San Juan waters (position in the CO-OPS station list, 2026-11-10; the stations checked by 7-day timing are 141-162 min from the outer coast or do not pair) (${COOPS(id)})`};
/** Alaska, Sitka Sound (2026-11-10): the five CO-OPS prediction stations around Sitka compared by 7-day timing against the Sitka reference (docs/forecast/data/tide-timing.ts): all follow it within 15 min with range ratios 0.92-1.02, so the sound's tide is one tide.
 *  Whitestone Narrows and Olga Point are inside the Neva / Olga straits by position but their times and range match the open sound; Symonds Bay (Biorka Island) is the outer coast, "Bay" does not mean sheltered here either. */
const SITKA_REVIEWED: Record<string, ['open' | 'closed' | 'closed-if-alternative', string]> = {
  '9451600': ['open', 'Sitka (Japonski Island), the Sitka Sound reference station, which is wide open to the Pacific'],
  '9451802': ['open', 'Scraggy Point on the open northwest coast of Baranof Island: 7-day mean offset -4 min (sd 5) from Sitka, range ratio 0.98'],
  '9451468': ['open', 'Symonds Bay at Biorka Island, the outer coast at the mouth of Sitka Sound: 7-day mean offset -15 min (sd 1) from Sitka, range ratio 0.99'],
  '9451741': ['open', 'Whitestone Narrows is inside Neva Strait by position, but its times and range match the open sound: 7-day mean offset 6 min (sd 3) from Sitka, range ratio 1.02'],
  '9451725': ['open', 'Olga Point is inside Olga Strait by position, but its times and range match the open sound: 7-day mean offset 7 min (sd 7) from Sitka, range ratio 0.92'],
};
for (const [id, [exposure, reason]] of Object.entries(SITKA_REVIEWED)) TIDE_EXPOSURE_OVERRIDES[id] = {exposure, reason: `${reason} (${COOPS(id)})`};
/** US East (2026-11-09): every station the importer picked for the first East batch, reviewed one by one from its CO-OPS name and position (the station home page is the source; the name decides, the position confirms bay side vs ocean side). The word rule alone let through bay, sound, ICWW (Intracoastal Waterway), harbour, lake, causeway and "wharf ... River" stations. Anything on the East Coast that is not listed in this table or in EAST_OPEN below is CLOSED (isEastStationId): the word rule is not used for East stations. */
const EAST_REVIEWED: [string[], 'open' | 'closed' | 'closed-if-alternative', string][] = [
  [['8441841', '8446166', '8446493', '8446121', '8446613', '8447435', '8447605', '8447975', '8448558', '8452660', '8454341'], 'closed', 'a harbour, a bay-side or a sound-side station (name and position): its water follows the harbour or bay, not the open Atlantic'],
  [['8453201', '8455083', '8459338', '8448725', '8515186'], 'closed-if-alternative', 'a harbour mouth, a harbour of refuge or a bay-side lighthouse station: used only when no open-coast station is within range'],
  [['8515014', '8514961', '8514322', '8514779', '8516221', '8515764'], 'closed', 'on Great South Bay (Long Island), behind the barrier island: bay water, with its own lag and damping'],
  [['8532371', '8532715', '8532786', '8532885', '8533135', '8533345', '8533535', '8533738', '8533862', '8533935', '8534048'], 'closed', 'on the Shark River or Barnegat Bay side of the New Jersey barrier islands (name and position): bay water, not the open Atlantic'],
  [['8532591', '8533615', '8534208', '8652678', 'TEC2837', '8659665', '8665111', '8668837', '8720135', '8721147', '8722207', '8632085', '8638999', '8658715'], 'closed-if-alternative', 'at or inside an inlet or river mouth (an inlet USCG station, an "entrance", or the Chesapeake mouth): damped and lagged against the open coast, so used only when no open-coast station is within range'],
  [['8639214', '8653215', '8653951', '8657813', '8658145', 'TEC3023', '8666767', '8667927', '8669167', '8678688', '8720098', '8720214', '8720398', '8720576', '8721843', '8721994', '8722059', '8722125', '8722274', '8722329', '8722761', '8722784', '8722802', '8722816', '8722854', '8722939', '8722946', '8722971', '8723156'], 'closed', 'on a lake, the Intracoastal Waterway (ICWW), a creek or river, Pamlico Sound, the Indian River or Biscayne Bay lagoon, a causeway or a dock (name and position): not the open coast'],
];

/** US East: the open-coast stations (name says ocean, outer coast, pier, jetty, light, point or beach on the Atlantic shore, and the position is on the ocean side of the barrier island or cape; CO-OPS station home page). Only these count as open on the East Coast: any other East station (id 8xxxxxx or TECnnnn) is treated as closed, because on this coast most stations sit in bays, harbours, sounds, creeks and the Intracoastal Waterway behind barrier islands. */
const EAST_OPEN = ['8531680', '8534720', '8450768', '8451351', '8453999', '8454658', '8448875', '8448942', '8459681', '8532337', '8533071', '8639168', '8639428', '8651370', '8651605', '8652226', 'TEC2789', '8654400', '8657419', '8658163', '8658559', '8659897', '8659182', '8663101', '8665494', 'TEC3047', 'TEC3127', '8667630', '8669625', '8670892', '8677344', '8679997', '8720194', '8720259', '8720291', '8720587', '8721120', 'TEC3693', '8721604', '8721649', '8721727', '8721804', '8722105', '8722212', '8722366', '8722862', '8722899', '8722979', '8723080', '8723170', '8723178'];
for (const id of EAST_OPEN) TIDE_EXPOSURE_OVERRIDES[id] = {exposure: 'open', reason: `reviewed open Atlantic coast: the station's own name and position are on the ocean side (${COOPS(id)})`};
/** Hawaii (2026-11-10, timing re-checked over 7 days: NOAA predicted high/low times 2026-11-10..16, mean offset of each station against its neighbours, nearest same-type extremum within 3 h; the first pass used 2 days. No class changed: the 7-day means agree with the first pass, and only the numbers in the reasons moved) (first written 2026-11-09, corrected after the data-honesty review): the CO-OPS stations the importer can pick in the islands, classed from the station name and position (the CO-OPS station home page) and checked against each other with NOAA's own predicted high/low times for 2026-11-10 (datagetter hilo, MLLW).
 *  The word rule is wrong both ways here ("Bay" is usually an open roadstead) and predicted range cannot separate the stations (all predict about 2-3 ft); TIMING does. The first pass treated the island harbour gauges as sheltered and sent spots to a far "open" station: that was 1-2 h wrong (Maui north shore -> Makena runs 69-81 min after Kahului; Oahu west -> Haleiwa runs 82-143 min before Waianae).
 *  The harbour gauges whose water follows the open coast within minutes of their neighbours are 'open'; only those with no such evidence stay 'closed-if-alternative' (used when nothing open is in range, and then labelled with the reason). Haleiwa keeps its own override above (the open north shore). */
const HAWAII_REVIEWED: Record<string, ['open' | 'closed' | 'closed-if-alternative', string]> = {
  '1612340': ['open', 'Honolulu, the Oahu reference station at the harbour entrance on the south shore: 7-day mean offset 7 min (sd 19) from Pearl Harbor Entrance and 19 min (sd 1) from Waianae, so the leeward gauges agree; Waimanalo and Haleiwa run 76 and 92 min from it, which is why the windward and north-shore spots use their own gauges'],
  '1612376': ['open', 'Waimanalo, the open windward Oahu coast (Waimanalo Bay, no harbour): 7-day mean offset 76 min from Honolulu (sd 32), 34 min from Laie Bay (sd 2) and 8 min from Moku O Loe, range ratio 1.05 to Honolulu: a separate windward regime, so east Oahu keeps it'],
  '1612366': ['open', 'Pearl Harbor Entrance (Bishop Point), the harbour mouth on the south coast: 7-day mean offset 7 min (sd 19) from Honolulu and 12 min (sd 20) from Waianae, range ratio 0.96'],
  '1610367': ['open', 'Nonopapa anchorage on the open west coast of Niihau'],
  '1613226': ['open', 'Kolo wharf on the open south coast of Molokai'],
  '1615395': ['open', 'Hana Bay, an open roadstead on the east Maui coast'],
  '1615202': ['open', 'Makena, the open south-west Maui coast; 7-day mean offset to Lahaina 5 min (sd 2)'],
  '1617277': ['open', 'Mahukona, an open-coast landing on the Kohala coast'],
  '1617846': ['open', 'Kailua Kona pier on the open Kona coast'],
  '1618578': ['open', 'Honuapo pier on the open south Hawaii coast'],
  '1611683': ['open', 'Hanalei Bay pier, an open roadstead exposed to the north swell'],
  '1611401': ['open', 'Waimea (Kauai) pier on the open south-west coast; Nawiliwili is within 12 min'],
  '1611443': ['open', 'Hanamaulu Bay, an open bay on the east Kauai coast; Nawiliwili is within 7 min'],
  'TPT2779': ['open', 'Laie Bay on the open north-east Oahu coast; 7-day mean offset to Waimanalo 34 min (sd 2), a fixed subordinate relation'],
  '1615680': ['open', 'Kahului harbour gauge at the harbour entrance, the north-shore Maui reference: 7-day mean offset Hana 30 min, Hilo -50, Lahaina 70, Makena 75 (sd 6), so the south gauges run over an hour late for the north shore'],
  '1612482': ['open', 'Waianae harbour gauge: 7-day mean offset to Honolulu 19 min (sd 1) and Pearl Harbor Entrance 12 min, while Haleiwa runs 111 min before it, so it is the right gauge for Oahu west'],
  '1611400': ['open', 'Nawiliwili harbour gauge: 7-day mean offset 7 min from Hanamaulu Bay and 12 min from Waimea (Kauai), range ratios 1.01 and 0.85'],
  '1617433': ['open', 'Kawaihae harbour gauge: 7-day mean offset -26 min from Mahukona and -29 min from Kailua Kona (sd 36), range ratio 0.89'],
  'TPT2799': ['open', 'Lahaina roadstead gauge: 7-day mean offset to Makena 5 min (sd 2), range ratio 0.81'],
  '1617760': ['open', 'Hilo harbour gauge: 7-day mean offset 36 min from Honuapo (sd 2) and -23 min from Hana, range ratios 1.01'],
  '1613198': ['closed-if-alternative', 'Kaunakakai harbour gauge behind the reef (7-day mean offset 7 min from Kolo, sd 16; it would qualify as open on the same test as Hilo): kept only when no open station is within range'],
  '1613155': ['open', 'Pukoo Harbor is the only gauge on the east Molokai coast: 7-day mean offset 59 min from Kolo (sd 9) and 52 min from Kaunakakai (sd 14), and 13 min from Lahaina but with sd 43 (no stable relation), so a far gauge is no substitute and the local one is used (a small-boat harbour gauge)'],
  '1614465': ['open', 'Kaumalapau harbour gauge: 7-day mean offset 1 min from Kolo (sd 2), range ratio 0.90; Lahaina runs -46 min (sd 42) from it, so it is the right gauge for the Lanai coast'],
  '1613077': ['closed-if-alternative', 'Kamalo Harbor, a small-boat harbour (7-day mean offset 30 min from Kolo, 23 min from Kaunakakai): kept only when no open station is within range'],
  '1611347': ['closed-if-alternative', 'Port Allen harbour gauge (7-day mean offset 22 min from Waimea and 10 min from Nawiliwili; it would qualify as open on the same test as Hilo): kept only when no open station is within range'],
  '1612480': ['closed', 'Moku O Loe is inside Kaneohe Bay, a reef-fringed lagoon: its tide is the lagoon\'s'],
  'TPT2777': ['closed', 'Waikane is inside Kaneohe Bay, a reef-fringed lagoon: its tide is the lagoon\'s'],
};
for (const [id, [exposure, reason]] of Object.entries(HAWAII_REVIEWED)) TIDE_EXPOSURE_OVERRIDES[id] = {exposure, reason: `${reason} (${COOPS(id)})`};
export const isEastStationId = (id: string) => /^(8\d{6}|TEC\d+)$/.test(id);
for (const [ids, exposure, reason] of EAST_REVIEWED) for (const id of ids) TIDE_EXPOSURE_OVERRIDES[id] = {exposure, reason: `${reason} (${COOPS(id)})`};

/** US East, Gulf and Puerto Rico, batch 3 (2026-11-10): the CO-OPS stations that are one of the three nearest to a spot of the batch and are NOT closed by default, each classed from its name and position and from the 7-day NOAA predicted high/low timing against the nearest gauge already reviewed open (docs/forecast/data/tide-review-batch3.ts; metric in tide-timing.ts; generated by scripts/tide-classes-batch3.py). Rules: an ocean-side gauge that agrees with its open neighbour within 25 min (sd 20, range ratio 0.8-1.25) is open; an inlet, pass, entrance, jetty, harbour or river-mouth gauge that agrees with the open coast within 30 min (45 for an inlet name, range ratio 0.9-1.15, or 0.75+ for an inlet) is closed-if-alternative; the rest of the East and Gulf stations (bays, sounds, creeks, the ICWW, bridges, marinas, up-river) stay CLOSED by the East rule above. The Puerto Rico gauges are compared with San Juan (the tide there is micro-tidal, about 0.3 m). */
const EAST3_REVIEWED: [string, 'open' | 'closed' | 'closed-if-alternative', string][] = [
  ['8417997', 'closed-if-alternative', 'Cushing Island: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 2 min (sd 0) from Portland Head Light (8418031), 3 km, range ratio 1.02; used only when no open-coast gauge is within range'],
  ['8418268', 'closed-if-alternative', 'Fore River: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 3 min (sd 0) from Portland Head Light (8418031), 7 km, range ratio 1.03; used only when no open-coast gauge is within range'],
  ['8418031', 'open', 'Portland Head Light: Portland Head Light, on the exposed Cape Elizabeth coast; no reviewed open gauge within 150 km to compare with; no reviewed open gauge within 150 km to compare with; classed from its name and position'],
  ['8418445', 'closed-if-alternative', 'Pine Point, Scarborough River: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 11 min (sd 7) from Portland Head Light (8418031), 13 km, range ratio 0.99; used only when no open-coast gauge is within range'],
  ['8418557', 'open', 'Old Orchard Beach: Old Orchard Beach, on the open Maine coast: agrees with Portland Head Light within 2 min (sd 3); 7-day mean offset -2 min (sd 3) from Portland Head Light (8418031), 18 km, range ratio 1'],
  ['8418828', 'closed-if-alternative', 'Biddeford, Saco River: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 25 min (sd 8) from Portland Head Light (8418031), 24 km, range ratio 1.04; used only when no open-coast gauge is within range'],
  ['8418606', 'closed-if-alternative', 'Camp Ellis, Saco River Entrance: Camp Ellis is at the Saco River entrance; 7-day mean offset 5 min (sd 6) from Portland Head Light (8418031), 23 km, range ratio 0.99'],
  ['8418772', 'closed-if-alternative', 'Cape Porpoise: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 15 min (sd 0) from Portland Head Light (8418031), 34 km, range ratio 0.98; used only when no open-coast gauge is within range'],
  ['8419317', 'closed-if-alternative', 'Wells, Webhannet River: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 6 min (sd 3) from Portland Head Light (8418031), 44 km, range ratio 1.01; used only when no open-coast gauge is within range'],
  ['8419399', 'open', 'Cape Neddick: Cape Neddick, on the open coast: agrees with Portland Head Light within 7 min (sd 2); 7-day mean offset 7 min (sd 2) from Portland Head Light (8418031), 60 km, range ratio 0.98'],
  ['8419518', 'closed-if-alternative', 'York Harbor: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 10 min (sd 4) from Portland Head Light (8418031), 65 km, range ratio 0.98; used only when no open-coast gauge is within range'],
  ['8419528', 'closed-if-alternative', 'Fort Point, York Harbor: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 5 min (sd 6) from Portland Head Light (8418031), 65 km, range ratio 0.98; used only when no open-coast gauge is within range'],
  ['8423898', 'closed-if-alternative', 'Fort Point: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 9 min (sd 1) from Portland Head Light (8418031), 74 km, range ratio 0.98; used only when no open-coast gauge is within range'],
  ['8419688', 'closed-if-alternative', 'Gerrish Island: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset -1 min (sd 1) from Portland Head Light (8418031), 73 km, range ratio 0.98; used only when no open-coast gauge is within range'],
  ['8424601', 'closed-if-alternative', 'Jaffrey Point: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset -3 min (sd 1) from Portland Head Light (8418031), 75 km, range ratio 0.98; used only when no open-coast gauge is within range'],
  ['8427031', 'closed-if-alternative', 'Gosport Harbor, Isles of Shoals: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 1 min (sd 2) from Portland Head Light (8418031), 79 km, range ratio 0.96; used only when no open-coast gauge is within range'],
  ['8429489', 'closed-if-alternative', 'Hampton Harbor: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 25 min (sd 8) from Portland Head Light (8418031), 95 km, range ratio 0.94; used only when no open-coast gauge is within range'],
  ['8453742', 'closed-if-alternative', 'West Jamestown, Dutch Island Harbor: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset -3 min (sd 9) from Beavertail Point (8453999), 5 km, range ratio 1.14; used only when no open-coast gauge is within range'],
  ['8448566', 'closed-if-alternative', 'Great Point: Great Point is the tip where Nantucket Sound meets the ocean (range ratio 1.33 to Eel Point); 7-day mean offset 13 min (sd 9) from Eel Point (8449062), 17 km, range ratio 1.33'],
  ['8448683', 'closed-if-alternative', 'Wasque Point, Chappaquiddick Island: Wasque Point is a shoal tip with a range ratio 0.37 to the Martha\'s Vineyard buoy; 7-day mean offset 160 min (sd 10) from Martha\'s Vineyard GPS Buoy (8448875), 12 km, range ratio 0.37'],
  ['8448733', 'closed-if-alternative', 'Gay Head: Gay Head sits at a fixed +43 min from Squibnocket Point (sd 4), a different regime from the south shore; 7-day mean offset 43 min (sd 4) from Squibnocket Point (8448942), 7 km, range ratio 1'],
  ['8458694', 'closed-if-alternative', 'Watch Hill Point: Watch Hill Point is at the Block Island Sound entrance, 44 min behind Newport; 7-day mean offset 44 min (sd 17) from Southwest Point, Block Island (8459681), 26 km, range ratio 0.96'],
  ['8449062', 'closed-if-alternative', 'Eel Point: Eel Point is on the Nantucket Sound side (range ratio 0.75 to Great Point); 7-day mean offset -12 min (sd 9) from Great Point (8448566), 17 km, range ratio 0.75'],
  ['8512354', 'open', 'Shinnecock Inlet (ocean): the ocean-side gauge at Shinnecock Inlet: 7-day mean offset -1 min (sd 7, range ratio 1.08) from Moriches Inlet (8513398), 23 km east, the two ocean-side gauges of the Long Island south shore agreeing'],
  ['8513398', 'open', 'Moriches Inlet: Moriches Inlet, on the ocean side: 7-day mean offset 1 min (sd 7, range ratio 0.92) from the Shinnecock Inlet ocean gauge (8512354), 23 km west'],
  ['8516881', 'closed-if-alternative', 'East Rockaway Inlet, Atlantic Beach: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset -11 min (sd 7) from Sandy Hook, Fort Hancock (8531680), 27 km, range ratio 0.98; used only when no open-coast gauge is within range'],
  ['8516385', 'closed-if-alternative', 'Jones Inlet (Point Lookout): an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset -23 min (sd 2) from Sandy Hook, Fort Hancock (8531680), 39 km, range ratio 0.77; used only when no open-coast gauge is within range'],
  ['8517394', 'closed-if-alternative', 'Barren Island, Rockaway Inlet: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset -3 min (sd 1) from Sandy Hook, Fort Hancock (8531680), 16 km, range ratio 1.07; used only when no open-coast gauge is within range'],
  ['8531991', 'open', 'Long Branch (fishing pier): a gauge on the ocean side of the coast (its name and position); 7-day mean offset 9 min (sd 0) from Belmar, Atlantic Ocean (8532337), 13 km, range ratio 0.98'],
  ['8532322', 'closed-if-alternative', 'Shark River Hills: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 29 min (sd 7) from Belmar, Atlantic Ocean (8532337), 3 km, range ratio 0.99; used only when no open-coast gauge is within range'],
  ['8534770', 'open', 'Ventnor City, ocean pier: a gauge on the ocean side of the coast (its name and position); 7-day mean offset 0 min (sd 2) from Atlantic City (Ocean) (8534720), 6 km, range ratio 1.02'],
  ['8656937', 'open', 'Cape Lookout (ocean): a gauge on the ocean side of the coast (its name and position); 7-day mean offset -23 min (sd 2) from Ocean City Beach (fishing pier) (8657419), 90 km, range ratio 0.8'],
  ['8660266', 'open', 'Hog Inlet Pier: a gauge on the ocean side of the coast (its name and position); 7-day mean offset -1 min (sd 3) from Sunset Beach Pier (8659897), 10 km, range ratio 1.05'],
  ['8661070', 'open', 'Springmaid Pier, Myrtle beach: a gauge on the ocean side of the coast (its name and position); 7-day mean offset -4 min (sd 5) from Garden City Pier (ocean) (8661437), 11 km, range ratio 1'],
  ['8661437', 'open', 'Garden City Pier (ocean): a gauge on the ocean side of the coast (its name and position); 7-day mean offset 4 min (sd 5) from Springmaid Pier, Myrtle beach (8661070), 11 km, range ratio 1'],
  ['8661947', 'closed-if-alternative', 'Midway Inlet North, Pawleys Island: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 27 min (sd 14) from Pawleys Island Pier (ocean) (8662006), 2 km, range ratio 0.85; used only when no open-coast gauge is within range'],
  ['8662006', 'open', 'Pawleys Island Pier (ocean): a gauge on the ocean side of the coast (its name and position); 7-day mean offset -1 min (sd 7) from Garden City Pier (ocean) (8661437), 19 km, range ratio 0.99'],
  ['TEC2929', 'closed-if-alternative', 'Winyah Bay Entrance (South Jetty): an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset -3 min (sd 4) from Cape Romain (8663101), 26 km, range ratio 0.97; used only when no open-coast gauge is within range'],
  ['TEC2991', 'closed-if-alternative', 'North Santee River Inlet: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 17 min (sd 4) from Cape Romain (8663101), 15 km, range ratio 0.96; used only when no open-coast gauge is within range'],
  ['8670870', 'closed-if-alternative', 'Fort Pulaski, Savannah River Entrance: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 11 min (sd 1) from Tybee Light (8670892), 5 km, range ratio 1.01; used only when no open-coast gauge is within range'],
  ['TEC3399', 'closed-if-alternative', 'Tybee Creek entrance: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 9 min (sd 8) from Tybee Light (8670892), 5 km, range ratio 1; used only when no open-coast gauge is within range'],
  ['8671314', 'closed-if-alternative', 'Halfmoon Reef, Halfmoon River: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 20 min (sd 7) from Tybee Light (8670892), 11 km, range ratio 0.93; used only when no open-coast gauge is within range'],
  ['TEC3413', 'closed-if-alternative', 'Egg Islands: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 18 min (sd 4) from Tybee Light (8670892), 31 km, range ratio 1.05; used only when no open-coast gauge is within range'],
  ['8672455', 'closed-if-alternative', 'Bradley Point, Bradley River: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 20 min (sd 5) from Tybee Light (8670892), 29 km, range ratio 1.04; used only when no open-coast gauge is within range'],
  ['8673171', 'closed-if-alternative', 'Bear River Entrance: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 20 min (sd 10) from Tybee Light (8670892), 43 km, range ratio 1; used only when no open-coast gauge is within range'],
  ['8674301', 'closed-if-alternative', 'South Newport River (Daymark 135): an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 3 min (sd 10) from St. Simons Light (8677344), 53 km, range ratio 1.04; used only when no open-coast gauge is within range'],
  ['TEC3463', 'closed-if-alternative', 'Blackbeard Island: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 8 min (sd 5) from St. Simons Light (8677344), 48 km, range ratio 1.05; used only when no open-coast gauge is within range'],
  ['8675622', 'closed-if-alternative', 'Old Tower, Sapelo Island: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 3 min (sd 4) from St. Simons Light (8677344), 31 km, range ratio 1.04; used only when no open-coast gauge is within range'],
  ['8675761', 'closed-if-alternative', 'Rockdedundy River (Daymark 185): an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 10 min (sd 12) from St. Simons Light (8677344), 28 km, range ratio 1.05; used only when no open-coast gauge is within range'],
  ['TEC3491', 'closed-if-alternative', 'Wolf Island, south end: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 24 min (sd 11) from St. Simons Light (8677344), 24 km, range ratio 0.99; used only when no open-coast gauge is within range'],
  ['TEC3495', 'closed-if-alternative', 'Hampton River entrance: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset -2 min (sd 6) from St. Simons Light (8677344), 12 km, range ratio 1.01; used only when no open-coast gauge is within range'],
  ['8735180', 'closed-if-alternative', 'DAUPHIN ISLAND: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 15 min (sd 15) from Mobile Point (Fort Morgan) (8734635), 6 km, range ratio None; Gulf tides are mixed or diurnal, so highs and lows pair unreliably and the timing is only a rough check; used only when no open-coast gauge is within range'],
  ['8731269', 'open', 'Gulf State Park Pier: a pier on the Gulf beach at Gulf Shores; the Gulf tide is mostly diurnal so its timing against Mobile Point (132 min, sd 18, a bay-mouth gauge) is not a test: classed by name and position; 7-day mean offset -132 min (sd 18) from Mobile Point (Fort Morgan) (8734635), 34 km, range ratio None; Gulf tides are mixed or diurnal, so highs and lows pair unreliably and the timing is only a rough check'],
  ['8734635', 'closed-if-alternative', 'Mobile Point (Fort Morgan): Mobile Point (Fort Morgan) is the Mobile Bay entrance; 7-day mean offset 132 min (sd 18) from Gulf State Park Pier (8731269), 34 km, range ratio None; Gulf tides are mixed or diurnal, so highs and lows pair unreliably and the timing is only a rough check'],
  ['8760172', 'open', 'Chandeleur Light: a gauge on the ocean side of the coast (its name and position); 7-day mean offset -3 min (sd 14) from Mobile Point (Fort Morgan) (8734635), 84 km, range ratio None; Gulf tides are mixed or diurnal, so highs and lows pair unreliably and the timing is only a rough check'],
  ['8773767', 'closed-if-alternative', 'Matagorda Bay Entrance Channel: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 15 min (sd 6) from Port Aransas (H. Caldwell Pier) (8775270), 97 km, range ratio None; Gulf tides are mixed or diurnal, so highs and lows pair unreliably and the timing is only a rough check; used only when no open-coast gauge is within range'],
  ['8726601', 'open', 'Indian Rocks Beach (Coastal): a coastal gauge on the Gulf side of the Pinellas barrier island; the Gulf tide is mixed so its highs and lows pair unreliably (-96 min, sd 34 against a Tampa Bay mouth pier): classed by name and position; 7-day mean offset -96 min (sd 34) from Anna Maria Key, city pier (8726282), 40 km, range ratio 1; Gulf tides are mixed or diurnal, so highs and lows pair unreliably and the timing is only a rough check'],
  ['8775241', 'closed-if-alternative', 'Aransas, Aransas Pass: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 21 min (sd 44) from Port Aransas (H. Caldwell Pier) (8775270), 2 km, range ratio None; Gulf tides are mixed or diurnal, so highs and lows pair unreliably and the timing is only a rough check; used only when no open-coast gauge is within range'],
  ['8775270', 'open', 'Port Aransas (H. Caldwell Pier): a gauge on the ocean side of the coast (its name and position); 7-day mean offset 4 min (sd 5) from Corpus Christi, Bob Hall Pier (8775870), 32 km, range ratio None; Gulf tides are mixed or diurnal, so highs and lows pair unreliably and the timing is only a rough check'],
  ['TEC4271', 'closed-if-alternative', 'Pass-a-Grille Beach: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 43 min (sd 6) from Anna Maria Key, city pier (8726282), 17 km, range ratio 0.88; used only when no open-coast gauge is within range'],
  ['8775870', 'open', 'Corpus Christi, Bob Hall Pier: a gauge on the ocean side of the coast (its name and position); 7-day mean offset -4 min (sd 5) from Port Aransas (H. Caldwell Pier) (8775270), 32 km, range ratio None; Gulf tides are mixed or diurnal, so highs and lows pair unreliably and the timing is only a rough check'],
  ['8726282', 'closed-if-alternative', 'Anna Maria Key, city pier: Anna Maria city pier is on the Tampa Bay mouth side, not the open Gulf beach; 7-day mean offset 96 min (sd 34) from Indian Rocks Beach (Coastal) (8726601), 40 km, range ratio 1.01; Gulf tides are mixed or diurnal, so highs and lows pair unreliably and the timing is only a rough check'],
  ['8726034', 'closed-if-alternative', 'Siesta Key, Big Sarasota Pass: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset -9 min (sd 14) from Anna Maria Key, city pier (8726282), 32 km, range ratio 0.92; Gulf tides are mixed or diurnal, so highs and lows pair unreliably and the timing is only a rough check; used only when no open-coast gauge is within range'],
  ['8725899', 'closed-if-alternative', 'Nokomis, Venice Inlet: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 7 min (sd 10) from Anna Maria Key, city pier (8726282), 52 km, range ratio 0.84; Gulf tides are mixed or diurnal, so highs and lows pair unreliably and the timing is only a rough check; used only when no open-coast gauge is within range'],
  ['8722495', 'closed-if-alternative', 'Jupiter Inlet, south jetty: an inlet, pass, entrance, harbour or river-mouth gauge, or its name is open-coast but its timing is off; 7-day mean offset 37 min (sd 11) from Seminole Shores (8722366), 28 km, range ratio 0.77; used only when no open-coast gauge is within range'],
  ['8722670', 'open', 'Lake Worth Pier (ocean): a gauge on the ocean side of the coast (its name and position); 7-day mean offset -11 min (sd 6) from Hillsboro Inlet (ocean) (8722862), 40 km, range ratio 1.09'],
  ['9754986', 'open', 'Boca de Cangrejos, on the open north-east coast: 7-day mean offset 12 min (sd 10) from San Juan, range ratio 0.86'],
  ['9753766', 'open', 'Luquillo, on the open north-east coast: 7-day mean offset -35 min (sd 22) from San Juan, range ratio 0.96 (a micro-tidal coast, range about 0.3 m: the gauges agree within about 45 min)'],
  ['9757809', 'open', 'Arecibo, on the open north coast: -34 min (sd 20) from San Juan, range ratio 1.1'],
  ['9759412', 'open', 'Aguadilla, on the open north-west coast: -45 min (sd 19) from San Juan, range ratio 0.88 (the tide progresses west along the coast)'],
  ['9759394', 'open', 'Mayaguez, on the open west coast: -18 min (sd 21) from San Juan, range ratio 0.79'],
  ['9755371', 'closed-if-alternative', 'San Juan is inside San Juan Bay (La Puntilla): used only when no open-coast gauge is within range'],
  ['9759421', 'closed', 'Punta Guanajibo is inside Mayaguez Bay (range ratio 0.7 to San Juan)'],
  ['9756567', 'closed-if-alternative', 'Boca del Cibuco is a river mouth on the north coast: -7 min (sd 14) from San Juan, range ratio 1.11; used only when no open-coast gauge is within range'],
  ['9754487', 'closed-if-alternative', 'Puerto Maunabo is a small harbour on the south-east coast: no stable pairing with San Juan (sd 104 min over 11 pairs); used only when no open-coast gauge is within range'],
  ['9754228', 'closed-if-alternative', 'Yabucoa Harbor is a harbour on the south-east coast: no stable pairing with San Juan (sd 105 min); used only when no open-coast gauge is within range'],
  ['TEC4737', 'closed-if-alternative', 'Arroyo is a small harbour on the south coast: no stable pairing with San Juan (sd 119 min); used only when no open-coast gauge is within range'],
];
for (const [id, exposure, reason] of EAST3_REVIEWED) TIDE_EXPOSURE_OVERRIDES[id] = {exposure, reason: `${reason} (${COOPS(id)})`};
/** What a fallback station is, for the note on the tide card: a harbour gauge in Hawaii, an inlet or bay-side station elsewhere. */
/** The fallback note of a closed-if-alternative station used because nothing open is in range: its LABEL and, where the 7-day timing says how it differs, its DETAIL (the sentence after the label). Default detail: "times and range differ from the open beach". */
const FALLBACK_KINDS: Record<string, {label: string; detail: string}> = {
  '9443644': {label: 'Strait station', detail: 'on the Strait of Juan de Fuca, about 1 h behind the outer coast with a smaller range (7-day timing: +64 min, range ratio 0.76); no open-coast station is within 40 km.'},
  '9447934': {label: 'Admiralty Inlet station', detail: 'at the entrance of Puget Sound, hours behind the outer coast (7-day timing: +162 min on the extrema that pair); no open-coast station is within 40 km.'},
};
/** Harbour gauges (a port basin, not an inlet): Hawaii's reviewed harbours and the Puerto Rico ports. */
const HARBOUR_GAUGES = new Set(['9755371', '9754487', '9754228', 'TEC4737']);
export const fallbackLabel = (id?: string): string => (id && FALLBACK_KINDS[id]?.label) || (id && (HAWAII_REVIEWED[id] || HARBOUR_GAUGES.has(id)) ? 'Harbour gauge' : 'Inlet or bay-side station');
/** What the fallback note says about THIS station: a reviewed kind (Strait, Admiralty Inlet) says what it is; otherwise its own 7-day timing against the open coast where the review recorded one ("agrees within 8 min", "runs 37 min behind"), never a blanket "differs". */
export const fallbackDetail = (id?: string): string | undefined => {
  if (id && FALLBACK_KINDS[id]) return FALLBACK_KINDS[id].detail;

  const why = id ? TIDE_EXPOSURE_OVERRIDES[id]?.reason : undefined, m = why ? /mean offset (-?\d+) min \(sd (\d+)\)/.exec(why) : null; if (!m) return undefined;
  const off = Number(m[1]), a = Math.abs(off);
  return a <= 15 ? `its 7-day timing agrees with the open coast within ${a} min, but it sits inside an inlet, creek or harbour, so times and range may differ from the open beach (no open-coast station is within 40 km).` : `its 7-day timing runs ${a} min ${off > 0 ? 'behind' : 'ahead of'} the open coast, so times and range may differ from the open beach (no open-coast station is within 40 km).`;
};
/** US West, California (2026-11-10, the 236-spot California batch): every station the importer picked whose name does not say open coast or enclosed, reviewed by TIMING. NOAA predicted high/low times 2026-11-10..16 (datagetter hilo, MLLW,
 *  docs/forecast/data/tide-timing.ts): the mean offset of each station against a neighbour on the exposed coast (nearest same-type extremum within 3 h), its standard deviation and the ratio of daily ranges. Along the California coast the tide
 *  progresses (Gaviota runs 29 min after Santa Monica, Monterey 56 min after Gaviota, the north coast another 40-60 min after Ocean Beach), so a station is judged against its NEIGHBOURS, not against one far reference: a harbour, bay or
 *  slough gauge shows up as a lag of 20-40 min over the coast on either side of it, or a damped range. Most pier, cove and harbour-mouth gauges follow their neighbours within 25 min and a range ratio of 0.9-1.05, so they are 'open';
 *  three do not (Tomales Bay entrance, Samoa inside Humboldt Bay, Elkhorn Yacht Club in the slough). San Francisco is left to the existing Golden Gate rule (SF_LOCAL_KM). */
const CA_REVIEWED: Record<string, ['open' | 'closed' | 'closed-if-alternative', string]> = {
  '9410120': ['open', 'Imperial Beach pier on the open coast: 7-day mean offset -2 min (sd 7) from La Jolla, range ratio 0.97'],
  '9410166': ['open', 'San Diego Quarantine Station is inside San Diego Bay by position (Point Loma, bay side of the entrance), but its times and range match the open coast: 7-day mean offset -2 min (sd 9) from La Jolla, range ratio 1.00 (the bay is wide open to the sea); Point Loma and Imperial Beach are the ocean-side neighbours'],
  '9410170': ['open', 'San Diego Broadway is inside San Diego Bay by position, but its times and range match the open coast: 7-day mean offset -1 min (sd 7) from La Jolla, range ratio 1.04'],
  'TWC0405': ['open', 'Point Loma on the open coast: 7-day mean offset -6 min (sd 10) from La Jolla, range ratio 0.96'],
  '9410650': ['open', 'Cabrillo Beach at the mouth of the Los Angeles harbour: 7-day mean offset 8 min (sd 5) from La Jolla and -2 min from Santa Monica, range ratio 1.02'],
  '9410660': ['open', 'Los Angeles Outer Harbor, outside the breakwater: 7-day mean offset -2 min (sd 5) from Santa Monica pier, range ratio 1.01'],
  '9410678': ['open', 'Long Beach Fire Boat Pier is inside the Los Angeles / Long Beach harbour by position, but its times and range match the open coast: 7-day mean offset -2 min (sd 5) from Santa Monica pier, range ratio 1.00'],
  '9410738': ['open', 'King Harbor (Redondo Beach) breakwater gauge on Santa Monica Bay: 7-day mean offset 16 min (sd 5) from La Jolla against 11 min for Santa Monica pier, range ratio 0.97'],
  '9410777': ['open', 'El Segundo oil pier on Santa Monica Bay: 7-day mean offset 11 min (sd 5) from Santa Monica pier, range ratio 0.97'],
  '9410583': ['open', 'Balboa pier on the open Orange County coast: 7-day mean offset -7 min (sd 8) from Santa Monica pier, range ratio 0.97'],
  '9410580': ['open', 'Newport Bay entrance (Corona del Mar jetty): 7-day mean offset -5 min (sd 5) from Santa Monica pier, range ratio 0.99'],
  'TWC0419': ['open', 'San Clemente pier on the open coast: 7-day mean offset -25 min (sd 11) from Santa Monica pier, range ratio 0.95 (a subordinate station)'],
  '9411065': ['open', 'Port Hueneme (the harbour\'s outer pier): 7-day mean offset 9 min (sd 6) from Santa Monica pier, range ratio 0.99'],
  '9411189': ['open', 'Ventura pier on the open coast: 7-day mean offset 10 min (sd 7) from Santa Monica pier, range ratio 0.99'],
  '9411270': ['open', 'Rincon Island causeway on the open Santa Barbara channel coast: 7-day mean offset 21 min (sd 8) from Santa Monica pier, range ratio 1.01'],
  '9411340': ['open', 'Santa Barbara (Stearns Wharf): 7-day mean offset 23 min (sd 7) from Santa Monica pier, range ratio 1.00'],
  '9411399': ['open', 'Gaviota pier on the open coast: 7-day mean offset 29 min (sd 12) from Santa Monica pier, range ratio 0.99'],
  'TWC0445': ['open', 'Mugu Lagoon ocean pier (on the sea side of Point Mugu): 7-day mean offset 5 min (sd 7) from Santa Monica pier, range ratio 0.97'],
  '9412110': ['open', 'Port San Luis (Harford pier, San Luis Obispo Bay): 7-day mean offset 22 min (sd 10) from Gaviota and 8 min from San Simeon, range ratio 1.02'],
  '9412553': ['open', 'San Simeon pier on the open coast: 7-day mean offset 30 min (sd 10) from Gaviota, range ratio 1.01'],
  '9412802': ['open', 'Mansfield Cone, an open-coast gauge on the Big Sur coast: 7-day mean offset 40 min (sd 11) from Gaviota, range ratio 1.01'],
  '9413450': ['open', 'Monterey (Coast Guard pier), the reference station of the wide Monterey Bay: 7-day mean offset 56 min (sd 16) from Gaviota, 9 min from Santa Cruz, range ratio 1.03'],
  '9413745': ['open', 'Santa Cruz wharf on Monterey Bay: 7-day mean offset 47 min (sd 16) from Gaviota, range ratio 1.00'],
  '9413375': ['open', 'Carmel Cove on Carmel Bay (an open bay): 7-day mean offset 52 min (sd 16) from Gaviota, range ratio 1.00'],
  '9413626': ['closed-if-alternative', 'Elkhorn Yacht Club is a marina in Elkhorn Slough (Moss Landing): its predictions are a subordinate set of Monterey\'s (7-day offset 57 min from Gaviota, 1 min from Monterey), which hides the slough\'s real lag and damping, so a Monterey Bay gauge is preferred when one is within range'],
  '9414275': ['open', 'Ocean Beach, outer coast: the open-coast reference for the San Francisco coast'],
  '9414391': ['closed', 'South San Francisco is inside San Francisco Bay (the bay side of the peninsula, east of Pacifica): 7-day mean offset 89 min (sd 2) from Ocean Beach, range ratio 1.21'],
  '9413616': ['open', 'Moss Landing ocean pier on Monterey Bay: 7-day mean offset -1 min (sd 0) from Monterey, range ratio 0.95'],
  '9418851': ['closed', 'Arcata Wharf is at the head of Arcata Bay, the inner arm of Humboldt Bay: 7-day mean offset 62 min (sd 3) from Trinidad, range ratio 1.06 (North Spit at the entrance is 11 min, Samoa 21, Eureka 30)'],
  '9418801': ['closed-if-alternative', 'Eureka is inside Humboldt Bay: 7-day mean offset 30 min (sd 9) from Trinidad, range ratio 1.12 (North Spit at the entrance is 11 min): bay water with a modest lag, used only when no open-coast gauge is within range'],
  '9418778': ['closed-if-alternative', 'Bucksport is on the east shore of Humboldt Bay: 7-day mean offset 27 min (sd 4) from Trinidad, range ratio 1.07 (North Spit at the entrance is 11 min): bay water with a modest lag, used only when no open-coast gauge is within range'],
  '9414392': ['closed', 'Oyster Point Marina is inside San Francisco Bay (a marina on the bay shore south of Brisbane): 7-day mean offset 93 min (sd 2) from Ocean Beach, range ratio 1.21'],
  '9414402': ['closed', 'Point San Bruno is inside San Francisco Bay (the west shore of the bay, east of Pacifica and Daly City): 7-day mean offset 96 min (sd 9) from Ocean Beach, range ratio 1.17'],
  '9414906': ['closed-if-alternative', 'Point Bonita (Bonita Cove) sits in the mouth of the Golden Gate: 7-day mean offset 28 min (sd 3) from Ocean Beach, between the outer coast (0) and the Golden Gate gauge (42), range ratio 1.04. It is neither the open coast nor the bay, so the Bay Area spots keep the Ocean Beach and San Francisco references they had (their hourly series), and Point Bonita is used only when no open-coast gauge is in range'],
  '9414413': ['closed', 'Seaplane Harbor is inside San Francisco Bay, on the bay side of the peninsula (east of Pacifica and Pillar Point): 7-day mean offset 95 min (sd 3) from Ocean Beach, range ratio 1.24'],
  '9414523': ['closed', 'Redwood City (Wharf 5) is at the south end of San Francisco Bay: 7-day mean offset 96 min (sd 17) from Ocean Beach, range ratio 1.33'],
  '9415020': ['open', 'Point Reyes (Drakes Bay) on the open coast: 7-day mean offset 2 min (sd 14) from Ocean Beach, range ratio 0.96'],
  '9415469': ['closed-if-alternative', 'Tomales Bay entrance: 7-day mean offset 46 min (sd 9) from Ocean Beach and 44 min from Point Reyes, 31 min from Bodega, range ratio 0.85 (the lowest on the coast): the water inside the bay lags and is damped, so the open-coast gauges are preferred when one is within range'],
  '9415625': ['open', 'Bodega Harbor entrance: 7-day mean offset 15 min (sd 4) from Ocean Beach, range ratio 0.93'],
  '9416024': ['open', 'Fort Ross cove on the open Sonoma coast: 7-day mean offset 2 min (sd 3) from Ocean Beach, range ratio 0.94'],
  '9416409': ['open', 'Green Cove on the open Sonoma/Mendocino coast: 7-day mean offset 7 min (sd 20) from Ocean Beach, range ratio 0.89 (a subordinate station)'],
  '9416841': ['open', 'Arena Cove pier on the open Mendocino coast: 7-day mean offset 14 min (sd 12) from Ocean Beach, range ratio 0.98'],
  'TWC0771': ['open', 'Point Arena on the open coast: 7-day mean offset 16 min (sd 12) from Ocean Beach, range ratio 0.97'],
  '9417426': ['open', 'Noyo Harbor (Fort Bragg), the harbour mouth: 7-day mean offset 14 min (sd 13) from Ocean Beach, the same as Arena Cove (14 min) and between Point Arena (16) and Westport (21), range ratio 1.03'],
  '9417624': ['open', 'Westport on the open Mendocino coast: 7-day mean offset 21 min (sd 15) from Ocean Beach, range ratio 0.97'],
  '9418024': ['open', 'Shelter Cove on the open Lost Coast: 7-day mean offset 23 min (sd 15) from Ocean Beach, range ratio 1.03'],
  '9418767': ['open', 'Humboldt Bay (North Spit), at the bay entrance on the ocean side: 7-day mean offset 51 min (sd 14) from Ocean Beach, within 10 min of Trinidad (41) and Crescent City (43), range ratio 1.18 (the north coast\'s ranges are larger)'],
  '9418817': ['closed-if-alternative', 'Samoa is on the bay side of Humboldt Bay\'s North Spit: 7-day mean offset 62 min (sd 14) from Ocean Beach, 21 min later than Trinidad (41) and 19 min later than Crescent City (43) on the open coast either side, range ratio 1.21: bay water, used only when no open-coast gauge is within range'],
  '9419059': ['open', 'Trinidad Harbor (the pier in Trinidad Bay, an open roadstead): 7-day mean offset 41 min (sd 13) from Ocean Beach, range ratio 1.12'],
  '9419750': ['open', 'Crescent City, the north coast reference station: 7-day mean offset 43 min (sd 13) from Ocean Beach, within 5 min of Trinidad and Brookings, range ratio 1.15'],
  '9430104': ['open', 'Brookings (Chetco Cove): 7-day mean offset 46 min (sd 13) from Ocean Beach, 3 min from Crescent City, range ratio 1.15'],
};
for (const [id, [exposure, reason]] of Object.entries(CA_REVIEWED)) TIDE_EXPOSURE_OVERRIDES[id] = {exposure, reason: `${reason} (${COOPS(id)})`};
/** San Francisco Bay (2026-11-10): every CO-OPS tide-prediction station in the box 37.4-38.3 N, 122.65-121.7 W (the CO-OPS station list) that is not the Golden Gate gauge, Ocean Beach, Pillar Point or Point Bonita is on the bay or its rivers and sloughs, east of the
 *  Golden Gate or on the bay shore: bay water. The ones checked by 7-day timing run 89-96 min after Ocean Beach with range ratios 1.17-1.33 (Seaplane Harbor, South San Francisco, Oyster Point Marina, Point San Bruno, Redwood City). Closed, so no Pacific spot takes a bay gauge. */
const SF_BAY_CLOSED = ['9414305', '9414317', '9414334', '9414358', '9414449', '9414458', '9414483', '9414486', '9414501', '9414505', '9414506', '9414507', '9414509', '9414511', '9414513', '9414519', '9414525', '9414539', '9414549', '9414551', '9414561', '9414575', '9414609', '9414621', '9414632', '9414637', '9414688', '9414711', '9414724', '9414746', '9414750', '9414763', '9414764', '9414765', '9414767', '9414777', '9414779', '9414782', '9414792', '9414806', '9414811', '9414816', '9414817', '9414818', '9414819', '9414837', '9414843', '9414849', '9414863', '9414873', '9414874', '9414881', '9415009', '9415052', '9415056', '9415064', '9415074', '9415096', '9415102', '9415111', '9415112', '9415142', '9415143', '9415144', '9415165', '9415176', '9415205', '9415218', '9415227', '9415236', '9415252', '9415265', '9415266', '9415307', '9415338', '9415344', '9415379', '9415402', '9415415', '9415446', '9415447', '9415498', '9415584', '9415623', 'TWC0547', 'TWC0649'];
for (const id of SF_BAY_CLOSED) TIDE_EXPOSURE_OVERRIDES[id] = {exposure: 'closed', reason: `inside San Francisco Bay or on its rivers and sloughs (position in the CO-OPS station list, 2026-11-10; the five stations checked by 7-day timing run 89-96 min after Ocean Beach) (${COOPS(id)})`};
export function tideStationExposure(name: string, id?: string): {exposure: TideExposure | 'closed-if-alternative'; why: string} {
  const o = id ? TIDE_EXPOSURE_OVERRIDES[id] : undefined; if (o) return {exposure: o.exposure, why: `reviewed: ${o.reason}`};
  if (/\binside\b/i.test(name)) return {exposure: 'closed', why: 'its name says "inside"'};
  if (id && isEastStationId(id)) return {exposure: 'closed', why: 'US East: not on the reviewed open-coast list (a bay, harbour, sound, creek, Intracoastal Waterway, inlet mouth or an unchecked station)'};
  const so = STRONG_OPEN.exec(name); if (so) return {exposure: 'open', why: `name says open coast or an entrance ("${so[1].toLowerCase()}")`};
  const c = CLOSED_WORDS.exec(name); if (c) return {exposure: 'closed', why: `name says "${c[1].toLowerCase()}" (up a river, slough, lagoon or basin)`};
  if (ESTUARY_BAY.test(name) && !OPEN_BAYS.test(name)) return {exposure: 'closed', why: 'name says "bay" (an estuary or harbour bay, not the open coast)'};
  const wo = WEAK_OPEN.exec(name); if (wo) return {exposure: 'open', why: `name says "${wo[1].toLowerCase()}"`};
  return {exposure: 'unknown', why: 'nothing in its name says open coast or enclosed (a town or harbour name)'};
}
/** The station a spot uses: the nearest one within `maxKm` that is not closed (a 'closed-if-alternative' one only when no open station is in range). `stations` are {id?, name, lat, lon, ...}. */
export function pickTideStation<T extends {id?: string; name: string; lat: number; lon: number}>(spotLat: number, spotLon: number, stations: T[], maxKm = 40): {station: T; distanceKm: number; exposure: TideExposure; fallback?: boolean; fallbackLabel?: string; fallbackDetail?: string} | null {
  const all = stations.map((s) => ({station: s, distanceKm: Math.round(km(spotLat, spotLon, s.lat, s.lon) * 10) / 10, exposure: tideStationExposure(s.name, s.id).exposure})).filter((x) => x.distanceKm <= maxKm).sort((a, b) => a.distanceKm - b.distanceKm);
  const anyOpen = all.some((x) => x.exposure === 'open');
  const ok = all.filter((x) => x.exposure === 'open' || x.exposure === 'unknown' || (x.exposure === 'closed-if-alternative' && !anyOpen)).map((x) => ({...x, fallback: x.exposure === 'closed-if-alternative', ...(x.exposure === 'closed-if-alternative' ? {fallbackLabel: fallbackLabel(x.station.id), ...(fallbackDetail(x.station.id) ? {fallbackDetail: fallbackDetail(x.station.id)} : {})} : {}), exposure: (x.exposure === 'closed-if-alternative' ? 'unknown' : x.exposure) as TideExposure}));
  return ok[0] ?? null;
}
/** The registry station a SPOT uses for its "next tide": the nearest that is not closed (see tideStationExposure), within 40 km. Same shape as nearestTideStations()[0]. */
export const tideStationForSpot = (lat: number, lon: number): {station: TideStation; distanceKm: number} | null => pickTideStation(lat, lon, tideStations);
export const tideStation = (id: string) => tideStations.find((s) => s.id === id) ?? null;

/** Reviewed spot → station assignments for the NEW stations. Empty until the owner approves one; the San Francisco rule (`nearSanFrancisco` in data/coast.ts) is unchanged and not listed here. */
export interface TideAssignment {spotId: string; stationId: string; status: 'owner-reviewed'; reviewedBy: string; reviewedOn: string; note: string}
export const tideAssignments: TideAssignment[] = [];

const km = (aLat: number, aLon: number, bLat: number, bLon: number) => { const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLon = (bLon - aLon) * r, h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLon / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
/** The nearest stations of a SPOT: none for a spot outside US coverage (CO-OPS is a US source; nothing is borrowed across a border). */
/** The station a spot uses: the open-coast pick (tideStationForSpot) for a spot with US data, none elsewhere (coverage.ts). */
/** A spot with no genuinely local station (none within this many km) near San Francisco uses the SF regional reference for its "next tide" too, because its hourly tide series IS that station (pipeline.ts attaches it within the Bay radius):
 *  one station per spot on every surface (Bolinas and Stinson, whose lagoon station was dropped by the open-coast rule). The SF station must itself be within 40 km and not much farther (10 km) than the pick it replaces (Pescadero, 61 km from SF, keeps Ano Nuevo). Spots with a local station keep it (Ocean Beach, Linda Mar, Montara...: their hourly series stays labelled the regional reference). */
export const SF_LOCAL_KM = 15;
export function tideStationFor(spot: {id: string; country?: string; latitude: number; longitude: number}): {station: TideStation; distanceKm: number; /** an inlet-mouth or bay-side station used only because no open-coast station is in range: its times and range differ from the open beach */ fallback?: boolean; fallbackLabel?: string; fallbackDetail?: string} | null {
  if (!hasUsData(spot)) return null;
  const pick = tideStationForSpot(spot.latitude, spot.longitude);
  if (nearSanFrancisco(spot.latitude, spot.longitude) && (!pick || pick.distanceKm > SF_LOCAL_KM)) { const sf = tideStations.find((s) => s.id === SF_STATION); if (sf) { const d = Math.round(km(spot.latitude, spot.longitude, sf.lat, sf.lon) * 10) / 10; if (d <= 40 && (!pick || d <= pick.distanceKm + 10)) return {station: sf, distanceKm: d}; } }
  return pick;
}
export const nearestTideStationsFor = (spot: {id: string; country?: string; latitude: number; longitude: number}) => (hasUsData(spot) ? nearestTideStations(spot.latitude, spot.longitude) : []);
/** Nearest stations by distance, for the owner's review list only (never an assignment). */
export const nearestTideStations = (lat: number, lon: number) => tideStations.map((s) => ({station: s, distanceKm: Math.round(km(lat, lon, s.lat, s.lon) * 10) / 10})).sort((a, b) => a.distanceKm - b.distanceKm);

/** Spots with NO usable tide station within 40 km although CO-OPS has stations there: every one is a closed gauge (a harbour, bay, sound, creek or river station: Plymouth, Duxbury, Chatham, Key West channels, Chincoteague...). Built 2026-11-10 from the CO-OPS station list (every US spot with no pick; none has no gauge at all). A spot not listed says only that no station is near. */
export const CLOSED_GAUGES_ONLY: ReadonlySet<string> = new Set(['w-us-brant-rock', 'w-us-cape-cod', 'w-us-chincoteague', 'w-us-coastguard-beach', 'w-us-egypt-beach', 'w-us-egypt-beach-massachusetts', 'w-us-fieldstone', 'w-us-flagler-beach-pier', 'w-us-green-harbor-duxberry', 'w-us-head-of-the-meadow-beach', 'w-us-key-west', 'w-us-longnook-to-ballston-beach', 'w-us-lynne-beach', 'w-us-maguire-landing-beach', 'w-us-marconis', 'w-us-marshfield-jetty', 'w-us-nantasket-beach', 'w-us-nauset-beach', 'w-us-nauset-light-beach', 'w-us-newcombs-hollow-to-lecounts-hollow', 'w-us-plymouth-beach', 'w-us-prestons', 'w-us-revere-beach', 'w-us-rexhame', 'w-us-scituate-harbor', 'w-us-winthrop-jetty', 'w-usw-cape-mendocino']);
export const NO_OPEN_GAUGE_NOTE = 'No open-coast tide station within 40 km (harbour and bay gauges are not used).';
/** The words for a spot with no tide pick: the honest reason when gauges exist but are all closed, else the plain "no station near". */
export const noTideNote = (spotId?: string): string => (spotId && CLOSED_GAUGES_ONLY.has(spotId) ? NO_OPEN_GAUGE_NOTE : 'No tide station near this spot.');
