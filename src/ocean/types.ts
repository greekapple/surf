export type DataKind='forecast'|'observation'|'simulation';
export interface SourceInfo {provider:string;kind:DataKind;validAt:string;retrievedAt:string;issuedAt:string|null;updatedAt:string|null;url:string;nativeUnit:string;location:string;delivery?:'direct'|'saved';notes?:string}
export interface Measurement {value:number|null;unit:'ft'|'mph'|'deg'|'s'|'F'|'index';source:SourceInfo;reason?:string}
export interface OceanSwell {height:Measurement;direction:Measurement;period:Measurement}
export interface OceanRecord {spotId:string;timestamp:string;offshore:Measurement;primary:OceanSwell;secondary:OceanSwell|null;windSpeed:Measurement;windDirection:Measurement;gusts:Measurement;tide:Measurement;tideTrend:'Rising'|'Falling'|'Unknown';temperature:Measurement;face:Measurement;organization:Measurement;character:string|null;mode:'retrieved'|'simulation'}
export interface SpotEvidence {id:string;name:string;region:string;location:string;latitude:number;longitude:number;marineLatitude:number;marineLongitude:number;queryNote:string;breakType:string|null;difficulty:'Expert'|null;orientation:number|null;idealSwell:number|null;periodRange:[number,number]|null;tidePreferences:string[]|null;faceRange:[number,number]|null;hazards:string[]|null;hazardsComplete:boolean;sources:{url:string;description:string}[];checkedOn:string}
export interface ConnectionStatus {id:string;provider:string;state:'connected'|'partial'|'unavailable'|'loading';message:string;checkedAt:string;url:string;retryAfter?:number}
export interface ObservationSet {station:string;location:string;values:Record<string,Measurement>;delivery:'direct'|'saved'}
export interface OceanBundle {records:OceanRecord[];statuses:ConnectionStatus[];buoy:ObservationSet|null;waterLevel:ObservationSet|null;loadedAt:string}
