/** A18 (audit M7): what each map legend calls the layer it paints. CONTRACTS: the legend names the layer actually painted; a height layer says it is
 *  offshore and not surf size (RULES). `full` on wide screens and in the aria text, `short` on phones (two short lines; spelled out, no "Hs"). */
export type LegendLayer = 'waves' | 'swell' | 'period' | 'wind';
/** `word`: the one word on the phone's legend chip, so the painted layer reads without a tap (lead, phone pass 2). */
export const LEGEND_NAMES: Record<LegendLayer, {full: string; short: string; word: string}> = {
  waves: {full: 'Offshore wave height · not surf size', short: 'Offshore waves · not surf', word: 'Waves'},
  swell: {full: 'Offshore swell height · not surf size', short: 'Offshore swell · not surf', word: 'Swell'},   // the '0 = no swell' note: on the wide legend, and in the aria text and tooltip on phones
  period: {full: 'Wave period (peak)', short: 'Wave period (peak)', word: 'Period'},
  wind: {full: 'Wind speed at 10 m', short: 'Wind at 10 m', word: 'Wind'},
};
