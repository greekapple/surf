const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** Whole inches plus the fraction in lowest sixteenths (2.625 -> 2 5/8"). */
export const inches = (v: number) => {
  let w = Math.floor(v), n = Math.round((v - w) * 16);
  if (n === 16) { w += 1; n = 0; }
  const g = gcd(n, 16);
  return `${w}${n ? ` ${n / g}/${16 / g}` : ''}″`;
};
