/** A signed reading (a tide below datum): the minus only when the SHOWN number is not zero, so a −0.04 ft tide reads "0.0", never "−0.0"
 *  (design re-critique 2026-11-12). `shown` is the already-formatted absolute value. */
export const withSign = (value: number, shown: string): string => `${value < 0 && parseFloat(shown) !== 0 ? '−' : ''}${shown}`;   // `shown` may carry its unit ("0.0 ft")
