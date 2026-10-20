/** Extension contracts only. No camera, tracking device or inference is operational. */
export interface FutureCamera {id:string;spotId:string;latitude:number;longitude:number;status:'planned'|'offline'|'available';observedAt:string|null;permissionReference:string;retentionDays:number}
export interface FutureWaveEvent {cameraId:string;startAt:string;endAt:string;estimatedHeightFt:number|null;methodVersion:string;reliability:'unvalidated'|'validated';validationReference:string|null;temporaryActionTrackId?:string}
export interface FutureRideEvent {startAt:string;endAt:string;estimatedDistanceM:number|null;source:'manual'|'imu'|'gps'|'camera';validation:'unvalidated'|'reviewed'}
export interface FutureSessionRecord {id:string;spotId:string|null;boardId:string|null;startAt:string;endAt:string;estimatedWaveCount:number|null;rides:FutureRideEvent[];source:string;validation:'unvalidated'|'reviewed';consentReference:string|null}
