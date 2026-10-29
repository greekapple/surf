/** HTTP policy shared by the Worker and deterministic regression tests. */
export function retryAfterMs(value, now = Date.now()) {
 if (!value) return null;
 const seconds = Number(value);
 if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
 const date = Date.parse(value);
 return Number.isFinite(date) ? Math.max(0, date - now) : null;
}
export function failureCategory(error) {
 if (error.validation || error instanceof SyntaxError) return 'invalid-payload';
 if (error.status === 429) return 'rate-limited';
 if (error.status === 404) return 'not-found';
 if (error.status >= 500) return 'upstream';
 if (error.name === 'TimeoutError' || error.name === 'AbortError') return 'timeout';
 if (error.status) return 'http';
 return error.validation ? 'invalid-payload' : 'network';
}
export function forecastRange(payload) {
 let times = [];
 if (payload?.hourly?.time) times = payload.hourly.time.map(t => typeof t === 'number' ? t * 1000 : Date.parse(t));
 else if (payload?.table) {const i = payload.table.columnNames.indexOf('time'); if (i >= 0) times = payload.table.rows.map(r => Date.parse(r[i]));}
 else if (payload?.predictions || payload?.data) times = (payload.predictions ?? payload.data).map(r => Date.parse(r.t.replace(' ', 'T') + 'Z'));
 else if (typeof payload === 'string') times = [...payload.matchAll(/(?:^|\n)(\d{4}-\d\d-\d\dT[^,\n]+)/g)].map(m => Date.parse(m[1]));
 times = times.filter(Number.isFinite);
 return times.length ? {start:new Date(Math.min(...times)).toISOString(), end:new Date(Math.max(...times)).toISOString()} : null;
}
export function clippedGridURL(target, metadata, now) {
 const url = new URL(target.url), match = decodeURIComponent(url.search.slice(1)).match(/^([^[]+)\[\(([^)]+)\):(\d+):\(([^)]+)\)\](.*)$/);
 if (!match || !metadata) return target.url;
 const start = Math.max(Date.parse(match[2]), Date.parse(metadata.start)), end = Math.min(Date.parse(match[4]), Date.parse(metadata.end));
 if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end < now - 86400000) return target.url;
 url.search = `${match[1]}[(${new Date(start).toISOString().replace('.000Z','Z')}):${match[3]}:(${new Date(end).toISOString().replace('.000Z','Z')})]${match[5]}`;
 return url.href.replaceAll('[','%5B').replaceAll(']','%5D');
}
