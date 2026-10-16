export type Skill = 'Beginner'|'Intermediate'|'Expert';
export const boardTypes = ['Performance shortboard','Everyday shortboard','Groveler','Fish','Hybrid','Midlength','Funboard','Longboard','Step-up','Gun','Soft-top','Other'] as const;
export type BoardType = typeof boardTypes[number];
export interface UserProfile {skill:Skill; region:string; scale:'Face height'|'Hawaiian'; heightUnit:'ft'|'m'; windUnit:'mph'|'kn'|'km/h'; minWave:number; maxWave:number; comfort:number; style:string; breakType:string; character:string; preferredBoards:BoardType[]; onboarded:boolean}
export interface Surfboard {id:string; name:string; manufacturer:string; model:string; type:BoardType; length:number; width:number; thickness:number; volume:number; tail?:string; fins?:string; construction?:string; rocker?:string; rails?:string; minWave?:number; maxWave?:number; character?:string; notes?:string; favorite:boolean; demo?:boolean; catalogId?:string; specificationSource?:string}
export interface SurfSpot {id:string; name:string; region:string; type:'Beach'|'Point'|'Reef'; skill:Skill; idealDirection:number; exposure:number; period:[number,number]; tides:string[]; seaward:number; character:string; hazards:string[]|null; restricted?:boolean; illustrative:true}
export interface SwellComponent {height:number; direction:number; period:number}
export interface WindConditions {speed:number; direction:number}
export interface TideConditions {height:number; stage:string}
export interface Forecast {spotId:string; timestamp:string; day:number; hour:number; face:number; offshore:number; primary:SwellComponent; secondary:SwellComponent|null; wind:WindConditions; tide:TideConditions; character:string; confidence:'Demo'; source:string; updatedAt:string; model:string; horizon:number; quality:string[]}
export type ForecastTimeSlot = Forecast;
export interface Factor {name:string; score:number; weight:number; reason:string}
export interface SpotRecommendation {spot:SurfSpot; forecast:Forecast; score:number; eligible:boolean; exclusions:string[]; factors:Factor[]}
export interface BoardRecommendation {board:Surfboard; score:number; eligible:boolean; factors:Factor[]; limited:boolean}
export interface Combination {spot:SpotRecommendation; board:BoardRecommendation|null; score:number}
export interface SurfSession {id:string; spotId:string; timestamp:string; boardId:string; actualConditions:string; accuracy:number; performance:number; satisfaction:number; notes:string}
