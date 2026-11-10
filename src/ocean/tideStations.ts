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
];
export const SF_STATION = '9414290';
/** Stations whose predictions the server ingests in addition to the existing San Francisco feed. Kept in sync with services/forecast-service.mjs by a test. */
export const extraTideStationIds = ['9414131', '9415020'];
/** T-082: stations ingested for high/low predictions only (the nearest station of every covered spot). Kept in sync with services/forecast-service.mjs by a test. */
export const hiloTideStationIds = ['9410120',  '9410230',  '9410580',  '9410599',  '9410738',  '9410777',  '9410840',  '9411189',  '9411270',  '9412110',  '9412802',  '9413375',  '9413450',  '9413616',  '9413663',  '9413745',  '9413878',  '9414275',  '9414958',  '9415469',  '9415625',  '9416841',  '9418024',  '9418767',  '9419059',  '9419750',  'TWC0413',  'TWC0419',  'TWC0445',  'TWC0473',  '9411340',  '9442861',  '9442388',  '9441102',  '9440581',  'TWC0881',  'TWC0857',  '9434132',  '9431647',  '9430104',  '9437585',  '9435380',  '9432436',  '1612366',  '1612340',  '1612376',  '1612668',  '8459681',  '8515186',  '8531680',  '8532337',  '8533071',  '8534720',  '8639168',  '8639428',  '8651370',  '8651605',  '8652226',  'TEC2789',  '8654400',  'TEC2837',  '8657419',  '8658163',  '8658559',  '8659897',  '8659182',  '8663101',  '8665494',  'TEC3047',  'TEC3127',  '8667630',  '8669625',  '8670892',  '8677344',  '8679997',  '8720194',  '8720259',  '8720291',  '8720587',  '8721120',  'TEC3693',  '8721604',  '8721649',  '8721727',  '8721804',  '8722105',  '8722212',  '8722366',  '8722862',  '8722899',  '8722979',  '8723080',  '8723170',  '8723178',  '1611400',  '1610367',  '1612482',  '1612480',  '1613226',  '1613198',  '1613155',  'TPT2799',  '1615680',  '1614465',  '1613077',  '1615395',  '1615202',  '1617277',  '1617433',  '1617760',  '1617846',  '1618578',  '1611683',  '1611443',  '1611401',  'TPT2779'];
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
/** What a fallback station is, for the note on the tide card: a harbour gauge in Hawaii, an inlet or bay-side station elsewhere. */
export const fallbackLabel = (id?: string): string => (id && HAWAII_REVIEWED[id] ? 'Harbour gauge' : 'Inlet or bay-side station');
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
export function pickTideStation<T extends {id?: string; name: string; lat: number; lon: number}>(spotLat: number, spotLon: number, stations: T[], maxKm = 40): {station: T; distanceKm: number; exposure: TideExposure; fallback?: boolean; fallbackLabel?: string} | null {
  const all = stations.map((s) => ({station: s, distanceKm: Math.round(km(spotLat, spotLon, s.lat, s.lon) * 10) / 10, exposure: tideStationExposure(s.name, s.id).exposure})).filter((x) => x.distanceKm <= maxKm).sort((a, b) => a.distanceKm - b.distanceKm);
  const anyOpen = all.some((x) => x.exposure === 'open');
  const ok = all.filter((x) => x.exposure === 'open' || x.exposure === 'unknown' || (x.exposure === 'closed-if-alternative' && !anyOpen)).map((x) => ({...x, fallback: x.exposure === 'closed-if-alternative', ...(x.exposure === 'closed-if-alternative' ? {fallbackLabel: fallbackLabel(x.station.id)} : {}), exposure: (x.exposure === 'closed-if-alternative' ? 'unknown' : x.exposure) as TideExposure}));
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
export function tideStationFor(spot: {id: string; country?: string; latitude: number; longitude: number}): {station: TideStation; distanceKm: number; /** an inlet-mouth or bay-side station used only because no open-coast station is in range: its times and range differ from the open beach */ fallback?: boolean; fallbackLabel?: string} | null {
  if (!hasUsData(spot)) return null;
  const pick = tideStationForSpot(spot.latitude, spot.longitude);
  if (nearSanFrancisco(spot.latitude, spot.longitude) && (!pick || pick.distanceKm > SF_LOCAL_KM)) { const sf = tideStations.find((s) => s.id === SF_STATION); if (sf) { const d = Math.round(km(spot.latitude, spot.longitude, sf.lat, sf.lon) * 10) / 10; if (d <= 40 && (!pick || d <= pick.distanceKm + 10)) return {station: sf, distanceKm: d}; } }
  return pick;
}
export const nearestTideStationsFor = (spot: {id: string; country?: string; latitude: number; longitude: number}) => (hasUsData(spot) ? nearestTideStations(spot.latitude, spot.longitude) : []);
/** Nearest stations by distance, for the owner's review list only (never an assignment). */
export const nearestTideStations = (lat: number, lon: number) => tideStations.map((s) => ({station: s, distanceKm: Math.round(km(lat, lon, s.lat, s.lon) * 10) / 10})).sort((a, b) => a.distanceKm - b.distanceKm);
