/** Synthetic educational geometry only. No forecast, nearshore or observation input. */
export const waveReference=Object.freeze({pixelsPerMetre:112,troughY:390,proneLengthM:1.75,boardLengthM:2.13,viewWidth:960,viewHeight:485});
export const wavePresets=Object.freeze([[1,2],[2,3],[3,5],[4,6],[6,8],[8,10]] as const);
export function waveGeometry(faceFt:number){
 if(!Number.isFinite(faceFt)||faceFt<1||faceFt>10)throw new RangeError('Educational face height must be 1–10 feet.');
 const heightM=faceFt*.3048,h=heightM*waveReference.pixelsPerMetre,t=waveReference.troughY,c=t-h;
 // Every control point is at/below the crest. Trough-to-crest is exactly h on a fixed metric grid.
 const outline=`M 20 ${t-h*.1} C 155 ${t-h*.12} 250 ${c} 430 ${c} C 478 ${c} 510 ${c+h*.18} 486 ${c+h*.38} C 478 ${c+h*.25} 453 ${c+h*.2} 451 ${c+h*.27} C 460 ${c+h*.57} 533 ${t} 610 ${t}`;
 return {faceFt,heightM,crestY:c,troughY:t,heightPx:h,outline,fill:`${outline} L 960 435 L 20 435 Z`,reference:waveReference};
}
export function waveLengthLabel(feet:number,unit:'ft'|'m'){
 return `${Number((feet*(unit==='m'?.3048:1)).toFixed(unit==='m'?2:1))} ${unit}`;
}
