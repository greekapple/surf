/** Does this browser give us WebGL? Cached; kept out of WaveLive so the three.js chunk is not loaded just to ask. */
let webgl: boolean | null = null;
export function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  try { const c = document.createElement('canvas'); webgl = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { webgl = false; }
  return webgl;
}
