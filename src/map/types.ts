import type {Measurement} from '../ocean/types.ts';
export type MapLayer='SWELL'|'WIND'|'WAVES'|'TIDE';
export type MapVariable='Height'|'Period'|'Direction'|'Speed'|'Gusts'|'Offshore Hs'|'Breaking-wave estimate'|'Station height'|'High/low predictions';
export interface MapCamera {lat:number;lng:number;zoom:number}
export interface MapReading {value:number|null;unit:Measurement['unit'];label:string;direction:number|null;period:number|null;measurement:Measurement|null;breaking:boolean}
export interface ForecastPoint {id:string;spotId:string|null;name:string;latitude:number;longitude:number;locationLabel:string;reading:MapReading;demonstration:boolean}
