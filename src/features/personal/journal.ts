// Device-only extras for journal entries and the profile photo. The session records stay in the app state;
// photos and tags live beside them so the backup format is untouched.
export const JOURNAL_KEY = 'swello-journal-extras';
export const AVATAR_KEY = 'swello-avatar';
export const BOARD_PREFS_KEY = 'swello-board-prefs';
export const PHOTO_MAX_BYTES = 200 * 1024;

export interface JournalExtra {title?: string; photo?: string; tags?: string[]; height?: string; cond?: string; swell?: string}
export type JournalExtras = Record<string, JournalExtra>;

export function loadExtras(): JournalExtras {
  try {
    const v = JSON.parse(localStorage.getItem(JOURNAL_KEY) ?? '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}
export function saveExtras(x: JournalExtras): boolean {
  try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(x)); return true; } catch { return false; }
}

/** Approximate decoded size of a data URL in bytes. */
export const dataUrlBytes = (u: string) => Math.floor((u.length - u.indexOf(',') - 1) * 0.75);

/** Downscale an image file to a JPEG data URL no larger than `maxBytes`. Returns null when it cannot be decoded. */
export async function downscale(file: File, maxEdge: number, maxBytes = PHOTO_MAX_BYTES): Promise<string | null> {
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { return null; }
  let edge = maxEdge, quality = 0.82, out = '';
  for (let i = 0; i < 8; i++) {
    const k = Math.min(1, edge / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const g = c.getContext('2d');
    if (!g) return null;
    g.drawImage(bmp, 0, 0, c.width, c.height);
    out = c.toDataURL('image/jpeg', quality);
    if (dataUrlBytes(out) <= maxBytes) break;
    quality = Math.max(0.5, quality - 0.1); edge = Math.round(edge * 0.8);
  }
  bmp.close();
  return dataUrlBytes(out) <= maxBytes ? out : null;
}

export interface BoardPrefs {swellDirs: string[]; periodMin: number; periodMax: number; tides: ('Low' | 'Mid' | 'High')[]}
export const COMPASS8 = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export const DEFAULT_BOARD_PREFS: BoardPrefs = {swellDirs: [], periodMin: 10, periodMax: 16, tides: []};
export function loadBoardPrefs(): BoardPrefs {
  try {
    const v = JSON.parse(localStorage.getItem(BOARD_PREFS_KEY) ?? '{}');
    return {
      swellDirs: Array.isArray(v.swellDirs) ? v.swellDirs.filter((d: unknown) => COMPASS8.includes(d as never)) : [],
      periodMin: Number.isFinite(v.periodMin) ? v.periodMin : DEFAULT_BOARD_PREFS.periodMin,
      periodMax: Number.isFinite(v.periodMax) ? v.periodMax : DEFAULT_BOARD_PREFS.periodMax,
      tides: Array.isArray(v.tides) ? v.tides.filter((t: unknown) => t === 'Low' || t === 'Mid' || t === 'High') : [],
    };
  } catch { return DEFAULT_BOARD_PREFS; }
}
export function saveBoardPrefs(p: BoardPrefs) { try { localStorage.setItem(BOARD_PREFS_KEY, JSON.stringify(p)); } catch { /* memory only */ } }

export function tideSummary(t: BoardPrefs['tides']): string {
  if (!t.length) return 'Not set';
  const order = ['Low', 'Mid', 'High'] as const;
  const s = order.filter((x) => t.includes(x));
  return s.length === 1 ? s[0] : s.length === 3 ? 'Any tide' : s.join(' to ').replace('Low to High', 'Low, High');
}
