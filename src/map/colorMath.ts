/** Colour maths for the map ramps (Stage 3): CIE LCH(ab) <-> sRGB with gamut mapping, CIE76 delta E, and colour-vision-deficiency simulation (Machado et al. 2009, severity 1.0).
 *  Pure, dependency-free, unit-tested. Used by `mapConfig` to build ramps whose lightness rises steadily, and by the tests that check them. */
const WHITE = [0.95047, 1, 1.08883] as const;
const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
export type RGB = [number, number, number];
export function hexToRgb(hex: string): RGB { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
export const rgbToHex = (c: RGB) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
export function rgbToLab(rgb: RGB): [number, number, number] {
  const [r, g, b] = rgb.map((v) => toLinear(v / 255));
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / WHITE[0], y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / WHITE[2];
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
function labToLinear(L: number, a: number, b: number): [number, number, number] {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, inv = (t: number) => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
  const x = inv(fx) * WHITE[0], y = inv(fy), z = inv(fz) * WHITE[2];
  return [3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.969266 * x + 1.8760108 * y + 0.041556 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z];
}
/** LCH(ab) to sRGB, reducing chroma until the colour fits the gamut, so lightness and hue are kept exactly. */
export function lchToRgb(L: number, C: number, hDeg: number): RGB {
  const h = (hDeg * Math.PI) / 180; let c = C;
  for (let i = 0; i < 60; i++) {
    const lin = labToLinear(L, c * Math.cos(h), c * Math.sin(h));
    if (lin.every((v) => v >= -0.0005 && v <= 1.0005)) return lin.map((v) => fromLinear(Math.max(0, Math.min(1, v))) * 255) as RGB;
    c *= 0.96;
  }
  return lchToRgb(L, 0, hDeg);
}
export const deltaE = (a: RGB, b: RGB) => { const x = rgbToLab(a), y = rgbToLab(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
/** Machado, Oliveira and Fernandes (2009), severity 1.0, applied in linear RGB. */
const CVD = {
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
} as const;
export type CvdKind = keyof typeof CVD;
export function simulateCvd(rgb: RGB, kind: CvdKind): RGB {
  const lin = rgb.map((v) => toLinear(v / 255)), m = CVD[kind];
  return m.map((row) => fromLinear(Math.max(0, Math.min(1, row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]))) * 255) as RGB;
}
/** Greyscale (Rec. 709 luminance of the gamma-encoded value, as a print or an unsaturated screen shows it) as a 0..255 grey. */
export const greyOf = (rgb: RGB) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
